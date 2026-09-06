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

pub(super) fn validate_absolute_local_path(path: &Path) -> Result<(), NativeError> {
    let text = path
        .to_str()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    if text.len() < 3
        || !text.as_bytes()[1..2].eq(b":")
        || !text.as_bytes()[2..3].eq(b"\\")
        || text.starts_with("\\\\")
        || text.contains("..")
        || text.contains('\0')
    {
        return Err(native_failure(NativeErrorKind::InvalidPath));
    }
    Ok(())
}

pub(super) fn identity(handle: &OwnedHandle) -> Result<FileIdentity, NativeError> {
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: the handle is owned and the output structure is valid for the
    // duration of the call.
    let ok = unsafe { GetFileInformationByHandle(handle.raw(), &mut info) };
    if ok == 0 {
        return Err(native_failure(NativeErrorKind::StateUnavailable));
    }
    Ok(FileIdentity {
        volume_serial: info.dwVolumeSerialNumber,
        file_index: (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
    })
}

pub(super) fn open_directory(
    path: &Path,
    _security: Option<&ExplicitSecurity>,
) -> Result<OwnedHandle, NativeError> {
    validate_absolute_local_path(path)?;
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
    let _native_error = last_error();
    if raw.is_null() || raw == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
        record_test_failure!("identity.open_directory", "CreateFileW", _native_error,);
    }
    let handle = OwnedHandle::from_raw(raw, NativeErrorKind::StateUnavailable)?;
    validate_directory_handle(&handle, path)?;
    Ok(handle)
}

pub(super) fn create_or_open_directory(
    path: &Path,
    security: &ExplicitSecurity,
    sid: &str,
) -> Result<OwnedHandle, NativeError> {
    validate_absolute_local_path(path)?;
    let path_text = path
        .to_str()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    let path_wide = wide(path_text);
    // SAFETY: the path and security descriptor remain valid for this call.
    let created = unsafe { CreateDirectoryW(path_wide.as_ptr(), security.as_ptr()) };
    let create_error = last_error();
    if created == 0 && create_error != windows_sys::Win32::Foundation::ERROR_ALREADY_EXISTS {
        record_test_failure!(
            "identity.create_directory",
            "CreateDirectoryW",
            create_error,
        );
        return Err(native_failure(NativeErrorKind::StateUnavailable));
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
    let root_path = path
        .parent()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    let parent_path = root_path
        .parent()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    let parent = open_directory(parent_path, None)?;
    let root = open_directory(root_path, None)?;
    if identity(&parent)? != expected_parent || identity(&root)? != expected_root {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    Ok(())
}

fn validate_fixed_handle(
    handle: &OwnedHandle,
    expected_path: &Path,
    expected_directory: bool,
) -> Result<(), NativeError> {
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: the handle is valid and the output structure is writable.
    let info_ok = unsafe { GetFileInformationByHandle(handle.raw(), &mut info) };
    let _info_error = last_error();
    if info_ok == 0 {
        record_test_failure!(
            "identity.validate_file_information",
            "GetFileInformationByHandle",
            _info_error,
        );
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
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }

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
    let _path_error = last_error();
    let capacity = final_path.len() as u32;
    if length == 0 {
        record_test_final_path!(
            "identity.final_path_api_failure",
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::Win32Error(_path_error),
            length,
            capacity,
            None,
            None,
        );
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
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
            return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
        }
    };
    if actual.starts_with("\\\\?\\UNC\\") {
        record_test_final_path!(
            "identity.final_path_unc_rejected",
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            Some(actual.as_str()),
            None,
        );
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
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
    let expected = if expected.starts_with("\\\\?\\") {
        expected
    } else {
        format!("\\\\?\\{expected}")
    };
    if !actual
        .trim_end_matches('\\')
        .eq_ignore_ascii_case(expected.trim_end_matches('\\'))
    {
        record_test_final_path!(
            "identity.final_path_mismatch",
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            Some(actual.as_str()),
            Some(expected.as_str()),
        );
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::bounded_utf16_length;

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

    #[cfg(feature = "test-support")]
    #[test]
    fn final_path_diagnostic_stages_are_specific_and_redacted() {
        use crate::handles::{
            TestDiagnosticStatus, format_test_failure_diagnostic, format_test_final_path_diagnostic,
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
                assert!(diagnostic.contains("actual_prefix=DEVICE_DOS"));
                assert!(diagnostic.contains("expected_prefix=DEVICE_DOS"));
                assert!(diagnostic.contains("actual_trailing_separator=true"));
                assert!(diagnostic.contains("expected_trailing_separator=false"));
                assert!(!diagnostic.contains("runner"));
                assert!(!diagnostic.contains("Other"));
            }
        }

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
