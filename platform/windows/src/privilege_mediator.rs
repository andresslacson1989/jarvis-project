//! Narrow Windows privilege mediation boundary.
//!
//! The normal JARVIS host and all workers remain non-elevated.  This module
//! deliberately exposes no executable path, shell text, or arbitrary argument
//! surface.  A later provider-qualification subsection may register the one
//! typed setup operation after independently qualifying its helper identity
//! and UAC lifecycle.  Until then, requests fail closed as unqualified.

use std::error::Error;
use std::fmt::{Display, Formatter};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

pub const PRIVILEGE_MEDIATION_CAPABILITY: &str = "privilege_mediation";

const MAX_PROVIDER_ID_BYTES: usize = 64;
const MAX_ARGUMENTS: usize = 16;
const MAX_ARGUMENT_BYTES: usize = 512;
const MAX_TOTAL_ARGUMENT_BYTES: usize = 2_048;

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
    const fn available_unqualified() -> Self {
        Self {
            capability: PRIVILEGE_MEDIATION_CAPABILITY,
            availability: CapabilityAvailability::Available,
            qualification: CapabilityQualification::Unqualified,
        }
    }

    const fn unavailable_unqualified() -> Self {
        Self {
            capability: PRIVILEGE_MEDIATION_CAPABILITY,
            availability: CapabilityAvailability::Unavailable,
            qualification: CapabilityQualification::Unqualified,
        }
    }
}

/// The only operation identity that can be represented by this boundary.
/// Provider-specific setup qualification is intentionally supplied later.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PrivilegeOperationId {
    ProviderSetupRepair,
}

impl TryFrom<&str> for PrivilegeOperationId {
    type Error = PrivilegeMediatorErrorCode;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "PROVIDER_SETUP_REPAIR" => Ok(Self::ProviderSetupRepair),
            _ => Err(PrivilegeMediatorErrorCode::UnknownOperation),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderSetupArguments {
    provider_id: String,
    arguments: Vec<String>,
}

impl ProviderSetupArguments {
    pub fn new(
        provider_id: String,
        arguments: Vec<String>,
    ) -> Result<Self, PrivilegeMediatorError> {
        let provider_id_bytes = provider_id.len();
        if provider_id_bytes == 0 || provider_id_bytes > MAX_PROVIDER_ID_BYTES {
            return Err(PrivilegeMediatorError::invalid_arguments(
                "provider identity length is outside the bounded limit",
            ));
        }

        if provider_id.contains('\0') || arguments.iter().any(|argument| argument.contains('\0')) {
            return Err(PrivilegeMediatorError::invalid_arguments(
                "provider setup arguments cannot contain NUL bytes",
            ));
        }

        if arguments.len() > MAX_ARGUMENTS {
            return Err(PrivilegeMediatorError::invalid_arguments(
                "provider setup argument count exceeds the bounded limit",
            ));
        }

        let total_argument_bytes = arguments.iter().map(String::len).sum::<usize>();
        if arguments
            .iter()
            .any(|argument| argument.is_empty() || argument.len() > MAX_ARGUMENT_BYTES)
            || total_argument_bytes > MAX_TOTAL_ARGUMENT_BYTES
        {
            return Err(PrivilegeMediatorError::invalid_arguments(
                "provider setup argument size is outside the bounded limit",
            ));
        }

        Ok(Self {
            provider_id,
            arguments,
        })
    }

    pub fn provider_id(&self) -> &str {
        &self.provider_id
    }

    pub fn arguments(&self) -> &[String] {
        &self.arguments
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QualifiedHelperIdentity {
    canonical_path: PathBuf,
    sha256: [u8; 32],
}

impl QualifiedHelperIdentity {
    /// Construct an identity only for an already-installed, canonical helper.
    /// The bytes are hashed again before any future invocation.
    pub fn from_installed_file(path: impl AsRef<Path>) -> Result<Self, PrivilegeMediatorError> {
        let path = path.as_ref();
        if !path.is_absolute() {
            return Err(PrivilegeMediatorError::identity_invalid(
                "qualified helper path must be absolute",
            ));
        }

        let metadata = std::fs::symlink_metadata(path).map_err(|_| {
            PrivilegeMediatorError::identity_invalid("qualified helper path is not installed")
        })?;
        if metadata.file_type().is_symlink() {
            return Err(PrivilegeMediatorError::identity_invalid(
                "qualified helper path must not be a symlink",
            ));
        }

        let canonical_path = std::fs::canonicalize(path).map_err(|_| {
            PrivilegeMediatorError::identity_invalid("qualified helper path is not installed")
        })?;

        let bytes = std::fs::read(&canonical_path).map_err(|_| {
            PrivilegeMediatorError::identity_invalid("qualified helper could not be read")
        })?;
        let mut sha256 = [0_u8; 32];
        let digest = Sha256::digest(bytes);
        sha256.copy_from_slice(&digest);
        Ok(Self {
            canonical_path,
            sha256,
        })
    }

    fn still_matches_installed_file(&self) -> Result<(), PrivilegeMediatorError> {
        let current_path = std::fs::canonicalize(&self.canonical_path).map_err(|_| {
            PrivilegeMediatorError::identity_invalid("qualified helper is no longer installed")
        })?;
        if current_path != self.canonical_path {
            return Err(PrivilegeMediatorError::identity_invalid(
                "qualified helper path identity changed",
            ));
        }

        let bytes = std::fs::read(&current_path).map_err(|_| {
            PrivilegeMediatorError::identity_invalid("qualified helper could not be read")
        })?;
        let current_hash = Sha256::digest(bytes);
        if current_hash[..] != self.sha256[..] {
            return Err(PrivilegeMediatorError::identity_invalid(
                "qualified helper content identity changed",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RegisteredOperation {
    helper: QualifiedHelperIdentity,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct PrivilegeOperationRegistry {
    provider_setup_repair: Option<RegisteredOperation>,
}

impl PrivilegeOperationRegistry {
    pub const fn empty() -> Self {
        Self {
            provider_setup_repair: None,
        }
    }

    /// Registration is intentionally limited to the typed provider setup
    /// identity. It is not a generic executable/path registration API.
    pub fn with_provider_setup_repair(helper: QualifiedHelperIdentity) -> Self {
        Self {
            provider_setup_repair: Some(RegisteredOperation { helper }),
        }
    }

    fn get(&self, operation: PrivilegeOperationId) -> Option<&RegisteredOperation> {
        match operation {
            PrivilegeOperationId::ProviderSetupRepair => self.provider_setup_repair.as_ref(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrivilegeMediatorErrorCode {
    CapabilityUnavailable,
    BackendUnqualified,
    UnknownOperation,
    OperationNotRegistered,
    InvalidArguments,
    HelperIdentityInvalid,
    UacLifecycleUnqualified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PrivilegeMediatorError {
    pub code: PrivilegeMediatorErrorCode,
    pub operation: Option<PrivilegeOperationId>,
}

impl PrivilegeMediatorError {
    const fn invalid_arguments(_detail: &'static str) -> Self {
        Self {
            code: PrivilegeMediatorErrorCode::InvalidArguments,
            operation: None,
        }
    }

    const fn identity_invalid(_detail: &'static str) -> Self {
        Self {
            code: PrivilegeMediatorErrorCode::HelperIdentityInvalid,
            operation: None,
        }
    }
}

impl Display for PrivilegeMediatorError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "Windows privilege mediation failed with {:?} for {:?}",
            self.code, self.operation
        )
    }
}

impl Error for PrivilegeMediatorError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsPrivilegeMediator {
    registry: PrivilegeOperationRegistry,
}

impl WindowsPrivilegeMediator {
    /// Build the V1 boundary with no qualified operation. This is the only
    /// composition available until provider setup qualification is complete.
    pub const fn new() -> Self {
        Self {
            registry: PrivilegeOperationRegistry::empty(),
        }
    }

    /// Expose a typed registry without claiming that UAC launch is qualified.
    /// The registry is consumed only to establish whether a later qualified
    /// operation exists; invocation still fails closed in this subsection.
    pub fn from_registry(registry: &PrivilegeOperationRegistry) -> Self {
        Self {
            registry: registry.clone(),
        }
    }

    pub fn capability_status(&self) -> CapabilityStatus {
        if self.registry.provider_setup_repair.is_some() {
            CapabilityStatus::available_unqualified()
        } else {
            CapabilityStatus::unavailable_unqualified()
        }
    }

    /// No request reaches an elevated process in this subsection. A future
    /// provider qualification must replace the final unqualified result with
    /// a separately tracked, bounded UAC lifecycle.
    pub fn invoke(
        &self,
        operation: PrivilegeOperationId,
        arguments: ProviderSetupArguments,
    ) -> Result<(), PrivilegeMediatorError> {
        if self.registry.provider_setup_repair.is_none() {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::CapabilityUnavailable,
                operation: Some(operation),
            });
        }

        if self.registry.get(operation).is_none() {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::OperationNotRegistered,
                operation: Some(operation),
            });
        }

        let registered = self.registry.get(operation).expect("checked above");
        registered.helper.still_matches_installed_file()?;
        let _ = arguments;
        Err(PrivilegeMediatorError {
            code: PrivilegeMediatorErrorCode::UacLifecycleUnqualified,
            operation: Some(operation),
        })
    }
}

impl Default for WindowsPrivilegeMediator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_arguments() -> ProviderSetupArguments {
        ProviderSetupArguments::new("codex".to_owned(), vec!["--repair".to_owned()])
            .expect("test arguments are bounded")
    }

    #[test]
    fn empty_registry_is_unavailable_and_unqualified() {
        let mediator = WindowsPrivilegeMediator::new();
        assert_eq!(
            mediator.capability_status().capability,
            "privilege_mediation"
        );
        assert_eq!(
            mediator.capability_status().availability,
            CapabilityAvailability::Unavailable
        );
        assert_eq!(
            mediator.capability_status().qualification,
            CapabilityQualification::Unqualified
        );

        let error = mediator
            .invoke(PrivilegeOperationId::ProviderSetupRepair, setup_arguments())
            .expect_err("unqualified mediation must fail closed");
        assert_eq!(
            error.code,
            PrivilegeMediatorErrorCode::CapabilityUnavailable
        );
    }

    #[test]
    fn arbitrary_operation_identity_is_rejected() {
        assert_eq!(
            PrivilegeOperationId::try_from("execute_any_command"),
            Err(PrivilegeMediatorErrorCode::UnknownOperation)
        );
    }

    #[test]
    fn provider_setup_arguments_are_bounded_and_nul_free() {
        assert_eq!(
            ProviderSetupArguments::new("codex\0".to_owned(), Vec::new())
                .expect_err("NUL must be rejected")
                .code,
            PrivilegeMediatorErrorCode::InvalidArguments
        );
        assert_eq!(
            ProviderSetupArguments::new(
                "codex".to_owned(),
                vec!["x".repeat(MAX_ARGUMENT_BYTES + 1)]
            )
            .expect_err("oversized arguments must be rejected")
            .code,
            PrivilegeMediatorErrorCode::InvalidArguments
        );
    }

    #[test]
    fn registered_operation_still_requires_qualified_uac_lifecycle() {
        let helper = QualifiedHelperIdentity::from_installed_file(
            std::env::current_exe().expect("test executable path"),
        )
        .expect("test executable is installed and canonical");
        let registry = PrivilegeOperationRegistry::with_provider_setup_repair(helper);
        let mediator = WindowsPrivilegeMediator::from_registry(&registry);

        assert_eq!(
            mediator.capability_status().availability,
            CapabilityAvailability::Available
        );
        assert_eq!(
            mediator.capability_status().qualification,
            CapabilityQualification::Unqualified
        );
        let error = mediator
            .invoke(PrivilegeOperationId::ProviderSetupRepair, setup_arguments())
            .expect_err("UAC lifecycle is not qualified in Phase 2");
        assert_eq!(
            error.code,
            PrivilegeMediatorErrorCode::UacLifecycleUnqualified
        );
    }

    #[test]
    fn changed_helper_identity_is_rejected_before_uac_lifecycle() {
        let mut helper = QualifiedHelperIdentity::from_installed_file(
            std::env::current_exe().expect("test executable path"),
        )
        .expect("test executable is installed and canonical");
        helper.sha256[0] ^= 0xff;
        let registry = PrivilegeOperationRegistry::with_provider_setup_repair(helper);
        let mediator = WindowsPrivilegeMediator::from_registry(&registry);

        let error = mediator
            .invoke(PrivilegeOperationId::ProviderSetupRepair, setup_arguments())
            .expect_err("changed helper identity must fail before UAC");
        assert_eq!(
            error.code,
            PrivilegeMediatorErrorCode::HelperIdentityInvalid
        );
    }
}
