pub mod core_runtime;
mod lifecycle;
mod platform;
#[path = "../../../../platform/windows/src/process_supervisor.rs"]
pub mod process_supervisor;
mod ui_boundary;

use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
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
            let application_paths = lifecycle::ApplicationPaths::from_local_app_data()?;
            application_paths.ensure_root()?;
            let _instance_ownership = lifecycle::InstanceOwnership::acquire(&application_paths)?;
            application_paths.ensure_layout()?;
            let _core_runtime_policy = core_runtime::CoreRuntimePolicy::new();

            #[cfg(not(debug_assertions))]
            _core_runtime_policy.load_verified_layout(app.path().resource_dir()?)?;

            let _platform_composition = platform::compose_windows_full_host()
                .map_err(|error| Box::new(error) as Box<dyn std::error::Error>)?;

            #[cfg(debug_assertions)]
            let webview_url = WebviewUrl::External(
                "http://127.0.0.1:1420"
                    .parse()
                    .expect("development frontend URL must be valid"),
            );
            #[cfg(not(debug_assertions))]
            let webview_url = WebviewUrl::App("index.html".into());

            WebviewWindowBuilder::new(app, "main", webview_url)
                .title("JARVIS Mission Control")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .resizable(true)
                .fullscreen(false)
                .devtools(false)
                .on_navigation(allows_authoritative_navigation)
                .on_new_window(|_url, _features| NewWindowResponse::Deny)
                .build()?;

            Ok(())
        })
        .run(tauri::tauri_build_context!())
        .expect("failed to run JARVIS desktop host");
}
