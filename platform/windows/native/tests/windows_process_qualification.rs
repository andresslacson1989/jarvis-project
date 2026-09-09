#![cfg(all(windows, feature = "test-support"))]

use std::{
    env, fs,
    panic::{self, AssertUnwindSafe},
    path::{Path, PathBuf},
    process::{self, Child, Command, ExitStatus, Stdio},
    sync::{
        Arc, Barrier, Mutex, MutexGuard, OnceLock,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    thread,
    time::Duration,
};

use jarvis_windows_native::{
    Acquisition, ActivationCallbackResult, ActivationCancellation, ActivationStart, NativeError,
    NativeErrorKind, Role, acquire,
};

const CHILD_ENV: &str = "JARVIS_NATIVE_QUALIFICATION_CHILD";
const TEST_NAME_ENV: &str = "JARVIS_NATIVE_QUALIFICATION_TEST";
const READY_FILE_ENV: &str = "JARVIS_NATIVE_QUALIFICATION_READY_FILE";
const DEFAULT_TEST_NAME: &str = "windows_owner_second_launch_and_crash_recovery_qualification";
// The runtime's shutdown deadline is one second. Keep a separate bounded
// qualification margin so a hosted Windows scheduler cannot turn a valid
// reconciliation into a timing-sensitive false negative.
const INFLIGHT_WORKER_RECOVERY_TIMEOUT: Duration = Duration::from_secs(5);

// This is the authoritative Section 1.4 qualification manifest. Keep test
// names stable and map each test to a fail-able contract criterion so hosted
// evidence cannot turn a test count into a soft pass.
const QUALIFICATION_TEST_MANIFEST: &[(&str, &str)] = &[
    (
        "identity::tests::bounded_local_app_data_scan_requires_terminator_inside_limit",
        "bounded-known-folder-utf16-resolution",
    ),
    (
        "identity::tests::absolute_local_path_rejects_non_local_root_forms",
        "absolute-local-path-and-unc-volume-rejection",
    ),
    (
        "identity::tests::handle_verified_short_name_alias_is_accepted_when_available",
        "same-object-short-name-alias-identity-proof",
    ),
    (
        "identity::tests::trusted_path_chain_accepts_case_and_trailing_directory_aliases",
        "same-object-case-and-trailing-separator-alias-proof",
    ),
    (
        "identity::tests::trusted_path_chain_rejects_intermediate_reparse_points",
        "final-and-intermediate-reparse-chain-rejection",
    ),
    (
        "identity::tests::validate_fixed_handle_requires_distinct_object_identity_proof",
        "distinct-final-object-identity-rejection",
    ),
    (
        "identity::tests::validate_fixed_handle_rejects_disappearing_expected_object",
        "disappearing-expected-object-failure",
    ),
    (
        "identity::tests::final_path_diagnostic_stages_are_specific_and_redacted",
        "path-api-vs-semantic-diagnostic-redaction",
    ),
    (
        "identity::tests::diagnostic_status_kinds_do_not_conflate_zero_with_no_status",
        "diagnostic-status-kind-integrity",
    ),
    (
        "layout::tests::finish_rejects_root_replacement_between_root_and_children",
        "root-replacement-between-layout-operations-fails-closed",
    ),
    (
        "state::tests::committed_slot_round_trips_and_tampering_fails_closed",
        "owner-state-commit-and-tamper-rejection",
    ),
    (
        "state::tests::impossible_transitions_are_rejected",
        "owner-state-transition-integrity",
    ),
    (
        "state::tests::owner_identity_fields_are_required_before_liveness_checks",
        "owner-identity-required-before-liveness",
    ),
    (
        "state::tests::callback_and_cancellation_statuses_have_closed_transition_sets",
        "activation-state-transition-closure",
    ),
    (
        "windows::tests::liveness_query_failures_remain_unknown",
        "process-liveness-unknown-fails-closed",
    ),
    (
        "windows::tests::liveness_requires_exact_start_time_and_session",
        "process-liveness-identity-match",
    ),
    (
        "windows::tests::invalid_persistent_identity_is_dead_before_query",
        "invalid-persistent-owner-identity",
    ),
    (
        "windows::tests::stable_mutex_is_session_scoped_without_global_namespace_claim",
        "session-scoped-mutex-namespace",
    ),
    (
        "windows::tests::newly_created_named_objects_are_read_back_validated",
        "newly-created-named-object-exact-dacl-readback",
    ),
    (
        "windows::tests::hostile_named_object_is_rejected_before_use",
        "hostile-named-object-fails-closed-before-use",
    ),
    (
        "security::tests::protected_dacl_shape_rejects_wrong_sid_mask_inheritance_and_extra_aces",
        "protected-dacl-rejects-wrong-sid-mask-inheritance-and-extra-aces",
    ),
    (
        "windows_qualification_manifest_is_complete_and_mapped",
        "named-manifest-integrity",
    ),
    (
        "windows_qualification_failure_recovers_lock_and_reports_root_diagnostic",
        "invalid-path-fail-closed-and-redacted-test-diagnostic",
    ),
    (
        "qualification::tests::cleanup_fault_is_reported_after_profile_removal",
        "qualification-cleanup-failure-is-retained-and-never-passes",
    ),
    (
        "windows_owner_second_launch_and_crash_recovery_qualification",
        "primary-owner-second-launch-activation-and-owner-crash-recovery",
    ),
    (
        "windows_normal_maintenance_contention_and_recovery_qualification",
        "normal-maintenance-mutual-exclusion-and-recovery",
    ),
    (
        "windows_same_owner_maintenance_is_non_reentrant",
        "same-owner-maintenance-non-reentrancy",
    ),
    (
        "windows_activation_timeout_reconciles_late_success_without_duplicate_callback",
        "activation-timeout-uncertainty-and-no-duplicate-callback",
    ),
    (
        "windows_owner_release_is_safe_when_lease_moves_threads",
        "owner-release-cross-thread-raii",
    ),
    (
        "windows_worker_shutdown_quarantine_is_bounded_and_recoverable",
        "bounded-worker-shutdown-and-recovery",
    ),
    (
        "windows_inflight_worker_failure_reconciles_after_join",
        "worker-failure-reconciliation-after-join",
    ),
    (
        "windows_partial_resource_close_failure_requires_explicit_recovery",
        "partial-resource-close-fails-closed",
    ),
    (
        "windows_deferred_shutdown_without_controller_joins_and_stays_fail_closed",
        "deferred-shutdown-joins-and-no-detached-lifecycle",
    ),
    (
        "windows_lifecycle_gate_serializes_release_worker_and_recovery_operations",
        "lifecycle-gate-serialization",
    ),
    (
        "windows_unexpected_worker_panic_is_reaped_and_recoverable",
        "worker-panic-reaping-and-recovery",
    ),
    (
        "windows_state_unlock_uncertainty_is_reported_and_recoverable",
        "state-lock-release-uncertainty",
    ),
    (
        "windows_state_unlock_cleanup_failure_remains_fail_closed",
        "state-lock-cleanup-failure-no-false-success",
    ),
    (
        "windows_stale_generation_cannot_signal_or_mutate_new_request",
        "stale-generation-rejection",
    ),
    (
        "windows_cancel_serializes_with_release_before_state_and_ack_boundaries",
        "activation-cancellation-boundary-ordering",
    ),
    (
        "windows_event_signal_failure_is_typed_and_recovers_closed",
        "activation-event-failure-and-recovery",
    ),
    (
        "windows_mutex_wait_failure_is_reported_without_claiming_ownership",
        "mutex-wait-failure-no-ownership-claim",
    ),
    (
        "windows_mutex_release_failure_is_uncertain_and_disables_authority",
        "mutex-release-failure-uncertainty",
    ),
];

static QUALIFICATION_LOCK: OnceLock<QualificationMutex> = OnceLock::new();
static QUALIFICATION_FIXTURES: OnceLock<Mutex<Vec<PathBuf>>> = OnceLock::new();

struct QualificationMutex(Mutex<()>);

struct QualificationGuard {
    _guard: MutexGuard<'static, ()>,
}

impl QualificationMutex {
    fn lock(&'static self) -> Result<QualificationGuard, ()> {
        let guard = match self.0.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        Ok(QualificationGuard { _guard: guard })
    }
}

impl Drop for QualificationGuard {
    fn drop(&mut self) {
        clear_test_environment();
        cleanup_fixtures();
    }
}

#[test]
fn windows_qualification_manifest_is_complete_and_mapped() {
    assert!(!QUALIFICATION_TEST_MANIFEST.is_empty());
    for (name, criterion) in QUALIFICATION_TEST_MANIFEST {
        assert!(!name.is_empty());
        assert!(!criterion.is_empty());
    }
    for (index, (name, _)) in QUALIFICATION_TEST_MANIFEST.iter().enumerate() {
        assert!(
            QUALIFICATION_TEST_MANIFEST[index + 1..]
                .iter()
                .all(|(other, _)| other != name),
            "duplicate qualification test name: {name}"
        );
    }
}

#[test]
fn windows_qualification_failure_recovers_lock_and_reports_root_diagnostic() {
    let _guard = qualification_lock().lock().expect("qualification lock");
    set_test_environment(
        Path::new("relative-test-root"),
        "windows_qualification_failure_recovers_lock_and_reports_root_diagnostic",
        Path::new("relative-test-root.ready"),
    );

    let failure = match acquire(Role::Normal) {
        Err(error) => error,
        Ok(_) => panic!("invalid qualification path unexpectedly acquired"),
    };
    assert_eq!(failure.kind, NativeErrorKind::InvalidPath);
    assert_eq!(
        jarvis_windows_native::test_acquisition_diagnostic().as_deref(),
        Some(
            "stage=identity.test_local_app_data;api=validate_absolute_local_path;status_kind=NONE;status=none"
        )
    );
    drop(_guard);

    let poisoned = panic::catch_unwind(AssertUnwindSafe(|| {
        let _guard = qualification_lock().lock().expect("qualification lock");
        panic!("qualification lock poison sentinel");
    }));
    assert!(poisoned.is_err());
    let _recovered = qualification_lock()
        .lock()
        .expect("qualification lock must recover after a prior panic");
}

#[test]
fn windows_owner_second_launch_and_crash_recovery_qualification() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");

    let test_root = create_fixture();
    let ready_file = test_root.join("recovery-waiter.ready");
    set_test_environment(&test_root, DEFAULT_TEST_NAME, &ready_file);

    let owner = acquire_owner(Role::Normal);
    if let Some(diagnostic) = jarvis_windows_native::test_acquisition_diagnostic() {
        println!("bounded acquisition diagnostic: {diagnostic}");
    }
    let not_ready = spawn_child("second");
    assert_eq!(
        not_ready.code(),
        Some(4),
        "second launch must fail closed before readiness: {not_ready:?}"
    );

    let waiter = spawn_child_process("recovery-waiter");
    wait_for_marker(&ready_file);
    thread::sleep(Duration::from_millis(50));
    drop(owner);
    assert!(
        waiter
            .wait_with_output()
            .expect("recovery waiter must exit")
            .status
            .success(),
        "a contender that opened the existing mutex must recover exactly after owner exit"
    );

    let owner = acquire_owner(Role::Normal);
    let callbacks = Arc::new(AtomicUsize::new(0));
    let fail_next = Arc::new(AtomicBool::new(false));
    let panic_next = Arc::new(AtomicBool::new(false));
    let callback_count = Arc::clone(&callbacks);
    let callback_failure = Arc::clone(&fail_next);
    let callback_panic = Arc::clone(&panic_next);
    let mut worker = owner
        .start_activation_worker(move |request| {
            callback_count.fetch_add(1, Ordering::SeqCst);
            if callback_panic.swap(false, Ordering::SeqCst) {
                panic!("qualification callback panic");
            }
            if callback_failure.swap(false, Ordering::SeqCst) {
                return ActivationCallbackResult::NotStarted;
            }
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled) => return ActivationCallbackResult::NotStarted,
                Ok(ActivationStart::Stale) => return ActivationCallbackResult::NotStarted,
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            let result = ActivationCallbackResult::Handled;
            let _ = presentation.complete(result);
            result
        })
        .expect("same-session activation receiver must start");
    owner
        .mark_ready()
        .expect("readiness follows receiver startup");

    assert_fixed_directories(&test_root);
    for _ in 0..3 {
        let status = spawn_child("second");
        assert!(
            status.success(),
            "second launch did not receive an acknowledgement: {status:?}"
        );
    }

    fail_next.store(true, Ordering::SeqCst);
    let failed_activation = spawn_child("second");
    assert_eq!(
        failed_activation.code(),
        Some(5),
        "callback failure must not be reported as an acknowledged activation"
    );
    let recovered_activation = spawn_child("second");
    assert!(
        recovered_activation.success(),
        "the next activation must succeed after a failed callback"
    );
    panic_next.store(true, Ordering::SeqCst);
    let panicking_activation = spawn_child("second");
    assert_eq!(
        panicking_activation.code(),
        Some(5),
        "a panicking callback must not be reported as an acknowledged activation"
    );
    assert!(
        spawn_child("second").success(),
        "the next activation must succeed after a panicking callback"
    );
    assert!(callbacks.load(Ordering::SeqCst) >= 7);

    drop(worker);
    let stopped_worker = spawn_child("second");
    assert_eq!(
        stopped_worker.code(),
        Some(4),
        "a stopped receiver must fail closed rather than acknowledge"
    );

    worker = owner
        .start_activation_worker(|request| {
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled) => return ActivationCallbackResult::NotStarted,
                Ok(ActivationStart::Stale) => return ActivationCallbackResult::NotStarted,
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            let result = ActivationCallbackResult::Handled;
            let _ = presentation.complete(result);
            result
        })
        .expect("the owner must be able to restart its bounded receiver");
    owner
        .mark_ready()
        .expect("restarted receiver must restore readiness");
    assert!(spawn_child("second").success());

    drop(worker);
    drop(owner);

    let mut concurrent_owners = Vec::new();
    for _ in 0..4 {
        concurrent_owners.push(spawn_child_process("owner-hold"));
    }
    let concurrent_statuses = wait_all(concurrent_owners);
    assert_eq!(
        concurrent_statuses
            .iter()
            .filter(|status| status.success())
            .count(),
        1,
        "exactly one concurrent normal owner must acquire: {concurrent_statuses:?}"
    );

    let crash_owner = spawn_child("owner-crash");
    assert!(
        crash_owner.success(),
        "crash owner did not acquire: {crash_owner:?}"
    );
    thread::sleep(Duration::from_millis(100));

    let recovered = acquire_owner(Role::Normal);
    drop(recovered);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("qualification LocalAppData fixture must be removed");
}

#[test]
fn windows_normal_maintenance_contention_and_recovery_qualification() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");

    let test_root = create_fixture();
    let ready_file = test_root.join("role-waiter.ready");
    set_test_environment(
        &test_root,
        "windows_normal_maintenance_contention_and_recovery_qualification",
        &ready_file,
    );

    let normal = acquire_owner(Role::Normal);
    let maintenance_during_normal = spawn_child("maintenance-while-normal");
    assert_eq!(maintenance_during_normal.code(), Some(21));
    drop(normal);

    let maintenance = acquire_owner(Role::Maintenance);
    let normal_during_maintenance = spawn_child("normal-while-maintenance");
    assert_eq!(normal_during_maintenance.code(), Some(20));
    drop(maintenance);

    let mut contenders = Vec::new();
    for mode in [
        "owner-hold",
        "owner-hold",
        "maintenance-hold",
        "maintenance-hold",
    ] {
        contenders.push(spawn_child_process(mode));
    }
    let statuses = wait_all(contenders);
    assert_eq!(
        statuses.iter().filter(|status| status.success()).count(),
        1,
        "normal and maintenance contenders must have one winner: {statuses:?}"
    );

    let maintenance = acquire_owner(Role::Maintenance);
    drop(maintenance);
    let normal_after_maintenance = acquire_owner(Role::Normal);
    drop(normal_after_maintenance);

    clear_test_environment();
    fs::remove_dir_all(test_root).expect("role qualification fixture must be removed");
}

#[test]
fn windows_same_owner_maintenance_is_non_reentrant() {
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    let ready_file = test_root.join("same-owner-maintenance.ready");
    set_test_environment(
        &test_root,
        "windows_same_owner_maintenance_is_non_reentrant",
        &ready_file,
    );

    let owner = acquire_owner(Role::Maintenance);
    let repeated = acquire(Role::Maintenance)
        .expect_err("a maintenance owner must not acquire a second reentrant maintenance lease");
    assert_eq!(repeated.kind, NativeErrorKind::MaintenanceAlreadyHeld);
    drop(owner);

    clear_test_environment();
    fs::remove_dir_all(test_root).expect("same-owner maintenance fixture must be removed");
}

#[test]
fn windows_activation_timeout_reconciles_late_success_without_duplicate_callback() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");

    let test_root = create_fixture();
    let ready_file = test_root.join("delayed.ready");
    set_test_environment(
        &test_root,
        "windows_activation_timeout_reconciles_late_success_without_duplicate_callback",
        &ready_file,
    );

    let owner = acquire_owner(Role::Normal);
    let callbacks = Arc::new(AtomicUsize::new(0));
    let callback_started = Arc::new(AtomicBool::new(false));
    let callback_count = Arc::clone(&callbacks);
    let callback_started_flag = Arc::clone(&callback_started);
    let worker = owner
        .start_activation_worker(move |request| {
            callback_count.fetch_add(1, Ordering::SeqCst);
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled) => return ActivationCallbackResult::NotStarted,
                Ok(ActivationStart::Stale) => return ActivationCallbackResult::NotStarted,
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            callback_started_flag.store(true, Ordering::SeqCst);
            thread::sleep(Duration::from_millis(3_000));
            let result = ActivationCallbackResult::Handled;
            let _ = presentation.complete(result);
            result
        })
        .expect("same-session activation receiver must start");
    owner.mark_ready().expect("readiness must be committed");

    let first = spawn_child("second");
    assert_eq!(
        first.code(),
        Some(5),
        "a bounded wait with a callback still in flight must remain uncertain: {first:?}"
    );
    assert!(callback_started.load(Ordering::SeqCst));
    thread::sleep(Duration::from_millis(700));
    let second = spawn_child("second");
    assert!(
        second.success(),
        "the late handled result must reconcile without issuing a second callback: {second:?}"
    );
    assert_eq!(callbacks.load(Ordering::SeqCst), 1);

    drop(worker);
    drop(owner);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("delayed activation fixture must be removed");
}

#[test]
fn windows_owner_release_is_safe_when_lease_moves_threads() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    let ready_file = test_root.join("close-before-release.ready");
    set_test_environment(
        &test_root,
        "windows_owner_release_is_safe_when_lease_moves_threads",
        &ready_file,
    );

    let mut owner = acquire_owner(Role::Normal);
    let worker = owner
        .start_activation_worker(|_| ActivationCallbackResult::Uncertain)
        .expect("owner worker must start before close-order qualification");
    owner
        .mark_ready()
        .expect("owner must be ready before close-order qualification");
    let retained_controller = owner.controller();
    jarvis_windows_native::test_hold_before_arbitration_release();
    let release_thread = thread::spawn(move || owner.release());
    wait_for_arbitration_release_barrier();

    let waiter = spawn_child_process("recovery-waiter");
    wait_for_marker(&ready_file);
    jarvis_windows_native::test_continue_arbitration_release();
    assert!(
        release_thread
            .join()
            .expect("owner release thread must join")
            .is_ok(),
        "owner must close persistence/IPC before releasing arbitration"
    );
    assert!(
        waiter
            .wait_with_output()
            .expect("recovery waiter must exit")
            .status
            .success(),
        "fresh owner must recover after the close-before-release lifecycle"
    );
    assert_eq!(
        retained_controller
            .mark_ready()
            .expect_err("retained controller must fail closed after resource closure")
            .kind,
        NativeErrorKind::InvalidRuntimeState
    );
    drop(worker);

    clear_test_environment();
    fs::remove_dir_all(test_root).expect("moved-owner fixture must be removed");
}

#[test]
fn windows_worker_shutdown_quarantine_is_bounded_and_recoverable() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    let ready_file = test_root.join("quarantine-recovery.ready");
    set_test_environment(
        &test_root,
        "windows_worker_shutdown_quarantine_is_bounded_and_recoverable",
        &ready_file,
    );

    let mut owner = acquire_owner(Role::Normal);
    let callback_started = Arc::new(AtomicBool::new(false));
    let callback_unblock = Arc::new(AtomicBool::new(false));
    let callback_started_for_worker = Arc::clone(&callback_started);
    let callback_unblock_for_worker = Arc::clone(&callback_unblock);
    let worker = owner
        .start_activation_worker(move |request| {
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled | ActivationStart::Stale) => {
                    return ActivationCallbackResult::NotStarted;
                }
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            callback_started_for_worker.store(true, Ordering::Release);
            while !callback_unblock_for_worker.load(Ordering::Acquire) {
                thread::sleep(Duration::from_millis(5));
            }
            if presentation
                .complete(ActivationCallbackResult::Handled)
                .is_ok()
            {
                ActivationCallbackResult::Handled
            } else {
                ActivationCallbackResult::Uncertain
            }
        })
        .expect("worker must start before quarantine qualification");
    owner.mark_ready().expect("owner must be ready");

    let mut activation = spawn_child_process("second");
    let started = std::time::Instant::now();
    while !callback_started.load(Ordering::Acquire) {
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "qualification callback did not enter its bounded blocking phase"
        );
        thread::sleep(Duration::from_millis(10));
    }

    let controller = owner.controller();
    let release_thread = thread::spawn(move || owner.release());
    let release_error = release_thread
        .join()
        .expect("owner release thread must join")
        .expect_err("a live callback must keep shutdown uncertain");
    assert_eq!(release_error.kind, NativeErrorKind::ActivationUncertain);
    assert_eq!(
        controller
            .mark_ready()
            .expect_err("shutdown failure must not restore readiness")
            .kind,
        NativeErrorKind::InvalidRuntimeState
    );

    let mut waiter = spawn_child_process("recovery-waiter-retry");
    wait_for_marker(&ready_file);
    assert!(
        waiter
            .try_wait()
            .expect("recovery waiter status must be readable")
            .is_none(),
        "the owner-scoped deferred arbitration must remain held before recovery"
    );

    callback_unblock.store(true, Ordering::Release);
    let recovery_started = std::time::Instant::now();
    loop {
        match controller.recover_after_shutdown() {
            Ok(()) => break,
            Err(error) if error.kind == NativeErrorKind::ActivationUncertain => {
                assert!(
                    recovery_started.elapsed() < Duration::from_secs(2),
                    "quarantined worker did not become reapable within the bounded recovery window"
                );
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) => panic!("unexpected shutdown recovery error: {error:?}"),
        }
    }
    assert!(
        waiter
            .wait_with_output()
            .expect("recovery waiter must exit after explicit recovery")
            .status
            .success(),
        "a fresh owner must acquire only after the deferred arbitration is explicitly released"
    );
    assert_eq!(
        activation
            .wait()
            .expect("activation requester must exit")
            .code(),
        Some(5),
        "the in-flight request must remain uncertain during failed owner shutdown"
    );
    assert_eq!(
        controller
            .mark_ready()
            .expect_err("recovery must not restore the old controller's authority")
            .kind,
        NativeErrorKind::InvalidRuntimeState
    );

    drop(worker);
    drop(controller);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("quarantine fixture must be removed");
}

#[test]
fn windows_inflight_worker_failure_reconciles_after_join() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_inflight_worker_failure_reconciles_after_join",
        &test_root.join("unused.ready"),
    );

    let owner = acquire_owner(Role::Normal);
    let callback_started = Arc::new(AtomicBool::new(false));
    let callback_unblock = Arc::new(AtomicBool::new(false));
    let callback_finished = Arc::new(AtomicBool::new(false));
    let callback_started_for_worker = Arc::clone(&callback_started);
    let callback_unblock_for_worker = Arc::clone(&callback_unblock);
    let callback_finished_for_worker = Arc::clone(&callback_finished);
    let worker = owner
        .start_activation_worker(move |request| {
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled | ActivationStart::Stale) => {
                    return ActivationCallbackResult::NotStarted;
                }
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            callback_started_for_worker.store(true, Ordering::Release);
            while !callback_unblock_for_worker.load(Ordering::Acquire) {
                thread::sleep(Duration::from_millis(5));
            }
            drop(presentation);
            callback_finished_for_worker.store(true, Ordering::Release);
            ActivationCallbackResult::Uncertain
        })
        .expect("worker must start before in-flight failure qualification");
    owner.mark_ready().expect("owner must be ready");

    let mut activation = spawn_child_process("second");
    let started = std::time::Instant::now();
    while !callback_started.load(Ordering::Acquire) {
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "qualification callback did not enter its in-flight phase"
        );
        thread::sleep(Duration::from_millis(10));
    }

    // Dropping the public worker handle cannot detach a callback that is still
    // running. It leaves an owner-scoped quarantine until the callback exits.
    drop(worker);
    assert!(
        owner
            .start_activation_worker(|_| ActivationCallbackResult::Uncertain)
            .expect_err("a live quarantined worker must block restart")
            .kind
            == NativeErrorKind::ActivationUncertain
    );
    callback_unblock.store(true, Ordering::Release);
    let recovery_started = std::time::Instant::now();
    let restarted_worker = loop {
        match owner.start_activation_worker(|_| ActivationCallbackResult::Uncertain) {
            Ok(worker) => break worker,
            Err(error) if error.kind == NativeErrorKind::ActivationUncertain => {
                assert!(
                    recovery_started.elapsed() < INFLIGHT_WORKER_RECOVERY_TIMEOUT,
                    "in-flight worker failure did not reach a bounded joined state"
                );
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) => panic!("unexpected worker recovery error: {error:?}"),
        }
    };
    assert!(callback_finished.load(Ordering::Acquire));
    owner
        .mark_ready()
        .expect("reconciled uncertainty must permit a fresh readiness transition");
    assert_eq!(
        activation
            .wait()
            .expect("in-flight activation requester must exit")
            .code(),
        Some(5),
        "the failed in-flight request must not be reported as acknowledged"
    );

    drop(restarted_worker);
    drop(owner);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("in-flight failure fixture must be removed");
}

#[test]
fn windows_partial_resource_close_failure_requires_explicit_recovery() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");

    for failure in ["state", "activation", "ack"] {
        let test_root = create_fixture();
        let ready_file = test_root.join("partial-close.ready");
        set_test_environment(
            &test_root,
            "windows_partial_resource_close_failure_requires_explicit_recovery",
            &ready_file,
        );

        let mut owner = acquire_owner(Role::Normal);
        let controller = owner.controller();
        match failure {
            "state" => jarvis_windows_native::test_fail_next_state_close(),
            "activation" => jarvis_windows_native::test_fail_next_activation_close(),
            "ack" => jarvis_windows_native::test_fail_next_ack_close(),
            _ => unreachable!("fixed close-failure cases"),
        }
        let expected_kind = match failure {
            "state" => NativeErrorKind::StateUnavailable,
            "activation" | "ack" => NativeErrorKind::EventUnavailable,
            _ => unreachable!("fixed close-failure cases"),
        };
        let first_error = owner
            .release()
            .expect_err("the injected resource close failure must be reported");
        assert_eq!(first_error.kind, expected_kind);
        assert_eq!(
            owner
                .release()
                .expect_err("a deferred release must not become a false success")
                .kind,
            expected_kind
        );

        let mut waiter = spawn_child_process("recovery-waiter-retry");
        wait_for_marker(&ready_file);
        assert!(
            waiter
                .try_wait()
                .expect("recovery waiter status must be readable")
                .is_none(),
            "arbitration must remain held before explicit close recovery for {failure}"
        );
        controller
            .recover_after_shutdown()
            .expect("partial resource closure must be recoverable");
        assert!(
            waiter
                .wait_with_output()
                .expect("recovery waiter must exit")
                .status
                .success(),
            "fresh ownership must follow explicit resource recovery for {failure}"
        );
        assert!(
            owner.release().is_ok(),
            "release must become idempotently successful only after recovery for {failure}"
        );
        assert!(
            controller.recover_after_shutdown().is_ok(),
            "successful recovery must be idempotent for {failure}"
        );

        drop(controller);
        clear_test_environment();
        fs::remove_dir_all(test_root).expect("partial-close fixture must be removed");
    }
}

#[test]
fn windows_deferred_shutdown_without_controller_joins_and_stays_fail_closed() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    let ready_file = test_root.join("deferred-disposal.ready");
    set_test_environment(
        &test_root,
        "windows_deferred_shutdown_without_controller_joins_and_stays_fail_closed",
        &ready_file,
    );

    let mut owner = acquire_owner(Role::Normal);
    let callback_started = Arc::new(AtomicBool::new(false));
    let callback_unblock = Arc::new(AtomicBool::new(false));
    let callback_finished = Arc::new(AtomicBool::new(false));
    let callback_started_for_worker = Arc::clone(&callback_started);
    let callback_unblock_for_worker = Arc::clone(&callback_unblock);
    let callback_finished_for_worker = Arc::clone(&callback_finished);
    let worker = owner
        .start_activation_worker(move |request| {
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled | ActivationStart::Stale) => {
                    return ActivationCallbackResult::NotStarted;
                }
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            callback_started_for_worker.store(true, Ordering::Release);
            while !callback_unblock_for_worker.load(Ordering::Acquire) {
                thread::sleep(Duration::from_millis(5));
            }
            drop(presentation);
            callback_finished_for_worker.store(true, Ordering::Release);
            ActivationCallbackResult::Uncertain
        })
        .expect("worker must start before deferred-disposal qualification");
    owner.mark_ready().expect("owner must be ready");
    let mut activation = spawn_child_process("second");
    let started = std::time::Instant::now();
    while !callback_started.load(Ordering::Acquire) {
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "callback did not enter the deferred-disposal phase"
        );
        thread::sleep(Duration::from_millis(10));
    }

    let first_error = owner
        .release()
        .expect_err("live callback shutdown must remain uncertain");
    assert_eq!(first_error.kind, NativeErrorKind::ActivationUncertain);
    assert_eq!(
        owner
            .release()
            .expect_err("repeated live-worker release must remain uncertain")
            .kind,
        NativeErrorKind::ActivationUncertain
    );
    callback_unblock.store(true, Ordering::Release);
    let callback_deadline = std::time::Instant::now() + Duration::from_secs(2);
    while !callback_finished.load(Ordering::Acquire) {
        assert!(
            std::time::Instant::now() < callback_deadline,
            "deferred callback did not terminate"
        );
        thread::sleep(Duration::from_millis(10));
    }
    assert_eq!(
        activation
            .wait()
            .expect("activation requester must exit")
            .code(),
        Some(5)
    );
    drop(worker);
    drop(owner);
    assert_eq!(
        jarvis_windows_native::test_active_arbitration_threads(),
        0,
        "dropping the last deferred owner must join the arbitration thread"
    );

    assert!(
        test_root.join("JARVIS").join("owner.state").exists(),
        "deferred owner state must remain present until the owning process exits"
    );
    let waiter = spawn_child_process("recovery-waiter-retry");
    let waiter_status = waiter
        .wait_with_output()
        .expect("fail-closed recovery waiter must exit");
    assert!(!waiter_status.status.success());

    clear_test_environment();
    fs::remove_dir_all(test_root).expect("deferred-disposal fixture must be removed");
}

#[test]
fn windows_lifecycle_gate_serializes_release_worker_and_recovery_operations() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_lifecycle_gate_serializes_release_worker_and_recovery_operations",
        &test_root.join("lifecycle-gate.ready"),
    );

    let owner = acquire_owner(Role::Normal);
    let controller = owner.controller();
    let barrier = Arc::new(Barrier::new(4));

    let release_barrier = Arc::clone(&barrier);
    let release_thread = thread::spawn(move || {
        release_barrier.wait();
        let mut owner = owner;
        owner.release()
    });

    let start_barrier = Arc::clone(&barrier);
    let start_controller = controller.clone();
    let start_thread = thread::spawn(move || {
        start_barrier.wait();
        start_controller.start_activation_worker(|_| ActivationCallbackResult::Uncertain)
    });

    let ready_barrier = Arc::clone(&barrier);
    let ready_controller = controller.clone();
    let ready_thread = thread::spawn(move || {
        ready_barrier.wait();
        ready_controller.mark_ready()
    });

    let recovery_barrier = Arc::clone(&barrier);
    let recovery_controller = controller.clone();
    let recovery_thread = thread::spawn(move || {
        recovery_barrier.wait();
        recovery_controller.recover_after_shutdown()
    });

    let release_result = release_thread
        .join()
        .expect("release race thread must not panic");
    let start_result = start_thread
        .join()
        .expect("worker-start race thread must not panic");
    let ready_result = ready_thread
        .join()
        .expect("readiness race thread must not panic");
    let recovery_result = recovery_thread
        .join()
        .expect("recovery race thread must not panic");

    if let Ok(worker) = start_result {
        drop(worker);
    }
    assert!(
        release_result.is_ok(),
        "a cooperative concurrent release must complete: {release_result:?}"
    );
    assert!(
        ready_result.is_ok()
            || ready_result
                .as_ref()
                .expect_err("readiness race result must be an error")
                .kind
                == NativeErrorKind::InvalidRuntimeState,
        "readiness race must be serialized and typed: {ready_result:?}"
    );
    assert!(
        recovery_result.is_ok()
            || recovery_result
                .as_ref()
                .expect_err("recovery race result must be an error")
                .kind
                == NativeErrorKind::InvalidRuntimeState,
        "recovery race must be serialized and typed: {recovery_result:?}"
    );
    assert_eq!(
        jarvis_windows_native::test_active_arbitration_threads(),
        0,
        "serialized lifecycle completion must retire arbitration"
    );

    drop(controller);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("lifecycle-gate fixture must be removed");
}

#[test]
fn windows_unexpected_worker_panic_is_reaped_and_recoverable() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_unexpected_worker_panic_is_reaped_and_recoverable",
        &test_root.join("unexpected-panic.ready"),
    );

    let owner = acquire_owner(Role::Normal);
    let callback_started = Arc::new(AtomicBool::new(false));
    let callback_started_for_worker = Arc::clone(&callback_started);
    let worker = owner
        .start_activation_worker(move |request| {
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled | ActivationStart::Stale) => {
                    return ActivationCallbackResult::NotStarted;
                }
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            callback_started_for_worker.store(true, Ordering::Release);
            drop(presentation);
            ActivationCallbackResult::Uncertain
        })
        .expect("worker must start before unexpected-panic qualification");
    owner.mark_ready().expect("owner must be ready");
    let mut activation = spawn_child_process("second");
    let started = std::time::Instant::now();
    while !callback_started.load(Ordering::Acquire) {
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "callback did not run before the worker panic seam"
        );
        thread::sleep(Duration::from_millis(10));
    }
    jarvis_windows_native::test_panic_next_worker_after_callback();
    let panic_deadline = std::time::Instant::now() + Duration::from_secs(2);
    loop {
        match owner.mark_ready() {
            Ok(()) => {
                assert!(
                    std::time::Instant::now() < panic_deadline,
                    "unexpected worker panic did not clear readiness"
                );
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) if error.kind == NativeErrorKind::InvalidRuntimeState => break,
            Err(error) => panic!("unexpected readiness result before panic reaping: {error:?}"),
        }
    }

    let recovery_started = std::time::Instant::now();
    let restarted_worker = loop {
        match owner.start_activation_worker(|_| ActivationCallbackResult::Uncertain) {
            Ok(worker) => break worker,
            Err(error) if error.kind == NativeErrorKind::ActivationUncertain => {
                assert!(
                    recovery_started.elapsed() < Duration::from_secs(2),
                    "unexpected worker panic remained permanently unreapable"
                );
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) => panic!("unexpected panic recovery error: {error:?}"),
        }
    };
    assert_eq!(
        activation
            .wait()
            .expect("unexpected-panic requester must exit")
            .code(),
        Some(5),
        "a worker panic must not acknowledge the in-flight request"
    );
    owner
        .mark_ready()
        .expect("readiness may be restored only by the explicit fresh worker");
    drop(worker);
    drop(restarted_worker);
    drop(owner);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("unexpected-panic fixture must be removed");
}

#[test]
fn windows_state_unlock_uncertainty_is_reported_and_recoverable() {
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_state_unlock_uncertainty_is_reported_and_recoverable",
        &test_root.join("unused.ready"),
    );

    let owner = acquire_owner(Role::Normal);
    assert_eq!(
        owner
            .mark_ready()
            .expect_err("readiness must require an active worker")
            .kind,
        NativeErrorKind::InvalidRuntimeState
    );
    let worker = owner
        .start_activation_worker(|_| ActivationCallbackResult::Uncertain)
        .expect("worker must start before readiness qualification");
    jarvis_windows_native::test_fail_next_state_unlock();
    assert_eq!(
        owner
            .mark_ready()
            .expect_err("unlock failure must be surfaced")
            .kind,
        NativeErrorKind::LockUncertain
    );
    owner
        .mark_ready()
        .expect("the next transaction must recover after the injected cleanup failure");
    drop(worker);
    drop(owner);

    clear_test_environment();
    fs::remove_dir_all(test_root).expect("unlock-failure fixture must be removed");
}

#[test]
fn windows_state_unlock_cleanup_failure_remains_fail_closed() {
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_state_unlock_cleanup_failure_remains_fail_closed",
        &test_root.join("unused.ready"),
    );

    let owner = acquire_owner(Role::Normal);
    let worker = owner
        .start_activation_worker(|_| ActivationCallbackResult::Uncertain)
        .expect("worker must start before state-lock cleanup qualification");
    jarvis_windows_native::test_fail_next_state_unlock_before_call();
    assert_eq!(
        owner
            .mark_ready()
            .expect_err("pre-call unlock failure must be surfaced")
            .kind,
        NativeErrorKind::LockUncertain
    );
    assert_eq!(
        owner
            .mark_ready()
            .expect_err("the production cleanup-failed latch must fail closed")
            .kind,
        NativeErrorKind::LockUncertain
    );

    drop(worker);
    drop(owner);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("fail-closed state-lock fixture must be removed");
}

#[test]
fn windows_stale_generation_cannot_signal_or_mutate_new_request() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_stale_generation_cannot_signal_or_mutate_new_request",
        &test_root.join("unused.ready"),
    );

    let owner = acquire_owner(Role::Normal);
    let stale_request = Arc::new(Mutex::new(None));
    let callback_count = Arc::new(AtomicUsize::new(0));
    let stale_request_for_callback = Arc::clone(&stale_request);
    let callback_count_for_callback = Arc::clone(&callback_count);
    let worker = owner
        .start_activation_worker(move |request| {
            let sequence = callback_count_for_callback.fetch_add(1, Ordering::SeqCst);
            if sequence == 0 {
                *stale_request_for_callback
                    .lock()
                    .expect("stale request slot must remain usable") = Some(request.clone());
            } else if sequence == 1 {
                let stale = stale_request_for_callback
                    .lock()
                    .expect("stale request slot must remain usable")
                    .take()
                    .expect("the first generation must be retained");
                assert!(matches!(
                    stale
                        .begin_presentation()
                        .expect("stale begin must be classified"),
                    ActivationStart::Stale
                ));
                assert_eq!(stale.cancel(), ActivationCancellation::Stale);
            }
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled | ActivationStart::Stale) => {
                    return ActivationCallbackResult::NotStarted;
                }
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            let result = ActivationCallbackResult::Handled;
            let _ = presentation.complete(result);
            result
        })
        .expect("same-session activation receiver must start");
    owner.mark_ready().expect("readiness must be committed");

    let first = spawn_child_with_report("stale-generation", "second");
    assert!(first.success(), "first stale-generation child failed");
    let second = spawn_child_with_report("stale-generation", "second");
    assert!(second.success(), "second stale-generation child failed");
    assert_eq!(callback_count.load(Ordering::SeqCst), 2);

    drop(worker);
    drop(owner);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("stale-generation fixture must be removed");
}

#[derive(Clone, Copy, Debug)]
enum CancelReleaseBarrier {
    AfterPreflight,
    BeforeAcknowledgement,
}

#[test]
fn windows_cancel_serializes_with_release_before_state_and_ack_boundaries() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");

    for (_case_name, barrier) in [
        (
            "windows_cancel_release_after_preflight",
            CancelReleaseBarrier::AfterPreflight,
        ),
        (
            "windows_cancel_release_before_ack",
            CancelReleaseBarrier::BeforeAcknowledgement,
        ),
    ] {
        let test_root = create_fixture();
        set_test_environment(
            &test_root,
            "windows_cancel_serializes_with_release_before_state_and_ack_boundaries",
            &test_root.join("unused.ready"),
        );

        let mut owner = acquire_owner(Role::Normal);
        let request_slot = Arc::new(Mutex::new(None));
        let callback_started = Arc::new(AtomicBool::new(false));
        let callback_unblock = Arc::new(AtomicBool::new(false));
        let request_slot_for_worker = Arc::clone(&request_slot);
        let callback_started_for_worker = Arc::clone(&callback_started);
        let callback_unblock_for_worker = Arc::clone(&callback_unblock);
        let worker = owner
            .start_activation_worker(move |request| {
                *request_slot_for_worker
                    .lock()
                    .expect("cancellation request slot must remain usable") = Some(request);
                callback_started_for_worker.store(true, Ordering::Release);
                while !callback_unblock_for_worker.load(Ordering::Acquire) {
                    thread::sleep(Duration::from_millis(5));
                }
                ActivationCallbackResult::NotStarted
            })
            .expect("worker must start before cancellation/release qualification");
        owner.mark_ready().expect("owner must be ready");

        let mut activation = spawn_child_process("second");
        let callback_wait_started = std::time::Instant::now();
        while !callback_started.load(Ordering::Acquire) {
            if let Some(status) = activation
                .try_wait()
                .expect("activation status must be readable")
            {
                panic!(
                    "cancellation callback did not expose its request; requester exited: {status:?}"
                );
            }
            assert!(
                callback_wait_started.elapsed() < Duration::from_secs(2),
                "cancellation callback did not expose its request"
            );
            thread::sleep(Duration::from_millis(10));
        }
        let request = request_slot
            .lock()
            .expect("cancellation request slot must remain usable")
            .clone()
            .expect("the callback must retain the exact activation request");

        match barrier {
            CancelReleaseBarrier::AfterPreflight => {
                jarvis_windows_native::test_hold_cancel_after_preflight();
            }
            CancelReleaseBarrier::BeforeAcknowledgement => {
                jarvis_windows_native::test_hold_cancel_before_ack();
            }
        }

        let cancel_thread = thread::spawn(move || request.cancel());
        match barrier {
            CancelReleaseBarrier::AfterPreflight => wait_for_flag_fn(
                jarvis_windows_native::test_cancel_after_preflight_barrier_reached,
                "cancellation did not reach its post-preflight barrier",
            ),
            CancelReleaseBarrier::BeforeAcknowledgement => wait_for_flag_fn(
                jarvis_windows_native::test_cancel_before_ack_barrier_reached,
                "cancellation did not reach its pre-acknowledgement barrier",
            ),
        }

        let release_started = Arc::new(AtomicBool::new(false));
        let release_finished = Arc::new(AtomicBool::new(false));
        let release_started_for_thread = Arc::clone(&release_started);
        let release_finished_for_thread = Arc::clone(&release_finished);
        let release_thread = thread::spawn(move || {
            release_started_for_thread.store(true, Ordering::Release);
            let result = owner.release();
            release_finished_for_thread.store(true, Ordering::Release);
            result
        });
        wait_for_flag(&release_started, "release thread did not start");
        thread::sleep(Duration::from_millis(100));
        assert!(
            !release_finished.load(Ordering::Acquire),
            "release must remain behind the cancellation presentation gate"
        );
        assert!(
            activation
                .try_wait()
                .expect("activation status must be readable")
                .is_none(),
            "the requester must not observe acknowledgement while cancellation is paused"
        );

        match barrier {
            CancelReleaseBarrier::AfterPreflight => {
                jarvis_windows_native::test_continue_cancel_after_preflight();
            }
            CancelReleaseBarrier::BeforeAcknowledgement => {
                jarvis_windows_native::test_continue_cancel_before_ack();
            }
        }
        assert_eq!(
            cancel_thread
                .join()
                .expect("cancellation thread must not panic"),
            ActivationCancellation::Cancelled
        );
        assert_eq!(
            activation
                .wait()
                .expect("cancelled activation requester must exit")
                .code(),
            Some(5),
            "a cancellation must not be reported as an acknowledged activation"
        );
        callback_unblock.store(true, Ordering::Release);
        assert!(
            release_thread
                .join()
                .expect("release thread must not panic")
                .is_ok(),
            "release must complete after cancellation leaves the presentation gate"
        );

        let stale_request = request_slot
            .lock()
            .expect("cancellation request slot must remain usable")
            .take()
            .expect("the stale request must remain available for closed-resource testing");
        assert_eq!(
            stale_request.cancel(),
            ActivationCancellation::Uncertain,
            "a retained request must fail closed after its owner resources close"
        );

        drop(worker);
        let fresh_owner = acquire_owner(Role::Normal);
        let fresh_worker = fresh_owner
            .start_activation_worker(|request| {
                let presentation = match request.begin_presentation() {
                    Ok(ActivationStart::Started(presentation)) => presentation,
                    Ok(ActivationStart::Cancelled | ActivationStart::Stale) => {
                        return ActivationCallbackResult::NotStarted;
                    }
                    Err(_) => return ActivationCallbackResult::Uncertain,
                };
                let result = ActivationCallbackResult::Handled;
                let _ = presentation.complete(result);
                result
            })
            .expect("a fresh owner must start after serialized release");
        fresh_owner
            .mark_ready()
            .expect("fresh owner must become ready after serialized release");
        assert!(
            spawn_child("second").success(),
            "a fresh owner must not be affected by a retained stale request"
        );
        drop(fresh_worker);
        drop(fresh_owner);

        clear_test_environment();
        fs::remove_dir_all(test_root).expect("cancellation/release fixture must be removed");
    }
}

#[test]
fn windows_event_signal_failure_is_typed_and_recovers_closed() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_event_signal_failure_is_typed_and_recovers_closed",
        &test_root.join("unused.ready"),
    );

    let owner = acquire_owner(Role::Normal);
    let fail_signal = Arc::new(AtomicBool::new(true));
    let signal_failed = Arc::new(AtomicBool::new(false));
    let fail_signal_for_callback = Arc::clone(&fail_signal);
    let signal_failed_for_callback = Arc::clone(&signal_failed);
    let mut worker = owner
        .start_activation_worker(move |request| {
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled | ActivationStart::Stale) => {
                    return ActivationCallbackResult::NotStarted;
                }
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            if fail_signal_for_callback.swap(false, Ordering::SeqCst) {
                jarvis_windows_native::test_fail_next_event_signal();
            }
            let result = ActivationCallbackResult::Handled;
            if presentation.complete(result).is_err() {
                signal_failed_for_callback.store(true, Ordering::SeqCst);
                return ActivationCallbackResult::Uncertain;
            }
            result
        })
        .expect("same-session activation receiver must start");
    owner.mark_ready().expect("readiness must be committed");

    let failed = spawn_child("second");
    assert_eq!(failed.code(), Some(5));
    assert!(signal_failed.load(Ordering::SeqCst));

    drop(worker);
    worker = owner
        .start_activation_worker(|request| {
            let presentation = match request.begin_presentation() {
                Ok(ActivationStart::Started(presentation)) => presentation,
                Ok(ActivationStart::Cancelled | ActivationStart::Stale) => {
                    return ActivationCallbackResult::NotStarted;
                }
                Err(_) => return ActivationCallbackResult::Uncertain,
            };
            let result = ActivationCallbackResult::Handled;
            let _ = presentation.complete(result);
            result
        })
        .expect("worker must restart after typed event failure");
    owner
        .mark_ready()
        .expect("readiness must recover after restart");
    let recovered = spawn_child_with_report("event-signal-recovery", "second");
    assert!(recovered.success(), "event-signal recovery child failed");

    drop(worker);
    drop(owner);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("event-failure fixture must be removed");
}

#[test]
fn windows_mutex_wait_failure_is_reported_without_claiming_ownership() {
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_mutex_wait_failure_is_reported_without_claiming_ownership",
        &test_root.join("unused.ready"),
    );

    jarvis_windows_native::test_fail_next_mutex_wait();
    assert_eq!(
        acquire(Role::Normal)
            .expect_err("injected mutex wait failure must be surfaced")
            .kind,
        NativeErrorKind::ArbitrationUnavailable
    );
    assert_eq!(
        jarvis_windows_native::test_active_arbitration_threads(),
        0,
        "an acquisition wait failure must retire its arbitration thread"
    );

    clear_test_environment();
    fs::remove_dir_all(test_root).expect("mutex-wait fixture must be removed");
}

#[test]
fn windows_mutex_release_failure_is_uncertain_and_disables_authority() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }
    let _guard = qualification_lock().lock().expect("qualification lock");
    let test_root = create_fixture();
    set_test_environment(
        &test_root,
        "windows_mutex_release_failure_is_uncertain_and_disables_authority",
        &test_root.join("unused.ready"),
    );

    let failed_owner = spawn_child("mutex-release-failure-owner");
    assert_eq!(
        failed_owner.code(),
        Some(0),
        "failed owner must dispose its joined arbitration lifecycle: {failed_owner:?}"
    );
    let recovered = acquire_owner(Role::Normal);
    drop(recovered);

    clear_test_environment();
    fs::remove_dir_all(test_root).expect("mutex-release fixture must be removed");
}

fn create_fixture() -> std::path::PathBuf {
    let test_root = env::temp_dir().join(format!(
        "JARVIS-NativeQualification-{}-{}",
        process::id(),
        unique_suffix()
    ));
    fs::create_dir_all(&test_root).expect("qualification LocalAppData fixture must be created");
    let mut fixtures = match qualification_fixtures().lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    fixtures.push(test_root.clone());
    test_root
}

fn qualification_lock() -> &'static QualificationMutex {
    QUALIFICATION_LOCK.get_or_init(|| QualificationMutex(Mutex::new(())))
}

fn qualification_fixtures() -> &'static Mutex<Vec<PathBuf>> {
    QUALIFICATION_FIXTURES.get_or_init(|| Mutex::new(Vec::new()))
}

fn cleanup_fixtures() {
    let fixtures = match qualification_fixtures().lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    for path in fixtures.iter() {
        for _ in 0..5 {
            if !path.exists() || fs::remove_dir_all(path).is_ok() {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
    }
    drop(fixtures);
    let mut fixtures = match qualification_fixtures().lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    fixtures.retain(|path| path.exists());
}

fn set_test_environment(test_root: &Path, test_name: &str, ready_file: &Path) {
    jarvis_windows_native::test_clear_acquisition_diagnostic();
    // SAFETY: this qualification process establishes isolated test-only
    // variables before any child process is spawned.
    unsafe {
        env::set_var("JARVIS_NATIVE_TEST_LOCALAPPDATA", test_root);
        env::set_var(TEST_NAME_ENV, test_name);
        env::set_var(READY_FILE_ENV, ready_file);
    }
}

fn clear_test_environment() {
    jarvis_windows_native::test_clear_acquisition_diagnostic();
    // SAFETY: all qualification child processes have exited; only the
    // process-local test variables are removed.
    unsafe {
        env::remove_var("JARVIS_NATIVE_TEST_LOCALAPPDATA");
        env::remove_var(TEST_NAME_ENV);
        env::remove_var(READY_FILE_ENV);
    }
}

fn acquire_owner(role: Role) -> jarvis_windows_native::OwnerLease {
    match acquire(role) {
        Ok(Acquisition::Owner(owner)) => owner,
        Ok(Acquisition::SecondLaunch(_)) => {
            panic!("qualification unexpectedly found an existing owner")
        }
        Err(error) => {
            let diagnostic =
                jarvis_windows_native::test_acquisition_diagnostic().unwrap_or_else(|| {
                    "stage=unknown;api=unknown;status_kind=NONE;status=none".to_owned()
                });
            panic!("qualification owner must acquire: {error:?}; {diagnostic}");
        }
    }
}

fn assert_fixed_directories(test_root: &std::path::Path) {
    let root = test_root.join("JARVIS");
    for directory in [
        "data",
        "backups",
        "logs",
        "cache",
        "artifacts",
        "modules",
        "updates",
        "recovery",
    ] {
        assert!(
            root.join(directory).is_dir(),
            "missing fixed data directory {directory}"
        );
    }
}

fn unique_suffix() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock must be after epoch")
        .as_nanos()
}

fn run_child(mode: &str) {
    match mode {
        "second" => match acquire(Role::Normal) {
            Ok(Acquisition::SecondLaunch(result)) if result.acknowledged => (),
            Ok(Acquisition::SecondLaunch(_)) => process::exit(2),
            Ok(Acquisition::Owner(_)) => process::exit(3),
            Err(error) if error.kind == NativeErrorKind::NotReady => process::exit(4),
            Err(error) => exit_child_acquisition_failure(mode, error, 5),
        },
        "recovery-waiter" => match acquire(Role::Normal) {
            Ok(Acquisition::Owner(_owner)) => process::exit(0),
            Ok(Acquisition::SecondLaunch(_)) => process::exit(6),
            Err(error) => exit_child_acquisition_failure(mode, error, 7),
        },
        "recovery-waiter-retry" => {
            let deadline = std::time::Instant::now() + Duration::from_secs(4);
            loop {
                match acquire(Role::Normal) {
                    Ok(Acquisition::Owner(_owner)) => process::exit(0),
                    Ok(Acquisition::SecondLaunch(_)) => process::exit(6),
                    Err(_) if std::time::Instant::now() < deadline => {
                        thread::sleep(Duration::from_millis(25));
                    }
                    Err(error) => exit_child_acquisition_failure(mode, error, 7),
                }
            }
        }
        "owner-crash" => match acquire(Role::Normal) {
            Ok(Acquisition::Owner(_owner)) => process::exit(0),
            Ok(Acquisition::SecondLaunch(_)) => process::exit(8),
            Err(error) => exit_child_acquisition_failure(mode, error, 9),
        },
        "mutex-release-failure-owner" => {
            let mut owner = acquire_owner(Role::Normal);
            let worker = owner
                .start_activation_worker(|_| ActivationCallbackResult::Uncertain)
                .expect("release-failure owner worker must start");
            owner
                .mark_ready()
                .expect("release-failure owner must become ready");
            jarvis_windows_native::test_fail_next_mutex_release();
            let error = owner
                .release()
                .expect_err("injected mutex release failure must be surfaced");
            let repeated_error = owner
                .release()
                .expect_err("repeated uncertain release must remain uncertain");
            if error.kind != NativeErrorKind::ArbitrationReleaseUncertain
                || repeated_error.kind != NativeErrorKind::ArbitrationReleaseUncertain
                || owner.mark_ready().is_ok()
                || jarvis_windows_native::test_active_arbitration_threads() != 0
            {
                process::exit(30);
            }
            drop(worker);
            process::exit(0);
        }
        "owner-hold" => match acquire(Role::Normal) {
            Ok(Acquisition::Owner(_owner)) => {
                thread::sleep(Duration::from_millis(2_000));
                process::exit(0);
            }
            Ok(Acquisition::SecondLaunch(_)) => process::exit(10),
            Err(error) => exit_child_acquisition_failure(mode, error, 11),
        },
        "maintenance-hold" => match acquire(Role::Maintenance) {
            Ok(Acquisition::Owner(_owner)) => {
                thread::sleep(Duration::from_millis(1_000));
                process::exit(0);
            }
            Ok(Acquisition::SecondLaunch(_)) => process::exit(12),
            Err(error) => exit_child_acquisition_failure(mode, error, 13),
        },
        "maintenance-while-normal" => match acquire(Role::Maintenance) {
            Err(error) if error.kind == NativeErrorKind::NormalHeld => process::exit(21),
            _ => process::exit(22),
        },
        "normal-while-maintenance" => match acquire(Role::Normal) {
            Err(error) if error.kind == NativeErrorKind::MaintenanceHeld => process::exit(20),
            _ => process::exit(23),
        },
        _ => process::exit(24),
    }
}

fn wait_for_marker(path: &std::path::Path) {
    let started = std::time::Instant::now();
    while !path.exists() {
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "qualification child did not reach its bounded wait marker"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_for_flag(flag: &AtomicBool, description: &str) {
    let started = std::time::Instant::now();
    while !flag.load(Ordering::Acquire) {
        assert!(started.elapsed() < Duration::from_secs(2), "{description}");
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_for_flag_fn(mut flag: impl FnMut() -> bool, description: &str) {
    let started = std::time::Instant::now();
    while !flag() {
        assert!(started.elapsed() < Duration::from_secs(2), "{description}");
        thread::sleep(Duration::from_millis(10));
    }
}

fn wait_for_arbitration_release_barrier() {
    let started = std::time::Instant::now();
    while !jarvis_windows_native::test_arbitration_release_barrier_reached() {
        assert!(
            started.elapsed() < Duration::from_secs(2),
            "owner release did not close resources before arbitration barrier"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

fn spawn_child(mode: &str) -> ExitStatus {
    spawn_child_process(mode)
        .wait()
        .expect("spawn qualification child")
}

const CHILD_REPORT_MAX_CHARS: usize = 2_048;

#[derive(Debug)]
struct ChildOutcome {
    pid: Option<u32>,
    status: Option<ExitStatus>,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    launch_error: Option<String>,
    wait_error: Option<String>,
}

impl ChildOutcome {
    fn success(&self) -> bool {
        self.status.is_some_and(|status| status.success())
    }
}

fn spawn_child_with_report(label: &str, mode: &str) -> ChildOutcome {
    let test_name = env::var(TEST_NAME_ENV).unwrap_or_else(|_| DEFAULT_TEST_NAME.to_owned());
    let executable = match env::current_exe() {
        Ok(executable) => executable,
        Err(error) => {
            return ChildOutcome {
                pid: None,
                status: None,
                stdout: Vec::new(),
                stderr: Vec::new(),
                launch_error: Some(error.to_string()),
                wait_error: None,
            };
        }
    };
    let mut command = Command::new(executable);
    command
        .env(CHILD_ENV, mode)
        .arg("--exact")
        .arg(&test_name)
        .arg("--nocapture")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            return ChildOutcome {
                pid: None,
                status: None,
                stdout: Vec::new(),
                stderr: Vec::new(),
                launch_error: Some(error.to_string()),
                wait_error: None,
            };
        }
    };
    let pid = Some(child.id());
    match child.wait_with_output() {
        Ok(output) => ChildOutcome {
            pid,
            status: Some(output.status),
            stdout: output.stdout,
            stderr: output.stderr,
            launch_error: None,
            wait_error: None,
        },
        Err(error) => ChildOutcome {
            pid,
            status: None,
            stdout: Vec::new(),
            stderr: Vec::new(),
            launch_error: None,
            wait_error: Some(error.to_string()),
        },
    }
    .tap_failure_report(label, mode, &test_name)
}

impl ChildOutcome {
    fn tap_failure_report(self, label: &str, mode: &str, test_name: &str) -> Self {
        if !self.success() {
            eprintln!(
                "[qualification-child-report] label={};mode={};test={};pid={};exit_code={};terminated_without_exit_code={};launch_error={};wait_error={};stdout={};stderr={}",
                bounded_log_text(label),
                bounded_log_text(mode),
                bounded_log_text(test_name),
                self.pid
                    .map_or_else(|| "none".to_owned(), |pid| pid.to_string()),
                self.status
                    .and_then(|status| status.code())
                    .map_or_else(|| "none".to_owned(), |code| code.to_string()),
                self.status.is_some_and(|status| status.code().is_none()),
                self.launch_error
                    .as_deref()
                    .map_or_else(|| "none".to_owned(), bounded_log_text),
                self.wait_error
                    .as_deref()
                    .map_or_else(|| "none".to_owned(), bounded_log_text),
                bounded_log_bytes(&self.stdout),
                bounded_log_bytes(&self.stderr),
            );
        }
        self
    }
}

fn exit_child_acquisition_failure(mode: &str, error: NativeError, exit_code: i32) -> ! {
    let test_name = env::var(TEST_NAME_ENV).unwrap_or_else(|_| DEFAULT_TEST_NAME.to_owned());
    let diagnostic = jarvis_windows_native::test_acquisition_diagnostic()
        .unwrap_or_else(|| "unavailable".to_owned());
    eprintln!(
        "[qualification-child-failure] mode={};test={};pid={};error_kind={:?};error={};diagnostic={}",
        bounded_log_text(mode),
        bounded_log_text(&test_name),
        process::id(),
        error.kind,
        bounded_log_text(&error.to_string()),
        bounded_log_text(&diagnostic),
    );
    process::exit(exit_code)
}

fn bounded_log_bytes(value: &[u8]) -> String {
    bounded_log_text(&String::from_utf8_lossy(value))
}

fn bounded_log_text(value: &str) -> String {
    let characters: Vec<char> = value.chars().collect();
    let mut rendered = String::new();
    let mut index = 0;
    while index < characters.len() && rendered.chars().count() < CHILD_REPORT_MAX_CHARS {
        if index + 2 < characters.len()
            && characters[index].is_ascii_alphabetic()
            && characters[index + 1] == ':'
            && matches!(characters[index + 2], '\\' | '/')
        {
            rendered.push_str("<path>");
            index += 3;
            while index < characters.len()
                && !characters[index].is_whitespace()
                && characters[index] != ';'
            {
                index += 1;
            }
            continue;
        }
        let character = characters[index];
        rendered.push(if character.is_ascii_graphic() || character == ' ' {
            if character == ';' { ',' } else { character }
        } else {
            '?'
        });
        index += 1;
    }
    if index < characters.len() {
        rendered.push_str("...[truncated]");
    }
    rendered
}

fn wait_all(children: Vec<Child>) -> Vec<ExitStatus> {
    children
        .into_iter()
        .map(|mut child| child.wait().expect("qualification child must exit"))
        .collect()
}

fn spawn_child_process(mode: &str) -> Child {
    let test_name = env::var(TEST_NAME_ENV).unwrap_or_else(|_| DEFAULT_TEST_NAME.to_owned());
    Command::new(env::current_exe().expect("qualification executable path"))
        .env(CHILD_ENV, mode)
        .arg("--exact")
        .arg(test_name)
        .arg("--nocapture")
        .spawn()
        .expect("spawn qualification child")
}
