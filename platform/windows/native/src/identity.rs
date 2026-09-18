use std::path::{Path, PathBuf};

use windows_sys::Win32::{
    Storage::FileSystem::{
        BY_HANDLE_FILE_INFORMATION, CreateDirectoryW, CreateFileW, FILE_ATTRIBUTE_DIRECTORY,
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
        FILE_READ_ATTRIBUTES, FILE_SHARE_READ, FILE_SHARE_WRITE, GetFileInformationByHandle,
        GetFinalPathNameByHandleW, OPEN_EXISTING, READ_CONTROL, SYNCHRONIZE,
    },
    System::Com::CoTaskMemFree,
    UI::Shell::{FOLDERID_LocalAppData, SHGetKnownFolderPath},
};

use super::{
    NativeError, NativeErrorKind,
    handles::{OwnedHandle, last_error, native_failure, wide},
    security::ExplicitSecurity,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct FileIdentity {
    pub(super) volume_serial: u32,
    pub(super) file_index: u64,
}

impl FileIdentity {
    pub(super) fn as_bytes(self) -> [u8; 12] {
        let mut bytes = [0u8; 12];
        bytes[..4].copy_from_slice(&self.volume_serial.to_le_bytes());
        bytes[4..].copy_from_slice(&self.file_index.to_le_bytes());
        bytes
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct PathChainSnapshot {
    pub(super) identities: Vec<FileIdentity>,
    pub(super) final_identity: FileIdentity,
}

pub(super) fn local_app_data() -> Result<PathBuf, NativeError> {
    #[cfg(feature = "test-support")]
    if let Some(path) = std::env::var_os("JARVIS_NATIVE_TEST_LOCALAPPDATA") {
        let path = PathBuf::from(path);
        if let Err(error) = validate_absolute_local_path(&path) {
            record_test_failure!(
                "identity.test_local_app_data",
                "validate_absolute_local_path",
                0,
            );
            return Err(error);
        }
        return Ok(path);
    }

    let mut allocated = std::ptr::null_mut();
    // SAFETY: the known-folder identifier is static and Windows writes one
    // CoTaskMemAlloc-owned UTF-16 path pointer.
    let result = unsafe {
        SHGetKnownFolderPath(
            &FOLDERID_LocalAppData,
            0,
            std::ptr::null_mut(),
            &mut allocated,
        )
    };
    let _hresult = result;
    if result < 0 || allocated.is_null() {
        record_test_hresult!("identity.local_app_data", "SHGetKnownFolderPath", _hresult,);
        if !allocated.is_null() {
            // SAFETY: the pointer is owned by the known-folder API.
            unsafe { CoTaskMemFree(allocated.cast()) };
        }
        return Err(native_failure(NativeErrorKind::LocalAppDataUnavailable));
    }

    // SAFETY: the API returned a non-null CoTaskMem-owned UTF-16 buffer;
    // the scan is bounded before any dereference and the buffer is released
    // exactly once after conversion.
    let path = unsafe {
        let result = match bounded_utf16_length(allocated) {
            Some(length) => String::from_utf16(std::slice::from_raw_parts(allocated, length))
                .map(PathBuf::from)
                .map_err(|_| native_failure(NativeErrorKind::InvalidPath)),
            None => Err(native_failure(NativeErrorKind::InvalidPath)),
        };
        // SAFETY: SHGetKnownFolderPath returns memory owned by the COM task
        // allocator, including on a malformed/overlong result.
        CoTaskMemFree(allocated.cast());
        result?
    };
    validate_absolute_local_path(&path)?;
    Ok(path)
}

fn bounded_utf16_length(allocated: *const u16) -> Option<usize> {
    let mut length = 0usize;
    while length < 32768 {
        // SAFETY: the caller supplies the bounded UTF-16 buffer returned by
        // SHGetKnownFolderPath; no element beyond the fixed scan bound is
        // dereferenced.
        if unsafe { *allocated.add(length) } == 0 {
            return (length > 0).then_some(length);
        }
        length += 1;
    }
    None
}

struct ParsedAbsolutePath<'a> {
    text: &'a str,
    drive: u8,
    components: Vec<&'a str>,
}

fn parse_supported_absolute_path(path: &Path) -> Result<ParsedAbsolutePath<'_>, NativeError> {
    let text = path
        .to_str()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    let bytes = text.as_bytes();
    if text.encode_utf16().count() > 32_767
        || bytes.len() < 4
        || !bytes[0].is_ascii_alphabetic()
        || bytes.get(1) != Some(&b':')
        || bytes.get(2) != Some(&b'\\')
        || text.starts_with("\\\\")
        || text.starts_with("\\\\?\\")
        || text.starts_with("\\\\.\\")
        || text.contains('\0')
        || text.contains('/')
    {
        return Err(native_failure(NativeErrorKind::InvalidPath));
    }

    // A trailing separator is a permitted directory alias, but it is not a
    // separate component. The drive root itself is never a supported JARVIS
    // target.
    let component_text = text[3..].trim_end_matches('\\');
    if component_text.is_empty() {
        return Err(native_failure(NativeErrorKind::InvalidPath));
    }

    let mut components = Vec::new();
    for component in component_text.split('\\') {
        if component.is_empty()
            || component == "."
            || component == ".."
            || component.eq_ignore_ascii_case("GLOBALROOT")
            || component.chars().any(|character| {
                character.is_control()
                    || matches!(character, ':' | '*' | '?' | '"' | '<' | '>' | '|')
            })
        {
            return Err(native_failure(NativeErrorKind::InvalidPath));
        }
        components.push(component);
    }

    Ok(ParsedAbsolutePath {
        text,
        drive: bytes[0].to_ascii_uppercase(),
        components,
    })
}

pub(super) fn validate_absolute_local_path(path: &Path) -> Result<(), NativeError> {
    parse_supported_absolute_path(path).map(|_| ())
}

pub(super) fn identity(handle: &OwnedHandle) -> Result<FileIdentity, NativeError> {
    identity_with_stage(handle, "identity.identity")
}

fn identity_with_stage(
    handle: &OwnedHandle,
    _failure_stage: &'static str,
) -> Result<FileIdentity, NativeError> {
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: the handle is owned and the output structure is valid for the
    // duration of the call.
    let ok = unsafe { GetFileInformationByHandle(handle.raw(), &mut info) };
    if ok == 0 {
        #[cfg(feature = "test-support")]
        {
            let error = last_error();
            record_test_failure!(_failure_stage, "GetFileInformationByHandle", error,);
        }
        return Err(native_failure(NativeErrorKind::StateUnavailable));
    }
    Ok(FileIdentity {
        volume_serial: info.dwVolumeSerialNumber,
        file_index: (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
    })
}

fn open_path_component(path: &Path, expected_directory: bool) -> Result<OwnedHandle, NativeError> {
    let path_text = path
        .to_str()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    let path_wide = wide(path_text);
    let flags = FILE_FLAG_OPEN_REPARSE_POINT
        | if expected_directory {
            FILE_FLAG_BACKUP_SEMANTICS
        } else {
            0
        };
    // SAFETY: the path is NUL-terminated and all output/handle arguments are
    // valid for this synchronous call; OPEN_REPARSE_POINT observes the final
    // component instead of silently following its reparse target.
    let raw = unsafe {
        CreateFileW(
            path_wide.as_ptr(),
            FILE_READ_ATTRIBUTES | SYNCHRONIZE,
            FILE_SHARE_READ
                | FILE_SHARE_WRITE
                | windows_sys::Win32::Storage::FileSystem::FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            flags,
            std::ptr::null_mut(),
        )
    };
    if raw.is_null() || raw == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
        let _error = last_error();
        record_test_failure!("identity.path_chain_open", "CreateFileW", _error,);
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    OwnedHandle::from_raw(raw, NativeErrorKind::PathIdentityMismatch)
}

fn validate_component_handle(
    handle: &OwnedHandle,
    expected_directory: bool,
) -> Result<FileIdentity, NativeError> {
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: the handle is owned and the output structure is writable.
    if unsafe { GetFileInformationByHandle(handle.raw(), &mut info) } == 0 {
        let _error = last_error();
        record_test_failure!(
            "identity.path_chain_file_information",
            "GetFileInformationByHandle",
            _error,
        );
        return Err(native_failure(NativeErrorKind::PathApiFailure));
    }
    let is_directory = (info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
    if is_directory != expected_directory
        || (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0
    {
        record_test_failure!(
            "identity.path_chain_reparse_or_type",
            "GetFileInformationByHandle",
            0,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    Ok(FileIdentity {
        volume_serial: info.dwVolumeSerialNumber,
        file_index: (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
    })
}

fn ascii_starts_with_ignore_case(value: &str, prefix: &str) -> bool {
    value
        .get(..prefix.len())
        .is_some_and(|candidate| candidate.eq_ignore_ascii_case(prefix))
}

fn final_path_drive(value: &str) -> Option<u8> {
    let value = if value.starts_with(r"\\?\") {
        value.get(4..)?
    } else {
        value
    };
    let bytes = value.as_bytes();
    if bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\' {
        Some(bytes[0].to_ascii_uppercase())
    } else {
        None
    }
}

fn final_path_for_handle(
    handle: &OwnedHandle,
    expected_drive: u8,
    _stage: &'static str,
) -> Result<String, NativeError> {
    let mut final_path = [0u16; 1024];
    // SAFETY: the destination buffer is writable and large enough for the
    // bounded fixed application paths.
    let length = unsafe {
        GetFinalPathNameByHandleW(
            handle.raw(),
            final_path.as_mut_ptr(),
            final_path.len() as u32,
            0,
        )
    };
    let capacity = final_path.len() as u32;
    if length == 0 {
        let _error = last_error();
        record_test_final_path!(
            _stage,
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::Win32Error(_error),
            length,
            capacity,
            None,
            None,
        );
        return Err(native_failure(NativeErrorKind::PathApiFailure));
    }
    if length >= capacity {
        record_test_final_path!(
            _stage,
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            None,
            None,
        );
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    let value = String::from_utf16(&final_path[..length as usize]).map_err(|_| {
        record_test_final_path!(
            _stage,
            "String::from_utf16",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            None,
            None,
        );
        native_failure(NativeErrorKind::PathApiFailure)
    })?;

    if ascii_starts_with_ignore_case(&value, r"\\?\UNC\")
        || ascii_starts_with_ignore_case(&value, r"\\?\Volume{")
        || ascii_starts_with_ignore_case(&value, r"\\?\GLOBALROOT\")
        || ascii_starts_with_ignore_case(&value, r"\\.\")
        || ascii_starts_with_ignore_case(&value, r"\\GLOBALROOT\")
        || (value.starts_with(r"\\") && !value.starts_with(r"\\?\"))
        || final_path_drive(&value) != Some(expected_drive)
    {
        record_test_final_path!(
            _stage,
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            Some(value.as_str()),
            None,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    Ok(value)
}

/// Validate every component of a supported fixed path without following a
/// reparse point. The snapshot is used around subsequent operations so an
/// ancestor replacement cannot be mistaken for the original trusted chain.
pub(super) fn validate_trusted_path_chain(
    path: &Path,
    expected_directory: bool,
) -> Result<PathChainSnapshot, NativeError> {
    let parsed = parse_supported_absolute_path(path)?;
    if !expected_directory && parsed.text.ends_with('\\') {
        return Err(native_failure(NativeErrorKind::InvalidPath));
    }

    let mut prefix = PathBuf::from(&parsed.text[..3]);
    let mut identities = Vec::with_capacity(parsed.components.len());
    for (index, component) in parsed.components.iter().enumerate() {
        prefix.push(component);
        let is_final = index + 1 == parsed.components.len();
        let handle =
            open_path_component(&prefix, if is_final { expected_directory } else { true })?;
        let component_identity =
            validate_component_handle(&handle, if is_final { expected_directory } else { true })?;
        let _ = final_path_for_handle(&handle, parsed.drive, "identity.path_chain_final_path")?;
        identities.push(component_identity);
    }

    let final_identity = identities
        .last()
        .copied()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    Ok(PathChainSnapshot {
        identities,
        final_identity,
    })
}

pub(super) fn validate_parent_path_chain(path: &Path) -> Result<PathChainSnapshot, NativeError> {
    let parent = path
        .parent()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    validate_trusted_path_chain(parent, true)
}

pub(super) fn open_directory(
    path: &Path,
    _security: Option<&ExplicitSecurity>,
) -> Result<OwnedHandle, NativeError> {
    let before = validate_trusted_path_chain(path, true)?;
    let path_text = path
        .to_str()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    let path_wide = wide(path_text);
    // SAFETY: the path and optional security descriptor are NUL-terminated and
    // live for the complete synchronous call.
    let raw = unsafe {
        CreateFileW(
            path_wide.as_ptr(),
            FILE_READ_ATTRIBUTES | READ_CONTROL | SYNCHRONIZE,
            FILE_SHARE_READ
                | FILE_SHARE_WRITE
                | windows_sys::Win32::Storage::FileSystem::FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            std::ptr::null_mut(),
        )
    };
    if raw.is_null() || raw == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
        #[cfg(feature = "test-support")]
        {
            let error = last_error();
            record_test_failure!("identity.open_directory", "CreateFileW", error,);
        }
    }
    let handle = OwnedHandle::from_raw(raw, NativeErrorKind::StateUnavailable)?;
    validate_directory_handle(&handle, path)?;
    let after = validate_trusted_path_chain(path, true)?;
    if before != after {
        record_test_failure!(
            "identity.open_directory_chain_changed",
            "FileIdentity::compare",
            0,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    Ok(handle)
}

pub(super) fn create_or_open_directory(
    path: &Path,
    security: &ExplicitSecurity,
    sid: &str,
) -> Result<OwnedHandle, NativeError> {
    validate_absolute_local_path(path)?;
    let parent_before = validate_parent_path_chain(path)?;
    let path_text = path
        .to_str()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    let path_wide = wide(path_text);
    // SAFETY: the path and security descriptor remain valid for this call.
    let created = unsafe { CreateDirectoryW(path_wide.as_ptr(), security.as_ptr()) };
    let create_error = if created == 0 { last_error() } else { 0 };
    if created == 0 && create_error != windows_sys::Win32::Foundation::ERROR_ALREADY_EXISTS {
        record_test_failure!(
            "identity.create_directory",
            "CreateDirectoryW",
            create_error,
        );
        return Err(native_failure(NativeErrorKind::StateUnavailable));
    }
    let parent_after = validate_parent_path_chain(path)?;
    if parent_before != parent_after {
        record_test_failure!(
            "identity.create_directory_parent_changed",
            "FileIdentity::compare",
            0,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    let handle = open_directory(path, None)?;
    security.validate_handle(
        &handle,
        sid,
        windows_sys::Win32::Security::Authorization::SE_FILE_OBJECT,
    )?;
    Ok(handle)
}

fn validate_directory_handle(
    handle: &OwnedHandle,
    expected_path: &Path,
) -> Result<(), NativeError> {
    validate_fixed_handle(handle, expected_path, true)
}

pub(super) fn validate_file_handle(
    handle: &OwnedHandle,
    expected_path: &Path,
) -> Result<(), NativeError> {
    validate_fixed_handle(handle, expected_path, false)
}

pub(super) fn validate_ancestor_identities(
    path: &Path,
    expected_parent: FileIdentity,
    expected_root: FileIdentity,
) -> Result<(), NativeError> {
    let _state_chain = validate_trusted_path_chain(path, false)?;
    let root_path = match path.parent() {
        Some(path) => path,
        None => {
            record_test_failure!("identity.ancestor_root_path", "Path::parent", 0,);
            return Err(native_failure(NativeErrorKind::InvalidPath));
        }
    };
    let parent_path = match root_path.parent() {
        Some(path) => path,
        None => {
            record_test_failure!("identity.ancestor_parent_path", "Path::parent", 0,);
            return Err(native_failure(NativeErrorKind::InvalidPath));
        }
    };
    let parent_identity = validate_trusted_path_chain(parent_path, true)?.final_identity;
    let root_identity = validate_trusted_path_chain(root_path, true)?.final_identity;
    if parent_identity != expected_parent {
        record_test_failure!(
            "identity.ancestor_parent_mismatch",
            "FileIdentity::compare",
            0,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    if root_identity != expected_root {
        record_test_failure!(
            "identity.ancestor_root_mismatch",
            "FileIdentity::compare",
            0,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    Ok(())
}

enum ExpectedPathProbeFailure {
    Open {
        error: NativeError,
        status: Option<u32>,
    },
    Identity {
        error: NativeError,
        status: Option<u32>,
    },
    Attribute(NativeError),
}

#[cfg(feature = "test-support")]
fn probe_diagnostic_status(status: Option<u32>) -> crate::handles::TestDiagnosticStatus {
    status
        .map(crate::handles::TestDiagnosticStatus::Win32Error)
        .unwrap_or(crate::handles::TestDiagnosticStatus::NoStatus)
}

fn probe_expected_path_identity(
    expected_path: &Path,
    expected_directory: bool,
) -> Result<FileIdentity, ExpectedPathProbeFailure> {
    validate_trusted_path_chain(expected_path, expected_directory)
        .map(|snapshot| snapshot.final_identity)
        .map_err(|error| match error.kind {
            NativeErrorKind::PathApiFailure => ExpectedPathProbeFailure::Identity {
                error,
                status: None,
            },
            NativeErrorKind::PathIdentityMismatch => ExpectedPathProbeFailure::Attribute(error),
            _ => ExpectedPathProbeFailure::Open {
                error,
                status: None,
            },
        })
}

fn validate_fixed_handle(
    handle: &OwnedHandle,
    expected_path: &Path,
    expected_directory: bool,
) -> Result<(), NativeError> {
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: the handle is valid and the output structure is writable.
    let info_ok = unsafe { GetFileInformationByHandle(handle.raw(), &mut info) };
    if info_ok == 0 {
        #[cfg(feature = "test-support")]
        {
            let info_error = last_error();
            record_test_failure!(
                "identity.validate_file_information",
                "GetFileInformationByHandle",
                info_error,
            );
        }
        return Err(native_failure(NativeErrorKind::StateUnavailable));
    }
    let is_directory = (info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
    if is_directory != expected_directory
        || (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0
    {
        record_test_failure!(
            "identity.final_path_attribute_rejected",
            "GetFileInformationByHandle",
            0,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }

    let actual_identity = identity_with_stage(handle, "identity.validate_handle_identity")?;

    let mut final_path = [0u16; 1024];
    // SAFETY: the destination buffer is writable and large enough for the
    // validated LocalAppData/JARVIS fixed paths.
    let length = unsafe {
        GetFinalPathNameByHandleW(
            handle.raw(),
            final_path.as_mut_ptr(),
            final_path.len() as u32,
            0,
        )
    };
    let capacity = final_path.len() as u32;
    if length == 0 {
        #[cfg(feature = "test-support")]
        {
            let path_error = last_error();
            record_test_final_path!(
                "identity.final_path_api_failure",
                "GetFinalPathNameByHandleW",
                crate::handles::TestDiagnosticStatus::Win32Error(path_error),
                length,
                capacity,
                None,
                None,
            );
        }
        return Err(native_failure(NativeErrorKind::PathApiFailure));
    }
    if length >= capacity {
        record_test_final_path!(
            "identity.final_path_too_long",
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            None,
            None,
        );
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    let actual = match String::from_utf16(&final_path[..length as usize]) {
        Ok(actual) => actual,
        Err(_) => {
            record_test_final_path!(
                "identity.final_path_utf16_decode",
                "String::from_utf16",
                crate::handles::TestDiagnosticStatus::NoStatus,
                length,
                capacity,
                None,
                None,
            );
            return Err(native_failure(NativeErrorKind::PathApiFailure));
        }
    };
    let expected_drive = match parse_supported_absolute_path(expected_path) {
        Ok(parsed) => parsed.drive,
        Err(error) => {
            record_test_final_path!(
                "identity.final_path_expected_conversion",
                "parse_supported_absolute_path",
                crate::handles::TestDiagnosticStatus::NoStatus,
                length,
                capacity,
                Some(actual.as_str()),
                None,
            );
            return Err(error);
        }
    };
    if ascii_starts_with_ignore_case(&actual, r"\\?\Volume{") {
        record_test_final_path!(
            "identity.final_path_volume_rejected",
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            Some(actual.as_str()),
            None,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    if ascii_starts_with_ignore_case(&actual, r"\\?\UNC\")
        || ascii_starts_with_ignore_case(&actual, r"\\?\GLOBALROOT\")
        || ascii_starts_with_ignore_case(&actual, r"\\.\")
        || ascii_starts_with_ignore_case(&actual, r"\\GLOBALROOT\")
        || (actual.starts_with(r"\\") && !actual.starts_with(r"\\?\"))
        || final_path_drive(&actual) != Some(expected_drive)
    {
        record_test_final_path!(
            "identity.final_path_unc_rejected",
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            Some(actual.as_str()),
            None,
        );
        return Err(native_failure(NativeErrorKind::PathIdentityMismatch));
    }
    let expected = match expected_path.to_str() {
        Some(expected) => expected,
        None => {
            record_test_final_path!(
                "identity.final_path_expected_conversion",
                "Path::to_str",
                crate::handles::TestDiagnosticStatus::NoStatus,
                length,
                capacity,
                Some(actual.as_str()),
                None,
            );
            return Err(native_failure(NativeErrorKind::InvalidPath));
        }
    };
    let expected = expected.to_owned();
    let _expected = if expected.starts_with("\\\\?\\") {
        expected
    } else {
        format!("\\\\?\\{expected}")
    };
    // The final-path spelling is diagnostic only. Even an exact
    // case-insensitive string match must pass the independent handle-identity
    // probe; aliases are accepted only after volume/file-index equality and
    // the complete reparse-free ancestor chain have been proved.
    match probe_expected_path_identity(expected_path, expected_directory) {
        Ok(expected_identity) if expected_identity == actual_identity => {
            record_test_final_path_classified!(
                "identity.final_path_alias_same_object",
                "GetFinalPathNameByHandleW",
                crate::handles::TestDiagnosticStatus::NoStatus,
                length,
                capacity,
                Some(actual.as_str()),
                Some(_expected.as_str()),
                crate::handles::TestFinalPathClassification::SameVerifiedObject,
            );
            Ok(())
        }
        Ok(_) => {
            record_test_final_path_classified!(
                "identity.final_path_mismatch",
                "GetFinalPathNameByHandleW",
                crate::handles::TestDiagnosticStatus::NoStatus,
                length,
                capacity,
                Some(actual.as_str()),
                Some(_expected.as_str()),
                crate::handles::TestFinalPathClassification::DifferentObject,
            );
            Err(native_failure(NativeErrorKind::PathIdentityMismatch))
        }
        Err(ExpectedPathProbeFailure::Open {
            error: _error,
            status: _status,
        }) => {
            record_test_final_path_classified!(
                "identity.final_path_alias_probe_failed",
                "CreateFileW",
                probe_diagnostic_status(_status),
                length,
                capacity,
                Some(actual.as_str()),
                Some(_expected.as_str()),
                crate::handles::TestFinalPathClassification::ProbeOpenFailed,
            );
            Err(native_failure(NativeErrorKind::PathAliasProbeFailed))
        }
        Err(ExpectedPathProbeFailure::Identity {
            error: _error,
            status: _status,
        }) => {
            record_test_final_path_classified!(
                "identity.final_path_alias_probe_failed",
                "GetFileInformationByHandle",
                probe_diagnostic_status(_status),
                length,
                capacity,
                Some(actual.as_str()),
                Some(_expected.as_str()),
                crate::handles::TestFinalPathClassification::ProbeIdentityFailed,
            );
            Err(native_failure(NativeErrorKind::PathAliasProbeFailed))
        }
        Err(ExpectedPathProbeFailure::Attribute(_error)) => {
            record_test_final_path_classified!(
                "identity.final_path_alias_probe_failed",
                "GetFileInformationByHandle",
                crate::handles::TestDiagnosticStatus::NoStatus,
                length,
                capacity,
                Some(actual.as_str()),
                Some(_expected.as_str()),
                crate::handles::TestFinalPathClassification::ProbeAttributeRejected,
            );
            Err(native_failure(NativeErrorKind::PathIdentityMismatch))
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    #[cfg(feature = "test-support")]
    use std::{io, ptr};

    use super::{NativeErrorKind, bounded_utf16_length, validate_absolute_local_path};

    #[cfg(feature = "test-support")]
    fn create_directory_junction(link: &Path, target: &Path) -> io::Result<()> {
        use windows_sys::Win32::{
            Foundation::{CloseHandle, INVALID_HANDLE_VALUE},
            Storage::FileSystem::{
                CreateFileW, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
                FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, FILE_WRITE_ATTRIBUTES,
                OPEN_EXISTING,
            },
            System::IO::DeviceIoControl,
        };

        // The mount-point reparse buffer is deliberately local to this
        // qualification fixture. Production code never creates reparse
        // points; it rejects them.
        #[repr(C)]
        struct MountPointReparseData {
            substitute_name_offset: u16,
            substitute_name_length: u16,
            print_name_offset: u16,
            print_name_length: u16,
            path_buffer: [u16; 1024],
        }

        #[repr(C)]
        struct ReparseDataBuffer {
            reparse_tag: u32,
            reparse_data_length: u16,
            reserved: u16,
            mount_point: MountPointReparseData,
        }

        std::fs::create_dir(link)?;
        let target_text = target
            .to_str()
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target is not UTF-8"))?;
        let substitute = format!(r"\??\{target_text}");
        let substitute_units: Vec<u16> = substitute.encode_utf16().collect();
        let print_units: Vec<u16> = target_text.encode_utf16().collect();
        let path_units = substitute_units
            .len()
            .checked_add(1)
            .and_then(|value| value.checked_add(print_units.len()))
            .and_then(|value| value.checked_add(1))
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "junction path too long"))?;
        if path_units > 1024 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "junction path exceeds the bounded fixture buffer",
            ));
        }

        let mut buffer = ReparseDataBuffer {
            reparse_tag: 0xA0000003,
            reparse_data_length: u16::try_from(8usize + (path_units * 2))
                .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "junction too large"))?,
            reserved: 0,
            mount_point: MountPointReparseData {
                substitute_name_offset: 0,
                substitute_name_length: u16::try_from(substitute_units.len() * 2).map_err(
                    |_| io::Error::new(io::ErrorKind::InvalidInput, "junction too large"),
                )?,
                print_name_offset: u16::try_from((substitute_units.len() + 1) * 2).map_err(
                    |_| io::Error::new(io::ErrorKind::InvalidInput, "junction too large"),
                )?,
                print_name_length: u16::try_from(print_units.len() * 2).map_err(|_| {
                    io::Error::new(io::ErrorKind::InvalidInput, "junction too large")
                })?,
                path_buffer: [0; 1024],
            },
        };
        let mut offset = 0usize;
        buffer.mount_point.path_buffer[offset..offset + substitute_units.len()]
            .copy_from_slice(&substitute_units);
        offset += substitute_units.len() + 1;
        buffer.mount_point.path_buffer[offset..offset + print_units.len()]
            .copy_from_slice(&print_units);

        let link_wide = super::wide(
            link.to_str()
                .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "link is not UTF-8"))?,
        );
        // SAFETY: the path is NUL-terminated and the returned handle is used
        // only for the synchronous DeviceIoControl call below.
        let handle = unsafe {
            CreateFileW(
                link_wide.as_ptr(),
                FILE_WRITE_ATTRIBUTES,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                ptr::null(),
                OPEN_EXISTING,
                FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS,
                ptr::null_mut(),
            )
        };
        if handle.is_null() || handle == INVALID_HANDLE_VALUE {
            let error = io::Error::last_os_error();
            let _ = std::fs::remove_dir(link);
            return Err(error);
        }

        let mut returned = 0u32;
        // SAFETY: the reparse buffer is initialized, bounded, and remains
        // live for the complete synchronous call; the handle is valid.
        let ok = unsafe {
            DeviceIoControl(
                handle,
                589_988,
                (&buffer as *const ReparseDataBuffer).cast(),
                u32::try_from(16usize + (path_units * 2)).map_err(|_| {
                    io::Error::new(io::ErrorKind::InvalidInput, "junction too large")
                })?,
                ptr::null_mut(),
                0,
                &mut returned,
                ptr::null_mut(),
            )
        };
        let result = if ok == 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        };
        // SAFETY: this is the valid handle returned by CreateFileW.
        unsafe { CloseHandle(handle) };
        if result.is_err() {
            let _ = std::fs::remove_dir(link);
        }
        result
    }

    #[test]
    fn bounded_local_app_data_scan_requires_terminator_inside_limit() {
        let mut valid = vec![b'A' as u16; 32_768];
        valid[32_767] = 0;
        assert_eq!(bounded_utf16_length(valid.as_ptr()), Some(32_767));

        let unterminated = vec![b'A' as u16; 32_769];
        assert_eq!(bounded_utf16_length(unterminated.as_ptr()), None);

        let empty = [0u16];
        assert_eq!(bounded_utf16_length(empty.as_ptr()), None);
    }

    #[test]
    fn absolute_local_path_rejects_non_local_root_forms() {
        for path in [
            Path::new("relative-path"),
            Path::new(r"\\server\share\JARVIS"),
            Path::new(r"\\?\Volume{00000000-0000-0000-0000-000000000000}\JARVIS"),
            Path::new(r"C:\"),
            Path::new(r"C:\JARVIS\.\data"),
            Path::new(r"C:\JARVIS\..\other"),
            Path::new(r"C:\JARVIS\\data"),
            Path::new(r"C:/JARVIS/data"),
            Path::new(r"C:\JARVIS\data::stream"),
            Path::new(r"C:\GLOBALROOT\JARVIS"),
        ] {
            assert!(validate_absolute_local_path(path).is_err());
        }

        assert!(validate_absolute_local_path(Path::new(r"C:\JARVIS\data")).is_ok());
        assert!(validate_absolute_local_path(Path::new(r"C:\JARVIS\data\")).is_ok());
    }

    #[cfg(feature = "test-support")]
    #[test]
    fn trusted_path_chain_accepts_case_and_trailing_directory_aliases() {
        use super::{open_directory, validate_fixed_handle};

        let suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path =
            std::env::temp_dir().join(format!("JARVIS-PathAlias-{}-{suffix}", std::process::id()));
        std::fs::create_dir(&path).expect("path-alias fixture must be created");
        let handle = open_directory(&path, None).expect("path-alias fixture must open");
        let path_text = path.to_str().expect("path-alias fixture must be UTF-8");
        let case_alias = std::path::PathBuf::from(path_text.to_ascii_uppercase());
        let trailing_alias = std::path::PathBuf::from(format!("{path_text}\\"));

        validate_fixed_handle(&handle, &case_alias, true)
            .expect("case-only alias must pass stable identity validation");
        validate_fixed_handle(&handle, &trailing_alias, true)
            .expect("trailing-separator alias must pass stable identity validation");

        drop(handle);
        std::fs::remove_dir_all(path).expect("path-alias fixture must be removed");
    }

    #[cfg(feature = "test-support")]
    #[test]
    fn trusted_path_chain_rejects_intermediate_reparse_points() {
        use super::validate_trusted_path_chain;

        let suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let fixture = std::env::temp_dir().join(format!(
            "JARVIS-ReparseChain-{}-{suffix}",
            std::process::id()
        ));
        let real = fixture.join("real");
        let alias = fixture.join("alias");
        std::fs::create_dir_all(real.join("child")).expect("reparse-chain fixture must be created");
        create_directory_junction(&alias, &real).expect(
            "reparse-chain qualification requires the Windows test host to permit directory junctions",
        );

        let final_error = validate_trusted_path_chain(&alias, true)
            .expect_err("final reparse point must be rejected");
        assert_eq!(final_error.kind, NativeErrorKind::PathIdentityMismatch);

        let error = validate_trusted_path_chain(&alias.join("child"), true)
            .expect_err("intermediate reparse point must be rejected");
        assert_eq!(error.kind, NativeErrorKind::PathIdentityMismatch);

        std::fs::remove_dir(&alias).expect("junction fixture must be removed");
        std::fs::remove_dir_all(fixture).expect("reparse-chain fixture must be removed");
    }

    #[cfg(feature = "test-support")]
    #[test]
    fn validate_fixed_handle_requires_distinct_object_identity_proof() {
        use super::{open_directory, validate_fixed_handle};

        let suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let fixture = std::env::temp_dir().join(format!(
            "JARVIS-DistinctIdentity-{}-{suffix}",
            std::process::id()
        ));
        let first = fixture.join("first");
        let second = fixture.join("second");
        std::fs::create_dir_all(&first).expect("identity fixture must be created");
        std::fs::create_dir(&second).expect("identity fixture sibling must be created");
        let handle = open_directory(&first, None).expect("identity fixture must open");

        let error = validate_fixed_handle(&handle, &second, true)
            .expect_err("a distinct object must never pass a path spelling check");
        assert_eq!(error.kind, NativeErrorKind::PathIdentityMismatch);

        drop(handle);
        std::fs::remove_dir_all(fixture).expect("identity fixture must be removed");
    }

    #[cfg(feature = "test-support")]
    #[test]
    fn validate_fixed_handle_rejects_disappearing_expected_object() {
        use super::{open_directory, validate_fixed_handle};

        let suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let fixture = std::env::temp_dir().join(format!(
            "JARVIS-DisappearingIdentity-{}-{suffix}",
            std::process::id()
        ));
        let actual = fixture.join("actual");
        let expected = fixture.join("expected");
        std::fs::create_dir_all(&actual).expect("disappearing fixture must be created");
        std::fs::create_dir(&expected).expect("disappearing sibling must be created");
        let handle = open_directory(&actual, None).expect("disappearing fixture must open");
        std::fs::remove_dir(&expected).expect("expected object must be removed for the test");

        let error = validate_fixed_handle(&handle, &expected, true)
            .expect_err("missing expected object must fail closed");
        assert!(matches!(
            error.kind,
            NativeErrorKind::PathAliasProbeFailed | NativeErrorKind::PathIdentityMismatch
        ));

        drop(handle);
        std::fs::remove_dir_all(fixture).expect("disappearing fixture must be removed");
    }

    #[cfg(feature = "test-support")]
    #[test]
    fn handle_verified_short_name_alias_is_accepted_when_available() {
        use super::{open_directory, validate_fixed_handle, wide};
        use windows_sys::Win32::Storage::FileSystem::GetShortPathNameW;

        struct Cleanup(std::path::PathBuf);

        impl Drop for Cleanup {
            fn drop(&mut self) {
                let _ = std::fs::remove_dir_all(&self.0);
            }
        }

        let suffix = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "JARVIS-Long-Directory-Alias-Qualification-{}-{suffix}",
            std::process::id()
        ));
        std::fs::create_dir(&path).expect("short-name fixture must be created");
        let _cleanup = Cleanup(path.clone());
        let handle = open_directory(&path, None).expect("short-name fixture must open");
        let path_text = path.to_str().expect("short-name fixture must be UTF-8");
        let path_wide = wide(path_text);
        let mut short_path = vec![0u16; 32_768];
        // SAFETY: both buffers are NUL-terminated/writable for the duration
        // of the synchronous Windows API call.
        let length = unsafe {
            GetShortPathNameW(
                path_wide.as_ptr(),
                short_path.as_mut_ptr(),
                short_path.len() as u32,
            )
        };
        assert!(
            length > 0 && length < short_path.len() as u32,
            "short-name identity qualification is unavailable on this volume"
        );
        let short_path = String::from_utf16(&short_path[..length as usize])
            .expect("Windows short path must be valid UTF-16");
        assert!(
            !short_path.eq_ignore_ascii_case(path_text),
            "fixture did not produce a distinct short-name alias"
        );

        validate_fixed_handle(&handle, Path::new(&short_path), true)
            .expect("a verified short-name spelling must identify the same directory");
    }

    #[cfg(feature = "test-support")]
    #[test]
    fn final_path_diagnostic_stages_are_specific_and_redacted() {
        use crate::handles::{
            TestDiagnosticStatus, TestFinalPathClassification, format_test_failure_diagnostic,
            format_test_final_path_diagnostic, format_test_final_path_diagnostic_classified,
        };

        let actual = r#"\\?\C:\runner\JARVIS\"#;
        let expected = r#"\\?\C:\runner\Other"#;
        let cases = [
            (
                "identity.final_path_api_failure",
                TestDiagnosticStatus::Win32Error(5),
                true,
            ),
            (
                "identity.final_path_too_long",
                TestDiagnosticStatus::NoStatus,
                true,
            ),
            (
                "identity.final_path_unc_rejected",
                TestDiagnosticStatus::NoStatus,
                true,
            ),
            (
                "identity.final_path_utf16_decode",
                TestDiagnosticStatus::NoStatus,
                true,
            ),
            (
                "identity.final_path_expected_conversion",
                TestDiagnosticStatus::NoStatus,
                true,
            ),
            (
                "identity.final_path_mismatch",
                TestDiagnosticStatus::NoStatus,
                true,
            ),
        ];

        for (stage, status, includes_metadata) in cases {
            let diagnostic = format_test_final_path_diagnostic(
                stage,
                "GetFinalPathNameByHandleW",
                status,
                42,
                1024,
                Some(actual),
                Some(expected),
            );
            assert!(diagnostic.starts_with(&format!("stage={stage};")));
            assert!(diagnostic.contains("status_kind="));
            if includes_metadata {
                assert!(diagnostic.contains("returned_length=42;capacity=1024"));
                assert!(diagnostic.contains("actual_utf16_units="));
                assert!(diagnostic.contains("expected_utf16_units="));
                assert!(diagnostic.contains("actual_component_count=3"));
                assert!(diagnostic.contains("expected_component_count=3"));
                assert!(diagnostic.contains("actual_separator_count=6"));
                assert!(diagnostic.contains("expected_separator_count=5"));
                assert!(diagnostic.contains("first_differing_component=3"));
                assert!(diagnostic.contains("actual_differing_component_units=6"));
                assert!(diagnostic.contains("expected_differing_component_units=5"));
                assert!(diagnostic.contains("actual_prefix=DEVICE_DOS"));
                assert!(diagnostic.contains("expected_prefix=DEVICE_DOS"));
                assert!(diagnostic.contains("actual_trailing_separator=true"));
                assert!(diagnostic.contains("expected_trailing_separator=false"));
                assert!(
                    diagnostic.contains("actual_fingerprint=")
                        && !diagnostic.contains("actual_fingerprint=unavailable")
                );
                assert!(
                    diagnostic.contains("expected_fingerprint=")
                        && !diagnostic.contains("expected_fingerprint=unavailable")
                );
                assert!(
                    diagnostic.contains("actual_shape_fingerprint=")
                        && !diagnostic.contains("actual_shape_fingerprint=unavailable")
                );
                assert!(
                    diagnostic.contains("expected_shape_fingerprint=")
                        && !diagnostic.contains("expected_shape_fingerprint=unavailable")
                );
                assert!(!diagnostic.contains("runner"));
                assert!(!diagnostic.contains("Other"));
            }
        }

        let classified = format_test_final_path_diagnostic_classified(
            "identity.final_path_alias_same_object",
            "GetFinalPathNameByHandleW",
            TestDiagnosticStatus::NoStatus,
            42,
            1024,
            Some(actual),
            Some(expected),
            Some(TestFinalPathClassification::SameVerifiedObject),
        );
        assert!(classified.contains("classification=SAME_VERIFIED_OBJECT"));

        let diagnostic = format_test_failure_diagnostic(
            "identity.final_path_attribute_rejected",
            "GetFileInformationByHandle",
            TestDiagnosticStatus::NoStatus,
        );
        assert_eq!(
            diagnostic,
            "stage=identity.final_path_attribute_rejected;api=GetFileInformationByHandle;status_kind=NONE;status=none"
        );
    }

    #[cfg(feature = "test-support")]
    #[test]
    fn diagnostic_status_kinds_do_not_conflate_zero_with_no_status() {
        use crate::handles::{TestDiagnosticStatus, format_test_failure_diagnostic};

        let cases = [
            (
                TestDiagnosticStatus::Win32Error(0),
                "status_kind=WIN32_ERROR;status=0",
            ),
            (
                TestDiagnosticStatus::HResult(0),
                "status_kind=HRESULT;status=0",
            ),
            (
                TestDiagnosticStatus::ApiStatus(0),
                "status_kind=API_STATUS;status=0",
            ),
            (
                TestDiagnosticStatus::NoStatus,
                "status_kind=NONE;status=none",
            ),
        ];

        for (status, expected) in cases {
            assert!(
                format_test_failure_diagnostic("identity.test_status", "test", status)
                    .contains(expected)
            );
        }
    }
}
