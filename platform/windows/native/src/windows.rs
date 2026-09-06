use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc::sync_channel,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use getrandom::fill as fill_random;
use sha2::{Digest, Sha256};
use windows_sys::Win32::{
    Foundation::{ERROR_ALREADY_EXISTS, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT},
    Storage::FileSystem::SYNCHRONIZE,
    System::{
        RemoteDesktop::ProcessIdToSessionId,
        Threading::{
            CreateEventW, CreateMutexW, EVENT_MODIFY_STATE, GetCurrentProcess, GetCurrentProcessId,
            GetProcessTimes, MUTEX_MODIFY_STATE, OpenEventW, OpenMutexW, OpenProcess,
            PROCESS_QUERY_LIMITED_INFORMATION, SetEvent, WaitForSingleObject,
        },
    },
};

use super::{
    ActivationRequest, NativeError, NativeErrorKind, Role, STABLE_OWNER_NAMESPACE, SecondLaunch,
    handles::{MutexWaitResult, OwnedHandle, OwnedMutex, last_error, native_failure, wide},
    identity::FileIdentity,
    layout::{self, PreparedLayout},
    security::{
        DIRECTORY_ACCESS_MASK, EVENT_ACCESS_MASK, ExplicitSecurity, MUTEX_ACCESS_MASK,
        STATE_ACCESS_MASK, current_sid,
    },
    state::{
        OwnerIdentity, ROLE_MAINTENANCE, ROLE_NORMAL, STATE_ACKNOWLEDGED, STATE_IDLE,
        STATE_PENDING, STATUS_HANDLED, STATUS_NONE, StateFile, StateRecord,
    },
};

const ACTIVATION_EVENT_PREFIX: &str = "Local\\JARVIS-DESKTOP-ACTIVATE-";
const ACK_EVENT_PREFIX: &str = "Local\\JARVIS-DESKTOP-ACK-";
const PENDING_HOUSEKEEPING: Duration = Duration::from_secs(2);

#[derive(Debug)]
struct OwnerInner {
    _mutex: OwnedMutex,
    _layout: layout::Layout,
    state: StateFile,
    activation_event: OwnedHandle,
    ack_event: OwnedHandle,
    session: u32,
    pid: u32,
    start_filetime: u64,
    sid_hash: [u8; 32],
    role: Role,
    pending: Mutex<Option<(u64, Instant, bool)>>,
    stopping: AtomicBool,
    worker_failed: AtomicBool,
}

// OwnerInner is shared only by the bounded activation worker and the Tauri
// owner. StateFile transactions serialize all mutable state and the kernel
// event handles are safe to signal/wait concurrently.
// SAFETY: OwnerInner contains only process-owned kernel handles and state
// transactions are serialized before shared access.
unsafe impl Send for OwnerInner {}
// SAFETY: all shared mutable state is behind synchronization and the kernel
// event operations are safe for concurrent use by this owner.
unsafe impl Sync for OwnerInner {}

#[derive(Clone, Debug)]
pub struct OwnerLease {
    inner: Arc<OwnerInner>,
}

#[derive(Debug)]
pub struct ActivationWorker {
    inner: Arc<OwnerInner>,
    thread: Option<JoinHandle<()>>,
}

#[derive(Debug)]
pub enum Acquisition {
    Owner(OwnerLease),
    SecondLaunch(SecondLaunch),
}

struct SecurityBundle {
    directory: ExplicitSecurity,
    state: ExplicitSecurity,
    event: ExplicitSecurity,
}

impl SecurityBundle {
    fn for_sid(sid: &str) -> Result<Self, NativeError> {
        Ok(Self {
            directory: ExplicitSecurity::for_sid(sid, DIRECTORY_ACCESS_MASK)?,
            state: ExplicitSecurity::for_sid(sid, STATE_ACCESS_MASK)?,
            event: ExplicitSecurity::for_sid(sid, EVENT_ACCESS_MASK)?,
        })
    }
}

pub fn acquire(role: Role) -> Result<Acquisition, NativeError> {
    let prepared = layout::prepare()?;
    let sid = current_sid()?;
    let sid_hash = hash_sid(&sid);
    let parent_identity = prepared.parent_identity;
    let mutex_security = ExplicitSecurity::for_sid(&sid, MUTEX_ACCESS_MASK)?;
    let security = SecurityBundle::for_sid(&sid)?;
    let mutex_name = stable_mutex_name(&sid, prepared.parent_identity);
    let (mut mutex, created) = create_mutex(&mutex_name, &mutex_security, &sid)?;
    if !created {
        match mutex.wait(0)? {
            MutexWaitResult::Acquired | MutexWaitResult::Abandoned => {
                return acquire_recovered_owner(
                    mutex,
                    prepared,
                    sid.clone(),
                    sid_hash,
                    role,
                    security,
                );
            }
            MutexWaitResult::Timeout => {}
        }

        let activation = acquire_second_launch(prepared, &sid, &security, sid_hash, role);
        match activation {
            Ok(result) => return Ok(result),
            Err(original_error) => match mutex.wait(500) {
                Ok(MutexWaitResult::Acquired | MutexWaitResult::Abandoned) => {
                    let recovered_prepared = layout::prepare()?;
                    if recovered_prepared.parent_identity != parent_identity {
                        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
                    }
                    return acquire_recovered_owner(
                        mutex,
                        recovered_prepared,
                        sid.clone(),
                        sid_hash,
                        role,
                        SecurityBundle::for_sid(&sid)?,
                    );
                }
                Ok(MutexWaitResult::Timeout) => return Err(original_error),
                Err(_) => return Err(original_error),
            },
        }
    }

    acquire_owner(mutex, prepared, sid, sid_hash, security, role)
}

fn acquire_owner(
    mutex: OwnedMutex,
    mut prepared: PreparedLayout,
    sid: String,
    sid_hash: [u8; 32],
    security: SecurityBundle,
    role: Role,
) -> Result<Acquisition, NativeError> {
    let parent_identity = prepared.parent_identity;
    let deadline = Instant::now() + Duration::from_millis(500);

    loop {
        let layout = prepared.finish(&security.directory, &sid)?;
        let pid = current_pid();
        let session = current_session(pid)?;
        // SAFETY: GetCurrentProcess returns a valid pseudo-handle with no close
        // obligation.
        let start_filetime = process_start_filetime(unsafe { GetCurrentProcess() })?;
        let role_value = role_value(role);
        let mut nonce = [0u8; 16];
        fill_random(&mut nonce)
            .map_err(|_| native_failure(NativeErrorKind::SecurityBoundaryUnavailable))?;

        let activation_name = event_name(ACTIVATION_EVENT_PREFIX, nonce);
        let ack_name = event_name(ACK_EVENT_PREFIX, nonce);
        let activation_event = create_event(&activation_name, &security.event)?;
        let ack_event = create_event(&ack_name, &security.event)?;
        let initial = StateRecord::new(
            role_value,
            OwnerIdentity {
                parent: layout.parent_identity,
                root: layout.root_identity,
                pid,
                start_filetime,
                session,
                sid_hash,
                nonce,
            },
        );
        match StateFile::create_owner(&layout.state_path, &security.state, &sid, initial) {
            Ok(state) => {
                return Ok(Acquisition::Owner(OwnerLease {
                    inner: Arc::new(OwnerInner {
                        _mutex: mutex,
                        _layout: layout,
                        state,
                        activation_event,
                        ack_event,
                        session,
                        pid,
                        start_filetime,
                        sid_hash,
                        role,
                        pending: Mutex::new(None),
                        stopping: AtomicBool::new(false),
                        worker_failed: AtomicBool::new(false),
                    }),
                }));
            }
            Err(error)
                if error.kind == NativeErrorKind::StateUnavailable && Instant::now() < deadline =>
            {
                drop(ack_event);
                drop(activation_event);
                drop(layout);
                sleep_bounded_until(deadline);
                prepared = layout::prepare()?;
                if prepared.parent_identity != parent_identity {
                    return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
                }
            }
            Err(error) => return Err(error),
        }
    }
}

fn acquire_recovered_owner(
    mutex: OwnedMutex,
    prepared: PreparedLayout,
    sid: String,
    sid_hash: [u8; 32],
    role: Role,
    security: SecurityBundle,
) -> Result<Acquisition, NativeError> {
    let parent_identity = prepared.parent_identity;
    validate_recovered_state(
        prepared,
        &sid,
        &security.directory,
        &security.state,
        sid_hash,
    )?;
    let prepared = layout::prepare()?;
    if prepared.parent_identity != parent_identity {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    acquire_owner(mutex, prepared, sid, sid_hash, security, role)
}

fn validate_recovered_state(
    prepared: PreparedLayout,
    sid: &str,
    directory_security: &ExplicitSecurity,
    state_security: &ExplicitSecurity,
    sid_hash: [u8; 32],
) -> Result<(), NativeError> {
    let layout = prepared.validate_existing(sid, directory_security)?;
    let state_path = layout.state_path.clone();
    let expected_parent = layout.parent_identity;
    let expected_root = layout.root_identity;
    drop(layout);

    let started = Instant::now();
    let mut delay_index = 0usize;
    loop {
        match StateFile::open_client(&state_path, state_security, sid) {
            Ok(state) => {
                let snapshot = state.read_snapshot()?;
                if snapshot.parent != expected_parent
                    || snapshot.sid_hash != sid_hash
                    || snapshot.root != expected_root
                {
                    return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
                }
                let owner_alive = process_start_filetime_for_pid(snapshot.pid)
                    .ok()
                    .map(|start| start == snapshot.start_filetime)
                    .unwrap_or(false)
                    && current_session(snapshot.pid).ok() == Some(snapshot.session);
                if owner_alive {
                    return Err(native_failure(NativeErrorKind::ArbitrationUnavailable));
                }
                return Ok(());
            }
            Err(error)
                if error.kind == NativeErrorKind::StateUnavailable
                    && started.elapsed() < Duration::from_millis(500) =>
            {
                sleep_bounded(&mut delay_index, started);
            }
            Err(error) if error.kind == NativeErrorKind::StateUnavailable => {
                if !std::fs::symlink_metadata(&state_path).is_ok() {
                    return Ok(());
                }
                return Err(error);
            }
            Err(error) => return Err(error),
        }
    }
}

impl OwnerLease {
    pub fn mark_ready(&self) -> Result<(), NativeError> {
        self.inner.state.transact(|record| {
            validate_owner_record(&self.inner, record)?;
            if record.readiness != 0 {
                return Ok(());
            }
            record.readiness = 1;
            Ok(())
        })
    }

    pub fn start_activation_worker<F>(&self, callback: F) -> Result<ActivationWorker, NativeError>
    where
        F: Fn(ActivationRequest) -> bool + Send + 'static,
    {
        if self.inner.role != Role::Normal {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        self.inner.stopping.store(false, Ordering::Release);
        self.inner.worker_failed.store(false, Ordering::Release);
        let inner = Arc::clone(&self.inner);
        let thread_inner = Arc::clone(&inner);
        let (ready_sender, ready_receiver) = sync_channel(0);
        let thread = thread::Builder::new()
            .name("jarvis-activation-receiver".to_owned())
            .spawn(move || {
                let mut initialized = false;
                while !thread_inner.stopping.load(Ordering::Acquire) {
                    // SAFETY: the event handle is owned by the Arc-held owner
                    // and remains alive until the worker has joined.
                    let result =
                        unsafe { WaitForSingleObject(thread_inner.activation_event.raw(), 250) };
                    if !initialized {
                        initialized = true;
                        let ready = result != WAIT_FAILED;
                        let _ = ready_sender.send(ready);
                        if !ready {
                            mark_worker_failed(&thread_inner);
                            break;
                        }
                    }
                    if thread_inner.stopping.load(Ordering::Acquire) {
                        break;
                    }
                    if result == WAIT_OBJECT_0 || result == WAIT_TIMEOUT {
                        process_pending(&thread_inner, &callback);
                    } else {
                        mark_worker_failed(&thread_inner);
                        break;
                    }
                }
            })
            .map_err(|_| native_failure(NativeErrorKind::EventUnavailable))?;
        match ready_receiver.recv_timeout(Duration::from_millis(500)) {
            Ok(true) => {}
            _ => {
                self.inner.stopping.store(true, Ordering::Release);
                // SAFETY: SetEvent only wakes the receiver being joined below.
                unsafe {
                    let _ = SetEvent(self.inner.activation_event.raw());
                }
                let _ = thread.join();
                return Err(native_failure(NativeErrorKind::EventUnavailable));
            }
        }
        Ok(ActivationWorker {
            inner,
            thread: Some(thread),
        })
    }
}

impl Drop for ActivationWorker {
    fn drop(&mut self) {
        self.inner.stopping.store(true, Ordering::Release);
        // SAFETY: SetEvent is used only to wake the bounded 250ms receiver;
        // the worker still observes the atomic stop flag before processing.
        unsafe {
            let _ = SetEvent(self.inner.activation_event.raw());
        }
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
        mark_worker_failed(&self.inner);
        reconcile_inflight(&self.inner);
    }
}

fn acquire_second_launch(
    prepared: PreparedLayout,
    sid: &str,
    security: &SecurityBundle,
    sid_hash: [u8; 32],
    role: Role,
) -> Result<Acquisition, NativeError> {
    let layout = prepared.validate_existing(sid, &security.directory)?;
    let state = settle_client_state(&layout.state_path, &security.state, sid)?;
    let current_pid = current_pid();
    let current_session = current_session(current_pid)?;
    // SAFETY: GetCurrentProcess returns a valid pseudo-handle with no close
    // obligation.
    let current_start = process_start_filetime(unsafe { GetCurrentProcess() })?;
    let snapshot = state.read_snapshot()?;
    if snapshot.parent != layout.parent_identity
        || snapshot.root != layout.root_identity
        || snapshot.sid_hash != sid_hash
    {
        return Err(native_failure(NativeErrorKind::ObjectCollision));
    }
    if snapshot.role != role_value(role) {
        return Err(native_failure(match snapshot.role {
            ROLE_MAINTENANCE => NativeErrorKind::MaintenanceHeld,
            ROLE_NORMAL => NativeErrorKind::NormalHeld,
            _ => NativeErrorKind::ObjectCollision,
        }));
    }
    if role != Role::Normal {
        return Err(native_failure(NativeErrorKind::MaintenanceHeld));
    }
    if snapshot.session != current_session {
        return Err(native_failure(NativeErrorKind::OwnerOtherSession));
    }
    if snapshot.readiness == 0 {
        return Err(native_failure(NativeErrorKind::NotReady));
    }

    let request_generation = state.transact(|record| {
        if record.role != ROLE_NORMAL
            || record.parent != layout.parent_identity
            || record.root != layout.root_identity
            || record.sid_hash != sid_hash
            || record.session != current_session
            || record.readiness == 0
        {
            return Err(native_failure(NativeErrorKind::ActivationUnavailable));
        }
        if record.state != STATE_IDLE {
            return Err(native_failure(NativeErrorKind::ActivationUnavailable));
        }
        record.state = STATE_PENDING;
        record.status = STATUS_NONE;
        record.request_generation = record.generation;
        record.ack_generation = 0;
        record.request_pid = current_pid;
        record.request_start_filetime = current_start;
        record.request_session = current_session;
        record.request_sid_hash = sid_hash;
        Ok(record.request_generation)
    })?;

    let activation_name = event_name(ACTIVATION_EVENT_PREFIX, snapshot.nonce);
    let ack_name = event_name(ACK_EVENT_PREFIX, snapshot.nonce);
    let activation = match open_event(&activation_name, EVENT_MODIFY_STATE) {
        Ok(event) => event,
        Err(error) => {
            return Err(activation_failure(&state, request_generation, error.kind));
        }
    };
    let ack = match open_event(&ack_name, SYNCHRONIZE) {
        Ok(event) => event,
        Err(error) => {
            return Err(activation_failure(&state, request_generation, error.kind));
        }
    };
    // SAFETY: the existing authority owns the event and the handle remains
    // valid for this bounded signal operation.
    if unsafe { SetEvent(activation.raw()) } == 0 {
        return Err(activation_failure(
            &state,
            request_generation,
            NativeErrorKind::ActivationUnavailable,
        ));
    }
    // SAFETY: the wait is explicitly bounded to the contract's two-second
    // acknowledgement envelope.
    let wait = unsafe { WaitForSingleObject(ack.raw(), 2_000) };
    if wait != WAIT_OBJECT_0 {
        return Err(activation_failure(
            &state,
            request_generation,
            if wait == WAIT_TIMEOUT {
                NativeErrorKind::ActivationUnavailable
            } else if wait == WAIT_FAILED {
                NativeErrorKind::ActivationUncertain
            } else {
                NativeErrorKind::ActivationUnavailable
            },
        ));
    }
    match state.transact(|record| {
        if record.state != STATE_ACKNOWLEDGED
            || record.request_generation != request_generation
            || record.ack_generation != request_generation
            || record.status != STATUS_HANDLED
        {
            return Err(native_failure(NativeErrorKind::ActivationUncertain));
        }
        clear_request(record);
        Ok(())
    }) {
        Ok(()) => Ok(Acquisition::SecondLaunch(SecondLaunch {
            acknowledged: true,
        })),
        Err(error) => Err(activation_failure(&state, request_generation, error.kind)),
    }
}

fn activation_failure(
    state: &StateFile,
    request_generation: u64,
    kind: NativeErrorKind,
) -> NativeError {
    match state.transact(|record| {
        if record.request_generation == request_generation
            && matches!(record.state, STATE_PENDING | STATE_ACKNOWLEDGED)
        {
            clear_request(record);
        }
        Ok(())
    }) {
        Ok(()) => native_failure(kind),
        Err(_) => native_failure(NativeErrorKind::ActivationUncertain),
    }
}

fn process_pending<F>(inner: &Arc<OwnerInner>, callback: &F)
where
    F: Fn(ActivationRequest) -> bool,
{
    let snapshot = match inner.state.read_snapshot() {
        Ok(snapshot) => snapshot,
        Err(_) => return,
    };
    if snapshot.state != STATE_PENDING && snapshot.state != STATE_ACKNOWLEDGED {
        if let Ok(mut pending) = inner.pending.lock() {
            *pending = None;
        }
        return;
    }

    let (pending_started, callback_attempted) = {
        let mut pending = match inner.pending.lock() {
            Ok(pending) => pending,
            Err(_) => return,
        };
        match *pending {
            Some((generation, started, attempted)) if generation == snapshot.request_generation => {
                (started, attempted)
            }
            _ => {
                let started = Instant::now();
                *pending = Some((snapshot.request_generation, started, false));
                (started, false)
            }
        }
    };

    if snapshot.state == STATE_ACKNOWLEDGED {
        if pending_started.elapsed() >= PENDING_HOUSEKEEPING {
            reset_pending_if_current(inner, snapshot.request_generation);
        }
        return;
    }

    if snapshot.readiness == 0
        || snapshot.session != inner.session
        || snapshot.request_session != inner.session
        || snapshot.request_sid_hash != inner.sid_hash
    {
        if pending_started.elapsed() >= PENDING_HOUSEKEEPING {
            reset_pending_if_current(inner, snapshot.request_generation);
        }
        return;
    }

    if process_start_filetime_for_pid(snapshot.request_pid)
        .map(|start| start == snapshot.request_start_filetime)
        != Ok(true)
    {
        if pending_started.elapsed() >= PENDING_HOUSEKEEPING {
            reset_pending_if_current(inner, snapshot.request_generation);
        }
        return;
    }

    if callback_attempted {
        if pending_started.elapsed() >= PENDING_HOUSEKEEPING {
            reset_pending_if_current(inner, snapshot.request_generation);
        }
        return;
    }

    if let Ok(mut pending) = inner.pending.lock()
        && pending
            .as_ref()
            .is_some_and(|(generation, _, _)| *generation == snapshot.request_generation)
        && let Some((_, _, attempted)) = pending.as_mut()
    {
        *attempted = true;
    }

    let callback_succeeded = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        callback(ActivationRequest {
            process_id: snapshot.request_pid,
        })
    }))
    .unwrap_or(false);

    if callback_succeeded {
        let acknowledged = inner.state.transact(|record| {
            if record.state != STATE_PENDING
                || record.request_generation != snapshot.request_generation
            {
                return Err(native_failure(NativeErrorKind::ActivationUnavailable));
            }
            record.state = STATE_ACKNOWLEDGED;
            record.status = STATUS_HANDLED;
            record.ack_generation = record.request_generation;
            Ok(true)
        });
        if acknowledged.is_ok() {
            // SAFETY: the owner event handle remains valid for the owner
            // lifetime and the client waits only on this bounded signal.
            unsafe {
                let _ = SetEvent(inner.ack_event.raw());
            }
            if let Ok(mut pending) = inner.pending.lock() {
                *pending = None;
            }
        } else if pending_started.elapsed() >= PENDING_HOUSEKEEPING {
            reset_pending_if_current(inner, snapshot.request_generation);
        }
    } else if pending_started.elapsed() >= PENDING_HOUSEKEEPING {
        reset_pending_if_current(inner, snapshot.request_generation);
    }
}

fn reset_pending_if_current(inner: &Arc<OwnerInner>, request_generation: u64) {
    let _ = inner.state.transact(|record| {
        if record.request_generation == request_generation
            && matches!(record.state, STATE_PENDING | STATE_ACKNOWLEDGED)
        {
            clear_request(record);
        }
        Ok(())
    });
    if let Ok(mut pending) = inner.pending.lock()
        && pending
            .as_ref()
            .is_some_and(|(generation, _, _)| *generation == request_generation)
    {
        *pending = None;
    }
}

fn mark_worker_failed(inner: &Arc<OwnerInner>) {
    inner.worker_failed.store(true, Ordering::Release);
    let _ = inner.state.transact(|record| {
        validate_owner_record(inner, record)?;
        record.readiness = 0;
        if matches!(record.state, STATE_PENDING | STATE_ACKNOWLEDGED) {
            clear_request(record);
        }
        Ok(())
    });
}

fn reconcile_inflight(inner: &Arc<OwnerInner>) {
    if let Ok(snapshot) = inner.state.read_snapshot()
        && matches!(snapshot.state, STATE_PENDING | STATE_ACKNOWLEDGED)
    {
        reset_pending_if_current(inner, snapshot.request_generation);
    }
}

fn clear_request(record: &mut StateRecord) {
    record.state = STATE_IDLE;
    record.status = STATUS_NONE;
    record.request_generation = 0;
    record.ack_generation = 0;
    record.request_pid = 0;
    record.request_start_filetime = 0;
    record.request_session = 0;
    record.request_sid_hash = [0; 32];
}

fn validate_owner_record(inner: &OwnerInner, record: &StateRecord) -> Result<(), NativeError> {
    if record.role != role_value(inner.role)
        || record.pid != inner.pid
        || record.start_filetime != inner.start_filetime
        || record.session != inner.session
        || record.sid_hash != inner.sid_hash
        || record.parent != inner._layout.parent_identity
        || record.root != inner._layout.root_identity
    {
        return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
    }
    Ok(())
}

fn role_value(role: Role) -> u8 {
    match role {
        Role::Normal => ROLE_NORMAL,
        Role::Maintenance => ROLE_MAINTENANCE,
    }
}

fn hash_sid(sid: &str) -> [u8; 32] {
    Sha256::digest(sid.as_bytes()).into()
}

fn stable_mutex_name(sid: &str, parent: FileIdentity) -> String {
    let mut hasher = Sha256::new();
    hasher.update(STABLE_OWNER_NAMESPACE.as_bytes());
    hasher.update([0]);
    hasher.update(sid.as_bytes());
    hasher.update(parent.as_bytes());
    let digest = hasher.finalize();
    format!("Global\\JARVIS-DESKTOP-{:x}", digest)
}

fn event_name(prefix: &str, nonce: [u8; 16]) -> String {
    let mut text = String::with_capacity(prefix.len() + 32);
    text.push_str(prefix);
    for value in nonce {
        use std::fmt::Write;
        let _ = write!(text, "{value:02x}");
    }
    text
}

fn create_mutex(
    name: &str,
    security: &ExplicitSecurity,
    sid: &str,
) -> Result<(OwnedMutex, bool), NativeError> {
    let name = wide(name);
    // SAFETY: name/security remain valid for the synchronous creator call.
    let raw = unsafe { CreateMutexW(security.as_ptr(), 1, name.as_ptr()) };
    if raw.is_null() && last_error() == windows_sys::Win32::Foundation::ERROR_ACCESS_DENIED {
        // CreateMutexW requests the creator's full mutex access when opening
        // an existing named object. Re-open the existing object with exactly
        // the rights required by the bounded wait/release protocol instead of
        // broadening the stable object's DACL.
        // SAFETY: the name remains valid for the synchronous open call.
        let reopened = unsafe {
            OpenMutexW(
                MUTEX_MODIFY_STATE
                    | windows_sys::Win32::Storage::FileSystem::READ_CONTROL
                    | SYNCHRONIZE,
                0,
                name.as_ptr(),
            )
        };
        let handle = OwnedHandle::from_raw(reopened, NativeErrorKind::ArbitrationUnavailable)?;
        security.validate_handle(
            &handle,
            sid,
            windows_sys::Win32::Security::Authorization::SE_KERNEL_OBJECT,
        )?;
        return Ok((OwnedMutex::new(handle, false), false));
    }
    let handle = OwnedHandle::from_raw(raw, NativeErrorKind::ArbitrationUnavailable)?;
    let created = last_error() != ERROR_ALREADY_EXISTS;
    if created {
        security.apply_to_handle(
            &handle,
            windows_sys::Win32::Security::Authorization::SE_KERNEL_OBJECT,
        )?;
    } else {
        security.validate_handle(
            &handle,
            sid,
            windows_sys::Win32::Security::Authorization::SE_KERNEL_OBJECT,
        )?;
    }
    Ok((OwnedMutex::new(handle, created), created))
}

fn create_event(name: &str, security: &ExplicitSecurity) -> Result<OwnedHandle, NativeError> {
    let name = wide(name);
    // SAFETY: the event name/security remain valid for the synchronous call.
    let raw = unsafe { CreateEventW(security.as_ptr(), 0, 0, name.as_ptr()) };
    let existing = last_error() == ERROR_ALREADY_EXISTS;
    let handle = OwnedHandle::from_raw(raw, NativeErrorKind::EventUnavailable)?;
    if existing {
        drop(handle);
        return Err(native_failure(NativeErrorKind::ObjectCollision));
    }
    security.apply_to_handle(
        &handle,
        windows_sys::Win32::Security::Authorization::SE_KERNEL_OBJECT,
    )?;
    Ok(handle)
}

fn open_event(name: &str, access: u32) -> Result<OwnedHandle, NativeError> {
    let name = wide(name);
    // SAFETY: the NUL-terminated name remains valid for the synchronous call.
    let raw = unsafe { OpenEventW(access, 0, name.as_ptr()) };
    OwnedHandle::from_raw(raw, NativeErrorKind::EventUnavailable)
}

fn settle_client_state(
    path: &std::path::Path,
    security: &ExplicitSecurity,
    sid: &str,
) -> Result<StateFile, NativeError> {
    let started = Instant::now();
    let mut delay_index = 0usize;
    loop {
        match StateFile::open_client(path, security, sid) {
            Ok(state) => match state.read_snapshot() {
                Ok(_) => return Ok(state),
                Err(error) if started.elapsed() < Duration::from_millis(500) => {
                    if matches!(
                        error.kind,
                        NativeErrorKind::StateUnavailable
                            | NativeErrorKind::StateCorrupt
                            | NativeErrorKind::LockTimeout
                    ) {
                        sleep_bounded(&mut delay_index, started);
                        continue;
                    }
                    return Err(error);
                }
                Err(error) => return Err(error),
            },
            Err(error) if started.elapsed() < Duration::from_millis(500) => {
                if matches!(
                    error.kind,
                    NativeErrorKind::StateUnavailable | NativeErrorKind::StateCorrupt
                ) {
                    sleep_bounded(&mut delay_index, started);
                    continue;
                }
                return Err(error);
            }
            Err(error) => return Err(error),
        }
    }
}

fn sleep_bounded(delay_index: &mut usize, started: Instant) {
    const BACKOFF: [u64; 5] = [10, 25, 50, 100, 200];
    if let Some(delay) = BACKOFF.get(*delay_index) {
        let remaining = Duration::from_millis(500).saturating_sub(started.elapsed());
        thread::sleep(Duration::from_millis(*delay).min(remaining));
        *delay_index += 1;
    } else {
        thread::yield_now();
    }
}

fn sleep_bounded_until(deadline: Instant) {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if !remaining.is_zero() {
        thread::sleep(Duration::from_millis(10).min(remaining));
    }
}

fn current_pid() -> u32 {
    // SAFETY: GetCurrentProcessId has no preconditions.
    unsafe { GetCurrentProcessId() }
}

fn current_session(pid: u32) -> Result<u32, NativeError> {
    let mut session = 0u32;
    // SAFETY: the output pointer is valid for one session ID.
    if unsafe { ProcessIdToSessionId(pid, &mut session) } == 0 {
        return Err(native_failure(NativeErrorKind::OwnerOtherSession));
    }
    Ok(session)
}

fn process_start_filetime(
    process: windows_sys::Win32::Foundation::HANDLE,
) -> Result<u64, NativeError> {
    let mut creation = windows_sys::Win32::Foundation::FILETIME::default();
    let mut exit = windows_sys::Win32::Foundation::FILETIME::default();
    let mut kernel = windows_sys::Win32::Foundation::FILETIME::default();
    let mut user = windows_sys::Win32::Foundation::FILETIME::default();
    // SAFETY: all FILETIME outputs are valid and the process handle is either
    // the current-process pseudo-handle or an owned query handle.
    if unsafe { GetProcessTimes(process, &mut creation, &mut exit, &mut kernel, &mut user) } == 0 {
        return Err(native_failure(NativeErrorKind::StateUnavailable));
    }
    Ok((u64::from(creation.dwHighDateTime) << 32) | u64::from(creation.dwLowDateTime))
}

fn process_start_filetime_for_pid(pid: u32) -> Result<u64, NativeError> {
    // SAFETY: OpenProcess is called with the minimum query right needed for
    // identity validation and a non-inheritable handle.
    let raw = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    let handle = OwnedHandle::from_raw(raw, NativeErrorKind::StateUnavailable)?;
    process_start_filetime(handle.raw())
}
