//! Application-owned Core runtime boundary.
//!
//! This module defines the safe launch shape for a later packaged Core. It
//! deliberately does not claim that the current repository contains a release
//! runtime or signed integrity manifest.

use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::fmt::{Display, Formatter};
use std::fs::{canonicalize, read, symlink_metadata, File, Metadata};
use std::io::{self, BufReader, Read};
use std::path::{Component, Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const RELEASE_RUNTIME_DIRECTORY: &str = "core-runtime";
pub const V1_NODE_VERSION: &str = "24.18.0";
pub const V1_RELEASE_TARGET: &str = "WINDOWS_FULL_HOST_X64";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoreRuntimeState {
    CoreRuntimeMissing,
    CoreRuntimeIntegrityFailed,
    CoreRuntimeIncompatible,
    CoreEntrypointMissing,
    CoreStartFailed,
    CoreProtocolIncompatible,
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

    /// Resolve and verify the runtime unit placed in the Tauri resource
    /// directory by the release packager. This is a preflight only; spawning
    /// remains owned by the qualified process-supervisor boundary.
    pub fn load_verified_layout(
        &self,
        resource_dir: PathBuf,
    ) -> Result<CoreRuntimeLayout, CoreRuntimeError> {
        let release_root = resource_dir.join(RELEASE_RUNTIME_DIRECTORY);
        let layout = CoreRuntimeLayout::new(
            release_root.clone(),
            release_root.join("runtime").join("node.exe"),
            release_root.join("core").join("dist").join("main.js"),
        )?;
        layout.validate_integrity(&release_root.join("runtime-manifest.json"))?;
        Ok(layout)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoreRuntimeLayout {
    release_root: PathBuf,
    node_executable: PathBuf,
    core_entrypoint: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CoreLaunchSpec {
    pub(crate) program: PathBuf,
    pub(crate) arguments: Vec<OsString>,
    pub(crate) current_dir: PathBuf,
    pub(crate) environment: BTreeMap<OsString, OsString>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuntimeIntegrityManifest {
    pub manifest_version: u32,
    pub jarvis_release_version: String,
    pub core_version: String,
    pub target: String,
    pub protocol_version: u32,
    pub minimum_data_schema_version: u32,
    pub maximum_data_schema_version: u32,
    pub schema_version: u32,
    pub platform: String,
    pub runtime_role: String,
    pub architecture: String,
    pub node_version: String,
    pub protocol_major: u32,
    pub node_path: String,
    pub core_entrypoint: String,
    pub node_sha256: String,
    pub core_sha256: String,
    #[serde(default)]
    pub core_support_files: Vec<RuntimeSupportFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuntimeSupportFile {
    pub path: String,
    pub sha256: String,
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
            || !is_release_child(&release_root, &node_executable)
            || !is_release_child(&release_root, &core_entrypoint)
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
        let root_metadata = symlink_metadata(&self.release_root).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeMissing,
                "release root",
                error,
            )
        })?;
        let node_metadata = symlink_metadata(&self.node_executable).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "node.exe",
                error,
            )
        })?;
        let core_metadata = symlink_metadata(&self.core_entrypoint).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "Core entrypoint",
                error,
            )
        })?;
        if !root_metadata.file_type().is_dir()
            || root_metadata.file_type().is_symlink()
            || is_reparse_point(&root_metadata)
            || !node_metadata.file_type().is_file()
            || node_metadata.file_type().is_symlink()
            || is_reparse_point(&node_metadata)
            || !core_metadata.file_type().is_file()
            || core_metadata.file_type().is_symlink()
            || is_reparse_point(&core_metadata)
        {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "release-owned runtime paths are not regular non-reparse files",
            ));
        }
        Ok(())
    }

    /// Validate the unsigned artifact-integrity record and both packaged file
    /// hashes. Signature/TUF admission remains a separate required gate.
    pub fn validate_integrity(
        &self,
        manifest_path: &Path,
    ) -> Result<RuntimeIntegrityManifest, CoreRuntimeError> {
        self.validate_structure()?;
        let root = canonicalize(&self.release_root).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "release root",
                error,
            )
        })?;
        let manifest_metadata = symlink_metadata(manifest_path).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "runtime integrity manifest",
                error,
            )
        })?;
        if !manifest_metadata.file_type().is_file()
            || manifest_metadata.file_type().is_symlink()
            || is_reparse_point(&manifest_metadata)
        {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "runtime integrity manifest must be a regular non-reparse file",
            ));
        }
        let manifest_path = canonicalize(manifest_path).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "runtime integrity manifest",
                error,
            )
        })?;
        if !is_canonical_child(&root, &manifest_path) {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIncompatible,
                "runtime integrity manifest must remain inside release_root",
            ));
        }
        let manifest_bytes = read(&manifest_path).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "runtime integrity manifest",
                error,
            )
        })?;
        let manifest: RuntimeIntegrityManifest =
            serde_json::from_slice(&manifest_bytes).map_err(|error| {
                Self::error(
                    CoreRuntimeState::CoreRuntimeIntegrityFailed,
                    &format!("runtime integrity manifest is invalid JSON: {error}"),
                )
            })?;

        if manifest.manifest_version != 1
            || manifest.jarvis_release_version.is_empty()
            || manifest.core_version.is_empty()
            || manifest.target != V1_RELEASE_TARGET
            || manifest.protocol_version != 1
            || manifest.minimum_data_schema_version == 0
            || manifest.maximum_data_schema_version < manifest.minimum_data_schema_version
            || manifest.schema_version != 1
            || manifest.platform != "WINDOWS"
            || manifest.runtime_role != "FULL_HOST"
            || manifest.architecture != "x64"
            || manifest.node_version != V1_NODE_VERSION
            || manifest.protocol_major != 1
        {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIncompatible,
                "runtime integrity manifest target identity is not the V1 Windows FULL_HOST profile",
            ));
        }

        let manifest_node = self.resolve_manifest_child(&root, &manifest.node_path, "node_path")?;
        let manifest_core =
            self.resolve_manifest_child(&root, &manifest.core_entrypoint, "core_entrypoint")?;
        let node = canonicalize(&self.node_executable).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "node.exe",
                error,
            )
        })?;
        let core = canonicalize(&self.core_entrypoint).map_err(|error| {
            Self::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "Core entrypoint",
                error,
            )
        })?;
        if !is_canonical_child(&root, &node) || !is_canonical_child(&root, &core) {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "packaged runtime target resolves outside the canonical release root",
            ));
        }
        if canonicalize(&manifest_node).ok().as_ref() != Some(&node)
            || canonicalize(&manifest_core).ok().as_ref() != Some(&core)
        {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIncompatible,
                "runtime integrity manifest paths do not match the selected release-owned layout",
            ));
        }

        validate_sha256(&manifest.node_sha256, "node_sha256")?;
        validate_sha256(&manifest.core_sha256, "core_sha256")?;
        let actual_node = sha256_file(&node)?;
        let actual_core = sha256_file(&core)?;
        if actual_node != manifest.node_sha256 || actual_core != manifest.core_sha256 {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "packaged Node/Core SHA-256 does not match the integrity manifest",
            ));
        }

        let mut support_paths = BTreeSet::new();
        for support_file in &manifest.core_support_files {
            if !support_paths.insert(support_file.path.clone()) {
                return Err(Self::error(
                    CoreRuntimeState::CoreRuntimeIncompatible,
                    "runtime support file paths must be unique",
                ));
            }
            let support_path = self.resolve_manifest_child(&root, &support_file.path, "support path")?;
            let support = canonicalize(&support_path).map_err(|error| {
                Self::io_error(
                    CoreRuntimeState::CoreRuntimeIntegrityFailed,
                    "Core support file",
                    error,
                )
            })?;
            let support_metadata = symlink_metadata(&support).map_err(|error| {
                Self::io_error(
                    CoreRuntimeState::CoreRuntimeIntegrityFailed,
                    "Core support file",
                    error,
                )
            })?;
            if !support_metadata.file_type().is_file()
                || support_metadata.file_type().is_symlink()
                || is_reparse_point(&support_metadata)
                || !is_canonical_child(&root, &support)
            {
                return Err(Self::error(
                    CoreRuntimeState::CoreRuntimeIntegrityFailed,
                    "Core support file must be a regular non-reparse child of release_root",
                ));
            }
            validate_sha256(&support_file.sha256, "core_support_files.sha256")?;
            if sha256_file(&support)? != support_file.sha256 {
                return Err(Self::error(
                    CoreRuntimeState::CoreRuntimeIntegrityFailed,
                    "packaged Core support file does not match the integrity manifest",
                ));
            }
        }

        Ok(manifest)
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
            (
                OsString::from("JARVIS_TUF_METADATA_DIR"),
                self.release_root.join("tuf").join("metadata").as_os_str().to_os_string(),
            ),
        ]))
    }

    /// Build the only production launch shape accepted by the Windows process
    /// supervisor. Integrity validation happens before this spec is returned.
    pub(crate) fn launch_spec(&self, manifest_path: &Path) -> Result<CoreLaunchSpec, CoreRuntimeError> {
        self.validate_integrity(manifest_path)?;
        Ok(CoreLaunchSpec {
            program: self.node_executable.clone(),
            arguments: vec![self.core_entrypoint.as_os_str().to_os_string()],
            current_dir: self.release_root.clone(),
            environment: self.controlled_environment()?,
        })
    }

    /// Construct a command from the exact absolute runtime path. The caller
    /// must still perform signed-manifest/integrity and protocol checks before
    /// spawning the process in the later startup subsections.
    pub fn controlled_command(&self, manifest_path: &Path) -> Result<Command, CoreRuntimeError> {
        let spec = self.launch_spec(manifest_path)?;
        let mut command = Command::new(&spec.program);
        command
            .args(&spec.arguments)
            .current_dir(&spec.current_dir)
            .env_clear();
        for (key, value) in spec.environment {
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

    fn io_error(state: CoreRuntimeState, label: &str, error: io::Error) -> CoreRuntimeError {
        Self::error(state, &format!("{label} could not be read: {error}"))
    }

    fn resolve_manifest_child(
        &self,
        root: &Path,
        relative: &str,
        label: &str,
    ) -> Result<PathBuf, CoreRuntimeError> {
        let relative_path = Path::new(relative);
        if relative.is_empty()
            || relative_path.is_absolute()
            || relative_path
                .components()
                .any(|component| !matches!(component, Component::Normal(_)))
        {
            return Err(Self::error(
                CoreRuntimeState::CoreRuntimeIncompatible,
                &format!("manifest {label} must be a normalized relative release path"),
            ));
        }
        Ok(root.join(relative_path))
    }
}

fn is_release_child(root: &Path, candidate: &Path) -> bool {
    candidate
        .strip_prefix(root)
        .map(|relative| {
            !relative.as_os_str().is_empty()
                && relative
                    .components()
                    .all(|component| matches!(component, Component::Normal(_)))
        })
        .unwrap_or(false)
}

fn is_canonical_child(root: &Path, candidate: &Path) -> bool {
    candidate
        .strip_prefix(root)
        .map(|relative| !relative.as_os_str().is_empty())
        .unwrap_or(false)
}

#[cfg(windows)]
fn is_reparse_point(metadata: &Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &Metadata) -> bool {
    false
}

fn validate_sha256(value: &str, field: &str) -> Result<(), CoreRuntimeError> {
    if value.len() != 64
        || value != value.to_ascii_lowercase()
        || !value.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(CoreRuntimeLayout::error(
            CoreRuntimeState::CoreRuntimeIntegrityFailed,
            &format!("manifest {field} must be a lowercase 64-character SHA-256 hex digest"),
        ));
    }
    Ok(())
}

fn sha256_file(path: &Path) -> Result<String, CoreRuntimeError> {
    let file = File::open(path).map_err(|error| {
        CoreRuntimeLayout::io_error(
            CoreRuntimeState::CoreRuntimeIntegrityFailed,
            "packaged file",
            error,
        )
    })?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = reader.read(&mut buffer).map_err(|error| {
            CoreRuntimeLayout::io_error(
                CoreRuntimeState::CoreRuntimeIntegrityFailed,
                "packaged file",
                error,
            )
        })?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
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

    #[cfg(windows)]
    #[test]
    fn manifest_path_traversal_fails_closed() {
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
        let manifest = RuntimeIntegrityManifest {
            manifest_version: 1,
            jarvis_release_version: "0.0.0".to_owned(),
            core_version: "0.0.0".to_owned(),
            target: V1_RELEASE_TARGET.to_owned(),
            protocol_version: 1,
            minimum_data_schema_version: 1,
            maximum_data_schema_version: 1,
            schema_version: 1,
            platform: "WINDOWS".to_owned(),
            runtime_role: "FULL_HOST".to_owned(),
            architecture: "x64".to_owned(),
            node_version: "24.18.0".to_owned(),
            protocol_major: 1,
            node_path: "../node.exe".to_owned(),
            core_entrypoint: "core/dist/main.js".to_owned(),
            node_sha256: "0".repeat(64),
            core_sha256: "0".repeat(64),
            core_support_files: Vec::new(),
        };
        let manifest_path = root.join("runtime-manifest.json");
        write(
            &manifest_path,
            serde_json::to_vec(&manifest).expect("manifest must serialize"),
        )
        .expect("manifest must be writable");

        let error = layout
            .validate_integrity(&manifest_path)
            .expect_err("manifest traversal must fail closed");
        assert_eq!(error.state, CoreRuntimeState::CoreRuntimeIncompatible);
        remove_dir_all(root).expect("test runtime directory must be removable");
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
    fn production_resource_preflight_uses_exact_core_runtime_layout() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("test clock must be after Unix epoch")
            .as_nanos();
        let resource_parent = std::env::temp_dir().join(format!("jarvis-core-resource-{suffix}"));
        let root = resource_parent.join(RELEASE_RUNTIME_DIRECTORY);
        create_dir_all(root.join("runtime")).expect("runtime directory must be creatable");
        create_dir_all(root.join("core").join("dist")).expect("core directory must be creatable");
        write(root.join("runtime").join("node.exe"), b"synthetic node")
            .expect("synthetic runtime must be writable");
        write(
            root.join("core").join("dist").join("main.js"),
            b"synthetic core",
        )
        .expect("synthetic entrypoint must be writable");
        let manifest = RuntimeIntegrityManifest {
            manifest_version: 1,
            jarvis_release_version: "0.0.0".to_owned(),
            core_version: "0.0.0".to_owned(),
            target: V1_RELEASE_TARGET.to_owned(),
            protocol_version: 1,
            minimum_data_schema_version: 1,
            maximum_data_schema_version: 1,
            schema_version: 1,
            platform: "WINDOWS".to_owned(),
            runtime_role: "FULL_HOST".to_owned(),
            architecture: "x64".to_owned(),
            node_version: "24.18.0".to_owned(),
            protocol_major: 1,
            node_path: "runtime/node.exe".to_owned(),
            core_entrypoint: "core/dist/main.js".to_owned(),
            node_sha256: sha256_file(&root.join("runtime").join("node.exe"))
                .expect("node digest must be computable"),
            core_sha256: sha256_file(&root.join("core").join("dist").join("main.js"))
                .expect("Core digest must be computable"),
            core_support_files: Vec::new(),
        };
        write(
            root.join("runtime-manifest.json"),
            serde_json::to_vec(&manifest).expect("manifest must serialize"),
        )
        .expect("manifest must be writable");

        let policy = CoreRuntimePolicy::new();
        let loaded = policy
            .load_verified_layout(resource_parent.clone())
            .expect("resource layout must verify");
        assert_eq!(
            loaded.core_entrypoint,
            root.join("core").join("dist").join("main.js")
        );
        remove_dir_all(resource_parent).expect("test resource directory must be removable");
    }

    #[cfg(windows)]
    #[test]
    fn integrity_manifest_must_be_a_regular_file() {
        let (root, layout) = test_layout();
        create_dir_all(root.join("runtime")).expect("runtime directory must be creatable");
        create_dir_all(root.join("core").join("dist"))
            .expect("core directory must be creatable");
        write(root.join("runtime").join("node.exe"), b"synthetic node")
            .expect("synthetic runtime must be writable");
        write(
            root.join("core").join("dist").join("main.js"),
            b"synthetic core",
        )
        .expect("synthetic entrypoint must be writable");
        let manifest_path = root.join("runtime-manifest.json");
        create_dir_all(&manifest_path).expect("manifest directory must be creatable");

        let error = layout
            .validate_integrity(&manifest_path)
            .expect_err("a manifest directory must fail closed");
        assert_eq!(error.state, CoreRuntimeState::CoreRuntimeIntegrityFailed);
        remove_dir_all(root).expect("test runtime directory must be removable");
    }

    #[cfg(windows)]
    #[test]
    fn non_regular_runtime_target_fails_closed() {
        let (root, layout) = test_layout();
        create_dir_all(root.join("runtime")).expect("runtime directory must be creatable");
        create_dir_all(root.join("core").join("dist")).expect("core directory must be creatable");
        create_dir_all(root.join("runtime").join("node.exe"))
            .expect("test directory must be creatable");
        write(
            root.join("core").join("dist").join("main.js"),
            b"synthetic core",
        )
        .expect("synthetic entrypoint must be writable");

        let error = layout
            .validate_structure()
            .expect_err("a directory cannot be used as node.exe");
        assert_eq!(error.state, CoreRuntimeState::CoreRuntimeIntegrityFailed);
        remove_dir_all(root).expect("test runtime directory must be removable");
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

        let manifest = RuntimeIntegrityManifest {
            manifest_version: 1,
            jarvis_release_version: "0.0.0".to_owned(),
            core_version: "0.0.0".to_owned(),
            target: V1_RELEASE_TARGET.to_owned(),
            protocol_version: 1,
            minimum_data_schema_version: 1,
            maximum_data_schema_version: 1,
            schema_version: 1,
            platform: "WINDOWS".to_owned(),
            runtime_role: "FULL_HOST".to_owned(),
            architecture: "x64".to_owned(),
            node_version: "24.18.0".to_owned(),
            protocol_major: 1,
            node_path: "runtime/node.exe".to_owned(),
            core_entrypoint: "core/dist/main.js".to_owned(),
            node_sha256: sha256_file(&root.join("runtime").join("node.exe"))
                .expect("node digest must be computable"),
            core_sha256: sha256_file(&root.join("core").join("dist").join("main.js"))
                .expect("Core digest must be computable"),
            core_support_files: Vec::new(),
        };
        let manifest_path = root.join("runtime-manifest.json");
        write(
            &manifest_path,
            serde_json::to_vec(&manifest).expect("manifest must serialize"),
        )
        .expect("manifest must be writable");

        let command = layout
            .controlled_command(&manifest_path)
            .expect("complete release structure must build a controlled command");
        assert_eq!(command.get_program(), root.join("runtime").join("node.exe"));
        assert!(command
            .get_args()
            .any(|argument| argument == root.join("core").join("dist").join("main.js")));
        let environment: Vec<_> = command.get_envs().collect();
        assert!(environment
            .iter()
            .any(|(key, _)| *key == OsStr::new("JARVIS_CORE_ROOT")));
        assert!(!environment.iter().any(|(key, _)| {
            *key == OsStr::new("NODE_OPTIONS") || *key == OsStr::new("NODE_PATH")
        }));

        remove_dir_all(root).expect("test runtime directory must be removable");
    }

    #[cfg(windows)]
    #[test]
    fn hash_tampering_fails_closed_before_command_construction() {
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

        let manifest = RuntimeIntegrityManifest {
            manifest_version: 1,
            jarvis_release_version: "0.0.0".to_owned(),
            core_version: "0.0.0".to_owned(),
            target: V1_RELEASE_TARGET.to_owned(),
            protocol_version: 1,
            minimum_data_schema_version: 1,
            maximum_data_schema_version: 1,
            schema_version: 1,
            platform: "WINDOWS".to_owned(),
            runtime_role: "FULL_HOST".to_owned(),
            architecture: "x64".to_owned(),
            node_version: "24.18.0".to_owned(),
            protocol_major: 1,
            node_path: "runtime/node.exe".to_owned(),
            core_entrypoint: "core/dist/main.js".to_owned(),
            node_sha256: "0".repeat(64),
            core_sha256: "0".repeat(64),
            core_support_files: Vec::new(),
        };
        let manifest_path = root.join("runtime-manifest.json");
        write(
            &manifest_path,
            serde_json::to_vec(&manifest).expect("manifest must serialize"),
        )
        .expect("manifest must be writable");

        let error = layout
            .controlled_command(&manifest_path)
            .expect_err("hash mismatch must prevent command construction");
        assert_eq!(error.state, CoreRuntimeState::CoreRuntimeIntegrityFailed);
        remove_dir_all(root).expect("test runtime directory must be removable");
    }
}
