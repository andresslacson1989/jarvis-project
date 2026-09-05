pub mod windows;

use std::fmt;

pub use windows::WindowsHostRegistration;

const WINDOWS_REGISTRATION_COUNT: usize = 1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PlatformHostRequest<'a> {
    pub platform: &'a str,
    pub runtime_role: &'a str,
    pub architecture: &'a str,
    pub backend_profile_id: &'a str,
}

impl PlatformHostRequest<'_> {
    pub const fn windows_v1() -> Self {
        Self {
            platform: windows::WINDOWS_V1_PLATFORM,
            runtime_role: windows::WINDOWS_V1_RUNTIME_ROLE,
            architecture: windows::WINDOWS_V1_ARCHITECTURE,
            backend_profile_id: windows::WINDOWS_V1_BACKEND_PROFILE_ID,
        }
    }
}

// Non-registered states are explicit test seams for fail-closed behavior; the
// production path supplies the one static Registered state.
#[allow(dead_code)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BackendRegistrationState {
    Registered,
    Missing,
    Unavailable,
    Unqualified,
    Conflicting,
}

// These variants are target-specific: unsupported-target builds construct
// them while the qualified Windows build must retain their explicit failure
// semantics without producing dead-code warnings.
#[allow(dead_code)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HostStartupError {
    UnsupportedTarget,
    UnsupportedArchitecture,
    InvalidPlatform,
    InvalidRuntimeRole,
    InvalidArchitecture,
    InvalidBackendProfile,
    BackendMissing,
    BackendUnavailable,
    BackendUnqualified,
    ConflictingRegistration,
    TauriRuntimeFailed,
}

impl HostStartupError {
    pub const fn diagnostic(self) -> &'static str {
        match self {
            Self::UnsupportedTarget => {
                "JARVIS V1 desktop host is only qualified for Windows: unsupported target"
            }
            Self::UnsupportedArchitecture => {
                "JARVIS desktop host unavailable: unsupported architecture"
            }
            Self::InvalidPlatform => "JARVIS desktop host unavailable: invalid platform",
            Self::InvalidRuntimeRole => "JARVIS desktop host unavailable: invalid runtime role",
            Self::InvalidArchitecture => "JARVIS desktop host unavailable: invalid architecture",
            Self::InvalidBackendProfile => {
                "JARVIS desktop host unavailable: invalid backend profile"
            }
            Self::BackendMissing => "JARVIS desktop host unavailable: backend missing",
            Self::BackendUnavailable => "JARVIS desktop host unavailable: backend unavailable",
            Self::BackendUnqualified => "JARVIS desktop host unavailable: backend unqualified",
            Self::ConflictingRegistration => {
                "JARVIS desktop host unavailable: conflicting registration"
            }
            Self::TauriRuntimeFailed => "JARVIS desktop host unavailable: runtime start failed",
        }
    }

    pub fn exit_code(self) -> std::process::ExitCode {
        std::process::ExitCode::from(1)
    }
}

impl fmt::Display for HostStartupError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.diagnostic())
    }
}

pub fn validate_compiled_target() -> Result<(), HostStartupError> {
    #[cfg(not(target_os = "windows"))]
    {
        return Err(HostStartupError::UnsupportedTarget);
    }

    #[cfg(all(target_os = "windows", not(target_arch = "x86_64")))]
    {
        return Err(HostStartupError::UnsupportedArchitecture);
    }

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        Ok(())
    }
}

pub fn select_windows_host(
    request: PlatformHostRequest<'_>,
    registration_state: BackendRegistrationState,
) -> Result<WindowsHostRegistration, HostStartupError> {
    if request.platform != windows::WINDOWS_V1_PLATFORM {
        return Err(HostStartupError::InvalidPlatform);
    }
    if request.runtime_role != windows::WINDOWS_V1_RUNTIME_ROLE {
        return Err(HostStartupError::InvalidRuntimeRole);
    }
    if request.architecture != windows::WINDOWS_V1_ARCHITECTURE {
        return Err(HostStartupError::InvalidArchitecture);
    }
    if request.backend_profile_id != windows::WINDOWS_V1_BACKEND_PROFILE_ID {
        return Err(HostStartupError::InvalidBackendProfile);
    }

    match WINDOWS_REGISTRATION_COUNT {
        0 => return Err(HostStartupError::BackendMissing),
        1 => {}
        _ => return Err(HostStartupError::ConflictingRegistration),
    }

    match registration_state {
        BackendRegistrationState::Registered => Ok(windows::registration()),
        BackendRegistrationState::Missing => Err(HostStartupError::BackendMissing),
        BackendRegistrationState::Unavailable => Err(HostStartupError::BackendUnavailable),
        BackendRegistrationState::Unqualified => Err(HostStartupError::BackendUnqualified),
        BackendRegistrationState::Conflicting => Err(HostStartupError::ConflictingRegistration),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        BackendRegistrationState, HostStartupError, PlatformHostRequest, select_windows_host,
    };
    use crate::platform::windows::{
        CapabilityBindingsState, WINDOWS_V1_ARCHITECTURE, WINDOWS_V1_BACKEND_PROFILE_ID,
        WINDOWS_V1_PLATFORM, WINDOWS_V1_RUNTIME_ROLE,
    };

    fn request<'a>(
        platform: &'a str,
        runtime_role: &'a str,
        architecture: &'a str,
        backend_profile_id: &'a str,
    ) -> PlatformHostRequest<'a> {
        PlatformHostRequest {
            platform,
            runtime_role,
            architecture,
            backend_profile_id,
        }
    }

    #[test]
    fn exact_windows_target_selects_one_unbound_host_projection() {
        let selected = select_windows_host(
            PlatformHostRequest::windows_v1(),
            BackendRegistrationState::Registered,
        )
        .expect("exact V1 host tuple should select");

        assert_eq!(selected.identity().platform, WINDOWS_V1_PLATFORM);
        assert_eq!(selected.identity().runtime_role, WINDOWS_V1_RUNTIME_ROLE);
        assert_eq!(selected.identity().architecture, WINDOWS_V1_ARCHITECTURE);
        assert_eq!(
            selected.identity().backend_profile_id,
            WINDOWS_V1_BACKEND_PROFILE_ID
        );
        assert_eq!(
            selected.capability_bindings(),
            CapabilityBindingsState::UnavailableUnqualified
        );
    }

    #[test]
    fn non_v1_and_malformed_requests_fail_closed() {
        let cases = [
            (
                request("LINUX", "FULL_HOST", "x64", WINDOWS_V1_BACKEND_PROFILE_ID),
                HostStartupError::InvalidPlatform,
            ),
            (
                request(
                    "ANDROID",
                    "COMPANION",
                    "arm64",
                    WINDOWS_V1_BACKEND_PROFILE_ID,
                ),
                HostStartupError::InvalidPlatform,
            ),
            (
                request(
                    WINDOWS_V1_PLATFORM,
                    "COMPANION",
                    "x64",
                    WINDOWS_V1_BACKEND_PROFILE_ID,
                ),
                HostStartupError::InvalidRuntimeRole,
            ),
            (
                request(
                    WINDOWS_V1_PLATFORM,
                    WINDOWS_V1_RUNTIME_ROLE,
                    "arm64",
                    WINDOWS_V1_BACKEND_PROFILE_ID,
                ),
                HostStartupError::InvalidArchitecture,
            ),
            (
                request(
                    WINDOWS_V1_PLATFORM,
                    WINDOWS_V1_RUNTIME_ROLE,
                    WINDOWS_V1_ARCHITECTURE,
                    "wrong-profile",
                ),
                HostStartupError::InvalidBackendProfile,
            ),
            (request("", "", "", ""), HostStartupError::InvalidPlatform),
        ];

        for (request, expected) in cases {
            assert_eq!(
                select_windows_host(request, BackendRegistrationState::Registered),
                Err(expected)
            );
        }
    }

    #[test]
    fn missing_unavailable_unqualified_and_conflicting_registrations_fail_closed() {
        let request = PlatformHostRequest::windows_v1();
        let cases = [
            (
                BackendRegistrationState::Missing,
                HostStartupError::BackendMissing,
            ),
            (
                BackendRegistrationState::Unavailable,
                HostStartupError::BackendUnavailable,
            ),
            (
                BackendRegistrationState::Unqualified,
                HostStartupError::BackendUnqualified,
            ),
            (
                BackendRegistrationState::Conflicting,
                HostStartupError::ConflictingRegistration,
            ),
        ];

        for (state, expected) in cases {
            assert_eq!(select_windows_host(request, state), Err(expected));
        }
    }

    #[test]
    fn repeated_selection_is_semantically_idempotent() {
        let first = select_windows_host(
            PlatformHostRequest::windows_v1(),
            BackendRegistrationState::Registered,
        )
        .expect("first selection should succeed");
        let second = select_windows_host(
            PlatformHostRequest::windows_v1(),
            BackendRegistrationState::Registered,
        )
        .expect("second selection should succeed");

        assert_eq!(first, second);
    }
}
