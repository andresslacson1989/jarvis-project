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

use jarvis_windows_native::{Acquisition, NativeErrorKind, Role, acquire};

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
        .start_activation_worker(move |_request| {
            callback_count.fetch_add(1, Ordering::SeqCst);
            if callback_panic.swap(false, Ordering::SeqCst) {
                panic!("qualification callback panic");
            }
            !callback_failure.swap(false, Ordering::SeqCst)
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
        .start_activation_worker(|_request| true)
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
    if let Ok(path) = env::var(READY_FILE_ENV)
        && mode == "recovery-waiter"
    {
        fs::write(path, b"opened").expect("recovery waiter marker must be written");
    }

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
        "owner-crash" => match acquire(Role::Normal) {
            Ok(Acquisition::Owner(_owner)) => process::exit(0),
            Ok(Acquisition::SecondLaunch(_)) => process::exit(8),
            Err(_) => process::exit(9),
        },
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
