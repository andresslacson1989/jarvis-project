//! Windows application/data path identity boundary.
//!
//! This initial backend owns the fixed per-user JARVIS root. Project-target
//! resolution is a later capability; this module deliberately does not turn
//! Windows path syntax into a shared domain protocol.

use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs::{canonicalize, symlink_metadata, Metadata};
use std::path::{Component, Path, PathBuf, Prefix};

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

        let root = base_identity.canonical_path.join(APPLICATION_DIRECTORY);
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
    fn existing_local_app_data_has_no_reparse_component() {
        let local_app_data = std::env::var_os("LOCALAPPDATA").expect("LOCALAPPDATA must exist");
        WindowsPathIdentity::existing(Path::new(&local_app_data))
            .expect("LOCALAPPDATA must be a canonical non-reparse path");
    }
}
