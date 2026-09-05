pub const WINDOWS_V1_PLATFORM: &str = "WINDOWS";
pub const WINDOWS_V1_RUNTIME_ROLE: &str = "FULL_HOST";
pub const WINDOWS_V1_ARCHITECTURE: &str = "x64";
pub const WINDOWS_V1_BACKEND_PROFILE_ID: &str = "windows-v1-x64-full-host";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CapabilityBindingsState {
    UnavailableUnqualified,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WindowsHostIdentity {
    pub platform: &'static str,
    pub runtime_role: &'static str,
    pub architecture: &'static str,
    pub backend_profile_id: &'static str,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct WindowsHostRegistration {
    identity: WindowsHostIdentity,
    capability_bindings: CapabilityBindingsState,
}

// These accessors are consumed by composition tests and diagnostics; the
// qualified production path passes the registration through without reading
// its fields, so only non-test builds need this narrow allowance.
#[cfg_attr(not(test), allow(dead_code))]
impl WindowsHostRegistration {
    pub const fn identity(&self) -> WindowsHostIdentity {
        self.identity
    }

    pub const fn capability_bindings(&self) -> CapabilityBindingsState {
        self.capability_bindings
    }
}

pub const fn registration() -> WindowsHostRegistration {
    WindowsHostRegistration {
        identity: WindowsHostIdentity {
            platform: WINDOWS_V1_PLATFORM,
            runtime_role: WINDOWS_V1_RUNTIME_ROLE,
            architecture: WINDOWS_V1_ARCHITECTURE,
            backend_profile_id: WINDOWS_V1_BACKEND_PROFILE_ID,
        },
        capability_bindings: CapabilityBindingsState::UnavailableUnqualified,
    }
}
