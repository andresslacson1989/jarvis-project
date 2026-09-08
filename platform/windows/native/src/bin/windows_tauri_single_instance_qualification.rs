#![deny(unsafe_op_in_unsafe_fn)]

#[cfg(all(windows, feature = "test-support"))]
mod qualification {
    use std::{
        env,
        fmt::Write as _,
        fs, io,
        path::{Path, PathBuf},
        process::{Child, Command, ExitStatus, Output, Stdio},
        ptr, thread,
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };

    use sha2::{Digest, Sha256};
    use windows_sys::{
        Win32::{
            Foundation::{HWND, LPARAM, WPARAM},
            System::{
                LibraryLoader::GetModuleHandleW,
                Threading::{AttachThreadInput, GetCurrentThreadId},
            },
            UI::WindowsAndMessaging::{
                BringWindowToTop, CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW,
                EnumWindows, GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
                GetWindowThreadProcessId, IsWindow, IsWindowVisible, MSG, PM_REMOVE, PeekMessageW,
                PostMessageW, RegisterClassW, SW_HIDE, SW_SHOW, SetForegroundWindow, ShowWindow,
                TranslateMessage, UnregisterClassW, WM_CLOSE, WNDCLASSW, WS_CAPTION,
                WS_EX_TOOLWINDOW, WS_POPUP, WS_SYSMENU,
            },
        },
        core::BOOL,
    };

    const AUTHORITY_POLICY_JSON: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../../tools/ci/section-1-4-authority-policy.json"
    ));
    const AUTHORITY_POLICY_SHA256: &str =
        "0f9f6b228c3e8ac231644b1c07a4090c0aff398de6db94482008bb461386b0fe";

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
        cleanup: CleanupOutcome,
    }

    #[derive(Clone, Debug)]
    struct CleanupOutcome {
        attempted: bool,
        succeeded: bool,
        error: Option<String>,
    }

    struct ForegroundSentinel {
        handle: HWND,
        class_name: Vec<u16>,
        instance: *mut core::ffi::c_void,
    }

    struct ThreadInputAttachment {
        current_thread: u32,
        foreground_thread: u32,
        detached: bool,
    }

    impl ForegroundSentinel {
        fn create() -> Result<Self, String> {
            let class_name: Vec<u16> = format!(
                "JARVISQualificationSentinelClass_{}_{}",
                std::process::id(),
                unique_suffix()
            )
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
            let title = format!(
                "JARVIS qualification foreground sentinel {} {}",
                std::process::id(),
                unique_suffix()
            );
            let title: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
            // SAFETY: the null module name obtains this qualification binary's
            // module handle, and the class name is unique to this process/run.
            let instance = unsafe { GetModuleHandleW(ptr::null()) };
            if instance.is_null() {
                return Err("foreground sentinel module handle lookup failed".to_owned());
            }
            let window_class = WNDCLASSW {
                lpfnWndProc: Some(DefWindowProcW),
                hInstance: instance,
                lpszClassName: class_name.as_ptr(),
                ..Default::default()
            };
            // SAFETY: window_class and its UTF-16 class name remain valid for
            // the synchronous registration call.
            if unsafe { RegisterClassW(&window_class) } == 0 {
                return Err("foreground sentinel window class registration failed".to_owned());
            }
            // SAFETY: the registered class, title, and instance are owned by
            // this qualification process; null parent/menu/creation parameter
            // create an independent top-level test-owned window.
            let handle = unsafe {
                CreateWindowExW(
                    WS_EX_TOOLWINDOW,
                    class_name.as_ptr(),
                    title.as_ptr(),
                    WS_POPUP | WS_CAPTION | WS_SYSMENU,
                    0,
                    0,
                    640,
                    480,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    instance,
                    ptr::null(),
                )
            };
            if handle.is_null() {
                // SAFETY: registration succeeded for this unique class and no
                // window was created, so unregistering it is safe cleanup.
                unsafe {
                    UnregisterClassW(class_name.as_ptr(), instance);
                }
                return Err("foreground sentinel window creation failed".to_owned());
            }
            Ok(Self {
                handle,
                class_name,
                instance,
            })
        }

        fn activate(&self, owner_pid: u32) -> Result<(), String> {
            let attachment = ThreadInputAttachment::attach()?;
            // SAFETY: the handle was returned by CreateWindowExW and remains
            // owned by this sentinel for the bounded activation attempt.
            let activation = unsafe {
                ShowWindow(self.handle, SW_SHOW);
                if BringWindowToTop(self.handle) == 0 {
                    Err("foreground sentinel could not be raised".to_owned())
                } else if SetForegroundWindow(self.handle) == 0 {
                    Err(
                        "foreground sentinel activation failed: SetForegroundWindow returned false"
                            .to_owned(),
                    )
                } else {
                    Ok(())
                }
            };
            let detach = attachment
                .map(|attachment| attachment.detach())
                .transpose()
                .map(|_| ());
            activation?;
            detach?;

            let sentinel_pid = std::process::id();
            let deadline = Instant::now() + Duration::from_secs(10);
            let mut observed_pid = 0u32;
            loop {
                pump_messages();
                // SAFETY: Windows returns the process-global foreground
                // window handle without borrowing or retaining caller memory.
                let foreground = unsafe { GetForegroundWindow() };
                if foreground == self.handle && !foreground.is_null() {
                    observed_pid = 0;
                    // SAFETY: foreground is the current process-global
                    // foreground window and the output pointer is valid.
                    unsafe { GetWindowThreadProcessId(foreground, &mut observed_pid) };
                    if observed_pid == sentinel_pid && observed_pid != owner_pid {
                        return Ok(());
                    }
                }
                if Instant::now() >= deadline {
                    return Err(format!(
                        "foreground sentinel activation was not proven (observedPid={observed_pid}, ownerPid={owner_pid})"
                    ));
                }
                thread::sleep(Duration::from_millis(50));
            }
        }

        fn destroy(&mut self) -> Result<(), String> {
            if self.handle.is_null() {
                return Ok(());
            }
            let handle = self.handle;
            // SAFETY: this is the live test-owned sentinel handle and no other
            // thread owns or destroys it.
            let destroyed = unsafe { DestroyWindow(handle) != 0 };
            // SAFETY: the same handle is used only to verify destruction.
            let still_window = unsafe { IsWindow(handle) != 0 };
            // SAFETY: the class was registered by this process and is no
            // longer needed once its only test window is destroyed.
            let unregistered =
                unsafe { UnregisterClassW(self.class_name.as_ptr(), self.instance) != 0 };
            if !destroyed || still_window || !unregistered {
                return Err("foreground sentinel cleanup failed".to_owned());
            }
            self.handle = ptr::null_mut();
            Ok(())
        }
    }

    impl Drop for ForegroundSentinel {
        fn drop(&mut self) {
            if !self.handle.is_null() {
                // SAFETY: Drop is the final owner of this test-created window.
                unsafe {
                    DestroyWindow(self.handle);
                    UnregisterClassW(self.class_name.as_ptr(), self.instance);
                }
                self.handle = ptr::null_mut();
            }
        }
    }

    impl ThreadInputAttachment {
        fn attach() -> Result<Option<Self>, String> {
            // SAFETY: GetCurrentThreadId reads only the calling qualification
            // thread identity and has no pointer arguments.
            let current_thread = unsafe { GetCurrentThreadId() };
            // SAFETY: Windows returns the process-global foreground window
            // handle without borrowing or retaining caller memory.
            let foreground = unsafe { GetForegroundWindow() };
            if foreground.is_null() {
                return Ok(None);
            }
            let mut foreground_pid = 0u32;
            // SAFETY: foreground is returned by Windows and the output pointer
            // is valid for this synchronous query.
            let foreground_thread =
                unsafe { GetWindowThreadProcessId(foreground, &mut foreground_pid) };
            if foreground_thread == 0 || foreground_thread == current_thread {
                return Ok(None);
            }
            // SAFETY: this narrowly joins the qualification thread to the
            // current foreground thread for one bounded test-support focus
            // transition. It is detached before the activation result is used.
            if unsafe { AttachThreadInput(current_thread, foreground_thread, 1) } == 0 {
                return Err("foreground sentinel input-thread handoff failed".to_owned());
            }
            Ok(Some(Self {
                current_thread,
                foreground_thread,
                detached: false,
            }))
        }

        fn detach(mut self) -> Result<(), String> {
            if !self.detached {
                // SAFETY: this reverses the exact attachment created by
                // attach() and runs before the guard is dropped.
                let detached = unsafe {
                    AttachThreadInput(self.current_thread, self.foreground_thread, 0) != 0
                };
                self.detached = true;
                if !detached {
                    return Err(
                        "foreground sentinel input-thread handoff cleanup failed".to_owned()
                    );
                }
            }
            Ok(())
        }
    }

    impl Drop for ThreadInputAttachment {
        fn drop(&mut self) {
            if !self.detached {
                // SAFETY: best-effort fallback for an exceptional path; the
                // normal path uses detach() and reports failure explicitly.
                unsafe {
                    AttachThreadInput(self.current_thread, self.foreground_thread, 0);
                }
                self.detached = true;
            }
        }
    }

    impl CleanupOutcome {
        fn not_attempted() -> Self {
            Self {
                attempted: false,
                succeeded: false,
                error: None,
            }
        }
    }

    #[derive(Clone, Debug)]
    struct EvidenceIdentity {
        mode: String,
        candidate_sha: String,
        repository: Option<String>,
        reference: Option<String>,
        head_ref: Option<String>,
        workflow: Option<String>,
        run_id: Option<String>,
        run_attempt: Option<String>,
        job: Option<String>,
        runner_os: Option<String>,
        runner_arch: Option<String>,
        runner_image: Option<String>,
        checkout_sha: Option<String>,
        tree_sha: Option<String>,
        remote: Option<String>,
        checkout_relationship: String,
        worktree_clean: Option<bool>,
        identity_error: Option<String>,
    }

    impl EvidenceIdentity {
        fn collect() -> Self {
            let mode = env::var("JARVIS_EVIDENCE_MODE")
                .unwrap_or_else(|_| "SUPPORTING_LOCAL".to_owned())
                .trim()
                .to_owned();
            let checkout_sha = git_output(&["rev-parse", "HEAD"]).ok();
            let candidate_sha = env::var("JARVIS_CANDIDATE_SHA")
                .map(|value| value.trim().to_owned())
                .unwrap_or_else(|_| {
                    if mode == "AUTHORITATIVE_GITHUB_ACTIONS" {
                        String::new()
                    } else {
                        checkout_sha.clone().unwrap_or_default()
                    }
                });
            let tree_sha = git_output(&["rev-parse", "HEAD^{tree}"]).ok();
            let remote = git_output(&["config", "--get", "remote.origin.url"])
                .ok()
                .map(|value| sanitize_remote(&value));
            let worktree_clean =
                git_output_allow_empty(&["status", "--porcelain=v1", "--untracked-files=all"])
                    .ok()
                    .map(|value| value.trim().is_empty());

            let (repository, reference, head_ref, workflow, run_id, run_attempt, job) =
                if mode == "AUTHORITATIVE_GITHUB_ACTIONS" {
                    (
                        env_option("GITHUB_REPOSITORY"),
                        env_option("GITHUB_REF"),
                        env_option("GITHUB_HEAD_REF"),
                        env_option("GITHUB_WORKFLOW"),
                        env_option("GITHUB_RUN_ID"),
                        env_option("GITHUB_RUN_ATTEMPT"),
                        env_option("GITHUB_JOB"),
                    )
                } else {
                    (None, None, None, None, None, None, None)
                };
            let (runner_os, runner_arch, runner_image) = if mode == "AUTHORITATIVE_GITHUB_ACTIONS" {
                (
                    env_option("RUNNER_OS"),
                    env_option("RUNNER_ARCH"),
                    env_option("ImageOS"),
                )
            } else {
                (None, None, None)
            };

            let checkout_relationship = if mode == "SUPPORTING_LOCAL" {
                "SUPPORTING_LOCAL".to_owned()
            } else if checkout_sha.as_deref() == Some(candidate_sha.as_str()) {
                "EXACT_CHECKOUT".to_owned()
            } else {
                "UNKNOWN".to_owned()
            };

            let identity_error =
                if mode != "AUTHORITATIVE_GITHUB_ACTIONS" && mode != "SUPPORTING_LOCAL" {
                    Some("unsupported evidence mode".to_owned())
                } else {
                    None
                };

            Self {
                mode,
                candidate_sha,
                repository,
                reference,
                head_ref,
                workflow,
                run_id,
                run_attempt,
                job,
                runner_os,
                runner_arch,
                runner_image,
                checkout_sha,
                tree_sha,
                remote,
                checkout_relationship,
                worktree_clean,
                identity_error,
            }
        }

        fn authoritative_failure(&self) -> Option<String> {
            if self.mode != "AUTHORITATIVE_GITHUB_ACTIONS" {
                return self.identity_error.clone().or_else(|| {
                    (self.mode != "SUPPORTING_LOCAL")
                        .then_some("unsupported evidence mode".to_owned())
                });
            }
            if !is_sha(&self.candidate_sha)
                || self.repository.as_deref().is_none_or(str::is_empty)
                || self.reference.as_deref().is_none_or(str::is_empty)
                || self.workflow.as_deref().is_none_or(str::is_empty)
                || self.run_id.as_deref().is_none_or(str::is_empty)
                || self.run_attempt.as_deref().is_none_or(str::is_empty)
                || self.job.as_deref().is_none_or(str::is_empty)
                || self.runner_os.as_deref().is_none_or(str::is_empty)
                || self.runner_arch.as_deref().is_none_or(str::is_empty)
                || self.runner_image.as_deref().is_none_or(str::is_empty)
            {
                return Some(
                    "authoritative GitHub identity metadata is missing or malformed".to_owned(),
                );
            }
            if self
                .checkout_sha
                .as_deref()
                .is_none_or(|value| !is_sha(value))
                || self.tree_sha.as_deref().is_none_or(|value| !is_sha(value))
                || self.remote.as_deref().is_none_or(str::is_empty)
                || self.worktree_clean != Some(true)
                || self.checkout_relationship != "EXACT_CHECKOUT"
                || self.checkout_sha.as_deref() != Some(self.candidate_sha.as_str())
            {
                return Some("authoritative checkout identity is missing or mismatched".to_owned());
            }
            if !self.reference.as_deref().is_some_and(|reference| {
                policy_identity_matches(
                    self.repository.as_deref().unwrap_or_default(),
                    reference,
                    self.head_ref.as_deref(),
                    self.remote.as_deref().unwrap_or_default(),
                )
            }) {
                return Some("authoritative repository/ref identity is mismatched".to_owned());
            }
            let Some(policy) = policy_value() else {
                return Some("authority policy is unavailable or has the wrong digest".to_owned());
            };
            if !policy_tauri_profile_matches(&policy) {
                return Some("Tauri qualification profile is not the approved profile".to_owned());
            }
            let authority = policy.get("authority");
            let runner = policy.get("runner");
            if self.workflow.as_deref()
                != authority
                    .and_then(|value| value.get("workflow"))
                    .and_then(|value| value.as_str())
                || self.job.as_deref()
                    != authority
                        .and_then(|value| value.get("job"))
                        .and_then(|value| value.as_str())
                || self
                    .run_id
                    .as_deref()
                    .is_none_or(|value| !is_positive_decimal(value))
                || self
                    .run_attempt
                    .as_deref()
                    .is_none_or(|value| !is_positive_decimal(value))
                || self.runner_os.as_deref()
                    != runner
                        .and_then(|value| value.get("os"))
                        .and_then(|value| value.as_str())
                || self.runner_arch.as_deref()
                    != runner
                        .and_then(|value| value.get("arch"))
                        .and_then(|value| value.as_str())
                || !runner
                    .and_then(|value| value.get("images"))
                    .and_then(|value| value.as_array())
                    .is_some_and(|images| {
                        images
                            .iter()
                            .any(|image| image.as_str() == self.runner_image.as_deref())
                    })
            {
                return Some(
                    "authoritative workflow, run, or runner identity is not approved".to_owned(),
                );
            }
            if self
                .reference
                .as_deref()
                .is_some_and(|reference| reference.starts_with("refs/heads/"))
                && (self.checkout_relationship != "EXACT_CHECKOUT"
                    || self.checkout_sha.as_deref() != Some(self.candidate_sha.as_str()))
            {
                return Some("authoritative push-ref checkout is not exact".to_owned());
            }
            None
        }

        fn status(&self, passed: bool) -> &'static str {
            match (self.mode.as_str(), passed) {
                ("AUTHORITATIVE_GITHUB_ACTIONS", true) => "PASS",
                ("AUTHORITATIVE_GITHUB_ACTIONS", false) => "FAIL",
                ("SUPPORTING_LOCAL", true) => "SUPPORTING_PASS",
                ("SUPPORTING_LOCAL", false) => "SUPPORTING_FAIL",
                (_, true) => "FAIL",
                (_, false) => "FAIL",
            }
        }
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
                cleanup: CleanupOutcome::not_attempted(),
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
            self.cleanup = match remove_profile(
                &self.profile_path,
                env::var_os("JARVIS_NATIVE_TEST_FORCE_CLEANUP_FAILURE").is_some(),
            ) {
                Ok(()) => CleanupOutcome {
                    attempted: true,
                    succeeded: true,
                    error: None,
                },
                Err(error) => CleanupOutcome {
                    attempted: true,
                    succeeded: false,
                    error: Some(error),
                },
            };
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
        let identity = EvidenceIdentity::collect();
        let started_at = utc_timestamp();

        let mut context = match RunContext::new() {
            Ok(context) => context,
            Err(error) => {
                let failure = format!("could not create isolated profile: {error}");
                let evidence = build_evidence(
                    identity.status(false),
                    &identity,
                    &started_at,
                    &Some(failure),
                    false,
                    None,
                    None,
                );
                if let Err(write_error) = write_evidence(&evidence_path, &evidence) {
                    eprintln!("could not write failure evidence: {write_error}");
                    return 1;
                }
                eprintln!("{evidence}");
                return 1;
            }
        };

        let mut failure = execute(&mut context, &executable).err();
        context.cleanup();
        if context.forced_cleanup && failure.is_none() {
            failure = Some("qualification process required forced cleanup".to_owned());
        }
        if !context.cleanup.succeeded && failure.is_none() {
            failure = context.cleanup.error.clone();
        }
        if failure.is_none() {
            failure = identity.authoritative_failure();
        }
        let status = identity.status(failure.is_none());
        let evidence = build_evidence(
            status,
            &identity,
            &started_at,
            &failure,
            context.forced_cleanup,
            Some(&context),
            Some(&executable),
        );
        if let Err(write_error) = write_evidence(&evidence_path, &evidence) {
            eprintln!("could not write qualification evidence: {write_error}");
            return 1;
        }
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
        let mut sentinel = ForegroundSentinel::create()?;
        sentinel.activate(owner_pid)?;
        let hidden_deadline = Instant::now() + Duration::from_secs(5);
        let owner_hidden = loop {
            let owner = context.owner.as_mut().expect("owner was stored");
            if let Some(status) = owner.try_wait().map_err(|error| error.to_string())? {
                return Err(format!("owner exited while hiding: {status}"));
            }
            pump_messages();
            if let Some(snapshot) = snapshot_for_pid(owner_pid, true)
                && hidden_snapshot_is_valid(&snapshot, owner_pid, std::process::id())
            {
                break snapshot;
            }
            if Instant::now() >= hidden_deadline {
                return Err(
                    "owner window did not become hidden with the foreground sentinel within 5 seconds"
                        .to_owned(),
                );
            }
            thread::sleep(Duration::from_millis(100));
        };
        if !owner_hidden.running {
            return Err("hiding the owner window terminated the owner".to_owned());
        }
        sentinel.destroy()?;
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

    fn remove_profile(path: &Path, inject_failure: bool) -> Result<(), String> {
        fs::remove_dir_all(path).map_err(|error| format!("profile cleanup failed: {error}"))?;
        if inject_failure {
            Err("injected profile cleanup failure".to_owned())
        } else {
            Ok(())
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

    fn hidden_snapshot_is_valid(
        snapshot: &WindowSnapshot,
        owner_pid: u32,
        sentinel_pid: u32,
    ) -> bool {
        !snapshot.visible
            && snapshot.running
            && !snapshot.foreground_owner
            && snapshot.foreground_pid == sentinel_pid
            && snapshot.foreground_pid != owner_pid
    }

    fn pump_messages() {
        let mut message = MSG::default();
        // SAFETY: message points to a valid stack-owned MSG and this loop only
        // pumps messages for the qualification process's own thread.
        while unsafe { PeekMessageW(&mut message, ptr::null_mut(), 0, 0, PM_REMOVE) } != 0 {
            // SAFETY: message was populated by PeekMessageW and remains valid
            // for the synchronous translation and dispatch calls.
            unsafe {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
        }
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
        identity: &EvidenceIdentity,
        started_at: &str,
        failure: &Option<String>,
        forced_cleanup: bool,
        context: Option<&RunContext>,
        executable: Option<&Path>,
    ) -> String {
        let finished_at = utc_timestamp();
        let binary_sha = executable.and_then(sha256_file);
        let toolchain = |command: &str| command_version(command);
        let owner_initial = context.and_then(|value| value.owner_initial.as_ref());
        let owner_hidden = context.and_then(|value| value.owner_hidden.as_ref());
        let owner_final = context.and_then(|value| value.owner_final.as_ref());
        let second_pid = context.and_then(|value| value.second_pid);
        let second_exit_code = context.and_then(|value| value.second_exit_code);
        let owner_stderr = context.and_then(|value| value.owner_stderr.as_deref());
        let second_stderr = context.and_then(|value| value.second_stderr.as_deref());
        let cleanup = context
            .map(|value| value.cleanup.clone())
            .unwrap_or_else(CleanupOutcome::not_attempted);
        format!(
            concat!(
                "{{\"schemaVersion\":3,\"scope\":\"SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION\",",
                "\"status\":{},\"evidenceMode\":{},\"candidateSha\":{},",
                "\"authority\":{{\"type\":{},\"repository\":{},\"ref\":{},\"headRef\":{},",
                "\"workflow\":{},\"runId\":{},\"runAttempt\":{},\"job\":{}}},",
                "\"runner\":{{\"os\":{},\"arch\":{},\"image\":{}}},",
                "\"observed\":{{\"checkoutSha\":{},\"treeSha\":{},\"remote\":{},",
                "\"checkoutRelationship\":{},\"worktreeClean\":{},\"identityError\":{}}},",
                "\"toolchain\":{{\"rust\":{},\"cargo\":{},\"node\":{},\"pnpm\":{}}},",
                "\"profile\":{{\"executable\":\"target/x86_64-pc-windows-msvc/release/jarvis-desktop.exe\",",
                "\"feature\":\"test-support\",\"dataRoot\":\"fresh temporary test-support LocalAppData override\",",
                "\"startupBoundSeconds\":15,\"activationBoundSeconds\":10,\"readinessGraceSeconds\":5,\"hideBoundSeconds\":5}},",
                "\"executableSha256\":{},\"startedAt\":{},\"finishedAt\":{},\"failure\":{},",
                "\"forcedCleanup\":{},\"cleanup\":{{\"attempted\":{},\"succeeded\":{},\"error\":{}}},",
                "\"ownerInitial\":{},\"ownerHidden\":{},",
                "\"second\":{{\"pid\":{},\"exitCode\":{}}},\"ownerFinal\":{},",
                "\"diagnostics\":{{\"ownerStderr\":{},\"secondStderr\":{}}}}}"
            ),
            json_string(status),
            json_string(&identity.mode),
            if identity.candidate_sha.is_empty() {
                "null".to_owned()
            } else {
                json_string(&identity.candidate_sha)
            },
            if identity.mode == "AUTHORITATIVE_GITHUB_ACTIONS" {
                "\"GITHUB_ACTIONS\""
            } else {
                "null"
            },
            json_option(&identity.repository),
            json_option(&identity.reference),
            json_option(&identity.head_ref),
            json_option(&identity.workflow),
            json_option(&identity.run_id),
            json_option(&identity.run_attempt),
            json_option(&identity.job),
            json_option(&identity.runner_os),
            json_option(&identity.runner_arch),
            json_option(&identity.runner_image),
            json_option(&identity.checkout_sha),
            json_option(&identity.tree_sha),
            json_option(&identity.remote),
            json_string(&identity.checkout_relationship),
            identity
                .worktree_clean
                .map(|value| if value { "true" } else { "false" })
                .unwrap_or("null"),
            json_option(&identity.identity_error),
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
            if cleanup.attempted { "true" } else { "false" },
            if cleanup.succeeded { "true" } else { "false" },
            cleanup
                .error
                .as_deref()
                .map(json_string)
                .unwrap_or_else(|| "null".to_owned()),
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

    fn write_evidence(path: &Path, evidence: &str) -> io::Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, evidence.as_bytes())?;
        let mut log_path = path.to_path_buf();
        log_path.set_extension("log");
        fs::write(log_path, format!("{evidence}\n").as_bytes())?;
        Ok(())
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

    fn env_option(name: &str) -> Option<String> {
        env::var(name)
            .ok()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty())
    }

    fn json_option(value: &Option<String>) -> String {
        value
            .as_deref()
            .map(json_string)
            .unwrap_or_else(|| "null".to_owned())
    }

    fn is_sha(value: &str) -> bool {
        value.len() == 40
            && value.bytes().all(|byte| byte.is_ascii_hexdigit())
            && value == value.to_ascii_lowercase()
    }

    fn policy_value() -> Option<serde_json::Value> {
        let digest = Sha256::digest(AUTHORITY_POLICY_JSON.as_bytes());
        if format!("{digest:x}") != AUTHORITY_POLICY_SHA256 {
            return None;
        }
        serde_json::from_str(AUTHORITY_POLICY_JSON).ok()
    }

    fn policy_tauri_profile_matches(policy: &serde_json::Value) -> bool {
        let Some(profile) = policy.get("profiles").and_then(|value| value.get("tauri")) else {
            return false;
        };
        profile.get("executable").and_then(|value| value.as_str())
            == Some("target/x86_64-pc-windows-msvc/release/jarvis-desktop.exe")
            && profile.get("feature").and_then(|value| value.as_str()) == Some("test-support")
            && profile.get("dataRoot").and_then(|value| value.as_str())
                == Some("fresh temporary test-support LocalAppData override")
            && profile
                .get("startupBoundSeconds")
                .and_then(|value| value.as_u64())
                == Some(15)
            && profile
                .get("activationBoundSeconds")
                .and_then(|value| value.as_u64())
                == Some(10)
            && profile
                .get("readinessGraceSeconds")
                .and_then(|value| value.as_u64())
                == Some(5)
            && profile
                .get("hideBoundSeconds")
                .and_then(|value| value.as_u64())
                == Some(5)
    }

    fn is_positive_decimal(value: &str) -> bool {
        !value.is_empty()
            && value.chars().all(|character| character.is_ascii_digit())
            && !value.starts_with('0')
    }

    fn policy_string<'a>(policy: &'a serde_json::Value, key: &str) -> Option<&'a str> {
        policy.get(key).and_then(serde_json::Value::as_str)
    }

    fn policy_contains_string(policy: &serde_json::Value, key: &str, value: &str) -> bool {
        policy
            .get(key)
            .and_then(serde_json::Value::as_array)
            .is_some_and(|values| {
                values.iter().any(|candidate| {
                    candidate
                        .as_str()
                        .is_some_and(|candidate| candidate.eq_ignore_ascii_case(value))
                })
            })
    }

    fn valid_head_ref(value: &str, policy: &serde_json::Value) -> bool {
        let pattern = policy_string(policy, "headRefPattern");
        pattern.is_some_and(|pattern| {
            pattern == "^[A-Za-z0-9][A-Za-z0-9._/-]*$"
                && !value.is_empty()
                && value.chars().all(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '/' | '-')
                })
                && !value.starts_with('.')
                && !value.ends_with('.')
                && !value.starts_with('/')
                && !value.ends_with('/')
                && !value.contains("..")
                && !value.contains("//")
                && !value.contains("@{")
        })
    }

    fn policy_ref_matches(
        reference: &str,
        head_ref: Option<&str>,
        policy: &serde_json::Value,
    ) -> bool {
        let pull_pattern = policy_string(policy, "pullRefPattern");
        if pull_pattern == Some("^refs/pull/[1-9][0-9]*/merge$")
            && let Some(number) = reference
                .strip_prefix("refs/pull/")
                .and_then(|value| value.strip_suffix("/merge"))
        {
            return number
                .chars()
                .next()
                .is_some_and(|character| character.is_ascii_digit() && character != '0')
                && number.chars().all(|character| character.is_ascii_digit())
                && head_ref.is_some_and(|value| valid_head_ref(value, policy));
        }
        let push_allowed = policy
            .get("allowedPushRefs")
            .and_then(serde_json::Value::as_array)
            .is_some_and(|values| {
                values.iter().any(|allowed| {
                    let Some(allowed) = allowed.as_str() else {
                        return false;
                    };
                    reference == allowed
                        || (allowed.ends_with('/')
                            && reference.starts_with(allowed)
                            && valid_head_ref(
                                reference.strip_prefix("refs/heads/").unwrap_or_default(),
                                policy,
                            ))
                })
            });
        push_allowed && head_ref.is_none()
    }

    fn policy_identity_matches(
        repository: &str,
        reference: &str,
        head_ref: Option<&str>,
        remote: &str,
    ) -> bool {
        let Some(policy) = policy_value() else {
            return false;
        };
        policy_string(&policy, "repository")
            .is_some_and(|approved| approved.eq_ignore_ascii_case(repository))
            && policy_ref_matches(reference, head_ref, &policy)
            && policy_contains_string(&policy, "remoteForms", remote)
    }

    fn git_output(args: &[&str]) -> Result<String, String> {
        let output = Command::new("git")
            .args(args)
            .output()
            .map_err(|error| format!("git invocation failed: {error}"))?;
        if !output.status.success() {
            return Err(format!("git command exited with {}", output.status));
        }
        let value = String::from_utf8(output.stdout)
            .map_err(|_| "git command returned non-UTF-8 output".to_owned())?
            .trim()
            .to_owned();
        if value.is_empty() {
            return Err("git command returned empty output".to_owned());
        }
        Ok(value)
    }

    fn git_output_allow_empty(args: &[&str]) -> Result<String, String> {
        let output = Command::new("git")
            .args(args)
            .output()
            .map_err(|error| format!("git invocation failed: {error}"))?;
        if !output.status.success() {
            return Err(format!("git command exited with {}", output.status));
        }
        String::from_utf8(output.stdout)
            .map_err(|_| "git command returned non-UTF-8 output".to_owned())
    }

    fn sanitize_remote(value: &str) -> String {
        let value = value.trim();
        if let Some((scheme, remainder)) = value.split_once("://") {
            let host_and_path = remainder
                .rsplit_once('@')
                .map_or(remainder, |(_, rest)| rest);
            return format!("{scheme}://{host_and_path}");
        }
        if let Some((_, host_and_path)) = value.split_once('@') {
            return format!("ssh://{host_and_path}");
        }
        value.to_owned()
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

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn cleanup_fault_is_reported_after_profile_removal() {
            let profile = env::temp_dir().join(format!(
                "jarvis-tauri-cleanup-fault-{}-{}",
                std::process::id(),
                unique_suffix()
            ));
            fs::create_dir_all(&profile).expect("profile directory should be created");
            let result = remove_profile(&profile, true);
            assert_eq!(result, Err("injected profile cleanup failure".to_owned()));
            assert!(
                !profile.exists(),
                "fault injection must not leak the test profile"
            );
        }

        #[test]
        fn hidden_snapshot_requires_the_live_non_owner_sentinel_foreground() {
            let valid = WindowSnapshot {
                pid: 10,
                handle: ptr::null_mut(),
                title: "JARVIS".to_owned(),
                visible: false,
                foreground_pid: 20,
                foreground_owner: false,
                running: true,
            };
            assert!(hidden_snapshot_is_valid(&valid, 10, 20));

            let mut owner_foreground = valid.clone();
            owner_foreground.foreground_owner = true;
            assert!(!hidden_snapshot_is_valid(&owner_foreground, 10, 20));

            let mut wrong_foreground = valid.clone();
            wrong_foreground.foreground_pid = 21;
            assert!(!hidden_snapshot_is_valid(&wrong_foreground, 10, 20));

            let mut owner_pid_foreground = valid.clone();
            owner_pid_foreground.foreground_pid = 10;
            assert!(!hidden_snapshot_is_valid(&owner_pid_foreground, 10, 10));

            let mut zero_foreground = valid;
            zero_foreground.foreground_pid = 0;
            assert!(!hidden_snapshot_is_valid(&zero_foreground, 10, 20));
        }
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
