//! Semantic Windows native-capability composition.
//!
//! This is a capability/status broker, not an operating-system shell.  It
//! returns stable semantic facts and exposes only typed operations owned by a
//! later capability subsection.  Native handles, executable paths, command
//! strings, and provider-native objects do not cross this boundary.

use crate::privilege_mediator::{
    CapabilityAvailability as PrivilegeAvailability,
    CapabilityQualification as PrivilegeQualification, PrivilegeMediatorError,
    PrivilegeOperationId, PrivilegeOperationRegistry, ProviderSetupArguments,
    WindowsPrivilegeMediator,
};
use crate::secure_storage::{
    BackupDek, CredentialContext, CredentialSecret, DatabaseDek, SecureStorageHandle,
    WindowsSecureStorage, WindowsSecureStorageError,
};
use crate::session_system::{
    CapabilityAvailability as SessionAvailability, CapabilityQualification as SessionQualification,
    PlatformSessionObserver, SessionObservation, WindowsPlatformError,
};
use std::path::{Path, PathBuf};

pub const NATIVE_BROKER_CAPABILITY: &str = "native_broker";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum NativeCapabilityId {
    SecureStorage,
    ManagedProcessTree,
    NativeWindowControl,
    SessionLockObservation,
    PlatformUpdate,
    VoiceCapture,
    VoiceOutput,
    PrivilegeMediation,
}

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
pub struct NativeCapabilityStatus {
    pub capability: NativeCapabilityId,
    pub availability: CapabilityAvailability,
    pub qualification: CapabilityQualification,
}

/// Typed Windows current-user DPAPI boundary. Core receives only opaque
/// handles in durable state and transient key bytes through an owning call.
#[derive(Debug, Default, Clone)]
pub struct WindowsSecureStorageBoundary {
    backend: Option<WindowsSecureStorage>,
}

impl WindowsSecureStorageBoundary {
    pub const fn new() -> Self {
        Self { backend: None }
    }

    pub fn from_root(root: PathBuf) -> Result<Self, WindowsSecureStorageError> {
        Ok(Self {
            backend: Some(WindowsSecureStorage::open(root)?),
        })
    }

    pub fn clone_for_typed_operation(&self) -> Self {
        self.clone()
    }

    pub const fn capability_status(&self) -> NativeCapabilityStatus {
        if self.backend.is_some() {
            NativeCapabilityStatus::qualified(NativeCapabilityId::SecureStorage)
        } else {
            NativeCapabilityStatus::unavailable(NativeCapabilityId::SecureStorage)
        }
    }

    pub fn create_db_dek(
        &self,
    ) -> Result<(SecureStorageHandle, DatabaseDek), WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .create_db_dek()
    }

    pub fn protect_db_dek(
        &self,
        db_dek: &[u8; 32],
    ) -> Result<SecureStorageHandle, WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .protect_db_dek(db_dek)
    }

    pub fn publish_db_dek_handle(
        &self,
        handle_path: &Path,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .publish_db_dek_handle(handle_path, handle)
    }

    pub fn stage_db_dek_handle(
        &self,
        handle_path: &Path,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .stage_db_dek_handle(handle_path, handle)
    }

    pub fn commit_staged_db_dek_handle(
        &self,
        handle_path: &Path,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .commit_staged_db_dek_handle(handle_path, handle)
    }

    pub fn discard_staged_db_dek_handle(
        &self,
        handle_path: &Path,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .discard_staged_db_dek_handle(handle_path, handle)
    }

    pub fn open_db_dek(
        &self,
        handle: &SecureStorageHandle,
    ) -> Result<DatabaseDek, WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .open_db_dek(handle)
    }

    pub fn open_or_create_db_dek(
        &self,
        handle_path: &Path,
        database_path: &Path,
    ) -> Result<(SecureStorageHandle, DatabaseDek), WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .open_or_create_db_dek(handle_path, database_path)
    }

    pub fn protect_backup_dek(
        &self,
        backup_dek: &[u8; 32],
        additional_entropy: &[u8],
    ) -> Result<Vec<u8>, WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .protect_backup_dek(backup_dek, additional_entropy)
    }

    pub fn unprotect_backup_dek(
        &self,
        protected: &[u8],
        additional_entropy: &[u8],
    ) -> Result<BackupDek, WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .unprotect_backup_dek(protected, additional_entropy)
    }

    pub fn put_secret(
        &self,
        context: &CredentialContext,
        value: &[u8],
    ) -> Result<SecureStorageHandle, WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .put_secret(context, value)
    }

    pub fn get_secret(
        &self,
        handle: &SecureStorageHandle,
        context: &CredentialContext,
    ) -> Result<CredentialSecret, WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .get_secret(handle, context)
    }

    pub fn rotate_secret(
        &self,
        previous: &SecureStorageHandle,
        context: &CredentialContext,
        replacement: &[u8],
    ) -> Result<SecureStorageHandle, WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .rotate_secret(previous, context, replacement)
    }

    pub fn delete_secret(
        &self,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .delete_secret(handle)
    }

    pub fn rotate_db_dek(
        &self,
        previous: &SecureStorageHandle,
    ) -> Result<(SecureStorageHandle, DatabaseDek), WindowsSecureStorageError> {
        self.backend
            .as_ref()
            .ok_or(WindowsSecureStorageError::InvalidRoot(
                "secure storage is not registered",
            ))?
            .rotate_db_dek(previous)
    }
}

impl NativeCapabilityStatus {
    const fn qualified(capability: NativeCapabilityId) -> Self {
        Self {
            capability,
            availability: CapabilityAvailability::Available,
            qualification: CapabilityQualification::Qualified,
        }
    }

    const fn unavailable(capability: NativeCapabilityId) -> Self {
        Self {
            capability,
            availability: CapabilityAvailability::Unavailable,
            qualification: CapabilityQualification::Unqualified,
        }
    }
}

#[derive(Debug, Default)]
pub struct WindowsNativeBroker {
    secure_storage: WindowsSecureStorageBoundary,
    session_observer: PlatformSessionObserver,
    privilege_mediator: WindowsPrivilegeMediator,
}

impl WindowsNativeBroker {
    pub const fn new() -> Self {
        Self {
            secure_storage: WindowsSecureStorageBoundary::new(),
            session_observer: PlatformSessionObserver::new(),
            privilege_mediator: WindowsPrivilegeMediator::new(),
        }
    }

    pub fn with_secure_storage_root(root: PathBuf) -> Result<Self, WindowsSecureStorageError> {
        Ok(Self {
            secure_storage: WindowsSecureStorageBoundary::from_root(root)?,
            session_observer: PlatformSessionObserver::new(),
            privilege_mediator: WindowsPrivilegeMediator::new(),
        })
    }

    pub const fn with_idle_timeout_millis(idle_timeout_millis: u64) -> Self {
        Self {
            secure_storage: WindowsSecureStorageBoundary::new(),
            session_observer: PlatformSessionObserver::with_idle_timeout_millis(
                idle_timeout_millis,
            ),
            privilege_mediator: WindowsPrivilegeMediator::new(),
        }
    }

    /// Compose a provider-qualified setup registry into the broker without
    /// exposing executable paths or a generic elevated command surface.
    /// Callers must obtain the registry from the provider qualification flow;
    /// the default constructors remain fail-closed and unqualified.
    pub fn with_privilege_registry(mut self, registry: &PrivilegeOperationRegistry) -> Self {
        self.privilege_mediator = WindowsPrivilegeMediator::from_registry(registry);
        self
    }

    pub fn configure_privilege_registry(&mut self, registry: &PrivilegeOperationRegistry) {
        self.privilege_mediator = WindowsPrivilegeMediator::from_registry(registry);
    }

    /// The only elevated operation exposed by this broker is the typed
    /// provider setup/repair request. No executable path, shell text, or
    /// arbitrary operation can cross the native boundary.
    pub fn invoke_provider_setup_repair(
        &self,
        arguments: ProviderSetupArguments,
    ) -> Result<(), PrivilegeMediatorError> {
        self.privilege_mediator
            .invoke(PrivilegeOperationId::ProviderSetupRepair, arguments)
    }

    /// Discover a semantic capability fact. A capability fact never grants
    /// action authority; callers must still use their owning policy boundary.
    pub fn capability_status(&mut self, capability: NativeCapabilityId) -> NativeCapabilityStatus {
        match capability {
            NativeCapabilityId::SecureStorage => self.secure_storage.capability_status(),
            NativeCapabilityId::PlatformUpdate
            | NativeCapabilityId::VoiceCapture
            | NativeCapabilityId::VoiceOutput => NativeCapabilityStatus::unavailable(capability),
            NativeCapabilityId::ManagedProcessTree | NativeCapabilityId::NativeWindowControl => {
                NativeCapabilityStatus::qualified(capability)
            }
            NativeCapabilityId::SessionLockObservation => {
                map_session_status(capability, self.session_observer.capability_status())
            }
            NativeCapabilityId::PrivilegeMediation => {
                map_privilege_status(capability, self.privilege_mediator.capability_status())
            }
        }
    }

    pub fn observe_session(&mut self) -> Result<SessionObservation, WindowsPlatformError> {
        self.session_observer.observe()
    }

    /// Open the current profile's opaque DB_DEK handle, or create the first
    /// one only when the authoritative database does not exist.
    pub fn open_or_create_db_dek(
        &self,
        handle_path: &std::path::Path,
        database_path: &std::path::Path,
    ) -> Result<(SecureStorageHandle, DatabaseDek), WindowsSecureStorageError> {
        self.secure_storage
            .open_or_create_db_dek(handle_path, database_path)
    }

    pub fn secure_storage_boundary(&self) -> WindowsSecureStorageBoundary {
        self.secure_storage.clone_for_typed_operation()
    }
}

fn map_session_status(
    capability: NativeCapabilityId,
    status: crate::session_system::CapabilityStatus,
) -> NativeCapabilityStatus {
    NativeCapabilityStatus {
        capability,
        availability: match status.availability {
            SessionAvailability::Available => CapabilityAvailability::Available,
            SessionAvailability::Unavailable => CapabilityAvailability::Unavailable,
        },
        qualification: match status.qualification {
            SessionQualification::Qualified => CapabilityQualification::Qualified,
            SessionQualification::Unqualified => CapabilityQualification::Unqualified,
        },
    }
}

fn map_privilege_status(
    capability: NativeCapabilityId,
    status: crate::privilege_mediator::CapabilityStatus,
) -> NativeCapabilityStatus {
    NativeCapabilityStatus {
        capability,
        availability: match status.availability {
            PrivilegeAvailability::Available => CapabilityAvailability::Available,
            PrivilegeAvailability::Unavailable => CapabilityAvailability::Unavailable,
        },
        qualification: match status.qualification {
            PrivilegeQualification::Qualified => CapabilityQualification::Qualified,
            PrivilegeQualification::Unqualified => CapabilityQualification::Unqualified,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn broker_surface_is_typed_and_has_no_generic_command_capability() {
        let mut broker = WindowsNativeBroker::new();
        let managed = broker.capability_status(NativeCapabilityId::ManagedProcessTree);
        assert_eq!(managed.availability, CapabilityAvailability::Available);
        assert_eq!(managed.qualification, CapabilityQualification::Qualified);

        let secure = broker.capability_status(NativeCapabilityId::SecureStorage);
        assert_eq!(secure.availability, CapabilityAvailability::Unavailable);
        assert_eq!(secure.qualification, CapabilityQualification::Unqualified);
    }

    #[test]
    fn unavailable_backends_do_not_report_as_ready() {
        let mut broker = WindowsNativeBroker::new();
        for capability in [
            NativeCapabilityId::PlatformUpdate,
            NativeCapabilityId::VoiceCapture,
            NativeCapabilityId::VoiceOutput,
            NativeCapabilityId::PrivilegeMediation,
        ] {
            let status = broker.capability_status(capability);
            assert_eq!(status.capability, capability);
            assert_ne!(
                (status.availability, status.qualification),
                (
                    CapabilityAvailability::Available,
                    CapabilityQualification::Qualified
                )
            );
        }
    }

    #[test]
    fn qualified_privilege_registry_is_composed_without_becoming_qualified_uac() {
        let helper = crate::privilege_mediator::QualifiedHelperIdentity::from_installed_file(
            std::env::current_exe().expect("test executable path"),
        )
        .expect("test executable is installed and canonical");
        let registry = PrivilegeOperationRegistry::with_provider_setup_repair(
            crate::privilege_mediator::CODEX_CLI_PROVIDER_ID.to_owned(),
            "codex-windows-private".to_owned(),
            "codex-structured-v1".to_owned(),
            vec!["--repair".to_owned()],
            helper,
        )
        .expect("qualified setup registration must be bounded");
        let mut broker = WindowsNativeBroker::new().with_privilege_registry(&registry);
        let status = broker.capability_status(NativeCapabilityId::PrivilegeMediation);
        assert_eq!(status.availability, CapabilityAvailability::Available);
        assert_eq!(status.qualification, CapabilityQualification::Unqualified);
    }

    #[test]
    fn session_observation_remains_a_typed_semantic_operation() {
        let mut broker = WindowsNativeBroker::new();
        let result = broker.observe_session();
        if let Ok(observation) = result {
            assert!(matches!(
                observation.stable_state,
                crate::session_system::SessionTrustState::Locked
                    | crate::session_system::SessionTrustState::Unlocked
            ));
        }
    }

    #[cfg(windows)]
    #[test]
    fn qualified_secure_storage_round_trips_and_rotates_db_dek() {
        let root =
            std::env::temp_dir().join(format!("jarvis-secure-storage-{}", std::process::id()));
        let broker = WindowsNativeBroker::with_secure_storage_root(root.clone())
            .expect("current-user secure storage should initialize");
        let status = broker.secure_storage.capability_status();
        assert_eq!(status.availability, CapabilityAvailability::Available);
        assert_eq!(status.qualification, CapabilityQualification::Qualified);
        let (handle, key) = broker
            .secure_storage
            .create_db_dek()
            .expect("DB_DEK should be protected");
        let recovered = broker
            .secure_storage
            .open_db_dek(&handle)
            .expect("DB_DEK should be recoverable for the current user");
        assert_eq!(recovered.as_bytes(), key.as_bytes());
        let (rotated_handle, rotated_key) = broker
            .secure_storage
            .rotate_db_dek(&handle)
            .expect("DB_DEK should rotate");
        assert_ne!(rotated_handle, handle);
        assert_ne!(rotated_key.as_bytes(), key.as_bytes());
        assert!(broker.secure_storage.open_db_dek(&handle).is_err());
        broker
            .secure_storage
            .backend
            .as_ref()
            .expect("secure storage backend")
            .delete(&rotated_handle)
            .expect("rotated handle should delete");
        let _ = std::fs::remove_dir_all(root);
    }
}
