#![cfg(all(windows, feature = "test-support"))]

use std::{
    env, fs,
    process::{self, Command, ExitStatus},
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    thread,
    time::Duration,
};

use jarvis_windows_native::{Acquisition, NativeErrorKind, Role, acquire};

const CHILD_ENV: &str = "JARVIS_NATIVE_QUALIFICATION_CHILD";

#[test]
fn windows_owner_second_launch_and_crash_recovery_qualification() {
    if let Ok(mode) = env::var(CHILD_ENV) {
        run_child(&mode);
        return;
    }

    let test_root = env::temp_dir().join(format!(
        "JARVIS-NativeQualification-{}-{}",
        process::id(),
        unique_suffix()
    ));
    fs::create_dir_all(&test_root).expect("qualification LocalAppData fixture must be created");
    // SAFETY: this qualification process establishes the test-only fixture
    // variable before any child process is spawned.
    unsafe { env::set_var("JARVIS_NATIVE_TEST_LOCALAPPDATA", &test_root) };

    let owner = match acquire(Role::Normal).expect("the qualification owner must acquire") {
        Acquisition::Owner(owner) => owner,
        Acquisition::SecondLaunch(_) => panic!("qualification unexpectedly found an owner"),
    };
    let not_ready = spawn_child("second");
    assert_eq!(
        not_ready.code(),
        Some(4),
        "second launch must fail closed before readiness: {not_ready:?}"
    );
    let callbacks = Arc::new(AtomicUsize::new(0));
    let callback_count = Arc::clone(&callbacks);
    let worker = owner
        .start_activation_worker(move |_request| {
            callback_count.fetch_add(1, Ordering::SeqCst);
            true
        })
        .expect("same-session activation receiver must start");
    owner
        .mark_ready()
        .expect("readiness follows receiver startup");

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

    for _ in 0..3 {
        let status = spawn_child("second");
        assert!(
            status.success(),
            "second launch did not receive an acknowledgement: {status:?}"
        );
    }
    assert!(callbacks.load(Ordering::SeqCst) >= 3);

    drop(worker);
    drop(owner);

    let mut concurrent_owners = Vec::new();
    for _ in 0..4 {
        concurrent_owners.push(spawn_child_process("owner-hold"));
    }
    let concurrent_statuses = concurrent_owners
        .into_iter()
        .map(|mut child| child.wait().expect("concurrent owner child must exit"))
        .collect::<Vec<_>>();
    assert_eq!(
        concurrent_statuses
            .iter()
            .filter(|status| status.success())
            .count(),
        1,
        "exactly one concurrent owner must acquire: {concurrent_statuses:?}"
    );

    let crash_owner = spawn_child("owner-crash");
    assert!(
        crash_owner.success(),
        "crash owner did not acquire: {crash_owner:?}"
    );
    thread::sleep(Duration::from_millis(100));

    let recovered = match acquire(Role::Normal).expect("owner must recover after process exit") {
        Acquisition::Owner(owner) => owner,
        Acquisition::SecondLaunch(_) => panic!("stale owner state survived process exit"),
    };
    drop(recovered);
    // SAFETY: the qualification process has completed all child processes and
    // removes only its own test-only environment variable.
    unsafe { env::remove_var("JARVIS_NATIVE_TEST_LOCALAPPDATA") };
    fs::remove_dir_all(test_root).expect("qualification LocalAppData fixture must be removed");
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
        "owner-crash" => match acquire(Role::Normal) {
            Ok(Acquisition::Owner(_owner)) => process::exit(0),
            Ok(Acquisition::SecondLaunch(_)) => process::exit(6),
            Err(_) => process::exit(7),
        },
        "owner-hold" => match acquire(Role::Normal) {
            Ok(Acquisition::Owner(_owner)) => {
                thread::sleep(Duration::from_millis(2_000));
                process::exit(0);
            }
            Ok(Acquisition::SecondLaunch(_)) => process::exit(2),
            Err(_) => process::exit(3),
        },
        _ => process::exit(8),
    }
}

fn spawn_child(mode: &str) -> ExitStatus {
    spawn_child_process(mode)
        .wait()
        .expect("spawn qualification child")
}

fn spawn_child_process(mode: &str) -> process::Child {
    Command::new(env::current_exe().expect("qualification executable path"))
        .env(CHILD_ENV, mode)
        .arg("--exact")
        .arg("windows_owner_second_launch_and_crash_recovery_qualification")
        .arg("--nocapture")
        .spawn()
        .expect("spawn qualification child")
}
