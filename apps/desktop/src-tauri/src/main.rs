use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::{Url, WebviewUrl};
use tauri_plugin_opener::OpenerExt;

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
        .setup(|app| {
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
