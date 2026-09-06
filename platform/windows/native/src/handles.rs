use std::{
    ffi::OsStr,
    os::windows::ffi::OsStrExt,
    ptr::NonNull,
    sync::atomic::{AtomicBool, Ordering},
};

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

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_STATE_UNLOCK: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_EVENT_SIGNAL: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_MUTEX_WAIT: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_MUTEX_RELEASE: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) fn fail_next_state_unlock_for_test() {
    FAIL_NEXT_STATE_UNLOCK.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn fail_next_event_signal_for_test() {
    FAIL_NEXT_EVENT_SIGNAL.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn fail_next_mutex_wait_for_test() {
    FAIL_NEXT_MUTEX_WAIT.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn fail_next_mutex_release_for_test() {
    FAIL_NEXT_MUTEX_RELEASE.store(true, Ordering::Release);
}

#[derive(Debug)]
pub(super) struct OwnedHandle {
    raw: NonNull<std::ffi::c_void>,
    closed: AtomicBool,
}

impl OwnedHandle {
    pub(super) fn from_raw(raw: HANDLE, kind: NativeErrorKind) -> Result<Self, NativeError> {
        NonNull::new(raw)
            .filter(|_| raw != INVALID_HANDLE_VALUE)
            .map(|raw| Self {
                raw,
                closed: AtomicBool::new(false),
            })
            .ok_or_else(|| native_failure(kind))
    }

    pub(super) fn raw(&self) -> HANDLE {
        self.raw.as_ptr()
    }

    pub(super) fn close(&self) -> Result<(), ()> {
        if self.closed.swap(true, Ordering::AcqRel) {
            return Ok(());
        }
        // SAFETY: the handle was accepted from a successful Win32 creator and
        // this method is the sole explicit close path.
        if unsafe { CloseHandle(self.raw()) } == 0 {
            self.closed.store(false, Ordering::Release);
            Err(())
        } else {
            Ok(())
        }
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
        let _ = self.close();
    }
}

#[derive(Debug)]
pub(super) struct OwnedMutex {
    handle: Option<OwnedHandle>,
    owned: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum MutexWaitResult {
    Acquired,
    Abandoned,
    Timeout,
}

impl OwnedMutex {
    pub(super) fn new(handle: OwnedHandle) -> Self {
        Self {
            handle: Some(handle),
            // CreateMutexW is deliberately called with bInitialOwner=FALSE.
            // Ownership becomes true only after this value's arbitration
            // thread receives WAIT_OBJECT_0 or WAIT_ABANDONED.
            owned: false,
        }
    }

    pub(super) fn wait(&mut self, timeout_ms: u32) -> Result<MutexWaitResult, NativeError> {
        #[cfg(feature = "test-support")]
        if FAIL_NEXT_MUTEX_WAIT.swap(false, Ordering::AcqRel) {
            return Err(native_failure(NativeErrorKind::ArbitrationUnavailable));
        }
        // SAFETY: the mutex handle is owned by this value and remains live for
        // the synchronous bounded wait.
        let result = unsafe {
            WaitForSingleObject(
                self.handle
                    .as_ref()
                    .expect("owned mutex handle must remain present")
                    .raw(),
                timeout_ms,
            )
        };
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

    pub(super) fn release(&mut self) -> Result<(), NativeError> {
        if !self.owned {
            return Ok(());
        }
        #[cfg(feature = "test-support")]
        if FAIL_NEXT_MUTEX_RELEASE.swap(false, Ordering::AcqRel) {
            return Err(native_failure(NativeErrorKind::ArbitrationReleaseUncertain));
        }
        // SAFETY: the arbitration thread owns the mutex for the complete
        // synchronous release operation.
        if unsafe {
            ReleaseMutex(
                self.handle
                    .as_ref()
                    .expect("owned mutex handle must remain present")
                    .raw(),
            )
        } == 0
        {
            return Err(native_failure(NativeErrorKind::ArbitrationReleaseUncertain));
        }
        self.owned = false;
        Ok(())
    }
}

impl Drop for OwnedMutex {
    fn drop(&mut self) {
        if self.owned {
            // An unresolved owned mutex must not be released implicitly by a
            // destructor: closing its handle would let a new process acquire
            // authority while the old lifecycle is still ambiguous. Leak the
            // kernel handle on this fail-closed fallback; explicit release is
            // the only path that clears `owned`.
            if let Some(handle) = self.handle.take() {
                std::mem::forget(handle);
            }
        }
    }
}

#[derive(Debug)]
pub(super) struct StateLock<'a> {
    pub(super) handle: &'a OwnedHandle,
    cleanup_failed: &'a AtomicBool,
    released: bool,
}

impl<'a> StateLock<'a> {
    pub(super) fn new(handle: &'a OwnedHandle, cleanup_failed: &'a AtomicBool) -> Self {
        Self {
            handle,
            cleanup_failed,
            released: false,
        }
    }

    pub(super) fn mark_released(&mut self) {
        self.released = true;
    }

    pub(super) fn mark_cleanup_failed(&self) {
        self.cleanup_failed.store(true, Ordering::Release);
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
                let ok = windows_sys::Win32::Storage::FileSystem::UnlockFileEx(
                    self.handle.raw(),
                    0,
                    1,
                    0,
                    &mut overlapped,
                );
                if ok == 0 {
                    // All normal paths explicitly release StateLock and can
                    // surface LockUncertain. Reaching this fallback means
                    // cleanup itself is no longer reportable to the caller;
                    // Do not claim success or abort the process from a
                    // destructor. Persist the uncertainty on the StateFile so
                    // the next operation fails closed instead of silently
                    // treating the unlock as complete.
                    self.cleanup_failed.store(true, Ordering::Release);
                }
            }
        }
    }
}
