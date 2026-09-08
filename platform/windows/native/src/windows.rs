use std::{
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicU8, AtomicU64, AtomicUsize, Ordering},
        mpsc::{SyncSender, sync_channel},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use getrandom::fill as fill_random;
use sha2::{Digest, Sha256};
use windows_sys::Win32::{
    Foundation::{
        ERROR_ALREADY_EXISTS, ERROR_INVALID_PARAMETER, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT,
    },
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
const SHUTDOWN_DEADLINE: Duration = Duration::from_millis(1_000);

const ARBITRATION_ACTIVE: u8 = 0;
const ARBITRATION_RELEASED: u8 = 1;
const ARBITRATION_UNCERTAIN: u8 = 2;
const ARBITRATION_DEFERRED: u8 = 3;

const OWNER_LIFECYCLE_ACTIVE: u8 = 0;
const OWNER_LIFECYCLE_RELEASED: u8 = 1;
const OWNER_LIFECYCLE_DEFERRED: u8 = 2;
const OWNER_LIFECYCLE_ARBITRATION_UNCERTAIN: u8 = 3;

enum ArbitrationCommand {
    Wait(u32, SyncSender<Result<MutexWaitResult, NativeError>>),
    Release(SyncSender<Result<(), NativeError>>),
}

#[derive(Debug)]
struct ArbitrationLease {
    command: Mutex<Option<SyncSender<ArbitrationCommand>>>,
    join: Mutex<Option<JoinHandle<()>>>,
    terminal: AtomicU8,
}

#[cfg(feature = "test-support")]
static ACTIVE_ARBITRATION_THREADS: AtomicUsize = AtomicUsize::new(0);

#[cfg(feature = "test-support")]
static HOLD_BEFORE_ARBITRATION_RELEASE: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
static ARBITRATION_RELEASE_BARRIER_REACHED: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
static PANIC_AFTER_CALLBACK: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
static HOLD_CANCEL_AFTER_PREFLIGHT: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
static CANCEL_AFTER_PREFLIGHT_BARRIER_REACHED: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
static HOLD_CANCEL_BEFORE_ACK: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
static CANCEL_BEFORE_ACK_BARRIER_REACHED: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) fn active_arbitration_threads_for_test() -> usize {
    ACTIVE_ARBITRATION_THREADS.load(Ordering::Acquire)
}

#[cfg(feature = "test-support")]
pub(crate) fn hold_before_arbitration_release_for_test() {
    ARBITRATION_RELEASE_BARRIER_REACHED.store(false, Ordering::Release);
    HOLD_BEFORE_ARBITRATION_RELEASE.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn arbitration_release_barrier_reached_for_test() -> bool {
    ARBITRATION_RELEASE_BARRIER_REACHED.load(Ordering::Acquire)
}

#[cfg(feature = "test-support")]
pub(crate) fn continue_arbitration_release_for_test() {
    HOLD_BEFORE_ARBITRATION_RELEASE.store(false, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn panic_next_worker_after_callback_for_test() {
    PANIC_AFTER_CALLBACK.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn hold_cancel_after_preflight_for_test() {
    CANCEL_AFTER_PREFLIGHT_BARRIER_REACHED.store(false, Ordering::Release);
    HOLD_CANCEL_AFTER_PREFLIGHT.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn cancel_after_preflight_barrier_reached_for_test() -> bool {
    CANCEL_AFTER_PREFLIGHT_BARRIER_REACHED.load(Ordering::Acquire)
}

#[cfg(feature = "test-support")]
pub(crate) fn continue_cancel_after_preflight_for_test() {
    HOLD_CANCEL_AFTER_PREFLIGHT.store(false, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn hold_cancel_before_ack_for_test() {
    CANCEL_BEFORE_ACK_BARRIER_REACHED.store(false, Ordering::Release);
    HOLD_CANCEL_BEFORE_ACK.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn cancel_before_ack_barrier_reached_for_test() -> bool {
    CANCEL_BEFORE_ACK_BARRIER_REACHED.load(Ordering::Acquire)
}

#[cfg(feature = "test-support")]
pub(crate) fn continue_cancel_before_ack_for_test() {
    HOLD_CANCEL_BEFORE_ACK.store(false, Ordering::Release);
}

#[cfg(feature = "test-support")]
fn wait_before_arbitration_release_for_test() {
    if HOLD_BEFORE_ARBITRATION_RELEASE.load(Ordering::Acquire) {
        ARBITRATION_RELEASE_BARRIER_REACHED.store(true, Ordering::Release);
        while HOLD_BEFORE_ARBITRATION_RELEASE.load(Ordering::Acquire) {
            thread::sleep(Duration::from_millis(1));
        }
        ARBITRATION_RELEASE_BARRIER_REACHED.store(false, Ordering::Release);
    }
}

#[cfg(feature = "test-support")]
fn wait_cancel_after_preflight_for_test() {
    if HOLD_CANCEL_AFTER_PREFLIGHT.load(Ordering::Acquire) {
        CANCEL_AFTER_PREFLIGHT_BARRIER_REACHED.store(true, Ordering::Release);
        while HOLD_CANCEL_AFTER_PREFLIGHT.load(Ordering::Acquire) {
            thread::sleep(Duration::from_millis(1));
        }
        CANCEL_AFTER_PREFLIGHT_BARRIER_REACHED.store(false, Ordering::Release);
    }
}

#[cfg(feature = "test-support")]
fn wait_cancel_before_ack_for_test() {
    if HOLD_CANCEL_BEFORE_ACK.load(Ordering::Acquire) {
        CANCEL_BEFORE_ACK_BARRIER_REACHED.store(true, Ordering::Release);
        while HOLD_CANCEL_BEFORE_ACK.load(Ordering::Acquire) {
            thread::sleep(Duration::from_millis(1));
        }
        CANCEL_BEFORE_ACK_BARRIER_REACHED.store(false, Ordering::Release);
    }
}

impl ArbitrationLease {
    fn spawn(mut mutex: OwnedMutex) -> Result<Arc<Self>, NativeError> {
        let (command, receiver) = sync_channel(1);
        let (ready_sender, ready_receiver) = sync_channel(0);
        let thread = thread::Builder::new()
            .name("jarvis-arbitration-owner".to_owned())
            .spawn(move || {
                #[cfg(feature = "test-support")]
                ACTIVE_ARBITRATION_THREADS.fetch_add(1, Ordering::AcqRel);
                let _ = ready_sender.send(());
                while let Ok(command) = receiver.recv() {
                    match command {
                        ArbitrationCommand::Wait(timeout_ms, result_sender) => {
                            let _ = result_sender.send(mutex.wait(timeout_ms));
                        }
                        ArbitrationCommand::Release(result_sender) => {
                            let result = mutex.release();
                            let _ = result_sender.send(result);
                            // Release is terminal even when the native
                            // operation is uncertain. The caller joins this
                            // thread before returning uncertainty; it must
                            // never remain as an untracked authority.
                            break;
                        }
                    }
                }
                #[cfg(feature = "test-support")]
                ACTIVE_ARBITRATION_THREADS.fetch_sub(1, Ordering::AcqRel);
            })
            .map_err(|_| {
                record_test_failure!(
                    "windows.arbitration_thread_start",
                    "thread::Builder::spawn",
                    0,
                );
                native_failure(NativeErrorKind::ArbitrationUnavailable)
            })?;
        if ready_receiver
            .recv_timeout(Duration::from_millis(500))
            .is_err()
        {
            record_test_failure!(
                "windows.arbitration_thread_ready",
                "sync_channel.recv_timeout",
                0,
            );
            drop(command);
            let _ = thread.join();
            return Err(native_failure(NativeErrorKind::ArbitrationUnavailable));
        }
        Ok(Arc::new(Self {
            command: Mutex::new(Some(command)),
            join: Mutex::new(Some(thread)),
            terminal: AtomicU8::new(ARBITRATION_ACTIVE),
        }))
    }

    fn wait(&self, timeout_ms: u32) -> Result<MutexWaitResult, NativeError> {
        if self.terminal.load(Ordering::Acquire) != ARBITRATION_ACTIVE {
            return Err(native_failure(NativeErrorKind::ArbitrationUnavailable));
        }
        let (result_sender, result_receiver) = sync_channel(0);
        self.send_command(ArbitrationCommand::Wait(timeout_ms, result_sender))
            .inspect_err(|_error| {
                record_test_failure!("windows.arbitration_command_send", "sync_channel.send", 0,);
            })?;
        result_receiver
            .recv_timeout(Duration::from_millis(u64::from(timeout_ms) + 500))
            .map_err(|_| {
                record_test_failure!(
                    "windows.arbitration_wait_result",
                    "sync_channel.recv_timeout",
                    0,
                );
                native_failure(NativeErrorKind::ArbitrationUnavailable)
            })?
    }

    fn release(&self) -> Result<(), NativeError> {
        match self.terminal.load(Ordering::Acquire) {
            ARBITRATION_RELEASED => return Ok(()),
            ARBITRATION_UNCERTAIN => {
                return Err(native_failure(NativeErrorKind::ArbitrationReleaseUncertain));
            }
            _ => {}
        }
        let release_result = (|| {
            // A one-slot result channel prevents the arbitration thread from
            // remaining blocked while reporting a native release failure.
            let (result_sender, result_receiver) = sync_channel(1);
            self.send_command(ArbitrationCommand::Release(result_sender))
                .map_err(|_| native_failure(NativeErrorKind::ArbitrationReleaseUncertain))?;
            result_receiver
                .recv_timeout(Duration::from_millis(500))
                .map_err(|_| native_failure(NativeErrorKind::ArbitrationReleaseUncertain))?
        })();
        // The release command is terminal regardless of native success. Join
        // even on an uncertain native result so no JoinHandle is dropped while
        // the arbitration thread still owns the lifecycle object.
        let join_result = self.join_terminal_thread();
        let result = match (release_result, join_result) {
            (Ok(()), Ok(())) => Ok(()),
            (Err(error), Ok(())) => Err(error),
            (Ok(()), Err(error)) | (Err(_), Err(error)) => Err(error),
        };
        if result.is_ok() {
            self.terminal.store(ARBITRATION_RELEASED, Ordering::Release);
        } else {
            self.terminal
                .store(ARBITRATION_UNCERTAIN, Ordering::Release);
        }
        result
    }

    fn defer_release(&self) {
        let _ = self.terminal.compare_exchange(
            ARBITRATION_ACTIVE,
            ARBITRATION_DEFERRED,
            Ordering::AcqRel,
            Ordering::Acquire,
        );
    }

    fn send_command(&self, command: ArbitrationCommand) -> Result<(), NativeError> {
        let sender = self
            .command
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::ArbitrationUnavailable))?;
        sender
            .as_ref()
            .ok_or_else(|| native_failure(NativeErrorKind::ArbitrationUnavailable))?
            .send(command)
            .map_err(|_| native_failure(NativeErrorKind::ArbitrationUnavailable))
    }

    fn join_terminal_thread(&self) -> Result<(), NativeError> {
        // Closing the command sender is the fallback retirement signal if the
        // result channel timed out. The only native wait in this thread is
        // bounded, so joining here is a deterministic lifecycle operation,
        // not a detached reaper.
        let mut command = match self.command.lock() {
            Ok(command) => command,
            Err(poisoned) => poisoned.into_inner(),
        };
        command.take();
        drop(command);

        let mut join = match self.join.lock() {
            Ok(join) => join,
            Err(poisoned) => poisoned.into_inner(),
        };
        if let Some(thread) = join.take() {
            thread
                .join()
                .map_err(|_| native_failure(NativeErrorKind::ArbitrationReleaseUncertain))?;
        }
        Ok(())
    }
}

impl Drop for ArbitrationLease {
    fn drop(&mut self) {
        match self.terminal.load(Ordering::Acquire) {
            ARBITRATION_ACTIVE => {
                let _ = self.release();
            }
            ARBITRATION_RELEASED | ARBITRATION_UNCERTAIN | ARBITRATION_DEFERRED => {
                let _ = self.join_terminal_thread();
            }
            _ => {
                // Unknown lifecycle state is fail-closed: retire the command
                // thread without attempting an implicit mutex release.
                let _ = self.join_terminal_thread();
            }
        }
    }
}

#[derive(Debug)]
struct WorkerControl {
    generation: u64,
    thread: Mutex<Option<JoinHandle<()>>>,
    exited: AtomicBool,
}

struct WorkerExitGuard {
    inner: Arc<OwnerInner>,
    control: Arc<WorkerControl>,
    generation: u64,
    normal_exit: bool,
}

impl WorkerExitGuard {
    fn new(inner: Arc<OwnerInner>, control: Arc<WorkerControl>, generation: u64) -> Self {
        Self {
            inner,
            control,
            generation,
            normal_exit: false,
        }
    }

    fn finish(mut self) {
        self.normal_exit = true;
        self.retire();
    }

    fn retire(&self) {
        self.inner
            .worker_alive_generation
            .compare_exchange(self.generation, 0, Ordering::AcqRel, Ordering::Acquire)
            .ok();
        self.inner
            .worker_ready_generation
            .compare_exchange(self.generation, 0, Ordering::AcqRel, Ordering::Acquire)
            .ok();
        self.control.exited.store(true, Ordering::Release);
    }
}

impl Drop for WorkerExitGuard {
    fn drop(&mut self) {
        if !self.normal_exit {
            self.inner.worker_failed.store(true, Ordering::Release);
            let _ = mark_worker_failed(&self.inner);
        }
        self.retire();
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ProcessLiveness {
    Alive,
    Dead,
    Unknown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum BeginPresentationOutcome {
    Started,
    Cancelled { signal: bool },
    Stale,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CancelOutcome {
    Cancelled,
    AlreadyCancelled,
    InFlight,
    Stale,
    Uncertain,
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
    lifecycle_gate: Mutex<()>,
    lifecycle_state: AtomicU8,
    release_error: Mutex<Option<NativeErrorKind>>,
    pending: Mutex<Option<(u64, Instant, bool)>>,
    worker: Mutex<Option<Arc<WorkerControl>>>,
    quarantined_worker: Mutex<Option<Arc<WorkerControl>>>,
    presentation_gate: Mutex<()>,
    active_presentations: AtomicUsize,
    worker_generation: AtomicU64,
    worker_alive_generation: AtomicU64,
    worker_ready_generation: AtomicU64,
    stopping: AtomicBool,
    shutting_down: AtomicBool,
    authority_released: AtomicBool,
    worker_failed: AtomicBool,
    worker_cleanup_failed: AtomicBool,
    callback_active: AtomicBool,
    resources_closed: AtomicBool,
}

#[derive(Debug)]
pub struct OwnerLease {
    inner: Arc<OwnerInner>,
    arbitration: Arc<ArbitrationLease>,
}

#[derive(Clone, Debug)]
pub struct OwnerController {
    inner: Arc<OwnerInner>,
    arbitration: Arc<ArbitrationLease>,
}

#[derive(Debug)]
pub struct ActivationWorker {
    inner: Arc<OwnerInner>,
    control: Arc<WorkerControl>,
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
    active: bool,
}

#[derive(Debug)]
pub enum ActivationStart {
    Started(ActivationPresentation),
    Cancelled,
    Stale,
}

impl ActivationRequestContext {
    pub(crate) fn begin_presentation(&self) -> Result<ActivationStart, NativeError> {
        let _gate = self
            .inner
            .presentation_gate
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::ActivationUncertain))?;
        if self.inner.shutting_down.load(Ordering::Acquire)
            || self.inner.authority_released.load(Ordering::Acquire)
            || self.inner.worker_cleanup_failed.load(Ordering::Acquire)
            || self.inner.resources_closed.load(Ordering::Acquire)
        {
            return Err(native_failure(NativeErrorKind::ActivationUncertain));
        }
        let outcome = self.inner.state.transact(|record| {
            if record.request_generation != self.generation {
                return Ok(BeginPresentationOutcome::Stale);
            }
            if record.state == STATE_ACKNOWLEDGED && record.status == STATUS_CANCELLED {
                return Ok(BeginPresentationOutcome::Cancelled { signal: false });
            }
            if record.state != STATE_PENDING {
                return Err(native_failure(NativeErrorKind::ActivationUncertain));
            }
            match record.status {
                STATUS_NONE | STATUS_CALLBACK_QUEUED => {
                    record.status = STATUS_CALLBACK_RUNNING;
                    Ok(BeginPresentationOutcome::Started)
                }
                STATUS_CANCEL_REQUESTED => {
                    record.state = STATE_ACKNOWLEDGED;
                    record.status = STATUS_CANCELLED;
                    record.ack_generation = self.generation;
                    Ok(BeginPresentationOutcome::Cancelled { signal: true })
                }
                STATUS_CALLBACK_RUNNING | STATUS_UNCERTAIN => {
                    Err(native_failure(NativeErrorKind::ActivationUncertain))
                }
                _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
            }
        });
        let outcome = match outcome {
            Ok(outcome) => outcome,
            Err(error) => {
                self.inner.worker_failed.store(true, Ordering::Release);
                self.inner
                    .worker_cleanup_failed
                    .store(true, Ordering::Release);
                return Err(error);
            }
        };
        match outcome {
            BeginPresentationOutcome::Stale => Ok(ActivationStart::Stale),
            BeginPresentationOutcome::Cancelled { signal } => {
                if signal && let Err(error) = signal_ack(&self.inner) {
                    self.inner.worker_failed.store(true, Ordering::Release);
                    self.inner
                        .worker_cleanup_failed
                        .store(true, Ordering::Release);
                    return Err(error);
                }
                Ok(ActivationStart::Cancelled)
            }
            BeginPresentationOutcome::Started => {
                self.inner
                    .active_presentations
                    .fetch_add(1, Ordering::AcqRel);
                Ok(ActivationStart::Started(ActivationPresentation {
                    inner: Arc::clone(&self.inner),
                    generation: self.generation,
                    completed: false,
                    active: true,
                }))
            }
        }
    }

    pub(crate) fn cancel(&self) -> ActivationCancellation {
        // The presentation gate is the operation boundary shared with
        // shutdown. Cancellation acquires it before reading lifecycle flags
        // and retains it through state mutation and acknowledgement signal.
        // It intentionally does not acquire lifecycle_gate: callbacks may
        // retain a request, while release orders lifecycle_gate before this
        // presentation boundary.
        let _presentation_gate = match self.inner.presentation_gate.lock() {
            Ok(gate) => gate,
            Err(_) => return ActivationCancellation::Uncertain,
        };
        if self.inner.shutting_down.load(Ordering::Acquire)
            || self.inner.authority_released.load(Ordering::Acquire)
            || self.inner.resources_closed.load(Ordering::Acquire)
        {
            return ActivationCancellation::Uncertain;
        }
        #[cfg(feature = "test-support")]
        wait_cancel_after_preflight_for_test();
        let outcome = self.inner.state.transact(|record| {
            if record.request_generation != self.generation {
                return Ok(CancelOutcome::Stale);
            }
            if record.state != STATE_PENDING {
                return match record.status {
                    STATUS_CANCELLED if record.state == STATE_ACKNOWLEDGED => {
                        Ok(CancelOutcome::AlreadyCancelled)
                    }
                    _ => Ok(CancelOutcome::Uncertain),
                };
            }
            match record.status {
                STATUS_NONE | STATUS_CALLBACK_QUEUED => {
                    record.state = STATE_ACKNOWLEDGED;
                    record.status = STATUS_CANCELLED;
                    record.ack_generation = self.generation;
                    Ok(CancelOutcome::Cancelled)
                }
                STATUS_CALLBACK_RUNNING => {
                    record.status = STATUS_CANCEL_REQUESTED;
                    Ok(CancelOutcome::InFlight)
                }
                STATUS_CANCEL_REQUESTED | STATUS_UNCERTAIN => Ok(CancelOutcome::Uncertain),
                _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
            }
        });
        match outcome {
            Ok(CancelOutcome::Cancelled) => {
                #[cfg(feature = "test-support")]
                wait_cancel_before_ack_for_test();
                match signal_ack(&self.inner) {
                    Ok(()) => ActivationCancellation::Cancelled,
                    Err(_) => {
                        self.inner.worker_failed.store(true, Ordering::Release);
                        self.inner
                            .worker_cleanup_failed
                            .store(true, Ordering::Release);
                        ActivationCancellation::Uncertain
                    }
                }
            }
            Ok(CancelOutcome::AlreadyCancelled) => ActivationCancellation::Cancelled,
            Ok(CancelOutcome::InFlight) => ActivationCancellation::InFlight,
            Ok(CancelOutcome::Stale) => ActivationCancellation::Stale,
            Ok(CancelOutcome::Uncertain) => ActivationCancellation::Uncertain,
            Err(_) => {
                self.inner.worker_failed.store(true, Ordering::Release);
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
        self.completed = outcome.is_ok();
        self.finish_activity();
        outcome
    }

    fn complete_inner(&self, result: ActivationCallbackResult) -> Result<(), NativeError> {
        if self.inner.shutting_down.load(Ordering::Acquire)
            || self.inner.authority_released.load(Ordering::Acquire)
            || self.inner.resources_closed.load(Ordering::Acquire)
        {
            return Err(native_failure(NativeErrorKind::ActivationUncertain));
        }
        let should_signal = self.inner.state.transact(|record| {
            if record.request_generation != self.generation {
                return Ok(false);
            }
            if record.state != STATE_PENDING && record.state != STATE_ACKNOWLEDGED {
                return Err(native_failure(NativeErrorKind::ActivationUncertain));
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
        if should_signal && let Err(error) = signal_ack(&self.inner) {
            self.inner.worker_failed.store(true, Ordering::Release);
            self.inner
                .worker_cleanup_failed
                .store(true, Ordering::Release);
            return Err(error);
        }
        Ok(())
    }

    fn finish_activity(&mut self) {
        if self.active {
            self.active = false;
            self.inner
                .active_presentations
                .fetch_sub(1, Ordering::AcqRel);
        }
    }
}

impl Drop for ActivationPresentation {
    fn drop(&mut self) {
        if self.inner.shutting_down.load(Ordering::Acquire)
            || self.inner.authority_released.load(Ordering::Acquire)
        {
            self.finish_activity();
            return;
        }
        if !self.completed
            && self
                .complete_inner(ActivationCallbackResult::Uncertain)
                .is_err()
        {
            let _ = mark_worker_failed(&self.inner);
        }
        self.finish_activity();
    }
}

struct SecurityBundle {
    directory: ExplicitSecurity,
    state: ExplicitSecurity,
    event: ExplicitSecurity,
}

impl SecurityBundle {
    fn for_sid(sid: &str) -> Result<Self, NativeError> {
        let directory =
            ExplicitSecurity::for_sid(sid, DIRECTORY_ACCESS_MASK).inspect_err(|_error| {
                record_test_failure!("windows.security_directory", "ExplicitSecurity::for_sid", 0);
            })?;
        let state = ExplicitSecurity::for_sid(sid, STATE_ACCESS_MASK).inspect_err(|_error| {
            record_test_failure!("windows.security_state", "ExplicitSecurity::for_sid", 0);
        })?;
        let event = ExplicitSecurity::for_sid(sid, EVENT_ACCESS_MASK).inspect_err(|_error| {
            record_test_failure!("windows.security_event", "ExplicitSecurity::for_sid", 0);
        })?;
        Ok(Self {
            directory,
            state,
            event,
        })
    }
}

pub fn acquire(role: Role) -> Result<Acquisition, NativeError> {
    let prepared = layout::prepare().inspect_err(|_error| {
        record_test_failure!("windows.acquire_layout_prepare", "layout::prepare", 0);
    })?;
    let sid = current_sid().inspect_err(|_error| {
        record_test_failure!("windows.acquire_current_sid", "current_sid", 0);
    })?;
    let sid_hash = hash_sid(&sid);
    let parent_identity = prepared.parent_identity;
    let mutex_security =
        ExplicitSecurity::for_sid(&sid, MUTEX_ACCESS_MASK).inspect_err(|_error| {
            record_test_failure!("windows.security_mutex", "ExplicitSecurity::for_sid", 0,);
        })?;
    let security = SecurityBundle::for_sid(&sid)?;
    let mutex_name = stable_mutex_name(&sid, prepared.parent_identity);
    let (mutex, created) =
        create_mutex(&mutex_name, &mutex_security, &sid).inspect_err(|_error| {
            record_test_failure!("windows.acquire_mutex", "create_mutex", 0);
        })?;
    let arbitration = ArbitrationLease::spawn(mutex).inspect_err(|_error| {
        record_test_failure!("windows.acquire_arbitration", "ArbitrationLease::spawn", 0);
    })?;
    match arbitration.wait(0).inspect_err(|_error| {
        record_test_failure!("windows.acquire_mutex_wait", "ArbitrationLease::wait", 0);
    })? {
        MutexWaitResult::Acquired => {
            return acquire_owner(
                Arc::clone(&arbitration),
                prepared,
                sid,
                sid_hash,
                security,
                role,
            )
            .inspect_err(|_error| {
                record_test_failure!("windows.acquire_owner", "acquire_owner", 0);
            });
        }
        MutexWaitResult::Abandoned => {
            return acquire_recovered_owner(
                Arc::clone(&arbitration),
                prepared,
                sid,
                sid_hash,
                role,
                security,
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
        Err(original_error) if original_error.kind == NativeErrorKind::ActivationUncertain => {
            // An activation request may already have reached the owner when
            // its acknowledgement is uncertain. Never convert that
            // unresolved consequence into a new owner merely because the
            // arbitration mutex becomes available afterward.
            Err(original_error)
        }
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
        let layout = prepared
            .finish(&security.directory, &sid)
            .inspect_err(|_error| {
                record_test_failure!("windows.acquire_owner_layout", "PreparedLayout::finish", 0,);
            })?;
        let pid = current_pid();
        let session = current_session(pid).inspect_err(|_error| {
            record_test_failure!("windows.acquire_owner_session", "ProcessIdToSessionId", 0);
        })?;
        // SAFETY: GetCurrentProcess returns a valid pseudo-handle with no close
        // obligation.
        let start_filetime =
            process_start_filetime(unsafe { GetCurrentProcess() }).inspect_err(|_error| {
                record_test_failure!(
                    "windows.acquire_owner_process_identity",
                    "GetProcessTimes",
                    0,
                );
            })?;
        let role_value = role_value(role);
        let mut nonce = [0u8; 16];
        fill_random(&mut nonce).map_err(|_| {
            record_test_failure!("windows.acquire_owner_nonce", "getrandom::fill", 0);
            native_failure(NativeErrorKind::SecurityBoundaryUnavailable)
        })?;

        let activation_name = event_name(ACTIVATION_EVENT_PREFIX, nonce);
        let ack_name = event_name(ACK_EVENT_PREFIX, nonce);
        let activation_event =
            create_event(&activation_name, &security.event).inspect_err(|_error| {
                record_test_failure!("windows.acquire_owner_activation_event", "create_event", 0);
            })?;
        let ack_event = create_event(&ack_name, &security.event).inspect_err(|_error| {
            record_test_failure!("windows.acquire_owner_ack_event", "create_event", 0);
        })?;
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
        match StateFile::create_owner(
            &layout.state_path,
            &security.state,
            &sid,
            layout.parent_identity,
            layout.root_identity,
            initial,
        ) {
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
                        lifecycle_gate: Mutex::new(()),
                        lifecycle_state: AtomicU8::new(OWNER_LIFECYCLE_ACTIVE),
                        release_error: Mutex::new(None),
                        pending: Mutex::new(None),
                        worker: Mutex::new(None),
                        quarantined_worker: Mutex::new(None),
                        presentation_gate: Mutex::new(()),
                        active_presentations: AtomicUsize::new(0),
                        worker_generation: AtomicU64::new(0),
                        worker_alive_generation: AtomicU64::new(0),
                        worker_ready_generation: AtomicU64::new(0),
                        stopping: AtomicBool::new(false),
                        shutting_down: AtomicBool::new(false),
                        authority_released: AtomicBool::new(false),
                        worker_failed: AtomicBool::new(false),
                        worker_cleanup_failed: AtomicBool::new(false),
                        callback_active: AtomicBool::new(false),
                        resources_closed: AtomicBool::new(false),
                    }),
                    arbitration,
                }));
            }
            Err(error)
                if error.kind == NativeErrorKind::StateUnavailable && Instant::now() < deadline =>
            {
                record_test_failure!(
                    "windows.acquire_owner_state_create_retry",
                    "StateFile::create_owner",
                    0,
                );
                drop(ack_event);
                drop(activation_event);
                drop(layout);
                sleep_bounded_until(deadline);
                prepared = layout::prepare().inspect_err(|_error| {
                    record_test_failure!(
                        "windows.acquire_owner_layout_reprepare",
                        "layout::prepare",
                        0,
                    );
                })?;
                if prepared.parent_identity != parent_identity {
                    record_test_failure!(
                        "windows.acquire_owner_parent_identity",
                        "FileIdentity::compare",
                        0,
                    );
                    return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
                }
            }
            Err(error) => {
                record_test_failure!(
                    "windows.acquire_owner_state_create",
                    "StateFile::create_owner",
                    0,
                );
                return Err(error);
            }
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
        match StateFile::open_client(
            &state_path,
            state_security,
            sid,
            expected_parent,
            expected_root,
        ) {
            Ok(state) => {
                let snapshot = state.read_snapshot()?;
                if snapshot.parent != expected_parent
                    || snapshot.sid_hash != sid_hash
                    || snapshot.root != expected_root
                {
                    return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
                }
                match process_liveness(snapshot.pid, snapshot.start_filetime, snapshot.session) {
                    ProcessLiveness::Alive => {
                        return Err(native_failure(NativeErrorKind::ArbitrationUnavailable));
                    }
                    ProcessLiveness::Dead => return Ok(()),
                    ProcessLiveness::Unknown => {
                        return Err(native_failure(NativeErrorKind::StateUnavailable));
                    }
                }
            }
            Err(error)
                if error.kind == NativeErrorKind::StateUnavailable
                    && started.elapsed() < Duration::from_millis(500) =>
            {
                sleep_bounded(&mut delay_index, started);
            }
            Err(error) if error.kind == NativeErrorKind::StateUnavailable => {
                match std::fs::symlink_metadata(&state_path) {
                    Ok(_) => return Err(error),
                    Err(metadata_error)
                        if metadata_error.kind() == std::io::ErrorKind::NotFound =>
                    {
                        return Ok(());
                    }
                    Err(_) => return Err(native_failure(NativeErrorKind::StateUnavailable)),
                }
            }
            Err(error) => return Err(error),
        }
    }
}

impl OwnerLease {
    pub fn controller(&self) -> OwnerController {
        OwnerController {
            inner: Arc::clone(&self.inner),
            arbitration: Arc::clone(&self.arbitration),
        }
    }

    pub fn release(&mut self) -> Result<(), NativeError> {
        let _lifecycle = self
            .inner
            .lifecycle_gate
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?;
        match self.inner.lifecycle_state.load(Ordering::Acquire) {
            OWNER_LIFECYCLE_RELEASED => return Ok(()),
            OWNER_LIFECYCLE_DEFERRED | OWNER_LIFECYCLE_ARBITRATION_UNCERTAIN => {
                return Err(self.inner.release_error());
            }
            OWNER_LIFECYCLE_ACTIVE => {}
            _ => return Err(native_failure(NativeErrorKind::InvalidRuntimeState)),
        }
        let worker_result = stop_worker(&self.inner);
        let state_result = shutdown_state(&self.inner);
        if let Err(error) = worker_result {
            return self.defer_release_after_failure(error);
        }
        if let Err(error) = state_result {
            return self.defer_release_after_failure(error);
        }
        if let Err(error) = self.inner.close_resources() {
            return self.defer_release_after_failure(error);
        }
        #[cfg(feature = "test-support")]
        wait_before_arbitration_release_for_test();
        if let Err(error) = self.arbitration.release() {
            self.inner.authority_released.store(true, Ordering::Release);
            self.inner
                .record_release_error(OWNER_LIFECYCLE_ARBITRATION_UNCERTAIN, error);
            return Err(error);
        }
        self.inner.authority_released.store(true, Ordering::Release);
        self.inner
            .lifecycle_state
            .store(OWNER_LIFECYCLE_RELEASED, Ordering::Release);
        Ok(())
    }

    fn defer_release_after_failure(&self, error: NativeError) -> Result<(), NativeError> {
        self.arbitration.defer_release();
        self.inner.authority_released.store(true, Ordering::Release);
        self.inner
            .record_release_error(OWNER_LIFECYCLE_DEFERRED, error);
        Err(error)
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

impl OwnerInner {
    fn record_release_error(&self, lifecycle_state: u8, error: NativeError) {
        if let Ok(mut release_error) = self.release_error.lock()
            && release_error.is_none()
        {
            *release_error = Some(error.kind);
        }
        self.lifecycle_state
            .store(lifecycle_state, Ordering::Release);
    }

    fn release_error(&self) -> NativeError {
        self.release_error
            .lock()
            .ok()
            .and_then(|error| *error)
            .map(native_failure)
            .unwrap_or_else(|| native_failure(NativeErrorKind::ActivationUncertain))
    }

    fn close_resources(&self) -> Result<(), NativeError> {
        if self.resources_closed.load(Ordering::Acquire) {
            return Ok(());
        }
        let state_result = self.state.close();
        #[cfg(feature = "test-support")]
        let activation_close = self
            .activation_event
            .close_with_test_failure(&super::handles::FAIL_NEXT_ACTIVATION_CLOSE);
        #[cfg(not(feature = "test-support"))]
        let activation_close = self.activation_event.close();
        let activation_result =
            activation_close.map_err(|_| native_failure(NativeErrorKind::EventUnavailable));
        #[cfg(feature = "test-support")]
        let ack_close = self
            .ack_event
            .close_with_test_failure(&super::handles::FAIL_NEXT_ACK_CLOSE);
        #[cfg(not(feature = "test-support"))]
        let ack_close = self.ack_event.close();
        let ack_result = ack_close.map_err(|_| native_failure(NativeErrorKind::EventUnavailable));
        let first_error = state_result
            .err()
            .or_else(|| activation_result.err())
            .or_else(|| ack_result.err());
        if let Some(error) = first_error {
            return Err(error);
        }
        self.resources_closed.store(true, Ordering::Release);
        Ok(())
    }
}

impl Drop for OwnerInner {
    fn drop(&mut self) {
        if self.lifecycle_state.load(Ordering::Acquire) != OWNER_LIFECYCLE_RELEASED {
            // A deferred or uncertain owner must keep the delete-on-close
            // state record until this process terminates. Closing it here
            // would make an abandoned mutex look like a stale owner while
            // this process can still hold unresolved authority.
            self.state.retain_handle_on_drop();
        }
    }
}

impl Drop for OwnerLease {
    fn drop(&mut self) {
        let _ = self.release();
    }
}

impl OwnerController {
    /// Completes a shutdown whose bounded first attempt returned uncertainty.
    ///
    /// The controller is intentionally the only recovery capability retained
    /// after a failed owner release. It may join an exited quarantined worker,
    /// close owner resources, and release deferred arbitration; it never
    /// restores readiness or normal authority.
    pub fn recover_after_shutdown(&self) -> Result<(), NativeError> {
        let _lifecycle = self
            .inner
            .lifecycle_gate
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?;
        match self.inner.lifecycle_state.load(Ordering::Acquire) {
            OWNER_LIFECYCLE_RELEASED => return Ok(()),
            OWNER_LIFECYCLE_ARBITRATION_UNCERTAIN => {
                return Err(self.inner.release_error());
            }
            OWNER_LIFECYCLE_DEFERRED => {}
            OWNER_LIFECYCLE_ACTIVE => {
                return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
            }
            _ => return Err(native_failure(NativeErrorKind::InvalidRuntimeState)),
        }
        if !self.inner.shutting_down.load(Ordering::Acquire) {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        reap_worker_if_exited(&self.inner)?;
        if !self.inner.state.is_closed() {
            shutdown_state(&self.inner)?;
        }
        self.inner.close_resources()?;
        if let Err(error) = self.arbitration.release() {
            self.inner.authority_released.store(true, Ordering::Release);
            self.inner
                .record_release_error(OWNER_LIFECYCLE_ARBITRATION_UNCERTAIN, error);
            return Err(error);
        }
        self.inner.authority_released.store(true, Ordering::Release);
        self.inner
            .lifecycle_state
            .store(OWNER_LIFECYCLE_RELEASED, Ordering::Release);
        Ok(())
    }

    pub fn mark_ready(&self) -> Result<(), NativeError> {
        let _lifecycle = self
            .inner
            .lifecycle_gate
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?;
        if self.inner.shutting_down.load(Ordering::Acquire)
            || self.inner.authority_released.load(Ordering::Acquire)
            || self.inner.worker_cleanup_failed.load(Ordering::Acquire)
            || self.inner.resources_closed.load(Ordering::Acquire)
        {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        let generation = self.inner.worker_generation.load(Ordering::Acquire);
        if generation == 0
            || self.inner.worker_alive_generation.load(Ordering::Acquire) != generation
        {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        let result = self.inner.state.transact(|record| {
            validate_owner_record(&self.inner, record)?;
            if self.inner.shutting_down.load(Ordering::Acquire)
                || self.inner.worker_alive_generation.load(Ordering::Acquire) != generation
            {
                return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
            }
            if record.readiness != 0 {
                return Ok(());
            }
            record.readiness = 1;
            Ok(())
        });
        if result.is_ok() {
            self.inner
                .worker_ready_generation
                .store(generation, Ordering::Release);
        }
        result
    }

    /// Starts the single owned activation dispatcher.
    ///
    /// The callback is a bounded protocol participant: it must return within
    /// the native callback deadline after either completing or explicitly
    /// reporting `Uncertain`. Shutdown returns a typed uncertainty if the
    /// callback or receiver cannot be joined within the bounded lifecycle.
    pub fn start_activation_worker<F>(&self, callback: F) -> Result<ActivationWorker, NativeError>
    where
        F: Fn(ActivationRequest) -> ActivationCallbackResult + Send + 'static,
    {
        let _lifecycle = self
            .inner
            .lifecycle_gate
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?;
        if self.inner.role != Role::Normal {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        if self.inner.shutting_down.load(Ordering::Acquire)
            || self.inner.resources_closed.load(Ordering::Acquire)
        {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        if self.inner.worker_cleanup_failed.load(Ordering::Acquire)
            || self.inner.worker_failed.load(Ordering::Acquire)
        {
            reap_worker_if_exited(&self.inner)?;
            reconcile_inflight(&self.inner)?;
            self.inner
                .worker_cleanup_failed
                .store(false, Ordering::Release);
        }
        if self
            .inner
            .worker
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?
            .is_some()
        {
            return Err(native_failure(NativeErrorKind::InvalidRuntimeState));
        }
        self.inner.stopping.store(false, Ordering::Release);
        self.inner.worker_failed.store(false, Ordering::Release);
        self.inner
            .worker_ready_generation
            .store(0, Ordering::Release);
        let generation = self
            .inner
            .worker_generation
            .fetch_add(1, Ordering::AcqRel)
            .checked_add(1)
            .ok_or_else(|| native_failure(NativeErrorKind::InvalidRuntimeState))?;
        let control = Arc::new(WorkerControl {
            generation,
            thread: Mutex::new(None),
            exited: AtomicBool::new(false),
        });
        *self
            .inner
            .worker
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::EventUnavailable))? =
            Some(Arc::clone(&control));
        let inner = Arc::clone(&self.inner);
        let thread_inner = Arc::clone(&inner);
        let thread_control = Arc::clone(&control);
        let (ready_sender, ready_receiver) = sync_channel(0);
        let thread = match thread::Builder::new()
            .name("jarvis-activation-receiver".to_owned())
            .spawn(move || {
                let exit_guard = WorkerExitGuard::new(
                    Arc::clone(&thread_inner),
                    Arc::clone(&thread_control),
                    generation,
                );
                thread_inner
                    .worker_alive_generation
                    .store(generation, Ordering::Release);
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
                        #[cfg(feature = "test-support")]
                        if PANIC_AFTER_CALLBACK.swap(false, Ordering::AcqRel) {
                            panic!("qualification worker panic outside callback boundary");
                        }
                        if thread_inner.worker_failed.load(Ordering::Acquire) {
                            let _ = mark_worker_failed(&thread_inner);
                            break;
                        }
                    } else {
                        let _ = mark_worker_failed(&thread_inner);
                        break;
                    }
                }
                exit_guard.finish();
            }) {
            Ok(thread) => thread,
            Err(_) => {
                clear_worker_if_current(&self.inner, &control);
                return Err(native_failure(NativeErrorKind::EventUnavailable));
            }
        };
        if let Ok(mut slot) = control.thread.lock() {
            *slot = Some(thread);
        } else {
            self.inner.stopping.store(true, Ordering::Release);
            // SAFETY: SetEvent only wakes the receiver being joined below.
            let wake_result = signal_activation(&self.inner);
            let _ = thread.join();
            clear_worker_if_current(&self.inner, &control);
            return Err(wake_result
                .err()
                .unwrap_or_else(|| native_failure(NativeErrorKind::EventUnavailable)));
        }
        match ready_receiver.recv_timeout(Duration::from_millis(500)) {
            Ok(true) => {}
            _ => {
                self.inner.stopping.store(true, Ordering::Release);
                // SAFETY: SetEvent only wakes the receiver being joined below.
                let wake_result = signal_activation(&self.inner);
                let stop_result = stop_worker_control(&self.inner, &control);
                if wake_result.is_err() || stop_result.is_err() {
                    self.inner
                        .worker_cleanup_failed
                        .store(true, Ordering::Release);
                }
                return Err(wake_result
                    .err()
                    .or_else(|| stop_result.err())
                    .unwrap_or_else(|| native_failure(NativeErrorKind::EventUnavailable)));
            }
        }
        Ok(ActivationWorker { inner, control })
    }
}

impl Drop for ActivationWorker {
    fn drop(&mut self) {
        let stop_result = self
            .inner
            .lifecycle_gate
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))
            .and_then(|_lifecycle| stop_worker_control(&self.inner, &self.control));
        if stop_result.is_err() {
            self.inner
                .worker_cleanup_failed
                .store(true, Ordering::Release);
            let _ = quarantine_worker(&self.inner, Arc::clone(&self.control));
        }
    }
}

fn stop_worker(inner: &Arc<OwnerInner>) -> Result<(), NativeError> {
    // Lock order is lifecycle_gate -> presentation_gate for owner shutdown.
    // Cancellation acquires presentation_gate only, so it cannot deadlock a
    // callback-capable path with the owner lifecycle gate. Setting
    // shutting_down while holding presentation_gate prevents a queued
    // cancellation from reaching state/event handles after shutdown starts.
    let signal_result = {
        let _gate = inner
            .presentation_gate
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?;
        inner.shutting_down.store(true, Ordering::Release);
        inner.stopping.store(true, Ordering::Release);
        // SAFETY: SetEvent only wakes the bounded activation receiver owned by
        // this process.
        signal_activation(inner)
    };
    let control = inner
        .worker
        .lock()
        .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?
        .clone();
    let worker_result = control
        .as_ref()
        .map(|control| stop_worker_control(inner, control))
        .unwrap_or(Ok(()));
    worker_result?;
    signal_result
}

fn signal_activation(inner: &Arc<OwnerInner>) -> Result<(), NativeError> {
    if inner.resources_closed.load(Ordering::Acquire) || inner.activation_event.is_closed() {
        return Err(native_failure(NativeErrorKind::EventUnavailable));
    }
    // SAFETY: the activation handle is owned by the current authority and is
    // valid until the worker has been joined.
    if unsafe { SetEvent(inner.activation_event.raw()) } == 0 {
        Err(native_failure(NativeErrorKind::EventUnavailable))
    } else {
        Ok(())
    }
}

fn clear_worker_if_current(inner: &Arc<OwnerInner>, control: &Arc<WorkerControl>) {
    if let Ok(mut worker) = inner.worker.lock()
        && worker
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, control))
    {
        *worker = None;
    }
}

fn quarantine_worker(
    inner: &Arc<OwnerInner>,
    control: Arc<WorkerControl>,
) -> Result<(), NativeError> {
    let mut quarantined = inner
        .quarantined_worker
        .lock()
        .map_err(|_| native_failure(NativeErrorKind::ActivationUncertain))?;
    match quarantined.as_ref() {
        None => {
            *quarantined = Some(control);
            Ok(())
        }
        Some(existing) if Arc::ptr_eq(existing, &control) => Ok(()),
        Some(_) => Err(native_failure(NativeErrorKind::ActivationUncertain)),
    }
}

fn reap_worker_if_exited(inner: &Arc<OwnerInner>) -> Result<(), NativeError> {
    let control = {
        let worker = inner
            .worker
            .lock()
            .map_err(|_| native_failure(NativeErrorKind::ActivationUncertain))?;
        if let Some(control) = worker.as_ref() {
            Some(Arc::clone(control))
        } else {
            drop(worker);
            inner
                .quarantined_worker
                .lock()
                .map_err(|_| native_failure(NativeErrorKind::ActivationUncertain))?
                .as_ref()
                .map(Arc::clone)
        }
    };
    let Some(control) = control else {
        return Ok(());
    };
    let mut thread_slot = control
        .thread
        .lock()
        .map_err(|_| native_failure(NativeErrorKind::ActivationUncertain))?;
    let can_reap = control.exited.load(Ordering::Acquire)
        || thread_slot
            .as_ref()
            .is_some_and(std::thread::JoinHandle::is_finished);
    if !can_reap {
        return Err(native_failure(NativeErrorKind::ActivationUncertain));
    }
    let joined_panic = thread_slot
        .take()
        .map(|thread| thread.join().is_err())
        .unwrap_or(false);
    drop(thread_slot);
    if joined_panic {
        inner.worker_failed.store(true, Ordering::Release);
    }
    clear_worker_if_current(inner, &control);
    let mut quarantined = inner
        .quarantined_worker
        .lock()
        .map_err(|_| native_failure(NativeErrorKind::ActivationUncertain))?;
    if quarantined
        .as_ref()
        .is_some_and(|current| Arc::ptr_eq(current, &control))
    {
        *quarantined = None;
    }
    Ok(())
}

fn stop_worker_control(
    inner: &Arc<OwnerInner>,
    control: &Arc<WorkerControl>,
) -> Result<(), NativeError> {
    let is_current = inner
        .worker
        .lock()
        .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?
        .as_ref()
        .is_some_and(|current| Arc::ptr_eq(current, control));
    if !is_current || inner.worker_generation.load(Ordering::Acquire) != control.generation {
        return Ok(());
    }
    inner.stopping.store(true, Ordering::Release);
    let wake_result = signal_activation(inner);
    let deadline = Instant::now() + SHUTDOWN_DEADLINE;
    while (inner.callback_active.load(Ordering::Acquire)
        || inner.active_presentations.load(Ordering::Acquire) != 0)
        && Instant::now() < deadline
    {
        thread::sleep(Duration::from_millis(5));
    }
    if inner.callback_active.load(Ordering::Acquire)
        || inner.active_presentations.load(Ordering::Acquire) != 0
    {
        inner.worker_failed.store(true, Ordering::Release);
        let quarantine_result = quarantine_worker(inner, Arc::clone(control));
        return Err(quarantine_result
            .err()
            .unwrap_or_else(|| native_failure(NativeErrorKind::ActivationUncertain)));
    }
    while !control.exited.load(Ordering::Acquire) && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(5));
    }
    if !control.exited.load(Ordering::Acquire) {
        inner.worker_failed.store(true, Ordering::Release);
        let quarantine_result = quarantine_worker(inner, Arc::clone(control));
        return Err(quarantine_result
            .err()
            .unwrap_or_else(|| native_failure(NativeErrorKind::ActivationUncertain)));
    }
    let mut thread = control
        .thread
        .lock()
        .map_err(|_| native_failure(NativeErrorKind::InvalidRuntimeState))?;
    if let Some(thread_handle) = thread.take() {
        thread_handle
            .join()
            .map_err(|_| native_failure(NativeErrorKind::ActivationUncertain))?;
    }
    drop(thread);
    if !inner.authority_released.load(Ordering::Acquire) {
        mark_worker_failed(inner)?;
    }
    if let Ok(mut worker) = inner.worker.lock()
        && worker
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, control))
    {
        *worker = None;
    }
    wake_result
}

fn shutdown_state(inner: &Arc<OwnerInner>) -> Result<(), NativeError> {
    let should_signal = inner.state.transact(|record| {
        validate_owner_record(inner, record)?;
        record.readiness = 0;
        if record.state != STATE_PENDING {
            return Ok(false);
        }
        match record.status {
            STATUS_NONE | STATUS_CALLBACK_QUEUED => {
                record.state = STATE_ACKNOWLEDGED;
                record.status = STATUS_CANCELLED;
                record.ack_generation = record.request_generation;
                Ok(true)
            }
            STATUS_CALLBACK_RUNNING | STATUS_CANCEL_REQUESTED | STATUS_UNCERTAIN => {
                record.status = STATUS_UNCERTAIN;
                Ok(false)
            }
            _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
        }
    })?;
    if should_signal {
        signal_ack(inner)?;
    }
    Ok(())
}

fn acquire_second_launch(
    prepared: PreparedLayout,
    sid: &str,
    security: &SecurityBundle,
    sid_hash: [u8; 32],
    role: Role,
) -> Result<Acquisition, NativeError> {
    let layout = prepared.validate_existing(sid, &security.directory)?;
    let state = settle_client_state(
        &layout.state_path,
        &security.state,
        sid,
        layout.parent_identity,
        layout.root_identity,
    )?;
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
    let same_owner = snapshot.pid == current_pid
        && snapshot.start_filetime == current_start
        && snapshot.session == current_session;
    if role == Role::Maintenance {
        return Err(native_failure(match snapshot.role {
            ROLE_MAINTENANCE if same_owner => NativeErrorKind::MaintenanceAlreadyHeld,
            ROLE_MAINTENANCE => NativeErrorKind::MaintenanceLockBusy,
            ROLE_NORMAL => NativeErrorKind::NormalHeld,
            _ => NativeErrorKind::ObjectCollision,
        }));
    }
    if snapshot.role != role_value(role) {
        return Err(native_failure(match snapshot.role {
            ROLE_MAINTENANCE => NativeErrorKind::MaintenanceHeld,
            ROLE_NORMAL => NativeErrorKind::NormalHeld,
            _ => NativeErrorKind::ObjectCollision,
        }));
    }
    if snapshot.session != current_session {
        return Err(native_failure(NativeErrorKind::OwnerOtherSession));
    }
    if snapshot.readiness == 0 {
        return Err(native_failure(NativeErrorKind::NotReady));
    }

    if let Some(true) = settle_prior_request(&state, current_pid, current_start, current_session)? {
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
    if matches!(
        std::env::var("JARVIS_NATIVE_QUALIFICATION_CHILD").as_deref(),
        Ok("recovery-waiter") | Ok("recovery-waiter-retry")
    ) && let Ok(path) = std::env::var("JARVIS_NATIVE_QUALIFICATION_READY_FILE")
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
    current_session: u32,
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
        STATE_PENDING if matches!(snapshot.status, STATUS_NONE | STATUS_CALLBACK_QUEUED) => {
            match request_liveness(&snapshot, current_pid, current_start, current_session) {
                ProcessLiveness::Alive | ProcessLiveness::Unknown => {
                    return Err(native_failure(NativeErrorKind::ActivationUncertain));
                }
                ProcessLiveness::Dead => {}
            }
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
        STATE_PENDING
            if matches!(
                snapshot.status,
                STATUS_CALLBACK_RUNNING | STATUS_CANCEL_REQUESTED | STATUS_UNCERTAIN
            ) =>
        {
            settle_prior_inflight(state, snapshot.request_generation)
        }
        STATE_IDLE => Ok(None),
        _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
    }
}

fn settle_prior_inflight(
    state: &StateFile,
    request_generation: u64,
) -> Result<Option<bool>, NativeError> {
    let deadline = Instant::now() + ACTIVATION_RECONCILIATION;
    loop {
        let snapshot = state.read_snapshot()?;
        if snapshot.request_generation != request_generation {
            return Err(native_failure(NativeErrorKind::ActivationUncertain));
        }
        match (snapshot.state, snapshot.status) {
            (STATE_ACKNOWLEDGED, STATUS_HANDLED) => {
                return match settle_request(state, request_generation)? {
                    ActivationSettlement::Handled => Ok(Some(true)),
                    _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
                };
            }
            (STATE_ACKNOWLEDGED, STATUS_CANCELLED) => {
                return match settle_request(state, request_generation)? {
                    ActivationSettlement::Cancelled => Ok(Some(false)),
                    _ => Err(native_failure(NativeErrorKind::ActivationUncertain)),
                };
            }
            (STATE_PENDING, _) if Instant::now() < deadline => {
                thread::sleep(Duration::from_millis(25));
            }
            (STATE_PENDING, _) => {
                return Err(native_failure(NativeErrorKind::ActivationUncertain));
            }
            _ => return Err(native_failure(NativeErrorKind::ActivationUncertain)),
        }
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
                    signal_external_ack(ack)?;
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

fn request_liveness(
    snapshot: &StateRecord,
    current_pid: u32,
    current_start: u64,
    current_session: u32,
) -> ProcessLiveness {
    if snapshot.request_pid == current_pid && snapshot.request_start_filetime == current_start {
        return if snapshot.request_session == current_session {
            ProcessLiveness::Alive
        } else {
            ProcessLiveness::Dead
        };
    }
    process_liveness(
        snapshot.request_pid,
        snapshot.request_start_filetime,
        snapshot.request_session,
    )
}

fn process_pending<F>(inner: &Arc<OwnerInner>, callback: &F)
where
    F: Fn(ActivationRequest) -> ActivationCallbackResult,
{
    let generation = inner.worker_generation.load(Ordering::Acquire);
    if generation == 0
        || inner.worker_alive_generation.load(Ordering::Acquire) != generation
        || inner.worker_ready_generation.load(Ordering::Acquire) != generation
        || inner.worker_cleanup_failed.load(Ordering::Acquire)
        || inner.resources_closed.load(Ordering::Acquire)
    {
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
            let _ = mark_worker_failed(inner);
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

    match request_liveness(&snapshot, inner.pid, inner.start_filetime, inner.session) {
        ProcessLiveness::Alive => {}
        ProcessLiveness::Dead | ProcessLiveness::Unknown => return,
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
            let _ = mark_worker_failed(inner);
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
        let _ = mark_worker_failed(inner);
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
    let (should_signal, should_clear_pending) = inner.state.transact(|record| {
        if record.request_generation != request_generation {
            return Ok((false, false));
        }
        match result {
            ActivationCallbackResult::Handled => {
                if record.state == STATE_ACKNOWLEDGED
                    && matches!(record.status, STATUS_HANDLED | STATUS_CANCELLED)
                {
                    Ok((false, true))
                } else {
                    if record.state == STATE_PENDING {
                        record.status = STATUS_UNCERTAIN;
                    }
                    Ok((false, false))
                }
            }
            ActivationCallbackResult::NotStarted => {
                if record.state == STATE_ACKNOWLEDGED
                    && matches!(record.status, STATUS_HANDLED | STATUS_CANCELLED)
                {
                    Ok((false, true))
                } else if record.state == STATE_PENDING
                    && matches!(record.status, STATUS_NONE | STATUS_CALLBACK_QUEUED)
                {
                    record.state = STATE_ACKNOWLEDGED;
                    record.status = STATUS_CANCELLED;
                    record.ack_generation = request_generation;
                    Ok((true, true))
                } else {
                    if record.state == STATE_PENDING {
                        record.status = STATUS_UNCERTAIN;
                    }
                    Ok((false, false))
                }
            }
            ActivationCallbackResult::Uncertain => {
                if record.state == STATE_PENDING {
                    if matches!(record.status, STATUS_NONE | STATUS_CALLBACK_QUEUED) {
                        record.state = STATE_ACKNOWLEDGED;
                        record.status = STATUS_CANCELLED;
                        record.ack_generation = request_generation;
                        Ok((true, true))
                    } else {
                        record.status = STATUS_UNCERTAIN;
                        Ok((false, false))
                    }
                } else if record.state == STATE_ACKNOWLEDGED
                    && matches!(record.status, STATUS_HANDLED | STATUS_CANCELLED)
                {
                    Ok((false, true))
                } else {
                    Ok((false, false))
                }
            }
        }
    })?;
    if should_signal {
        signal_ack(inner)?;
    }
    if should_clear_pending && let Ok(mut pending) = inner.pending.lock() {
        *pending = None;
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
        match record.state {
            STATE_ACKNOWLEDGED => clear_request(record),
            STATE_PENDING => {
                // The worker has failed, but its thread may not have been
                // joined yet. Preserve the exact request as an explicit
                // recoverable uncertainty; reconciliation clears it only
                // after the failed worker is reaped.
                record.status = STATUS_UNCERTAIN;
            }
            STATE_IDLE => {}
            _ => return Err(native_failure(NativeErrorKind::StateCorrupt)),
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
        STATE_PENDING if snapshot.status == STATUS_UNCERTAIN => {
            reset_pending_if_current(inner, snapshot.request_generation)?
        }
        STATE_PENDING => return Err(native_failure(NativeErrorKind::ActivationUncertain)),
        STATE_IDLE => {}
        _ => return Err(native_failure(NativeErrorKind::StateCorrupt)),
    }
    Ok(())
}

fn signal_ack(inner: &Arc<OwnerInner>) -> Result<(), NativeError> {
    if inner.resources_closed.load(Ordering::Acquire) || inner.ack_event.is_closed() {
        return Err(native_failure(NativeErrorKind::EventUnavailable));
    }
    signal_external_ack(&inner.ack_event)
}

fn signal_external_ack(ack_event: &OwnedHandle) -> Result<(), NativeError> {
    if ack_event.is_closed() {
        return Err(native_failure(NativeErrorKind::EventUnavailable));
    }
    #[cfg(feature = "test-support")]
    if crate::handles::FAIL_NEXT_EVENT_SIGNAL.swap(false, Ordering::AcqRel) {
        return Err(native_failure(NativeErrorKind::EventUnavailable));
    }
    // SAFETY: the owner event handle remains valid while the state transition
    // that produced the terminal result is observed by the client.
    unsafe {
        if SetEvent(ack_event.raw()) == 0 {
            return Err(native_failure(NativeErrorKind::EventUnavailable));
        }
    }
    Ok(())
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
    // The desktop authority is scoped to the interactive Windows session.
    // The SID and verified LocalAppData identity still bind the name to the
    // enrolled user and installation boundary; no cross-session Global
    // namespace is required by the active contract.
    format!("Local\\JARVIS-DESKTOP-{:x}", digest)
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
    let create_error = last_error();
    if raw.is_null() && create_error == windows_sys::Win32::Foundation::ERROR_ACCESS_DENIED {
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
        let _reopen_error = last_error();
        if reopened.is_null() {
            record_test_failure!("windows.open_mutex", "OpenMutexW", _reopen_error);
        }
        let handle = OwnedHandle::from_raw(reopened, NativeErrorKind::ArbitrationUnavailable)?;
        security.validate_handle(
            &handle,
            sid,
            windows_sys::Win32::Security::Authorization::SE_KERNEL_OBJECT,
        )?;
        return Ok((OwnedMutex::new(handle), false));
    }
    if raw.is_null() {
        record_test_failure!("windows.create_mutex", "CreateMutexW", create_error);
    }
    let handle = OwnedHandle::from_raw(raw, NativeErrorKind::ArbitrationUnavailable)?;
    let created = create_error != ERROR_ALREADY_EXISTS;
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
    Ok((OwnedMutex::new(handle), created))
}

fn create_event(name: &str, security: &ExplicitSecurity) -> Result<OwnedHandle, NativeError> {
    let name = wide(name);
    // SAFETY: the event name/security remain valid for the synchronous call.
    let raw = unsafe { CreateEventW(security.as_ptr(), 0, 0, name.as_ptr()) };
    let create_error = last_error();
    let existing = create_error == ERROR_ALREADY_EXISTS;
    if raw.is_null() {
        record_test_failure!("windows.create_event", "CreateEventW", create_error);
    }
    let handle = OwnedHandle::from_raw(raw, NativeErrorKind::EventUnavailable)?;
    if existing {
        record_test_failure!(
            "windows.create_event_collision",
            "CreateEventW",
            create_error
        );
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
    let _native_error = last_error();
    if raw.is_null() {
        record_test_failure!("windows.open_event", "OpenEventW", _native_error);
    }
    OwnedHandle::from_raw(raw, NativeErrorKind::EventUnavailable)
}

fn settle_client_state(
    path: &std::path::Path,
    security: &ExplicitSecurity,
    sid: &str,
    expected_parent: FileIdentity,
    expected_root: FileIdentity,
) -> Result<StateFile, NativeError> {
    let started = Instant::now();
    let mut delay_index = 0usize;
    loop {
        match StateFile::open_client(path, security, sid, expected_parent, expected_root) {
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
    let result = unsafe { ProcessIdToSessionId(pid, &mut session) };
    let _native_error = last_error();
    if result == 0 {
        record_test_failure!(
            "windows.process_session",
            "ProcessIdToSessionId",
            _native_error,
        );
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
    let result =
        unsafe { GetProcessTimes(process, &mut creation, &mut exit, &mut kernel, &mut user) };
    let _native_error = last_error();
    if result == 0 {
        record_test_failure!(
            "windows.process_start_time",
            "GetProcessTimes",
            _native_error
        );
        return Err(native_failure(NativeErrorKind::StateUnavailable));
    }
    Ok((u64::from(creation.dwHighDateTime) << 32) | u64::from(creation.dwLowDateTime))
}

fn process_liveness(pid: u32, expected_start: u64, expected_session: u32) -> ProcessLiveness {
    if pid == 0 || expected_start == 0 || expected_session == 0 {
        return ProcessLiveness::Dead;
    }
    // SAFETY: OpenProcess is called with the minimum query right needed for
    // identity validation and a non-inheritable handle.
    let raw = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    let _native_error = last_error();
    if raw.is_null() {
        if _native_error != ERROR_INVALID_PARAMETER {
            record_test_failure!("windows.open_process", "OpenProcess", _native_error);
        }
        return if _native_error == ERROR_INVALID_PARAMETER {
            ProcessLiveness::Dead
        } else {
            ProcessLiveness::Unknown
        };
    }
    let handle = match OwnedHandle::from_raw(raw, NativeErrorKind::StateUnavailable) {
        Ok(handle) => handle,
        Err(_) => return ProcessLiveness::Unknown,
    };
    let start = match process_start_filetime(handle.raw()) {
        Ok(start) => start,
        Err(_) => return ProcessLiveness::Unknown,
    };
    let session = match current_session(pid) {
        Ok(session) => session,
        Err(_) => return ProcessLiveness::Unknown,
    };
    classify_process_liveness(Ok((start, session)), expected_start, expected_session)
}

fn classify_process_liveness(
    query: Result<(u64, u32), ()>,
    expected_start: u64,
    expected_session: u32,
) -> ProcessLiveness {
    if expected_start == 0 || expected_session == 0 {
        return ProcessLiveness::Dead;
    }
    match query {
        Ok((start, session)) if start == expected_start && session == expected_session => {
            ProcessLiveness::Alive
        }
        Ok(_) => ProcessLiveness::Dead,
        Err(()) => ProcessLiveness::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::{FileIdentity, ProcessLiveness, classify_process_liveness, stable_mutex_name};

    #[test]
    fn liveness_query_failures_remain_unknown() {
        assert_eq!(
            classify_process_liveness(Err(()), 10, 2),
            ProcessLiveness::Unknown
        );
    }

    #[test]
    fn liveness_requires_exact_start_time_and_session() {
        assert_eq!(
            classify_process_liveness(Ok((10, 2)), 10, 2),
            ProcessLiveness::Alive
        );
        assert_eq!(
            classify_process_liveness(Ok((11, 2)), 10, 2),
            ProcessLiveness::Dead
        );
        assert_eq!(
            classify_process_liveness(Ok((10, 3)), 10, 2),
            ProcessLiveness::Dead
        );
    }

    #[test]
    fn invalid_persistent_identity_is_dead_before_query() {
        assert_eq!(
            classify_process_liveness(Err(()), 0, 2),
            ProcessLiveness::Dead
        );
        assert_eq!(
            classify_process_liveness(Err(()), 10, 0),
            ProcessLiveness::Dead
        );
    }

    #[test]
    fn stable_mutex_is_session_scoped_without_global_namespace_claim() {
        let name = stable_mutex_name(
            "S-1-5-21-test",
            FileIdentity {
                volume_serial: 1,
                file_index: 2,
            },
        );
        assert!(name.starts_with("Local\\JARVIS-DESKTOP-"));
        assert!(!name.starts_with("Global\\"));
    }
}
