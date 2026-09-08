#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(all(windows, feature = "test-support"))]
mod qualification {
    use std::{
        env,
        fmt::Write as _,
        fs, io,
        path::{Path, PathBuf},
        process::{Child, Command, ExitStatus, Output, Stdio},
        thread,
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    use sha2::{Digest, Sha256};
    use windows_sys::{
        Win32::{
            Foundation::{HWND, LPARAM, WPARAM},
            UI::WindowsAndMessaging::{
                EnumWindows, GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
                GetWindowThreadProcessId, IsWindowVisible, PostMessageW, SW_HIDE, ShowWindow,
                WM_CLOSE,
            },
        },
        core::BOOL,
    };

    #[derive(Clone, Debug)]
    struct WindowSnapshot {
        pid: u32,
        handle: HWND,
        title: String,
        visible: bool,
        foreground_pid: u32,
        foreground_owner: bool,
        running: bool,
    }

    struct WindowSearch {
        pid: u32,
        snapshot: Option<WindowSnapshot>,
    }

    struct RunContext {
        profile_path: PathBuf,
        owner: Option<Child>,
        second: Option<Child>,
        owner_window: Option<HWND>,
        owner_initial: Option<WindowSnapshot>,
        owner_hidden: Option<WindowSnapshot>,
        owner_final: Option<WindowSnapshot>,
        second_pid: Option<u32>,
        second_exit_code: Option<i32>,
        owner_stderr: Option<String>,
        second_stderr: Option<String>,
        forced_cleanup: bool,
    }

    impl RunContext {
        fn new() -> io::Result<Self> {
            let profile_path = env::temp_dir().join(format!(
                "jarvis-tauri-single-instance-{}-{}",
                std::process::id(),
                unique_suffix()
            ));
            fs::create_dir_all(&profile_path)?;
            Ok(Self {
                profile_path,
                owner: None,
                second: None,
                owner_window: None,
                owner_initial: None,
                owner_hidden: None,
                owner_final: None,
                second_pid: None,
                second_exit_code: None,
                owner_stderr: None,
                second_stderr: None,
                forced_cleanup: false,
            })
        }

        fn spawn(&self, executable: &Path) -> io::Result<Child> {
            let working_directory = executable.parent().ok_or_else(|| {
                io::Error::new(io::ErrorKind::InvalidInput, "executable has no parent")
            })?;
            Command::new(executable)
                .current_dir(working_directory)
                .env("JARVIS_NATIVE_TEST_LOCALAPPDATA", &self.profile_path)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
        }

        fn cleanup(&mut self) {
            if let Some(owner) = self.owner.take() {
                self.owner_stderr = Some(cleanup_child(
                    owner,
                    self.owner_window,
                    &mut self.forced_cleanup,
                ));
            }
            if let Some(second) = self.second.take() {
                self.second_stderr = Some(cleanup_child(second, None, &mut self.forced_cleanup));
            }
            let _ = fs::remove_dir_all(&self.profile_path);
        }
    }

    pub fn run() -> i32 {
        let arguments: Vec<_> = env::args_os().collect();
        if arguments.len() != 3 {
            eprintln!(
                "usage: windows-tauri-single-instance-qualification <executable> <evidence-path>"
            );
            return 2;
        }
        let executable = PathBuf::from(&arguments[1]);
        let evidence_path = PathBuf::from(&arguments[2]);
        let candidate_sha = env::var("JARVIS_CANDIDATE_SHA")
            .unwrap_or_else(|_| "unknown".to_owned())
            .trim()
            .to_owned();
        let started_at = utc_timestamp();

        let mut context = match RunContext::new() {
            Ok(context) => context,
            Err(error) => {
                let evidence = failure_evidence(
                    &candidate_sha,
                    &started_at,
                    &format!("could not create isolated profile: {error}"),
                    false,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                );
                write_evidence(&evidence_path, &evidence);
                eprintln!("{evidence}");
                return 1;
            }
        };

        let failure = execute(&mut context, &executable).err();
        context.cleanup();
        let failure = if context.forced_cleanup && failure.is_none() {
            Some("qualification process required forced cleanup".to_owned())
        } else {
            failure
        };
        let status = if failure.is_none() { "PASS" } else { "FAIL" };
        let evidence = build_evidence(
            status,
            &candidate_sha,
            &started_at,
            &failure,
            context.forced_cleanup,
            &context,
            &executable,
        );
        write_evidence(&evidence_path, &evidence);
        println!("[tauri-single-instance-evidence] {evidence}");
        println!(
            "[tauri-single-instance-evidence-path] {}",
            evidence_path.display()
        );
        if let Some(failure) = failure {
            eprintln!("Windows Tauri single-instance qualification failed: {failure}");
            1
        } else {
            0
        }
    }

    fn execute(context: &mut RunContext, executable: &Path) -> Result<(), String> {
        if !executable.is_file() {
            return Err(format!(
                "test-support Tauri executable is missing: {}",
                executable.display()
            ));
        }

        let owner = context
            .spawn(executable)
            .map_err(|error| format!("owner spawn failed: {error}"))?;
        let owner_pid = owner.id();
        context.owner = Some(owner);
        let owner_initial = wait_for_window(
            context.owner.as_mut().expect("owner was stored"),
            Duration::from_secs(15),
        )?;
        if owner_initial.title != "JARVIS" {
            return Err(format!(
                "owner window title was not JARVIS: {}",
                owner_initial.title
            ));
        }
        if !owner_initial.visible {
            return Err("owner window was not visible before hide".to_owned());
        }
        context.owner_window = Some(owner_initial.handle);
        context.owner_initial = Some(owner_initial.clone());

        // SAFETY: the handle came from EnumWindows for the owner PID and is
        // valid for this synchronous visibility transition.
        unsafe {
            ShowWindow(owner_initial.handle, SW_HIDE);
        }
        let hidden_deadline = Instant::now() + Duration::from_secs(5);
        let owner_hidden = loop {
            let owner = context.owner.as_mut().expect("owner was stored");
            if let Some(status) = owner.try_wait().map_err(|error| error.to_string())? {
                return Err(format!("owner exited while hiding: {status}"));
            }
            if let Some(snapshot) = snapshot_for_pid(owner_pid, true)
                && !snapshot.visible
            {
                break snapshot;
            }
            if Instant::now() >= hidden_deadline {
                return Err("owner window did not become hidden within 5 seconds".to_owned());
            }
            thread::sleep(Duration::from_millis(100));
        };
        if !owner_hidden.running {
            return Err("hiding the owner window terminated the owner".to_owned());
        }
        context.owner_hidden = Some(owner_hidden);

        // Tauri marks the native activation controller ready after the window
        // and worker are created. This bounded grace period avoids treating
        // that normal startup race as a second-launch failure.
        thread::sleep(Duration::from_secs(5));
        let second = context
            .spawn(executable)
            .map_err(|error| format!("second spawn failed: {error}"))?;
        let second_pid = second.id();
        context.second_pid = Some(second_pid);
        context.second = Some(second);
        let second_status = wait_for_exit(
            context.second.as_mut().expect("second was stored"),
            Duration::from_secs(10),
        )
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "second launch did not exit within 10 seconds".to_owned())?;
        context.second_exit_code = second_status.code();

        let final_deadline = Instant::now() + Duration::from_secs(3);
        let owner_final = loop {
            let snapshot = snapshot_for_pid(owner_pid, true)
                .ok_or_else(|| "owner window disappeared after second launch".to_owned())?;
            if snapshot.visible && snapshot.foreground_owner {
                break snapshot;
            }
            if Instant::now() >= final_deadline {
                break snapshot;
            }
            thread::sleep(Duration::from_millis(100));
        };
        if second_status.code() != Some(0) {
            return Err(format!(
                "second launch returned exit code {:?}",
                second_status.code()
            ));
        }
        if !owner_final.running {
            return Err("owner exited after second launch".to_owned());
        }
        if !owner_final.visible {
            return Err("second launch did not restore owner visibility".to_owned());
        }
        if owner_final.handle != owner_initial.handle {
            return Err("second launch changed the owner window handle".to_owned());
        }
        if !owner_final.foreground_owner {
            return Err("second launch did not focus the owner window".to_owned());
        }
        context.owner_final = Some(owner_final);
        Ok(())
    }

    fn wait_for_window(child: &mut Child, timeout: Duration) -> Result<WindowSnapshot, String> {
        let pid = child.id();
        let deadline = Instant::now() + timeout;
        loop {
            if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
                return Err(format!(
                    "owner exited before its JARVIS window was ready: {status}"
                ));
            }
            if let Some(snapshot) = snapshot_for_pid(pid, true) {
                return Ok(snapshot);
            }
            if Instant::now() >= deadline {
                return Err("owner did not reach a JARVIS window within 15 seconds".to_owned());
            }
            thread::sleep(Duration::from_millis(250));
        }
    }

    fn wait_for_exit(child: &mut Child, timeout: Duration) -> io::Result<Option<ExitStatus>> {
        let deadline = Instant::now() + timeout;
        loop {
            if let Some(status) = child.try_wait()? {
                return Ok(Some(status));
            }
            if Instant::now() >= deadline {
                return Ok(None);
            }
            thread::sleep(Duration::from_millis(100));
        }
    }

    fn cleanup_child(mut child: Child, window: Option<HWND>, forced: &mut bool) -> String {
        if child.try_wait().ok().flatten().is_none() {
            if let Some(window) = window {
                // SAFETY: this is the test-owned window handle, and WM_CLOSE
                // requests normal Tauri shutdown before any forced cleanup.
                unsafe {
                    PostMessageW(window, WM_CLOSE, WPARAM::default(), LPARAM::default());
                }
            }
            if wait_for_exit(&mut child, Duration::from_secs(5))
                .ok()
                .flatten()
                .is_none()
            {
                let _ = child.kill();
                *forced = true;
            }
        }
        match child.wait_with_output() {
            Ok(output) => sanitized_output(&output),
            Err(error) => format!("child-output-read-failed: {error}"),
        }
    }

    fn sanitized_output(output: &Output) -> String {
        let mut bytes = if output.stderr.is_empty() {
            output.stdout.clone()
        } else {
            output.stderr.clone()
        };
        if bytes.len() > 2048 {
            bytes.truncate(2048);
        }
        String::from_utf8_lossy(&bytes)
            .chars()
            .map(|character| {
                if character.is_control() && character != '\n' && character != '\t' {
                    ' '
                } else {
                    character
                }
            })
            .collect::<String>()
            .trim()
            .to_owned()
    }

    fn snapshot_for_pid(pid: u32, running: bool) -> Option<WindowSnapshot> {
        let mut search = WindowSearch {
            pid,
            snapshot: None,
        };
        // SAFETY: the callback receives the valid pointer to the stack-owned
        // search structure and does not outlive this synchronous enumeration.
        unsafe {
            EnumWindows(
                Some(enum_window_proc),
                (&mut search as *mut WindowSearch).cast::<()>() as LPARAM,
            )
        };
        let mut snapshot = search.snapshot?;
        // SAFETY: Windows returns the process-global foreground window handle.
        let foreground = unsafe { GetForegroundWindow() };
        let mut foreground_pid = 0u32;
        if !foreground.is_null() {
            // SAFETY: the foreground handle is returned by Windows and the
            // output PID pointer is valid.
            unsafe { GetWindowThreadProcessId(foreground, &mut foreground_pid) };
        }
        snapshot.foreground_pid = foreground_pid;
        snapshot.foreground_owner = foreground_pid == pid;
        snapshot.running = running;
        Some(snapshot)
    }

    // SAFETY: EnumWindows invokes this callback synchronously on the caller's
    // thread with the supplied stack-owned search pointer.
    unsafe extern "system" fn enum_window_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        // SAFETY: EnumWindows passes back the exact pointer supplied by
        // snapshot_for_pid and invokes this callback synchronously.
        let search = unsafe { &mut *(lparam as *mut WindowSearch) };
        let mut window_pid = 0u32;
        // SAFETY: hwnd is the currently enumerated top-level window and the
        // output pointer is valid.
        unsafe { GetWindowThreadProcessId(hwnd, &mut window_pid) };
        if window_pid != search.pid {
            return 1;
        }
        // SAFETY: hwnd is the currently enumerated top-level window.
        let length = unsafe { GetWindowTextLengthW(hwnd) };
        let capacity = usize::try_from(length.max(1)).unwrap_or(256).min(256);
        let mut title = vec![0u16; capacity + 1];
        // SAFETY: hwnd is enumerated by Windows and the title buffer is valid.
        let written = unsafe {
            GetWindowTextW(
                hwnd,
                title.as_mut_ptr(),
                i32::try_from(title.len()).unwrap_or(256),
            )
        };
        let title = String::from_utf16_lossy(&title[..usize::try_from(written).unwrap_or(0)]);
        if title == "JARVIS" {
            search.snapshot = Some(WindowSnapshot {
                pid: search.pid,
                handle: hwnd,
                title,
                // SAFETY: hwnd is the enumerated top-level window.
                visible: unsafe { IsWindowVisible(hwnd) != 0 },
                foreground_pid: 0,
                foreground_owner: false,
                running: true,
            });
            return 0;
        }
        1
    }

    fn build_evidence(
        status: &str,
        candidate_sha: &str,
        started_at: &str,
        failure: &Option<String>,
        forced_cleanup: bool,
        context: &RunContext,
        executable: &Path,
    ) -> String {
        let finished_at = utc_timestamp();
        let binary_sha = sha256_file(executable);
        let toolchain = |command: &str| command_version(command);
        format!(
            concat!(
                "{{\"schemaVersion\":1,\"scope\":\"SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION\",",
                "\"status\":{},\"candidateSha\":{},\"repository\":{},\"ref\":{},\"headRef\":{},",
                "\"workflow\":{},\"runId\":{},\"runAttempt\":{},\"job\":{},",
                "\"runner\":{{\"os\":{},\"arch\":{},\"image\":{}}},",
                "\"toolchain\":{{\"rust\":{},\"cargo\":{},\"node\":{},\"pnpm\":{}}},",
                "\"profile\":{{\"executable\":\"target/x86_64-pc-windows-msvc/release/jarvis-desktop.exe\",",
                "\"feature\":\"test-support\",\"dataRoot\":\"fresh temporary test-support LocalAppData override\",",
                "\"startupBoundSeconds\":15,\"activationBoundSeconds\":10,\"readinessGraceSeconds\":5,\"hideBoundSeconds\":5}},",
                "\"executableSha256\":{},\"startedAt\":{},\"finishedAt\":{},\"failure\":{},",
                "\"forcedCleanup\":{},\"ownerInitial\":{},\"ownerHidden\":{},",
                "\"second\":{{\"pid\":{},\"exitCode\":{}}},\"ownerFinal\":{},",
                "\"diagnostics\":{{\"ownerStderr\":{},\"secondStderr\":{}}}}}"
            ),
            json_string(status),
            json_string(candidate_sha),
            json_env("GITHUB_REPOSITORY"),
            json_env("GITHUB_REF"),
            json_env("GITHUB_HEAD_REF"),
            json_env("GITHUB_WORKFLOW"),
            json_env("GITHUB_RUN_ID"),
            json_env("GITHUB_RUN_ATTEMPT"),
            json_env("GITHUB_JOB"),
            json_env("RUNNER_OS"),
            json_env("RUNNER_ARCH"),
            json_env("ImageOS"),
            json_string(&toolchain("rustc")),
            json_string(&toolchain("cargo")),
            json_string(&toolchain("node")),
            json_string(&toolchain("pnpm")),
            binary_sha
                .as_deref()
                .map(json_string)
                .unwrap_or_else(|| "null".to_owned()),
            json_string(started_at),
            json_string(&finished_at),
            failure
                .as_deref()
                .map(json_string)
                .unwrap_or_else(|| "null".to_owned()),
            if forced_cleanup { "true" } else { "false" },
            snapshot_json(context.owner_initial.as_ref()),
            snapshot_json(context.owner_hidden.as_ref()),
            context.second_pid.unwrap_or_default(),
            context
                .second_exit_code
                .map(|code| code.to_string())
                .unwrap_or_else(|| "null".to_owned()),
            snapshot_json(context.owner_final.as_ref()),
            context
                .owner_stderr
                .as_deref()
                .map(json_string)
                .unwrap_or_else(|| "null".to_owned()),
            context
                .second_stderr
                .as_deref()
                .map(json_string)
                .unwrap_or_else(|| "null".to_owned()),
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn failure_evidence(
        candidate_sha: &str,
        started_at: &str,
        failure: &str,
        forced_cleanup: bool,
        owner_initial: Option<&WindowSnapshot>,
        owner_hidden: Option<&WindowSnapshot>,
        owner_final: Option<&WindowSnapshot>,
        second_pid: Option<u32>,
        second_exit_code: Option<i32>,
        owner_stderr: Option<&str>,
        second_stderr: Option<&str>,
    ) -> String {
        let finished_at = utc_timestamp();
        format!(
            concat!(
                "{{\"schemaVersion\":1,\"scope\":\"SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION\",",
                "\"status\":\"FAIL\",\"candidateSha\":{},\"startedAt\":{},\"finishedAt\":{},",
                "\"failure\":{},\"forcedCleanup\":{},\"ownerInitial\":{},\"ownerHidden\":{},",
                "\"second\":{{\"pid\":{},\"exitCode\":{}}},\"ownerFinal\":{},",
                "\"diagnostics\":{{\"ownerStderr\":{},\"secondStderr\":{}}}}}"
            ),
            json_string(candidate_sha),
            json_string(started_at),
            json_string(&finished_at),
            json_string(failure),
            if forced_cleanup { "true" } else { "false" },
            snapshot_json(owner_initial),
            snapshot_json(owner_hidden),
            second_pid.unwrap_or_default(),
            second_exit_code
                .map(|code| code.to_string())
                .unwrap_or_else(|| "null".to_owned()),
            snapshot_json(owner_final),
            owner_stderr
                .map(json_string)
                .unwrap_or_else(|| "null".to_owned()),
            second_stderr
                .map(json_string)
                .unwrap_or_else(|| "null".to_owned()),
        )
    }

    fn snapshot_json(snapshot: Option<&WindowSnapshot>) -> String {
        let Some(snapshot) = snapshot else {
            return "null".to_owned();
        };
        format!(
            "{{\"pid\":{},\"handle\":{},\"title\":{},\"visible\":{},\"foregroundPid\":{},\"foregroundOwner\":{},\"running\":{}}}",
            snapshot.pid,
            json_string(&format!("0x{:X}", snapshot.handle as usize)),
            json_string(&snapshot.title),
            if snapshot.visible { "true" } else { "false" },
            snapshot.foreground_pid,
            if snapshot.foreground_owner {
                "true"
            } else {
                "false"
            },
            if snapshot.running { "true" } else { "false" },
        )
    }

    fn write_evidence(path: &Path, evidence: &str) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(path, evidence.as_bytes());
        let mut log_path = path.to_path_buf();
        log_path.set_extension("log");
        let _ = fs::write(log_path, format!("{evidence}\n").as_bytes());
    }

    fn command_version(command: &str) -> String {
        Command::new(command)
            .arg("--version")
            .output()
            .map(|output| sanitized_output(&output))
            .unwrap_or_else(|error| format!("unavailable: {error}"))
    }

    fn sha256_file(path: &Path) -> Option<String> {
        let bytes = fs::read(path).ok()?;
        let digest = Sha256::digest(bytes);
        Some(format!("{digest:x}"))
    }

    fn json_env(name: &str) -> String {
        env::var(name)
            .ok()
            .map(|value| json_string(&value))
            .unwrap_or_else(|| "null".to_owned())
    }

    fn json_string(value: &str) -> String {
        let mut result = String::with_capacity(value.len() + 2);
        result.push('"');
        for character in value.chars() {
            match character {
                '"' => result.push_str("\\\""),
                '\\' => result.push_str("\\\\"),
                '\n' => result.push_str("\\n"),
                '\r' => result.push_str("\\r"),
                '\t' => result.push_str("\\t"),
                character if character.is_control() => {
                    let _ = write!(result, "\\u{:04x}", character as u32);
                }
                character => result.push(character),
            }
        }
        result.push('"');
        result
    }

    fn utc_timestamp() -> String {
        let seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let days = seconds / 86_400;
        let seconds_in_day = seconds % 86_400;
        let (year, month, day) = civil_from_days(days as i64);
        format!(
            "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
            seconds_in_day / 3_600,
            (seconds_in_day % 3_600) / 60,
            seconds_in_day % 60
        )
    }

    fn civil_from_days(days: i64) -> (i64, i64, i64) {
        let z = days + 719_468;
        let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
        let day_of_era = z - era * 146_097;
        let year_of_era =
            (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
        let year = year_of_era + era * 400;
        let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
        let month_part = (5 * day_of_year + 2) / 153;
        let day = day_of_year - (153 * month_part + 2) / 5 + 1;
        let month = month_part + if month_part < 10 { 3 } else { -9 };
        (year + i64::from(month <= 2), month, day)
    }

    fn unique_suffix() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    }
}

#[cfg(all(windows, feature = "test-support"))]
fn main() -> std::process::ExitCode {
    std::process::ExitCode::from(qualification::run() as u8)
}

#[cfg(not(all(windows, feature = "test-support")))]
fn main() -> std::process::ExitCode {
    eprintln!("Windows Tauri qualification requires Windows and test-support");
    std::process::ExitCode::from(1)
}
