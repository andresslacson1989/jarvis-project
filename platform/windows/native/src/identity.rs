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
    if raw.is_null() || raw == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
        #[cfg(feature = "test-support")]
        {
            let error = last_error();
            record_test_failure!("identity.open_directory", "CreateFileW", error,);
        }
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
    let create_error = if created == 0 { last_error() } else { 0 };
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
    let parent = match open_directory(parent_path, None) {
        Ok(handle) => handle,
        Err(error) => {
            record_test_failure!("identity.ancestor_parent_open", "open_directory", 0,);
            return Err(error);
        }
    };
    let root = match open_directory(root_path, None) {
        Ok(handle) => handle,
        Err(error) => {
            record_test_failure!("identity.ancestor_root_open", "open_directory", 0,);
            return Err(error);
        }
    };
    let parent_identity = identity_with_stage(&parent, "identity.ancestor_parent_identity")?;
    let root_identity = identity_with_stage(&root, "identity.ancestor_root_identity")?;
    if parent_identity != expected_parent {
        record_test_failure!(
            "identity.ancestor_parent_mismatch",
            "FileIdentity::compare",
            0,
        );
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    if root_identity != expected_root {
        record_test_failure!(
            "identity.ancestor_root_mismatch",
            "FileIdentity::compare",
            0,
        );
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
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
    if let Err(error) = validate_absolute_local_path(expected_path) {
        return Err(ExpectedPathProbeFailure::Open {
            error,
            status: None,
        });
    }
    let path_text = match expected_path.to_str() {
        Some(path) => path,
        None => {
            return Err(ExpectedPathProbeFailure::Open {
                error: native_failure(NativeErrorKind::InvalidPath),
                status: None,
            });
        }
    };
    let path_wide = wide(path_text);
    let flags = FILE_FLAG_OPEN_REPARSE_POINT
        | if expected_directory {
            FILE_FLAG_BACKUP_SEMANTICS
        } else {
            0
        };
    // SAFETY: the path is NUL-terminated and all output/handle arguments are
    // valid for the complete synchronous call.
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
        let status = last_error();
        return Err(ExpectedPathProbeFailure::Open {
            error: native_failure(NativeErrorKind::SecurityBoundaryUnavailable),
            status: Some(status),
        });
    }
    let handle = match OwnedHandle::from_raw(raw, NativeErrorKind::SecurityBoundaryUnavailable) {
        Ok(handle) => handle,
        Err(error) => {
            return Err(ExpectedPathProbeFailure::Open {
                error,
                status: None,
            });
        }
    };
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: the probe handle is valid and the output structure is writable.
    if unsafe { GetFileInformationByHandle(handle.raw(), &mut info) } == 0 {
        let status = last_error();
        return Err(ExpectedPathProbeFailure::Identity {
            error: native_failure(NativeErrorKind::SecurityBoundaryUnavailable),
            status: Some(status),
        });
    }
    let is_directory = (info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
    if is_directory != expected_directory
        || (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0
    {
        return Err(ExpectedPathProbeFailure::Attribute(native_failure(
            NativeErrorKind::SecurityBoundaryUnavailable,
        )));
    }
    Ok(FileIdentity {
        volume_serial: info.dwVolumeSerialNumber,
        file_index: (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
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
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
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
    if actual.starts_with("\\\\?\\Volume{") {
        record_test_final_path!(
            "identity.final_path_volume_rejected",
            "GetFinalPathNameByHandleW",
            crate::handles::TestDiagnosticStatus::NoStatus,
            length,
            capacity,
            Some(actual.as_str()),
            None,
        );
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
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
        match probe_expected_path_identity(expected_path, expected_directory) {
            Ok(expected_identity) if expected_identity == actual_identity => {
                record_test_final_path_classified!(
                    "identity.final_path_alias_same_object",
                    "GetFinalPathNameByHandleW",
                    crate::handles::TestDiagnosticStatus::NoStatus,
                    length,
                    capacity,
                    Some(actual.as_str()),
                    Some(expected.as_str()),
                    crate::handles::TestFinalPathClassification::SameVerifiedObject,
                );
                return Ok(());
            }
            Ok(_) => {
                record_test_final_path_classified!(
                    "identity.final_path_mismatch",
                    "GetFinalPathNameByHandleW",
                    crate::handles::TestDiagnosticStatus::NoStatus,
                    length,
                    capacity,
                    Some(actual.as_str()),
                    Some(expected.as_str()),
                    crate::handles::TestFinalPathClassification::DifferentObject,
                );
            }
            Err(ExpectedPathProbeFailure::Open {
                error,
                status: _status,
            }) => {
                record_test_final_path_classified!(
                    "identity.final_path_alias_probe_failed",
                    "CreateFileW",
                    probe_diagnostic_status(_status),
                    length,
                    capacity,
                    Some(actual.as_str()),
                    Some(expected.as_str()),
                    crate::handles::TestFinalPathClassification::ProbeOpenFailed,
                );
                return Err(error);
            }
            Err(ExpectedPathProbeFailure::Identity {
                error,
                status: _status,
            }) => {
                record_test_final_path_classified!(
                    "identity.final_path_alias_probe_failed",
                    "GetFileInformationByHandle",
                    probe_diagnostic_status(_status),
                    length,
                    capacity,
                    Some(actual.as_str()),
                    Some(expected.as_str()),
                    crate::handles::TestFinalPathClassification::ProbeIdentityFailed,
                );
                return Err(error);
            }
            Err(ExpectedPathProbeFailure::Attribute(error)) => {
                record_test_final_path_classified!(
                    "identity.final_path_alias_probe_failed",
                    "GetFileInformationByHandle",
                    crate::handles::TestDiagnosticStatus::NoStatus,
                    length,
                    capacity,
                    Some(actual.as_str()),
                    Some(expected.as_str()),
                    crate::handles::TestFinalPathClassification::ProbeAttributeRejected,
                );
                return Err(error);
            }
        }
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{bounded_utf16_length, validate_absolute_local_path};

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
            Path::new(r"C:\JARVIS\..\other"),
        ] {
            assert!(validate_absolute_local_path(path).is_err());
        }

        assert!(validate_absolute_local_path(Path::new(r"C:\JARVIS\data")).is_ok());
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
        if length == 0 || length >= short_path.len() as u32 {
            return;
        }
        let short_path = String::from_utf16(&short_path[..length as usize])
            .expect("Windows short path must be valid UTF-16");
        if short_path.eq_ignore_ascii_case(path_text) {
            return;
        }

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
