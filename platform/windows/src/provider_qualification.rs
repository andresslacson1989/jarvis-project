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
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use serde::Serialize;

use crate::native_broker::WindowsNativeBroker;
use crate::privilege_mediator::{
    CODEX_CLI_PROVIDER_ID, PrivilegeMediatorError, PrivilegeOperationRegistry,
    ProviderSetupArguments, QualifiedHelperIdentity,
};

pub const CODEX_SANDBOX_SENTINEL: &str = "JARVIS_CODEX_CLI_SANDBOX_OK";
pub const QUALIFIED_CODEX_DISTRIBUTION_ID: &str = "codex-cli-standalone-windows-x64-0.147.0";
pub const QUALIFIED_CODEX_INTERFACE_ID: &str = "codex-structured-v1";
const CODEX_WINDOWS_SANDBOX_SETUP_VERSION: u32 = 5;
const MAX_PROBE_OUTPUT_BYTES: usize = 64 * 1024;

#[derive(Debug, Serialize)]
struct CodexWindowsSandboxSetupPayload {
    version: u32,
    offline_username: &'static str,
    online_username: &'static str,
    codex_home: PathBuf,
    command_cwd: PathBuf,
    read_roots: Vec<PathBuf>,
    write_roots: Vec<PathBuf>,
    deny_read_paths: Vec<PathBuf>,
    deny_write_paths: Vec<PathBuf>,
    proxy_ports: Vec<u16>,
    allow_local_binding: bool,
    otel: Option<String>,
    real_user: String,
    mode: &'static str,
    refresh_only: bool,
}

fn build_codex_windows_sandbox_setup_arguments_for_user(
    user_profile: &Path,
    working_directory: &Path,
    real_user: String,
) -> Result<Vec<String>, CodexCliSetupError> {
    if real_user.is_empty() || real_user.contains('\0') {
        return Err(CodexCliSetupError::Payload(
            "Windows USERNAME is empty or invalid",
        ));
    }
    let payload = CodexWindowsSandboxSetupPayload {
        version: CODEX_WINDOWS_SANDBOX_SETUP_VERSION,
        offline_username: "CodexSandboxOffline",
        online_username: "CodexSandboxOnline",
        codex_home: user_profile.join(".codex"),
        command_cwd: working_directory.to_path_buf(),
        read_roots: Vec::new(),
        write_roots: Vec::new(),
        deny_read_paths: Vec::new(),
        deny_write_paths: Vec::new(),
        proxy_ports: Vec::new(),
        allow_local_binding: false,
        otel: None,
        real_user,
        mode: "full",
        // A full setup payload is still required to establish the provider's
        // qualified filesystem/process profile. Network availability is now
        // the contract requirement; the worker is not intentionally egress-
        // blocked by JARVIS.
        refresh_only: false,
    };
    let json = serde_json::to_vec(&payload).map_err(|_| {
        CodexCliSetupError::Payload("Codex sandbox setup payload could not be serialized")
    })?;
    Ok(vec![BASE64_STANDARD.encode(json)])
}

fn build_codex_windows_sandbox_setup_arguments(
    user_profile: &Path,
    working_directory: &Path,
) -> Result<Vec<String>, CodexCliSetupError> {
    let real_user = std::env::var("USERNAME")
        .map_err(|_| CodexCliSetupError::Payload("Windows USERNAME is unavailable"))?;
    build_codex_windows_sandbox_setup_arguments_for_user(user_profile, working_directory, real_user)
}

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
    pub sandbox_non_elevated_verified: bool,
    pub sandbox_sentinel_verified: bool,
    pub structured_exec_interface_verified: bool,
    pub workspace_write_verified: bool,
    pub outside_workspace_write_denied: bool,
    pub workspace_read_verified: bool,
    pub network_enabled_verified: bool,
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
    let user_profile = user_profile.into();
    let working_directory = working_directory.into();
    let release_root = user_profile
        .join(".codex")
        .join("packages")
        .join("standalone")
        .join("releases")
        .join("0.147.0-x86_64-pc-windows-msvc");
    let executable = release_root.join("bin").join("codex.exe");
    let helper = release_root
        .join("codex-resources")
        .join("codex-windows-sandbox-setup.exe");
    let spec = CodexCliProbeSpec::new(
        executable,
        working_directory.clone(),
        Duration::from_secs(300),
    )?;
    let setup_arguments =
        build_codex_windows_sandbox_setup_arguments(&user_profile, &working_directory)?;
    let plan = CodexCliSetupPlan::new(
        QUALIFIED_CODEX_DISTRIBUTION_ID.to_owned(),
        QUALIFIED_CODEX_INTERFACE_ID.to_owned(),
        setup_arguments,
        helper,
    )?;
    Ok((spec, plan))
}

#[derive(Debug)]
pub enum CodexCliSetupError {
    Probe(CodexCliProbeError),
    Privilege(PrivilegeMediatorError),
    SetupMarker(std::io::Error),
    Payload(&'static str),
}

impl Display for CodexCliSetupError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Probe(error) => Display::fmt(error, formatter),
            Self::Privilege(error) => Display::fmt(error, formatter),
            Self::SetupMarker(error) => {
                write!(
                    formatter,
                    "Codex sandbox setup marker could not be preserved: {error}"
                )
            }
            Self::Payload(message) => formatter.write_str(message),
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
    SandboxElevationNotQualified,
    SandboxTokenElevated,
    StructuredExecInterfaceMissing,
    WorkspaceWriteDenied,
    OutsideWorkspaceWriteAllowed,
    WorkspaceReadUnverified,
    NetworkAccessUnavailable,
    NetworkProbeInconclusive,
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
            Self::SandboxElevationNotQualified => {
                "Codex sandbox did not run under the qualified non-elevated identity"
            }
            Self::SandboxTokenElevated => {
                "Codex sandbox token was elevated or retained administrative authority"
            }
            Self::StructuredExecInterfaceMissing => {
                "Codex structured exec interface was not advertised"
            }
            Self::WorkspaceWriteDenied => {
                "Codex sandbox could not write inside the assigned workspace"
            }
            Self::OutsideWorkspaceWriteAllowed => {
                "Codex sandbox allowed a write outside the assigned workspace"
            }
            Self::WorkspaceReadUnverified => {
                "Codex sandbox could not read back an assigned-workspace result"
            }
            Self::NetworkAccessUnavailable => {
                "Codex delegated worker command network access was unavailable; the Codex host remains network-connected"
            }
            Self::NetworkProbeInconclusive => "Codex sandbox network availability probe was inconclusive",
        })
    }
}

impl std::error::Error for CodexCliProbeError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProbeKind {
    SandboxIdentity,
    SandboxGroups,
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
        ProbeKind::SandboxGroups => &[
            "sandbox", "--", "cmd", "/c", "whoami", "/groups", "/fo", "csv",
        ],
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

fn verify_non_elevated_groups(output: &str) -> bool {
    let has_medium_integrity = output.lines().any(|line| line.contains("S-1-16-8192"));
    let has_elevated_integrity = output
        .lines()
        .any(|line| line.contains("S-1-16-12288") || line.contains("S-1-16-16384"));
    let has_administrators_group = output.lines().any(|line| line.contains("S-1-5-32-544"));
    has_medium_integrity && !has_elevated_integrity && !has_administrators_group
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

fn codex_path_uri(path: &Path) -> String {
    let native = path.to_string_lossy().replace('\\', "/");
    let escaped = native
        .replace('%', "%25")
        .replace(' ', "%20")
        .replace('#', "%23")
        .replace('?', "%3F");
    format!("file:///{escaped}")
}

fn conformance_state_json(working_directory: &Path) -> Result<String, CodexCliProbeError> {
    let state = serde_json::json!({
        "permissionProfile": {
            "file_system": {
                "write": [working_directory.to_string_lossy()]
            },
            "network": { "enabled": true }
        },
        "codexLinuxSandboxExe": null,
        "sandboxCwd": codex_path_uri(working_directory),
        "useLegacyLandlock": false
    });
    serde_json::to_string(&state).map_err(|_| CodexCliProbeError::NonZeroExit)
}

fn run_sandbox_state_probe(
    spec: &CodexCliProbeSpec,
    state_json: &str,
    command: &[&str],
) -> Result<(ExitStatus, Vec<u8>, Vec<u8>), CodexCliProbeError> {
    let mut child = Command::new(spec.executable())
        .arg("sandbox")
        .arg("--sandbox-state-json")
        .arg(state_json)
        .arg("--")
        .args(command)
        .current_dir(&spec.working_directory)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| CodexCliProbeError::SpawnFailed)?;
    let deadline = Instant::now() + spec.timeout.min(Duration::from_secs(15));
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

fn home_path_for_probe() -> Result<PathBuf, CodexCliProbeError> {
    std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .ok_or(CodexCliProbeError::WorkingDirectoryUnavailable)
}

fn codex_setup_marker_path(user_profile: &Path) -> PathBuf {
    user_profile
        .join(".codex")
        .join(".sandbox")
        .join("setup_marker.json")
}

/// Preserve an existing provider marker before a user-authorized repair.
///
/// Codex version-5 markers can survive a partial firewall/WFP setup failure.
/// The provider then treats the marker as complete and only refreshes ACLs.
/// Moving the marker out of the way is the provider-documented recovery path:
/// the qualified helper recreates the marker only after full setup runs.
fn preserve_existing_codex_setup_marker(
    user_profile: &Path,
) -> Result<Option<PathBuf>, CodexCliSetupError> {
    let marker = codex_setup_marker_path(user_profile);
    if !marker.is_file() {
        return Ok(None);
    }

    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| CodexCliSetupError::Payload("setup marker timestamp is unavailable"))?
        .as_nanos();
    let backup = marker.with_file_name(format!("setup_marker.json.jarvis-previous-{unique}"));
    std::fs::rename(&marker, &backup).map_err(CodexCliSetupError::SetupMarker)?;
    Ok(Some(backup))
}

fn restore_codex_setup_marker_after_broker_failure(user_profile: &Path, backup: Option<&Path>) {
    let Some(backup) = backup else {
        return;
    };
    let marker = codex_setup_marker_path(user_profile);
    if !marker.exists() && backup.is_file() {
        let _ = std::fs::rename(backup, marker);
    }
}

fn run_workspace_conformance(
    spec: &CodexCliProbeSpec,
    sandbox_identity: &str,
) -> Result<(bool, bool, bool, bool), CodexCliProbeError> {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| CodexCliProbeError::NonZeroExit)?
        .as_nanos();
    let outside_parent = home_path_for_probe()?;
    let workspace = std::env::temp_dir().join(format!("jarvis-codex-conformance-{unique}"));
    std::fs::create_dir(&workspace).map_err(|_| CodexCliProbeError::WorkingDirectoryUnavailable)?;
    let outside = outside_parent.join(format!("jarvis-codex-conformance-{unique}.txt"));
    let state_json = conformance_state_json(&workspace)?;
    let inside_file = workspace.join("inside.txt");

    let result = (|| {
        let (status, _, _) = run_sandbox_state_probe(
            spec,
            &state_json,
            &["cmd", "/c", "echo JARVIS_CODEX_WORKSPACE_WRITE>inside.txt"],
        )?;
        if !status.success() || !inside_file.is_file() {
            return Err(CodexCliProbeError::WorkspaceWriteDenied);
        }
        let (status, stdout, _) =
            run_sandbox_state_probe(spec, &state_json, &["cmd", "/c", "type inside.txt"])?;
        let workspace_read_verified = status.success()
            && String::from_utf8_lossy(&stdout)
                .lines()
                .any(|line| line.trim() == "JARVIS_CODEX_WORKSPACE_WRITE");
        if !workspace_read_verified {
            return Err(CodexCliProbeError::WorkspaceReadUnverified);
        }

        let outside_text = outside.to_string_lossy().into_owned();
        let outside_command = format!("echo JARVIS_CODEX_OUTSIDE_WRITE>\"{outside_text}\"");
        let (outside_status, _, _) =
            run_sandbox_state_probe(spec, &state_json, &["cmd", "/c", outside_command.as_str()])?;
        let outside_workspace_write_denied = !outside_status.success() && !outside.is_file();
        if !outside_workspace_write_denied {
            return Err(CodexCliProbeError::OutsideWorkspaceWriteAllowed);
        }

        // This is an actual bounded HTTPS probe, not a host-side or
        // loopback-only check. Use the installed Node runtime instead of
        // curl.exe: the Codex restricted token can reach the internet, but
        // Windows Schannel credential acquisition fails for curl inside that
        // token and would make a healthy worker look network-disconnected.
        const NETWORK_PROBE_SCRIPT: &str = "fetch('https://example.com/').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(2))";
        let (network_status, network_stdout, network_stderr) =
            run_sandbox_state_probe(spec, &state_json, &["node.exe", "-e", NETWORK_PROBE_SCRIPT])?;
        if !network_status.success() {
            let network_diagnostics = format!(
                "{}{}",
                String::from_utf8_lossy(&network_stdout),
                String::from_utf8_lossy(&network_stderr)
            );
            if network_diagnostics.contains("not recognized")
                || network_diagnostics.contains("cannot find")
                || sandbox_identity.is_empty()
            {
                return Err(CodexCliProbeError::NetworkProbeInconclusive);
            }
            return Err(CodexCliProbeError::NetworkAccessUnavailable);
        }

        Ok((
            true,
            outside_workspace_write_denied,
            workspace_read_verified,
            true,
        ))
    })();
    let _ = std::fs::remove_file(&inside_file);
    let _ = std::fs::remove_dir(&workspace);
    let _ = std::fs::remove_file(&outside);
    result
}

/// Run the JARVIS-owned non-elevated provider readiness and sandbox probe.
/// A successful helper/setup process is never treated as readiness evidence
/// by itself; all independent identity, token, filesystem, and network
/// conformance observations are required.
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
    if !sandbox_identity
        .rsplit_once('\\')
        .is_some_and(|(_, user)| user.eq_ignore_ascii_case("codexsandboxoffline"))
    {
        return Err(CodexCliProbeError::SandboxElevationNotQualified);
    }
    let groups = successful_output(spec, ProbeKind::SandboxGroups)?;
    if !verify_non_elevated_groups(&groups) {
        return Err(CodexCliProbeError::SandboxTokenElevated);
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
    let (
        workspace_write_verified,
        outside_workspace_write_denied,
        workspace_read_verified,
        network_enabled_verified,
    ) = run_workspace_conformance(spec, &sandbox_identity)?;
    Ok(CodexCliProbeResult {
        executable,
        sandbox_identity,
        sandbox_non_elevated_verified: true,
        sandbox_sentinel_verified: true,
        structured_exec_interface_verified: true,
        workspace_write_verified,
        outside_workspace_write_denied,
        workspace_read_verified,
        network_enabled_verified,
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
    let user_profile = home_path_for_probe()?;
    let marker_backup = preserve_existing_codex_setup_marker(&user_profile)?;
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
    if let Err(error) = broker.invoke_provider_setup_repair(arguments) {
        restore_codex_setup_marker_after_broker_failure(&user_profile, marker_backup.as_deref());
        return Err(error.into());
    }
    Ok(probe_codex_cli(spec)?)
}

#[cfg(test)]
mod tests {
    use super::{
        CodexCliProbeError, CodexCliProbeSpec, CodexCliSetupPlan,
        build_codex_windows_sandbox_setup_arguments_for_user,
    };
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
    use serde_json::Value;
    use std::path::Path;
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
        assert!(
            CodexCliSetupPlan::new(
                "codex-private".to_owned(),
                "codex-structured-v1".to_owned(),
                vec!["--repair\0".to_owned()],
                "C:\\codex-windows-sandbox-setup.exe",
            )
            .is_err()
        );
    }

    #[test]
    fn setup_payload_matches_codex_windows_helper_contract() {
        let arguments = build_codex_windows_sandbox_setup_arguments_for_user(
            Path::new(r"C:\Users\test-user"),
            Path::new(r"G:\Jarvis Project\target\x86_64-pc-windows-msvc\release"),
            "test-user".to_owned(),
        )
        .expect("qualified setup payload must build");
        assert_eq!(arguments.len(), 1);
        assert_ne!(arguments[0], "--repair");

        let payload = BASE64_STANDARD
            .decode(&arguments[0])
            .expect("setup argument must be standard base64");
        let payload: Value =
            serde_json::from_slice(&payload).expect("setup argument must contain JSON payload");
        assert_eq!(payload["version"], 5);
        assert_eq!(payload["offline_username"], "CodexSandboxOffline");
        assert_eq!(payload["online_username"], "CodexSandboxOnline");
        assert_eq!(payload["codex_home"], r"C:\Users\test-user\.codex");
        assert_eq!(
            payload["command_cwd"],
            r"G:\Jarvis Project\target\x86_64-pc-windows-msvc\release"
        );
        assert_eq!(payload["real_user"], "test-user");
        assert_eq!(payload["mode"], "full");
        assert_eq!(payload["refresh_only"], false);
        assert!(
            CodexCliSetupPlan::new(
                "codex-cli-standalone-windows-x64-0.147.0".to_owned(),
                "codex-structured-v1".to_owned(),
                arguments,
                r"C:\codex-windows-sandbox-setup.exe",
            )
            .is_ok()
        );
    }

    #[test]
    fn conformance_state_is_workspace_scoped_and_network_enabled() {
        let state: Value = serde_json::from_str(
            &super::conformance_state_json(Path::new(r"G:\Jarvis Project\target\probe"))
                .expect("conformance state must serialize"),
        )
        .expect("conformance state must be valid JSON");
        assert_eq!(
            state["permissionProfile"]["file_system"]["write"][0],
            r"G:\Jarvis Project\target\probe"
        );
        assert_eq!(state["permissionProfile"]["network"]["enabled"], true);
        assert_eq!(state["useLegacyLandlock"], false);
    }

    #[test]
    fn setup_marker_path_is_provider_owned_and_not_workspace_relative() {
        assert_eq!(
            super::codex_setup_marker_path(Path::new(r"C:\Users\test-user")),
            Path::new(r"C:\Users\test-user\.codex\.sandbox\setup_marker.json")
        );
    }

    #[test]
    fn non_elevated_group_probe_requires_medium_integrity_without_admin_sid() {
        let standard = r#"
"Group Name","Type","SID","Attributes"
"BUILTIN\Users","Alias","S-1-5-32-545","Enabled group"
"Mandatory Label\Medium Mandatory Level","Label","S-1-16-8192",""
"#;
        assert!(super::verify_non_elevated_groups(standard));

        let elevated = standard.replace("S-1-16-8192", "S-1-16-12288");
        assert!(!super::verify_non_elevated_groups(&elevated));

        let administrator = format!(
            "{standard}\n\"BUILTIN\\Administrators\",\"Alias\",\"S-1-5-32-544\",\"Enabled group\""
        );
        assert!(!super::verify_non_elevated_groups(&administrator));
    }

    #[test]
    fn network_failure_names_the_worker_boundary_without_claiming_host_disconnect() {
        assert_eq!(
            CodexCliProbeError::NetworkAccessUnavailable.to_string(),
            "Codex delegated worker command network access was unavailable; the Codex host remains network-connected"
        );
    }

    #[test]
    #[ignore = "requires the installed qualified Codex CLI and a live Windows sandbox"]
    fn live_qualified_codex_probe_must_pass_all_workspace_gates() {
        let user_profile = std::env::var_os("USERPROFILE")
            .map(std::path::PathBuf::from)
            .expect("USERPROFILE is required for the live qualification probe");
        let working_directory = std::env::current_dir().expect("current directory is required");
        let (spec, _) = super::discover_qualified_codex_setup(user_profile, working_directory)
            .expect("qualified Codex CLI must be discoverable");
        let result = super::probe_codex_cli(&spec).expect("Codex sandbox conformance must pass");
        assert!(result.sandbox_non_elevated_verified);
        assert!(result.sandbox_sentinel_verified);
        assert!(result.structured_exec_interface_verified);
        assert!(result.workspace_write_verified);
        assert!(result.outside_workspace_write_denied);
        assert!(result.workspace_read_verified);
        assert!(result.network_enabled_verified);
    }
}
