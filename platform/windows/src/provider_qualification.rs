//! JARVIS-owned Codex CLI readiness and sandbox conformance probing.
//!
//! This probe is deliberately separate from the elevated setup operation. It
//! runs the already-qualified CLI as the ordinary host user, validates the
//! exact executable identity at the boundary, and treats helper completion as
//! insufficient until the provider-managed sandbox proves its contract.

use std::fmt::{Display, Formatter};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::native_broker::WindowsNativeBroker;
use crate::privilege_mediator::{
    PrivilegeMediatorError, PrivilegeOperationRegistry, ProviderSetupArguments,
    QualifiedHelperIdentity, CODEX_CLI_PROVIDER_ID,
};

pub const CODEX_SANDBOX_SENTINEL: &str = "JARVIS_CODEX_CLI_SANDBOX_OK";
pub const QUALIFIED_CODEX_DISTRIBUTION_ID: &str = "codex-cli-standalone-windows-x64-0.147.0";
pub const QUALIFIED_CODEX_INTERFACE_ID: &str = "codex-structured-v1";
pub const QUALIFIED_CODEX_SETUP_ARGUMENTS: &[&str] = &["--repair"];
const MAX_PROBE_OUTPUT_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexCliProbeSpec {
    executable: PathBuf,
    working_directory: PathBuf,
    timeout: Duration,
}

impl CodexCliProbeSpec {
    pub fn new(
        executable: impl Into<PathBuf>,
        working_directory: impl Into<PathBuf>,
        timeout: Duration,
    ) -> Result<Self, CodexCliProbeError> {
        if timeout.is_zero() || timeout > Duration::from_secs(300) {
            return Err(CodexCliProbeError::InvalidSpec(
                "probe timeout is outside the bounded limit",
            ));
        }
        let executable = executable.into();
        let working_directory = working_directory.into();
        if !executable.is_absolute() || !working_directory.is_absolute() {
            return Err(CodexCliProbeError::InvalidSpec(
                "probe paths must be absolute",
            ));
        }
        Ok(Self {
            executable,
            working_directory,
            timeout,
        })
    }

    pub fn executable(&self) -> &Path {
        &self.executable
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexCliProbeResult {
    pub executable: PathBuf,
    pub sandbox_identity: String,
    pub sandbox_sentinel_verified: bool,
    pub structured_exec_interface_verified: bool,
}

/// Exact, previously qualified setup identity supplied by provider discovery.
/// This type intentionally does not discover or construct an executable path
/// or argument plan from user input.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexCliSetupPlan {
    distribution_id: String,
    interface_id: String,
    setup_arguments: Vec<String>,
    helper_path: PathBuf,
}

impl CodexCliSetupPlan {
    pub fn new(
        distribution_id: String,
        interface_id: String,
        setup_arguments: Vec<String>,
        helper_path: impl Into<PathBuf>,
    ) -> Result<Self, PrivilegeMediatorError> {
        let helper_path = helper_path.into();
        let _ = ProviderSetupArguments::new(
            CODEX_CLI_PROVIDER_ID.to_owned(),
            distribution_id.clone(),
            interface_id.clone(),
            setup_arguments.clone(),
        )?;
        Ok(Self {
            distribution_id,
            interface_id,
            setup_arguments,
            helper_path,
        })
    }

    pub fn distribution_id(&self) -> &str {
        &self.distribution_id
    }

    pub fn interface_id(&self) -> &str {
        &self.interface_id
    }
}

/// Discover the installed, provider-qualified Codex distribution from the
/// machine-owned Codex release root. This never accepts executable paths or
/// setup arguments from the renderer or an ordinary worker.
pub fn discover_qualified_codex_setup(
    user_profile: impl Into<PathBuf>,
    working_directory: impl Into<PathBuf>,
) -> Result<(CodexCliProbeSpec, CodexCliSetupPlan), CodexCliSetupError> {
    let release_root = user_profile
        .into()
        .join(".codex")
        .join("packages")
        .join("standalone")
        .join("releases")
        .join("0.147.0-x86_64-pc-windows-msvc");
    let executable = release_root.join("bin").join("codex.exe");
    let helper = release_root
        .join("codex-resources")
        .join("codex-windows-sandbox-setup.exe");
    let spec = CodexCliProbeSpec::new(executable, working_directory, Duration::from_secs(300))?;
    let plan = CodexCliSetupPlan::new(
        QUALIFIED_CODEX_DISTRIBUTION_ID.to_owned(),
        QUALIFIED_CODEX_INTERFACE_ID.to_owned(),
        QUALIFIED_CODEX_SETUP_ARGUMENTS.iter().map(|value| (*value).to_owned()).collect(),
        helper,
    )?;
    Ok((spec, plan))
}

#[derive(Debug)]
pub enum CodexCliSetupError {
    Probe(CodexCliProbeError),
    Privilege(PrivilegeMediatorError),
}

impl Display for CodexCliSetupError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Probe(error) => Display::fmt(error, formatter),
            Self::Privilege(error) => Display::fmt(error, formatter),
        }
    }
}

impl std::error::Error for CodexCliSetupError {}

impl From<CodexCliProbeError> for CodexCliSetupError {
    fn from(error: CodexCliProbeError) -> Self {
        Self::Probe(error)
    }
}

impl From<PrivilegeMediatorError> for CodexCliSetupError {
    fn from(error: PrivilegeMediatorError) -> Self {
        Self::Privilege(error)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CodexCliProbeError {
    InvalidSpec(&'static str),
    ExecutableUnavailable,
    WorkingDirectoryUnavailable,
    ExecutableChanged,
    SpawnFailed,
    TimedOut,
    NonZeroExit,
    OutputTooLarge,
    SandboxSentinelMissing,
    SandboxIdentityMissing,
    StructuredExecInterfaceMissing,
}

impl Display for CodexCliProbeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(match self {
            Self::InvalidSpec(message) => message,
            Self::ExecutableUnavailable => "Codex CLI executable is unavailable",
            Self::WorkingDirectoryUnavailable => "Codex CLI probe working directory is unavailable",
            Self::ExecutableChanged => "Codex CLI executable changed during qualification",
            Self::SpawnFailed => "Codex CLI probe could not start",
            Self::TimedOut => "Codex CLI probe timed out",
            Self::NonZeroExit => "Codex CLI probe exited unsuccessfully",
            Self::OutputTooLarge => "Codex CLI probe output exceeded the bounded limit",
            Self::SandboxSentinelMissing => "Codex sandbox conformance sentinel was not returned",
            Self::SandboxIdentityMissing => "Codex sandbox identity was not returned",
            Self::StructuredExecInterfaceMissing => {
                "Codex structured exec interface was not advertised"
            }
        })
    }
}

impl std::error::Error for CodexCliProbeError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProbeKind {
    SandboxIdentity,
    SandboxSentinel,
    StructuredExecHelp,
}

fn validate_installed_executable(path: &Path) -> Result<PathBuf, CodexCliProbeError> {
    let metadata =
        std::fs::symlink_metadata(path).map_err(|_| CodexCliProbeError::ExecutableUnavailable)?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(CodexCliProbeError::ExecutableUnavailable);
    }
    std::fs::canonicalize(path).map_err(|_| CodexCliProbeError::ExecutableUnavailable)
}

fn validate_working_directory(path: &Path) -> Result<PathBuf, CodexCliProbeError> {
    let metadata =
        std::fs::metadata(path).map_err(|_| CodexCliProbeError::WorkingDirectoryUnavailable)?;
    if !metadata.is_dir() {
        return Err(CodexCliProbeError::WorkingDirectoryUnavailable);
    }
    std::fs::canonicalize(path).map_err(|_| CodexCliProbeError::WorkingDirectoryUnavailable)
}

fn spawn_probe(spec: &CodexCliProbeSpec, kind: ProbeKind) -> Result<Child, CodexCliProbeError> {
    let arguments: &[&str] = match kind {
        ProbeKind::SandboxIdentity => &["sandbox", "--", "cmd", "/c", "whoami"],
        ProbeKind::SandboxSentinel => {
            &["sandbox", "--", "cmd", "/c", "echo", CODEX_SANDBOX_SENTINEL]
        }
        ProbeKind::StructuredExecHelp => &["exec", "--help"],
    };
    Command::new(spec.executable())
        .args(arguments)
        .current_dir(&spec.working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| CodexCliProbeError::SpawnFailed)
}

fn run_probe(
    spec: &CodexCliProbeSpec,
    kind: ProbeKind,
) -> Result<(ExitStatus, Vec<u8>, Vec<u8>), CodexCliProbeError> {
    let mut child = spawn_probe(spec, kind)?;
    let deadline = Instant::now() + spec.timeout;
    loop {
        if let Some(status) = child
            .try_wait()
            .map_err(|_| CodexCliProbeError::SpawnFailed)?
        {
            let output = child
                .wait_with_output()
                .map_err(|_| CodexCliProbeError::SpawnFailed)?;
            if output.stdout.len() > MAX_PROBE_OUTPUT_BYTES
                || output.stderr.len() > MAX_PROBE_OUTPUT_BYTES
            {
                return Err(CodexCliProbeError::OutputTooLarge);
            }
            return Ok((status, output.stdout, output.stderr));
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err(CodexCliProbeError::TimedOut);
        }
        sleep(Duration::from_millis(25));
    }
}

fn successful_output(
    spec: &CodexCliProbeSpec,
    kind: ProbeKind,
) -> Result<String, CodexCliProbeError> {
    let (status, stdout, _stderr) = run_probe(spec, kind)?;
    if !status.success() {
        return Err(CodexCliProbeError::NonZeroExit);
    }
    String::from_utf8(stdout).map_err(|_| CodexCliProbeError::NonZeroExit)
}

/// Run the JARVIS-owned non-elevated provider readiness and sandbox probe.
/// A successful helper/setup process is never treated as readiness evidence
/// by itself; all three independent conformance observations are required.
pub fn probe_codex_cli(
    spec: &CodexCliProbeSpec,
) -> Result<CodexCliProbeResult, CodexCliProbeError> {
    let executable = validate_installed_executable(spec.executable())?;
    let working_directory = validate_working_directory(&spec.working_directory)?;
    if executable == working_directory {
        return Err(CodexCliProbeError::InvalidSpec(
            "Codex CLI executable cannot be the probe working directory",
        ));
    }
    let identity = successful_output(spec, ProbeKind::SandboxIdentity)?;
    let sandbox_identity = identity.trim().to_owned();
    if sandbox_identity.is_empty() || sandbox_identity.contains('\0') {
        return Err(CodexCliProbeError::SandboxIdentityMissing);
    }
    let sentinel = successful_output(spec, ProbeKind::SandboxSentinel)?;
    if !sentinel
        .lines()
        .any(|line| line.trim() == CODEX_SANDBOX_SENTINEL)
    {
        return Err(CodexCliProbeError::SandboxSentinelMissing);
    }
    let help = successful_output(spec, ProbeKind::StructuredExecHelp)?;
    if !help.contains("--json") || !help.contains("--sandbox") {
        return Err(CodexCliProbeError::StructuredExecInterfaceMissing);
    }
    if validate_installed_executable(spec.executable())? != executable {
        return Err(CodexCliProbeError::ExecutableChanged);
    }
    Ok(CodexCliProbeResult {
        executable,
        sandbox_identity,
        sandbox_sentinel_verified: true,
        structured_exec_interface_verified: true,
    })
}

/// Execute one authenticated setup/repair attempt through the typed native
/// broker, then independently reprobe the provider. The broker owns the
/// bounded Windows UAC lifecycle; this workflow never exposes a shell, path,
/// or arbitrary elevated operation to the caller.
pub fn run_authenticated_codex_setup(
    broker: &mut WindowsNativeBroker,
    spec: &CodexCliProbeSpec,
    plan: &CodexCliSetupPlan,
) -> Result<CodexCliProbeResult, CodexCliSetupError> {
    let helper = QualifiedHelperIdentity::from_installed_file(&plan.helper_path)?;
    let registry = PrivilegeOperationRegistry::with_provider_setup_repair(
        CODEX_CLI_PROVIDER_ID.to_owned(),
        plan.distribution_id.clone(),
        plan.interface_id.clone(),
        plan.setup_arguments.clone(),
        helper,
    )?;
    let arguments = ProviderSetupArguments::new(
        CODEX_CLI_PROVIDER_ID.to_owned(),
        plan.distribution_id.clone(),
        plan.interface_id.clone(),
        plan.setup_arguments.clone(),
    )?;
    broker.configure_privilege_registry(&registry);
    broker.invoke_provider_setup_repair(arguments)?;
    Ok(probe_codex_cli(spec)?)
}

#[cfg(test)]
mod tests {
    use super::{CodexCliProbeError, CodexCliProbeSpec, CodexCliSetupPlan};
    use std::time::Duration;

    #[test]
    fn probe_spec_rejects_relative_paths_and_unbounded_timeout() {
        assert!(matches!(
            CodexCliProbeSpec::new("codex.exe", "C:\\Jarvis", Duration::from_secs(1)),
            Err(CodexCliProbeError::InvalidSpec(_))
        ));
        assert!(matches!(
            CodexCliProbeSpec::new("C:\\codex.exe", "C:\\Jarvis", Duration::from_secs(301)),
            Err(CodexCliProbeError::InvalidSpec(_))
        ));
    }

    #[test]
    fn probe_spec_rejects_zero_timeout() {
        assert!(matches!(
            CodexCliProbeSpec::new("C:\\codex.exe", "C:\\Jarvis", Duration::ZERO),
            Err(CodexCliProbeError::InvalidSpec(_))
        ));
    }

    #[test]
    fn setup_plan_rejects_unbounded_or_nul_arguments() {
        assert!(CodexCliSetupPlan::new(
            "codex-private".to_owned(),
            "codex-structured-v1".to_owned(),
            vec!["--repair\0".to_owned()],
            "C:\\codex-windows-sandbox-setup.exe",
        )
        .is_err());
    }
}
