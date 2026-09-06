use std::{ffi::OsStr, os::windows::ffi::OsStrExt, ptr::NonNull};

use windows_sys::Win32::{
    Foundation::{
        CloseHandle, GetLastError, HANDLE, INVALID_HANDLE_VALUE, WAIT_ABANDONED, WAIT_FAILED,
        WAIT_OBJECT_0, WAIT_TIMEOUT, WIN32_ERROR,
    },
    System::Threading::{ReleaseMutex, WaitForSingleObject},
};

use super::{NativeError, NativeErrorKind};

pub(super) fn wide(value: &str) -> Vec<u16> {
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

pub(super) fn last_error() -> WIN32_ERROR {
    // SAFETY: GetLastError has no pointer or handle precondition.
    unsafe { GetLastError() }
}

pub(super) fn native_failure(kind: NativeErrorKind) -> NativeError {
    NativeError { kind }
}

#[derive(Debug)]
pub(super) struct OwnedHandle(NonNull<std::ffi::c_void>);

impl OwnedHandle {
    pub(super) fn from_raw(raw: HANDLE, kind: NativeErrorKind) -> Result<Self, NativeError> {
        NonNull::new(raw)
            .filter(|_| raw != INVALID_HANDLE_VALUE)
            .map(Self)
            .ok_or_else(|| native_failure(kind))
    }

    pub(super) fn raw(&self) -> HANDLE {
        self.0.as_ptr()
    }
}

// Windows kernel handles are process-owned, reference-counted kernel objects.
// The state file is serialized by the StateLock and the event/mutex operations
// are individually thread-safe. These impls are limited to this native module;
// raw handles never cross the safe crate boundary.
// SAFETY: Windows kernel handles are process-owned and their operations are
// synchronized by the owning state/event protocols before crossing threads.
unsafe impl Send for OwnedHandle {}
// SAFETY: the native owner serializes state mutation and uses thread-safe
// kernel event operations; no raw handle crosses the safe crate boundary.
unsafe impl Sync for OwnedHandle {}

impl Drop for OwnedHandle {
    fn drop(&mut self) {
        // SAFETY: the handle was accepted from a successful Win32 creator and
        // is closed exactly once here.
        unsafe {
            let _ = CloseHandle(self.raw());
        }
    }
}

#[derive(Debug)]
pub(super) struct OwnedMutex {
    handle: OwnedHandle,
    owned: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum MutexWaitResult {
    Acquired,
    Abandoned,
    Timeout,
}

impl OwnedMutex {
    pub(super) fn new(handle: OwnedHandle, owned: bool) -> Self {
        Self { handle, owned }
    }

    pub(super) fn wait(&mut self, timeout_ms: u32) -> Result<MutexWaitResult, NativeError> {
        // SAFETY: the mutex handle is owned by this value and remains live for
        // the synchronous bounded wait.
        let result = unsafe { WaitForSingleObject(self.handle.raw(), timeout_ms) };
        match result {
            WAIT_OBJECT_0 => {
                self.owned = true;
                Ok(MutexWaitResult::Acquired)
            }
            WAIT_ABANDONED => {
                self.owned = true;
                Ok(MutexWaitResult::Abandoned)
            }
            WAIT_TIMEOUT => Ok(MutexWaitResult::Timeout),
            WAIT_FAILED => Err(native_failure(NativeErrorKind::ArbitrationUnavailable)),
            _ => Err(native_failure(NativeErrorKind::ArbitrationUnavailable)),
        }
    }
}

impl Drop for OwnedMutex {
    fn drop(&mut self) {
        if self.owned {
            // SAFETY: this mutex was acquired by CreateMutexW with initial
            // ownership and is released once before the handle closes.
            unsafe {
                let _ = ReleaseMutex(self.handle.raw());
            }
            self.owned = false;
        }
    }
}

#[derive(Debug)]
pub(super) struct StateLock<'a> {
    pub(super) handle: &'a OwnedHandle,
    released: bool,
}

impl<'a> StateLock<'a> {
    pub(super) fn new(handle: &'a OwnedHandle) -> Self {
        Self {
            handle,
            released: false,
        }
    }

    pub(super) fn mark_released(&mut self) {
        self.released = true;
    }
}

impl Drop for StateLock<'_> {
    fn drop(&mut self) {
        if !self.released {
            // SAFETY: the lock is owned by this process and the range is the
            // one-byte state lock used by the bounded state protocol.
            unsafe {
                let mut overlapped =
                    std::mem::zeroed::<windows_sys::Win32::System::IO::OVERLAPPED>();
                let _ = windows_sys::Win32::Storage::FileSystem::UnlockFileEx(
                    self.handle.raw(),
                    0,
                    1,
                    0,
                    &mut overlapped,
                );
            }
        }
    }
}
