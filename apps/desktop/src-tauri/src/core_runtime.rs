//! Application-owned Core runtime boundary.
//!
//! This module defines the safe launch shape for a later packaged Core. It
//! deliberately does not claim that the current repository contains a release
//! runtime or signed integrity manifest.

use std::collections::BTreeMap;
use std::ffi::OsString;
use std::fmt::{Display, Formatter};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreRuntimeState {
    CoreRuntimeMissing,
    CoreRuntimeIntegrityFailed,
    CoreRuntimeIncompatible,
    CoreEntrypointMissing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoreRuntimeError {
    pub state: CoreRuntimeState,
    pub detail: String,
}

impl Display for CoreRuntimeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{:?}: {}", self.state, self.detail)
    }
}

impl std::error::Error for CoreRuntimeError {}

#[derive(Debug, Clone, Copy, Default)]
pub struct CoreRuntimePolicy;

impl CoreRuntimePolicy {
    pub const fn new() -> Self {
        Self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoreRuntimeLayout {
    release_root: PathBuf,
    node_executable: PathBuf,
    core_entrypoint: PathBuf,
}

impl CoreRuntimeLayout {
    /// Accept only explicit absolute paths supplied by the release layout.
    /// This constructor never searches PATH, the registry, or developer tools.
    pub fn new(
        release_root: PathBuf,
        node_executable: PathBuf,
        core_entrypoint: PathBuf,
    ) -> Result<Self, CoreRuntimeError> {
        if !release_root.is_absolute()
            || !node_executable.is_absolute()
            || !core_entrypoint.is_absolute()
            || !node_executable.starts_with(&release_root)
            || !core_entrypoint.starts_with(&release_root)
        {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIncompatible,
                "release-owned runtime paths must be absolute children of release_root",
            ));
        }

        if node_executable.file_name().and_then(|name| name.to_str()) != Some("node.exe") {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIncompatible,
                "Windows Core runtime executable must be the release-owned node.exe",
            ));
        }

        Ok(Self {
            release_root,
            node_executable,
            core_entrypoint,
        })
    }

    /// Validate the release-owned structure before any process can be built.
    /// Cryptographic manifest verification remains a separate release gate.
    pub fn validate_structure(&self) -> Result<(), CoreRuntimeError> {
        if !self.release_root.is_dir() || !self.node_executable.exists() {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeMissing,
                "release-owned Node runtime is missing",
            ));
        }
        if !self.core_entrypoint.exists() {
            return Err(Self::error(
                CoreRuntimeState::CoreEntrypointMissing,
                "release-owned Core entrypoint is missing",
            ));
        }
        if !self.node_executable.is_file() || !self.core_entrypoint.is_file() {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "release-owned runtime paths are not regular files",
            ));
        }
        Ok(())
    }

    /// Build an explicit environment allowlist for the later Core launch.
    /// User-controlled Node execution modifiers are never copied through.
    pub fn controlled_environment(&self) -> Result<BTreeMap<OsString, OsString>, CoreRuntimeError> {
        self.validate_structure()?;
        Ok(BTreeMap::from([
            (
                OsString::from("JARVIS_CORE_ROOT"),
                self.release_root.as_os_str().to_os_string(),
            ),
            (
                OsString::from("JARVIS_CORE_ENTRYPOINT"),
                self.core_entrypoint.as_os_str().to_os_string(),
            ),
        ]))
    }

    /// Construct a command from the exact absolute runtime path. The caller
    /// must still perform signed-manifest/integrity and protocol checks before
    /// spawning the process in the later startup subsections.
    pub fn controlled_command(&self) -> Result<Command, CoreRuntimeError> {
        let environment = self.controlled_environment()?;
        let mut command = Command::new(&self.node_executable);
        command
            .arg(&self.core_entrypoint)
            .current_dir(&self.release_root)
            .env_clear();
        for (key, value) in environment {
            command.env(key, value);
        }
        Ok(command)
    }

    fn error(state: CoreRuntimeState, detail: &str) -> CoreRuntimeError {
        CoreRuntimeError {
            state,
            detail: detail.to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;
    use std::fs::{create_dir_all, remove_dir_all, write};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_layout() -> (PathBuf, CoreRuntimeLayout) {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("test clock must be after Unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("jarvis-core-runtime-{suffix}"));
        let node = root.join("runtime").join("node.exe");
        let entrypoint = root.join("core").join("dist").join("main.js");
        let layout = CoreRuntimeLayout::new(root.clone(), node, entrypoint)
            .expect("test paths must be explicit release-owned children");
        (root, layout)
    }

    #[test]
    fn relative_and_outside_runtime_paths_fail_closed() {
        let relative = CoreRuntimeLayout::new(
            PathBuf::from("release"),
            PathBuf::from("release/node.exe"),
            PathBuf::from("release/core.js"),
        )
        .expect_err("relative paths must fail");
        assert_eq!(relative.state, CoreRuntimeState::CoreRuntimeIncompatible);

        let outside = CoreRuntimeLayout::new(
            PathBuf::from(r"C:\release"),
            PathBuf::from(r"C:\other\node.exe"),
            PathBuf::from(r"C:\release\core.js"),
        )
        .expect_err("outside runtime paths must fail");
        assert_eq!(outside.state, CoreRuntimeState::CoreRuntimeIncompatible);
    }

    #[test]
    fn missing_runtime_reports_typed_state() {
        let (root, layout) = test_layout();
        let error = layout
            .validate_structure()
            .expect_err("missing release runtime must fail");
        assert_eq!(error.state, CoreRuntimeState::CoreRuntimeMissing);
        assert!(!root.exists());
    }

    #[cfg(windows)]
    #[test]
    fn controlled_command_uses_absolute_runtime_and_removes_node_modifiers() {
        let (root, layout) = test_layout();
        create_dir_all(root.join("runtime")).expect("runtime directory must be creatable");
        create_dir_all(root.join("core").join("dist")).expect("core directory must be creatable");
        write(root.join("runtime").join("node.exe"), b"synthetic node")
            .expect("synthetic runtime must be writable");
        write(
            root.join("core").join("dist").join("main.js"),
            b"synthetic core",
        )
        .expect("synthetic entrypoint must be writable");

        let command = layout
            .controlled_command()
            .expect("complete release structure must build a controlled command");
        assert_eq!(command.get_program(), root.join("runtime").join("node.exe"));
        assert!(
            command
                .get_args()
                .any(|argument| argument == root.join("core").join("dist").join("main.js"))
        );
        let environment: Vec<_> = command.get_envs().collect();
        assert!(
            environment
                .iter()
                .any(|(key, _)| *key == OsStr::new("JARVIS_CORE_ROOT"))
        );
        assert!(!environment.iter().any(|(key, _)| {
            *key == OsStr::new("NODE_OPTIONS") || *key == OsStr::new("NODE_PATH")
        }));

        remove_dir_all(root).expect("test runtime directory must be removable");
    }
}
