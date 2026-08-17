//! Windows current-user secure storage for opaque JARVIS key handles.
//!
//! The handle is the only value intended for Core/database state. DPAPI
//! protected bytes remain in the platform-owned storage directory; plaintext
//! DB_DEK material exists only in the transient `DatabaseDek` value and is
//! wiped on drop.

use std::fs::{File, OpenOptions, create_dir_all, read, remove_file, rename, symlink_metadata};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};

#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

#[cfg(windows)]
use windows_sys::Win32::Storage::FileSystem::{
    MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
};

use crate::path_identity::{WindowsPathIdentity, WindowsPathRoot};

const DB_DEK_BYTES: usize = 32;
const HANDLE_PREFIX: &str = "dpapi-v1-";
const MAX_PROTECTED_BLOB_BYTES: usize = 16 * 1024;
const MAX_CREDENTIAL_BYTES: usize = 8 * 1024;

#[derive(Debug)]
pub enum WindowsSecureStorageError {
    InvalidRoot(&'static str),
    InvalidHandle,
    InvalidCredentialContext,
    InvalidCredentialValue,
    PathIdentity(String),
    Io {
        operation: &'static str,
        detail: String,
    },
    Native {
        operation: &'static str,
        code: u32,
    },
    InvalidProtectedBlob,
    DatabaseKeyMetadataMissing,
    DatabaseKeyMetadataInvalid,
    DatabaseKeyRestorePending,
    DatabaseKeyRestoreHandleMismatch,
}

impl std::fmt::Display for WindowsSecureStorageError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidRoot(detail) => write!(formatter, "invalid secure-storage root: {detail}"),
            Self::InvalidHandle => write!(formatter, "invalid secure-storage handle"),
            Self::InvalidCredentialContext => write!(formatter, "invalid credential context"),
            Self::InvalidCredentialValue => write!(formatter, "invalid credential value"),
            Self::PathIdentity(detail) => {
                write!(formatter, "secure-storage path identity failed: {detail}")
            }
            Self::Io { operation, detail } => {
                write!(formatter, "secure-storage {operation} failed: {detail}")
            }
            Self::Native { operation, code } => {
                write!(
                    formatter,
                    "Windows secure-storage {operation} failed with code {code}"
                )
            }
            Self::InvalidProtectedBlob => {
                write!(formatter, "invalid protected secure-storage blob")
            }
            Self::DatabaseKeyMetadataMissing => {
                write!(
                    formatter,
                    "database key metadata is missing for an existing database"
                )
            }
            Self::DatabaseKeyMetadataInvalid => {
                write!(formatter, "database key metadata is invalid")
            }
            Self::DatabaseKeyRestorePending => {
                write!(
                    formatter,
                    "database key restore is pending and has no database"
                )
            }
            Self::DatabaseKeyRestoreHandleMismatch => {
                write!(
                    formatter,
                    "database key restore handle does not match staged metadata"
                )
            }
        }
    }
}

impl std::error::Error for WindowsSecureStorageError {}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CredentialContext {
    pub integration_account_id: String,
    pub capability_id: String,
    pub purpose: String,
}

impl CredentialContext {
    pub fn new(
        integration_account_id: impl Into<String>,
        capability_id: impl Into<String>,
        purpose: impl Into<String>,
    ) -> Result<Self, WindowsSecureStorageError> {
        let context = Self {
            integration_account_id: integration_account_id.into(),
            capability_id: capability_id.into(),
            purpose: purpose.into(),
        };
        if [
            &context.integration_account_id,
            &context.capability_id,
            &context.purpose,
        ]
        .iter()
        .any(|value| value.is_empty() || value.len() > 256 || value.contains('\0'))
        {
            return Err(WindowsSecureStorageError::InvalidCredentialContext);
        }
        Ok(context)
    }

    fn entropy(&self) -> Vec<u8> {
        format!(
            "jarvis.credential.v1\0{}\0{}\0{}",
            self.integration_account_id, self.capability_id, self.purpose
        )
        .into_bytes()
    }
}

#[derive(Debug)]
pub struct CredentialSecret(Vec<u8>);

impl CredentialSecret {
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }
}

impl Drop for CredentialSecret {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SecureStorageHandle(String);

impl SecureStorageHandle {
    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn parse(value: impl Into<String>) -> Result<Self, WindowsSecureStorageError> {
        Self::new(value.into())
    }

    fn new(value: String) -> Result<Self, WindowsSecureStorageError> {
        if value.starts_with(HANDLE_PREFIX)
            && value.len() == HANDLE_PREFIX.len() + 64
            && value[HANDLE_PREFIX.len()..]
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit())
        {
            Ok(Self(value))
        } else {
            Err(WindowsSecureStorageError::InvalidHandle)
        }
    }
}

#[derive(Debug)]
pub struct DatabaseDek([u8; DB_DEK_BYTES]);

impl DatabaseDek {
    pub fn as_bytes(&self) -> &[u8; DB_DEK_BYTES] {
        &self.0
    }
}

impl Drop for DatabaseDek {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

/// A transient backup-data key recovered through the current-user DPAPI
/// boundary. It is intentionally distinct from `DatabaseDek` so the two
/// key roles cannot be silently substituted.
#[derive(Debug)]
pub struct BackupDek([u8; DB_DEK_BYTES]);

impl BackupDek {
    pub fn as_bytes(&self) -> &[u8; DB_DEK_BYTES] {
        &self.0
    }
}

impl Drop for BackupDek {
    fn drop(&mut self) {
        self.0.fill(0);
    }
}

#[derive(Debug, Clone)]
pub struct WindowsSecureStorage {
    root: PathBuf,
}

impl WindowsSecureStorage {
    pub fn open(root: impl Into<PathBuf>) -> Result<Self, WindowsSecureStorageError> {
        let root = root.into();
        validate_root(&root)?;
        create_dir_all(&root).map_err(|error| io_error("create root", error))?;
        let identity = WindowsPathIdentity::existing(&root)
            .map_err(|error| WindowsSecureStorageError::PathIdentity(error.to_string()))?;
        if identity.root != WindowsPathRoot::Drive {
            return Err(WindowsSecureStorageError::InvalidRoot(
                "secure storage must remain on a local drive",
            ));
        }
        Ok(Self {
            root: identity.canonical_path,
        })
    }

    pub fn create_db_dek(
        &self,
    ) -> Result<(SecureStorageHandle, DatabaseDek), WindowsSecureStorageError> {
        let mut plaintext = [0_u8; DB_DEK_BYTES];
        fill_random(&mut plaintext)?;
        let handle = self.protect_db_dek(&plaintext)?;
        Ok((handle, DatabaseDek(plaintext)))
    }

    /// Protect caller-generated fresh DB_DEK material in the current-user
    /// secure store without publishing its active metadata yet. Restore uses
    /// this as the first half of its staged key-handoff boundary.
    pub fn protect_db_dek(
        &self,
        db_dek: &[u8; DB_DEK_BYTES],
    ) -> Result<SecureStorageHandle, WindowsSecureStorageError> {
        let protected = protect(db_dek)?;
        let handle = new_handle()?;
        self.write_blob(&handle, &protected)?;
        Ok(handle)
    }

    /// Atomically publish the opaque active-handle metadata after the
    /// corresponding staged database has passed its integrity gates.
    pub fn publish_db_dek_handle(
        &self,
        handle_path: &Path,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        validate_metadata_path(handle_path)?;
        write_handle_atomically(handle_path, handle)
    }

    pub fn stage_db_dek_handle(
        &self,
        handle_path: &Path,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        validate_metadata_path(handle_path)?;
        let pending_path = pending_handle_path(handle_path)?;
        if pending_path.exists() {
            let existing = read_handle_file(&pending_path)?;
            if existing == *handle {
                return Ok(());
            }
            return Err(WindowsSecureStorageError::DatabaseKeyMetadataInvalid);
        }
        write_handle_atomically(&pending_path, handle)
    }

    pub fn commit_staged_db_dek_handle(
        &self,
        handle_path: &Path,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        validate_metadata_path(handle_path)?;
        let pending_path = pending_handle_path(handle_path)?;
        if !pending_path.exists() {
            if handle_path.exists() && read_handle_file(handle_path).ok().as_ref() == Some(handle) {
                return Ok(());
            }
            return Err(WindowsSecureStorageError::DatabaseKeyRestoreHandleMismatch);
        }
        let staged = read_handle_file(&pending_path)?;
        if staged != *handle {
            return Err(WindowsSecureStorageError::DatabaseKeyRestoreHandleMismatch);
        }
        write_handle_atomically(handle_path, handle)?;
        remove_file(&pending_path).map_err(|error| io_error("clear staged DB_DEK handle", error))
    }

    pub fn discard_staged_db_dek_handle(
        &self,
        handle_path: &Path,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        validate_metadata_path(handle_path)?;
        let pending_path = pending_handle_path(handle_path)?;
        if !pending_path.exists() {
            return Ok(());
        }
        let staged = read_handle_file(&pending_path)?;
        if staged != *handle {
            return Err(WindowsSecureStorageError::DatabaseKeyRestoreHandleMismatch);
        }
        remove_file(&pending_path).map_err(|error| io_error("discard staged DB_DEK handle", error))
    }

    pub fn open_db_dek(
        &self,
        handle: &SecureStorageHandle,
    ) -> Result<DatabaseDek, WindowsSecureStorageError> {
        let protected = self.read_blob(handle)?;
        let plaintext = unprotect(&protected)?;
        if plaintext.len() != DB_DEK_BYTES {
            return Err(WindowsSecureStorageError::InvalidProtectedBlob);
        }
        let mut value = [0_u8; DB_DEK_BYTES];
        value.copy_from_slice(&plaintext);
        Ok(DatabaseDek(value))
    }

    /// Open the current profile's DB_DEK from an opaque handle, or create the
    /// first handle only when no authoritative database exists yet. The
    /// handle metadata is published atomically and never contains key bytes.
    pub fn open_or_create_db_dek(
        &self,
        handle_path: &Path,
        database_path: &Path,
    ) -> Result<(SecureStorageHandle, DatabaseDek), WindowsSecureStorageError> {
        validate_metadata_path(handle_path)?;
        validate_metadata_path(database_path)?;
        let pending_path = pending_handle_path(handle_path)?;
        if pending_path.exists() {
            let pending = read_handle_file(&pending_path)?;
            if !database_path.exists() {
                return Err(WindowsSecureStorageError::DatabaseKeyRestorePending);
            }
            if handle_path.exists() {
                let active = read_handle_file(handle_path)?;
                if active != pending {
                    return Err(WindowsSecureStorageError::DatabaseKeyRestorePending);
                }
                let key = self.open_db_dek(&active)?;
                remove_file(&pending_path)
                    .map_err(|error| io_error("clear recovered DB_DEK handle", error))?;
                return Ok((active, key));
            }
            let key = self.open_db_dek(&pending)?;
            write_handle_atomically(handle_path, &pending)?;
            remove_file(&pending_path)
                .map_err(|error| io_error("clear recovered DB_DEK handle", error))?;
            return Ok((pending, key));
        }
        if handle_path.exists() {
            let handle = read_handle_file(handle_path)?;
            return self.open_db_dek(&handle).map(|key| (handle, key));
        }
        if database_path.exists() {
            let metadata = symlink_metadata(database_path)
                .map_err(|error| io_error("inspect authoritative database", error))?;
            if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
                return Err(WindowsSecureStorageError::InvalidRoot(
                    "authoritative database must be a regular local file",
                ));
            }
            return Err(WindowsSecureStorageError::DatabaseKeyMetadataMissing);
        }

        let (handle, key) = self.create_db_dek()?;
        if let Err(error) = write_handle_atomically(handle_path, &handle) {
            let _ = self.delete(&handle);
            return Err(error);
        }
        Ok((handle, key))
    }

    /// Protect a backup-specific `BackupDEK` with current-user DPAPI and bind
    /// it to caller-supplied authenticated backup/descriptor context.
    pub fn protect_backup_dek(
        &self,
        backup_dek: &[u8; DB_DEK_BYTES],
        additional_entropy: &[u8],
    ) -> Result<Vec<u8>, WindowsSecureStorageError> {
        validate_additional_entropy(additional_entropy)?;
        protect_with_entropy(backup_dek, additional_entropy)
    }

    /// Recover a backup-specific `BackupDEK` only when the current Windows
    /// user and the exact authenticated backup/descriptor context match.
    pub fn unprotect_backup_dek(
        &self,
        protected: &[u8],
        additional_entropy: &[u8],
    ) -> Result<BackupDek, WindowsSecureStorageError> {
        validate_additional_entropy(additional_entropy)?;
        let plaintext = unprotect_with_entropy(protected, additional_entropy)?;
        if plaintext.len() != DB_DEK_BYTES {
            return Err(WindowsSecureStorageError::InvalidProtectedBlob);
        }
        let mut value = [0_u8; DB_DEK_BYTES];
        value.copy_from_slice(&plaintext);
        Ok(BackupDek(value))
    }

    /// Store a designated integration credential behind the current-user
    /// secure-storage boundary. The context is bound as DPAPI entropy, and
    /// only the opaque handle is intended to cross into Core state.
    pub fn put_secret(
        &self,
        context: &CredentialContext,
        value: &[u8],
    ) -> Result<SecureStorageHandle, WindowsSecureStorageError> {
        let entropy = context.entropy();
        validate_additional_entropy(&entropy)?;
        if value.is_empty() || value.len() > MAX_CREDENTIAL_BYTES {
            return Err(WindowsSecureStorageError::InvalidCredentialValue);
        }
        let protected = protect_with_entropy(value, &entropy)?;
        let handle = new_handle()?;
        self.write_blob(&handle, &protected)?;
        Ok(handle)
    }

    /// Resolve a credential only with the independently resolved context. No
    /// enumeration API exists, and the returned value is transient/wiped on
    /// drop.
    pub fn get_secret(
        &self,
        handle: &SecureStorageHandle,
        context: &CredentialContext,
    ) -> Result<CredentialSecret, WindowsSecureStorageError> {
        let entropy = context.entropy();
        validate_additional_entropy(&entropy)?;
        let protected = self.read_blob(handle)?;
        let mut plaintext = unprotect_with_entropy(&protected, &entropy)?;
        if plaintext.is_empty() || plaintext.len() > MAX_CREDENTIAL_BYTES {
            plaintext.fill(0);
            return Err(WindowsSecureStorageError::InvalidCredentialValue);
        }
        Ok(CredentialSecret(std::mem::take(&mut plaintext)))
    }

    pub fn rotate_secret(
        &self,
        previous: &SecureStorageHandle,
        context: &CredentialContext,
        replacement: &[u8],
    ) -> Result<SecureStorageHandle, WindowsSecureStorageError> {
        let next = self.put_secret(context, replacement)?;
        if let Err(error) = self.delete_secret(previous) {
            let _ = self.delete_secret(&next);
            return Err(error);
        }
        Ok(next)
    }

    pub fn delete_secret(
        &self,
        handle: &SecureStorageHandle,
    ) -> Result<(), WindowsSecureStorageError> {
        self.delete(handle)
    }

    pub fn rotate_db_dek(
        &self,
        previous: &SecureStorageHandle,
    ) -> Result<(SecureStorageHandle, DatabaseDek), WindowsSecureStorageError> {
        let next = self.create_db_dek()?;
        if let Err(error) = self.delete(previous) {
            let _ = self.delete(&next.0);
            return Err(error);
        }
        Ok(next)
    }

    pub fn delete(&self, handle: &SecureStorageHandle) -> Result<(), WindowsSecureStorageError> {
        let path = self.path_for(handle)?;
        let metadata =
            symlink_metadata(&path).map_err(|error| io_error("inspect handle", error))?;
        if !metadata.file_type().is_file() {
            return Err(WindowsSecureStorageError::InvalidHandle);
        }
        remove_file(path).map_err(|error| io_error("delete handle", error))
    }

    fn path_for(&self, handle: &SecureStorageHandle) -> Result<PathBuf, WindowsSecureStorageError> {
        let checked = SecureStorageHandle::new(handle.0.clone())?;
        Ok(self.root.join(format!("{}.bin", checked.as_str())))
    }

    fn write_blob(
        &self,
        handle: &SecureStorageHandle,
        protected: &[u8],
    ) -> Result<(), WindowsSecureStorageError> {
        if protected.is_empty() || protected.len() > MAX_PROTECTED_BLOB_BYTES {
            return Err(WindowsSecureStorageError::InvalidProtectedBlob);
        }
        let path = self.path_for(handle)?;
        let temporary = path.with_extension("tmp");
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| io_error("create protected blob", error))?;
        let result = (|| {
            file.write_all(protected)
                .map_err(|error| io_error("write protected blob", error))?;
            file.sync_all()
                .map_err(|error| io_error("flush protected blob", error))?;
            drop(file);
            rename(&temporary, &path).map_err(|error| io_error("publish protected blob", error))
        })();
        if result.is_err() {
            let _ = remove_file(&temporary);
        }
        result
    }

    fn read_blob(
        &self,
        handle: &SecureStorageHandle,
    ) -> Result<Vec<u8>, WindowsSecureStorageError> {
        let path = self.path_for(handle)?;
        let metadata =
            symlink_metadata(&path).map_err(|error| io_error("inspect protected blob", error))?;
        if !metadata.file_type().is_file()
            || metadata.len() == 0
            || metadata.len() > MAX_PROTECTED_BLOB_BYTES as u64
        {
            return Err(WindowsSecureStorageError::InvalidProtectedBlob);
        }
        let mut file = File::open(path).map_err(|error| io_error("open protected blob", error))?;
        let mut protected = Vec::with_capacity(metadata.len() as usize);
        file.read_to_end(&mut protected)
            .map_err(|error| io_error("read protected blob", error))?;
        Ok(protected)
    }
}

fn validate_root(root: &Path) -> Result<(), WindowsSecureStorageError> {
    if !root.is_absolute() || root.as_os_str().is_empty() {
        return Err(WindowsSecureStorageError::InvalidRoot(
            "an absolute root is required",
        ));
    }
    if root.to_string_lossy().contains('\0') {
        return Err(WindowsSecureStorageError::InvalidRoot(
            "embedded NUL is not allowed",
        ));
    }
    if root
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(WindowsSecureStorageError::InvalidRoot(
            "parent traversal is not allowed",
        ));
    }
    Ok(())
}

fn io_error(operation: &'static str, error: io::Error) -> WindowsSecureStorageError {
    WindowsSecureStorageError::Io {
        operation,
        detail: error.to_string(),
    }
}

const MAX_ADDITIONAL_ENTROPY_BYTES: usize = 1024;

fn validate_additional_entropy(entropy: &[u8]) -> Result<(), WindowsSecureStorageError> {
    if entropy.is_empty() || entropy.len() > MAX_ADDITIONAL_ENTROPY_BYTES {
        return Err(WindowsSecureStorageError::InvalidProtectedBlob);
    }
    Ok(())
}

#[cfg(windows)]
fn fill_random(bytes: &mut [u8]) -> Result<(), WindowsSecureStorageError> {
    use windows_sys::Win32::Security::Cryptography::{
        BCRYPT_USE_SYSTEM_PREFERRED_RNG, BCryptGenRandom,
    };
    let status = unsafe {
        BCryptGenRandom(
            std::ptr::null_mut(),
            bytes.as_mut_ptr(),
            bytes.len() as u32,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
    };
    if status == 0 {
        Ok(())
    } else {
        Err(WindowsSecureStorageError::Native {
            operation: "generate random bytes",
            code: status as u32,
        })
    }
}

#[cfg(not(windows))]
fn fill_random(_bytes: &mut [u8]) -> Result<(), WindowsSecureStorageError> {
    Err(WindowsSecureStorageError::Native {
        operation: "generate random bytes",
        code: 1,
    })
}

#[cfg(windows)]
fn protect(plaintext: &[u8]) -> Result<Vec<u8>, WindowsSecureStorageError> {
    protect_with_entropy(plaintext, &[])
}

#[cfg(windows)]
fn protect_with_entropy(
    plaintext: &[u8],
    additional_entropy: &[u8],
) -> Result<Vec<u8>, WindowsSecureStorageError> {
    use windows_sys::Win32::Security::Cryptography::{
        CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptProtectData,
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: plaintext.len() as u32,
        pbData: plaintext.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let entropy = if additional_entropy.is_empty() {
        None
    } else {
        Some(CRYPT_INTEGER_BLOB {
            cbData: additional_entropy.len() as u32,
            pbData: additional_entropy.as_ptr() as *mut u8,
        })
    };
    let entropy_pointer = entropy
        .as_ref()
        .map_or(std::ptr::null(), |value| value as *const CRYPT_INTEGER_BLOB);
    let ok = unsafe {
        CryptProtectData(
            &input,
            std::ptr::null(),
            entropy_pointer,
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 || output.pbData.is_null() || output.cbData == 0 {
        return Err(WindowsSecureStorageError::Native {
            operation: "protect DB_DEK",
            code: unsafe { windows_sys::Win32::Foundation::GetLastError() },
        });
    }
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        windows_sys::Win32::Foundation::LocalFree(output.pbData.cast());
    }
    Ok(result)
}

#[cfg(not(windows))]
fn protect_with_entropy(
    _plaintext: &[u8],
    _additional_entropy: &[u8],
) -> Result<Vec<u8>, WindowsSecureStorageError> {
    Err(WindowsSecureStorageError::Native {
        operation: "protect DB_DEK",
        code: 1,
    })
}

#[cfg(windows)]
fn unprotect(protected: &[u8]) -> Result<Vec<u8>, WindowsSecureStorageError> {
    unprotect_with_entropy(protected, &[])
}

#[cfg(windows)]
fn unprotect_with_entropy(
    protected: &[u8],
    additional_entropy: &[u8],
) -> Result<Vec<u8>, WindowsSecureStorageError> {
    use windows_sys::Win32::Security::Cryptography::{
        CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptUnprotectData,
    };
    let input = CRYPT_INTEGER_BLOB {
        cbData: protected.len() as u32,
        pbData: protected.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let entropy = if additional_entropy.is_empty() {
        None
    } else {
        Some(CRYPT_INTEGER_BLOB {
            cbData: additional_entropy.len() as u32,
            pbData: additional_entropy.as_ptr() as *mut u8,
        })
    };
    let entropy_pointer = entropy
        .as_ref()
        .map_or(std::ptr::null(), |value| value as *const CRYPT_INTEGER_BLOB);
    let ok = unsafe {
        CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            entropy_pointer,
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 || output.pbData.is_null() || output.cbData == 0 {
        return Err(WindowsSecureStorageError::Native {
            operation: "unprotect DB_DEK",
            code: unsafe { windows_sys::Win32::Foundation::GetLastError() },
        });
    }
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        std::ptr::write_bytes(output.pbData, 0, output.cbData as usize);
        windows_sys::Win32::Foundation::LocalFree(output.pbData.cast());
    }
    Ok(result)
}

#[cfg(not(windows))]
fn unprotect_with_entropy(
    _protected: &[u8],
    _additional_entropy: &[u8],
) -> Result<Vec<u8>, WindowsSecureStorageError> {
    Err(WindowsSecureStorageError::Native {
        operation: "unprotect DB_DEK",
        code: 1,
    })
}

fn new_handle() -> Result<SecureStorageHandle, WindowsSecureStorageError> {
    let mut random = [0_u8; 32];
    fill_random(&mut random)?;
    let mut value = String::with_capacity(HANDLE_PREFIX.len() + random.len() * 2);
    value.push_str(HANDLE_PREFIX);
    for byte in random {
        value.push_str(&format!("{byte:02x}"));
    }
    SecureStorageHandle::new(value)
}

fn validate_metadata_path(path: &Path) -> Result<(), WindowsSecureStorageError> {
    if !path.is_absolute()
        || path.as_os_str().is_empty()
        || path.to_string_lossy().contains('\0')
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(WindowsSecureStorageError::InvalidRoot(
            "database key metadata paths must be absolute local paths without traversal",
        ));
    }
    Ok(())
}

fn write_handle_atomically(
    path: &Path,
    handle: &SecureStorageHandle,
) -> Result<(), WindowsSecureStorageError> {
    let parent = path
        .parent()
        .ok_or(WindowsSecureStorageError::DatabaseKeyMetadataInvalid)?;
    create_dir_all(parent).map_err(|error| io_error("create DB_DEK metadata parent", error))?;
    let temporary = path.with_extension("tmp");
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|error| io_error("create DB_DEK handle staging", error))?;
    let result = (|| {
        file.write_all(handle.as_str().as_bytes())
            .map_err(|error| io_error("write DB_DEK handle", error))?;
        file.sync_all()
            .map_err(|error| io_error("flush DB_DEK handle", error))?;
        drop(file);
        replace_handle_file(&temporary, path)
    })();
    if result.is_err() {
        let _ = remove_file(&temporary);
    }
    result
}

fn pending_handle_path(handle_path: &Path) -> Result<PathBuf, WindowsSecureStorageError> {
    validate_metadata_path(handle_path)?;
    Ok(PathBuf::from(format!("{}.pending", handle_path.display())))
}

fn read_handle_file(path: &Path) -> Result<SecureStorageHandle, WindowsSecureStorageError> {
    let metadata =
        symlink_metadata(path).map_err(|error| io_error("inspect DB_DEK handle", error))?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(WindowsSecureStorageError::DatabaseKeyMetadataInvalid);
    }
    let bytes = read(path).map_err(|error| io_error("read DB_DEK handle", error))?;
    let value = std::str::from_utf8(&bytes)
        .map_err(|_| WindowsSecureStorageError::DatabaseKeyMetadataInvalid)?;
    SecureStorageHandle::new(value.to_owned())
        .map_err(|_| WindowsSecureStorageError::DatabaseKeyMetadataInvalid)
}

fn replace_handle_file(
    temporary: &Path,
    destination: &Path,
) -> Result<(), WindowsSecureStorageError> {
    #[cfg(windows)]
    {
        let source_text: Vec<u16> = temporary
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let destination_text: Vec<u16> = destination
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        // SAFETY: both paths are validated application-owned local paths and
        // the buffers remain alive for the duration of the Windows call.
        let result = unsafe {
            MoveFileExW(
                source_text.as_ptr(),
                destination_text.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };
        if result == 0 {
            return Err(io_error(
                "publish DB_DEK handle",
                io::Error::last_os_error(),
            ));
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        rename(temporary, destination).map_err(|error| io_error("publish DB_DEK handle", error))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_are_opaque_and_strictly_bounded() {
        assert!(SecureStorageHandle::new(format!("{HANDLE_PREFIX}{}", "a".repeat(64))).is_ok());
        assert!(SecureStorageHandle::new("raw-secret".to_owned()).is_err());
        assert!(SecureStorageHandle::new(format!("{HANDLE_PREFIX}{}", "g".repeat(64))).is_err());
    }

    #[test]
    fn database_dek_wipes_on_drop() {
        let mut key = DatabaseDek([0xff; DB_DEK_BYTES]);
        assert_eq!(key.as_bytes()[0], 0xff);
        key.0.fill(0);
        assert_eq!(key.as_bytes()[0], 0);
    }

    #[cfg(windows)]
    #[test]
    fn caller_supplied_db_dek_is_protected_before_handle_metadata_publish() {
        let root = std::env::temp_dir().join(format!("jarvis-db-key-stage-{}", std::process::id()));
        let storage_root = root.join("secure-storage");
        let data_root = root.join("data");
        std::fs::create_dir_all(&data_root).expect("test data root should exist");
        let storage =
            WindowsSecureStorage::open(storage_root).expect("secure storage should initialize");
        let supplied = [0x5a_u8; DB_DEK_BYTES];
        let handle = storage
            .protect_db_dek(&supplied)
            .expect("caller-supplied DB_DEK should be protected");
        assert_eq!(storage.open_db_dek(&handle).unwrap().as_bytes(), &supplied);
        let handle_path = data_root.join("db-dek.handle");
        storage
            .publish_db_dek_handle(&handle_path, &handle)
            .expect("opaque handle metadata should publish atomically");
        let metadata = std::fs::read(&handle_path).expect("published handle metadata should exist");
        assert!(!metadata.windows(2).any(|window| window == [0x5a, 0x5a]));
        assert_eq!(std::str::from_utf8(&metadata).unwrap(), handle.as_str());
        let _ = std::fs::remove_dir_all(root);
    }

    #[cfg(windows)]
    #[test]
    fn staged_db_dek_handle_is_restart_safe_and_commit_is_idempotent() {
        let root =
            std::env::temp_dir().join(format!("jarvis-db-key-staged-{}", std::process::id()));
        let storage_root = root.join("secure-storage");
        let data_root = root.join("data");
        std::fs::create_dir_all(&data_root).expect("test data root should exist");
        let storage =
            WindowsSecureStorage::open(storage_root).expect("secure storage should initialize");
        let handle_path = data_root.join("db-dek.handle");
        let database_path = data_root.join("state.db");
        let supplied = [0x6b_u8; DB_DEK_BYTES];
        let handle = storage
            .protect_db_dek(&supplied)
            .expect("fresh DB_DEK should be protected");
        storage
            .stage_db_dek_handle(&handle_path, &handle)
            .expect("fresh DB_DEK handle should stage");
        storage
            .stage_db_dek_handle(&handle_path, &handle)
            .expect("replayed staging should be idempotent");
        assert!(matches!(
            storage.open_or_create_db_dek(&handle_path, &database_path),
            Err(WindowsSecureStorageError::DatabaseKeyRestorePending)
        ));
        std::fs::write(&database_path, b"new encrypted database placeholder")
            .expect("test database marker should exist");
        let (recovered_handle, recovered_key) = storage
            .open_or_create_db_dek(&handle_path, &database_path)
            .expect("pending handle should recover when the database is present");
        assert_eq!(recovered_handle, handle);
        assert_eq!(recovered_key.as_bytes(), &supplied);
        assert!(!PathBuf::from(format!("{}.pending", handle_path.display())).exists());
        storage
            .commit_staged_db_dek_handle(&handle_path, &handle)
            .expect("replayed commit should be idempotent");
        assert_eq!(
            std::str::from_utf8(&std::fs::read(&handle_path).unwrap()).unwrap(),
            handle.as_str()
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn backup_dek_is_a_distinct_transient_key_role() {
        let mut key = BackupDek([0xff; DB_DEK_BYTES]);
        assert_eq!(key.as_bytes()[0], 0xff);
        key.0.fill(0);
        assert_eq!(key.as_bytes()[0], 0);
    }

    #[cfg(windows)]
    #[test]
    fn credential_broker_is_context_bound_rotatable_non_enumerable_and_wiped() {
        let root =
            std::env::temp_dir().join(format!("jarvis-credential-broker-{}", std::process::id()));
        let storage =
            WindowsSecureStorage::open(root.clone()).expect("secure storage should initialize");
        let context =
            CredentialContext::new("account-1", "GITHUB_REPOSITORY_READ", "integration-token")
                .expect("credential context should validate");
        let wrong_context =
            CredentialContext::new("account-2", "GITHUB_REPOSITORY_READ", "integration-token")
                .expect("wrong test context should validate structurally");
        let first = b"synthetic-token-v1";
        let second = b"synthetic-token-v2";
        let handle = storage
            .put_secret(&context, first)
            .expect("credential should be stored behind DPAPI");
        assert_eq!(
            storage.get_secret(&handle, &context).unwrap().as_bytes(),
            first
        );
        assert!(storage.get_secret(&handle, &wrong_context).is_err());
        let rotated = storage
            .rotate_secret(&handle, &context, second)
            .expect("credential rotation should publish a new opaque handle");
        assert_ne!(rotated, handle);
        assert!(storage.get_secret(&handle, &context).is_err());
        assert_eq!(
            storage.get_secret(&rotated, &context).unwrap().as_bytes(),
            second
        );
        storage
            .delete_secret(&rotated)
            .expect("credential deletion should remove the handle");
        assert!(storage.get_secret(&rotated, &context).is_err());
        assert!(!root.join(format!("{}.bin", rotated.as_str())).exists());
        let _ = std::fs::remove_dir_all(root);
    }

    #[cfg(windows)]
    #[test]
    fn db_dek_handle_lifecycle_is_atomic_and_existing_database_without_handle_fails_closed() {
        let root =
            std::env::temp_dir().join(format!("jarvis-db-key-lifecycle-{}", std::process::id()));
        let storage_root = root.join("secure-storage");
        let data_root = root.join("data");
        std::fs::create_dir_all(&data_root).expect("test data root should exist");
        let storage =
            WindowsSecureStorage::open(storage_root).expect("secure storage should initialize");
        let handle_path = data_root.join("db-dek.handle");
        let database_path = data_root.join("state.db");
        let (handle, first_key) = storage
            .open_or_create_db_dek(&handle_path, &database_path)
            .expect("first database key should be created");
        assert!(handle_path.is_file());
        assert_eq!(
            storage
                .open_db_dek(&handle)
                .expect("handle should reopen")
                .as_bytes(),
            first_key.as_bytes()
        );
        std::fs::write(&database_path, b"authoritative database placeholder")
            .expect("database marker should exist");
        std::fs::remove_file(&handle_path).expect("test should remove the handle metadata");
        assert!(matches!(
            storage.open_or_create_db_dek(&handle_path, &database_path),
            Err(WindowsSecureStorageError::DatabaseKeyMetadataMissing)
        ));
        let _ = std::fs::remove_dir_all(root);
    }

    #[cfg(windows)]
    #[test]
    fn backup_dek_dpapi_round_trip_is_bound_to_additional_entropy() {
        let root = std::env::temp_dir().join(format!("jarvis-backup-slot-{}", std::process::id()));
        let storage =
            WindowsSecureStorage::open(root.clone()).expect("secure storage should initialize");
        let backup_dek = [0x42_u8; DB_DEK_BYTES];
        let entropy = b"jarvis.backup.v1/test-descriptor-context";
        let protected = storage
            .protect_backup_dek(&backup_dek, entropy)
            .expect("backup key should be protected");
        let recovered = storage
            .unprotect_backup_dek(&protected, entropy)
            .expect("backup key should recover for the same user/context");
        assert_eq!(recovered.as_bytes(), &backup_dek);
        assert!(
            storage
                .unprotect_backup_dek(&protected, b"different-context")
                .is_err()
        );
        assert!(storage.protect_backup_dek(&backup_dek, &[]).is_err());
        let _ = std::fs::remove_dir_all(root);
    }
}
