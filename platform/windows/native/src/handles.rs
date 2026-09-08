use std::{
    ffi::OsStr,
    os::windows::ffi::OsStrExt,
    ptr::NonNull,
    sync::atomic::{AtomicBool, Ordering},
};

#[cfg(feature = "test-support")]
use std::sync::{Mutex, OnceLock};

#[cfg(feature = "test-support")]
use getrandom::fill as fill_random;

#[cfg(feature = "test-support")]
use sha2::{Digest, Sha256};

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
#[derive(Clone, Copy, Debug)]
pub(crate) enum TestDiagnosticStatus {
    Win32Error(u32),
    HResult(i32),
    ApiStatus(u32),
    NoStatus,
}

#[cfg(feature = "test-support")]
#[derive(Clone, Copy, Debug)]
pub(crate) enum TestFinalPathClassification {
    SameVerifiedObject,
    DifferentObject,
    ProbeOpenFailed,
    ProbeIdentityFailed,
    ProbeAttributeRejected,
}

#[cfg(feature = "test-support")]
#[derive(Clone, Copy, Debug)]
struct FinalPathDiagnostic {
    returned_length: u32,
    capacity: u32,
    actual_utf16_units: Option<u32>,
    expected_utf16_units: Option<u32>,
    actual_component_count: Option<u32>,
    expected_component_count: Option<u32>,
    actual_separator_count: Option<u32>,
    expected_separator_count: Option<u32>,
    first_differing_component: Option<u32>,
    actual_differing_component_units: Option<u32>,
    expected_differing_component_units: Option<u32>,
    actual_prefix: Option<&'static str>,
    expected_prefix: Option<&'static str>,
    actual_trailing_separator: Option<bool>,
    expected_trailing_separator: Option<bool>,
    actual_fingerprint: Option<u128>,
    expected_fingerprint: Option<u128>,
    actual_shape_fingerprint: Option<u128>,
    expected_shape_fingerprint: Option<u128>,
    classification: Option<TestFinalPathClassification>,
}

#[cfg(feature = "test-support")]
#[derive(Clone, Copy, Debug)]
pub(crate) struct TestDiagnostic {
    stage: &'static str,
    api: &'static str,
    status: TestDiagnosticStatus,
    final_path: Option<FinalPathDiagnostic>,
}

#[cfg(feature = "test-support")]
static TEST_DIAGNOSTIC: OnceLock<Mutex<Option<TestDiagnostic>>> = OnceLock::new();

#[cfg(feature = "test-support")]
static TEST_DIAGNOSTIC_SALT: OnceLock<[u8; 16]> = OnceLock::new();

#[cfg(feature = "test-support")]
fn test_diagnostic_store() -> &'static Mutex<Option<TestDiagnostic>> {
    TEST_DIAGNOSTIC.get_or_init(|| Mutex::new(None))
}

#[cfg(feature = "test-support")]
pub(crate) fn clear_test_diagnostic() {
    let mut diagnostic = match test_diagnostic_store().lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    *diagnostic = None;
}

#[cfg(feature = "test-support")]
pub(crate) fn record_test_failure(
    stage: &'static str,
    api: &'static str,
    status: TestDiagnosticStatus,
) {
    record_test_diagnostic(stage, api, status, None);
}

#[cfg(feature = "test-support")]
pub(crate) fn record_test_final_path(
    stage: &'static str,
    api: &'static str,
    status: TestDiagnosticStatus,
    returned_length: u32,
    capacity: u32,
    actual: Option<&str>,
    expected: Option<&str>,
) {
    let final_path = final_path_diagnostic(returned_length, capacity, actual, expected, None);
    record_test_diagnostic(stage, api, status, Some(final_path));
}

#[cfg(feature = "test-support")]
#[allow(clippy::too_many_arguments)]
pub(crate) fn record_test_final_path_classified(
    stage: &'static str,
    api: &'static str,
    status: TestDiagnosticStatus,
    returned_length: u32,
    capacity: u32,
    actual: Option<&str>,
    expected: Option<&str>,
    classification: TestFinalPathClassification,
) {
    let final_path = final_path_diagnostic(
        returned_length,
        capacity,
        actual,
        expected,
        Some(classification),
    );
    record_test_diagnostic(stage, api, status, Some(final_path));
}

#[cfg(feature = "test-support")]
fn final_path_diagnostic(
    returned_length: u32,
    capacity: u32,
    actual: Option<&str>,
    expected: Option<&str>,
    classification: Option<TestFinalPathClassification>,
) -> FinalPathDiagnostic {
    let actual_shape = actual.map(path_shape);
    let expected_shape = expected.map(path_shape);
    let first_difference = actual
        .zip(expected)
        .map(|(actual, expected)| first_differing_component(actual, expected));
    FinalPathDiagnostic {
        returned_length,
        capacity,
        actual_utf16_units: actual.and_then(utf16_unit_count),
        expected_utf16_units: expected.and_then(utf16_unit_count),
        actual_component_count: actual_shape.map(|shape| shape.component_count),
        expected_component_count: expected_shape.map(|shape| shape.component_count),
        actual_separator_count: actual_shape.map(|shape| shape.separator_count),
        expected_separator_count: expected_shape.map(|shape| shape.separator_count),
        first_differing_component: first_difference.map(|difference| difference.ordinal),
        actual_differing_component_units: first_difference
            .and_then(|difference| difference.actual_units),
        expected_differing_component_units: first_difference
            .and_then(|difference| difference.expected_units),
        actual_prefix: actual.map(path_prefix),
        expected_prefix: expected.map(path_prefix),
        actual_trailing_separator: actual.map(has_trailing_separator),
        expected_trailing_separator: expected.map(has_trailing_separator),
        actual_fingerprint: actual.map(path_fingerprint),
        expected_fingerprint: expected.map(path_fingerprint),
        actual_shape_fingerprint: actual_shape.map(|shape| shape.fingerprint),
        expected_shape_fingerprint: expected_shape.map(|shape| shape.fingerprint),
        classification,
    }
}

#[cfg(feature = "test-support")]
fn record_test_diagnostic(
    stage: &'static str,
    api: &'static str,
    status: TestDiagnosticStatus,
    final_path: Option<FinalPathDiagnostic>,
) {
    let mut diagnostic = match test_diagnostic_store().lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    if diagnostic.is_none() {
        *diagnostic = Some(TestDiagnostic {
            stage,
            api,
            status,
            final_path,
        });
    }
}

#[cfg(feature = "test-support")]
pub(crate) fn test_diagnostic() -> Option<String> {
    let diagnostic = match test_diagnostic_store().lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    diagnostic.map(format_test_diagnostic)
}

#[cfg(feature = "test-support")]
fn format_test_diagnostic(value: TestDiagnostic) -> String {
    let (status_kind, status) = match value.status {
        TestDiagnosticStatus::Win32Error(error) => ("WIN32_ERROR", error.to_string()),
        TestDiagnosticStatus::HResult(error) => ("HRESULT", error.to_string()),
        TestDiagnosticStatus::ApiStatus(status) => ("API_STATUS", status.to_string()),
        TestDiagnosticStatus::NoStatus => ("NONE", "none".to_owned()),
    };
    let mut rendered = format!(
        "stage={};api={};status_kind={};status={}",
        value.stage, value.api, status_kind, status
    );
    if let Some(final_path) = value.final_path {
        rendered.push_str(&format!(
            ";returned_length={};capacity={};actual_utf16_units={};expected_utf16_units={};actual_component_count={};expected_component_count={};actual_separator_count={};expected_separator_count={};first_differing_component={};actual_differing_component_units={};expected_differing_component_units={};actual_prefix={};expected_prefix={};actual_trailing_separator={};expected_trailing_separator={};actual_fingerprint={};expected_fingerprint={};actual_shape_fingerprint={};expected_shape_fingerprint={}",
            final_path.returned_length,
            final_path.capacity,
            optional_u32(final_path.actual_utf16_units),
            optional_u32(final_path.expected_utf16_units),
            optional_u32(final_path.actual_component_count),
            optional_u32(final_path.expected_component_count),
            optional_u32(final_path.actual_separator_count),
            optional_u32(final_path.expected_separator_count),
            optional_u32(final_path.first_differing_component),
            optional_u32(final_path.actual_differing_component_units),
            optional_u32(final_path.expected_differing_component_units),
            optional_text(final_path.actual_prefix),
            optional_text(final_path.expected_prefix),
            optional_bool(final_path.actual_trailing_separator),
            optional_bool(final_path.expected_trailing_separator),
            optional_fingerprint(final_path.actual_fingerprint),
            optional_fingerprint(final_path.expected_fingerprint),
            optional_fingerprint(final_path.actual_shape_fingerprint),
            optional_fingerprint(final_path.expected_shape_fingerprint),
        ));
        if let Some(classification) = final_path.classification {
            rendered.push_str(";classification=");
            rendered.push_str(final_path_classification_text(classification));
        }
    }
    rendered
}

#[cfg(all(feature = "test-support", test))]
pub(crate) fn format_test_failure_diagnostic(
    stage: &'static str,
    api: &'static str,
    status: TestDiagnosticStatus,
) -> String {
    format_test_diagnostic(TestDiagnostic {
        stage,
        api,
        status,
        final_path: None,
    })
}

#[cfg(all(feature = "test-support", test))]
pub(crate) fn format_test_final_path_diagnostic(
    stage: &'static str,
    api: &'static str,
    status: TestDiagnosticStatus,
    returned_length: u32,
    capacity: u32,
    actual: Option<&str>,
    expected: Option<&str>,
) -> String {
    format_test_final_path_diagnostic_classified(
        stage,
        api,
        status,
        returned_length,
        capacity,
        actual,
        expected,
        None,
    )
}

#[cfg(all(feature = "test-support", test))]
#[allow(clippy::too_many_arguments)]
pub(crate) fn format_test_final_path_diagnostic_classified(
    stage: &'static str,
    api: &'static str,
    status: TestDiagnosticStatus,
    returned_length: u32,
    capacity: u32,
    actual: Option<&str>,
    expected: Option<&str>,
    classification: Option<TestFinalPathClassification>,
) -> String {
    format_test_diagnostic(TestDiagnostic {
        stage,
        api,
        status,
        final_path: Some(final_path_diagnostic(
            returned_length,
            capacity,
            actual,
            expected,
            classification,
        )),
    })
}

#[cfg(feature = "test-support")]
fn utf16_unit_count(value: &str) -> Option<u32> {
    u32::try_from(value.encode_utf16().count()).ok()
}

#[cfg(feature = "test-support")]
fn has_trailing_separator(value: &str) -> bool {
    value.ends_with('\\') || value.ends_with('/')
}

#[cfg(feature = "test-support")]
fn path_prefix(value: &str) -> &'static str {
    if value.starts_with("\\\\?\\UNC\\") {
        "DEVICE_UNC"
    } else if value.starts_with("\\\\?\\Volume{") {
        "DEVICE_VOLUME"
    } else if value.starts_with("\\\\?\\") {
        "DEVICE_DOS"
    } else if value.starts_with("\\\\") {
        "UNC"
    } else if value.as_bytes().get(1) == Some(&b':') {
        "DOS"
    } else {
        "OTHER"
    }
}

#[cfg(feature = "test-support")]
fn path_fingerprint(value: &str) -> u128 {
    let mut hasher = Sha256::new();
    hasher.update(diagnostic_salt());
    hasher.update(value.as_bytes());
    let digest = hasher.finalize();
    let mut prefix = [0u8; 16];
    prefix.copy_from_slice(&digest[..16]);
    u128::from_be_bytes(prefix)
}

#[cfg(feature = "test-support")]
fn optional_u32(value: Option<u32>) -> String {
    value
        .map(|value| value.to_string())
        .unwrap_or_else(|| "unavailable".to_owned())
}

#[cfg(feature = "test-support")]
fn optional_text(value: Option<&'static str>) -> &'static str {
    value.unwrap_or("unavailable")
}

#[cfg(feature = "test-support")]
fn optional_bool(value: Option<bool>) -> &'static str {
    match value {
        Some(true) => "true",
        Some(false) => "false",
        None => "unavailable",
    }
}

#[cfg(feature = "test-support")]
fn optional_fingerprint(value: Option<u128>) -> String {
    value
        .map(|value| format!("{value:032x}"))
        .unwrap_or_else(|| "unavailable".to_owned())
}

#[cfg(feature = "test-support")]
#[derive(Clone, Copy)]
struct PathShape {
    component_count: u32,
    separator_count: u32,
    fingerprint: u128,
}

#[cfg(feature = "test-support")]
#[derive(Clone, Copy)]
struct ComponentDifference {
    ordinal: u32,
    actual_units: Option<u32>,
    expected_units: Option<u32>,
}

#[cfg(feature = "test-support")]
fn path_shape(value: &str) -> PathShape {
    let components = path_components(value);
    let separator_count = u32::try_from(
        value
            .chars()
            .filter(|character| *character == '\\' || *character == '/')
            .count(),
    )
    .unwrap_or(u32::MAX);
    let component_count = u32::try_from(components.len()).unwrap_or(u32::MAX);
    let mut hasher = Sha256::new();
    hasher.update(diagnostic_salt());
    hasher.update(path_prefix(value).as_bytes());
    hasher.update(separator_count.to_le_bytes());
    for component in &components {
        hasher.update(
            utf16_unit_count(component)
                .unwrap_or(u32::MAX)
                .to_le_bytes(),
        );
    }
    let digest = hasher.finalize();
    let mut prefix = [0u8; 16];
    prefix.copy_from_slice(&digest[..16]);
    PathShape {
        component_count,
        separator_count,
        fingerprint: u128::from_be_bytes(prefix),
    }
}

#[cfg(feature = "test-support")]
fn path_components(value: &str) -> Vec<&str> {
    value
        .strip_prefix("\\\\?\\")
        .unwrap_or(value)
        .split(['\\', '/'])
        .filter(|component| !component.is_empty())
        .collect()
}

#[cfg(feature = "test-support")]
fn first_differing_component(actual: &str, expected: &str) -> ComponentDifference {
    let actual_components = path_components(actual);
    let expected_components = path_components(expected);
    let max_len = actual_components.len().max(expected_components.len());
    for index in 0..max_len {
        let actual_component = actual_components.get(index).copied();
        let expected_component = expected_components.get(index).copied();
        let same = actual_component
            .zip(expected_component)
            .is_some_and(|(actual, expected)| actual.eq_ignore_ascii_case(expected));
        if !same {
            return ComponentDifference {
                ordinal: u32::try_from(index + 1).unwrap_or(u32::MAX),
                actual_units: actual_component.and_then(utf16_unit_count),
                expected_units: expected_component.and_then(utf16_unit_count),
            };
        }
    }
    ComponentDifference {
        ordinal: 0,
        actual_units: None,
        expected_units: None,
    }
}

#[cfg(feature = "test-support")]
fn diagnostic_salt() -> [u8; 16] {
    *TEST_DIAGNOSTIC_SALT.get_or_init(|| {
        let mut salt = [0u8; 16];
        if fill_random(&mut salt).is_err() {
            let pid = std::process::id().to_le_bytes();
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
                .to_le_bytes();
            salt[..4].copy_from_slice(&pid);
            salt[4..].copy_from_slice(&timestamp[..12]);
        }
        salt
    })
}

#[cfg(feature = "test-support")]
fn final_path_classification_text(value: TestFinalPathClassification) -> &'static str {
    match value {
        TestFinalPathClassification::SameVerifiedObject => "SAME_VERIFIED_OBJECT",
        TestFinalPathClassification::DifferentObject => "DIFFERENT_OBJECT",
        TestFinalPathClassification::ProbeOpenFailed => "PROBE_OPEN_FAILED",
        TestFinalPathClassification::ProbeIdentityFailed => "PROBE_IDENTITY_FAILED",
        TestFinalPathClassification::ProbeAttributeRejected => "PROBE_ATTRIBUTE_REJECTED",
    }
}

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_STATE_UNLOCK: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_STATE_UNLOCK_BEFORE_CALL: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_STATE_CLOSE: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_ACTIVATION_CLOSE: AtomicBool = AtomicBool::new(false);

#[cfg(feature = "test-support")]
pub(crate) static FAIL_NEXT_ACK_CLOSE: AtomicBool = AtomicBool::new(false);

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
pub(crate) fn fail_next_state_unlock_before_call_for_test() {
    FAIL_NEXT_STATE_UNLOCK_BEFORE_CALL.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn fail_next_state_close_for_test() {
    FAIL_NEXT_STATE_CLOSE.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn fail_next_activation_close_for_test() {
    FAIL_NEXT_ACTIVATION_CLOSE.store(true, Ordering::Release);
}

#[cfg(feature = "test-support")]
pub(crate) fn fail_next_ack_close_for_test() {
    FAIL_NEXT_ACK_CLOSE.store(true, Ordering::Release);
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
    retain_on_drop: AtomicBool,
}

impl OwnedHandle {
    pub(super) fn from_raw(raw: HANDLE, kind: NativeErrorKind) -> Result<Self, NativeError> {
        NonNull::new(raw)
            .filter(|_| raw != INVALID_HANDLE_VALUE)
            .map(|raw| Self {
                raw,
                closed: AtomicBool::new(false),
                retain_on_drop: AtomicBool::new(false),
            })
            .ok_or_else(|| native_failure(kind))
    }

    pub(super) fn raw(&self) -> HANDLE {
        self.raw.as_ptr()
    }

    pub(super) fn is_closed(&self) -> bool {
        self.closed.load(Ordering::Acquire)
    }

    pub(super) fn retain_on_drop(&self) {
        self.retain_on_drop.store(true, Ordering::Release);
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

    #[cfg(feature = "test-support")]
    pub(super) fn close_with_test_failure(&self, failure: &AtomicBool) -> Result<(), ()> {
        if failure.swap(false, Ordering::AcqRel) {
            return Err(());
        }
        self.close()
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
        if self.retain_on_drop.load(Ordering::Acquire) {
            return;
        }
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
        let _native_error = last_error();
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
            WAIT_FAILED => {
                record_test_failure!("handles.mutex_wait", "WaitForSingleObject", _native_error,);
                Err(native_failure(NativeErrorKind::ArbitrationUnavailable))
            }
            _ => {
                record_test_failure!("handles.mutex_wait", "WaitForSingleObject", _native_error,);
                Err(native_failure(NativeErrorKind::ArbitrationUnavailable))
            }
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
        let released = unsafe {
            ReleaseMutex(
                self.handle
                    .as_ref()
                    .expect("owned mutex handle must remain present")
                    .raw(),
            )
        };
        if released == 0 {
            let _native_error = last_error();
            record_test_failure!("handles.mutex_release", "ReleaseMutex", _native_error,);
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
            if self.handle.is_closed() {
                self.cleanup_failed.store(true, Ordering::Release);
                return;
            }
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
