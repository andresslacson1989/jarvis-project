//! PlatformProcessSupervisor boundary.
//!
//! The production launch path in this module accepts only the integrity-
//! validated Core launch specification. Windows-native process and Job Object
//! details stay behind this Windows backend boundary; shared Core/domain code does
//! not depend on them.

use std::error::Error;
use std::fmt::{Display, Formatter};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessSupervisorState {
    UnsupportedPlatform,
    InvalidLaunchSpec,
    JobCreationFailed,
    JobConfigurationFailed,
    ProcessCreationFailed,
    ContainmentFailed,
    ResumeFailed,
    WaitFailed,
    TerminationFailed,
    TerminationVerificationFailed,
    ExitCodeFailed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessSupervisorError {
    pub state: ProcessSupervisorState,
    pub detail: String,
    pub win32_error: Option<u32>,
}

impl Display for ProcessSupervisorError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        if let Some(win32_error) = self.win32_error {
            write!(
                formatter,
                "{:?}: {} (Win32 error {})",
                self.state, self.detail, win32_error
            )
        } else {
            write!(formatter, "{:?}: {}", self.state, self.detail)
        }
    }
}

impl Error for ProcessSupervisorError {}

#[cfg(windows)]
mod windows {
    use super::{ProcessSupervisorError, ProcessSupervisorState};
    use crate::core_runtime::{CoreLaunchSpec, CoreRuntimeError, CoreRuntimeLayout};
    use std::collections::BTreeMap;
    use std::ffi::{OsStr, OsString};
    use std::mem::size_of;
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Path, PathBuf};
    use std::ptr::{null, null_mut};
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, HANDLE, HANDLE_FLAG_INHERIT, INVALID_HANDLE_VALUE,
        SetHandleInformation, WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT,
    };
    use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_GENERIC_WRITE, FILE_SHARE_READ, FILE_SHARE_WRITE,
        OPEN_EXISTING, ReadFile,
    };
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JobObjectBasicAccountingInformation, JobObjectExtendedLimitInformation,
        QueryInformationJobObject, SetInformationJobObject, TerminateJobObject,
    };
    use windows_sys::Win32::System::Pipes::CreatePipe;
    use windows_sys::Win32::System::Threading::{
        CREATE_SUSPENDED, CREATE_UNICODE_ENVIRONMENT, CreateProcessW,
        DeleteProcThreadAttributeList, EXTENDED_STARTUPINFO_PRESENT, GetExitCodeProcess,
        InitializeProcThreadAttributeList, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, PROCESS_INFORMATION,
        ResumeThread, STARTF_USESTDHANDLES, STARTUPINFOEXW, STARTUPINFOW, TerminateProcess,
        UpdateProcThreadAttribute, WaitForSingleObject,
    };

    const NO_INHERITED_HANDLES: i32 = 0;
    const RESUME_FAILURE: u32 = u32::MAX;
    const EXPECTED_INITIAL_SUSPEND_COUNT: u32 = 1;
    const TEST_TERMINATION_CODE: u32 = 0x4A52_5649;

    #[derive(Debug)]
    struct OwnedHandle(HANDLE);

    // SAFETY: Windows kernel HANDLE values are process-owned opaque values;
    // transferring the ownership wrapper between Rust threads does not move
    // or alias the underlying object. All lifecycle operations remain scoped
    // to the owning Job Object/process-supervisor methods.
    unsafe impl Send for OwnedHandle {}
    unsafe impl Sync for OwnedHandle {}

    impl OwnedHandle {
        fn new(handle: HANDLE) -> Option<Self> {
            if handle.is_null() || handle == INVALID_HANDLE_VALUE {
                None
            } else {
                Some(Self(handle))
            }
        }

        fn raw(&self) -> HANDLE {
            self.0
        }
    }

    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            // SAFETY: this wrapper is created only from an owned, validated
            // Windows handle and closes it exactly once.
            unsafe {
                CloseHandle(self.0);
            }
        }
    }

    #[derive(Debug)]
    struct JobObject {
        handle: OwnedHandle,
    }

    impl JobObject {
        fn new() -> Result<Self, ProcessSupervisorError> {
            // SAFETY: null security attributes and name request an unnamed
            // private Job Object owned by this supervisor.
            let handle = unsafe { CreateJobObjectW(null(), null()) };
            let handle = OwnedHandle::new(handle).ok_or_else(|| {
                win32_error(
                    ProcessSupervisorState::JobCreationFailed,
                    "CreateJobObjectW failed",
                )
            })?;
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            // Deliberately set only kill-on-close. Neither breakaway flag is
            // ever enabled, so a child cannot opt out of this containment.
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            // SAFETY: `limits` is the correctly sized repr(C) structure for
            // JobObjectExtendedLimitInformation and `handle` is valid.
            let configured = unsafe {
                SetInformationJobObject(
                    handle.raw(),
                    JobObjectExtendedLimitInformation,
                    (&limits as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            };
            if configured == 0 {
                return Err(win32_error(
                    ProcessSupervisorState::JobConfigurationFailed,
                    "SetInformationJobObject failed",
                ));
            }
            Ok(Self { handle })
        }

        fn assign(&self, process: HANDLE) -> Result<(), ProcessSupervisorError> {
            // SAFETY: both handles are live handles returned by Windows and
            // remain owned for the duration of this call.
            let assigned = unsafe { AssignProcessToJobObject(self.handle.raw(), process) };
            if assigned == 0 {
                Err(win32_error(
                    ProcessSupervisorState::ContainmentFailed,
                    "AssignProcessToJobObject failed; Core launch is blocked",
                ))
            } else {
                Ok(())
            }
        }

        fn terminate(&self, exit_code: u32) -> Result<(), ProcessSupervisorError> {
            // SAFETY: the Job Object handle is valid and owned by this
            // supervisor; termination is intentionally scoped to its members.
            let terminated = unsafe { TerminateJobObject(self.handle.raw(), exit_code) };
            if terminated == 0 {
                Err(win32_error(
                    ProcessSupervisorState::TerminationFailed,
                    "TerminateJobObject failed",
                ))
            } else {
                Ok(())
            }
        }

        fn active_processes(&self) -> Result<u32, ProcessSupervisorError> {
            let mut accounting = JOBOBJECT_BASIC_ACCOUNTING_INFORMATION::default();
            let mut returned = 0;
            // SAFETY: `accounting` is a correctly sized writable output
            // buffer, `returned` is a valid output pointer, and the handle is
            // owned by this supervisor.
            let queried = unsafe {
                QueryInformationJobObject(
                    self.handle.raw(),
                    JobObjectBasicAccountingInformation,
                    (&mut accounting as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(),
                    size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                    &mut returned,
                )
            };
            if queried == 0 {
                Err(win32_error(
                    ProcessSupervisorState::TerminationVerificationFailed,
                    "QueryInformationJobObject failed while reading active process count",
                ))
            } else {
                Ok(accounting.ActiveProcesses)
            }
        }

        fn wait_until_empty(&self, timeout: Duration) -> Result<(), ProcessSupervisorError> {
            let started = Instant::now();
            loop {
                if self.active_processes()? == 0 {
                    return Ok(());
                }
                if started.elapsed() >= timeout {
                    return Err(ProcessSupervisorError {
                        state: ProcessSupervisorState::TerminationVerificationFailed,
                        detail: "owned Job Object still has active processes after termination"
                            .to_owned(),
                        win32_error: None,
                    });
                }
                std::thread::sleep(Duration::from_millis(10));
            }
        }

        #[cfg(test)]
        fn limit_flags(&self) -> Result<u32, ProcessSupervisorError> {
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            let mut returned = 0;
            // SAFETY: `limits` is a correctly sized writable output buffer,
            // `returned` is a valid output pointer, and the handle is owned.
            let queried = unsafe {
                QueryInformationJobObject(
                    self.handle.raw(),
                    JobObjectExtendedLimitInformation,
                    (&mut limits as *mut JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                    &mut returned,
                )
            };
            if queried == 0 {
                return Err(win32_error(
                    ProcessSupervisorState::JobConfigurationFailed,
                    "QueryInformationJobObject failed",
                ));
            }
            Ok(limits.BasicLimitInformation.LimitFlags)
        }
    }

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct ProcessLaunchSpec {
        program: PathBuf,
        arguments: Vec<OsString>,
        current_dir: PathBuf,
        environment: BTreeMap<OsString, OsString>,
        bootstrap_reader: Option<HANDLE>,
    }

    impl From<CoreLaunchSpec> for ProcessLaunchSpec {
        fn from(spec: CoreLaunchSpec) -> Self {
            Self {
                program: spec.program,
                arguments: spec.arguments,
                current_dir: spec.current_dir,
                environment: spec.environment,
                bootstrap_reader: None,
            }
        }
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum ProcessWait {
        TimedOut,
        Exited { code: u32 },
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum ProcessShutdownOutcome {
        Graceful {
            code: u32,
            reason: ProcessShutdownReason,
        },
        Forced {
            code: u32,
            reason: ProcessShutdownReason,
        },
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum ProcessShutdownReason {
        UserCancel,
        Timeout,
        ProviderFailure,
        ProviderSetupRepair,
        PausePreemption,
        ProcessTermination,
        AppShutdown,
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct ProcessContainmentDiagnostics {
        pub process_id: u32,
        pub process_exited: bool,
        pub active_job_processes: u32,
    }

    #[derive(Debug)]
    pub struct SupervisedCoreProcess {
        process: OwnedHandle,
        process_id: u32,
        job: Arc<JobObject>,
        stderr_read: Mutex<Option<OwnedHandle>>,
    }

    impl SupervisedCoreProcess {
        pub fn process_id(&self) -> u32 {
            self.process_id
        }

        /// Read one bounded, bracketed startup failure code after the process
        /// has exited. Core emits only stable error codes on stderr; arbitrary
        /// child output is never admitted into native diagnostics.
        pub fn startup_failure_code(&self) -> Option<String> {
            let handle = self.stderr_read.lock().ok()?.take()?;
            let mut buffer = [0_u8; 256];
            let mut bytes_read = 0_u32;
            // SAFETY: the handle is an owned read end of the host-created pipe,
            // the buffer is writable, and this method is called after the
            // supervised process has exited so the child write end is closed.
            let read = unsafe {
                ReadFile(
                    handle.raw(),
                    buffer.as_mut_ptr().cast(),
                    buffer.len() as u32,
                    &mut bytes_read,
                    std::ptr::null_mut(),
                )
            };
            if read == 0 || bytes_read == 0 {
                return None;
            }
            let text = std::str::from_utf8(&buffer[..bytes_read as usize]).ok()?;
            let text = text.trim_end_matches(&['\r', '\n'][..]);
            let code = text.strip_prefix('[')?.strip_suffix(']')?;
            if code.is_empty()
                || code.len() > 64
                || !code
                    .bytes()
                    .all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || byte == b'_')
            {
                return None;
            }
            Some(code.to_owned())
        }

        pub fn wait(&self, timeout: Duration) -> Result<ProcessWait, ProcessSupervisorError> {
            let timeout_millis = timeout.as_millis().try_into().unwrap_or(u32::MAX - 1);
            // SAFETY: the process handle is valid for the lifetime of self.
            let result = unsafe { WaitForSingleObject(self.process.raw(), timeout_millis) };
            match result {
                WAIT_OBJECT_0 => {
                    let mut exit_code = 0;
                    // SAFETY: the process handle is valid and exit_code is a
                    // writable output location.
                    let read = unsafe { GetExitCodeProcess(self.process.raw(), &mut exit_code) };
                    if read == 0 {
                        Err(win32_error(
                            ProcessSupervisorState::ExitCodeFailed,
                            "GetExitCodeProcess failed",
                        ))
                    } else {
                        Ok(ProcessWait::Exited { code: exit_code })
                    }
                }
                WAIT_TIMEOUT => Ok(ProcessWait::TimedOut),
                WAIT_FAILED => Err(win32_error(
                    ProcessSupervisorState::WaitFailed,
                    "WaitForSingleObject failed",
                )),
                _ => Err(ProcessSupervisorError {
                    state: ProcessSupervisorState::WaitFailed,
                    detail: "WaitForSingleObject returned an unexpected result".to_owned(),
                    win32_error: None,
                }),
            }
        }

        pub fn containment_diagnostics(
            &self,
        ) -> Result<ProcessContainmentDiagnostics, ProcessSupervisorError> {
            let process_exited = matches!(self.wait(Duration::ZERO)?, ProcessWait::Exited { .. });
            Ok(ProcessContainmentDiagnostics {
                process_id: self.process_id,
                process_exited,
                active_job_processes: self.job.active_processes()?,
            })
        }

        /// Complete the supervisor-owned escalation after the owning lifecycle
        /// layer has already requested cooperative shutdown through the
        /// process's semantic protocol. The supervisor deliberately does not
        /// invent a generic child protocol: it waits the bounded grace period,
        /// force-terminates the complete Job Object if needed, and verifies
        /// that both the root and all assigned descendants are gone.
        pub fn shutdown_after_cooperative_request(
            &self,
            grace: Duration,
            exit_code: u32,
            verification_timeout: Duration,
            reason: ProcessShutdownReason,
        ) -> Result<ProcessShutdownOutcome, ProcessSupervisorError> {
            match self.wait(grace)? {
                ProcessWait::Exited { code } => {
                    self.job.wait_until_empty(verification_timeout)?;
                    Ok(ProcessShutdownOutcome::Graceful { code, reason })
                }
                ProcessWait::TimedOut => {
                    self.job.terminate(exit_code)?;
                    let code = match self.wait(verification_timeout)? {
                        ProcessWait::Exited { code } => code,
                        ProcessWait::TimedOut => {
                            return Err(ProcessSupervisorError {
                                state: ProcessSupervisorState::TerminationVerificationFailed,
                                detail: "root process remained active after Job Object termination"
                                    .to_owned(),
                                win32_error: None,
                            });
                        }
                    };
                    self.job.wait_until_empty(verification_timeout)?;
                    Ok(ProcessShutdownOutcome::Forced { code, reason })
                }
            }
        }

        /// Terminate the complete owned Job Object, including any descendants
        /// already assigned to it. Cooperative cancellation and grace periods
        /// are owned by the later lifecycle layer; this is the hard-stop path.
        pub fn terminate(&self, exit_code: u32) -> Result<(), ProcessSupervisorError> {
            self.job.terminate(exit_code)
        }
    }

    #[derive(Debug)]
    pub struct PlatformProcessSupervisor {
        job: Arc<JobObject>,
    }

    impl PlatformProcessSupervisor {
        pub fn new() -> Result<Self, ProcessSupervisorError> {
            Ok(Self {
                job: Arc::new(JobObject::new()?),
            })
        }

        /// Launch the application-owned Core only after its integrity and
        /// release identity have been validated. The process is suspended
        /// until it is assigned to the owned Job Object.
        pub fn launch_core(
            &self,
            layout: &CoreRuntimeLayout,
            manifest_path: &Path,
        ) -> Result<SupervisedCoreProcess, ProcessSupervisorError> {
            let spec = layout
                .launch_spec(manifest_path)
                .map_err(core_runtime_error)?;
            self.spawn_spec(spec.into())
        }

        /// Launch Core with one inherited anonymous bootstrap reader and
        /// host-controlled NUL stdout/stderr handles. The handle-list
        /// attribute is the complete inheritance allowlist; the bootstrap
        /// secret itself never enters the command line or environment.
        pub fn launch_core_with_bootstrap(
            &self,
            layout: &CoreRuntimeLayout,
            manifest_path: &Path,
            bootstrap_reader: HANDLE,
        ) -> Result<SupervisedCoreProcess, ProcessSupervisorError> {
            let spec = layout
                .launch_spec(manifest_path)
                .map_err(core_runtime_error)?;
            let mut spec: ProcessLaunchSpec = spec.into();
            spec.bootstrap_reader = Some(bootstrap_reader);
            self.spawn_spec(spec)
        }

        /// Launch Core with the authenticated bootstrap channel and the
        /// release-owned database path. The database key itself is transferred
        /// only through the inherited bootstrap channel; this path is merely
        /// the explicit local persistence location Core must open.
        pub fn launch_core_with_bootstrap_and_database(
            &self,
            layout: &CoreRuntimeLayout,
            manifest_path: &Path,
            bootstrap_reader: HANDLE,
            database_path: &Path,
        ) -> Result<SupervisedCoreProcess, ProcessSupervisorError> {
            self.launch_core_with_bootstrap_and_database_mode(
                layout,
                manifest_path,
                bootstrap_reader,
                database_path,
                false,
            )
        }

        /// Launch Core with the explicit bounded recovery-mode environment.
        /// Recovery mode is host-selected from the app-owned recovery marker;
        /// it is never inferred from user input or a renderer request.
        pub fn launch_core_with_bootstrap_and_database_mode(
            &self,
            layout: &CoreRuntimeLayout,
            manifest_path: &Path,
            bootstrap_reader: HANDLE,
            database_path: &Path,
            recovery_mode: bool,
        ) -> Result<SupervisedCoreProcess, ProcessSupervisorError> {
            if !database_path.is_absolute() {
                return Err(invalid_spec(
                    "Core database path must be absolute and release-owned",
                ));
            }
            let spec = layout
                .launch_spec(manifest_path)
                .map_err(core_runtime_error)?;
            let mut spec: ProcessLaunchSpec = spec.into();
            spec.environment.insert(
                OsString::from("JARVIS_DATABASE_PATH"),
                database_path.as_os_str().to_os_string(),
            );
            if recovery_mode {
                spec.environment
                    .insert(OsString::from("JARVIS_RECOVERY_MODE"), OsString::from("1"));
            }
            spec.bootstrap_reader = Some(bootstrap_reader);
            self.spawn_spec(spec)
        }

        /// Launch one of the fixed, repository-owned engineering profiles.
        /// The caller supplies only the already-registered workspace root and
        /// the typed operation/profile identifiers; it cannot provide an
        /// executable, arguments, or environment. The resulting process is
        /// assigned to this supervisor's Job Object before it is resumed.
        pub fn launch_engineering(
            &self,
            workspace_root: &Path,
            operation: &str,
            profile_id: &str,
        ) -> Result<SupervisedCoreProcess, ProcessSupervisorError> {
            self.spawn_spec(engineering_launch_spec(
                workspace_root,
                operation,
                profile_id,
            )?)
        }

        fn spawn_spec(
            &self,
            spec: ProcessLaunchSpec,
        ) -> Result<SupervisedCoreProcess, ProcessSupervisorError> {
            validate_spec(&spec)?;
            let application_name = wide_null(spec.program.as_os_str(), "program")?;
            let mut command_line = build_command_line(&spec)?;
            let current_directory = wide_null(spec.current_dir.as_os_str(), "current directory")?;
            let mut environment = build_environment_block(&spec.environment)?;
            let startup_info = STARTUPINFOW {
                cb: size_of::<STARTUPINFOW>() as u32,
                ..Default::default()
            };
            let mut startup_info_ex = STARTUPINFOEXW {
                StartupInfo: startup_info,
                ..Default::default()
            };
            let mut attribute_storage: Vec<usize> = Vec::new();
            let mut inherited_handles: Vec<HANDLE> = Vec::new();
            let mut stdio_handles: Vec<OwnedHandle> = Vec::new();
            let mut stderr_read: Option<OwnedHandle> = None;
            let mut attributes_initialized = false;
            let mut creation_flags = CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT;
            let inherit_handles = if let Some(reader) = spec.bootstrap_reader {
                startup_info_ex.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
                startup_info_ex.StartupInfo.dwFlags |= STARTF_USESTDHANDLES;
                startup_info_ex.StartupInfo.hStdInput = reader;
                let stdout = open_nul_output_handle()?;
                let (captured_stderr_read, stderr) = create_stderr_capture()?;
                stderr_read = captured_stderr_read;
                startup_info_ex.StartupInfo.hStdOutput = stdout.raw();
                startup_info_ex.StartupInfo.hStdError = stderr.raw();
                stdio_handles.extend([stdout, stderr]);
                inherited_handles.extend([reader, stdio_handles[0].raw(), stdio_handles[1].raw()]);
                let mut required_bytes = 0usize;
                // SAFETY: the first call intentionally supplies a null list
                // to obtain the bounded attribute-list size for the explicit
                // stdin/stdout/stderr handle allowlist.
                unsafe {
                    InitializeProcThreadAttributeList(
                        std::ptr::null_mut(),
                        1,
                        0,
                        &mut required_bytes,
                    );
                }
                if required_bytes == 0 {
                    return Err(win32_error(
                        ProcessSupervisorState::ProcessCreationFailed,
                        "InitializeProcThreadAttributeList did not report a size",
                    ));
                }
                attribute_storage.resize(required_bytes.div_ceil(size_of::<usize>()), 0);
                startup_info_ex.lpAttributeList = attribute_storage.as_mut_ptr().cast();
                // SAFETY: the storage is aligned and sized from the Windows
                // query; the list is initialized for the explicit three-handle
                // inheritance allowlist.
                if unsafe {
                    InitializeProcThreadAttributeList(
                        startup_info_ex.lpAttributeList,
                        1,
                        0,
                        &mut required_bytes,
                    )
                } == 0
                {
                    return Err(win32_error(
                        ProcessSupervisorState::ProcessCreationFailed,
                        "InitializeProcThreadAttributeList failed",
                    ));
                }
                attributes_initialized = true;
                // SAFETY: the attribute list is initialized and the three
                // handles are valid, inheritable handles selected by the host.
                if unsafe {
                    UpdateProcThreadAttribute(
                        startup_info_ex.lpAttributeList,
                        0,
                        PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                        inherited_handles.as_ptr().cast(),
                        size_of::<HANDLE>() * inherited_handles.len(),
                        std::ptr::null_mut(),
                        std::ptr::null(),
                    )
                } == 0
                {
                    // SAFETY: the list was initialized immediately above.
                    unsafe { DeleteProcThreadAttributeList(startup_info_ex.lpAttributeList) };
                    return Err(win32_error(
                        ProcessSupervisorState::ProcessCreationFailed,
                        "UpdateProcThreadAttribute failed for the Core bootstrap handle",
                    ));
                }
                creation_flags |= EXTENDED_STARTUPINFO_PRESENT;
                1
            } else {
                NO_INHERITED_HANDLES
            };
            let mut process_information = PROCESS_INFORMATION::default();
            // SAFETY: all wide strings are NUL-terminated and remain alive
            // through the synchronous CreateProcessW call; startup and
            // process-information structures are valid initialized buffers.
            // Null security attributes and the explicit handle-list attribute
            // implement the bounded inheritance allowlist. The host-owned NUL
            // output handles remain alive until CreateProcessW returns.
            let startup_ptr = &startup_info_ex.StartupInfo as *const STARTUPINFOW;
            // SAFETY: the initialized startup/process buffers and bounded
            // UTF-16 pointers remain valid for the synchronous native call.
            let created = unsafe {
                CreateProcessW(
                    application_name.as_ptr(),
                    command_line.as_mut_ptr(),
                    null(),
                    null(),
                    inherit_handles,
                    creation_flags,
                    environment.as_mut_ptr().cast(),
                    current_directory.as_ptr(),
                    startup_ptr,
                    &mut process_information,
                )
            };
            if attributes_initialized {
                // SAFETY: the attribute list was initialized and remains
                // valid until after CreateProcessW returns.
                unsafe { DeleteProcThreadAttributeList(startup_info_ex.lpAttributeList) };
            }
            if created == 0 {
                return Err(win32_error(
                    ProcessSupervisorState::ProcessCreationFailed,
                    "CreateProcessW failed",
                ));
            }

            let process = match OwnedHandle::new(process_information.hProcess) {
                Some(handle) => handle,
                None => {
                    // SAFETY: CreateProcessW reported success; the returned
                    // process handle is either valid or must be closed if an
                    // API anomaly produced an invalid value.
                    unsafe {
                        if !process_information.hThread.is_null()
                            && process_information.hThread != INVALID_HANDLE_VALUE
                        {
                            CloseHandle(process_information.hThread);
                        }
                    }
                    return Err(ProcessSupervisorError {
                        state: ProcessSupervisorState::ProcessCreationFailed,
                        detail: "CreateProcessW returned an invalid process handle".to_owned(),
                        win32_error: None,
                    });
                }
            };
            let thread = match OwnedHandle::new(process_information.hThread) {
                Some(handle) => handle,
                None => {
                    // SAFETY: CreateProcessW reported success and the
                    // process handle is owned; the process has not resumed.
                    unsafe {
                        TerminateProcess(process.raw(), EXPECTED_INITIAL_SUSPEND_COUNT);
                    }
                    return Err(ProcessSupervisorError {
                        state: ProcessSupervisorState::ProcessCreationFailed,
                        detail: "CreateProcessW returned an invalid thread handle".to_owned(),
                        win32_error: None,
                    });
                }
            };
            let mut pending = PendingProcess {
                process: Some(process),
                thread: Some(thread),
                terminate_on_drop: true,
            };

            // This call is intentionally before ResumeThread. If assignment
            // fails, the pending guard terminates the still-suspended process
            // and no uncontained Core code can execute.
            self.job.assign(pending.process_handle())?;
            // SAFETY: the thread handle is valid, owned, and still suspended
            // from the CREATE_SUSPENDED launch above.
            let resumed = unsafe { ResumeThread(pending.thread_handle()) };
            if resumed == RESUME_FAILURE {
                return Err(win32_error(
                    ProcessSupervisorState::ResumeFailed,
                    "ResumeThread failed; Core launch was terminated",
                ));
            }
            if resumed != EXPECTED_INITIAL_SUSPEND_COUNT {
                return Err(ProcessSupervisorError {
                    state: ProcessSupervisorState::ResumeFailed,
                    detail: "ResumeThread did not remove the expected initial suspension; Core launch was terminated"
                        .to_owned(),
                    win32_error: None,
                });
            }

            pending.terminate_on_drop = false;
            let process = pending
                .process
                .take()
                .expect("pending process handle exists");
            pending.thread.take();
            Ok(SupervisedCoreProcess {
                process,
                process_id: process_information.dwProcessId,
                job: Arc::clone(&self.job),
                stderr_read: Mutex::new(stderr_read),
            })
        }

        #[cfg(test)]
        fn launch_test_process(
            &self,
            spec: ProcessLaunchSpec,
        ) -> Result<SupervisedCoreProcess, ProcessSupervisorError> {
            self.spawn_spec(spec)
        }

        #[cfg(test)]
        fn configured_limit_flags(&self) -> Result<u32, ProcessSupervisorError> {
            self.job.limit_flags()
        }
    }

    #[derive(Debug)]
    struct PendingProcess {
        process: Option<OwnedHandle>,
        thread: Option<OwnedHandle>,
        terminate_on_drop: bool,
    }

    impl PendingProcess {
        fn process_handle(&self) -> HANDLE {
            self.process.as_ref().expect("pending process exists").raw()
        }

        fn thread_handle(&self) -> HANDLE {
            self.thread.as_ref().expect("pending thread exists").raw()
        }
    }

    impl Drop for PendingProcess {
        fn drop(&mut self) {
            if self.terminate_on_drop
                && let Some(process) = &self.process
            {
                // SAFETY: the process handle is owned and the process is
                // still in the pre-commit launch state.
                unsafe {
                    TerminateProcess(process.raw(), TEST_TERMINATION_CODE);
                }
            }
        }
    }

    fn validate_spec(spec: &ProcessLaunchSpec) -> Result<(), ProcessSupervisorError> {
        if !spec.program.is_absolute() || !spec.current_dir.is_absolute() {
            return Err(invalid_spec(
                "program and current directory must be absolute",
            ));
        }
        validate_no_nul(spec.program.as_os_str(), "program")?;
        validate_no_nul(spec.current_dir.as_os_str(), "current directory")?;
        for argument in &spec.arguments {
            validate_no_nul(argument, "argument")?;
        }
        for (key, value) in &spec.environment {
            validate_no_nul(key, "environment key")?;
            validate_no_nul(value, "environment value")?;
            if key.is_empty() || key.encode_wide().any(|unit| unit == b'=' as u16) {
                return Err(invalid_spec(
                    "environment keys must be non-empty and cannot contain '='",
                ));
            }
        }
        Ok(())
    }

    fn engineering_launch_spec(
        workspace_root: &Path,
        operation: &str,
        profile_id: &str,
    ) -> Result<ProcessLaunchSpec, ProcessSupervisorError> {
        if !workspace_root.is_absolute() || !workspace_root.is_dir() {
            return Err(invalid_spec(
                "engineering workspace root must be an existing absolute directory",
            ));
        }

        let command = match (operation, profile_id) {
            ("TEST", "npm.test") => "test",
            ("BUILD", "npm.build") => "build",
            _ => {
                return Err(invalid_spec(
                    "engineering operation/profile is not in the fixed Windows allowlist",
                ));
            }
        };

        let program_files = std::env::var_os("ProgramFiles").ok_or_else(|| {
            invalid_spec("ProgramFiles is required for the qualified Node runtime")
        })?;
        let node_root = PathBuf::from(program_files).join("nodejs");
        let node = node_root.join("node.exe");
        let pnpm_script = node_root
            .join("node_modules")
            .join("corepack")
            .join("dist")
            .join("pnpm.js");
        if !node.is_file() || !pnpm_script.is_file() {
            return Err(invalid_spec(
                "the qualified Node/corepack runtime is not installed at the fixed Windows location",
            ));
        }

        let system_root = std::env::var_os("SystemRoot").ok_or_else(|| {
            invalid_spec("SystemRoot is required for the engineering worker environment")
        })?;
        let system_root = PathBuf::from(system_root);
        let git_bin =
            PathBuf::from(std::env::var_os("ProgramFiles").expect("ProgramFiles checked"))
                .join("Git")
                .join("cmd");
        let system32 = system_root.join("System32");
        let path =
            std::env::join_paths([node_root.as_path(), git_bin.as_path(), system32.as_path()])
                .map_err(|_| invalid_spec("fixed engineering PATH could not be constructed"))?;
        let mut environment = BTreeMap::new();
        environment.insert(OsString::from("Path"), path);
        environment.insert(
            OsString::from("SystemRoot"),
            system_root.clone().into_os_string(),
        );
        for key in ["TEMP", "TMP", "USERPROFILE"] {
            if let Some(value) = std::env::var_os(key) {
                environment.insert(OsString::from(key), value);
            }
        }
        Ok(ProcessLaunchSpec {
            program: node,
            arguments: vec![pnpm_script.into_os_string(), OsString::from(command)],
            current_dir: workspace_root.to_owned(),
            environment,
            bootstrap_reader: None,
        })
    }

    fn build_command_line(spec: &ProcessLaunchSpec) -> Result<Vec<u16>, ProcessSupervisorError> {
        let mut command_line = quote_windows_argument(spec.program.as_os_str())?;
        for argument in &spec.arguments {
            command_line.push(b' ' as u16);
            command_line.extend(quote_windows_argument(argument)?);
        }
        command_line.push(0);
        Ok(command_line)
    }

    fn build_environment_block(
        environment: &BTreeMap<OsString, OsString>,
    ) -> Result<Vec<u16>, ProcessSupervisorError> {
        let mut block = Vec::new();
        for (key, value) in environment {
            validate_no_nul(key, "environment key")?;
            validate_no_nul(value, "environment value")?;
            block.extend(key.encode_wide());
            block.push(b'=' as u16);
            block.extend(value.encode_wide());
            block.push(0);
        }
        block.push(0);
        Ok(block)
    }

    fn quote_windows_argument(argument: &OsStr) -> Result<Vec<u16>, ProcessSupervisorError> {
        validate_no_nul(argument, "command-line argument")?;
        let units: Vec<u16> = argument.encode_wide().collect();
        let mut quoted = Vec::with_capacity(units.len() + 2);
        quoted.push(b'"' as u16);
        let mut backslashes = 0;
        for unit in units {
            if unit == b'\\' as u16 {
                backslashes += 1;
            } else if unit == b'"' as u16 {
                quoted.extend(std::iter::repeat_n(b'\\' as u16, backslashes * 2 + 1));
                quoted.push(unit);
                backslashes = 0;
            } else {
                quoted.extend(std::iter::repeat_n(b'\\' as u16, backslashes));
                quoted.push(unit);
                backslashes = 0;
            }
        }
        quoted.extend(std::iter::repeat_n(b'\\' as u16, backslashes * 2));
        quoted.push(b'"' as u16);
        Ok(quoted)
    }

    fn open_nul_output_handle() -> Result<OwnedHandle, ProcessSupervisorError> {
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: std::ptr::null_mut(),
            bInheritHandle: 1,
        };
        let nul = wide_null(OsStr::new("NUL"), "NUL output device")?;
        // SAFETY: the path is a fixed NUL-terminated device name, the output
        // handle requests only write access, and the security attributes make
        // this handle eligible for the explicit process handle list.
        let handle = unsafe {
            CreateFileW(
                nul.as_ptr(),
                FILE_GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                &attributes,
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                null_mut(),
            )
        };
        OwnedHandle::new(handle).ok_or_else(|| {
            win32_error(
                ProcessSupervisorState::ProcessCreationFailed,
                "CreateFileW failed for controlled Core output",
            )
        })
    }

    fn create_stderr_capture() -> Result<(Option<OwnedHandle>, OwnedHandle), ProcessSupervisorError>
    {
        let attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: std::ptr::null_mut(),
            bInheritHandle: 1,
        };
        let mut reader = null_mut();
        let mut writer = null_mut();
        // SAFETY: the output handle pointers and security attributes are
        // initialized writable buffers for this synchronous call.
        if unsafe { CreatePipe(&mut reader, &mut writer, &attributes, 0) } == 0 {
            return Err(win32_error(
                ProcessSupervisorState::ProcessCreationFailed,
                "CreatePipe failed for bounded Core diagnostics",
            ));
        }
        let reader = OwnedHandle::new(reader).ok_or_else(|| {
            // SAFETY: CreatePipe returned a writer that must be closed when
            // the reader result is invalid.
            unsafe { CloseHandle(writer) };
            ProcessSupervisorError {
                state: ProcessSupervisorState::ProcessCreationFailed,
                detail: "CreatePipe returned an invalid diagnostic reader".to_owned(),
                win32_error: None,
            }
        })?;
        let writer = match OwnedHandle::new(writer) {
            Some(handle) => handle,
            None => {
                return Err(ProcessSupervisorError {
                    state: ProcessSupervisorState::ProcessCreationFailed,
                    detail: "CreatePipe returned an invalid diagnostic writer".to_owned(),
                    win32_error: None,
                });
            }
        };
        // SAFETY: the reader is host-owned and must not enter the child's
        // explicit handle allowlist.
        if unsafe { SetHandleInformation(reader.raw(), HANDLE_FLAG_INHERIT, 0) } == 0 {
            return Err(win32_error(
                ProcessSupervisorState::ProcessCreationFailed,
                "SetHandleInformation failed for bounded Core diagnostics",
            ));
        }
        Ok((Some(reader), writer))
    }

    fn wide_null(value: &OsStr, label: &str) -> Result<Vec<u16>, ProcessSupervisorError> {
        validate_no_nul(value, label)?;
        let mut result: Vec<u16> = value.encode_wide().collect();
        result.push(0);
        Ok(result)
    }

    fn validate_no_nul(value: &OsStr, label: &str) -> Result<(), ProcessSupervisorError> {
        if value.encode_wide().any(|unit| unit == 0) {
            Err(invalid_spec(&format!(
                "{label} cannot contain an embedded NUL"
            )))
        } else {
            Ok(())
        }
    }

    fn invalid_spec(detail: &str) -> ProcessSupervisorError {
        ProcessSupervisorError {
            state: ProcessSupervisorState::InvalidLaunchSpec,
            detail: detail.to_owned(),
            win32_error: None,
        }
    }

    fn core_runtime_error(error: CoreRuntimeError) -> ProcessSupervisorError {
        ProcessSupervisorError {
            state: ProcessSupervisorState::InvalidLaunchSpec,
            detail: format!("integrity-validated Core launch spec unavailable: {error}"),
            win32_error: None,
        }
    }

    fn win32_error(state: ProcessSupervisorState, detail: &str) -> ProcessSupervisorError {
        // SAFETY: GetLastError reads the thread-local error set by the
        // immediately preceding Windows API call on this thread.
        let win32_error = unsafe { GetLastError() };
        ProcessSupervisorError {
            state,
            detail: detail.to_owned(),
            win32_error: Some(win32_error),
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use crate::core_runtime::{CoreRuntimeLayout, RuntimeIntegrityManifest};
        use sha2::{Digest, Sha256};
        use std::fs::{copy, create_dir_all, remove_dir_all, write};
        use std::os::windows::ffi::OsStringExt;
        use std::thread::sleep;
        use std::time::{Duration, SystemTime, UNIX_EPOCH};
        use windows_sys::Win32::Foundation::{HANDLE_FLAG_INHERIT, SetHandleInformation};
        use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
        use windows_sys::Win32::Storage::FileSystem::WriteFile;
        use windows_sys::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW,
            TH32CS_SNAPPROCESS,
        };
        use windows_sys::Win32::System::JobObjects::{
            JOB_OBJECT_LIMIT_BREAKAWAY_OK, JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK,
        };
        use windows_sys::Win32::System::Pipes::CreatePipe;
        use windows_sys::Win32::System::Threading::{
            OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
        };

        fn ping_spec(count: &str) -> ProcessLaunchSpec {
            let system_root = std::env::var_os("SystemRoot").expect("Windows sets SystemRoot");
            let root = PathBuf::from(system_root);
            let ping = root.join("System32").join("ping.exe");
            assert!(ping.is_file(), "Windows ping executable must exist");
            ProcessLaunchSpec {
                program: ping,
                arguments: vec![
                    OsString::from("-n"),
                    OsString::from(count),
                    OsString::from("127.0.0.1"),
                ],
                current_dir: root.clone(),
                environment: BTreeMap::from([(
                    OsString::from("SystemRoot"),
                    root.into_os_string(),
                )]),
                bootstrap_reader: None,
            }
        }

        fn find_child_process(parent_id: u32) -> Option<u32> {
            // SAFETY: the snapshot is a Windows-owned read-only process list;
            // the output entry is correctly sized and writable.
            let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
            if snapshot == INVALID_HANDLE_VALUE {
                return None;
            }
            let mut entry = PROCESSENTRY32W {
                dwSize: size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            let mut found = None;
            // SAFETY: `entry` remains valid for each Toolhelp iteration and
            // the snapshot handle is valid until the explicit close below.
            let mut has_entry = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
            while has_entry {
                if entry.th32ParentProcessID == parent_id {
                    found = Some(entry.th32ProcessID);
                    break;
                }
                // SAFETY: same valid snapshot and writable entry as above.
                has_entry = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
            }
            // SAFETY: this test owns the snapshot handle.
            unsafe {
                CloseHandle(snapshot);
            }
            found
        }

        fn find_named_child_process(parent_id: u32, expected_name: &str) -> Option<u32> {
            // SAFETY: the snapshot is a Windows-owned read-only process list;
            // the output entry is correctly sized and writable.
            let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
            if snapshot == INVALID_HANDLE_VALUE {
                return None;
            }
            let mut entry = PROCESSENTRY32W {
                dwSize: size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            let mut found = None;
            // SAFETY: `entry` remains valid for each Toolhelp iteration and
            // the snapshot handle is valid until the explicit close below.
            let mut has_entry = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
            while has_entry {
                if entry.th32ParentProcessID == parent_id {
                    let name_end = entry
                        .szExeFile
                        .iter()
                        .position(|unit| *unit == 0)
                        .unwrap_or(entry.szExeFile.len());
                    let name = String::from_utf16_lossy(&entry.szExeFile[..name_end]);
                    if name.eq_ignore_ascii_case(expected_name) {
                        found = Some(entry.th32ProcessID);
                        break;
                    }
                }
                // SAFETY: same valid snapshot and writable entry as above.
                has_entry = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
            }
            // SAFETY: this test owns the snapshot handle.
            unsafe {
                CloseHandle(snapshot);
            }
            found
        }

        fn sha256_file(path: &Path) -> String {
            let bytes = std::fs::read(path).expect("fixture file must be readable");
            format!("{:x}", Sha256::digest(bytes))
        }

        fn core_fixture() -> (PathBuf, CoreRuntimeLayout, PathBuf) {
            let system_root = std::env::var_os("SystemRoot").expect("Windows sets SystemRoot");
            let system_root = PathBuf::from(system_root);
            let root = std::env::temp_dir().join(format!(
                "jarvis-process-supervisor-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("system clock must be after epoch")
                    .as_nanos()
            ));
            let node = root.join("runtime").join("node.exe");
            let core = root.join("core").join("dist").join("main.js");
            create_dir_all(node.parent().expect("node parent must exist"))
                .expect("runtime directory must be creatable");
            create_dir_all(core.parent().expect("Core parent must exist"))
                .expect("Core directory must be creatable");
            copy(system_root.join("System32").join("ping.exe"), &node)
                .expect("test runtime executable must be copied");
            write(&core, b"synthetic Core entrypoint")
                .expect("test Core entrypoint must be written");
            let manifest_path = root.join("runtime-manifest.json");
            let manifest = RuntimeIntegrityManifest {
                manifest_version: 1,
                jarvis_release_version: "test-release".to_owned(),
                core_version: "test-core".to_owned(),
                source_commit_sha: "0".repeat(40),
                release_sequence: 1,
                security_epoch: 1,
                release_distribution_scope: "PRIVATE_INTERNAL".to_owned(),
                public_distribution_supported: false,
                windows_signing: crate::core_runtime::RuntimeWindowsSigningEvidence::default(),
                persistence_qualification: Some(
                    crate::core_runtime::RuntimePersistenceQualification::default(),
                ),
                tuf_spec_version: "1.0.35".to_owned(),
                target: "WINDOWS_FULL_HOST_X64".to_owned(),
                protocol_version: 1,
                minimum_data_schema_version: 1,
                maximum_data_schema_version: 1,
                schema_version: 1,
                platform: "WINDOWS".to_owned(),
                runtime_role: "FULL_HOST".to_owned(),
                architecture: "x64".to_owned(),
                node_version: "24.18.0".to_owned(),
                protocol_major: 1,
                node_path: "runtime/node.exe".to_owned(),
                core_entrypoint: "core/dist/main.js".to_owned(),
                node_sha256: sha256_file(&node),
                core_sha256: sha256_file(&core),
                core_support_files: Vec::new(),
            };
            write(
                &manifest_path,
                serde_json::to_vec(&manifest).expect("fixture manifest must serialize"),
            )
            .expect("fixture manifest must be written");
            let layout = CoreRuntimeLayout::new(root.clone(), node, core)
                .expect("fixture layout must be accepted");
            (root, layout, manifest_path)
        }

        #[test]
        fn job_object_has_kill_on_close_and_no_breakaway_flags() {
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let flags = supervisor
                .configured_limit_flags()
                .expect("Job Object limits must be readable");
            assert_ne!(flags & JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, 0);
            assert_eq!(flags & JOB_OBJECT_LIMIT_BREAKAWAY_OK, 0);
            assert_eq!(flags & JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK, 0);
        }

        #[test]
        fn process_is_assigned_while_suspended_before_it_runs() {
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let process = supervisor
                .launch_test_process(ping_spec("2"))
                .expect("suspended process must be assigned and resumed");
            let result = process
                .wait(Duration::from_secs(10))
                .expect("process wait must succeed");
            assert!(matches!(result, ProcessWait::Exited { .. }));
        }

        #[test]
        fn cooperative_graceful_shutdown_reports_exit_and_empty_job() {
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let process = supervisor
                .launch_test_process(ping_spec("2"))
                .expect("short-lived process must be contained");
            let outcome = process
                .shutdown_after_cooperative_request(
                    Duration::from_secs(10),
                    TEST_TERMINATION_CODE,
                    Duration::from_secs(5),
                    ProcessShutdownReason::AppShutdown,
                )
                .expect("graceful shutdown must be verified");
            assert!(matches!(
                outcome,
                ProcessShutdownOutcome::Graceful {
                    reason: ProcessShutdownReason::AppShutdown,
                    ..
                }
            ));
            let diagnostics = process
                .containment_diagnostics()
                .expect("containment diagnostics must remain available after exit");
            assert!(diagnostics.process_exited);
            assert_eq!(diagnostics.active_job_processes, 0);
        }

        #[test]
        fn integrity_validated_core_launch_uses_the_supervisor_path() {
            let (root, layout, manifest_path) = core_fixture();
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let result = {
                let process = supervisor
                    .launch_core(&layout, &manifest_path)
                    .expect("integrity-validated Core launch must be contained");
                let result = process
                    .wait(Duration::from_secs(10))
                    .expect("Core process wait must succeed");
                drop(process);
                result
            };
            assert!(matches!(result, ProcessWait::Exited { .. }));
            drop(supervisor);
            remove_dir_all(root).expect("Core fixture must be removable");
        }

        #[test]
        fn bounded_core_stderr_code_is_captured_without_arbitrary_output() {
            let system_root = std::env::var_os("SystemRoot").expect("Windows sets SystemRoot");
            let node = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
            assert!(
                node.is_file(),
                "the pinned Node development runtime must exist"
            );
            let attributes = SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: std::ptr::null_mut(),
                bInheritHandle: 1,
            };
            let mut reader = std::ptr::null_mut();
            let mut writer = std::ptr::null_mut();
            assert_ne!(
                // SAFETY: the output pointers and security attributes are
                // initialized writable buffers for this synchronous call.
                unsafe { CreatePipe(&mut reader, &mut writer, &attributes, 0) },
                0,
                "bootstrap test pipe must be created"
            );
            assert_ne!(
                // SAFETY: the writer is host-owned and must not be inherited;
                // the child only needs the reader as its standard input.
                unsafe { SetHandleInformation(writer, HANDLE_FLAG_INHERIT, 0) },
                0,
                "bootstrap writer must stay host-owned"
            );
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let process = supervisor
                .launch_test_process(ProcessLaunchSpec {
                    program: node,
                    arguments: vec![
                        OsString::from("-e"),
                        OsString::from(
                            "process.stderr.write('[CORE_START_FAILED]\\n');process.exit(1)",
                        ),
                    ],
                    current_dir: PathBuf::from(system_root),
                    environment: BTreeMap::from([
                        (
                            OsString::from("SystemRoot"),
                            std::env::var_os("SystemRoot").unwrap(),
                        ),
                        (
                            OsString::from("WINDIR"),
                            std::env::var_os("WINDIR").unwrap(),
                        ),
                    ]),
                    bootstrap_reader: Some(reader),
                })
                .expect("Core diagnostic capture process must launch");
            // SAFETY: the host owns both test pipe handles and closes them
            // after the child has received the inherited reader handle.
            unsafe {
                CloseHandle(reader);
                CloseHandle(writer);
            }
            assert!(matches!(
                process
                    .wait(Duration::from_secs(5))
                    .expect("process wait must succeed"),
                ProcessWait::Exited { .. }
            ));
            assert_eq!(
                process.startup_failure_code().as_deref(),
                Some("CORE_START_FAILED")
            );
        }

        #[test]
        fn inherited_bootstrap_reader_reaches_application_owned_node() {
            let system_root = std::env::var_os("SystemRoot").expect("Windows sets SystemRoot");
            let node = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
            assert!(
                node.is_file(),
                "the pinned Node development runtime must exist"
            );
            let attributes = SECURITY_ATTRIBUTES {
                nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                lpSecurityDescriptor: std::ptr::null_mut(),
                bInheritHandle: 1,
            };
            let mut reader = std::ptr::null_mut();
            let mut writer = std::ptr::null_mut();
            assert_ne!(
                // SAFETY: the output pointers and security attributes are
                // initialized writable buffers for this synchronous call.
                unsafe { CreatePipe(&mut reader, &mut writer, &attributes, 0) },
                0,
                "bootstrap test pipe must be created"
            );
            assert_ne!(
                // SAFETY: `writer` is the valid handle returned by CreatePipe
                // and the flag update is a bounded synchronous native call.
                unsafe { SetHandleInformation(writer, HANDLE_FLAG_INHERIT, 0) },
                0,
                "bootstrap writer must stay host-owned"
            );
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let process = supervisor
                .launch_test_process(ProcessLaunchSpec {
                    program: node,
                    arguments: vec![
                        OsString::from("-e"),
                        OsString::from(
                            "process.stdout.write('ready');process.stderr.write('ready');process.stdin.once('data',()=>process.exit(0));setTimeout(()=>process.exit(2),5000)",
                        ),
                    ],
                    current_dir: PathBuf::from(system_root),
                    environment: BTreeMap::from([
                        (OsString::from("SystemRoot"), std::env::var_os("SystemRoot").unwrap()),
                        (OsString::from("WINDIR"), std::env::var_os("WINDIR").unwrap()),
                    ]),
                    bootstrap_reader: Some(reader),
                })
                .expect("Node process with the inherited bootstrap reader must launch");
            // SAFETY: `reader` is the valid bootstrap handle transferred to
            // the child and is closed exactly once by this test owner.
            unsafe { CloseHandle(reader) };
            let byte = [0x4a_u8];
            let mut written = 0u32;
            assert_ne!(
                // SAFETY: `writer` is a valid host-owned pipe handle and all
                // output pointers refer to initialized writable storage.
                unsafe {
                    WriteFile(
                        writer,
                        byte.as_ptr().cast(),
                        1,
                        &mut written,
                        std::ptr::null_mut(),
                    )
                },
                0,
                "bootstrap byte must be written"
            );
            // SAFETY: `writer` is the valid bootstrap handle owned by this
            // test and is closed exactly once after the write completes.
            unsafe { CloseHandle(writer) };
            assert_eq!(written, 1);
            assert_eq!(
                process
                    .wait(Duration::from_secs(10))
                    .expect("child wait must succeed"),
                ProcessWait::Exited { code: 0 }
            );
        }

        #[test]
        fn closing_supervisor_job_terminates_a_live_member() {
            let process_id;
            let external_process_handle;
            {
                let supervisor =
                    PlatformProcessSupervisor::new().expect("Job Object must be created");
                let process = supervisor
                    .launch_test_process(ping_spec("60"))
                    .expect("long-running process must be contained");
                process_id = process.process_id();
                // SAFETY: process_id came from the live child and the handle
                // is used only for synchronization in this test.
                external_process_handle = unsafe {
                    OpenProcess(
                        PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
                        0,
                        process_id,
                    )
                };
                assert!(
                    !external_process_handle.is_null()
                        && external_process_handle != INVALID_HANDLE_VALUE,
                    "test must obtain a synchronization handle to the live child"
                );
                drop(process);
                // The supervisor closes its Job Object here; kill-on-close
                // must terminate the still-running ping member.
            }
            // SAFETY: the handle was validated above and remains open until
            // the explicit close below.
            let wait = unsafe { WaitForSingleObject(external_process_handle, 5_000) };
            assert_eq!(wait, WAIT_OBJECT_0, "Job Object close must end the child");
            // SAFETY: this test owns the synchronization handle.
            unsafe {
                CloseHandle(external_process_handle);
            }
        }

        #[test]
        fn closing_supervisor_job_terminates_a_live_descendant() {
            let system_root = std::env::var_os("SystemRoot").expect("Windows sets SystemRoot");
            let cmd = PathBuf::from(system_root.as_os_str())
                .join("System32")
                .join("cmd.exe");
            assert!(cmd.is_file(), "Windows command interpreter must exist");
            let system32 = PathBuf::from(system_root.as_os_str()).join("System32");
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let process = supervisor
                .launch_test_process(ProcessLaunchSpec {
                    program: cmd,
                    arguments: vec![
                        OsString::from("/d"),
                        OsString::from("/c ping.exe -n 60 127.0.0.1"),
                    ],
                    current_dir: system32,
                    environment: BTreeMap::from([(
                        OsString::from("SystemRoot"),
                        std::env::var_os("SystemRoot").unwrap(),
                    )]),
                    bootstrap_reader: None,
                })
                .expect("supervised command parent must launch");

            let descendant_pid = (0..100).find_map(|_| {
                let child = find_child_process(process.process_id());
                if child.is_none() {
                    sleep(Duration::from_millis(50));
                }
                child
            });
            let descendant_pid =
                descendant_pid.expect("supervised descendant must be discoverable");
            // SAFETY: the PID came from the live child relationship of the
            // supervised process; rights are limited to synchronization and
            // liveness inspection.
            let external_process_handle = unsafe {
                OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
                    0,
                    descendant_pid,
                )
            };
            assert!(
                !external_process_handle.is_null()
                    && external_process_handle != INVALID_HANDLE_VALUE,
                "test must obtain a synchronization handle to the live descendant"
            );
            let outcome = process
                .shutdown_after_cooperative_request(
                    Duration::ZERO,
                    TEST_TERMINATION_CODE,
                    Duration::from_secs(5),
                    ProcessShutdownReason::Timeout,
                )
                .expect("forced shutdown must verify the complete Job Object");
            assert!(matches!(
                outcome,
                ProcessShutdownOutcome::Forced {
                    reason: ProcessShutdownReason::Timeout,
                    ..
                }
            ));
            let diagnostics = process
                .containment_diagnostics()
                .expect("containment diagnostics must verify an empty Job Object");
            assert!(diagnostics.process_exited);
            assert_eq!(diagnostics.active_job_processes, 0);

            // SAFETY: the handle was validated above and remains open until
            // the explicit close below. Job kill-on-close must terminate the
            // descendant, not only the direct supervised parent.
            let wait = unsafe { WaitForSingleObject(external_process_handle, 5_000) };
            assert_eq!(
                wait, WAIT_OBJECT_0,
                "Job Object close must end the descendant"
            );
            // SAFETY: this test owns the synchronization handle.
            unsafe {
                CloseHandle(external_process_handle);
            }
        }

        #[test]
        #[ignore = "requires the installed qualified Codex CLI and its Windows sandbox setup"]
        fn live_codex_worker_inherits_supervisor_job_and_is_force_terminated() {
            let system_root = std::env::var_os("SystemRoot").expect("Windows sets SystemRoot");
            let system_root = PathBuf::from(system_root);
            let node = PathBuf::from(r"C:\Program Files\nodejs\node.exe");
            assert!(
                node.is_file(),
                "the pinned Node development runtime must exist"
            );
            let codex = std::env::var_os("JARVIS_CODEX_EXECUTABLE")
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    PathBuf::from(
                        std::env::var_os("USERPROFILE").expect("Windows user profile must exist"),
                    )
                    .join(".codex")
                    .join("packages")
                    .join("standalone")
                    .join("releases")
                    .join("0.147.0-x86_64-pc-windows-msvc")
                    .join("bin")
                    .join("codex.exe")
                });
            assert!(
                codex.is_file(),
                "the qualified Codex CLI executable must exist"
            );
            let codex_parent = codex
                .parent()
                .and_then(Path::parent)
                .expect("Codex release directory must have a working parent")
                .to_path_buf();
            let script = "const { spawn } = require('node:child_process'); const child = spawn(process.env.JARVIS_LIVE_CODEX, ['sandbox', '--', 'cmd', '/d', '/c', 'ping.exe', '-n', '60', '127.0.0.1'], { stdio: 'ignore' }); child.once('error', () => process.exit(41)); child.once('exit', code => process.exit(code ?? 42)); setTimeout(() => process.exit(43), 30000);";
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let process = supervisor
                .launch_test_process(ProcessLaunchSpec {
                    program: node,
                    arguments: vec![OsString::from("-e"), OsString::from(script)],
                    current_dir: codex_parent,
                    environment: BTreeMap::from([
                        (
                            OsString::from("SystemRoot"),
                            system_root.clone().into_os_string(),
                        ),
                        (OsString::from("WINDIR"), system_root.into_os_string()),
                        (OsString::from("JARVIS_LIVE_CODEX"), codex.into_os_string()),
                    ]),
                    bootstrap_reader: None,
                })
                .expect("supervised Core-like parent must launch");
            let codex_pid = (0..200).find_map(|_| {
                let child = find_named_child_process(process.process_id(), "codex.exe");
                if child.is_none() {
                    sleep(Duration::from_millis(50));
                }
                child
            });
            let codex_pid =
                codex_pid.expect("the actual Codex worker must be a supervised descendant");
            // SAFETY: the PID came from the live supervised process tree;
            // rights are limited to synchronization and liveness inspection.
            let external_process_handle = unsafe {
                OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
                    0,
                    codex_pid,
                )
            };
            assert!(
                !external_process_handle.is_null()
                    && external_process_handle != INVALID_HANDLE_VALUE,
                "the test must obtain a synchronization handle to the live Codex worker"
            );
            let outcome = process
                .shutdown_after_cooperative_request(
                    Duration::ZERO,
                    TEST_TERMINATION_CODE,
                    Duration::from_secs(10),
                    ProcessShutdownReason::Timeout,
                )
                .expect("forced shutdown must verify the complete Codex Job Object");
            assert!(matches!(
                outcome,
                ProcessShutdownOutcome::Forced {
                    reason: ProcessShutdownReason::Timeout,
                    ..
                }
            ));
            let diagnostics = process
                .containment_diagnostics()
                .expect("Codex containment diagnostics must verify an empty Job Object");
            assert!(diagnostics.process_exited);
            assert_eq!(diagnostics.active_job_processes, 0);
            // SAFETY: the handle was validated above and remains open until
            // the explicit close below. Job termination must end Codex too.
            let wait = unsafe { WaitForSingleObject(external_process_handle, 10_000) };
            assert_eq!(
                wait, WAIT_OBJECT_0,
                "Job termination must end the Codex worker"
            );
            // SAFETY: this test owns the synchronization handle.
            unsafe {
                CloseHandle(external_process_handle);
            }
        }

        #[test]
        fn relative_or_embedded_nul_launch_specs_fail_closed() {
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let relative = ProcessLaunchSpec {
                program: PathBuf::from("node.exe"),
                arguments: Vec::new(),
                current_dir: std::env::current_dir().expect("test directory must resolve"),
                environment: BTreeMap::new(),
                bootstrap_reader: None,
            };
            let error = supervisor
                .launch_test_process(relative)
                .expect_err("relative executable must be rejected");
            assert_eq!(error.state, ProcessSupervisorState::InvalidLaunchSpec);

            let nul_units = vec![b'n' as u16, 0, b'o' as u16];
            let nul = OsString::from_wide(&nul_units);
            let embedded_nul = ProcessLaunchSpec {
                program: PathBuf::from("C:\\Windows\\System32\\ping.exe"),
                arguments: vec![nul],
                current_dir: PathBuf::from("C:\\Windows"),
                environment: BTreeMap::new(),
                bootstrap_reader: None,
            };
            let error = supervisor
                .launch_test_process(embedded_nul)
                .expect_err("embedded NUL must be rejected");
            assert_eq!(error.state, ProcessSupervisorState::InvalidLaunchSpec);
        }

        #[test]
        fn engineering_profiles_are_fixed_and_reject_arbitrary_commands() {
            let workspace = std::env::current_dir().expect("test workspace must resolve");
            let test_spec = engineering_launch_spec(&workspace, "TEST", "npm.test")
                .expect("the qualified Node/Corepack runtime must be installed for Windows tests");
            assert_eq!(
                test_spec
                    .program
                    .file_name()
                    .and_then(|value| value.to_str()),
                Some("node.exe")
            );
            assert_eq!(
                test_spec.arguments.last().and_then(|value| value.to_str()),
                Some("test")
            );
            assert!(
                test_spec
                    .environment
                    .keys()
                    .all(|key| key != &OsString::from("NODE_OPTIONS"))
            );

            let error = engineering_launch_spec(&workspace, "TEST", "cmd.arbitrary")
                .expect_err("arbitrary profile IDs must be rejected");
            assert_eq!(error.state, ProcessSupervisorState::InvalidLaunchSpec);
            let error = engineering_launch_spec(&workspace, "TEST", "npm.build")
                .expect_err("operation/profile mismatches must be rejected");
            assert_eq!(error.state, ProcessSupervisorState::InvalidLaunchSpec);
        }

        #[test]
        fn engineering_test_profile_runs_inside_the_owned_job() {
            let root = std::env::temp_dir().join(format!(
                "jarvis-engineering-profile-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .expect("system clock must be after epoch")
                    .as_nanos()
            ));
            create_dir_all(&root).expect("engineering fixture directory must be creatable");
            write(
                root.join("package.json"),
                br#"{"scripts":{"test":"node -e \"process.exit(0)\""}}"#,
            )
            .expect("engineering fixture package must be written");
            let supervisor = PlatformProcessSupervisor::new().expect("Job Object must be created");
            let process = supervisor
                .launch_engineering(&root, "TEST", "npm.test")
                .expect("fixed engineering profile must launch");
            let result = process
                .wait(Duration::from_secs(30))
                .expect("engineering profile wait must succeed");
            assert!(matches!(result, ProcessWait::Exited { code: 0 }));
            let deadline = Instant::now() + Duration::from_secs(5);
            loop {
                let diagnostics = process
                    .containment_diagnostics()
                    .expect("engineering containment diagnostics must succeed");
                if diagnostics.process_exited && diagnostics.active_job_processes == 0 {
                    break;
                }
                assert!(
                    Instant::now() < deadline,
                    "owned Job Object did not become empty after the process exited: {diagnostics:?}"
                );
                std::thread::sleep(Duration::from_millis(10));
            }
            remove_dir_all(root).expect("engineering fixture must be removable");
        }
    }
}

#[cfg(windows)]
pub use windows::{
    PlatformProcessSupervisor, ProcessContainmentDiagnostics, ProcessShutdownOutcome,
    ProcessShutdownReason, ProcessWait, SupervisedCoreProcess,
};

#[cfg(not(windows))]
#[derive(Debug)]
pub struct PlatformProcessSupervisor;

#[cfg(not(windows))]
impl PlatformProcessSupervisor {
    pub fn new() -> Result<Self, ProcessSupervisorError> {
        Err(ProcessSupervisorError {
            state: ProcessSupervisorState::UnsupportedPlatform,
            detail: "Windows FULL_HOST process supervision is unavailable on this target"
                .to_owned(),
            win32_error: None,
        })
    }
}
