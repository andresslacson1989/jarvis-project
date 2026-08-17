//! Bounded Windows project/file opening.
//!
//! Application launching remains intentionally unqualified because the
//! contract does not provide an application allowlist. This module exposes
//! only Explorer-backed operations for a Core-registered workspace.

use crate::path_identity::{PlatformPathsAndIdentity, RegisteredWorkspace};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::process::{Command, Stdio};

#[derive(Debug)]
pub enum OpenTargetError {
    Invalid,
    TargetUnavailable,
    LaunchFailed,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorkspaceArguments {
    project_id: String,
    workspace_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FileArguments {
    project_id: String,
    workspace_id: String,
    relative_path: String,
}

pub fn open_project(registration: &RegisteredWorkspace, arguments: Value) -> Result<Value, OpenTargetError> {
    let input: WorkspaceArguments = serde_json::from_value(arguments).map_err(|_| OpenTargetError::Invalid)?;
    ensure_identity(registration, &input.project_id, &input.workspace_id)?;
    launch_explorer(&registration.root_identity().canonical_path, None)?;
    Ok(json!({
        "targetKind": "PROJECT",
        "targetIdentity": identity("project", registration.root_identity().case_insensitive_key.as_bytes()),
        "state": "OPEN_REQUESTED",
    }))
}

pub fn open_file(
    backend: &PlatformPathsAndIdentity,
    registration: &RegisteredWorkspace,
    arguments: Value,
) -> Result<Value, OpenTargetError> {
    let input: FileArguments = serde_json::from_value(arguments).map_err(|_| OpenTargetError::Invalid)?;
    ensure_identity(registration, &input.project_id, &input.workspace_id)?;
    let target = backend
        .resolve_workspace_target(&registration.root_identity().canonical_path, &input.relative_path, false)
        .map_err(|_| OpenTargetError::TargetUnavailable)?;
    launch_explorer(&target.target.canonical_path, Some(&target.target.canonical_path))?;
    Ok(json!({
        "targetKind": "FILE",
        "targetIdentity": identity("file", target.target.case_insensitive_key.as_bytes()),
        "state": "OPEN_REQUESTED",
    }))
}

fn ensure_identity(registration: &RegisteredWorkspace, project_id: &str, workspace_id: &str) -> Result<(), OpenTargetError> {
    if project_id == registration.project_id() && workspace_id == registration.workspace_id() {
        Ok(())
    } else {
        Err(OpenTargetError::Invalid)
    }
}

fn launch_explorer(target: &std::path::Path, selected_file: Option<&std::path::Path>) -> Result<(), OpenTargetError> {
    let mut command = Command::new("explorer.exe");
    if let Some(file) = selected_file {
        command.arg(format!("/select,{}", file.display()));
    } else {
        command.arg(target);
    }
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|_| OpenTargetError::LaunchFailed)
}

fn identity(prefix: &str, value: &[u8]) -> String {
    let digest = Sha256::digest(value);
    let hex = digest.iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    format!("{prefix}-{hex}")
}
