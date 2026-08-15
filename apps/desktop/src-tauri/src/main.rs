#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(test)]
mod authority_vectors;
#[cfg(test)]
mod backup_vectors;
pub mod core_runtime;
#[path = "../../../../platform/windows/src/kdf.rs"]
pub mod kdf;
mod lifecycle;
#[path = "../../../../platform/windows/src/local_ipc.rs"]
pub mod local_ipc;
#[path = "../../../../platform/windows/src/native_broker.rs"]
pub mod native_broker;
#[path = "../../../../platform/windows/src/path_identity.rs"]
pub mod path_identity;
mod platform;
#[path = "../../../../platform/windows/src/privilege_mediator.rs"]
pub mod privilege_mediator;
#[path = "../../../../platform/windows/src/process_supervisor.rs"]
pub mod process_supervisor;
#[path = "../../../../platform/windows/src/provider_qualification.rs"]
pub mod provider_qualification;
#[path = "../../../../platform/windows/src/secure_storage.rs"]
pub mod secure_storage;
#[path = "../../../../platform/windows/src/session_system.rs"]
pub mod session_system;
mod ui_boundary;
#[path = "../../../../platform/windows/src/window_controller.rs"]
pub mod window_controller;

#[cfg(not(debug_assertions))]
use std::sync::Mutex;
#[cfg(any(not(debug_assertions), test))]
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
#[cfg(not(debug_assertions))]
use std::time::Duration;
#[cfg(not(debug_assertions))]
use tauri::Manager;
use serde::{Deserialize, Serialize};
use tauri::{Url, WebviewUrl};

#[cfg(not(debug_assertions))]
#[allow(dead_code)]
struct HostRuntime {
    local_ipc: Mutex<local_ipc::NamedPipeServer>,
    native_broker: Mutex<native_broker::WindowsNativeBroker>,
    _secure_storage_runtime: SecureStorageProtectionRuntime,
    process_supervisor: process_supervisor::PlatformProcessSupervisor,
    core_process: process_supervisor::SupervisedCoreProcess,
    authenticated: local_ipc::AuthenticatedCoreSession,
    core_status: local_ipc::AuthenticatedCoreStatus,
    _db_dek_handle: secure_storage::SecureStorageHandle,
    _db_dek: secure_storage::DatabaseDek,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProviderSetupStartCommandRequest {
    request_id: String,
    provider_id: String,
    distribution_id: String,
    adapter_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderSetupStartCommandResponse {
    request_id: String,
    state: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderSetupStatusCommandRecord {
    provider_id: String,
    distribution_id: String,
    adapter_version: String,
    state: String,
    sanitized_failure_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionStatusCommandResponse {
    initialized: bool,
    state: Option<SessionSecurityStateCommandRecord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionSecurityStateCommandRecord {
    user_id: String,
    state: String,
    session_id: Option<String>,
    unlocked_at: Option<String>,
    locked_reason: Option<String>,
    failed_unlock_attempts: u32,
    cooldown_until: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SessionPasswordCommandRequest {
    password: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionAuthenticationCommandResponse {
    status: String,
    retry_after_ms: u64,
    state: SessionSecurityStateCommandRecord,
}

#[cfg(not(debug_assertions))]
#[tauri::command]
fn start_provider_setup(
    state: tauri::State<'_, HostRuntime>,
    request: ProviderSetupStartCommandRequest,
) -> Result<ProviderSetupStartCommandResponse, String> {
    let local_ipc = state
        .local_ipc
        .lock()
        .map_err(|_| "CORE_IPC_LOCK_FAILED".to_owned())?;
    let start_request_id = request.request_id.clone();
    let start_provider_id = request.provider_id.clone();
    let _start_response = local_ipc
        .request_provider_setup_start(
            &state.authenticated,
            local_ipc::ProviderSetupStartRequest {
                request_id: start_request_id.clone(),
                provider_id: start_provider_id.clone(),
                distribution_id: request.distribution_id,
                adapter_version: request.adapter_version,
            },
        )
        .map_err(|error| format!("{:?}", error.state))?;
    let user_profile = std::env::var_os("USERPROFILE").ok_or_else(|| "CODEX_USER_PROFILE_MISSING".to_owned())?;
    let working_directory = std::env::current_dir().map_err(|_| "CODEX_WORKING_DIRECTORY_MISSING".to_owned())?;
    let (probe_spec, setup_plan) = match provider_qualification::discover_qualified_codex_setup(user_profile, working_directory) {
        Ok(value) => value,
        Err(error) => {
            let _ = local_ipc.request_provider_setup_probe_failed(&state.authenticated, start_request_id, start_provider_id);
            return Err(error.to_string());
        }
    };
    let setup_result = {
        let mut broker = state.native_broker.lock().map_err(|_| "NATIVE_BROKER_LOCK_FAILED".to_owned())?;
        provider_qualification::run_authenticated_codex_setup(&mut broker, &probe_spec, &setup_plan)
    };
    if let Err(error) = setup_result {
        let _ = local_ipc.request_provider_setup_probe_failed(&state.authenticated, start_request_id, start_provider_id);
        return Err(error.to_string());
    }
    let ready = local_ipc
        .request_provider_setup_probe_passed(&state.authenticated, start_request_id, start_provider_id)
        .map_err(|error| format!("{:?}", error.state))?;
    Ok(ProviderSetupStartCommandResponse {
        request_id: ready.request_id,
        state: ready.state,
    })
}

#[cfg(not(debug_assertions))]
#[tauri::command]
fn get_provider_setup_status(
    state: tauri::State<'_, HostRuntime>,
) -> Result<Vec<ProviderSetupStatusCommandRecord>, String> {
    let local_ipc = state.local_ipc.lock().map_err(|_| "CORE_IPC_LOCK_FAILED".to_owned())?;
    local_ipc.request_provider_setup_status(&state.authenticated)
        .map(|records| records.into_iter().map(|record| ProviderSetupStatusCommandRecord {
            provider_id: record.provider_id,
            distribution_id: record.distribution_id,
            adapter_version: record.adapter_version,
            state: record.state,
            sanitized_failure_reason: record.sanitized_failure_reason,
        }).collect())
        .map_err(|error| format!("{:?}", error.state))
}

#[cfg(not(debug_assertions))]
#[tauri::command]
fn get_session_status(
    state: tauri::State<'_, HostRuntime>,
) -> Result<SessionStatusCommandResponse, String> {
    let local_ipc = state.local_ipc.lock().map_err(|_| "CORE_IPC_LOCK_FAILED".to_owned())?;
    local_ipc.request_session_status(&state.authenticated)
        .map(|status| SessionStatusCommandResponse {
            initialized: status.initialized,
            state: status.state.map(|value| SessionSecurityStateCommandRecord {
                user_id: value.user_id,
                state: value.state,
                session_id: value.session_id,
                unlocked_at: value.unlocked_at,
                locked_reason: value.locked_reason,
                failed_unlock_attempts: value.failed_unlock_attempts,
                cooldown_until: value.cooldown_until,
            }),
        })
        .map_err(|error| format!("{:?}", error.state))
}

#[cfg(not(debug_assertions))]
#[tauri::command]
fn initialize_session(
    state: tauri::State<'_, HostRuntime>,
    request: SessionPasswordCommandRequest,
) -> Result<SessionStatusCommandResponse, String> {
    let mut password = request.password.into_bytes();
    let result = match state.local_ipc.lock() {
        Ok(local_ipc) => local_ipc
            .request_session_initialize(&state.authenticated, password.clone())
            .map(|status| SessionStatusCommandResponse {
                initialized: status.initialized,
                state: status.state.map(|value| SessionSecurityStateCommandRecord {
                    user_id: value.user_id,
                    state: value.state,
                    session_id: value.session_id,
                    unlocked_at: value.unlocked_at,
                    locked_reason: value.locked_reason,
                    failed_unlock_attempts: value.failed_unlock_attempts,
                    cooldown_until: value.cooldown_until,
                }),
            })
            .map_err(|error| format!("{:?}", error.state)),
        Err(_) => Err("CORE_IPC_LOCK_FAILED".to_owned()),
    };
    password.fill(0);
    result
}

#[cfg(not(debug_assertions))]
#[tauri::command]
fn authenticate_session(
    state: tauri::State<'_, HostRuntime>,
    request: SessionPasswordCommandRequest,
) -> Result<SessionAuthenticationCommandResponse, String> {
    let mut password = request.password.into_bytes();
    let result = match state.local_ipc.lock() {
        Ok(local_ipc) => local_ipc
            .request_session_authenticate(&state.authenticated, password.clone())
            .map(|result| SessionAuthenticationCommandResponse {
                status: result.status,
                retry_after_ms: result.retry_after_ms,
                state: SessionSecurityStateCommandRecord {
                    user_id: result.state.user_id,
                    state: result.state.state,
                    session_id: result.state.session_id,
                    unlocked_at: result.state.unlocked_at,
                    locked_reason: result.state.locked_reason,
                    failed_unlock_attempts: result.state.failed_unlock_attempts,
                    cooldown_until: result.state.cooldown_until,
                },
            })
            .map_err(|error| format!("{:?}", error.state)),
        Err(_) => Err("CORE_IPC_LOCK_FAILED".to_owned()),
    };
    password.fill(0);
    result
}

#[cfg(debug_assertions)]
#[tauri::command]
fn start_provider_setup(
    _request: ProviderSetupStartCommandRequest,
) -> Result<ProviderSetupStartCommandResponse, String> {
    Err("CORE_IPC_NOT_READY".to_owned())
}

#[cfg(debug_assertions)]
#[tauri::command]
fn get_provider_setup_status() -> Result<Vec<ProviderSetupStatusCommandRecord>, String> {
    Err("CORE_IPC_NOT_READY".to_owned())
}

#[cfg(debug_assertions)]
#[tauri::command]
fn get_session_status() -> Result<SessionStatusCommandResponse, String> {
    Err("CORE_IPC_NOT_READY".to_owned())
}

#[cfg(debug_assertions)]
#[tauri::command]
fn initialize_session(_request: SessionPasswordCommandRequest) -> Result<SessionStatusCommandResponse, String> {
    Err("CORE_IPC_NOT_READY".to_owned())
}

#[cfg(debug_assertions)]
#[tauri::command]
fn authenticate_session(_request: SessionPasswordCommandRequest) -> Result<SessionAuthenticationCommandResponse, String> {
    Err("CORE_IPC_NOT_READY".to_owned())
}

#[cfg(any(not(debug_assertions), test))]
struct SecureStorageProtectionRuntime {
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}

#[cfg(any(not(debug_assertions), test))]
impl SecureStorageProtectionRuntime {
    fn start(
        server: local_ipc::NamedPipeServer,
        storage: native_broker::WindowsSecureStorageBoundary,
        handle_path: std::path::PathBuf,
    ) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let thread_stop = Arc::clone(&stop);
        let thread = std::thread::spawn(move || {
            while !thread_stop.load(Ordering::Acquire) {
                let session = match server.authenticate_client() {
                    Ok(session) => session,
                    Err(error) if error.state == local_ipc::LocalIpcState::HandshakeTimeout => {
                        continue;
                    }
                    Err(_error) => {
                        continue;
                    }
                };
                let operation = match server.receive_secure_storage_operation(&session) {
                    Ok(operation) => operation,
                    Err(_error) => {
                        server.disconnect_client();
                        continue;
                    }
                };
                match operation {
                    local_ipc::SecureStorageOperation::Protect(request) => {
                        let result = storage
                            .protect_db_dek(&request.database_dek)
                            .and_then(|handle| {
                                storage
                                    .stage_db_dek_handle(&handle_path, &handle)
                                    .map(|()| handle.as_str().to_owned())
                            })
                            .map_err(|_| "SECURE_STORAGE_PROTECTION_FAILED");
                        let _ = server.respond_secure_storage_protection(
                            &session,
                            request.correlation_id,
                            result,
                        );
                    }
                    local_ipc::SecureStorageOperation::ProtectLocalBackupDek(request) => {
                        let result = storage
                            .protect_backup_dek(&request.backup_dek, &request.descriptor_digest)
                            .map_err(|_| "LOCAL_BACKUP_DEK_PROTECTION_FAILED");
                        let _ = server.respond_local_backup_dek(
                            &session,
                            request.correlation_id.clone(),
                            "protect_local_backup_dek",
                            result,
                        );
                    }
                    local_ipc::SecureStorageOperation::UnprotectLocalBackupDek(request) => {
                        let result = storage
                            .unprotect_backup_dek(
                                &request.protected_backup_dek,
                                &request.descriptor_digest,
                            )
                            .map(|backup_dek| backup_dek.as_bytes().to_vec())
                            .map_err(|_| "LOCAL_BACKUP_DEK_UNPROTECTION_FAILED");
                        let _ = server.respond_local_backup_dek(
                            &session,
                            request.correlation_id.clone(),
                            "unprotect_local_backup_dek",
                            result,
                        );
                    }
                    local_ipc::SecureStorageOperation::Commit(request) => {
                        let result = secure_storage::SecureStorageHandle::parse(&request.handle)
                            .and_then(|handle| {
                                storage
                                    .commit_staged_db_dek_handle(&handle_path, &handle)
                                    .map(|()| request.handle.clone())
                            })
                            .map_err(|_| "SECURE_STORAGE_COMMIT_FAILED");
                        let _ = server.respond_secure_storage_protection(
                            &session,
                            request.correlation_id,
                            result,
                        );
                    }
                    local_ipc::SecureStorageOperation::Abort(request) => {
                        let result = secure_storage::SecureStorageHandle::parse(&request.handle)
                            .and_then(|handle| {
                                storage
                                    .discard_staged_db_dek_handle(&handle_path, &handle)
                                    .map(|()| request.handle.clone())
                            })
                            .map_err(|_| "SECURE_STORAGE_ABORT_FAILED");
                        let _ = server.respond_secure_storage_protection(
                            &session,
                            request.correlation_id,
                            result,
                        );
                    }
                    local_ipc::SecureStorageOperation::DeriveSessionPassword(request) => {
                        let result = (|| {
                            let profile = kdf::Argon2idProfile::session_password();
                            let salt = kdf::generate_salt(&profile)
                                .map_err(|_| "SESSION_PASSWORD_KDF_FAILED")?;
                            let verifier = kdf::derive_argon2id(&profile, &request.password, &salt)
                                .map_err(|_| "SESSION_PASSWORD_KDF_FAILED")?;
                            Ok(local_ipc::SessionPasswordVerifier {
                                profile_id: profile.profile_id,
                                algorithm: "ARGON2ID".to_owned(),
                                version: profile.version,
                                memory_kib: profile.memory_kib,
                                iterations: profile.iterations,
                                parallelism: profile.parallelism,
                                salt,
                                verifier,
                            })
                        })();
                        let _ = server.respond_session_password_verifier(
                            &session,
                            request.correlation_id.clone(),
                            result,
                        );
                    }
                    local_ipc::SecureStorageOperation::VerifySessionPassword(request) => {
                        let result = (|| {
                            let profile = kdf::Argon2idProfile::persisted_session_password(
                                &request.profile_id,
                                request.memory_kib,
                                request.iterations,
                                request.parallelism,
                                request.salt.len(),
                                request.verifier.len(),
                            )
                            .map_err(|_| "SESSION_PASSWORD_PROFILE_INVALID")?;
                            let derived =
                                kdf::derive_argon2id(&profile, &request.password, &request.salt)
                                    .map_err(|_| "SESSION_PASSWORD_KDF_FAILED")?;
                            Ok(kdf::constant_time_equal(&derived, &request.verifier))
                        })();
                        let _ = server.respond_session_password_verification(
                            &session,
                            request.correlation_id.clone(),
                            result,
                        );
                    }
                }
                server.disconnect_client();
            }
        });
        Self {
            stop,
            thread: Some(thread),
        }
    }
}

#[cfg(any(not(debug_assertions), test))]
impl Drop for SecureStorageProtectionRuntime {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn allows_authoritative_navigation(url: &Url) -> bool {
    if cfg!(debug_assertions) {
        return url.scheme() == "http"
            && url.host_str() == Some("127.0.0.1")
            && url.port() == Some(1420);
    }

    (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (url.scheme() == "http" && url.host_str() == Some("tauri.localhost"))
}

#[allow(dead_code)]
fn should_start_core(startup_condition: &str) -> bool {
    matches!(startup_condition, "LOCKED" | "RECOVERY_REQUIRED")
}

#[cfg(any(not(debug_assertions), test))]
fn core_authentication_failure_code(state: local_ipc::LocalIpcState) -> &'static str {
    match state {
        local_ipc::LocalIpcState::AuthenticationFailed => "CORE_AUTHENTICATION_FAILED_PROOF",
        local_ipc::LocalIpcState::ProtocolMismatch => "CORE_AUTHENTICATION_FAILED_PROTOCOL",
        local_ipc::LocalIpcState::HandshakeTimeout => "CORE_AUTHENTICATION_FAILED_TIMEOUT",
        _ => "CORE_AUTHENTICATION_FAILED_TRANSPORT",
    }
}

#[cfg(any(not(debug_assertions), test))]
fn core_status_failure_code(state: local_ipc::LocalIpcState) -> &'static str {
    match state {
        local_ipc::LocalIpcState::ControlPlaneRequestFailed => "CORE_STATUS_RESPONSE_UNAVAILABLE",
        local_ipc::LocalIpcState::ControlPlaneResponseInvalid => "CORE_STATUS_RESPONSE_INVALID",
        _ => "CORE_STATUS_REQUEST_FAILED",
    }
}

#[cfg(any(not(debug_assertions), test))]
fn core_authentication_failure_code_with_process_state(
    state: local_ipc::LocalIpcState,
    core_exited: bool,
    startup_failure_code: Option<&str>,
) -> &'static str {
    if let Some(code) = startup_failure_code {
        return match code {
            "BOOTSTRAP_MALFORMED" => "CORE_BOOTSTRAP_MALFORMED",
            "BOOTSTRAP_REQUIRED" => "CORE_BOOTSTRAP_REQUIRED",
            "BOOTSTRAP_TOO_LARGE" => "CORE_BOOTSTRAP_TOO_LARGE",
            "CORE_ENTRYPOINT_MISSING" => "CORE_ENTRYPOINT_MISSING",
            "CORE_RUNTIME_INCOMPATIBLE" => "CORE_RUNTIME_INCOMPATIBLE",
            "CORE_RUNTIME_INTEGRITY_FAILED" => "CORE_RUNTIME_INTEGRITY_FAILED",
            "CORE_RUNTIME_MISSING" => "CORE_RUNTIME_MISSING",
            "CORE_START_FAILED" => "CORE_START_FAILED",
            "IPC_AUTHENTICATION_FAILED" => "CORE_IPC_AUTHENTICATION_FAILED",
            "IPC_CONNECT_FAILED" => "CORE_IPC_CONNECT_FAILED",
            "IPC_FRAME_MALFORMED" => "CORE_IPC_FRAME_MALFORMED",
            "IPC_FRAME_TOO_LARGE" => "CORE_IPC_FRAME_TOO_LARGE",
            "IPC_HANDSHAKE_TIMEOUT" => "CORE_IPC_HANDSHAKE_TIMEOUT",
            "IPC_PROTOCOL_MISMATCH" => "CORE_IPC_PROTOCOL_MISMATCH",
            "PERSISTENCE_CONFLICT" => "PERSISTENCE_CONFLICT",
            "PERSISTENCE_IDENTITY_FAILED" => "PERSISTENCE_IDENTITY_FAILED",
            "PERSISTENCE_INIT_FAILED" => "PERSISTENCE_INIT_FAILED",
            "PERSISTENCE_INTEGRITY_FAILED" => "PERSISTENCE_INTEGRITY_FAILED",
            "PERSISTENCE_KEY_INVALID" => "PERSISTENCE_KEY_INVALID",
            "PERSISTENCE_KEY_REQUIRED" => "PERSISTENCE_KEY_REQUIRED",
            "PERSISTENCE_PATH_INVALID" => "PERSISTENCE_PATH_INVALID",
            "PERSISTENCE_PATH_NOT_READY" => "PERSISTENCE_PATH_NOT_READY",
            "PERSISTENCE_RESTORE_DESTINATION_EXISTS" => "PERSISTENCE_RESTORE_DESTINATION_EXISTS",
            "PERSISTENCE_RESTORE_DESTINATION_INVALID" => "PERSISTENCE_RESTORE_DESTINATION_INVALID",
            "PERSISTENCE_RESTORE_FAILED" => "PERSISTENCE_RESTORE_FAILED",
            "PERSISTENCE_RESTORE_INTEGRITY_FAILED" => "PERSISTENCE_RESTORE_INTEGRITY_FAILED",
            "PERSISTENCE_SCHEMA_INVALID" => "PERSISTENCE_SCHEMA_INVALID",
            "PERSISTENCE_SCHEMA_UNSUPPORTED" => "PERSISTENCE_SCHEMA_UNSUPPORTED",
            "PERSISTENCE_SNAPSHOT_ACTIVE_TRANSACTION" => "PERSISTENCE_SNAPSHOT_ACTIVE_TRANSACTION",
            "PERSISTENCE_SNAPSHOT_DESTINATION_EXISTS" => "PERSISTENCE_SNAPSHOT_DESTINATION_EXISTS",
            "PERSISTENCE_SNAPSHOT_DESTINATION_INVALID" => {
                "PERSISTENCE_SNAPSHOT_DESTINATION_INVALID"
            }
            "PERSISTENCE_SNAPSHOT_FAILED" => "PERSISTENCE_SNAPSHOT_FAILED",
            "PERSISTENCE_SNAPSHOT_INTEGRITY_FAILED" => "PERSISTENCE_SNAPSHOT_INTEGRITY_FAILED",
            "PERSISTENCE_SNAPSHOT_KEY_REQUIRED" => "PERSISTENCE_SNAPSHOT_KEY_REQUIRED",
            "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED" => "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
            _ => {
                if core_exited {
                    "CORE_EXITED_DURING_AUTHENTICATION"
                } else {
                    core_authentication_failure_code(state)
                }
            }
        };
    }
    if core_exited {
        "CORE_EXITED_DURING_AUTHENTICATION"
    } else {
        core_authentication_failure_code(state)
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ui_boundary::get_core_status, start_provider_setup, get_provider_setup_status, get_session_status, initialize_session, authenticate_session])
        .setup(|app| {
            let path_backend = path_identity::PlatformPathsAndIdentity::new();
            let resolved_paths = path_backend
                .resolve_application_paths()
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
            let application_paths = lifecycle::ApplicationPaths::from_root(resolved_paths.root)?;
            application_paths.ensure_root()?;
            let _instance_ownership = lifecycle::InstanceOwnership::acquire(&application_paths)?;
            let mut bootstrap = lifecycle::BootstrapLedger::new();
            bootstrap.record(lifecycle::BootstrapStage::InstanceOwnership)?;
            application_paths.ensure_layout()?;
            let mut bootstrap_diagnostics =
                lifecycle::BootstrapDiagnostics::initialize(&application_paths.logs)?;
            bootstrap_diagnostics.record(
                lifecycle::BootstrapStage::InstanceOwnership,
                bootstrap.condition(),
            )?;
            bootstrap.record(lifecycle::BootstrapStage::NativeDiagnosticsInitialized)?;
            bootstrap_diagnostics.record(
                lifecycle::BootstrapStage::NativeDiagnosticsInitialized,
                bootstrap.condition(),
            )?;
            bootstrap.record(lifecycle::BootstrapStage::LockedSession)?;
            bootstrap_diagnostics.record(
                lifecycle::BootstrapStage::LockedSession,
                bootstrap.condition(),
            )?;
            let _core_runtime_policy = core_runtime::CoreRuntimePolicy::new();
            bootstrap.record(lifecycle::BootstrapStage::BootstrapConfigurationValidated)?;
            bootstrap_diagnostics.record(
                lifecycle::BootstrapStage::BootstrapConfigurationValidated,
                bootstrap.condition(),
            )?;

            let mut native_broker = native_broker::WindowsNativeBroker::with_secure_storage_root(
                application_paths.data.join("secure-storage"),
            )
            .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
            let secure_storage_status =
                native_broker.capability_status(native_broker::NativeCapabilityId::SecureStorage);
            let secure_storage_ready = secure_storage_status.availability
                == native_broker::CapabilityAvailability::Available
                && secure_storage_status.qualification
                    == native_broker::CapabilityQualification::Qualified;
            bootstrap.record_secure_storage(secure_storage_ready)?;
            bootstrap_diagnostics.record(
                lifecycle::BootstrapStage::SecureStorageBoundaryRegistered,
                bootstrap.condition(),
            )?;
            let recovery_marker_state = application_paths.recovery_marker_state()?;
            let recovery_marker_invalid =
                recovery_marker_state == lifecycle::RecoveryMarkerState::Invalid;
            if recovery_marker_state == lifecycle::RecoveryMarkerState::Valid
                && secure_storage_ready
            {
                bootstrap.mark_recovery_required();
                bootstrap_diagnostics.record_failure("RECOVERY_MODE_REQUIRED")?;
            }
            if recovery_marker_invalid {
                bootstrap_diagnostics.record_failure("RECOVERY_MARKER_INVALID")?;
            }

            #[cfg(not(debug_assertions))]
            let (db_dek_handle, db_dek) = native_broker
                .open_or_create_db_dek(
                    &application_paths.data.join("db-dek.handle"),
                    &application_paths.data.join("state.db"),
                )
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;

            #[cfg(not(debug_assertions))]
            let resource_dir = {
                let resource_dir = app.path().resource_dir()?;
                if resource_dir
                    .join("resources")
                    .join(core_runtime::RELEASE_RUNTIME_DIRECTORY)
                    .is_dir()
                {
                    resource_dir.join("resources")
                } else {
                    resource_dir
                }
            };

            #[cfg(debug_assertions)]
            let _startup_condition = bootstrap.condition().startup_query_value();

            #[cfg(not(debug_assertions))]
            let mut startup_condition =
                match _core_runtime_policy.load_verified_layout(resource_dir.clone()) {
                    Ok(_) => {
                        bootstrap.record(lifecycle::BootstrapStage::RuntimeIntegrityVerified)?;
                        if recovery_marker_invalid {
                            bootstrap.mark_repair_required();
                        }
                        bootstrap_diagnostics.record(
                            lifecycle::BootstrapStage::RuntimeIntegrityVerified,
                            bootstrap.condition(),
                        )?;
                        bootstrap.condition().startup_query_value()
                    }
                    Err(error) => {
                        eprintln!(
                            "[jarvis] Core runtime preflight state={:?}; repair required",
                            error.state
                        );
                        bootstrap.mark_repair_required();
                        bootstrap_diagnostics.record_failure("CORE_RUNTIME_PREFLIGHT_FAILED")?;
                        "REPAIR_REQUIRED"
                    }
                };

            let _platform_composition = platform::compose_windows_full_host()
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
            #[cfg(debug_assertions)]
            let _local_ipc = local_ipc::NamedPipeServer::bind()
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;

            #[cfg(not(debug_assertions))]
            let host_runtime = if should_start_core(startup_condition) {
                let layout = _core_runtime_policy.load_verified_layout(resource_dir.clone())?;
                let manifest_path = resource_dir
                    .join(core_runtime::RELEASE_RUNTIME_DIRECTORY)
                    .join("runtime-manifest.json");
                let (local_ipc, secure_storage_server) =
                    local_ipc::NamedPipeServer::bind_with_database_dek_and_secure_storage(
                        *db_dek.as_bytes(),
                    )
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                let secure_storage_runtime = SecureStorageProtectionRuntime::start(
                    secure_storage_server,
                    native_broker.secure_storage_boundary(),
                    application_paths.data.join("db-dek.handle"),
                );
                bootstrap.record(lifecycle::BootstrapStage::LocalIpcEndpointBound)?;
                bootstrap_diagnostics.record(
                    lifecycle::BootstrapStage::LocalIpcEndpointBound,
                    bootstrap.condition(),
                )?;
                let mut bootstrap_channel = local_ipc
                    .create_bootstrap_channel()
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                bootstrap_channel
                    .write_material(local_ipc.bootstrap_material())
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                bootstrap.record(lifecycle::BootstrapStage::BootstrapSecretTransferred)?;
                bootstrap_diagnostics.record(
                    lifecycle::BootstrapStage::BootstrapSecretTransferred,
                    bootstrap.condition(),
                )?;
                let process_supervisor = process_supervisor::PlatformProcessSupervisor::new()
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                let core_process = process_supervisor
                    .launch_core_with_bootstrap_and_database_mode(
                        &layout,
                        &manifest_path,
                        bootstrap_channel.reader_handle(),
                        &application_paths.data.join("state.db"),
                        startup_condition == "RECOVERY_REQUIRED",
                    )
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                bootstrap.record(lifecycle::BootstrapStage::CoreContained)?;
                bootstrap_diagnostics.record(
                    lifecycle::BootstrapStage::CoreContained,
                    bootstrap.condition(),
                )?;
                bootstrap_channel.close_reader();
                let core_exited = matches!(
                    core_process
                        .wait(Duration::ZERO)
                        .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?,
                    process_supervisor::ProcessWait::Exited { .. }
                );
                if core_exited {
                    bootstrap.mark_repair_required();
                    bootstrap_diagnostics.record_failure("CORE_EXITED_BEFORE_AUTHENTICATION")?;
                    startup_condition = bootstrap.condition().startup_query_value();
                    None
                } else {
                    match local_ipc.authenticate_client() {
                        Ok(authenticated) => {
                            match local_ipc.request_locked_status(&authenticated) {
                                Ok(core_status) => {
                                    bootstrap
                                        .record(lifecycle::BootstrapStage::CoreAuthenticated)?;
                                    bootstrap_diagnostics.record(
                                        lifecycle::BootstrapStage::CoreAuthenticated,
                                        bootstrap.condition(),
                                    )?;
                                    HostRuntime {
                                        local_ipc: Mutex::new(local_ipc),
                                        native_broker: Mutex::new(native_broker),
                                        _secure_storage_runtime: secure_storage_runtime,
                                        process_supervisor,
                                        core_process,
                                        authenticated,
                                        core_status,
                                        _db_dek_handle: db_dek_handle,
                                        _db_dek: db_dek,
                                    }
                                    .into()
                                }
                                Err(error) => {
                                    bootstrap.mark_repair_required();
                                    bootstrap_diagnostics
                                        .record_failure(core_status_failure_code(error.state))?;
                                    startup_condition = bootstrap.condition().startup_query_value();
                                    None
                                }
                            }
                        }
                        Err(error) => {
                            bootstrap.mark_repair_required();
                            let core_exited = matches!(
                                core_process.wait(Duration::ZERO).ok(),
                                Some(process_supervisor::ProcessWait::Exited { .. })
                            );
                            let startup_failure_code = if core_exited {
                                core_process.startup_failure_code()
                            } else {
                                None
                            };
                            bootstrap_diagnostics.record_failure(
                                core_authentication_failure_code_with_process_state(
                                    error.state,
                                    core_exited,
                                    startup_failure_code.as_deref(),
                                ),
                            )?;
                            startup_condition = bootstrap.condition().startup_query_value();
                            None
                        }
                    }
                }
            } else {
                None
            };

            #[cfg(not(debug_assertions))]
            if let Some(host_runtime) = host_runtime {
                app.manage(host_runtime);
            }
            let window_controller = window_controller::PlatformWindowController::new(
                application_paths.data.join("window-state.json"),
            )
            .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;

            #[cfg(debug_assertions)]
            let webview_url = WebviewUrl::External(
                "http://127.0.0.1:1420"
                    .parse()
                    .expect("development frontend URL must be valid"),
            );
            #[cfg(not(debug_assertions))]
            let webview_url = WebviewUrl::App("index.html".into());

            window_controller
                .build_primary_window(app, webview_url, allows_authoritative_navigation)
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;

            Ok(())
        })
        .run(tauri::tauri_build_context!())
        .expect("failed to run JARVIS desktop host");
}

#[cfg(test)]
mod tests {
    use super::{
        core_authentication_failure_code, core_authentication_failure_code_with_process_state,
        allows_authoritative_navigation, core_status_failure_code, should_start_core,
    };

    #[test]
    fn only_locked_startup_condition_can_start_core() {
        assert!(should_start_core("LOCKED"));
        assert!(should_start_core("RECOVERY_REQUIRED"));
        assert!(!should_start_core("DEGRADED"));
        assert!(!should_start_core("REPAIR_REQUIRED"));
        assert!(!should_start_core("UNKNOWN"));
    }

    #[test]
    fn production_navigation_allows_only_the_tauri_app_origins() {
        assert!(allows_authoritative_navigation(
            &"http://tauri.localhost/index.html".parse().unwrap()
        ));
        assert!(allows_authoritative_navigation(
            &"tauri://localhost/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"https://example.com/index.html".parse().unwrap()
        ));
    }

    #[test]
    fn core_authentication_diagnostics_remain_bounded_and_non_secret() {
        assert_eq!(
            core_authentication_failure_code(super::local_ipc::LocalIpcState::AuthenticationFailed),
            "CORE_AUTHENTICATION_FAILED_PROOF"
        );
        assert_eq!(
            core_authentication_failure_code(super::local_ipc::LocalIpcState::ProtocolMismatch),
            "CORE_AUTHENTICATION_FAILED_PROTOCOL"
        );
        assert_eq!(
            core_authentication_failure_code(super::local_ipc::LocalIpcState::HandshakeTimeout),
            "CORE_AUTHENTICATION_FAILED_TIMEOUT"
        );
        assert_eq!(
            core_authentication_failure_code(super::local_ipc::LocalIpcState::FrameMalformed),
            "CORE_AUTHENTICATION_FAILED_TRANSPORT"
        );
        assert_eq!(
            core_authentication_failure_code_with_process_state(
                super::local_ipc::LocalIpcState::HandshakeTimeout,
                true,
                None,
            ),
            "CORE_EXITED_DURING_AUTHENTICATION"
        );
        assert_eq!(
            core_authentication_failure_code_with_process_state(
                super::local_ipc::LocalIpcState::HandshakeTimeout,
                false,
                None,
            ),
            "CORE_AUTHENTICATION_FAILED_TIMEOUT"
        );
        assert_eq!(
            core_authentication_failure_code_with_process_state(
                super::local_ipc::LocalIpcState::HandshakeTimeout,
                true,
                Some("CORE_START_FAILED"),
            ),
            "CORE_START_FAILED"
        );
        assert_eq!(
            core_authentication_failure_code_with_process_state(
                super::local_ipc::LocalIpcState::HandshakeTimeout,
                true,
                Some("untrusted detail"),
            ),
            "CORE_EXITED_DURING_AUTHENTICATION"
        );
    }

    #[test]
    fn core_status_failure_diagnostics_classify_only_known_transport_states() {
        assert_eq!(
            core_status_failure_code(super::local_ipc::LocalIpcState::ControlPlaneRequestFailed),
            "CORE_STATUS_RESPONSE_UNAVAILABLE"
        );
        assert_eq!(
            core_status_failure_code(super::local_ipc::LocalIpcState::ControlPlaneResponseInvalid),
            "CORE_STATUS_RESPONSE_INVALID"
        );
        assert_eq!(
            core_status_failure_code(super::local_ipc::LocalIpcState::FrameMalformed),
            "CORE_STATUS_REQUEST_FAILED"
        );
    }

    #[test]
    fn supervised_packaged_core_authenticates_with_host_secure_storage_runtime() {
        let release_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../target/x86_64-pc-windows-msvc/release");
        let resource_dir = if release_dir
            .join("resources")
            .join(super::core_runtime::RELEASE_RUNTIME_DIRECTORY)
            .is_dir()
        {
            release_dir.join("resources")
        } else {
            release_dir
        };
        let resource_dir = std::fs::canonicalize(resource_dir)
            .expect("release resource directory must canonicalize");
        let root = resource_dir.join("core-runtime");
        if !root.is_dir() {
            return;
        }
        let layout = super::core_runtime::CoreRuntimePolicy::new()
            .load_verified_layout(resource_dir)
            .expect("packaged Core runtime must be qualified");
        let manifest_path = root.join("runtime-manifest.json");
        let test_root = std::env::temp_dir().join(format!(
            "jarvis-host-secure-storage-runtime-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&test_root);
        std::fs::create_dir_all(&test_root).expect("test root must be created");
        let database_path = test_root.join("state.db");
        let handle_path = test_root.join("db-dek.handle");
        let native_broker = super::native_broker::WindowsNativeBroker::with_secure_storage_root(
            test_root.join("secure-storage"),
        )
        .expect("test secure storage must initialize");
        let (_db_dek_handle, db_dek) = native_broker
            .open_or_create_db_dek(&handle_path, &database_path)
            .expect("test DB_DEK must be opened or created");
        let (server, secure_storage_server) =
            super::local_ipc::NamedPipeServer::bind_with_database_dek_and_secure_storage(
                *db_dek.as_bytes(),
            )
            .expect("paired named pipes must bind");
        let secure_storage_runtime = super::SecureStorageProtectionRuntime::start(
            secure_storage_server,
            native_broker.secure_storage_boundary(),
            handle_path.clone(),
        );
        let mut bootstrap_channel = server
            .create_bootstrap_channel()
            .expect("bootstrap channel must be created");
        bootstrap_channel
            .write_material(server.bootstrap_material())
            .expect("paired bootstrap material must be written");
        let supervisor = super::process_supervisor::PlatformProcessSupervisor::new()
            .expect("Job Object must be created");
        let process = supervisor
            .launch_core_with_bootstrap_and_database(
                &layout,
                &manifest_path,
                bootstrap_channel.reader_handle(),
                &database_path,
            )
            .expect("supervised Core must launch with host secure-storage runtime");
        bootstrap_channel.close_reader();
        let authenticated = server
            .authenticate_client()
            .expect("supervised Core must authenticate on the primary endpoint");
        assert_eq!(
            authenticated.protocol_major,
            super::local_ipc::IPC_PROTOCOL_MAJOR
        );
        assert!(matches!(
            process
                .wait(std::time::Duration::ZERO)
                .expect("Core wait must work"),
            super::process_supervisor::ProcessWait::TimedOut
        ));
        let status = server
            .request_locked_status(&authenticated)
            .expect("supervised Core must return locked status on the primary endpoint");
        assert_eq!(status.service_state, "LOCKED");
        assert_eq!(status.transport_state, "NOT_CONNECTED");
        process
            .terminate(0x4A52_5649)
            .expect("test Core must terminate");
        drop(secure_storage_runtime);
        let _ = std::fs::remove_dir_all(&test_root);
    }

    #[cfg(test)]
    #[test]
    fn packaged_core_live_secure_storage_restore_lease_stages_commits_and_aborts() {
        use super::{SecureStorageProtectionRuntime, local_ipc, native_broker};
        use std::io::Write;
        use std::process::{Command, Stdio};

        let release_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../target/x86_64-pc-windows-msvc/release/resources/core-runtime");
        let node = release_root.join("runtime/node.exe");
        let ipc_module = release_root.join("core/dist/ipc-bootstrap.js");
        if !node.is_file() || !ipc_module.is_file() {
            return;
        }
        let root =
            std::env::temp_dir().join(format!("jarvis-live-secure-storage-{}", std::process::id()));
        let storage_root = root.join("secure-storage");
        let handle_path = root.join("data/db-dek.handle");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(handle_path.parent().expect("handle parent must exist"))
            .expect("test data directory must exist");
        let (primary, secure_storage_server) =
            local_ipc::NamedPipeServer::bind_with_database_dek_and_secure_storage([0; 32])
                .expect("paired live IPC servers must bind");
        let storage = native_broker::WindowsSecureStorageBoundary::from_root(storage_root.clone())
            .expect("test secure storage must initialize");
        let runtime = SecureStorageProtectionRuntime::start(
            secure_storage_server,
            storage,
            handle_path.clone(),
        );
        let module_url = format!(
            "file:///{}",
            ipc_module
                .display()
                .to_string()
                .replace('\\', "/")
                .replace(' ', "%20")
        );
        let script = r#"
            const chunks = [];
            for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
            const { parseBootstrapFrame, protectNewDbDekThroughNativeStorage, protectLocalBackupDekThroughNativeStorage, unprotectLocalBackupDekThroughNativeStorage } = await import(process.env.JARVIS_TEST_IPC_MODULE);
            const material = parseBootstrapFrame(Buffer.concat(chunks));
            if (process.argv[1] === "local" && typeof protectLocalBackupDekThroughNativeStorage !== "function") {
                process.stdout.write("LEGACY");
                process.exit(0);
            }
            if (process.argv[1] === "local") {
                const backupDek = Buffer.alloc(32, Number(process.env.JARVIS_TEST_KEY));
                const descriptorDigest = Buffer.alloc(32, 0x77);
                const protectedBackupDek = await protectLocalBackupDekThroughNativeStorage(material, backupDek, descriptorDigest);
                const recovered = await unprotectLocalBackupDekThroughNativeStorage(material, protectedBackupDek, descriptorDigest);
                if (!recovered.equals(backupDek)) throw new Error("local BackupDEK round-trip mismatch");
                try {
                    await unprotectLocalBackupDekThroughNativeStorage(material, protectedBackupDek, Buffer.alloc(32, 0x78));
                    throw new Error("local BackupDEK accepted mismatched descriptor binding");
                } catch (error) {
                    if (error?.message === "local BackupDEK accepted mismatched descriptor binding") throw error;
                }
                backupDek.fill(0);
                descriptorDigest.fill(0);
                protectedBackupDek.fill(0);
                recovered.fill(0);
            } else {
                const lease = await protectNewDbDekThroughNativeStorage(material, Buffer.alloc(32, Number(process.env.JARVIS_TEST_KEY)));
                if (process.argv[1] === "commit") await lease.commit();
                else await lease.abort();
            }
            process.stdout.write("OK");
        "#;
        let run_client = |mode: &str, key: u8| {
            let mut child = Command::new(&node)
                .arg("-e")
                .arg(script)
                .arg(mode)
                .current_dir(&release_root)
                .env_clear()
                .env(
                    "SystemRoot",
                    std::env::var_os("SystemRoot").expect("SystemRoot exists"),
                )
                .env("WINDIR", std::env::var_os("WINDIR").expect("WINDIR exists"))
                .env("JARVIS_TEST_IPC_MODULE", &module_url)
                .env("JARVIS_TEST_KEY", key.to_string())
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .expect("packaged secure-storage client must launch");
            child
                .stdin
                .take()
                .expect("secure-storage client stdin must exist")
                .write_all(
                    &primary
                        .bootstrap_material()
                        .encode_frame_for_test()
                        .expect("bootstrap frame must encode"),
                )
                .expect("bootstrap frame must be delivered");
            let output = child
                .wait_with_output()
                .expect("secure-storage client must exit");
            assert!(
                output.status.success(),
                "secure-storage client failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
            let output_text = String::from_utf8_lossy(&output.stdout);
            if mode == "local" {
                assert!(output_text == "OK" || output_text == "LEGACY");
            } else {
                assert_eq!(output_text, "OK");
            }
        };

        run_client("commit", 0x44);
        let active_handle =
            std::fs::read_to_string(&handle_path).expect("committed active handle must exist");
        assert!(active_handle.starts_with("dpapi-v1-"));
        assert!(!std::path::PathBuf::from(format!("{}.pending", handle_path.display())).exists());
        run_client("abort", 0x55);
        assert_eq!(
            std::fs::read_to_string(&handle_path).expect("active handle must remain"),
            active_handle
        );
        run_client("local", 0x66);
        drop(runtime);
        let _ = std::fs::remove_dir_all(root);
    }

    #[cfg(windows)]
    #[test]
    fn packaged_core_live_clean_profile_restore_rekeys_and_reconciles() {
        use super::{SecureStorageProtectionRuntime, local_ipc, native_broker, secure_storage};
        use std::io::Write;
        use std::process::{Command, Stdio};

        let exact_release_root =
            std::env::var_os("JARVIS_EXACT_SIGNED_RELEASE_ROOT").map(std::path::PathBuf::from);
        let release_root = exact_release_root.clone().unwrap_or_else(|| {
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../../target/x86_64-pc-windows-msvc/release/resources/core-runtime")
        });
        let preserved_recovery_secret = exact_release_root.map(|_| {
            let path = std::env::var_os("JARVIS_PRESERVED_RECOVERY_SECRET_PATH")
                .map(std::path::PathBuf::from)
                .expect("exact signed release drill requires a preserved recovery secret path");
            let metadata =
                std::fs::metadata(&path).expect("preserved recovery secret must be readable");
            assert!(
                metadata.is_file(),
                "preserved recovery secret must be a file"
            );
            assert_eq!(
                metadata.len(),
                32,
                "preserved recovery secret must be exactly 32 bytes"
            );
            path
        });
        let node = release_root.join("runtime/node.exe");
        let core_module = release_root.join("core/dist/main.js");
        let ipc_module = release_root.join("core/dist/ipc-bootstrap.js");
        if !node.is_file() || !core_module.is_file() || !ipc_module.is_file() {
            return;
        }

        let root =
            std::env::temp_dir().join(format!("jarvis-live-clean-restore-{}", std::process::id()));
        let storage_root = root.join("secure-storage");
        let handle_path = root.join("data/db-dek.handle");
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(handle_path.parent().expect("handle parent must exist"))
            .expect("test data directory must exist");
        let recovery_path = root.join("recovery");
        std::fs::create_dir_all(&recovery_path).expect("recovery directory must exist");

        let (primary, secure_storage_server) =
            local_ipc::NamedPipeServer::bind_with_database_dek_and_secure_storage([0; 32])
                .expect("paired live IPC servers must bind");
        let storage = native_broker::WindowsSecureStorageBoundary::from_root(storage_root.clone())
            .expect("test secure storage must initialize");
        let runtime = SecureStorageProtectionRuntime::start(
            secure_storage_server,
            storage,
            handle_path.clone(),
        );
        let core_module_url = format!(
            "file:///{}",
            core_module
                .display()
                .to_string()
                .replace('\\', "/")
                .replace(' ', "%20")
        );
        let ipc_module_url = format!(
            "file:///{}",
            ipc_module
                .display()
                .to_string()
                .replace('\\', "/")
                .replace(' ', "%20")
        );
        let script = r#"
        (async () => {
            const { createHash } = await import("node:crypto");
            const { readFile } = await import("node:fs/promises");
            const { join } = await import("node:path");
            const chunks = [];
            for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
            const { parseBootstrapFrame } = await import(process.env.JARVIS_TEST_IPC_MODULE);
            const { CoreBootstrap } = await import(process.env.JARVIS_TEST_CORE_MODULE);
            const base = new URL("./", process.env.JARVIS_TEST_CORE_MODULE);
            const { buildBackupPayloadManifest } = await import(new URL("./backup-manifest.js", base));
            const { createAuthenticatedBackupPackage, createAuthenticatedLocalBackupPackage } = await import(new URL("./backup-package.js", base));
            const { protectLocalBackupDekThroughNativeStorage, unprotectLocalBackupDekThroughNativeStorage } = await import(process.env.JARVIS_TEST_IPC_MODULE);
            const { openCoreDatabase, exportSqlcipherSnapshot } = await import(new URL("./persistence.js", base));
            const { applyCoreMigrations } = await import(new URL("./schema.js", base));
            const material = parseBootstrapFrame(Buffer.concat(chunks));
            const root = process.env.JARVIS_TEST_RESTORE_ROOT;
            const backupId = "018f3b8e-6c68-7abc-8def-0123456789ab";
            const createdAt = "2026-08-14T00:00:00.000Z";
            const preservedRecoverySecretPath = process.env.JARVIS_TEST_RECOVERY_SECRET_PATH;
            const recoverySecret = preservedRecoverySecretPath
                ? Buffer.from(await readFile(preservedRecoverySecretPath))
                : Buffer.alloc(32, 0x61);
            if (recoverySecret.length !== 32) throw new Error("preserved recovery secret must be exactly 32 bytes");
            const backupDek = Buffer.alloc(32, 0x62);
            const snapshotDbKey = Buffer.alloc(32, 0x68);
            const sourceDbDek = Buffer.alloc(32, 0x67);
            const newDbDek = Buffer.alloc(32, 0x69);
            const sourcePath = join(root, "source.db");
            const snapshotPath = join(root, "snapshot.db");
            const destinationPath = join(root, "clean-profile.db");
            const live = openCoreDatabase(sourcePath, { dbDek: sourceDbDek });
            applyCoreMigrations(live, () => createdAt);
            live.database.prepare("INSERT INTO integration_accounts (integration_account_id, provider_id, account_label, credential_handle, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("live-account", "provider-live", "Live", "old-handle", "ACTIVE", 1, createdAt, createdAt);
            await exportSqlcipherSnapshot(live, snapshotPath, snapshotDbKey);
            live.close();
            const snapshotBytes = await readFile(snapshotPath);
            const manifest = buildBackupPayloadManifest({
                backupId,
                createdAt,
                protectionClass: "PORTABLE_STATE",
                jarvisVersion: "1.0.6",
                protocolVersion: 1,
                schemaVersion: 1,
                snapshot: {
                    logicalType: "SQLCIPHER_SNAPSHOT",
                    path: "database/state.db",
                    bytes: snapshotBytes.length.toString(10),
                    sha256: createHash("sha256").update(snapshotBytes).digest("base64url"),
                },
                objects: [],
                keySlotProfiles: ["GENERATED_RECOVERY_V1"],
            });
            const backup = createAuthenticatedBackupPackage({
                backupId,
                createdAt,
                protectionClass: "PORTABLE_STATE",
                manifestBytes: manifest.canonicalBytes,
                snapshotDbKey,
                backupDek,
                recoverySecret,
                slotId: "generated-live-restore",
                objects: [{ path: "database/state.db", data: snapshotBytes }],
                noncePrefix: Buffer.from([5, 6, 7, 8]),
            });
            const bootstrap = new CoreBootstrap();
            await bootstrap.start({
                JARVIS_CORE_ROOT: process.env.JARVIS_CORE_ROOT,
                JARVIS_CORE_ENTRYPOINT: process.env.JARVIS_CORE_ENTRYPOINT,
                JARVIS_TUF_METADATA_DIR: process.env.JARVIS_TUF_METADATA_DIR,
            }, undefined, material);
            const restored = await bootstrap.restorePortableBackup({
                descriptor: backup.descriptorBytes,
                chunks: backup.chunks,
                generatedRecoverySlot: backup.generatedRecoverySlot,
                recoverySecret,
                noncePrefix: backup.noncePrefix,
                destinationPath,
                maintenanceLockPath: join(root, "restore.lock"),
                recoveryMarkerPath: join(root, "recovery", "restore-required.marker"),
                newDbDek,
                newSessionPassword: Buffer.from("live-clean-profile-session-password"),
                now: "2026-08-14T01:00:00.000Z",
            });
            if (restored.affectedIntegrationAccountIds.length !== 1 || restored.affectedIntegrationAccountIds[0] !== "live-account") throw new Error("restore reconciliation was not reported");
            const restoredDb = openCoreDatabase(destinationPath, { dbDek: newDbDek });
            const account = restoredDb.database.prepare("SELECT credential_handle, state FROM integration_accounts WHERE integration_account_id = ?").get("live-account");
            const verifier = restoredDb.database.prepare("SELECT meta_value FROM system_meta WHERE meta_key = ?").get("session-password-verifier");
            restoredDb.close();
            if (account?.credential_handle !== null || account?.state !== "REAUTH_REQUIRED") throw new Error("restored integration account was not re-authenticated");
            if (typeof verifier?.meta_value !== "string") throw new Error("fresh session-password verifier metadata was not persisted");
            if (!verifier.meta_value.includes("session-password-v1")) throw new Error("fresh session-password verifier profile metadata was not persisted");
            if (verifier.meta_value.includes("live-clean-profile-session-password")) throw new Error("fresh session-password plaintext was persisted");
            if ((await readFile(join(root, "recovery", "restore-required.marker"), "utf8")) !== "JARVIS_RECOVERY_REQUIRED_V1\n") throw new Error("restore recovery marker is missing");
            const localManifest = buildBackupPayloadManifest({
                backupId: "018f3b8e-6c68-7abc-8def-0123456789ac",
                createdAt,
                protectionClass: "LOCAL_RECOVERY",
                jarvisVersion: "1.0.6",
                protocolVersion: 1,
                schemaVersion: 1,
                snapshot: {
                    logicalType: "SQLCIPHER_SNAPSHOT",
                    path: "database/state.db",
                    bytes: snapshotBytes.length.toString(10),
                    sha256: createHash("sha256").update(snapshotBytes).digest("base64url"),
                },
                objects: [],
                keySlotProfiles: ["WINDOWS_DPAPI_V1"],
            });
            const localBackup = await createAuthenticatedLocalBackupPackage({
                backupId: "018f3b8e-6c68-7abc-8def-0123456789ac",
                createdAt,
                protectionClass: "LOCAL_RECOVERY",
                manifestBytes: localManifest.canonicalBytes,
                snapshotDbKey,
                backupDek,
                slotId: "windows-dpapi-live-restore",
                objects: [{ path: "database/state.db", data: snapshotBytes }],
                noncePrefix: Buffer.from([9, 10, 11, 12]),
                protectBackupDek: (value, descriptorDigest) =>
                    protectLocalBackupDekThroughNativeStorage(material, value, descriptorDigest),
            });
            const localDestinationPath = join(root, "local-clean-profile.db");
            const localRestored = await bootstrap.restoreLocalBackup({
                descriptor: localBackup.descriptorBytes,
                chunks: localBackup.chunks,
                localRecoverySlot: localBackup.localRecoverySlot,
                noncePrefix: localBackup.noncePrefix,
                destinationPath: localDestinationPath,
                maintenanceLockPath: join(root, "local-restore.lock"),
                recoveryMarkerPath: join(root, "recovery", "local-restore-required.marker"),
                newDbDek,
                newSessionPassword: Buffer.from("live-local-restore-session-password"),
                now: "2026-08-14T02:00:00.000Z",
            });
            if (localRestored.affectedIntegrationAccountIds.length !== 1 || localRestored.affectedIntegrationAccountIds[0] !== "live-account") throw new Error("local restore reconciliation was not reported");
            const localRestoredDb = openCoreDatabase(localDestinationPath, { dbDek: newDbDek });
            const localAccount = localRestoredDb.database.prepare("SELECT credential_handle, state FROM integration_accounts WHERE integration_account_id = ?").get("live-account");
            localRestoredDb.close();
            if (localAccount?.credential_handle !== null || localAccount?.state !== "REAUTH_REQUIRED") throw new Error("local restored integration account was not re-authenticated");
            if ((await readFile(join(root, "recovery", "local-restore-required.marker"), "utf8")) !== "JARVIS_RECOVERY_REQUIRED_V1\n") throw new Error("local restore recovery marker is missing");
            const wrongLocalDescriptorDigest = Buffer.alloc(32, 0x78);
            try {
                await unprotectLocalBackupDekThroughNativeStorage(material, localBackup.localRecoverySlot.protectedBackupDek, wrongLocalDescriptorDigest);
                throw new Error("local BackupDEK accepted mismatched descriptor binding during restore qualification");
            } catch (error) {
                if (error?.message === "local BackupDEK accepted mismatched descriptor binding during restore qualification") throw error;
            } finally {
                wrongLocalDescriptorDigest.fill(0);
            }
            bootstrap.stop();
            for (const key of [recoverySecret, backupDek, snapshotDbKey, sourceDbDek, newDbDek]) key.fill(0);
            process.stdout.write("RESTORE_OK");
        })().catch((error) => {
            console.error(error);
            process.exitCode = 1;
        });
        "#;
        let mut command = Command::new(&node);
        command
            .arg("-e")
            .arg(script)
            .current_dir(&release_root)
            .env_clear()
            .env(
                "SystemRoot",
                std::env::var_os("SystemRoot").expect("SystemRoot exists"),
            )
            .env("WINDIR", std::env::var_os("WINDIR").expect("WINDIR exists"))
            .env("JARVIS_TEST_CORE_MODULE", &core_module_url)
            .env("JARVIS_TEST_IPC_MODULE", &ipc_module_url)
            .env("JARVIS_TEST_RESTORE_ROOT", &root)
            .env("JARVIS_CORE_ROOT", &release_root)
            .env(
                "JARVIS_CORE_ENTRYPOINT",
                release_root.join("core/dist/main.js"),
            )
            .env("JARVIS_TUF_METADATA_DIR", release_root.join("tuf/metadata"));
        if let Some(path) = preserved_recovery_secret.as_ref() {
            command.env("JARVIS_TEST_RECOVERY_SECRET_PATH", path);
        }
        let mut child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("packaged clean-restore client must launch");
        child
            .stdin
            .take()
            .expect("clean-restore client stdin must exist")
            .write_all(
                &primary
                    .bootstrap_material()
                    .encode_frame_for_test()
                    .expect("bootstrap frame must encode"),
            )
            .expect("bootstrap frame must be delivered");
        let output = child
            .wait_with_output()
            .expect("clean-restore client must exit");
        assert!(
            output.status.success(),
            "packaged clean restore failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert_eq!(String::from_utf8_lossy(&output.stdout), "RESTORE_OK");
        let handle_text = std::fs::read_to_string(&handle_path)
            .expect("fresh restored DB_DEK handle must be published");
        let handle = secure_storage::SecureStorageHandle::parse(handle_text.trim())
            .expect("restored DB_DEK handle must be opaque and valid");
        let verifier = native_broker::WindowsSecureStorageBoundary::from_root(storage_root)
            .expect("test secure storage must reopen");
        let recovered = verifier
            .open_db_dek(&handle)
            .expect("fresh restored DB_DEK must be recoverable");
        assert_eq!(recovered.as_bytes(), &[0x69; 32]);
        drop(runtime);
        let _ = std::fs::remove_dir_all(root);
    }
}
