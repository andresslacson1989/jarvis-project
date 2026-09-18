use std::{
    ptr,
    sync::atomic::{AtomicBool, Ordering},
    thread::sleep,
    time::{Duration, Instant},
};

use sha2::{Digest, Sha256};
use windows_sys::Win32::{
    Foundation::{ERROR_LOCK_VIOLATION, ERROR_SHARING_VIOLATION, GENERIC_READ, GENERIC_WRITE},
    Storage::FileSystem::{
        BY_HANDLE_FILE_INFORMATION, CREATE_NEW, CreateFileW, FILE_ATTRIBUTE_DIRECTORY,
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_BEGIN, FILE_FLAG_DELETE_ON_CLOSE,
        FILE_FLAG_OPEN_REPARSE_POINT, FILE_FLAG_WRITE_THROUGH, FILE_SHARE_DELETE, FILE_SHARE_READ,
        FILE_SHARE_WRITE, FlushFileBuffers, GetFileInformationByHandle, GetFileSizeEx,
        LOCKFILE_EXCLUSIVE_LOCK, LOCKFILE_FAIL_IMMEDIATELY, LockFileEx, OPEN_EXISTING, ReadFile,
        SYNCHRONIZE, SetEndOfFile, SetFilePointerEx, UnlockFileEx, WriteFile,
    },
    System::IO::OVERLAPPED,
};

use super::{
    NativeError, NativeErrorKind, OWNER_STATE_SCHEMA_VERSION,
    handles::{OwnedHandle, StateLock, last_error, native_failure, wide},
    identity::{self, FileIdentity},
    security::ExplicitSecurity,
};

pub(super) const ROLE_NORMAL: u8 = 1;
pub(super) const ROLE_MAINTENANCE: u8 = 2;
pub(super) const STATE_IDLE: u8 = 0;
pub(super) const STATE_PENDING: u8 = 1;
pub(super) const STATE_ACKNOWLEDGED: u8 = 2;
pub(super) const STATUS_NONE: u32 = 0;
pub(super) const STATUS_HANDLED: u32 = 1;
pub(super) const STATUS_CALLBACK_QUEUED: u32 = 2;
pub(super) const STATUS_CALLBACK_RUNNING: u32 = 3;
pub(super) const STATUS_CANCEL_REQUESTED: u32 = 4;
pub(super) const STATUS_UNCERTAIN: u32 = 5;
pub(super) const STATUS_CANCELLED: u32 = 6;

const HEADER_SIZE: usize = 32;
const SLOT_SIZE: usize = 512;
const FILE_SIZE: usize = HEADER_SIZE + (2 * SLOT_SIZE);
const SLOT_MAGIC: [u8; 8] = *b"JRV-SLOT";
const FILE_MAGIC: [u8; 8] = *b"JRV-STAT";
const COMMIT_MARKER: [u8; 8] = *b"COMMIT01";
const CHECKSUM_OFFSET: usize = 228;
const COMMIT_OFFSET: usize = 260;
const FIXED_BACKOFF_MS: [u64; 5] = [10, 25, 50, 100, 200];
const LOCK_DEADLINE: Duration = Duration::from_millis(500);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct StateRecord {
    pub(super) role: u8,
    pub(super) generation: u64,
    pub(super) parent: FileIdentity,
    pub(super) root: FileIdentity,
    pub(super) pid: u32,
    pub(super) start_filetime: u64,
    pub(super) session: u32,
    pub(super) sid_hash: [u8; 32],
    pub(super) nonce: [u8; 16],
    pub(super) readiness: u8,
    pub(super) state: u8,
    pub(super) status: u32,
    pub(super) request_generation: u64,
    pub(super) ack_generation: u64,
    pub(super) request_pid: u32,
    pub(super) request_start_filetime: u64,
    pub(super) request_session: u32,
    pub(super) request_sid_hash: [u8; 32],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct OwnerIdentity {
    pub(super) parent: FileIdentity,
    pub(super) root: FileIdentity,
    pub(super) pid: u32,
    pub(super) start_filetime: u64,
    pub(super) session: u32,
    pub(super) sid_hash: [u8; 32],
    pub(super) nonce: [u8; 16],
}

impl StateRecord {
    pub(super) fn new(role: u8, identity: OwnerIdentity) -> Self {
        Self {
            role,
            generation: 1,
            parent: identity.parent,
            root: identity.root,
            pid: identity.pid,
            start_filetime: identity.start_filetime,
            session: identity.session,
            sid_hash: identity.sid_hash,
            nonce: identity.nonce,
            readiness: 0,
            state: STATE_IDLE,
            status: STATUS_NONE,
            request_generation: 0,
            ack_generation: 0,
            request_pid: 0,
            request_start_filetime: 0,
            request_session: 0,
            request_sid_hash: [0; 32],
        }
    }

    fn encode(self, committed: bool) -> [u8; SLOT_SIZE] {
        let mut slot = [0u8; SLOT_SIZE];
        slot[0..8].copy_from_slice(&SLOT_MAGIC);
        slot[8..12].copy_from_slice(&OWNER_STATE_SCHEMA_VERSION.to_le_bytes());
        put_u64(&mut slot, 12, self.generation);
        put_identity(&mut slot, 20, self.parent);
        put_identity(&mut slot, 32, self.root);
        put_u32(&mut slot, 44, self.pid);
        put_u64(&mut slot, 48, self.start_filetime);
        put_u32(&mut slot, 56, self.session);
        slot[60..92].copy_from_slice(&self.sid_hash);
        slot[92..108].copy_from_slice(&self.nonce);
        slot[108] = self.readiness;
        slot[109] = self.state;
        slot[110] = self.role;
        put_u32(&mut slot, 112, self.status);
        put_u64(&mut slot, 116, self.request_generation);
        put_u64(&mut slot, 124, self.ack_generation);
        put_u32(&mut slot, 132, self.request_pid);
        put_u64(&mut slot, 136, self.request_start_filetime);
        put_u32(&mut slot, 144, self.request_session);
        slot[148..180].copy_from_slice(&self.request_sid_hash);

        let checksum = Sha256::digest(&slot[..CHECKSUM_OFFSET]);
        slot[CHECKSUM_OFFSET..COMMIT_OFFSET].copy_from_slice(&checksum);
        if committed {
            slot[COMMIT_OFFSET..COMMIT_OFFSET + COMMIT_MARKER.len()]
                .copy_from_slice(&COMMIT_MARKER);
        }
        slot
    }

    fn decode(slot: &[u8]) -> Result<Option<Self>, NativeError> {
        if slot.len() != SLOT_SIZE || slot.iter().all(|value| *value == 0) {
            return Ok(None);
        }
        if slot[0..8] != SLOT_MAGIC
            || u32_at(slot, 8) != OWNER_STATE_SCHEMA_VERSION
            || slot[COMMIT_OFFSET..COMMIT_OFFSET + COMMIT_MARKER.len()] != COMMIT_MARKER
            || slot[COMMIT_OFFSET + COMMIT_MARKER.len()..]
                .iter()
                .any(|value| *value != 0)
        {
            return Ok(None);
        }
        let expected = Sha256::digest(&slot[..CHECKSUM_OFFSET]);
        if slot[CHECKSUM_OFFSET..COMMIT_OFFSET] != expected[..] {
            return Ok(None);
        }

        let state = Self {
            generation: u64_at(slot, 12),
            parent: identity_at(slot, 20),
            root: identity_at(slot, 32),
            pid: u32_at(slot, 44),
            start_filetime: u64_at(slot, 48),
            session: u32_at(slot, 56),
            sid_hash: array_at::<32>(slot, 60),
            nonce: array_at::<16>(slot, 92),
            readiness: slot[108],
            state: slot[109],
            status: u32_at(slot, 112),
            request_generation: u64_at(slot, 116),
            ack_generation: u64_at(slot, 124),
            request_pid: u32_at(slot, 132),
            request_start_filetime: u64_at(slot, 136),
            request_session: u32_at(slot, 144),
            request_sid_hash: array_at::<32>(slot, 148),
            role: slot[110],
        };
        let owner_identity_invalid = state.parent.volume_serial == 0
            || state.parent.file_index == 0
            || state.root.volume_serial == 0
            || state.root.file_index == 0
            || state.pid == 0
            || state.start_filetime == 0
            || state.session == 0
            || state.sid_hash == [0; 32]
            || state.nonce == [0; 16];
        let request_identity_invalid = state.request_generation == 0
            || state.request_pid == 0
            || state.request_start_filetime == 0
            || state.request_session == 0
            || state.request_sid_hash == [0; 32];
        let pending_status_invalid = !matches!(
            state.status,
            STATUS_NONE
                | STATUS_CALLBACK_QUEUED
                | STATUS_CALLBACK_RUNNING
                | STATUS_CANCEL_REQUESTED
                | STATUS_UNCERTAIN
        );
        if state.generation == 0
            || owner_identity_invalid
            || !(state.role == ROLE_NORMAL || state.role == ROLE_MAINTENANCE)
            || state.readiness > 1
            || state.state > STATE_ACKNOWLEDGED
            || (state.state == STATE_IDLE
                && (state.status != STATUS_NONE
                    || state.request_generation != 0
                    || state.ack_generation != 0
                    || state.request_pid != 0
                    || state.request_start_filetime != 0
                    || state.request_session != 0
                    || state.request_sid_hash != [0; 32]))
            || (state.state == STATE_PENDING
                && (pending_status_invalid
                    || state.request_generation == 0
                    || state.ack_generation != 0
                    || request_identity_invalid))
            || (state.state == STATE_ACKNOWLEDGED
                && (state.status != STATUS_HANDLED && state.status != STATUS_CANCELLED
                    || state.request_generation == 0
                    || state.ack_generation != state.request_generation
                    || request_identity_invalid))
        {
            return Ok(None);
        }
        Ok(Some(state))
    }
}

#[derive(Debug)]
pub(super) struct StateFile {
    handle: OwnedHandle,
    path: std::path::PathBuf,
    expected_parent: FileIdentity,
    expected_root: FileIdentity,
    lock_cleanup_failed: AtomicBool,
}

impl StateFile {
    pub(super) fn create_owner(
        path: &std::path::Path,
        security: &ExplicitSecurity,
        sid: &str,
        expected_parent: FileIdentity,
        expected_root: FileIdentity,
        initial: StateRecord,
    ) -> Result<Self, NativeError> {
        identity::validate_parent_path_chain(path)?;
        let path_text = path.to_str().ok_or_else(|| {
            record_test_failure!("state.create_owner_path", "Path::to_str", 0);
            native_failure(NativeErrorKind::InvalidPath)
        })?;
        let path_wide = wide(path_text);
        // SAFETY: the path and security descriptor remain valid for the
        // synchronous CreateFileW call.
        let raw = unsafe {
            CreateFileW(
                path_wide.as_ptr(),
                GENERIC_READ
                    | GENERIC_WRITE
                    | windows_sys::Win32::Storage::FileSystem::DELETE
                    | SYNCHRONIZE,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                security.as_ptr(),
                CREATE_NEW,
                FILE_FLAG_DELETE_ON_CLOSE | FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_WRITE_THROUGH,
                ptr::null_mut(),
            )
        };
        let _native_error = last_error();
        if raw.is_null() || raw == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            record_test_failure!("state.create_owner_file", "CreateFileW", _native_error);
        }
        let handle = OwnedHandle::from_raw(raw, NativeErrorKind::StateUnavailable)?;
        let state = Self {
            handle,
            path: path.to_owned(),
            expected_parent,
            expected_root,
            lock_cleanup_failed: AtomicBool::new(false),
        };
        state.validate_regular_file()?;
        identity::validate_file_handle(&state.handle, path)?;
        identity::validate_ancestor_identities(path, expected_parent, expected_root)?;
        security.validate_handle(
            &state.handle,
            sid,
            windows_sys::Win32::Security::Authorization::SE_FILE_OBJECT,
        )?;
        state.set_length()?;
        state.write_initial(initial)?;
        Ok(state)
    }

    pub(super) fn open_client(
        path: &std::path::Path,
        security: &ExplicitSecurity,
        sid: &str,
        expected_parent: FileIdentity,
        expected_root: FileIdentity,
    ) -> Result<Self, NativeError> {
        // The state file may legitimately disappear while an abandoned owner
        // releases DELETE_ON_CLOSE. Validate the full trusted chain after the
        // handle is opened so that this preflight preserves the bounded
        // recovery retry classification for a transiently absent file.
        identity::validate_parent_path_chain(path)?;
        let path_text = path.to_str().ok_or_else(|| {
            record_test_failure!("state.open_client_path", "Path::to_str", 0);
            native_failure(NativeErrorKind::InvalidPath)
        })?;
        let path_wide = wide(path_text);
        // SAFETY: the path remains valid for this synchronous call. Client
        // access intentionally omits DELETE and uses the exact approved share
        // mode so the owner can retain DELETE_ON_CLOSE.
        let raw = unsafe {
            CreateFileW(
                path_wide.as_ptr(),
                GENERIC_READ | GENERIC_WRITE | SYNCHRONIZE,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                ptr::null(),
                OPEN_EXISTING,
                FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_WRITE_THROUGH,
                ptr::null_mut(),
            )
        };
        let _native_error = last_error();
        if raw.is_null() || raw == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            record_test_failure!("state.open_client_file", "CreateFileW", _native_error);
        }
        let state = Self {
            handle: OwnedHandle::from_raw(raw, NativeErrorKind::StateUnavailable)?,
            path: path.to_owned(),
            expected_parent,
            expected_root,
            lock_cleanup_failed: AtomicBool::new(false),
        };
        state.validate_regular_file()?;
        identity::validate_file_handle(&state.handle, path)?;
        identity::validate_ancestor_identities(path, expected_parent, expected_root)?;
        security.validate_handle(
            &state.handle,
            sid,
            windows_sys::Win32::Security::Authorization::SE_FILE_OBJECT,
        )?;
        Ok(state)
    }

    pub(super) fn close(&self) -> Result<(), NativeError> {
        #[cfg(feature = "test-support")]
        let result = self
            .handle
            .close_with_test_failure(&crate::handles::FAIL_NEXT_STATE_CLOSE);
        #[cfg(not(feature = "test-support"))]
        let result = self.handle.close();
        result.map_err(|_| native_failure(NativeErrorKind::StateUnavailable))
    }

    pub(super) fn is_closed(&self) -> bool {
        self.handle.is_closed()
    }

    pub(super) fn retain_handle_on_drop(&self) {
        self.handle.retain_on_drop();
    }

    fn ensure_open(&self) -> Result<(), NativeError> {
        if self.handle.is_closed() {
            Err(native_failure(NativeErrorKind::StateUnavailable))
        } else {
            Ok(())
        }
    }

    fn validate_for_use(&self) -> Result<(), NativeError> {
        self.ensure_open()?;
        identity::validate_file_handle(&self.handle, &self.path)?;
        identity::validate_ancestor_identities(&self.path, self.expected_parent, self.expected_root)
    }

    fn validate_regular_file(&self) -> Result<(), NativeError> {
        self.ensure_open()?;
        let mut info = BY_HANDLE_FILE_INFORMATION::default();
        // SAFETY: the owned handle is valid and the output structure is writable.
        let info_ok = unsafe { GetFileInformationByHandle(self.handle.raw(), &mut info) };
        let _info_error = last_error();
        if info_ok == 0 {
            record_test_failure!(
                "state.validate_file_information",
                "GetFileInformationByHandle",
                _info_error,
            );
            return Err(native_failure(NativeErrorKind::StateUnavailable));
        }
        if (info.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0
            || (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0
        {
            record_test_failure!(
                "state.validate_regular_file",
                "GetFileInformationByHandle",
                0,
            );
            return Err(native_failure(NativeErrorKind::SecurityBoundaryUnavailable));
        }
        Ok(())
    }

    pub(super) fn transact<T, F>(&self, mutate: F) -> Result<T, NativeError>
    where
        F: FnOnce(&mut StateRecord) -> Result<T, NativeError>,
    {
        self.ensure_open()?;
        let lock = self.lock()?;
        let operation = (|| {
            let current = self.read_locked()?;
            let mut next = current;
            next.generation = current
                .generation
                .checked_add(1)
                .ok_or_else(|| native_failure(NativeErrorKind::StateCorrupt))?;
            let output = mutate(&mut next)?;
            self.write_next(&next, current.generation)?;
            Ok(output)
        })();
        let release = lock.release();
        match (operation, release) {
            (Ok(output), Ok(())) => Ok(output),
            (Err(error), Ok(())) => Err(error),
            (_, Err(error)) => Err(error),
        }
    }

    pub(super) fn read_snapshot(&self) -> Result<StateRecord, NativeError> {
        self.ensure_open()?;
        let lock = self.lock()?;
        let operation = self.read_locked();
        let release = lock.release();
        match (operation, release) {
            (Ok(record), Ok(())) => Ok(record),
            (Err(error), Ok(())) => Err(error),
            (_, Err(error)) => Err(error),
        }
    }

    fn set_length(&self) -> Result<(), NativeError> {
        self.ensure_open()?;
        let mut position = 0i64;
        // SAFETY: the handle is valid; this moves the synchronous file pointer
        // to the fixed end of the state file.
        if unsafe {
            SetFilePointerEx(
                self.handle.raw(),
                FILE_SIZE as i64,
                &mut position,
                FILE_BEGIN,
            )
        } == 0
            || position != FILE_SIZE as i64
        {
            return Err(native_failure(NativeErrorKind::StateWriteFailed));
        }
        // SAFETY: the pointer is at the exact fixed length.
        if unsafe { SetEndOfFile(self.handle.raw()) } == 0 {
            return Err(native_failure(NativeErrorKind::StateWriteFailed));
        }
        Ok(())
    }

    fn write_initial(&self, initial: StateRecord) -> Result<(), NativeError> {
        let mut bytes = [0u8; FILE_SIZE];
        bytes[0..8].copy_from_slice(&FILE_MAGIC);
        bytes[8..12].copy_from_slice(&OWNER_STATE_SCHEMA_VERSION.to_le_bytes());
        bytes[12..16].copy_from_slice(&(SLOT_SIZE as u32).to_le_bytes());
        bytes[16..20].copy_from_slice(&2u32.to_le_bytes());
        bytes[20..24].copy_from_slice(&(FILE_SIZE as u32).to_le_bytes());
        bytes[HEADER_SIZE..HEADER_SIZE + SLOT_SIZE].copy_from_slice(&initial.encode(true));
        self.write_at(0, &bytes)?;
        self.flush()
    }

    fn read_locked(&self) -> Result<StateRecord, NativeError> {
        self.ensure_open()?;
        let mut bytes = [0u8; FILE_SIZE];
        let mut size = 0i64;
        // SAFETY: the handle is valid and the output size pointer is writable.
        if unsafe { GetFileSizeEx(self.handle.raw(), &mut size) } == 0 || size != FILE_SIZE as i64 {
            return Err(native_failure(NativeErrorKind::StateCorrupt));
        }
        self.read_at(0, &mut bytes)?;
        if bytes[0..8] != FILE_MAGIC
            || u32_at(&bytes, 8) != OWNER_STATE_SCHEMA_VERSION
            || u32_at(&bytes, 12) != SLOT_SIZE as u32
            || u32_at(&bytes, 16) != 2
            || u32_at(&bytes, 20) != FILE_SIZE as u32
            || bytes[24..HEADER_SIZE].iter().any(|value| *value != 0)
        {
            return Err(native_failure(NativeErrorKind::StateCorrupt));
        }
        let first = StateRecord::decode(&bytes[HEADER_SIZE..HEADER_SIZE + SLOT_SIZE])?;
        let second = StateRecord::decode(&bytes[HEADER_SIZE + SLOT_SIZE..])?;
        match (first, second) {
            (Some(left), Some(right)) if left.generation == right.generation => {
                Err(native_failure(NativeErrorKind::StateCorrupt))
            }
            (Some(left), Some(right)) => Ok(if left.generation > right.generation {
                left
            } else {
                right
            }),
            (Some(record), None) | (None, Some(record)) => Ok(record),
            (None, None) => Err(native_failure(NativeErrorKind::StateCorrupt)),
        }
    }

    fn write_next(&self, next: &StateRecord, previous_generation: u64) -> Result<(), NativeError> {
        self.ensure_open()?;
        let mut bytes = [0u8; FILE_SIZE];
        self.read_at(0, &mut bytes)?;
        let first_generation = StateRecord::decode(&bytes[HEADER_SIZE..HEADER_SIZE + SLOT_SIZE])?
            .map(|record| record.generation)
            .unwrap_or(0);
        let second_generation = StateRecord::decode(&bytes[HEADER_SIZE + SLOT_SIZE..])?
            .map(|record| record.generation)
            .unwrap_or(0);
        if first_generation != previous_generation && second_generation != previous_generation {
            return Err(native_failure(NativeErrorKind::StateCorrupt));
        }
        let slot_index = if first_generation == previous_generation {
            1
        } else {
            0
        };
        let offset = HEADER_SIZE + (slot_index * SLOT_SIZE);
        let uncommitted = next.encode(false);
        self.write_at(offset as i64, &uncommitted)?;
        self.flush()?;
        self.write_at((offset + COMMIT_OFFSET) as i64, &COMMIT_MARKER)?;
        self.flush()
    }

    fn lock(&self) -> Result<StateLock<'_>, NativeError> {
        self.validate_for_use()?;
        if self.lock_cleanup_failed.load(Ordering::Acquire) {
            return Err(native_failure(NativeErrorKind::LockUncertain));
        }
        let started = Instant::now();
        for (index, delay) in FIXED_BACKOFF_MS.iter().enumerate() {
            let mut overlapped = OVERLAPPED::default();
            // SAFETY: the state handle is valid, the one-byte region is fixed,
            // and the OVERLAPPED value remains live through this synchronous
            // fail-immediately call.
            let ok = unsafe {
                LockFileEx(
                    self.handle.raw(),
                    LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY,
                    0,
                    1,
                    0,
                    &mut overlapped,
                )
            };
            if ok != 0 {
                return Ok(StateLock::new(&self.handle, &self.lock_cleanup_failed));
            }
            let error = last_error();
            if error != ERROR_LOCK_VIOLATION && error != ERROR_SHARING_VIOLATION {
                return Err(native_failure(NativeErrorKind::LockUnavailable));
            }
            if started.elapsed() >= LOCK_DEADLINE {
                return Err(native_failure(NativeErrorKind::LockTimeout));
            }
            sleep(Duration::from_millis(*delay));
            if index == FIXED_BACKOFF_MS.len() - 1 && started.elapsed() >= LOCK_DEADLINE {
                return Err(native_failure(NativeErrorKind::LockTimeout));
            }
        }
        Err(native_failure(NativeErrorKind::LockTimeout))
    }

    fn read_at(&self, offset: i64, buffer: &mut [u8]) -> Result<(), NativeError> {
        self.ensure_open()?;
        self.seek(offset)?;
        let mut read = 0u32;
        // SAFETY: buffer is writable for its exact length and this is a
        // synchronous handle, so a null OVERLAPPED is correct.
        let ok = unsafe {
            ReadFile(
                self.handle.raw(),
                buffer.as_mut_ptr(),
                buffer.len() as u32,
                &mut read,
                ptr::null_mut(),
            )
        };
        if ok == 0 || read != buffer.len() as u32 {
            return Err(native_failure(NativeErrorKind::StateUnavailable));
        }
        Ok(())
    }

    fn write_at(&self, offset: i64, buffer: &[u8]) -> Result<(), NativeError> {
        self.ensure_open()?;
        self.seek(offset)?;
        let mut written = 0u32;
        // SAFETY: buffer is readable for its exact length and this is a
        // synchronous handle, so a null OVERLAPPED is correct.
        let ok = unsafe {
            WriteFile(
                self.handle.raw(),
                buffer.as_ptr(),
                buffer.len() as u32,
                &mut written,
                ptr::null_mut(),
            )
        };
        if ok == 0 || written != buffer.len() as u32 {
            return Err(native_failure(NativeErrorKind::StateWriteFailed));
        }
        Ok(())
    }

    fn seek(&self, offset: i64) -> Result<(), NativeError> {
        self.ensure_open()?;
        let mut position = 0i64;
        // SAFETY: the handle is valid and the output position pointer is
        // writable.
        if unsafe { SetFilePointerEx(self.handle.raw(), offset, &mut position, FILE_BEGIN) } == 0
            || position != offset
        {
            return Err(native_failure(NativeErrorKind::StateUnavailable));
        }
        Ok(())
    }

    fn flush(&self) -> Result<(), NativeError> {
        self.ensure_open()?;
        // SAFETY: the handle is valid and opened for synchronous write-through
        // access.
        if unsafe { FlushFileBuffers(self.handle.raw()) } == 0 {
            return Err(native_failure(NativeErrorKind::StateWriteFailed));
        }
        Ok(())
    }
}

impl StateLock<'_> {
    pub(super) fn release(mut self) -> Result<(), NativeError> {
        let mut overlapped = OVERLAPPED::default();
        #[cfg(feature = "test-support")]
        let injected_pre_call_failure = crate::handles::FAIL_NEXT_STATE_UNLOCK_BEFORE_CALL
            .swap(false, std::sync::atomic::Ordering::AcqRel);
        #[cfg(feature = "test-support")]
        let injected_failure =
            crate::handles::FAIL_NEXT_STATE_UNLOCK.swap(false, std::sync::atomic::Ordering::AcqRel);
        #[cfg(not(feature = "test-support"))]
        let injected_pre_call_failure = false;
        #[cfg(not(feature = "test-support"))]
        let injected_failure = false;
        if self.handle.is_closed() {
            self.mark_cleanup_failed();
            return Err(native_failure(NativeErrorKind::LockUncertain));
        }
        if injected_pre_call_failure {
            self.mark_cleanup_failed();
            return Err(native_failure(NativeErrorKind::LockUncertain));
        }
        // SAFETY: the lock range matches the one-byte region acquired by
        // LockFileEx on the same handle.
        let ok = unsafe { UnlockFileEx(self.handle_raw(), 0, 1, 0, &mut overlapped) };
        self.mark_released();
        if ok == 0 {
            self.mark_cleanup_failed();
            Err(native_failure(NativeErrorKind::LockUncertain))
        } else if injected_failure {
            Err(native_failure(NativeErrorKind::LockUncertain))
        } else {
            Ok(())
        }
    }
}

impl StateLock<'_> {
    fn handle_raw(&self) -> windows_sys::Win32::Foundation::HANDLE {
        self.handle.raw()
    }
}

fn put_u32(buffer: &mut [u8], offset: usize, value: u32) {
    buffer[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

fn put_u64(buffer: &mut [u8], offset: usize, value: u64) {
    buffer[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}

fn put_identity(buffer: &mut [u8], offset: usize, identity: FileIdentity) {
    buffer[offset..offset + 4].copy_from_slice(&identity.volume_serial.to_le_bytes());
    buffer[offset + 4..offset + 12].copy_from_slice(&identity.file_index.to_le_bytes());
}

fn u32_at(buffer: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(
        buffer[offset..offset + 4]
            .try_into()
            .expect("fixed state field"),
    )
}

fn u64_at(buffer: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(
        buffer[offset..offset + 8]
            .try_into()
            .expect("fixed state field"),
    )
}

fn identity_at(buffer: &[u8], offset: usize) -> FileIdentity {
    FileIdentity {
        volume_serial: u32_at(buffer, offset),
        file_index: u64_at(buffer, offset + 4),
    }
}

fn array_at<const N: usize>(buffer: &[u8], offset: usize) -> [u8; N] {
    buffer[offset..offset + N]
        .try_into()
        .expect("fixed state array")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record() -> StateRecord {
        StateRecord::new(
            ROLE_NORMAL,
            OwnerIdentity {
                parent: FileIdentity {
                    volume_serial: 7,
                    file_index: 9,
                },
                root: FileIdentity {
                    volume_serial: 11,
                    file_index: 13,
                },
                pid: 42,
                start_filetime: 99,
                session: 3,
                sid_hash: [1; 32],
                nonce: [2; 16],
            },
        )
    }

    #[test]
    fn committed_slot_round_trips_and_tampering_fails_closed() {
        let value = record();
        let encoded = value.encode(true);
        assert_eq!(StateRecord::decode(&encoded).unwrap(), Some(value));

        let mut tampered = encoded;
        tampered[44] ^= 1;
        assert_eq!(StateRecord::decode(&tampered).unwrap(), None);

        let mut trailing = encoded;
        trailing[236] = 1;
        assert_eq!(StateRecord::decode(&trailing).unwrap(), None);
    }

    #[test]
    fn impossible_transitions_are_rejected() {
        let mut pending = record();
        pending.state = STATE_PENDING;
        pending.request_generation = 2;
        pending.request_pid = 7;
        pending.request_start_filetime = 8;
        pending.request_session = 0;
        pending.request_sid_hash = [3; 32];
        assert_eq!(StateRecord::decode(&pending.encode(true)).unwrap(), None);
        pending.request_session = 3;
        assert_eq!(
            StateRecord::decode(&pending.encode(true)).unwrap(),
            Some(pending)
        );

        pending.request_generation = 0;
        assert_eq!(StateRecord::decode(&pending.encode(true)).unwrap(), None);

        let mut acknowledged = record();
        acknowledged.state = STATE_ACKNOWLEDGED;
        acknowledged.request_generation = 4;
        acknowledged.ack_generation = 0;
        assert_eq!(
            StateRecord::decode(&acknowledged.encode(true)).unwrap(),
            None
        );

        acknowledged.ack_generation = 4;
        acknowledged.status = STATUS_HANDLED;
        acknowledged.request_pid = 7;
        acknowledged.request_start_filetime = 8;
        acknowledged.request_session = 0;
        acknowledged.request_sid_hash = [3; 32];
        assert_eq!(
            StateRecord::decode(&acknowledged.encode(true)).unwrap(),
            None
        );
        acknowledged.request_session = 3;
        assert_eq!(
            StateRecord::decode(&acknowledged.encode(true)).unwrap(),
            Some(acknowledged)
        );
    }

    #[test]
    fn owner_identity_fields_are_required_before_liveness_checks() {
        let mutations: [fn(&mut StateRecord); 7] = [
            |value: &mut StateRecord| value.pid = 0,
            |value: &mut StateRecord| value.start_filetime = 0,
            |value: &mut StateRecord| value.session = 0,
            |value: &mut StateRecord| value.sid_hash = [0; 32],
            |value: &mut StateRecord| value.nonce = [0; 16],
            |value: &mut StateRecord| value.parent.file_index = 0,
            |value: &mut StateRecord| value.root.volume_serial = 0,
        ];
        for mutate in mutations {
            let mut invalid = record();
            mutate(&mut invalid);
            assert_eq!(StateRecord::decode(&invalid.encode(true)).unwrap(), None);
        }
    }

    #[test]
    fn callback_and_cancellation_statuses_have_closed_transition_sets() {
        for status in [
            STATUS_NONE,
            STATUS_CALLBACK_QUEUED,
            STATUS_CALLBACK_RUNNING,
            STATUS_CANCEL_REQUESTED,
            STATUS_UNCERTAIN,
        ] {
            let mut pending = record();
            pending.state = STATE_PENDING;
            pending.status = status;
            pending.request_generation = 2;
            pending.request_pid = 7;
            pending.request_start_filetime = 8;
            pending.request_session = 3;
            pending.request_sid_hash = [3; 32];
            assert_eq!(
                StateRecord::decode(&pending.encode(true)).unwrap(),
                Some(pending)
            );
        }

        let mut cancelled = record();
        cancelled.state = STATE_ACKNOWLEDGED;
        cancelled.status = STATUS_CANCELLED;
        cancelled.request_generation = 4;
        cancelled.ack_generation = 4;
        cancelled.request_pid = 7;
        cancelled.request_start_filetime = 8;
        cancelled.request_session = 3;
        cancelled.request_sid_hash = [3; 32];
        assert_eq!(
            StateRecord::decode(&cancelled.encode(true)).unwrap(),
            Some(cancelled)
        );
    }
}
