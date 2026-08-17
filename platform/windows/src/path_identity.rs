//! Windows application/data path identity boundary.
//!
//! This initial backend owns the fixed per-user JARVIS root. Project-target
//! resolution is a later capability; this module deliberately does not turn
//! Windows path syntax into a shared domain protocol.

use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs::{canonicalize, metadata, symlink_metadata, File, Metadata, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf, Prefix};
use std::time::{SystemTime, UNIX_EPOCH};

pub const APPLICATION_DIRECTORY: &str = "JARVIS";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowsPathRoot {
    Drive,
    Unc,
    Verbatim,
    Relative,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsPathIdentity {
    pub canonical_path: PathBuf,
    pub root: WindowsPathRoot,
    pub case_insensitive_key: String,
}

impl WindowsPathIdentity {
    pub fn existing(path: &Path) -> Result<Self, WindowsPathError> {
        validate_path_text(path, false)?;
        // Inspect the caller-supplied spelling before canonicalization so a
        // junction/symlink that escapes the requested project root cannot be
        // hidden by resolving directly to its target.
        reject_reparse(path)?;
        let canonical_path =
            canonicalize(path).map_err(|error| WindowsPathError::io("canonicalize", error))?;
        reject_reparse(&canonical_path)?;
        let root = classify_root(&canonical_path);
        if root == WindowsPathRoot::Relative {
            return Err(WindowsPathError::Invalid(
                "canonical path is not absolute".to_owned(),
            ));
        }
        Ok(Self {
            case_insensitive_key: canonical_path.to_string_lossy().to_ascii_lowercase(),
            canonical_path,
            root,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WindowsPathError {
    Io {
        operation: &'static str,
        detail: String,
    },
    Invalid(String),
    ReparsePoint(PathBuf),
    UnsupportedRoot(WindowsPathRoot),
}

impl WindowsPathError {
    fn io(operation: &'static str, error: std::io::Error) -> Self {
        Self::Io {
            operation,
            detail: error.to_string(),
        }
    }
}

impl Display for WindowsPathError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io { operation, detail } => {
                write!(formatter, "Windows path {operation} failed: {detail}")
            }
            Self::Invalid(detail) => write!(formatter, "invalid Windows path: {detail}"),
            Self::ReparsePoint(path) => write!(
                formatter,
                "reparse point is not allowed: {}",
                path.display()
            ),
            Self::UnsupportedRoot(root) => {
                write!(formatter, "unsupported Windows application root: {root:?}")
            }
        }
    }
}

impl Error for WindowsPathError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApplicationPathResolution {
    pub root: PathBuf,
    pub identity: WindowsPathIdentity,
}

/// A target resolved below a registered workspace root. The target identity
/// is derived from the canonical path and the version token is derived from
/// the current filesystem metadata. Callers must resolve again immediately
/// before a consequential operation and compare the expected token; this
/// value is not a durable authority by itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceTargetResolution {
    pub workspace: WindowsPathIdentity,
    pub target: WindowsPathIdentity,
    pub relative_path: String,
    pub version_token: String,
    pub exists: bool,
}

/// Secret-free result of a bounded workspace text read. The caller must treat
/// the version token as a point-in-time observation and re-resolve before any
/// consequential follow-up operation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceTextRead {
    pub target_identity: String,
    pub version_token: String,
    pub content: String,
    pub bytes: usize,
}

/// Secret-free result of a conditional workspace text replacement. The
/// returned version token is a new point-in-time observation and must be used
/// by the owning Core/tool layer as postcondition evidence.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceTextWrite {
    pub target_identity: String,
    pub version_token: String,
    pub state: &'static str,
}

/// Native-side registration of the exact project/workspace identity that owns
/// a filesystem capability. The registration is a platform binding only; Core
/// still owns project policy, permission, approval, and audit decisions.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegisteredWorkspace {
    project_id: String,
    workspace_id: String,
    root: WindowsPathIdentity,
}

impl RegisteredWorkspace {
    pub fn project_id(&self) -> &str {
        &self.project_id
    }

    pub fn workspace_id(&self) -> &str {
        &self.workspace_id
    }

    pub fn root_identity(&self) -> &WindowsPathIdentity {
        &self.root
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PlatformPathsAndIdentity;

impl PlatformPathsAndIdentity {
    pub const fn new() -> Self {
        Self
    }

    /// Resolve `%LOCALAPPDATA%\JARVIS` without a current-directory or PATH fallback.
    pub fn resolve_application_paths(&self) -> Result<ApplicationPathResolution, WindowsPathError> {
        let local_app_data = std::env::var_os("LOCALAPPDATA")
            .ok_or_else(|| WindowsPathError::Invalid("LOCALAPPDATA is required".to_owned()))?;
        let base = PathBuf::from(local_app_data);
        validate_path_text(&base, false)?;
        let base_identity = WindowsPathIdentity::existing(&base)?;
        if base_identity.root != WindowsPathRoot::Drive {
            return Err(WindowsPathError::UnsupportedRoot(base_identity.root));
        }

        // `std::fs::canonicalize` may return an extended-length `\\?\\C:`
        // spelling on Windows. Keep that canonical result for identity and
        // reparse validation, but use the equivalent ordinary drive spelling
        // for application-owned paths passed to Core. Core deliberately
        // rejects device/extended database paths at its persistence boundary.
        let application_base = ordinary_drive_path(&base_identity.canonical_path)?;
        let root = application_base.join(APPLICATION_DIRECTORY);
        validate_path_text(&root, false)?;
        let identity = if root.exists() {
            WindowsPathIdentity::existing(&root)?
        } else {
            WindowsPathIdentity {
                case_insensitive_key: root.to_string_lossy().to_ascii_lowercase(),
                root: classify_root(&root),
                canonical_path: root.clone(),
            }
        };
        if identity.root != WindowsPathRoot::Drive {
            return Err(WindowsPathError::UnsupportedRoot(identity.root));
        }
        Ok(ApplicationPathResolution { root, identity })
    }

    /// Resolve a registered project root using Windows-only filesystem
    /// identity rules. Project roots are existing non-root directories on a
    /// local drive; UNC, device, and other alternate roots remain explicit
    /// unsupported states rather than being treated as ordinary paths.
    pub fn resolve_project_root(
        &self,
        path: &Path,
    ) -> Result<WindowsPathIdentity, WindowsPathError> {
        let identity = WindowsPathIdentity::existing(path)?;
        if identity.root != WindowsPathRoot::Drive {
            return Err(WindowsPathError::UnsupportedRoot(identity.root));
        }
        if is_drive_root(&identity.canonical_path) {
            return Err(WindowsPathError::Invalid(
                "project root cannot be a drive root".to_owned(),
            ));
        }
        let metadata = symlink_metadata(&identity.canonical_path)
            .map_err(|error| WindowsPathError::io("inspect project root", error))?;
        if !metadata.is_dir() {
            return Err(WindowsPathError::Invalid(
                "project root must be a directory".to_owned(),
            ));
        }
        Ok(identity)
    }

    /// Bind a native filesystem capability to exact opaque Core-owned
    /// project/workspace identities. The path is resolved once at
    /// registration and re-resolved for every operation below.
    pub fn register_workspace(
        &self,
        project_id: &str,
        workspace_id: &str,
        workspace_root: &Path,
    ) -> Result<RegisteredWorkspace, WindowsPathError> {
        Ok(RegisteredWorkspace {
            project_id: validate_boundary_id(project_id, "project identity")?,
            workspace_id: validate_boundary_id(workspace_id, "workspace identity")?,
            root: self.resolve_project_root(workspace_root)?,
        })
    }

    /// Read through a registered project/workspace binding. Exact identity
    /// mismatches fail before any filesystem access occurs.
    pub fn read_registered_workspace_text(
        &self,
        registration: &RegisteredWorkspace,
        project_id: &str,
        workspace_id: &str,
        relative_path: &str,
        max_bytes: usize,
    ) -> Result<WorkspaceTextRead, WindowsPathError> {
        ensure_registered_workspace_ids(registration, project_id, workspace_id)?;
        self.read_workspace_text(&registration.root.canonical_path, relative_path, max_bytes)
    }

    /// Conditionally write through a registered project/workspace binding.
    /// The caller must supply the observed target version; this method does
    /// not turn registration into permission or approval authority.
    pub fn write_registered_workspace_text(
        &self,
        registration: &RegisteredWorkspace,
        project_id: &str,
        workspace_id: &str,
        relative_path: &str,
        content: &str,
        expected_version_token: &str,
    ) -> Result<WorkspaceTextWrite, WindowsPathError> {
        ensure_registered_workspace_ids(registration, project_id, workspace_id)?;
        self.write_workspace_text(
            &registration.root.canonical_path,
            relative_path,
            content,
            expected_version_token,
        )
    }

    /// Resolve a workspace-relative target without permitting path aliases
    /// or reparse-point escapes. Missing targets are supported only when the
    /// final leaf is missing and its existing parent remains below the
    /// canonical workspace root; callers still need an expected-state check
    /// before creating or replacing that target.
    pub fn resolve_workspace_target(
        &self,
        workspace_root: &Path,
        relative_path: &str,
        allow_missing_leaf: bool,
    ) -> Result<WorkspaceTargetResolution, WindowsPathError> {
        let workspace = self.resolve_project_root(workspace_root)?;
        let normalized = validate_relative_path(relative_path)?;
        let candidate = workspace.canonical_path.join(&normalized);
        let candidate_metadata = match symlink_metadata(&candidate) {
            Ok(value) => {
                if is_reparse_point(&value) {
                    return Err(WindowsPathError::ReparsePoint(candidate));
                }
                Some(value)
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(WindowsPathError::io("inspect workspace target", error)),
        };
        let exists = candidate_metadata.is_some();
        let target = if exists {
            WindowsPathIdentity::existing(&candidate)?
        } else {
            if !allow_missing_leaf {
                return Err(WindowsPathError::Invalid(
                    "workspace target must exist".to_owned(),
                ));
            }
            let parent = candidate.parent().ok_or_else(|| {
                WindowsPathError::Invalid("workspace target has no existing parent".to_owned())
            })?;
            let parent_identity = WindowsPathIdentity::existing(parent)?;
            ensure_within_workspace(&workspace, &parent_identity)?;
            let leaf = candidate.file_name().ok_or_else(|| {
                WindowsPathError::Invalid("workspace target has no final leaf".to_owned())
            })?;
            let target_path = parent_identity.canonical_path.join(leaf);
            WindowsPathIdentity {
                canonical_path: target_path.clone(),
                root: classify_root(&target_path),
                case_insensitive_key: target_path.to_string_lossy().to_ascii_lowercase(),
            }
        };
        ensure_within_workspace(&workspace, &target)?;
        let version_token = filesystem_version_token(&target.canonical_path, exists)?;
        Ok(WorkspaceTargetResolution {
            workspace,
            target,
            relative_path: normalized,
            version_token,
            exists,
        })
    }

    /// Read bounded UTF-8 text from an existing workspace file. Resolution is
    /// performed before and after the read; a changed identity or version
    /// token is rejected rather than returning a result for a stale target.
    /// This is a filesystem capability only: it does not grant permission or
    /// bypass the Core-owned tool-admission boundary.
    pub fn read_workspace_text(
        &self,
        workspace_root: &Path,
        relative_path: &str,
        max_bytes: usize,
    ) -> Result<WorkspaceTextRead, WindowsPathError> {
        if !(1..=1_048_576).contains(&max_bytes) {
            return Err(WindowsPathError::Invalid(
                "workspace text read bound is outside the approved range".to_owned(),
            ));
        }
        let before = self.resolve_workspace_target(workspace_root, relative_path, false)?;
        let target_metadata = symlink_metadata(&before.target.canonical_path)
            .map_err(|error| WindowsPathError::io("inspect text target", error))?;
        if !target_metadata.is_file() || target_metadata.file_type().is_symlink() {
            return Err(WindowsPathError::Invalid(
                "workspace text target must be a regular file".to_owned(),
            ));
        }

        let mut file = File::open(&before.target.canonical_path)
            .map_err(|error| WindowsPathError::io("open workspace text target", error))?;
        let mut bytes = Vec::with_capacity(max_bytes.min(64 * 1024));
        let mut limited = Read::by_ref(&mut file).take((max_bytes as u64).saturating_add(1));
        limited
            .read_to_end(&mut bytes)
            .map_err(|error| WindowsPathError::io("read workspace text target", error))?;
        if bytes.len() > max_bytes {
            return Err(WindowsPathError::Invalid(
                "workspace text target exceeds the approved read bound".to_owned(),
            ));
        }
        let content = String::from_utf8(bytes).map_err(|_| {
            WindowsPathError::Invalid("workspace text target is not UTF-8".to_owned())
        })?;
        let after = self.resolve_workspace_target(workspace_root, relative_path, false)?;
        if before.target.case_insensitive_key != after.target.case_insensitive_key
            || before.version_token != after.version_token
        {
            return Err(WindowsPathError::Invalid(
                "workspace text target changed during read".to_owned(),
            ));
        }
        Ok(WorkspaceTextRead {
            target_identity: after.target.case_insensitive_key,
            version_token: after.version_token,
            bytes: content.len(),
            content,
        })
    }

    /// Replace an existing regular workspace file only when its current
    /// canonical identity/version matches the caller's expected token. The
    /// new bytes are written to a same-directory create-new temporary file,
    /// flushed, and moved over the target with the Windows replace/write-
    /// through operation. The target is resolved again after replacement so
    /// the result carries fresh postcondition evidence.
    ///
    /// This capability does not decide permission, approval, idempotency-key,
    /// or project-policy admission; those remain Core-owned gates.
    pub fn write_workspace_text(
        &self,
        workspace_root: &Path,
        relative_path: &str,
        content: &str,
        expected_version_token: &str,
    ) -> Result<WorkspaceTextWrite, WindowsPathError> {
        if content.len() > 1_048_576 {
            return Err(WindowsPathError::Invalid(
                "workspace text write exceeds the approved bound".to_owned(),
            ));
        }
        if expected_version_token.is_empty() || expected_version_token.len() > 512 {
            return Err(WindowsPathError::Invalid(
                "expected workspace version token is invalid".to_owned(),
            ));
        }
        let before = self.resolve_workspace_target(workspace_root, relative_path, false)?;
        let target_metadata = symlink_metadata(&before.target.canonical_path)
            .map_err(|error| WindowsPathError::io("inspect text write target", error))?;
        if !target_metadata.is_file() || target_metadata.file_type().is_symlink() {
            return Err(WindowsPathError::Invalid(
                "workspace text write target must be a regular file".to_owned(),
            ));
        }
        if before.version_token != expected_version_token {
            return Err(WindowsPathError::Invalid(
                "workspace text write expected version does not match".to_owned(),
            ));
        }

        let parent = before.target.canonical_path.parent().ok_or_else(|| {
            WindowsPathError::Invalid("workspace text write target has no parent".to_owned())
        })?;
        let temporary = unique_workspace_temp_path(&before.target.canonical_path);
        let mut temporary_file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| WindowsPathError::io("create workspace text replacement", error))?;
        let write_result = (|| {
            temporary_file
                .write_all(content.as_bytes())
                .map_err(|error| WindowsPathError::io("write workspace text replacement", error))?;
            temporary_file
                .sync_all()
                .map_err(|error| WindowsPathError::io("flush workspace text replacement", error))?;
            Ok::<(), WindowsPathError>(())
        })();
        drop(temporary_file);
        if let Err(error) = write_result {
            let _ = std::fs::remove_file(&temporary);
            return Err(error);
        }

        let current = match self.resolve_workspace_target(workspace_root, relative_path, false) {
            Ok(value) => value,
            Err(error) => {
                let _ = std::fs::remove_file(&temporary);
                return Err(error);
            }
        };
        if current.target.case_insensitive_key != before.target.case_insensitive_key
            || current.version_token != expected_version_token
        {
            let _ = std::fs::remove_file(&temporary);
            return Err(WindowsPathError::Invalid(
                "workspace text write target changed before replacement".to_owned(),
            ));
        }
        if current.target.canonical_path.parent() != Some(parent) {
            let _ = std::fs::remove_file(&temporary);
            return Err(WindowsPathError::Invalid(
                "workspace text write target parent changed".to_owned(),
            ));
        }

        if let Err(error) = replace_file_atomically(&temporary, &before.target.canonical_path) {
            let _ = std::fs::remove_file(&temporary);
            return Err(error);
        }
        let after = match self.resolve_workspace_target(workspace_root, relative_path, false) {
            Ok(value) => value,
            Err(error) => return Err(error),
        };
        if after.target.case_insensitive_key != before.target.case_insensitive_key {
            return Err(WindowsPathError::Invalid(
                "workspace text write postcondition was not established".to_owned(),
            ));
        }
        let observed = self.read_workspace_text(workspace_root, relative_path, 1_048_576)?;
        if observed.content != content
            || observed.target_identity != after.target.case_insensitive_key
        {
            return Err(WindowsPathError::Invalid(
                "workspace text write content postcondition was not established".to_owned(),
            ));
        }
        Ok(WorkspaceTextWrite {
            target_identity: after.target.case_insensitive_key,
            version_token: after.version_token,
            state: "WRITE_REQUESTED",
        })
    }
}

fn validate_boundary_id(value: &str, label: &str) -> Result<String, WindowsPathError> {
    if value.is_empty()
        || value.len() > 256
        || !value.bytes().enumerate().all(|(index, byte)| {
            byte.is_ascii_alphanumeric()
                || byte == b'.'
                || byte == b'_'
                || byte == b':'
                || (index > 0 && byte == b'-')
        })
        || !value.as_bytes()[0].is_ascii_alphanumeric()
    {
        return Err(WindowsPathError::Invalid(format!("{label} is invalid")));
    }
    Ok(value.to_owned())
}

fn ensure_registered_workspace_ids(
    registration: &RegisteredWorkspace,
    project_id: &str,
    workspace_id: &str,
) -> Result<(), WindowsPathError> {
    if registration.project_id != project_id || registration.workspace_id != workspace_id {
        return Err(WindowsPathError::Invalid(
            "registered project/workspace identity does not match request".to_owned(),
        ));
    }
    Ok(())
}

fn unique_workspace_temp_path(target: &Path) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or_default();
    let name = target
        .file_name()
        .map(|value| value.to_string_lossy())
        .unwrap_or_else(|| std::borrow::Cow::Borrowed("target"));
    target
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!(
            ".{name}.jarvis-write-{}-{nonce}.tmp",
            std::process::id()
        ))
}

#[cfg(windows)]
fn replace_file_atomically(source: &Path, target: &Path) -> Result<(), WindowsPathError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source_text: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let target_text: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    // SAFETY: both buffers are NUL-terminated UTF-16 paths owned for the
    // duration of the call; no pointer is retained by Windows.
    let moved = unsafe {
        MoveFileExW(
            source_text.as_ptr(),
            target_text.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved == 0 {
        Err(WindowsPathError::io(
            "replace workspace text target",
            std::io::Error::last_os_error(),
        ))
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file_atomically(source: &Path, target: &Path) -> Result<(), WindowsPathError> {
    std::fs::rename(source, target)
        .map_err(|error| WindowsPathError::io("replace workspace text target", error))
}

/// Validate and normalize the textual relative-path contract before it is
/// converted into a platform `Path`. This deliberately handles both slash
/// styles so validation remains correct at the Windows boundary even when a
/// caller was assembled on another platform.
pub fn validate_relative_path(value: &str) -> Result<String, WindowsPathError> {
    if value.is_empty() || value.len() > 4096 || value.contains('\0') {
        return Err(WindowsPathError::Invalid(
            "workspace-relative path is empty, too long, or contains NUL".to_owned(),
        ));
    }
    let normalized = value.replace('\\', "/");
    if normalized.starts_with('/')
        || normalized.starts_with("//")
        || normalized.as_bytes().get(1) == Some(&b':')
    {
        return Err(WindowsPathError::Invalid(
            "workspace-relative path must not be absolute, UNC, or drive-qualified".to_owned(),
        ));
    }
    let components: Vec<&str> = normalized.split('/').collect();
    if components.is_empty()
        || components.iter().any(|component| {
            component.is_empty()
                || *component == "."
                || *component == ".."
                || component.contains(':')
                || component
                    .chars()
                    .any(|character| matches!(character, '<' | '>' | '"' | '|' | '?' | '*'))
        })
    {
        return Err(WindowsPathError::Invalid(
            "workspace-relative path contains an invalid component".to_owned(),
        ));
    }
    Ok(components.join("/"))
}

fn ensure_within_workspace(
    workspace: &WindowsPathIdentity,
    target: &WindowsPathIdentity,
) -> Result<(), WindowsPathError> {
    let root = workspace.case_insensitive_key.trim_end_matches(['\\', '/']);
    let candidate = target.case_insensitive_key.as_str();
    if candidate != root
        && !candidate
            .strip_prefix(root)
            .is_some_and(|suffix| suffix.starts_with('\\') || suffix.starts_with('/'))
    {
        return Err(WindowsPathError::Invalid(
            "resolved target escapes the workspace root".to_owned(),
        ));
    }
    Ok(())
}

fn filesystem_version_token(path: &Path, exists: bool) -> Result<String, WindowsPathError> {
    if !exists {
        return Ok(format!(
            "MISSING:{}",
            path.to_string_lossy().to_ascii_lowercase()
        ));
    }
    let file_metadata =
        metadata(path).map_err(|error| WindowsPathError::io("read target metadata", error))?;
    let modified = file_metadata
        .modified()
        .map_err(|error| WindowsPathError::io("read target modification time", error))?
        .duration_since(UNIX_EPOCH)
        .map_err(|_| {
            WindowsPathError::Invalid("target modification time precedes epoch".to_owned())
        })?;
    let created = file_metadata
        .created()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok());
    Ok(format!(
        "EXISTS:{}:{}:{}:{}:{}:{}:{}",
        path.to_string_lossy().to_ascii_lowercase(),
        file_metadata.len(),
        modified.as_secs(),
        modified.subsec_nanos(),
        created.map_or(0, |value| value.as_secs()),
        created.map_or(0, |value| value.subsec_nanos()),
        if file_metadata.is_dir() {
            "DIR"
        } else {
            "FILE"
        },
    ))
}

fn ordinary_drive_path(path: &Path) -> Result<PathBuf, WindowsPathError> {
    let text = path.to_string_lossy();
    let ordinary = text
        .strip_prefix("\\\\?\\")
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_owned());
    if classify_root(&ordinary) != WindowsPathRoot::Drive {
        return Err(WindowsPathError::Invalid(
            "canonical application path must remain an ordinary local drive path".to_owned(),
        ));
    }
    Ok(ordinary)
}

fn validate_path_text(path: &Path, allow_missing: bool) -> Result<(), WindowsPathError> {
    if path.as_os_str().is_empty() {
        return Err(WindowsPathError::Invalid("path is empty".to_owned()));
    }
    if path.to_string_lossy().contains('\0') {
        return Err(WindowsPathError::Invalid(
            "path contains an embedded NUL".to_owned(),
        ));
    }
    if classify_root(path) == WindowsPathRoot::Relative || !path.is_absolute() {
        return Err(WindowsPathError::Invalid(
            "path must be absolute".to_owned(),
        ));
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(WindowsPathError::Invalid(
            "parent traversal is not allowed".to_owned(),
        ));
    }
    if !allow_missing && !path.exists() {
        return Err(WindowsPathError::Invalid("path must exist".to_owned()));
    }
    Ok(())
}

fn classify_root(path: &Path) -> WindowsPathRoot {
    let Some(Component::Prefix(prefix)) = path.components().next() else {
        return WindowsPathRoot::Relative;
    };
    match prefix.kind() {
        Prefix::Disk(_) => WindowsPathRoot::Drive,
        Prefix::UNC(_, _) => WindowsPathRoot::Unc,
        Prefix::VerbatimDisk(_) => WindowsPathRoot::Drive,
        Prefix::VerbatimUNC(_, _) => WindowsPathRoot::Unc,
        Prefix::Verbatim(_) | Prefix::DeviceNS(_) => WindowsPathRoot::Verbatim,
    }
}

fn is_drive_root(path: &Path) -> bool {
    let components: Vec<_> = path.components().collect();
    components.len() == 2
        && matches!(components[0], Component::Prefix(_))
        && matches!(components[1], Component::RootDir)
}

fn reject_reparse(path: &Path) -> Result<(), WindowsPathError> {
    let mut current = PathBuf::new();
    for component in path.components() {
        if matches!(component, Component::Prefix(_)) {
            current.push(component.as_os_str());
            continue;
        }
        current.push(component.as_os_str());
        let metadata = symlink_metadata(&current)
            .map_err(|error| WindowsPathError::io("inspect path identity", error))?;
        if is_reparse_point(&metadata) {
            return Err(WindowsPathError::ReparsePoint(current));
        }
    }
    Ok(())
}

fn is_reparse_point(metadata: &Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    {
        let _ = metadata;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn root_classification_rejects_relative_and_parent_traversal() {
        assert_eq!(
            classify_root(Path::new("relative\\path")),
            WindowsPathRoot::Relative
        );
        assert!(matches!(
            validate_path_text(Path::new(r"C:\Users\..\JARVIS"), true),
            Err(WindowsPathError::Invalid(_))
        ));
    }

    #[test]
    fn relative_path_validation_is_platform_separator_independent() {
        assert_eq!(
            validate_relative_path(r"src\main.ts").expect("relative path must normalize"),
            "src/main.ts"
        );
        for invalid in [
            "",
            ".",
            "..",
            "src/../secret.txt",
            r"C:\\secret.txt",
            r"\\\\server\\share\\secret.txt",
            "/etc/passwd",
            "src:secret.txt",
            "src/*.txt",
        ] {
            assert!(
                validate_relative_path(invalid).is_err(),
                "path should be rejected: {invalid}"
            );
        }
    }

    #[cfg(windows)]
    #[test]
    fn bounded_workspace_text_read_revalidates_identity_and_utf8() {
        let root = tempfile_workspace();
        let file = root.join("read.txt");
        std::fs::write(&file, "hello").expect("write fixture");
        let backend = PlatformPathsAndIdentity::new();
        let result = backend
            .read_workspace_text(&root, r"read.txt", 64)
            .expect("text file must be readable");
        assert_eq!(result.content, "hello");
        assert_eq!(result.bytes, 5);
        assert!(result.target_identity.ends_with("\\read.txt"));
        assert!(result.version_token.starts_with("EXISTS:"));
    }

    #[cfg(windows)]
    #[test]
    fn bounded_workspace_text_read_rejects_oversized_and_non_utf8_content() {
        let root = tempfile_workspace();
        let backend = PlatformPathsAndIdentity::new();
        std::fs::write(root.join("large.txt"), "0123456789").expect("write large fixture");
        assert!(matches!(
            backend.read_workspace_text(&root, "large.txt", 4),
            Err(WindowsPathError::Invalid(message)) if message.contains("exceeds")
        ));
        std::fs::write(root.join("binary.txt"), [0xff, 0xfe]).expect("write binary fixture");
        assert!(matches!(
            backend.read_workspace_text(&root, "binary.txt", 64),
            Err(WindowsPathError::Invalid(message)) if message.contains("UTF-8")
        ));
    }

    #[cfg(windows)]
    #[test]
    fn conditional_workspace_text_write_requires_expected_version_and_reports_postcondition() {
        let root = tempfile_workspace();
        let file = root.join("write.txt");
        std::fs::write(&file, "before").expect("write fixture");
        let backend = PlatformPathsAndIdentity::new();
        let before = backend
            .read_workspace_text(&root, "write.txt", 64)
            .expect("initial text must be readable");
        let result = backend
            .write_workspace_text(&root, "write.txt", "after", &before.version_token)
            .expect("expected-version write must succeed");
        assert_eq!(result.state, "WRITE_REQUESTED");
        assert!(result.target_identity.ends_with("\\write.txt"));
        let after = backend
            .read_workspace_text(&root, "write.txt", 64)
            .expect("replaced text must be readable");
        assert_eq!(after.content, "after");
        assert_eq!(after.version_token, result.version_token);
    }

    #[cfg(windows)]
    #[test]
    fn conditional_workspace_text_write_rejects_stale_version_without_mutating_target() {
        let root = tempfile_workspace();
        let file = root.join("write.txt");
        std::fs::write(&file, "before").expect("write fixture");
        let backend = PlatformPathsAndIdentity::new();
        let before = backend
            .read_workspace_text(&root, "write.txt", 64)
            .expect("initial text must be readable");
        std::fs::write(&file, "changed").expect("change fixture");
        let error = backend
            .write_workspace_text(&root, "write.txt", "must-not-write", &before.version_token)
            .expect_err("stale version must fail closed");
        assert!(
            matches!(error, WindowsPathError::Invalid(message) if message.contains("does not match"))
        );
        assert_eq!(
            std::fs::read_to_string(file).expect("fixture must remain readable"),
            "changed"
        );
    }

    #[cfg(windows)]
    #[test]
    fn conditional_workspace_text_write_rejects_oversized_content_and_non_file_target() {
        let root = tempfile_workspace();
        std::fs::write(root.join("write.txt"), "before").expect("write fixture");
        std::fs::create_dir(root.join("directory")).expect("directory fixture");
        let backend = PlatformPathsAndIdentity::new();
        let before = backend
            .read_workspace_text(&root, "write.txt", 64)
            .expect("initial text must be readable");
        let oversized = "x".repeat(1_048_577);
        assert!(matches!(
            backend.write_workspace_text(&root, "write.txt", &oversized, &before.version_token),
            Err(WindowsPathError::Invalid(message)) if message.contains("exceeds")
        ));
        assert!(matches!(
            backend.write_workspace_text(&root, "directory", "text", "MISSING"),
            Err(WindowsPathError::Invalid(message)) if message.contains("regular file")
        ));
    }

    #[cfg(windows)]
    #[test]
    fn registered_workspace_requires_valid_exact_identities() {
        let root = tempfile_workspace();
        let backend = PlatformPathsAndIdentity::new();
        let registration = backend
            .register_workspace("project-1", "workspace-1", &root)
            .expect("workspace registration must resolve the root");
        assert_eq!(registration.project_id(), "project-1");
        assert_eq!(registration.workspace_id(), "workspace-1");
        assert!(matches!(
            backend.register_workspace("", "workspace-1", &root),
            Err(WindowsPathError::Invalid(message)) if message.contains("project identity")
        ));
        assert!(matches!(
            backend.register_workspace("project/1", "workspace-1", &root),
            Err(WindowsPathError::Invalid(message)) if message.contains("project identity")
        ));
    }

    #[cfg(windows)]
    #[test]
    fn registered_workspace_operations_reject_identity_retargeting() {
        let root = tempfile_workspace();
        let file = root.join("registered.txt");
        std::fs::write(&file, "before").expect("write fixture");
        let backend = PlatformPathsAndIdentity::new();
        let registration = backend
            .register_workspace("project-1", "workspace-1", &root)
            .expect("workspace registration must resolve the root");
        let before = backend
            .read_registered_workspace_text(
                &registration,
                "project-1",
                "workspace-1",
                "registered.txt",
                64,
            )
            .expect("registered read must succeed");
        assert!(matches!(
            backend.read_registered_workspace_text(
                &registration,
                "project-2",
                "workspace-1",
                "registered.txt",
                64,
            ),
            Err(WindowsPathError::Invalid(message)) if message.contains("does not match")
        ));
        let written = backend
            .write_registered_workspace_text(
                &registration,
                "project-1",
                "workspace-1",
                "registered.txt",
                "after",
                &before.version_token,
            )
            .expect("registered conditional write must succeed");
        assert_eq!(written.state, "WRITE_REQUESTED");
        assert_eq!(
            std::fs::read_to_string(file).expect("fixture must remain readable"),
            "after"
        );
        assert!(matches!(
            backend.write_registered_workspace_text(
                &registration,
                "project-1",
                "workspace-2",
                "registered.txt",
                "must-not-write",
                &written.version_token,
            ),
            Err(WindowsPathError::Invalid(message)) if message.contains("does not match")
        ));
    }

    #[test]
    fn application_root_is_deterministic_and_case_keyed() {
        let backend = PlatformPathsAndIdentity::new();
        let resolution = backend
            .resolve_application_paths()
            .expect("Windows application root must resolve");
        assert!(resolution.root.ends_with(APPLICATION_DIRECTORY));
        assert_eq!(resolution.identity.root, WindowsPathRoot::Drive);
        assert_eq!(
            resolution.identity.case_insensitive_key,
            resolution
                .identity
                .canonical_path
                .to_string_lossy()
                .to_ascii_lowercase()
        );
    }

    #[cfg(windows)]
    #[test]
    fn workspace_target_resolution_stays_below_root_and_produces_version_token() {
        let root = tempfile_workspace();
        let file = root.join("src").join("main.txt");
        std::fs::create_dir_all(file.parent().expect("parent exists"))
            .expect("create source directory");
        std::fs::write(&file, "first").expect("write source file");
        let backend = PlatformPathsAndIdentity::new();
        let resolved = backend
            .resolve_workspace_target(&root, r"src\main.txt", false)
            .expect("workspace file must resolve");
        assert!(resolved.exists);
        assert_eq!(resolved.relative_path, "src/main.txt");
        assert!(resolved.version_token.starts_with("EXISTS:"));
        assert!(backend
            .resolve_workspace_target(&root, "..\\outside.txt", true)
            .is_err());
    }

    #[cfg(windows)]
    fn tempfile_workspace() -> PathBuf {
        let nonce = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock must be after the epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "jarvis-path-identity-{}-{nonce}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("create temporary workspace");
        root
    }

    #[cfg(windows)]
    #[test]
    fn project_root_rejects_drive_root_and_preserves_case_insensitive_identity() {
        let backend = PlatformPathsAndIdentity::new();
        let local_app_data = std::env::var_os("LOCALAPPDATA").expect("LOCALAPPDATA must exist");
        let identity = backend
            .resolve_project_root(Path::new(&local_app_data))
            .expect("existing local app-data directory must be a valid project-root candidate");
        assert_eq!(
            identity.case_insensitive_key,
            identity
                .canonical_path
                .to_string_lossy()
                .to_ascii_lowercase()
        );
        assert!(matches!(
            backend.resolve_project_root(Path::new(r"C:\")),
            Err(WindowsPathError::Invalid(_))
        ));
    }

    #[cfg(windows)]
    #[test]
    fn application_root_uses_an_ordinary_drive_path_for_core() {
        let resolution = PlatformPathsAndIdentity::new()
            .resolve_application_paths()
            .expect("Windows application root must resolve");
        let text = resolution.root.to_string_lossy();
        assert!(!text.starts_with("\\\\?\\"));
        assert!(!text.starts_with("\\\\.\\"));
    }

    #[cfg(windows)]
    #[test]
    fn existing_local_app_data_has_no_reparse_component() {
        let local_app_data = std::env::var_os("LOCALAPPDATA").expect("LOCALAPPDATA must exist");
        WindowsPathIdentity::existing(Path::new(&local_app_data))
            .expect("LOCALAPPDATA must be a canonical non-reparse path");
    }
}
