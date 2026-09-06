use std::path::{Path, PathBuf};

use windows_sys::Win32::{
    Foundation::{HANDLE, HWND},
    Storage::FileSystem::{
        BY_HANDLE_FILE_INFORMATION, CreateDirectoryW, CreateFileW, FILE_ATTRIBUTE_DIRECTORY,
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
        FILE_READ_ATTRIBUTES, FILE_SHARE_READ, FILE_SHARE_WRITE, GetFileInformationByHandle,
        GetFinalPathNameByHandleW, OPEN_EXISTING, READ_CONTROL, SYNCHRONIZE, WRITE_DAC,
    },
    UI::Shell::{CSIDL_LOCAL_APPDATA, SHGetFolderPathW},
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
        validate_absolute_local_path(&path)?;
        return Ok(path);
    }

    let mut buffer = [0u16; 512];
    // SAFETY: the output buffer is writable and its capacity is explicitly
    // supplied by the fixed-size stack allocation.
    let result = unsafe {
        SHGetFolderPathW(
            0 as HWND,
            CSIDL_LOCAL_APPDATA as i32,
            0 as HANDLE,
            0,
            buffer.as_mut_ptr(),
        )
    };
    if result < 0 {
        return Err(native_failure(NativeErrorKind::LocalAppDataUnavailable));
    }

    let length = buffer.iter().position(|value| *value == 0).unwrap_or(0);
    if length == 0 {
        return Err(native_failure(NativeErrorKind::InvalidPath));
    }
    let path = String::from_utf16(&buffer[..length])
        .map(PathBuf::from)
        .map_err(|_| native_failure(NativeErrorKind::InvalidPath))?;
    validate_absolute_local_path(&path)?;
    Ok(path)
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
    security: Option<&ExplicitSecurity>,
) -> Result<OwnedHandle, NativeError> {
    validate_absolute_local_path(path)?;
    let path = path
        .to_str()
        .ok_or_else(|| native_failure(NativeErrorKind::InvalidPath))?;
    let path = wide(path);
    // SAFETY: the path and optional security descriptor are NUL-terminated and
    // live for the complete synchronous call.
    let raw = unsafe {
        CreateFileW(
            path.as_ptr(),
            FILE_READ_ATTRIBUTES | READ_CONTROL | SYNCHRONIZE | WRITE_DAC,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            security.map_or(std::ptr::null(), ExplicitSecurity::as_ptr),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            std::ptr::null_mut(),
        )
    };
    let handle = OwnedHandle::from_raw(raw, NativeErrorKind::StateUnavailable)?;
    validate_directory_handle(&handle, path.as_ptr())?;
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
        return Err(native_failure(NativeErrorKind::StateUnavailable));
    }
    let handle = open_directory(path, None)?;
    security.apply_to_handle(
        &handle,
        windows_sys::Win32::Security::Authorization::SE_FILE_OBJECT,
    )?;
    security.validate_handle(&handle, sid)?;
    Ok(handle)
}

fn validate_directory_handle(
    handle: &OwnedHandle,
    expected_path: *const u16,
) -> Result<(), NativeError> {
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: the handle is valid and the output structure is writable.
    if unsafe { GetFileInformationByHandle(handle.raw(), &mut info) } == 0 {
        return Err(native_failure(NativeErrorKind::StateUnavailable));
    }
    if (info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0
        || (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0
    {
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
    if length == 0 || length >= final_path.len() as u32 {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    let actual = String::from_utf16(&final_path[..length as usize])
        .map_err(|_| native_failure(NativeErrorKind::SecurityBoundaryUnavailable))?;
    if actual.starts_with("\\\\?\\UNC\\") {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    // SAFETY: expected_path points to the NUL-terminated buffer created by
    // `wide` for this synchronous validation call.
    let expected = unsafe {
        let mut length = 0usize;
        while *expected_path.add(length) != 0 {
            length += 1;
        }
        String::from_utf16(std::slice::from_raw_parts(expected_path, length))
            .map_err(|_| native_failure(NativeErrorKind::InvalidPath))?
    };
    let expected = if expected.starts_with("\\\\?\\") {
        expected
    } else {
        format!("\\\\?\\{expected}")
    };
    if !actual
        .trim_end_matches('\\')
        .eq_ignore_ascii_case(expected.trim_end_matches('\\'))
    {
        return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
    }
    Ok(())
}
