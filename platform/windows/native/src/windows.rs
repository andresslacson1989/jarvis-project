use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
        mpsc::{SyncSender, sync_channel},
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
    ActivationCallbackResult, ActivationCancellation, ActivationRequest, NativeError,
    NativeErrorKind, Role, STABLE_OWNER_NAMESPACE, SecondLaunch,
    handles::{MutexWaitResult, OwnedHandle, OwnedMutex, last_error, native_failure, wide},
    identity::FileIdentity,
    layout::{self, PreparedLayout},
    security::{
        DIRECTORY_ACCESS_MASK, EVENT_ACCESS_MASK, ExplicitSecurity, MUTEX_ACCESS_MASK,
        STATE_ACCESS_MASK, current_sid,
    },
    state::{
        OwnerIdentity, ROLE_MAINTENANCE, ROLE_NORMAL, STATE_ACKNOWLEDGED, STATE_IDLE,
        STATE_PENDING, STATUS_CALLBACK_QUEUED, STATUS_CALLBACK_RUNNING, STATUS_CANCEL_REQUESTED,
        STATUS_CANCELLED, STATUS_HANDLED, STATUS_NONE, STATUS_UNCERTAIN, StateFile, StateRecord,
    },
};

const ACTIVATION_EVENT_PREFIX: &str = "Local\\JARVIS-DESKTOP-ACTIVATE-";
const ACK_EVENT_PREFIX: &str = "Local\\JARVIS-DESKTOP-ACK-";
const PENDING_HOUSEKEEPING: Duration = Duration::from_secs(2);
const ACTIVATION_RECONCILIATION: Duration = Duration::from_millis(500);
const CALLBACK_DEADLINE: Duration = Duration::from_millis(500);

enum ArbitrationCommand {
    Wait(u32, SyncSender<Result<MutexWaitResult, NativeError>>),
    Release(SyncSender<Result<(), NativeError>>),
}

#[derive(Debug)]
struct ArbitrationLease {
    command: SyncSender<ArbitrationCommand>,
    join: Mutex<Option<JoinHandle<()>>>,
    released: AtomicBool,
}

impl ArbitrationLease {
    fn spawn(mut mutex: OwnedMutex) -> Result<Arc<Self>, NativeError> {
        let (command, receiver) = sync_channel(1);
        let (ready_sender, ready_receiver) = sync_channel(0);
        let thread = thread::Builder::new()
            .name("jarvis-arbitration-owner".to_owned())
            .spawn(move || {
                let _ = ready_sender.send(());
                while let Ok(command) = receiver.recv() {
                    match command {
                        ArbitrationCommand::Wait(timeout_ms, result_sender) => {
                            let _ = result_sender.send(mutex.wait(timeout_ms));
                        }
                        ArbitrationCommand::Release(result_sender) => {
                            let result = mutex.release();
                            let _ = result_sender.send(result);
                            break;
                        }
                    }
                }
            })
            .map_err(|_| native_failure(NativeErrorKind::ArbitrationUnavailable))?;
        if ready_receiver
            .recv_timeout(Duration::from_millis(500))
            .is_err()
        {
            drop(command);
            let _ = thread.join();
            return Err(native_failure(NativeErrorKind::ArbitrationUnavailable));
        }
        Ok(Arc::new(Self {
            command,
            join: Mutex::new(Some(thread)),
            released: AtomicBool::new(false),
        }))
    }

    fn wait(&self, timeout_ms: u32) -> Result<MutexWaitResult, NativeError> {
        if self.released.load(Ordering::Acquire) {
            return Err(native_failure(NativeErrorKind::ArbitrationUnavailable));
        }
        let (result_sender, result_receiver) = sync_channel(0);
        self.command
            .send(ArbitrationCommand::Wait(timeout_ms, result_sender))
            .map_err(|_| native_failure(NativeErrorKind::ArbitrationUnavailable))?;
        result_receiver
            .recv_timeout(Duration::from_millis(u64::from(timeout_ms) + 500))
            .map_err(|_| native_failure(NativeErrorKind::ArbitrationUnavailable))?
    }

    fn release(&self) -> Result<(), NativeError> {
        if self.released.load(Ordering::Acquire) {
            return Ok(());
        }
        let (result_sender, result_receiver) = sync_channel(0);
        self.command
            .send(ArbitrationCommand::Release(result_sender))
            .map_err(|_| native_failure(NativeErrorKind::ArbitrationReleaseUncertain))?;
        result_receiver
            .recv_timeout(Duration::from_millis(500))
            .map_err(|_| native_failure(NativeErrorKind::ArbitrationReleaseUncertain))??;
        let mut join = self
            .join
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::ArbitrationReleaseUncertain))?;
        if let Some(thread) = join.take() {
            thread
                .join()
                .map_err(|_| native_failure(NativeErrorKind::ArbitrationReleaseUncertain))?;
        }
        self.released.store(true, Ordering::Release);
        Ok(())
    }
}

impl Drop for ArbitrationLease {
    fn drop(&mut self) {
        if !self.released.load(Ordering::Acquire) && self.release().is_err() {
            // A failed release leaves the process-level ownership decision
            // ambiguous. Do not silently drop the guard.
            std::process::abort();
        }
    }
}

#[derive(Debug)]
struct OwnerInner {
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
    worker_cleanup_failed: AtomicBool,
    callback_active: AtomicBool,
}

#[derive(Debug)]
pub struct OwnerLease {
    inner: Arc<OwnerInner>,
    arbitration: Arc<ArbitrationLease>,
}

#[derive(Clone, Debug)]
pub struct OwnerController {
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

#[derive(Clone, Debug)]
pub(crate) struct ActivationRequestContext {
    inner: Arc<OwnerInner>,
    generation: u64,
}

#[derive(Debug)]
pub struct ActivationPresentation {
    inner: Arc<OwnerInner>,
    generation: u64,
    completed: bool,
}

#[derive(Debug)]
pub enum ActivationStart {
    Started(ActivationPresentation),
    Cancelled,
}

impl ActivationRequestContext {
    pub(crate) fn begin_presentation(&self) -> Result<ActivationStart, NativeError> {
        if self.inner.worker_cleanup_failed.load(Ordering::Acquire) {
            return Err(native_failure(NativeErrorKind::ActivationUncertain));
        }
        let outcome = self.inner.state.transact(|record| {
            if record.request_generation != self.generation {
                return Ok(true);
            }
            if record.state == STATE_ACKNOWLEDGED && record.status == STATUS_CANCELLED {
                return Ok(true);
            }
            if record.state != STATE_PENDING {
                return Ok(true);
            }
            match record.status {
                STATUS_NONE | STATUS_CALLBACK_QUEUED => {
                    record.status = STATUS_CALLBACK_RUNNING;
                    Ok(false)
                }
                STATUS_CANCEL_REQUESTED => {
                    record.state = STATE_ACKNOWLEDGED;
                    record.status = STATUS_CANCELLED;
                    record.ack_generation = self.generation;
                    Ok(true)
                }
                STATUS_CALLBACK_RUNNING | STATUS_UNCERTAIN => {
                    Err(native_failure(NativeErrorKind::ActivationUncertain))
                }
                _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
            }
        });
        let cancelled = match outcome {
            Ok(cancelled) => cancelled,
            Err(error) => {
                self.inner
                    .worker_cleanup_failed
                    .store(true, Ordering::Release);
                return Err(error);
            }
        };
        if cancelled {
            signal_ack(&self.inner);
            Ok(ActivationStart::Cancelled)
        } else {
            Ok(ActivationStart::Started(ActivationPresentation {
                inner: Arc::clone(&self.inner),
                generation: self.generation,
                completed: false,
            }))
        }
    }

    pub(crate) fn cancel(&self) -> ActivationCancellation {
        let outcome = self.inner.state.transact(|record| {
            if record.request_generation != self.generation {
                return Ok(true);
            }
            if record.state != STATE_PENDING {
                return match record.status {
                    STATUS_CANCELLED if record.state == STATE_ACKNOWLEDGED => Ok(true),
                    _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
                };
            }
            match record.status {
                STATUS_NONE | STATUS_CALLBACK_QUEUED => {
                    record.state = STATE_ACKNOWLEDGED;
                    record.status = STATUS_CANCELLED;
                    record.ack_generation = self.generation;
                    Ok(true)
                }
                STATUS_CALLBACK_RUNNING => {
                    record.status = STATUS_CANCEL_REQUESTED;
                    Ok(false)
                }
                STATUS_CANCEL_REQUESTED | STATUS_UNCERTAIN => Ok(false),
                _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
            }
        });
        match outcome {
            Ok(true) => {
                signal_ack(&self.inner);
                ActivationCancellation::Cancelled
            }
            Ok(false) => ActivationCancellation::InFlight,
            Err(_) => {
                self.inner
                    .worker_cleanup_failed
                    .store(true, Ordering::Release);
                ActivationCancellation::Uncertain
            }
        }
    }
}

impl ActivationPresentation {
    pub fn complete(mut self, result: ActivationCallbackResult) -> Result<(), NativeError> {
        let outcome = self.complete_inner(result);
        self.completed = true;
        outcome
    }

    fn complete_inner(&self, result: ActivationCallbackResult) -> Result<(), NativeError> {
        let outcome = self.inner.state.transact(|record| {
            if record.request_generation != self.generation {
                return Ok(false);
            }
            if record.state != STATE_PENDING && record.state != STATE_ACKNOWLEDGED {
                return Ok(false);
            }
            match result {
                ActivationCallbackResult::Handled => {
                    if record.state == STATE_ACKNOWLEDGED && record.status == STATUS_HANDLED {
                        return Ok(false);
                    }
                    if record.state == STATE_PENDING
                        && matches!(
                            record.status,
                            STATUS_CALLBACK_RUNNING | STATUS_CANCEL_REQUESTED | STATUS_UNCERTAIN
                        )
                    {
                        record.state = STATE_ACKNOWLEDGED;
                        record.status = STATUS_HANDLED;
                        record.ack_generation = self.generation;
                        return Ok(true);
                    }
                    Err(native_failure(NativeErrorKind::ActivationUncertain))
                }
                ActivationCallbackResult::NotStarted => {
                    if record.state == STATE_ACKNOWLEDGED && record.status == STATUS_CANCELLED {
                        return Ok(false);
                    }
                    Err(native_failure(NativeErrorKind::ActivationUncertain))
                }
                ActivationCallbackResult::Uncertain => {
                    if record.state == STATE_ACKNOWLEDGED {
                        return Ok(false);
                    }
                    record.state = STATE_PENDING;
                    record.status = STATUS_UNCERTAIN;
                    record.ack_generation = 0;
                    Ok(false)
                }
            }
        })?;
        if outcome {
            signal_ack(&self.inner);
        }
        Ok(())
    }
}

impl Drop for ActivationPresentation {
    fn drop(&mut self) {
        if !self.completed
            && self
                .complete_inner(ActivationCallbackResult::Uncertain)
                .is_err()
        {
            self.inner
                .worker_cleanup_failed
                .store(true, Ordering::Release);
        }
    }
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
    let (mutex, created) = create_mutex(&mutex_name, &mutex_security, &sid)?;
    let arbitration = ArbitrationLease::spawn(mutex)?;
    match arbitration.wait(0)? {
        MutexWaitResult::Acquired | MutexWaitResult::Abandoned => {
            return acquire_owner(
                Arc::clone(&arbitration),
                prepared,
                sid,
                sid_hash,
                security,
                role,
            );
        }
        MutexWaitResult::Timeout if created => {
            return Err(native_failure(NativeErrorKind::ArbitrationUnavailable));
        }
        MutexWaitResult::Timeout => {
            #[cfg(feature = "test-support")]
            signal_recovery_waiter_barrier();
        }
    }

    let activation = acquire_second_launch(prepared, &sid, &security, sid_hash, role);
    match activation {
        Ok(result) => Ok(result),
        Err(original_error) => match arbitration.wait(500) {
            Ok(MutexWaitResult::Acquired | MutexWaitResult::Abandoned) => {
                let recovered_prepared = layout::prepare()?;
                if recovered_prepared.parent_identity != parent_identity {
                    return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
                }
                acquire_recovered_owner(
                    Arc::clone(&arbitration),
                    recovered_prepared,
                    sid.clone(),
                    sid_hash,
                    role,
                    SecurityBundle::for_sid(&sid)?,
                )
            }
            Ok(MutexWaitResult::Timeout) => Err(original_error),
            Err(_) => Err(original_error),
        },
    }
}

fn acquire_owner(
    arbitration: Arc<ArbitrationLease>,
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
                        worker_cleanup_failed: AtomicBool::new(false),
                        callback_active: AtomicBool::new(false),
                    }),
                    arbitration,
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
    arbitration: Arc<ArbitrationLease>,
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
    acquire_owner(arbitration, prepared, sid, sid_hash, security, role)
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
    pub fn controller(&self) -> OwnerController {
        OwnerController {
            inner: Arc::clone(&self.inner),
        }
    }

    pub fn release(self) -> Result<(), NativeError> {
        self.arbitration.release()
    }

    pub fn mark_ready(&self) -> Result<(), NativeError> {
        self.controller().mark_ready()
    }

    pub fn start_activation_worker<F>(&self, callback: F) -> Result<ActivationWorker, NativeError>
    where
        F: Fn(ActivationRequest) -> ActivationCallbackResult + Send + 'static,
    {
        self.controller().start_activation_worker(callback)
    }
}

impl Drop for OwnerLease {
    fn drop(&mut self) {
        if !self.arbitration.released.load(Ordering::Acquire) && self.arbitration.release().is_err()
        {
            std::process::abort();
        }
    }
}

impl OwnerController {
    pub fn mark_ready(&self) -> Result<(), NativeError> {
        if self.inner.worker_cleanup_failed.load(Ordering::Acquire) {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        self.inner.state.transact(|record| {
            validate_owner_record(&self.inner, record)?;
            if record.readiness != 0 {
                return Ok(());
            }
            record.readiness = 1;
            Ok(())
        })
    }

    /// Starts the single owned activation dispatcher.
    ///
    /// The callback is a bounded protocol participant: it must return within
    /// the native callback deadline after either completing or explicitly
    /// reporting `Uncertain`. A callback that remains active past the bounded
    /// shutdown window is never detached; worker drop fails closed by
    /// terminating the process rather than leaving an unowned callback thread.
    pub fn start_activation_worker<F>(&self, callback: F) -> Result<ActivationWorker, NativeError>
    where
        F: Fn(ActivationRequest) -> ActivationCallbackResult + Send + 'static,
    {
        if self.inner.role != Role::Normal {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        if self.inner.worker_cleanup_failed.load(Ordering::Acquire)
            || self.inner.worker_failed.load(Ordering::Acquire)
        {
            reconcile_inflight(&self.inner)?;
            self.inner
                .worker_cleanup_failed
                .store(false, Ordering::Release);
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
                            let _ = mark_worker_failed(&thread_inner);
                            break;
                        }
                    }
                    if thread_inner.stopping.load(Ordering::Acquire) {
                        break;
                    }
                    if result == WAIT_OBJECT_0 || result == WAIT_TIMEOUT {
                        process_pending(&thread_inner, &callback);
                        if thread_inner.worker_failed.load(Ordering::Acquire) {
                            let _ = mark_worker_failed(&thread_inner);
                            break;
                        }
                    } else {
                        let _ = mark_worker_failed(&thread_inner);
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
        let deadline = Instant::now() + CALLBACK_DEADLINE;
        while self.inner.callback_active.load(Ordering::Acquire) && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(5));
        }
        if self.inner.callback_active.load(Ordering::Acquire) {
            self.inner.worker_failed.store(true, Ordering::Release);
            self.inner
                .worker_cleanup_failed
                .store(true, Ordering::Release);
            // A callback that ignores the bounded shutdown protocol cannot be
            // safely detached or joined. Terminate rather than hang or leave
            // an unowned activation worker behind.
            std::process::abort();
        }
        if let Some(thread) = self.thread.take()
            && thread.join().is_err()
        {
            self.inner
                .worker_cleanup_failed
                .store(true, Ordering::Release);
        }
        if mark_worker_failed(&self.inner).is_err() || reconcile_inflight(&self.inner).is_err() {
            self.inner
                .worker_cleanup_failed
                .store(true, Ordering::Release);
        }
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

    if let Some(true) = settle_prior_request(&state, current_pid, current_start)? {
        return Ok(Acquisition::SecondLaunch(SecondLaunch {
            acknowledged: true,
        }));
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
            return Err(cancel_before_dispatch(
                &state,
                request_generation,
                error.kind,
            ));
        }
    };
    let ack = match open_event(&ack_name, SYNCHRONIZE) {
        Ok(event) => event,
        Err(error) => {
            return Err(cancel_before_dispatch(
                &state,
                request_generation,
                error.kind,
            ));
        }
    };
    // SAFETY: the existing authority owns the event and the handle remains
    // valid for this bounded signal operation.
    if unsafe { SetEvent(activation.raw()) } == 0 {
        return Err(cancel_before_dispatch(
            &state,
            request_generation,
            NativeErrorKind::ActivationUnavailable,
        ));
    }
    // SAFETY: the wait is explicitly bounded to the contract's two-second
    // acknowledgement envelope.
    let wait = unsafe { WaitForSingleObject(ack.raw(), 2_000) };
    if wait == WAIT_OBJECT_0 {
        let settled = settle_request(&state, request_generation)?;
        if settled == ActivationSettlement::Pending {
            return match observe_request_after_signal(&state, request_generation) {
                Ok(ActivationSettlement::Handled) => Ok(Acquisition::SecondLaunch(SecondLaunch {
                    acknowledged: true,
                })),
                Ok(ActivationSettlement::Cancelled) => {
                    Err(native_failure(NativeErrorKind::ActivationUnavailable))
                }
                Ok(ActivationSettlement::Pending) | Err(_) => {
                    Err(native_failure(NativeErrorKind::ActivationUncertain))
                }
            };
        }
        return match settled {
            ActivationSettlement::Handled => Ok(Acquisition::SecondLaunch(SecondLaunch {
                acknowledged: true,
            })),
            ActivationSettlement::Cancelled => {
                Err(native_failure(NativeErrorKind::ActivationUnavailable))
            }
            ActivationSettlement::Pending => {
                Err(native_failure(NativeErrorKind::ActivationUncertain))
            }
        };
    }

    match reconcile_request(&state, &ack, request_generation) {
        Ok(ActivationSettlement::Handled) => Ok(Acquisition::SecondLaunch(SecondLaunch {
            acknowledged: true,
        })),
        Ok(ActivationSettlement::Cancelled) => {
            Err(native_failure(NativeErrorKind::ActivationUnavailable))
        }
        Ok(ActivationSettlement::Pending) | Err(_) => {
            Err(native_failure(NativeErrorKind::ActivationUncertain))
        }
    }
}

#[cfg(feature = "test-support")]
fn signal_recovery_waiter_barrier() {
    if std::env::var("JARVIS_NATIVE_QUALIFICATION_CHILD").as_deref() == Ok("recovery-waiter")
        && let Ok(path) = std::env::var("JARVIS_NATIVE_QUALIFICATION_READY_FILE")
    {
        let _ = std::fs::write(path, b"opened-existing-mutex");
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ActivationSettlement {
    Handled,
    Cancelled,
    Pending,
}

fn settle_prior_request(
    state: &StateFile,
    current_pid: u32,
    current_start: u64,
) -> Result<Option<bool>, NativeError> {
    let snapshot = state.read_snapshot()?;
    match snapshot.state {
        STATE_ACKNOWLEDGED if snapshot.status == STATUS_HANDLED => {
            state.transact(|record| {
                if record.request_generation != snapshot.request_generation
                    || record.state != STATE_ACKNOWLEDGED
                    || record.status != STATUS_HANDLED
                {
                    return Err(native_failure(NativeErrorKind::ActivationUncertain));
                }
                clear_request(record);
                Ok(())
            })?;
            Ok(Some(true))
        }
        STATE_ACKNOWLEDGED if snapshot.status == STATUS_CANCELLED => {
            state.transact(|record| {
                if record.request_generation != snapshot.request_generation
                    || record.state != STATE_ACKNOWLEDGED
                    || record.status != STATUS_CANCELLED
                {
                    return Err(native_failure(NativeErrorKind::ActivationUncertain));
                }
                clear_request(record);
                Ok(())
            })?;
            Ok(Some(false))
        }
        STATE_PENDING
            if matches!(snapshot.status, STATUS_NONE | STATUS_CALLBACK_QUEUED)
                && !request_is_alive(&snapshot, current_pid, current_start) =>
        {
            state.transact(|record| {
                if record.request_generation == snapshot.request_generation
                    && record.state == STATE_PENDING
                    && matches!(record.status, STATUS_NONE | STATUS_CALLBACK_QUEUED)
                {
                    clear_request(record);
                }
                Ok(())
            })?;
            Ok(None)
        }
        STATE_IDLE => Ok(None),
        _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
    }
}

fn settle_request(
    state: &StateFile,
    request_generation: u64,
) -> Result<ActivationSettlement, NativeError> {
    state.transact(|record| {
        if record.request_generation != request_generation {
            return Err(native_failure(NativeErrorKind::ActivationUncertain));
        }
        match (record.state, record.status) {
            (STATE_ACKNOWLEDGED, STATUS_HANDLED) => {
                clear_request(record);
                Ok(ActivationSettlement::Handled)
            }
            (STATE_ACKNOWLEDGED, STATUS_CANCELLED) => {
                clear_request(record);
                Ok(ActivationSettlement::Cancelled)
            }
            (STATE_PENDING, _) => Ok(ActivationSettlement::Pending),
            _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
        }
    })
}

fn cancel_before_dispatch(
    state: &StateFile,
    request_generation: u64,
    kind: NativeErrorKind,
) -> NativeError {
    match state.transact(|record| {
        if record.request_generation != request_generation {
            return Ok(false);
        }
        if record.state == STATE_PENDING
            && matches!(record.status, STATUS_NONE | STATUS_CALLBACK_QUEUED)
        {
            clear_request(record);
            Ok(true)
        } else {
            Ok(false)
        }
    }) {
        Ok(true) => native_failure(kind),
        Ok(false) | Err(_) => native_failure(NativeErrorKind::ActivationUncertain),
    }
}

fn reconcile_request(
    state: &StateFile,
    ack: &OwnedHandle,
    request_generation: u64,
) -> Result<ActivationSettlement, NativeError> {
    let deadline = Instant::now() + ACTIVATION_RECONCILIATION;
    loop {
        let snapshot = state.read_snapshot()?;
        if snapshot.request_generation != request_generation {
            return Err(native_failure(NativeErrorKind::ActivationUncertain));
        }
        match (snapshot.state, snapshot.status) {
            (STATE_ACKNOWLEDGED, STATUS_HANDLED) => {
                return settle_request(state, request_generation);
            }
            (STATE_ACKNOWLEDGED, STATUS_CANCELLED) => {
                return settle_request(state, request_generation);
            }
            (STATE_PENDING, STATUS_NONE | STATUS_CALLBACK_QUEUED) => {
                if matches!(
                    cancel_state_request(state, request_generation)?,
                    ActivationCancellation::Cancelled
                ) {
                    signal_external_ack(ack);
                }
            }
            (STATE_PENDING, STATUS_CALLBACK_RUNNING) => {
                let _ = cancel_state_request(state, request_generation)?;
            }
            (STATE_PENDING, STATUS_CANCEL_REQUESTED | STATUS_UNCERTAIN) => {}
            _ => return Err(native_failure(NativeErrorKind::ActivationUncertain)),
        }
        if Instant::now() >= deadline {
            return Ok(ActivationSettlement::Pending);
        }
        thread::sleep(Duration::from_millis(25));
    }
}

fn observe_request_after_signal(
    state: &StateFile,
    request_generation: u64,
) -> Result<ActivationSettlement, NativeError> {
    let deadline = Instant::now() + ACTIVATION_RECONCILIATION;
    loop {
        match state.read_snapshot()? {
            snapshot if snapshot.request_generation == request_generation => {
                match (snapshot.state, snapshot.status) {
                    (STATE_ACKNOWLEDGED, STATUS_HANDLED)
                    | (STATE_ACKNOWLEDGED, STATUS_CANCELLED) => {
                        return settle_request(state, request_generation);
                    }
                    (STATE_PENDING, _) => {}
                    _ => return Err(native_failure(NativeErrorKind::ActivationUncertain)),
                }
            }
            _ => return Err(native_failure(NativeErrorKind::ActivationUncertain)),
        }
        if Instant::now() >= deadline {
            return Ok(ActivationSettlement::Pending);
        }
        thread::sleep(Duration::from_millis(25));
    }
}

fn cancel_state_request(
    state: &StateFile,
    request_generation: u64,
) -> Result<ActivationCancellation, NativeError> {
    state.transact(|record| {
        if record.request_generation != request_generation {
            return Err(native_failure(NativeErrorKind::ActivationUncertain));
        }
        match (record.state, record.status) {
            (STATE_PENDING, STATUS_NONE | STATUS_CALLBACK_QUEUED) => {
                record.state = STATE_ACKNOWLEDGED;
                record.status = STATUS_CANCELLED;
                record.ack_generation = request_generation;
                Ok(ActivationCancellation::Cancelled)
            }
            (STATE_PENDING, STATUS_CALLBACK_RUNNING) => {
                record.status = STATUS_CANCEL_REQUESTED;
                Ok(ActivationCancellation::InFlight)
            }
            (STATE_PENDING, STATUS_CANCEL_REQUESTED | STATUS_UNCERTAIN) => {
                Ok(ActivationCancellation::Uncertain)
            }
            (STATE_ACKNOWLEDGED, STATUS_CANCELLED) => Ok(ActivationCancellation::Cancelled),
            _ => Ok(ActivationCancellation::Uncertain),
        }
    })
}

fn request_is_alive(snapshot: &StateRecord, current_pid: u32, current_start: u64) -> bool {
    if snapshot.request_pid == current_pid && snapshot.request_start_filetime == current_start {
        return true;
    }
    process_start_filetime_for_pid(snapshot.request_pid)
        .map(|start| start == snapshot.request_start_filetime)
        .unwrap_or(false)
}

fn process_pending<F>(inner: &Arc<OwnerInner>, callback: &F)
where
    F: Fn(ActivationRequest) -> ActivationCallbackResult,
{
    if inner.worker_cleanup_failed.load(Ordering::Acquire) {
        return;
    }
    let snapshot = match inner.state.read_snapshot() {
        Ok(snapshot) => snapshot,
        Err(_) => {
            let _ = mark_worker_failed(inner);
            return;
        }
    };
    if snapshot.state == STATE_ACKNOWLEDGED {
        let started = pending_started(inner, snapshot.request_generation);
        if started.is_some_and(|started| started.elapsed() >= PENDING_HOUSEKEEPING)
            && reset_pending_if_current(inner, snapshot.request_generation).is_err()
        {
            inner.worker_cleanup_failed.store(true, Ordering::Release);
        }
        return;
    }
    if snapshot.state != STATE_PENDING {
        if let Ok(mut pending) = inner.pending.lock() {
            *pending = None;
        }
        return;
    }

    let (_started, attempted) = {
        let mut pending = match inner.pending.lock() {
            Ok(pending) => pending,
            Err(_) => {
                let _ = mark_worker_failed(inner);
                return;
            }
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

    if snapshot.readiness == 0
        || snapshot.session != inner.session
        || snapshot.request_session != inner.session
        || snapshot.request_sid_hash != inner.sid_hash
    {
        return;
    }

    if !request_is_alive(&snapshot, inner.pid, inner.start_filetime) {
        return;
    }

    if attempted || snapshot.status != STATUS_NONE {
        return;
    }

    let queued = inner.state.transact(|record| {
        if record.state == STATE_PENDING
            && record.request_generation == snapshot.request_generation
            && record.status == STATUS_NONE
        {
            record.status = STATUS_CALLBACK_QUEUED;
            Ok(true)
        } else {
            Ok(false)
        }
    });
    if queued != Ok(true) {
        if queued.is_err() {
            inner.worker_cleanup_failed.store(true, Ordering::Release);
        }
        return;
    }

    if let Ok(mut pending) = inner.pending.lock()
        && let Some((generation, _, attempted)) = pending.as_mut()
        && *generation == snapshot.request_generation
    {
        *attempted = true;
    }

    inner.callback_active.store(true, Ordering::Release);
    let callback_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        callback(ActivationRequest {
            process_id: snapshot.request_pid,
            generation: snapshot.request_generation,
            context: ActivationRequestContext {
                inner: Arc::clone(inner),
                generation: snapshot.request_generation,
            },
        })
    }))
    .unwrap_or(ActivationCallbackResult::Uncertain);
    inner.callback_active.store(false, Ordering::Release);

    if finalize_callback(inner, snapshot.request_generation, callback_result).is_err() {
        inner.worker_cleanup_failed.store(true, Ordering::Release);
    }
}

fn pending_started(inner: &Arc<OwnerInner>, request_generation: u64) -> Option<Instant> {
    inner.pending.lock().ok().and_then(|pending| {
        pending.as_ref().and_then(|(generation, started, _)| {
            (*generation == request_generation).then_some(*started)
        })
    })
}

fn finalize_callback(
    inner: &Arc<OwnerInner>,
    request_generation: u64,
    result: ActivationCallbackResult,
) -> Result<(), NativeError> {
    let acknowledged = inner.state.transact(|record| {
        if record.request_generation != request_generation {
            return Ok(false);
        }
        match result {
            ActivationCallbackResult::Handled => {
                if record.state == STATE_ACKNOWLEDGED && record.status == STATUS_HANDLED {
                    Ok(true)
                } else {
                    if record.state == STATE_PENDING {
                        record.status = STATUS_UNCERTAIN;
                    }
                    Ok(false)
                }
            }
            ActivationCallbackResult::NotStarted => {
                if record.state == STATE_ACKNOWLEDGED && record.status == STATUS_CANCELLED {
                    Ok(false)
                } else if record.state == STATE_PENDING
                    && matches!(record.status, STATUS_NONE | STATUS_CALLBACK_QUEUED)
                {
                    record.state = STATE_ACKNOWLEDGED;
                    record.status = STATUS_CANCELLED;
                    record.ack_generation = request_generation;
                    Ok(false)
                } else {
                    if record.state == STATE_PENDING {
                        record.status = STATUS_UNCERTAIN;
                    }
                    Ok(false)
                }
            }
            ActivationCallbackResult::Uncertain => {
                if record.state == STATE_PENDING {
                    if matches!(record.status, STATUS_NONE | STATUS_CALLBACK_QUEUED) {
                        record.state = STATE_ACKNOWLEDGED;
                        record.status = STATUS_CANCELLED;
                        record.ack_generation = request_generation;
                    } else {
                        record.status = STATUS_UNCERTAIN;
                    }
                }
                Ok(false)
            }
        }
    })?;
    let should_signal = acknowledged
        || inner
            .state
            .read_snapshot()
            .map(|record| {
                record.state == STATE_ACKNOWLEDGED
                    && matches!(record.status, STATUS_HANDLED | STATUS_CANCELLED)
            })
            .unwrap_or(false);
    if should_signal {
        signal_ack(inner);
        if let Ok(mut pending) = inner.pending.lock() {
            *pending = None;
        }
    }
    Ok(())
}

fn reset_pending_if_current(
    inner: &Arc<OwnerInner>,
    request_generation: u64,
) -> Result<(), NativeError> {
    inner.state.transact(|record| {
        if record.request_generation == request_generation
            && matches!(record.state, STATE_PENDING | STATE_ACKNOWLEDGED)
        {
            clear_request(record);
        }
        Ok(())
    })?;
    if let Ok(mut pending) = inner.pending.lock()
        && pending
            .as_ref()
            .is_some_and(|(generation, _, _)| *generation == request_generation)
    {
        *pending = None;
    }
    Ok(())
}

fn mark_worker_failed(inner: &Arc<OwnerInner>) -> Result<(), NativeError> {
    inner.worker_failed.store(true, Ordering::Release);
    let result = inner.state.transact(|record| {
        validate_owner_record(inner, record)?;
        record.readiness = 0;
        if record.state == STATE_ACKNOWLEDGED {
            clear_request(record);
        }
        Ok(())
    });
    if result.is_err() {
        inner.worker_cleanup_failed.store(true, Ordering::Release);
    }
    result
}

fn reconcile_inflight(inner: &Arc<OwnerInner>) -> Result<(), NativeError> {
    let snapshot = inner.state.read_snapshot()?;
    match snapshot.state {
        STATE_ACKNOWLEDGED => reset_pending_if_current(inner, snapshot.request_generation)?,
        STATE_PENDING => return Err(native_failure(NativeErrorKind::ActivationUncertain)),
        STATE_IDLE => {}
        _ => return Err(native_failure(NativeErrorKind::StateCorrupt)),
    }
    Ok(())
}

fn signal_ack(inner: &Arc<OwnerInner>) {
    signal_external_ack(&inner.ack_event);
}

fn signal_external_ack(ack_event: &OwnedHandle) {
    // SAFETY: the owner event handle remains valid while the state transition
    // that produced the terminal result is observed by the client.
    unsafe {
        let _ = SetEvent(ack_event.raw());
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
    // The dedicated arbitration thread performs every wait and release so
    // mutex ownership never becomes thread-affine state in OwnerInner.
    let raw = unsafe { CreateMutexW(security.as_ptr(), 0, name.as_ptr()) };
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
