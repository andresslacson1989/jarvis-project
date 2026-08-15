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

#[cfg(all(target_os = "windows", not(test)))]
use std::ffi::OsStr;
#[cfg(all(target_os = "windows", not(test)))]
use std::os::windows::ffi::OsStrExt;
#[cfg(all(target_os = "windows", not(test)))]
use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, WAIT_OBJECT_0, WAIT_TIMEOUT};
#[cfg(all(target_os = "windows", not(test)))]
use windows_sys::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject};
#[cfg(all(target_os = "windows", not(test)))]
use windows_sys::Win32::UI::Shell::{
    SEE_MASK_NOCLOSEPROCESS, SEE_MASK_UNICODE, SHELLEXECUTEINFOW, ShellExecuteExW,
};
#[cfg(all(target_os = "windows", not(test)))]
use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

pub const PRIVILEGE_MEDIATION_CAPABILITY: &str = "privilege_mediation";
pub const CODEX_CLI_PROVIDER_ID: &str = "codex-cli";

const MAX_PROVIDER_ID_BYTES: usize = 64;
const MAX_ARGUMENTS: usize = 16;
const MAX_ARGUMENT_BYTES: usize = 512;
const MAX_TOTAL_ARGUMENT_BYTES: usize = 2_048;
#[cfg(all(target_os = "windows", not(test)))]
const UAC_HELPER_TIMEOUT_MS: u32 = 300_000;

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
    distribution_id: String,
    interface_id: String,
    arguments: Vec<String>,
}

impl ProviderSetupArguments {
    pub fn new(
        provider_id: String,
        distribution_id: String,
        interface_id: String,
        arguments: Vec<String>,
    ) -> Result<Self, PrivilegeMediatorError> {
        if provider_id.is_empty() || provider_id.len() > MAX_PROVIDER_ID_BYTES {
            return Err(PrivilegeMediatorError::invalid_arguments(
                "provider identity length is outside the bounded limit",
            ));
        }

        if distribution_id.is_empty() || distribution_id.len() > MAX_PROVIDER_ID_BYTES {
            return Err(PrivilegeMediatorError::invalid_arguments(
                "distribution identity length is outside the bounded limit",
            ));
        }

        if interface_id.is_empty() || interface_id.len() > MAX_PROVIDER_ID_BYTES {
            return Err(PrivilegeMediatorError::invalid_arguments(
                "interface identity length is outside the bounded limit",
            ));
        }

        if provider_id.contains('\0')
            || distribution_id.contains('\0')
            || interface_id.contains('\0')
            || arguments.iter().any(|argument| argument.contains('\0'))
        {
            return Err(PrivilegeMediatorError::invalid_arguments(
                "provider setup identity and arguments cannot contain NUL bytes",
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
            distribution_id,
            interface_id,
            arguments,
        })
    }

    pub fn provider_id(&self) -> &str {
        &self.provider_id
    }

    pub fn distribution_id(&self) -> &str {
        &self.distribution_id
    }

    pub fn interface_id(&self) -> &str {
        &self.interface_id
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
    provider_id: String,
    distribution_id: String,
    interface_id: String,
    qualified_arguments: Vec<String>,
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
    pub fn with_provider_setup_repair(
        provider_id: String,
        distribution_id: String,
        interface_id: String,
        qualified_arguments: Vec<String>,
        helper: QualifiedHelperIdentity,
    ) -> Result<Self, PrivilegeMediatorError> {
        let validated = ProviderSetupArguments::new(
            provider_id.clone(),
            distribution_id.clone(),
            interface_id.clone(),
            qualified_arguments,
        )?;
        Ok(Self {
            provider_setup_repair: Some(RegisteredOperation {
                provider_id,
                distribution_id,
                interface_id,
                qualified_arguments: validated.arguments,
                helper,
            }),
        })
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
    ProviderIdentityMismatch,
    DistributionIdentityMismatch,
    InterfaceIdentityMismatch,
    ArgumentPlanMismatch,
    HelperIdentityInvalid,
    UacLifecycleUnqualified,
    UacLaunchFailed,
    UacConsentDenied,
    UacWaitFailed,
    UacTimeout,
    UacHelperFailed,
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
        if registered.provider_id != arguments.provider_id() {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::ProviderIdentityMismatch,
                operation: Some(operation),
            });
        }
        if registered.distribution_id != arguments.distribution_id() {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::DistributionIdentityMismatch,
                operation: Some(operation),
            });
        }
        if registered.interface_id != arguments.interface_id() {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::InterfaceIdentityMismatch,
                operation: Some(operation),
            });
        }
        if registered.qualified_arguments != arguments.arguments() {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::ArgumentPlanMismatch,
                operation: Some(operation),
            });
        }
        registered.helper.still_matches_installed_file()?;

        #[cfg(test)]
        {
            let _ = arguments;
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::UacLifecycleUnqualified,
                operation: Some(operation),
            });
        }

        #[cfg(not(test))]
        {
            Self::launch_qualified_uac(&registered.helper, &arguments, operation)
        }
    }

    #[cfg(all(target_os = "windows", not(test)))]
    fn launch_qualified_uac(
        helper: &QualifiedHelperIdentity,
        arguments: &ProviderSetupArguments,
        operation: PrivilegeOperationId,
    ) -> Result<(), PrivilegeMediatorError> {
        let helper_path = wide_null(helper.canonical_path.as_os_str());
        let verb = wide_null(OsStr::new("runas"));
        let parameter_string = windows_parameter_string(arguments.arguments());
        let parameters = wide_null(OsStr::new(&parameter_string));

        let mut execute_info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        execute_info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        execute_info.fMask = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_UNICODE;
        execute_info.lpVerb = verb.as_ptr();
        execute_info.lpFile = helper_path.as_ptr();
        execute_info.lpParameters = parameters.as_ptr();
        execute_info.nShow = SW_SHOWNORMAL;

        // SAFETY: all pointers refer to NUL-terminated buffers held alive for
        // the entire synchronous ShellExecuteExW call. The helper path and
        // argument plan were identity-checked immediately before this call.
        let launched = unsafe { ShellExecuteExW(&mut execute_info) };
        if launched == 0 {
            let code = unsafe { GetLastError() };
            return Err(PrivilegeMediatorError {
                code: if code == windows_sys::Win32::Foundation::ERROR_CANCELLED {
                    PrivilegeMediatorErrorCode::UacConsentDenied
                } else {
                    PrivilegeMediatorErrorCode::UacLaunchFailed
                },
                operation: Some(operation),
            });
        }

        if execute_info.hProcess.is_null() {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::UacLaunchFailed,
                operation: Some(operation),
            });
        }

        // SAFETY: ShellExecuteExW returned the process handle requested by
        // SEE_MASK_NOCLOSEPROCESS; it remains owned here until CloseHandle.
        let wait_result =
            unsafe { WaitForSingleObject(execute_info.hProcess, UAC_HELPER_TIMEOUT_MS) };
        if wait_result == WAIT_TIMEOUT {
            // SAFETY: the handle is valid and is closed exactly once. The
            // elevated helper is intentionally not force-terminated here;
            // timeout is reported as failure/uncertain to the owning setup
            // workflow, which must reconcile before retrying.
            unsafe { CloseHandle(execute_info.hProcess) };
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::UacTimeout,
                operation: Some(operation),
            });
        }
        if wait_result != WAIT_OBJECT_0 {
            unsafe { CloseHandle(execute_info.hProcess) };
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::UacWaitFailed,
                operation: Some(operation),
            });
        }

        let mut exit_code = 0_u32;
        // SAFETY: the process handle is valid until the following close.
        let exit_read = unsafe { GetExitCodeProcess(execute_info.hProcess, &mut exit_code) };
        unsafe { CloseHandle(execute_info.hProcess) };
        if exit_read == 0 {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::UacWaitFailed,
                operation: Some(operation),
            });
        }
        if exit_code != 0 {
            return Err(PrivilegeMediatorError {
                code: PrivilegeMediatorErrorCode::UacHelperFailed,
                operation: Some(operation),
            });
        }
        Ok(())
    }
}

#[cfg(all(target_os = "windows", not(test)))]
fn wide_null(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(std::iter::once(0)).collect()
}

#[cfg(all(target_os = "windows", not(test)))]
fn windows_parameter_string(arguments: &[String]) -> String {
    arguments
        .iter()
        .map(|argument| {
            let mut quoted = String::with_capacity(argument.len() + 2);
            quoted.push('"');
            let mut backslashes = 0_usize;
            for character in argument.chars() {
                if character == '\\' {
                    backslashes += 1;
                } else if character == '"' {
                    quoted.push_str(&"\\".repeat(backslashes * 2 + 1));
                    quoted.push(character);
                    backslashes = 0;
                } else {
                    if backslashes != 0 {
                        quoted.push_str(&"\\".repeat(backslashes));
                        backslashes = 0;
                    }
                    quoted.push(character);
                }
            }
            if backslashes != 0 {
                quoted.push_str(&"\\".repeat(backslashes * 2));
            }
            quoted.push('"');
            quoted
        })
        .collect::<Vec<_>>()
        .join(" ")
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
        ProviderSetupArguments::new(
            CODEX_CLI_PROVIDER_ID.to_owned(),
            "codex-windows-private".to_owned(),
            "codex-structured-v1".to_owned(),
            vec!["--repair".to_owned()],
        )
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
            ProviderSetupArguments::new(
                format!("{CODEX_CLI_PROVIDER_ID}\0"),
                "codex-windows-private".to_owned(),
                "codex-structured-v1".to_owned(),
                Vec::new(),
            )
            .expect_err("NUL must be rejected")
            .code,
            PrivilegeMediatorErrorCode::InvalidArguments
        );
        assert_eq!(
            ProviderSetupArguments::new(
                CODEX_CLI_PROVIDER_ID.to_owned(),
                "codex-windows-private".to_owned(),
                "codex-structured-v1".to_owned(),
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
        let registry = PrivilegeOperationRegistry::with_provider_setup_repair(
            CODEX_CLI_PROVIDER_ID.to_owned(),
            "codex-windows-private".to_owned(),
            "codex-structured-v1".to_owned(),
            vec!["--repair".to_owned()],
            helper,
        )
        .expect("qualified setup arguments are bounded");
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
        let registry = PrivilegeOperationRegistry::with_provider_setup_repair(
            CODEX_CLI_PROVIDER_ID.to_owned(),
            "codex-windows-private".to_owned(),
            "codex-structured-v1".to_owned(),
            vec!["--repair".to_owned()],
            helper,
        )
        .expect("qualified setup arguments are bounded");
        let mediator = WindowsPrivilegeMediator::from_registry(&registry);

        let error = mediator
            .invoke(PrivilegeOperationId::ProviderSetupRepair, setup_arguments())
            .expect_err("changed helper identity must fail before UAC");
        assert_eq!(
            error.code,
            PrivilegeMediatorErrorCode::HelperIdentityInvalid
        );
    }

    #[test]
    fn provider_identity_mismatch_is_rejected_before_helper_invocation() {
        let helper = QualifiedHelperIdentity::from_installed_file(
            std::env::current_exe().expect("test executable path"),
        )
        .expect("test executable is installed and canonical");
        let registry = PrivilegeOperationRegistry::with_provider_setup_repair(
            CODEX_CLI_PROVIDER_ID.to_owned(),
            "codex-windows-private".to_owned(),
            "codex-structured-v1".to_owned(),
            vec!["--repair".to_owned()],
            helper,
        )
        .expect("qualified setup arguments are bounded");
        let mediator = WindowsPrivilegeMediator::from_registry(&registry);

        let error = mediator
            .invoke(
                PrivilegeOperationId::ProviderSetupRepair,
                ProviderSetupArguments::new(
                    "other-provider".to_owned(),
                    "codex-windows-private".to_owned(),
                    "codex-structured-v1".to_owned(),
                    vec![],
                )
                .unwrap(),
            )
            .expect_err("an operation must not retarget another provider");
        assert_eq!(
            error.code,
            PrivilegeMediatorErrorCode::ProviderIdentityMismatch
        );
    }

    #[test]
    fn distribution_and_interface_identity_mismatches_fail_closed() {
        let helper = QualifiedHelperIdentity::from_installed_file(
            std::env::current_exe().expect("test executable path"),
        )
        .expect("test executable is installed and canonical");
        let registry = PrivilegeOperationRegistry::with_provider_setup_repair(
            CODEX_CLI_PROVIDER_ID.to_owned(),
            "codex-windows-private".to_owned(),
            "codex-structured-v1".to_owned(),
            vec!["--repair".to_owned()],
            helper,
        )
        .expect("qualified setup arguments are bounded");
        let mediator = WindowsPrivilegeMediator::from_registry(&registry);

        let distribution_error = mediator
            .invoke(
                PrivilegeOperationId::ProviderSetupRepair,
                ProviderSetupArguments::new(
                    CODEX_CLI_PROVIDER_ID.to_owned(),
                    "other-distribution".to_owned(),
                    "codex-structured-v1".to_owned(),
                    vec![],
                )
                .unwrap(),
            )
            .expect_err("a changed distribution must not reach UAC");
        assert_eq!(
            distribution_error.code,
            PrivilegeMediatorErrorCode::DistributionIdentityMismatch
        );

        let interface_error = mediator
            .invoke(
                PrivilegeOperationId::ProviderSetupRepair,
                ProviderSetupArguments::new(
                    CODEX_CLI_PROVIDER_ID.to_owned(),
                    "codex-windows-private".to_owned(),
                    "other-interface".to_owned(),
                    vec![],
                )
                .unwrap(),
            )
            .expect_err("a changed interface must not reach UAC");
        assert_eq!(
            interface_error.code,
            PrivilegeMediatorErrorCode::InterfaceIdentityMismatch
        );

        let argument_error = mediator
            .invoke(
                PrivilegeOperationId::ProviderSetupRepair,
                ProviderSetupArguments::new(
                    CODEX_CLI_PROVIDER_ID.to_owned(),
                    "codex-windows-private".to_owned(),
                    "codex-structured-v1".to_owned(),
                    vec!["--unexpected".to_owned()],
                )
                .unwrap(),
            )
            .expect_err("an unqualified argument plan must not reach UAC");
        assert_eq!(
            argument_error.code,
            PrivilegeMediatorErrorCode::ArgumentPlanMismatch
        );
    }
}
