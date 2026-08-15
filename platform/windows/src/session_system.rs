//! Windows session-trust observation and bounded system-information discovery.
//!
//! These probes report technical facts only. They do not authenticate a user,
//! grant authority, or declare a release-qualified platform on their own.

use std::error::Error;
use std::ffi::c_void;
use std::fmt::{Display, Formatter};
use std::mem::size_of;
use std::ptr::null_mut;

use windows_sys::Win32::Foundation::FALSE;
use windows_sys::Win32::System::RemoteDesktop::{
    WTS_CONNECTSTATE_CLASS, WTS_CURRENT_SESSION, WTSActive, WTSConnectState, WTSFreeMemory,
    WTSQuerySessionInformationW,
};
use windows_sys::Win32::System::StationsAndDesktops::{
    CloseDesktop, DESKTOP_READOBJECTS, GetUserObjectInformationW, HDESK, OpenInputDesktop, UOI_NAME,
};
use windows_sys::Win32::System::SystemInformation::{
    GetNativeSystemInfo, GetTickCount64, GlobalMemoryStatusEx, MEMORYSTATUSEX,
    PROCESSOR_ARCHITECTURE_AMD64, SYSTEM_INFO,
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
use windows_sys::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_REMOTESESSION};

pub const SESSION_LOCK_OBSERVATION_CAPABILITY: &str = "session_lock_observation";
pub const SYSTEM_INFO_CAPABILITY: &str = "system_info";
pub const HARDWARE_ACCELERATION_CAPABILITY: &str = "hardware_acceleration";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapabilityAvailability {
    Available,
    Unavailable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapabilityQualification {
    Qualified,
    Unqualified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CapabilityStatus {
    pub capability: &'static str,
    pub availability: CapabilityAvailability,
    pub qualification: CapabilityQualification,
}

impl CapabilityStatus {
    const fn available_qualified(capability: &'static str) -> Self {
        Self {
            capability,
            availability: CapabilityAvailability::Available,
            qualification: CapabilityQualification::Qualified,
        }
    }

    const fn unavailable_unqualified(capability: &'static str) -> Self {
        Self {
            capability,
            availability: CapabilityAvailability::Unavailable,
            qualification: CapabilityQualification::Unqualified,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowsPlatformErrorCode {
    SessionObserverFailed,
    SystemInfoFailed,
    UnsupportedArchitecture,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowsPlatformError {
    pub code: WindowsPlatformErrorCode,
    pub operation: &'static str,
}

impl Display for WindowsPlatformError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "Windows platform operation '{}' failed with {:?}",
            self.operation, self.code
        )
    }
}

impl Error for WindowsPlatformError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionTrustState {
    Locked,
    Unlocked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionTransition {
    Locked,
    Unlocking,
    Unlocked,
    Locking,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputDesktop {
    Interactive,
    Protected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionConnectivity {
    Active,
    NotActive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionLockReason {
    OsSessionLock,
    OsSessionEnd,
    Idle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SessionObservation {
    pub transition: SessionTransition,
    pub stable_state: SessionTrustState,
    pub input_desktop: InputDesktop,
    pub connectivity: SessionConnectivity,
    pub lock_reason: Option<SessionLockReason>,
}

#[derive(Debug, Default)]
pub struct PlatformSessionObserver {
    last_state: Option<SessionTrustState>,
    idle_timeout_millis: Option<u64>,
}

impl PlatformSessionObserver {
    pub const fn new() -> Self {
        Self {
            last_state: None,
            idle_timeout_millis: None,
        }
    }

    pub const fn with_idle_timeout_millis(idle_timeout_millis: u64) -> Self {
        Self {
            last_state: None,
            idle_timeout_millis: Some(idle_timeout_millis),
        }
    }

    pub fn capability_status(&self) -> CapabilityStatus {
        match probe_session_with_idle_timeout(None) {
            Ok(_) => CapabilityStatus::available_qualified(SESSION_LOCK_OBSERVATION_CAPABILITY),
            Err(_) => {
                CapabilityStatus::unavailable_unqualified(SESSION_LOCK_OBSERVATION_CAPABILITY)
            }
        }
    }

    /// Observe the current input desktop and interactive session state.
    ///
    /// A failed probe is returned as an unavailable capability. Callers must
    /// retain the last safe locked state rather than treating probe failure as
    /// an unlocked session.
    pub fn observe(&mut self) -> Result<SessionObservation, WindowsPlatformError> {
        let (stable_state, input_desktop, connectivity, lock_reason) =
            probe_session_with_idle_timeout(self.idle_timeout_millis)?;
        let transition = transition_for(self.last_state, stable_state);
        self.last_state = Some(stable_state);
        Ok(SessionObservation {
            transition,
            stable_state,
            input_desktop,
            connectivity,
            lock_reason,
        })
    }
}

fn transition_for(
    previous: Option<SessionTrustState>,
    current: SessionTrustState,
) -> SessionTransition {
    match (previous, current) {
        (None, SessionTrustState::Locked) => SessionTransition::Locked,
        (None, SessionTrustState::Unlocked) => SessionTransition::Unlocked,
        (Some(SessionTrustState::Locked), SessionTrustState::Locked) => SessionTransition::Locked,
        (Some(SessionTrustState::Locked), SessionTrustState::Unlocked) => {
            SessionTransition::Unlocking
        }
        (Some(SessionTrustState::Unlocked), SessionTrustState::Locked) => {
            SessionTransition::Locking
        }
        (Some(SessionTrustState::Unlocked), SessionTrustState::Unlocked) => {
            SessionTransition::Unlocked
        }
    }
}

fn probe_session_with_idle_timeout(
    idle_timeout_millis: Option<u64>,
) -> Result<
    (
        SessionTrustState,
        InputDesktop,
        SessionConnectivity,
        Option<SessionLockReason>,
    ),
    WindowsPlatformError,
> {
    let desktop_name = input_desktop_name()?;
    let connectivity = query_session_connectivity()?;
    let input_desktop = if desktop_name == "Default" {
        InputDesktop::Interactive
    } else {
        InputDesktop::Protected
    };
    let idle = idle_timeout_millis
        .map(|timeout| query_idle_duration_millis().map(|duration| duration >= timeout))
        .transpose()?
        .unwrap_or(false);
    let lock_reason = classify_lock_reason(input_desktop, connectivity, idle);
    let stable_state = if lock_reason.is_none() {
        SessionTrustState::Unlocked
    } else {
        SessionTrustState::Locked
    };
    Ok((stable_state, input_desktop, connectivity, lock_reason))
}

fn classify_lock_reason(
    input_desktop: InputDesktop,
    connectivity: SessionConnectivity,
    idle: bool,
) -> Option<SessionLockReason> {
    if idle {
        Some(SessionLockReason::Idle)
    } else if connectivity == SessionConnectivity::NotActive {
        Some(SessionLockReason::OsSessionEnd)
    } else if input_desktop == InputDesktop::Protected {
        Some(SessionLockReason::OsSessionLock)
    } else {
        None
    }
}

fn query_idle_duration_millis() -> Result<u64, WindowsPlatformError> {
    let mut input = LASTINPUTINFO {
        cbSize: size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    // SAFETY: the structure is initialized with the documented size and is
    // exclusively owned by this call; no handles or borrowed pointers cross
    // the boundary.
    let success = unsafe { GetLastInputInfo(&mut input) };
    if success == 0 {
        return Err(WindowsPlatformError {
            code: WindowsPlatformErrorCode::SessionObserverFailed,
            operation: "GetLastInputInfo",
        });
    }
    // SAFETY: GetTickCount64 is a side-effect-free system query with no
    // caller-owned pointers or handles.
    let now = unsafe { GetTickCount64() } as u32;
    Ok(now.wrapping_sub(input.dwTime) as u64)
}

struct OwnedDesktop(HDESK);

impl Drop for OwnedDesktop {
    fn drop(&mut self) {
        // SAFETY: the handle was returned by OpenInputDesktop and is owned by
        // this guard; no other code closes it.
        unsafe {
            let _ = CloseDesktop(self.0);
        }
    }
}

fn input_desktop_name() -> Result<String, WindowsPlatformError> {
    // SAFETY: OpenInputDesktop is called with no inherited handle and the
    // read-only access required for GetUserObjectInformationW.
    let handle = unsafe { OpenInputDesktop(0, FALSE, DESKTOP_READOBJECTS) };
    if handle.is_null() {
        return Err(WindowsPlatformError {
            code: WindowsPlatformErrorCode::SessionObserverFailed,
            operation: "OpenInputDesktop",
        });
    }
    let owned = OwnedDesktop(handle);
    let mut bytes_needed = 0u32;
    // SAFETY: the first call intentionally supplies a null buffer to obtain
    // the required bounded size; the handle is valid for the guard lifetime.
    let _ =
        unsafe { GetUserObjectInformationW(owned.0, UOI_NAME, null_mut(), 0, &mut bytes_needed) };
    if bytes_needed == 0 || bytes_needed > 4096 {
        return Err(WindowsPlatformError {
            code: WindowsPlatformErrorCode::SessionObserverFailed,
            operation: "GetUserObjectInformationW:size",
        });
    }
    let word_count = (bytes_needed as usize).div_ceil(size_of::<u16>()).max(1);
    let mut buffer = vec![0u16; word_count];
    // SAFETY: the buffer is writable, its byte length is supplied exactly,
    // and the desktop handle remains owned by the guard.
    let success = unsafe {
        GetUserObjectInformationW(
            owned.0,
            UOI_NAME,
            buffer.as_mut_ptr().cast::<c_void>(),
            (buffer.len() * size_of::<u16>()) as u32,
            &mut bytes_needed,
        )
    };
    if success == 0 {
        return Err(WindowsPlatformError {
            code: WindowsPlatformErrorCode::SessionObserverFailed,
            operation: "GetUserObjectInformationW:value",
        });
    }
    let length = buffer
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(buffer.len());
    String::from_utf16(&buffer[..length]).map_err(|_| WindowsPlatformError {
        code: WindowsPlatformErrorCode::SessionObserverFailed,
        operation: "GetUserObjectInformationW:decode",
    })
}

fn query_session_connectivity() -> Result<SessionConnectivity, WindowsPlatformError> {
    let mut buffer: *mut u16 = null_mut();
    let mut bytes_returned = 0u32;
    // SAFETY: the API fills one WTS_CONNECTSTATE_CLASS value and returns an
    // allocation owned by WTS; the pointer is released below with WTSFreeMemory.
    let success = unsafe {
        WTSQuerySessionInformationW(
            null_mut(),
            WTS_CURRENT_SESSION,
            WTSConnectState,
            &mut buffer,
            &mut bytes_returned,
        )
    };
    if success == 0
        || buffer.is_null()
        || bytes_returned < size_of::<WTS_CONNECTSTATE_CLASS>() as u32
    {
        if !buffer.is_null() {
            // SAFETY: a non-null buffer returned by WTSQuerySessionInformationW
            // is released exactly once through the documented WTS API.
            unsafe {
                WTSFreeMemory(buffer.cast::<c_void>());
            }
        }
        return Err(WindowsPlatformError {
            code: WindowsPlatformErrorCode::SessionObserverFailed,
            operation: "WTSQuerySessionInformationW",
        });
    }
    // SAFETY: the returned buffer is at least one WTS_CONNECTSTATE_CLASS wide,
    // as checked above, and is valid until WTSFreeMemory.
    let state = unsafe { *(buffer.cast::<WTS_CONNECTSTATE_CLASS>()) };
    // SAFETY: this is the matching release for the successful WTS query.
    unsafe {
        WTSFreeMemory(buffer.cast::<c_void>());
    }
    Ok(if state == WTSActive {
        SessionConnectivity::Active
    } else {
        SessionConnectivity::NotActive
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SystemInfoCapability {
    SystemInfo,
    HardwareAcceleration,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowsSystemInfoSnapshot {
    pub architecture: &'static str,
    pub logical_processor_count: u32,
    pub total_memory_bytes: u64,
    pub available_memory_bytes: u64,
    pub uptime_millis: u64,
    pub remote_session: bool,
}

impl WindowsSystemInfoSnapshot {
    fn validate(&self) -> Result<(), WindowsPlatformError> {
        if self.architecture != "x64"
            || self.logical_processor_count == 0
            || self.total_memory_bytes == 0
            || self.available_memory_bytes > self.total_memory_bytes
        {
            return Err(WindowsPlatformError {
                code: WindowsPlatformErrorCode::SystemInfoFailed,
                operation: "validate_system_info",
            });
        }
        Ok(())
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PlatformSystemInfo;

impl PlatformSystemInfo {
    pub const fn new() -> Self {
        Self
    }

    pub fn capability_status(&self, capability: SystemInfoCapability) -> CapabilityStatus {
        match capability {
            SystemInfoCapability::SystemInfo => match self.snapshot() {
                Ok(_) => CapabilityStatus::available_qualified(SYSTEM_INFO_CAPABILITY),
                Err(_) => CapabilityStatus::unavailable_unqualified(SYSTEM_INFO_CAPABILITY),
            },
            SystemInfoCapability::HardwareAcceleration => {
                CapabilityStatus::unavailable_unqualified(HARDWARE_ACCELERATION_CAPABILITY)
            }
        }
    }

    pub fn snapshot(&self) -> Result<WindowsSystemInfoSnapshot, WindowsPlatformError> {
        let mut system_info = SYSTEM_INFO::default();
        // SAFETY: Windows initializes the caller-owned SYSTEM_INFO structure.
        unsafe {
            GetNativeSystemInfo(&mut system_info);
        }
        // SAFETY: reading the initialized anonymous union is valid for the
        // SYSTEM_INFO structure returned by GetNativeSystemInfo.
        let architecture = unsafe { system_info.Anonymous.Anonymous.wProcessorArchitecture };
        if architecture != PROCESSOR_ARCHITECTURE_AMD64 {
            return Err(WindowsPlatformError {
                code: WindowsPlatformErrorCode::UnsupportedArchitecture,
                operation: "GetNativeSystemInfo",
            });
        }

        let mut memory = MEMORYSTATUSEX {
            dwLength: size_of::<MEMORYSTATUSEX>() as u32,
            ..Default::default()
        };
        // SAFETY: the structure has the required dwLength and is writable by
        // GlobalMemoryStatusEx.
        let memory_ok = unsafe { GlobalMemoryStatusEx(&mut memory) };
        if memory_ok == 0 {
            return Err(WindowsPlatformError {
                code: WindowsPlatformErrorCode::SystemInfoFailed,
                operation: "GlobalMemoryStatusEx",
            });
        }

        let snapshot = WindowsSystemInfoSnapshot {
            architecture: "x64",
            logical_processor_count: system_info.dwNumberOfProcessors,
            total_memory_bytes: memory.ullTotalPhys,
            available_memory_bytes: memory.ullAvailPhys,
            // SAFETY: GetTickCount64 is a side-effect-free system query with
            // no caller-owned pointers or handles.
            uptime_millis: unsafe { GetTickCount64() },
            // SAFETY: GetSystemMetrics is a side-effect-free query with a
            // documented metric index and no caller-owned pointers.
            remote_session: unsafe { GetSystemMetrics(SM_REMOTESESSION) != 0 },
        };
        snapshot.validate()?;
        Ok(snapshot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_transitions_are_explicit_and_fail_closed() {
        assert_eq!(
            transition_for(None, SessionTrustState::Locked),
            SessionTransition::Locked
        );
        assert_eq!(
            transition_for(Some(SessionTrustState::Locked), SessionTrustState::Unlocked),
            SessionTransition::Unlocking
        );
        assert_eq!(
            transition_for(Some(SessionTrustState::Unlocked), SessionTrustState::Locked),
            SessionTransition::Locking
        );
    }

    #[test]
    fn lock_reason_precedence_is_idle_then_sign_out_then_desktop_lock() {
        assert_eq!(
            classify_lock_reason(InputDesktop::Interactive, SessionConnectivity::Active, true),
            Some(SessionLockReason::Idle)
        );
        assert_eq!(
            classify_lock_reason(
                InputDesktop::Interactive,
                SessionConnectivity::NotActive,
                false
            ),
            Some(SessionLockReason::OsSessionEnd)
        );
        assert_eq!(
            classify_lock_reason(InputDesktop::Protected, SessionConnectivity::Active, false),
            Some(SessionLockReason::OsSessionLock)
        );
        assert_eq!(
            classify_lock_reason(
                InputDesktop::Interactive,
                SessionConnectivity::Active,
                false
            ),
            None
        );
    }

    #[test]
    fn system_info_snapshot_validation_rejects_unusable_facts() {
        let valid = WindowsSystemInfoSnapshot {
            architecture: "x64",
            logical_processor_count: 8,
            total_memory_bytes: 16 * 1024 * 1024 * 1024,
            available_memory_bytes: 8 * 1024 * 1024 * 1024,
            uptime_millis: 1,
            remote_session: false,
        };
        valid.validate().expect("valid system facts must pass");
        let invalid = WindowsSystemInfoSnapshot {
            available_memory_bytes: valid.total_memory_bytes + 1,
            ..valid
        };
        assert!(matches!(
            invalid.validate(),
            Err(WindowsPlatformError {
                code: WindowsPlatformErrorCode::SystemInfoFailed,
                ..
            })
        ));
    }

    #[test]
    fn live_windows_session_observer_is_conservative() {
        let mut observer = PlatformSessionObserver::new();
        let observation = observer
            .observe()
            .expect("Windows session probe must be available");
        assert!(matches!(
            observation.stable_state,
            SessionTrustState::Locked | SessionTrustState::Unlocked
        ));
        assert!(matches!(
            observation.input_desktop,
            InputDesktop::Interactive | InputDesktop::Protected
        ));
    }

    #[test]
    fn live_windows_system_info_is_x64_and_bounded() {
        let info = PlatformSystemInfo::new()
            .snapshot()
            .expect("Windows x64 system information must be readable");
        assert_eq!(info.architecture, "x64");
        assert!(info.logical_processor_count > 0);
        assert!(info.total_memory_bytes > 0);
        assert!(info.available_memory_bytes <= info.total_memory_bytes);
    }

    #[test]
    fn hardware_acceleration_is_not_claimed_by_initial_backend() {
        let status =
            PlatformSystemInfo::new().capability_status(SystemInfoCapability::HardwareAcceleration);
        assert_eq!(status.availability, CapabilityAvailability::Unavailable);
        assert_eq!(status.qualification, CapabilityQualification::Unqualified);
    }
}
