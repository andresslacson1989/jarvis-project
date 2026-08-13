pub mod core_runtime;
mod lifecycle;
mod platform;
#[path = "../../../../platform/windows/src/process_supervisor.rs"]
pub mod process_supervisor;
#[path = "../../../../platform/windows/src/local_ipc.rs"]
pub mod local_ipc;
#[path = "../../../../platform/windows/src/path_identity.rs"]
pub mod path_identity;
#[path = "../../../../platform/windows/src/session_system.rs"]
pub mod session_system;
#[path = "../../../../platform/windows/src/window_controller.rs"]
pub mod window_controller;
mod ui_boundary;

#[cfg(not(debug_assertions))]
use tauri::Manager;
use tauri::{Url, WebviewUrl};
#[cfg(not(debug_assertions))]
use std::sync::Mutex;

#[cfg(not(debug_assertions))]
#[allow(dead_code)]
struct HostRuntime {
    local_ipc: Mutex<local_ipc::NamedPipeServer>,
    process_supervisor: process_supervisor::PlatformProcessSupervisor,
    core_process: process_supervisor::SupervisedCoreProcess,
    authenticated: local_ipc::AuthenticatedCoreSession,
}

fn allows_authoritative_navigation(url: &Url) -> bool {
    if cfg!(debug_assertions) {
        return url.scheme() == "http"
            && url.host_str() == Some("127.0.0.1")
            && url.port() == Some(1420);
    }

    url.scheme() == "tauri" && url.host_str() == Some("localhost")
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ui_boundary::get_core_status])
        .setup(|app| {
            let path_backend = path_identity::PlatformPathsAndIdentity::new();
            let resolved_paths = path_backend
                .resolve_application_paths()
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
            let application_paths = lifecycle::ApplicationPaths::from_root(resolved_paths.root)?;
            application_paths.ensure_root()?;
            let _instance_ownership = lifecycle::InstanceOwnership::acquire(&application_paths)?;
            application_paths.ensure_layout()?;
            let _core_runtime_policy = core_runtime::CoreRuntimePolicy::new();

            #[cfg(debug_assertions)]
            let _startup_condition = "LOCKED";

            #[cfg(not(debug_assertions))]
            let startup_condition =
                match _core_runtime_policy.load_verified_layout(app.path().resource_dir()?) {
                    Ok(_) => "LOCKED",
                    Err(error) => {
                        eprintln!(
                            "[jarvis] Core runtime preflight state={:?}; repair required",
                            error.state
                        );
                        "REPAIR_REQUIRED"
                    }
                };

            let _platform_composition = platform::compose_windows_full_host()
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
            #[cfg(debug_assertions)]
            let _local_ipc = local_ipc::NamedPipeServer::bind()
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;

            #[cfg(not(debug_assertions))]
            let host_runtime = {
                let resource_dir = app.path().resource_dir()?;
                let layout = _core_runtime_policy.load_verified_layout(resource_dir.clone())?;
                let manifest_path = resource_dir
                    .join(core_runtime::RELEASE_RUNTIME_DIRECTORY)
                    .join("runtime-manifest.json");
                let local_ipc = local_ipc::NamedPipeServer::bind()
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                let mut bootstrap_channel = local_ipc
                    .create_bootstrap_channel()
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                bootstrap_channel
                    .write_material(local_ipc.bootstrap_material())
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                let process_supervisor = process_supervisor::PlatformProcessSupervisor::new()
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                let core_process = process_supervisor
                    .launch_core_with_bootstrap(
                        &layout,
                        &manifest_path,
                        bootstrap_channel.reader_handle(),
                    )
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                bootstrap_channel.close_reader();
                let authenticated = local_ipc
                    .authenticate_client()
                    .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
                HostRuntime {
                    local_ipc: Mutex::new(local_ipc),
                    process_supervisor,
                    core_process,
                    authenticated,
                }
            };

            #[cfg(not(debug_assertions))]
            app.manage(host_runtime);
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
            let webview_url =
                WebviewUrl::App(format!("index.html?startup={startup_condition}").into());

            window_controller
                .build_primary_window(app, webview_url, allows_authoritative_navigation)
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;

            Ok(())
        })
        .run(tauri::tauri_build_context!())
        .expect("failed to run JARVIS desktop host");
}
