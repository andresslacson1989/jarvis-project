#![cfg(all(windows, feature = "test-support"))]

use std::{
    env, fs,
    process::{self, Child, Command, ExitStatus},
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    thread,
    time::Duration,
};

use jarvis_windows_native::{
    Acquisition, ActivationCallbackResult, ActivationCancellation, ActivationStart,
    NativeErrorKind, Role, acquire,
};

const CHILD_ENV: &str = "JARVIS_NATIVE_QUALIFICATION_CHILD";
const TEST_NAME_ENV: &str = "JARVIS_NATIVE_QUALIFICATION_TEST";
const READY_FILE_ENV: &str = "JARVIS_NATIVE_QUALIFICATION_READY_FILE";
const DEFAULT_TEST_NAME: &str = "windows_owner_second_launch_and_crash_recovery_qualification";

static QUALIFICATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

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
                    recovery_started.elapsed() < Duration::from_secs(2),
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

    assert!(spawn_child("second").success());
    assert!(spawn_child("second").success());
    assert_eq!(callback_count.load(Ordering::SeqCst), 2);

    drop(worker);
    drop(owner);
    clear_test_environment();
    fs::remove_dir_all(test_root).expect("stale-generation fixture must be removed");
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
    assert!(spawn_child("second").success());

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
    test_root
}

fn qualification_lock() -> &'static Mutex<()> {
    QUALIFICATION_LOCK.get_or_init(|| Mutex::new(()))
}

fn set_test_environment(
    test_root: &std::path::Path,
    test_name: &str,
    ready_file: &std::path::Path,
) {
    // SAFETY: this qualification process establishes isolated test-only
    // variables before any child process is spawned.
    unsafe {
        env::set_var("JARVIS_NATIVE_TEST_LOCALAPPDATA", test_root);
        env::set_var(TEST_NAME_ENV, test_name);
        env::set_var(READY_FILE_ENV, ready_file);
    }
}

fn clear_test_environment() {
    // SAFETY: all qualification child processes have exited; only the
    // process-local test variables are removed.
    unsafe {
        env::remove_var("JARVIS_NATIVE_TEST_LOCALAPPDATA");
        env::remove_var(TEST_NAME_ENV);
        env::remove_var(READY_FILE_ENV);
    }
}

fn acquire_owner(role: Role) -> jarvis_windows_native::OwnerLease {
    match acquire(role).expect("qualification owner must acquire") {
        Acquisition::Owner(owner) => owner,
        Acquisition::SecondLaunch(_) => {
            panic!("qualification unexpectedly found an existing owner")
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
            Err(_) => process::exit(5),
        },
        "recovery-waiter" => match acquire(Role::Normal) {
            Ok(Acquisition::Owner(_owner)) => process::exit(0),
            Ok(Acquisition::SecondLaunch(_)) => process::exit(6),
            Err(_) => process::exit(7),
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
                    Err(_) => process::exit(7),
                }
            }
        }
        "owner-crash" => match acquire(Role::Normal) {
            Ok(Acquisition::Owner(_owner)) => process::exit(0),
            Ok(Acquisition::SecondLaunch(_)) => process::exit(8),
            Err(_) => process::exit(9),
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
            if error.kind != NativeErrorKind::ArbitrationReleaseUncertain
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
            Err(_) => process::exit(11),
        },
        "maintenance-hold" => match acquire(Role::Maintenance) {
            Ok(Acquisition::Owner(_owner)) => {
                thread::sleep(Duration::from_millis(1_000));
                process::exit(0);
            }
            Ok(Acquisition::SecondLaunch(_)) => process::exit(12),
            Err(_) => process::exit(13),
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
