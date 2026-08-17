//! Bounded, read-only Git inspection for an already registered workspace.
//!
//! This module deliberately exposes no generic command runner. Every Git
//! invocation uses a fixed executable name, fixed subcommands/options, a
//! registered workspace as its current directory, no inherited stdin, and a
//! bounded timeout/output budget.

use crate::path_identity::{PlatformPathsAndIdentity, RegisteredWorkspace};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const GIT_TIMEOUT: Duration = Duration::from_secs(15);
const MAX_COMMAND_OUTPUT: usize = 8 * 1024 * 1024;
const MAX_ERROR_OUTPUT: usize = 64 * 1024;

#[derive(Debug)]
pub enum GitReadError {
    Invalid(String),
    Unavailable(String),
    Failed(String),
    TimedOut,
}

impl std::fmt::Display for GitReadError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Invalid(message) => write!(formatter, "invalid Git request: {message}"),
            Self::Unavailable(message) => write!(formatter, "Git is unavailable: {message}"),
            Self::Failed(message) => write!(formatter, "Git inspection failed: {message}"),
            Self::TimedOut => formatter.write_str("Git inspection timed out"),
        }
    }
}

impl std::error::Error for GitReadError {}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GitArguments {
    operation: String,
    project_id: String,
    workspace_id: String,
    max_entries: Option<usize>,
    max_bytes: Option<usize>,
}

#[derive(Debug)]
struct GitCommandOutput {
    status: Option<i32>,
    stdout: Vec<u8>,
}

pub fn read_git(
    backend: &PlatformPathsAndIdentity,
    registration: &RegisteredWorkspace,
    arguments: Value,
) -> Result<Value, GitReadError> {
    let input: GitArguments = serde_json::from_value(arguments)
        .map_err(|_| GitReadError::Invalid("Git arguments are invalid".to_owned()))?;
    if input.project_id != registration.project_id()
        || input.workspace_id != registration.workspace_id()
    {
        return Err(GitReadError::Invalid(
            "Git workspace identity does not match the binding".to_owned(),
        ));
    }
    let (workspace_root, repository_root) = resolve_repository(backend, registration)?;
    let workspace_identity = stable_identity(
        "workspace",
        registration.root_identity().case_insensitive_key.as_bytes(),
    );
    let repository_identity =
        stable_identity("repository", repository_root.to_string_lossy().as_bytes());
    let branch = read_branch_name(&workspace_root)?;
    let head_commit = read_head_commit(&workspace_root);
    let observed_at = utc_now();

    match input.operation.as_str() {
        "STATUS" => {
            let max_entries = bounded_entries(input.max_entries)?;
            let (entries, truncated) = read_status(&workspace_root, max_entries)?;
            Ok(json!({
                "operation": "STATUS",
                "projectId": input.project_id,
                "workspaceId": input.workspace_id,
                "workspaceIdentity": workspace_identity,
                "repositoryIdentity": repository_identity,
                "branch": branch,
                "headCommit": head_commit,
                "entries": entries,
                "truncated": truncated,
                "observedAt": observed_at,
            }))
        }
        "BRANCH" => {
            let (upstream, ahead, behind) = read_upstream(&workspace_root)?;
            Ok(json!({
                "operation": "BRANCH",
                "projectId": input.project_id,
                "workspaceId": input.workspace_id,
                "workspaceIdentity": workspace_identity,
                "repositoryIdentity": repository_identity,
                "branch": branch,
                "headCommit": head_commit,
                "upstream": upstream,
                "ahead": ahead,
                "behind": behind,
                "observedAt": observed_at,
            }))
        }
        "DIFF" => {
            let max_bytes = bounded_diff_bytes(input.max_bytes)?;
            let output = run_git(
                &workspace_root,
                &[
                    "-c",
                    "core.pager=cat",
                    "diff",
                    "--no-ext-diff",
                    "--no-textconv",
                    "--no-color",
                    "--no-renames",
                    "--",
                ],
                max_bytes,
            )?;
            let patch = String::from_utf8(output.stdout)
                .map_err(|_| GitReadError::Failed("Git diff was not valid UTF-8".to_owned()))?;
            let bytes = patch.as_bytes().len();
            Ok(json!({
                "operation": "DIFF",
                "projectId": input.project_id,
                "workspaceId": input.workspace_id,
                "workspaceIdentity": workspace_identity,
                "repositoryIdentity": repository_identity,
                "patch": patch,
                "bytes": bytes,
                "truncated": false,
                "observedAt": observed_at,
            }))
        }
        "LOG" => {
            let max_entries = bounded_entries(input.max_entries)?;
            let max_bytes = bounded_log_bytes(input.max_bytes)?;
            let count = max_entries.to_string();
            let output = run_git(
                &workspace_root,
                &[
                    "-c",
                    "core.pager=cat",
                    "log",
                    "--no-decorate",
                    "--no-color",
                    "--format=%H%x00%an%x00%aI%x00%s%x00",
                    "-n",
                    &count,
                ],
                max_bytes,
            )?;
            let (entries, bytes, truncated) = parse_log(&output.stdout, max_entries, max_bytes)?;
            Ok(json!({
                "operation": "LOG",
                "projectId": input.project_id,
                "workspaceId": input.workspace_id,
                "workspaceIdentity": workspace_identity,
                "repositoryIdentity": repository_identity,
                "entries": entries,
                "bytes": bytes,
                "truncated": truncated,
                "observedAt": observed_at,
            }))
        }
        _ => Err(GitReadError::Invalid(
            "unsupported Git operation".to_owned(),
        )),
    }
}

fn bounded_entries(value: Option<usize>) -> Result<usize, GitReadError> {
    match value {
        Some(value) if (1..=4096).contains(&value) => Ok(value),
        _ => Err(GitReadError::Invalid("maxEntries is invalid".to_owned())),
    }
}

fn bounded_diff_bytes(value: Option<usize>) -> Result<usize, GitReadError> {
    match value {
        Some(value) if (1..=4_194_304).contains(&value) => Ok(value),
        _ => Err(GitReadError::Invalid("maxBytes is invalid".to_owned())),
    }
}

fn bounded_log_bytes(value: Option<usize>) -> Result<usize, GitReadError> {
    match value {
        Some(value) if (1..=1_048_576).contains(&value) => Ok(value),
        _ => Err(GitReadError::Invalid("maxBytes is invalid".to_owned())),
    }
}

fn resolve_repository(
    backend: &PlatformPathsAndIdentity,
    registration: &RegisteredWorkspace,
) -> Result<(std::path::PathBuf, std::path::PathBuf), GitReadError> {
    let workspace_root = registration.root_identity().canonical_path.clone();
    let output = run_git(
        &workspace_root,
        &["rev-parse", "--show-toplevel"],
        16 * 1024,
    )?;
    let root_text = text_line(&output.stdout)?;
    let repository = backend
        .resolve_project_root(Path::new(root_text))
        .map_err(|_| {
            GitReadError::Failed("Git repository root could not be identity-checked".to_owned())
        })?;
    if repository.case_insensitive_key != registration.root_identity().case_insensitive_key {
        return Err(GitReadError::Failed(
            "Git repository root does not match the bound workspace".to_owned(),
        ));
    }
    Ok((workspace_root, repository.canonical_path))
}

fn read_branch_name(root: &Path) -> Result<String, GitReadError> {
    let output = run_git_allow_failure(root, &["symbolic-ref", "--short", "-q", "HEAD"], 4096)?;
    if output.status != Some(0) {
        return Ok("DETACHED".to_owned());
    }
    let branch = text_line(&output.stdout).unwrap_or("DETACHED").to_owned();
    if branch.is_empty()
        || branch.len() > 1024
        || branch
            .bytes()
            .any(|byte| byte == 0 || byte == b'\r' || byte == b'\n')
    {
        return Err(GitReadError::Failed(
            "Git branch identity is invalid".to_owned(),
        ));
    }
    Ok(branch)
}

fn read_head_commit(root: &Path) -> String {
    match run_git(root, &["rev-parse", "--verify", "HEAD"], 4096)
        .ok()
        .and_then(|output| text_line(&output.stdout).ok().map(str::to_owned))
    {
        Some(commit)
            if commit.len() >= 40
                && commit.len() <= 64
                && commit.bytes().all(|byte| byte.is_ascii_hexdigit()) =>
        {
            commit
        }
        _ => "UNBORN".to_owned(),
    }
}

fn read_upstream(root: &Path) -> Result<(String, u64, u64), GitReadError> {
    let upstream = run_git_allow_failure(
        root,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
        4096,
    )
    .ok()
    .filter(|output| output.status == Some(0))
    .and_then(|output| text_line(&output.stdout).ok().map(str::to_owned));
    let Some(upstream) = upstream.filter(|value| !value.is_empty()) else {
        return Ok(("NONE".to_owned(), 0, 0));
    };
    let counts = run_git(
        root,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
        4096,
    )?;
    let values: Vec<u64> = text_line(&counts.stdout)
        .unwrap_or("")
        .split_whitespace()
        .map(|value| {
            value
                .parse::<u64>()
                .map_err(|_| GitReadError::Failed("Git divergence counts are invalid".to_owned()))
        })
        .collect::<Result<_, _>>()?;
    if values.len() != 2 {
        return Err(GitReadError::Failed(
            "Git divergence counts are invalid".to_owned(),
        ));
    }
    Ok((upstream, values[0], values[1]))
}

fn read_status(root: &Path, max_entries: usize) -> Result<(Vec<Value>, bool), GitReadError> {
    let output = run_git(
        root,
        &[
            "-c",
            "core.quotepath=false",
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
        ],
        MAX_COMMAND_OUTPUT,
    )?;
    let mut entries = Vec::new();
    let mut records = output.stdout.split(|byte| *byte == 0);
    let mut truncated = false;
    while let Some(record) = records.next() {
        if record.is_empty() {
            continue;
        }
        if record.len() < 4 || record[2] != b' ' {
            return Err(GitReadError::Failed(
                "Git status record is invalid".to_owned(),
            ));
        }
        let index_state = status_state(record[0]);
        let worktree_state = status_state(record[1]);
        let mut path = &record[3..];
        if matches!(record[0], b'R' | b'C') || matches!(record[1], b'R' | b'C') {
            path = records.next().ok_or_else(|| {
                GitReadError::Failed("Git rename record is incomplete".to_owned())
            })?;
        }
        if entries.len() == max_entries {
            truncated = true;
            break;
        }
        let path = std::str::from_utf8(path)
            .map_err(|_| GitReadError::Failed("Git status path is not UTF-8".to_owned()))?;
        if path.is_empty() || path.contains('\0') || path.split('/').any(|part| part == "..") {
            return Err(GitReadError::Failed(
                "Git status path escaped the workspace".to_owned(),
            ));
        }
        entries.push(json!({ "path": path.replace('\\', "/"), "indexState": index_state, "worktreeState": worktree_state }));
    }
    Ok((entries, truncated))
}

fn status_state(value: u8) -> &'static str {
    match value {
        b' ' => "CLEAN",
        b'A' => "ADDED",
        b'M' => "MODIFIED",
        b'D' => "DELETED",
        b'R' => "RENAMED",
        b'C' => "COPIED",
        b'U' => "UNMERGED",
        b'?' => "UNTRACKED",
        b'!' => "IGNORED",
        b'T' => "TYPE_CHANGED",
        _ => "UNKNOWN",
    }
}

fn parse_log(
    stdout: &[u8],
    max_entries: usize,
    max_bytes: usize,
) -> Result<(Vec<Value>, usize, bool), GitReadError> {
    let mut entries = Vec::new();
    let mut fields = stdout.split(|byte| *byte == 0);
    while entries.len() < max_entries {
        let Some(commit) = fields.next() else { break };
        if commit.is_empty() {
            break;
        }
        let author = fields
            .next()
            .ok_or_else(|| GitReadError::Failed("Git log record is incomplete".to_owned()))?;
        let authored_at = fields
            .next()
            .ok_or_else(|| GitReadError::Failed("Git log record is incomplete".to_owned()))?;
        let subject = fields
            .next()
            .ok_or_else(|| GitReadError::Failed("Git log record is incomplete".to_owned()))?;
        let commit = text_utf8(commit)?;
        let author = text_utf8(author)?;
        let authored_at = text_utf8(authored_at)?;
        let subject = text_utf8(subject)?;
        if commit.len() < 40
            || commit.len() > 64
            || !commit.bytes().all(|byte| byte.is_ascii_hexdigit())
            || author.is_empty()
            || authored_at.is_empty()
            || subject.is_empty()
        {
            return Err(GitReadError::Failed("Git log record is invalid".to_owned()));
        }
        entries.push(json!({ "commit": commit, "author": author, "authoredAt": authored_at, "subject": subject }));
    }
    let truncated =
        entries.len() == max_entries && fields.next().is_some_and(|value| !value.is_empty());
    Ok((entries, stdout.len().min(max_bytes), truncated))
}

fn run_git(
    root: &Path,
    arguments: &[&str],
    max_output: usize,
) -> Result<GitCommandOutput, GitReadError> {
    let output = run_git_allow_failure(root, arguments, max_output)?;
    if output.status != Some(0) {
        return Err(GitReadError::Failed(
            "Git returned a non-success result".to_owned(),
        ));
    }
    Ok(output)
}

fn run_git_allow_failure(
    root: &Path,
    arguments: &[&str],
    max_output: usize,
) -> Result<GitCommandOutput, GitReadError> {
    let mut command = Command::new("git.exe");
    command
        .current_dir(root)
        .args(arguments)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|_| GitReadError::Unavailable("git.exe could not be started".to_owned()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| GitReadError::Unavailable("Git stdout was not available".to_owned()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| GitReadError::Unavailable("Git stderr was not available".to_owned()))?;
    let stdout_thread = thread::spawn(move || read_bounded(stdout, max_output));
    let stderr_thread = thread::spawn(move || read_bounded(stderr, MAX_ERROR_OUTPUT));
    let deadline = Instant::now() + GIT_TIMEOUT;
    let status = loop {
        match child
            .try_wait()
            .map_err(|_| GitReadError::Failed("Git process status could not be read".to_owned()))?
        {
            Some(status) => break Some(status.code().unwrap_or(-1)),
            None if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_thread.join();
                let _ = stderr_thread.join();
                return Err(GitReadError::TimedOut);
            }
            None => thread::sleep(Duration::from_millis(10)),
        }
    };
    let stdout = stdout_thread
        .join()
        .map_err(|_| GitReadError::Failed("Git stdout reader failed".to_owned()))??;
    let _stderr = stderr_thread
        .join()
        .map_err(|_| GitReadError::Failed("Git stderr reader failed".to_owned()))??;
    let output = GitCommandOutput { status, stdout };
    if output.stdout.len() > max_output {
        return Err(GitReadError::Failed(
            "Git output exceeded the bounded limit".to_owned(),
        ));
    }
    Ok(output)
}

fn read_bounded<R: Read>(reader: R, limit: usize) -> Result<Vec<u8>, GitReadError> {
    let mut output = Vec::new();
    reader
        .take((limit + 1) as u64)
        .read_to_end(&mut output)
        .map_err(|_| GitReadError::Failed("Git output could not be read".to_owned()))?;
    Ok(output)
}

fn text_line(bytes: &[u8]) -> Result<&str, GitReadError> {
    let text = std::str::from_utf8(bytes)
        .map_err(|_| GitReadError::Failed("Git output is not UTF-8".to_owned()))?;
    Ok(text.trim_end_matches(['\r', '\n']))
}

fn text_utf8(bytes: &[u8]) -> Result<String, GitReadError> {
    Ok(std::str::from_utf8(bytes)
        .map_err(|_| GitReadError::Failed("Git output is not UTF-8".to_owned()))?
        .to_owned())
}

fn stable_identity(prefix: &str, value: &[u8]) -> String {
    let digest = Sha256::digest(value);
    let hex = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("{prefix}-{hex}")
}

fn utc_now() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = seconds / 86_400;
    let day_seconds = seconds % 86_400;
    let (year, month, day) = civil_from_days(days as i64);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.000Z",
        day_seconds / 3600,
        (day_seconds % 3600) / 60,
        day_seconds % 60
    )
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    (year + if month <= 2 { 1 } else { 0 }, month, day)
}
