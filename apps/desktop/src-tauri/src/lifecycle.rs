//! Windows desktop lifecycle ownership and application data paths.
//!
//! This is the bounded 1.4 foundation. It does not authorize Core startup or
//! claim the later secure IPC/process/recovery guarantees.

use std::fs::{File, OpenOptions, create_dir_all};
use std::io;
use std::path::{Path, PathBuf};

#[cfg(windows)]
use std::os::windows::fs::OpenOptionsExt;

const APPLICATION_DIRECTORY: &str = "JARVIS";

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
    /// Resolve the fixed per-user root without a temporary, current-directory,
    /// or PATH-based fallback.
    pub fn from_local_app_data() -> io::Result<Self> {
        let local_app_data = std::env::var_os("LOCALAPPDATA").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "LOCALAPPDATA is required for the JARVIS application data root",
            )
        })?;
        let root = PathBuf::from(local_app_data).join(APPLICATION_DIRECTORY);

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
