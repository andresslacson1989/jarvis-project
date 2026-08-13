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
    use std::ptr::null;
    use std::sync::Arc;
    use std::time::Duration;
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, HANDLE, INVALID_HANDLE_VALUE, WAIT_FAILED, WAIT_OBJECT_0,
        WAIT_TIMEOUT,
    };
    #[cfg(test)]
    use windows_sys::Win32::System::JobObjects::QueryInformationJobObject;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject,
    };
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

    #[derive(Debug)]
    pub struct SupervisedCoreProcess {
        process: OwnedHandle,
        process_id: u32,
        job: Arc<JobObject>,
    }

    impl SupervisedCoreProcess {
        pub fn process_id(&self) -> u32 {
            self.process_id
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

        /// Launch Core with a single inherited anonymous bootstrap reader.
        /// The handle-list attribute is the complete inheritance allowlist;
        /// the bootstrap secret itself never enters the command line or env.
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
            let mut attributes_initialized = false;
            let mut creation_flags = CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT;
            let inherit_handles = if let Some(reader) = spec.bootstrap_reader {
                startup_info_ex.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
                startup_info_ex.StartupInfo.dwFlags |= STARTF_USESTDHANDLES;
                startup_info_ex.StartupInfo.hStdInput = reader;
                let mut required_bytes = 0usize;
                // SAFETY: the first call intentionally supplies a null list
                // to obtain the bounded attribute-list size for one handle.
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
                // query; the list is initialized for one inherited handle.
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
                // SAFETY: the attribute list is initialized and `reader` is
                // the one valid inherited HANDLE selected by the host.
                if unsafe {
                    UpdateProcThreadAttribute(
                        startup_info_ex.lpAttributeList,
                        0,
                        PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                        (&reader as *const HANDLE).cast(),
                        size_of::<HANDLE>(),
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
            // Null security attributes and bInheritHandles=FALSE implement the
            // explicit empty handle allowlist.
            // SAFETY: the pointers above remain valid for this synchronous
            // Windows API call and no handles are inherited.
            let startup_ptr = &startup_info_ex.StartupInfo as *const STARTUPINFOW;
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
        use std::time::{SystemTime, UNIX_EPOCH};
        use windows_sys::Win32::System::JobObjects::{
            JOB_OBJECT_LIMIT_BREAKAWAY_OK, JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK,
        };
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
    }
}

#[cfg(windows)]
pub use windows::{PlatformProcessSupervisor, ProcessWait, SupervisedCoreProcess};

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
