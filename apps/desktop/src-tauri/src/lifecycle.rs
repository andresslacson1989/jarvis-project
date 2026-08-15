//! Windows desktop lifecycle ownership and application data paths.
//!
//! This is the bounded 1.4 foundation. It does not authorize Core startup or
//! claim the later secure IPC/process/recovery guarantees.

use std::fs::{File, OpenOptions, create_dir_all};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

#[cfg(windows)]
use std::os::windows::fs::OpenOptionsExt;

const APPLICATION_DIRECTORY: &str = "JARVIS";
pub const RECOVERY_REQUIRED_MARKER: &[u8] = b"JARVIS_RECOVERY_REQUIRED_V1\n";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BootstrapStage {
    InstanceOwnership,
    NativeDiagnosticsInitialized,
    LockedSession,
    BootstrapConfigurationValidated,
    SecureStorageBoundaryRegistered,
    RuntimeIntegrityVerified,
    LocalIpcEndpointBound,
    BootstrapSecretTransferred,
    CoreContained,
    CoreAuthenticated,
}

impl BootstrapStage {
    const fn ordinal(self) -> usize {
        match self {
            Self::InstanceOwnership => 0,
            Self::NativeDiagnosticsInitialized => 1,
            Self::LockedSession => 2,
            Self::BootstrapConfigurationValidated => 3,
            Self::SecureStorageBoundaryRegistered => 4,
            Self::RuntimeIntegrityVerified => 5,
            Self::LocalIpcEndpointBound => 6,
            Self::BootstrapSecretTransferred => 7,
            Self::CoreContained => 8,
            Self::CoreAuthenticated => 9,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BootstrapCondition {
    Locked,
    Degraded,
    RepairRequired,
    RecoveryRequired,
}

impl BootstrapCondition {
    pub const fn startup_query_value(self) -> &'static str {
        match self {
            Self::Locked => "LOCKED",
            Self::Degraded => "DEGRADED",
            Self::RepairRequired => "REPAIR_REQUIRED",
            Self::RecoveryRequired => "RECOVERY_REQUIRED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BootstrapOrderingError {
    pub expected: Option<BootstrapStage>,
    pub received: BootstrapStage,
}

impl std::fmt::Display for BootstrapOrderingError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "bootstrap stage ordering violation: expected {:?}, received {:?}",
            self.expected, self.received
        )
    }
}

impl std::error::Error for BootstrapOrderingError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BootstrapLedger {
    next_ordinal: usize,
    condition: BootstrapCondition,
}

impl BootstrapLedger {
    pub const fn new() -> Self {
        Self {
            next_ordinal: 0,
            condition: BootstrapCondition::Locked,
        }
    }

    pub fn record(&mut self, stage: BootstrapStage) -> Result<(), BootstrapOrderingError> {
        if self.condition == BootstrapCondition::RepairRequired {
            return Err(BootstrapOrderingError {
                expected: None,
                received: stage,
            });
        }

        if stage.ordinal() != self.next_ordinal {
            return Err(BootstrapOrderingError {
                expected: BOOTSTRAP_STAGES.get(self.next_ordinal).copied(),
                received: stage,
            });
        }

        self.next_ordinal += 1;
        Ok(())
    }

    pub fn record_secure_storage(
        &mut self,
        available_and_qualified: bool,
    ) -> Result<(), BootstrapOrderingError> {
        self.record(BootstrapStage::SecureStorageBoundaryRegistered)?;
        if !available_and_qualified {
            self.condition = BootstrapCondition::Degraded;
        }
        Ok(())
    }

    pub fn mark_recovery_required(&mut self) {
        if self.condition == BootstrapCondition::Locked {
            self.condition = BootstrapCondition::RecoveryRequired;
        }
    }

    #[cfg_attr(debug_assertions, allow(dead_code))]
    pub fn mark_repair_required(&mut self) {
        self.condition = BootstrapCondition::RepairRequired;
    }

    pub const fn condition(self) -> BootstrapCondition {
        self.condition
    }
}

impl Default for BootstrapLedger {
    fn default() -> Self {
        Self::new()
    }
}

const BOOTSTRAP_STAGES: [BootstrapStage; 10] = [
    BootstrapStage::InstanceOwnership,
    BootstrapStage::NativeDiagnosticsInitialized,
    BootstrapStage::LockedSession,
    BootstrapStage::BootstrapConfigurationValidated,
    BootstrapStage::SecureStorageBoundaryRegistered,
    BootstrapStage::RuntimeIntegrityVerified,
    BootstrapStage::LocalIpcEndpointBound,
    BootstrapStage::BootstrapSecretTransferred,
    BootstrapStage::CoreContained,
    BootstrapStage::CoreAuthenticated,
];

#[derive(Debug)]
pub struct BootstrapDiagnostics {
    file: File,
}

impl BootstrapDiagnostics {
    pub fn initialize(log_directory: &Path) -> io::Result<Self> {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_directory.join("bootstrap.log"))?;
        Ok(Self { file })
    }

    /// Write only bounded, non-secret lifecycle facts and force them through
    /// the file handle before the next bootstrap boundary is attempted.
    pub fn record(
        &mut self,
        stage: BootstrapStage,
        condition: BootstrapCondition,
    ) -> io::Result<()> {
        writeln!(self.file, "stage={stage:?};condition={condition:?}")?;
        self.file.sync_data()
    }

    #[cfg_attr(debug_assertions, allow(dead_code))]
    pub fn record_failure(&mut self, code: &'static str) -> io::Result<()> {
        writeln!(self.file, "failure={code}")?;
        self.file.sync_data()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplicationPaths {
    pub root: PathBuf,
    pub data: PathBuf,
    pub backups: PathBuf,
    pub logs: PathBuf,
    pub cache: PathBuf,
    pub artifacts: PathBuf,
    pub modules: PathBuf,
    pub updates: PathBuf,
    pub recovery: PathBuf,
}

impl ApplicationPaths {
    pub fn from_root(root: PathBuf) -> io::Result<Self> {
        if !root.is_absolute() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "JARVIS application root must be absolute",
            ));
        }
        Ok(Self {
            data: root.join("data"),
            backups: root.join("backups"),
            logs: root.join("logs"),
            cache: root.join("cache"),
            artifacts: root.join("artifacts"),
            modules: root.join("modules"),
            updates: root.join("updates"),
            recovery: root.join("recovery"),
            root,
        })
    }

    /// Resolve the fixed per-user root without a temporary, current-directory,
    /// or PATH-based fallback.
    #[allow(dead_code)]
    pub fn from_local_app_data() -> io::Result<Self> {
        let local_app_data = std::env::var_os("LOCALAPPDATA").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "LOCALAPPDATA is required for the JARVIS application data root",
            )
        })?;
        let root = PathBuf::from(local_app_data).join(APPLICATION_DIRECTORY);
        Self::from_root(root)
    }

    pub fn ensure_root(&self) -> io::Result<()> {
        create_dir_all(&self.root)
    }

    pub fn ensure_layout(&self) -> io::Result<()> {
        for directory in [
            &self.data,
            &self.backups,
            &self.logs,
            &self.cache,
            &self.artifacts,
            &self.modules,
            &self.updates,
            &self.recovery,
        ] {
            create_dir_all(directory)?;
        }
        Ok(())
    }

    fn instance_lock_path(&self) -> PathBuf {
        self.root.join("instance.lock")
    }

    #[allow(dead_code)]
    fn maintenance_lock_path(&self) -> PathBuf {
        self.root.join("maintenance.lock")
    }

    pub fn recovery_marker_state(&self) -> io::Result<RecoveryMarkerState> {
        let path = self.recovery.join("restore-required.marker");
        match std::fs::read(path) {
            Ok(contents) if contents == RECOVERY_REQUIRED_MARKER => Ok(RecoveryMarkerState::Valid),
            Ok(_) => Ok(RecoveryMarkerState::Invalid),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                Ok(RecoveryMarkerState::Missing)
            }
            Err(error) => Err(error),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecoveryMarkerState {
    Missing,
    Valid,
    Invalid,
}

#[derive(Debug)]
struct ExclusiveFileLock {
    _file: File,
}

impl ExclusiveFileLock {
    fn acquire(path: &Path) -> io::Result<Self> {
        let mut options = OpenOptions::new();
        options.create(true).read(true).write(true);

        // Windows keeps this handle exclusive across processes. The handle
        // closes on normal drop and when the owning process terminates.
        #[cfg(windows)]
        options.share_mode(0);

        Ok(Self {
            _file: options.open(path)?,
        })
    }
}

#[derive(Debug)]
pub struct InstanceOwnership {
    _lock: ExclusiveFileLock,
}

impl InstanceOwnership {
    pub fn acquire(paths: &ApplicationPaths) -> io::Result<Self> {
        Ok(Self {
            _lock: ExclusiveFileLock::acquire(&paths.instance_lock_path())?,
        })
    }
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct MaintenanceLock {
    _lock: ExclusiveFileLock,
}

impl MaintenanceLock {
    #[allow(dead_code)]
    pub fn acquire(paths: &ApplicationPaths) -> io::Result<Self> {
        Ok(Self {
            _lock: ExclusiveFileLock::acquire(&paths.maintenance_lock_path())?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_paths() -> ApplicationPaths {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("test clock must be after Unix epoch")
            .as_nanos();
        let root = std::env::temp_dir()
            .join(format!("jarvis-lifecycle-{suffix}"))
            .join(APPLICATION_DIRECTORY);
        ApplicationPaths {
            data: root.join("data"),
            backups: root.join("backups"),
            logs: root.join("logs"),
            cache: root.join("cache"),
            artifacts: root.join("artifacts"),
            modules: root.join("modules"),
            updates: root.join("updates"),
            recovery: root.join("recovery"),
            root,
        }
    }

    #[test]
    fn layout_is_stable_and_contains_recovery() {
        let paths = test_paths();
        assert!(paths.root.ends_with(APPLICATION_DIRECTORY));
        assert!(paths.recovery.ends_with("recovery"));
    }

    #[test]
    fn instance_and_maintenance_locks_use_distinct_paths() {
        let paths = test_paths();
        assert_ne!(paths.instance_lock_path(), paths.maintenance_lock_path());
    }

    #[test]
    fn bootstrap_ledger_enforces_contract_order_and_degraded_secure_storage() {
        let mut ledger = BootstrapLedger::new();
        assert_eq!(
            ledger.record(BootstrapStage::LockedSession),
            Err(BootstrapOrderingError {
                expected: Some(BootstrapStage::InstanceOwnership),
                received: BootstrapStage::LockedSession,
            })
        );
        for stage in [
            BootstrapStage::InstanceOwnership,
            BootstrapStage::NativeDiagnosticsInitialized,
            BootstrapStage::LockedSession,
            BootstrapStage::BootstrapConfigurationValidated,
        ] {
            ledger
                .record(stage)
                .expect("bootstrap stage must be ordered");
        }
        ledger
            .record_secure_storage(false)
            .expect("secure-storage boundary registration is ordered");
        assert_eq!(ledger.condition(), BootstrapCondition::Degraded);
        assert_eq!(ledger.condition().startup_query_value(), "DEGRADED");
        ledger.mark_recovery_required();
        assert_eq!(ledger.condition(), BootstrapCondition::Degraded);
        ledger.mark_repair_required();
        assert_eq!(ledger.condition(), BootstrapCondition::RepairRequired);
        assert!(
            ledger
                .record(BootstrapStage::RuntimeIntegrityVerified)
                .is_err()
        );
    }

    #[test]
    fn recovery_marker_is_exact_and_fail_closed() {
        let paths = test_paths();
        paths
            .ensure_layout()
            .expect("test layout must be creatable");
        assert_eq!(
            paths.recovery_marker_state().unwrap(),
            RecoveryMarkerState::Missing
        );
        std::fs::write(
            paths.recovery.join("restore-required.marker"),
            RECOVERY_REQUIRED_MARKER,
        )
        .expect("valid marker must be writable");
        assert_eq!(
            paths.recovery_marker_state().unwrap(),
            RecoveryMarkerState::Valid
        );
        std::fs::write(
            paths.recovery.join("restore-required.marker"),
            b"RECOVERY_REQUIRED",
        )
        .expect("invalid marker must be writable");
        assert_eq!(
            paths.recovery_marker_state().unwrap(),
            RecoveryMarkerState::Invalid
        );
        std::fs::remove_dir_all(paths.root.parent().expect("test root has parent"))
            .expect("test directory must be removable");
    }

    #[test]
    fn authenticated_recovery_condition_is_explicit_and_startup_visible() {
        let mut ledger = BootstrapLedger::new();
        for stage in [
            BootstrapStage::InstanceOwnership,
            BootstrapStage::NativeDiagnosticsInitialized,
            BootstrapStage::LockedSession,
            BootstrapStage::BootstrapConfigurationValidated,
        ] {
            ledger
                .record(stage)
                .expect("bootstrap stage must be ordered");
        }
        ledger
            .record_secure_storage(true)
            .expect("qualified secure storage must be recorded");
        ledger.mark_recovery_required();
        assert_eq!(ledger.condition(), BootstrapCondition::RecoveryRequired);
        assert_eq!(
            ledger.condition().startup_query_value(),
            "RECOVERY_REQUIRED"
        );
    }

    #[test]
    fn bootstrap_diagnostics_record_only_bounded_lifecycle_facts() {
        let paths = test_paths();
        paths
            .ensure_layout()
            .expect("test layout must be creatable");
        let mut diagnostics = BootstrapDiagnostics::initialize(&paths.logs)
            .expect("bootstrap diagnostics must initialize");
        diagnostics
            .record(BootstrapStage::LockedSession, BootstrapCondition::Degraded)
            .expect("bootstrap diagnostic must flush");
        diagnostics
            .record_failure("CORE_RUNTIME_PREFLIGHT_FAILED")
            .expect("bootstrap failure diagnostic must flush");
        let contents = std::fs::read_to_string(paths.logs.join("bootstrap.log"))
            .expect("diagnostic file must be readable");
        assert_eq!(
            contents,
            "stage=LockedSession;condition=Degraded\nfailure=CORE_RUNTIME_PREFLIGHT_FAILED\n"
        );
        std::fs::remove_dir_all(paths.root.parent().expect("test root has parent"))
            .expect("test directory must be removable");
    }

    #[cfg(windows)]
    #[test]
    fn instance_lock_is_exclusive_until_owner_is_dropped() {
        let paths = test_paths();
        paths.ensure_root().expect("test root must be creatable");

        let owner = InstanceOwnership::acquire(&paths).expect("first owner must acquire");
        assert!(InstanceOwnership::acquire(&paths).is_err());
        drop(owner);
        assert!(InstanceOwnership::acquire(&paths).is_ok());

        std::fs::remove_dir_all(paths.root.parent().expect("test root has parent"))
            .expect("test directory must be removable");
    }
}
