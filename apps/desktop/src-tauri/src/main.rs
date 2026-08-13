pub mod core_runtime;
mod lifecycle;
mod platform;
#[path = "../../../../platform/windows/src/process_supervisor.rs"]
pub mod process_supervisor;
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

            #[cfg(not(debug_assertions))]
            _core_runtime_policy.load_verified_layout(app.path().resource_dir()?)?;

            let _platform_composition = platform::compose_windows_full_host()
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;
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
