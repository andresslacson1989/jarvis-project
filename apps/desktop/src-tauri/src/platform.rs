//! Rust-side platform composition for the authoritative desktop host.
//!
//! This module selects the qualified V1 runtime target only. Concrete native
//! capability implementations are owned by their later platform subsections;
//! this boundary must not silently select a weaker or unrelated host.

use std::error::Error;
use std::fmt::{Display, Formatter};

pub const WINDOWS_V1_BACKEND_PROFILE_ID: &str = "windows-v1-x64-full-host";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlatformIdentity {
    pub platform: &'static str,
    pub runtime_role: &'static str,
    pub architecture: &'static str,
    pub backend_profile_id: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlatformComposition {
    pub identity: PlatformIdentity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UnsupportedHostTarget {
    pub target_os: &'static str,
    pub target_architecture: &'static str,
}

impl Display for UnsupportedHostTarget {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "JARVIS Windows FULL_HOST requires Windows x64; target is {} {}",
            self.target_os, self.target_architecture
        )
    }
}

impl Error for UnsupportedHostTarget {}

/// Select the only qualified V1 desktop host target.
///
/// The compile-time target gate is deliberately narrow. A future platform
/// must add its own qualified composition path instead of being treated as a
/// Windows host or receiving an implicit fallback.
pub fn compose_windows_full_host() -> Result<PlatformComposition, UnsupportedHostTarget> {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        Ok(PlatformComposition {
            identity: PlatformIdentity {
                platform: "WINDOWS",
                runtime_role: "FULL_HOST",
                architecture: "x64",
                backend_profile_id: WINDOWS_V1_BACKEND_PROFILE_ID,
            },
        })
    }

    #[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
    {
        Err(UnsupportedHostTarget {
            target_os: std::env::consts::OS,
            target_architecture: std::env::consts::ARCH,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v1_composition_is_exactly_windows_x64_full_host() {
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        {
            let composition = compose_windows_full_host().expect("Windows x64 must compose");
            assert_eq!(composition.identity.platform, "WINDOWS");
            assert_eq!(composition.identity.runtime_role, "FULL_HOST");
            assert_eq!(composition.identity.architecture, "x64");
            assert_eq!(
                composition.identity.backend_profile_id,
                WINDOWS_V1_BACKEND_PROFILE_ID
            );
        }

        #[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
        {
            let error = compose_windows_full_host().expect_err("unqualified targets must fail");
            assert_ne!(error.target_os, "windows");
        }
    }
}
