//! Governed Windows-native foundation for the JARVIS single-instance and
//! fixed application-data ownership boundary.
//!
//! The public surface is deliberately semantic and safe. Windows handles,
//! paths, security descriptors, file locks, and native result codes remain
//! private to the platform implementation. This crate is the only Rust crate
//! permitted to contain the narrow Windows FFI required by Section 1.4.

#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(windows)]
mod handles;

#[cfg(windows)]
mod identity;

#[cfg(windows)]
mod layout;

#[cfg(windows)]
mod security;

#[cfg(windows)]
mod state;

#[cfg(windows)]
mod windows;

#[cfg(not(windows))]
mod unsupported;

/// Stable identity for the one desktop authority. This is runtime identity,
/// not an implementation-matrix or subsection version.
pub const STABLE_OWNER_NAMESPACE: &str = "JARVIS-DESKTOP-AUTHORITY";

/// Version of the fixed owner-state record. It is independent of the stable
/// mutex namespace and must fail closed when incompatible.
pub const OWNER_STATE_SCHEMA_VERSION: u32 = 1;

/// Fixed application-owned data directory names required by Runtime §4.
pub const REQUIRED_DATA_DIRECTORIES: [&str; 8] = [
    "data",
    "backups",
    "logs",
    "cache",
    "artifacts",
    "modules",
    "updates",
    "recovery",
];

#[cfg(all(windows, feature = "test-support"))]
/// Test-only fault injection for the state-lock cleanup qualification.
pub fn test_fail_next_state_unlock() {
    handles::fail_next_state_unlock_for_test();
}

#[cfg(all(windows, feature = "test-support"))]
/// Test-only fault injection before the native state-lock unlock call.
pub fn test_fail_next_state_unlock_before_call() {
    handles::fail_next_state_unlock_before_call_for_test();
}

#[cfg(all(windows, feature = "test-support"))]
/// Test-only fault injection for activation event signalling.
pub fn test_fail_next_event_signal() {
    handles::fail_next_event_signal_for_test();
}

#[cfg(all(windows, feature = "test-support"))]
/// Test-only fault injection for the bounded mutex wait.
pub fn test_fail_next_mutex_wait() {
    handles::fail_next_mutex_wait_for_test();
}

#[cfg(all(windows, feature = "test-support"))]
/// Test-only fault injection for the explicit mutex release.
pub fn test_fail_next_mutex_release() {
    handles::fail_next_mutex_release_for_test();
}

#[cfg(all(windows, feature = "test-support"))]
/// Test-only lifecycle observation for arbitration-thread qualification.
pub fn test_active_arbitration_threads() -> usize {
    windows::active_arbitration_threads_for_test()
}

#[cfg(all(windows, feature = "test-support"))]
/// Test-only barrier placed after owner persistence/IPC closure and before
/// instance-mutex release.
pub fn test_hold_before_arbitration_release() {
    windows::hold_before_arbitration_release_for_test();
}

#[cfg(all(windows, feature = "test-support"))]
/// Test-only observation of the close-before-release barrier.
pub fn test_arbitration_release_barrier_reached() -> bool {
    windows::arbitration_release_barrier_reached_for_test()
}

#[cfg(all(windows, feature = "test-support"))]
/// Test-only continuation of the close-before-release barrier.
pub fn test_continue_arbitration_release() {
    windows::continue_arbitration_release_for_test();
}

/// The startup operation competing for the one stable authority.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Role {
    Normal,
    Maintenance,
}

/// Semantic native failure. Raw handles, paths, and Win32 error values never
/// cross this boundary.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeErrorKind {
    UnsupportedPlatform,
    InvalidPath,
    LocalAppDataUnavailable,
    SecurityBoundaryUnavailable,
    ArbitrationUnavailable,
    ArbitrationReleaseUncertain,
    ObjectCollision,
    AlreadyOwned,
    MaintenanceHeld,
    NormalHeld,
    ActivationUnavailable,
    ActivationUncertain,
    ActivationUnacknowledged,
    OwnerOtherSession,
    StateCorrupt,
    StateUnavailable,
    StateWriteFailed,
    LockTimeout,
    LockUnavailable,
    LockUncertain,
    EventUnavailable,
    InvalidRuntimeState,
    NotReady,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct NativeError {
    pub kind: NativeErrorKind,
}

impl std::fmt::Display for NativeError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self.kind {
            NativeErrorKind::UnsupportedPlatform => {
                "native foundation is unavailable on this target"
            }
            NativeErrorKind::InvalidPath => "native foundation rejected the fixed data path",
            NativeErrorKind::LocalAppDataUnavailable => {
                "native foundation could not resolve LocalAppData"
            }
            NativeErrorKind::SecurityBoundaryUnavailable => {
                "native foundation could not establish the SID security boundary"
            }
            NativeErrorKind::ArbitrationUnavailable => "single-instance arbitration is unavailable",
            NativeErrorKind::ArbitrationReleaseUncertain => {
                "single-instance arbitration release is uncertain"
            }
            NativeErrorKind::ObjectCollision => "single-instance object collision detected",
            NativeErrorKind::AlreadyOwned => "single-instance authority is already owned",
            NativeErrorKind::MaintenanceHeld => "JARVIS maintenance authority is already held",
            NativeErrorKind::NormalHeld => "JARVIS normal authority is already held",
            NativeErrorKind::ActivationUnavailable => {
                "existing JARVIS authority could not be activated"
            }
            NativeErrorKind::ActivationUncertain => {
                "JARVIS activation outcome is uncertain and requires reconciliation"
            }
            NativeErrorKind::ActivationUnacknowledged => "JARVIS activation was not acknowledged",
            NativeErrorKind::OwnerOtherSession => {
                "existing JARVIS authority belongs to another session"
            }
            NativeErrorKind::StateCorrupt => "JARVIS owner state is corrupt or incomplete",
            NativeErrorKind::StateUnavailable => "JARVIS owner state is unavailable",
            NativeErrorKind::StateWriteFailed => "JARVIS owner state could not be committed",
            NativeErrorKind::LockTimeout => "JARVIS owner state lock timed out",
            NativeErrorKind::LockUnavailable => "JARVIS owner state lock is unavailable",
            NativeErrorKind::LockUncertain => "JARVIS owner state lock release is uncertain",
            NativeErrorKind::EventUnavailable => "JARVIS activation events are unavailable",
            NativeErrorKind::InvalidRuntimeState => "JARVIS owner state transition was invalid",
            NativeErrorKind::NotReady => "JARVIS authority is not ready",
        })
    }
}

impl std::error::Error for NativeError {}

/// The result reported by the bounded activation callback.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ActivationCallbackResult {
    Handled,
    NotStarted,
    Uncertain,
}

/// The result of cancelling a queued or running activation request.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ActivationCancellation {
    Cancelled,
    InFlight,
    Stale,
    Uncertain,
}

/// A request received by the already-running same-session authority.
#[derive(Clone, Debug)]
pub struct ActivationRequest {
    pub process_id: u32,
    pub generation: u64,
    #[cfg(windows)]
    pub(crate) context: windows::ActivationRequestContext,
}

#[cfg(windows)]
impl ActivationRequest {
    /// Begins native presentation only if the exact generation is still
    /// queued and has not been cancelled by the requester.
    pub fn begin_presentation(&self) -> Result<windows::ActivationStart, NativeError> {
        self.context.begin_presentation()
    }

    /// Requests cancellation of the exact generation. A running presentation
    /// remains uncertain until it reports its terminal result.
    pub fn cancel(&self) -> ActivationCancellation {
        self.context.cancel()
    }
}

/// Result of a second launch. The process that requested activation may exit
/// normally only after the bounded request/ack protocol completes.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SecondLaunch {
    pub acknowledged: bool,
}

/// The only successful normal/maintenance acquisition result.
#[cfg(windows)]
pub use windows::{
    Acquisition, ActivationPresentation, ActivationStart, ActivationWorker, OwnerController,
    OwnerLease,
};

#[cfg(not(windows))]
pub use unsupported::{Acquisition, ActivationWorker, OwnerLease};

/// Acquire the one stable normal or maintenance authority.
pub fn acquire(role: Role) -> Result<Acquisition, NativeError> {
    #[cfg(windows)]
    {
        windows::acquire(role)
    }

    #[cfg(not(windows))]
    {
        unsupported::acquire(role)
    }
}
