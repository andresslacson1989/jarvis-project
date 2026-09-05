#![forbid(unsafe_code)]

fn allows_authoritative_navigation(url: &tauri::Url) -> bool {
    #[cfg(debug_assertions)]
    {
        url.scheme() == "http" && url.host_str() == Some("127.0.0.1") && url.port() == Some(5173)
    }

    #[cfg(not(debug_assertions))]
    {
        url.scheme() == "http" && url.host_str() == Some("tauri.localhost") && url.port().is_none()
    }
}

#[cfg(target_os = "windows")]
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("JARVIS")
            .inner_size(1200.0, 800.0)
            .devtools(false)
            .on_navigation(allows_authoritative_navigation)
            .on_new_window(|_url, _features| tauri::webview::NewWindowResponse::Deny)
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run JARVIS desktop host");
}

#[cfg(not(target_os = "windows"))]
fn main() {
    eprintln!("JARVIS V1 desktop host is only qualified for Windows.");
}

#[cfg(test)]
mod tests {
    use super::allows_authoritative_navigation;

    #[test]
    fn navigation_policy_rejects_remote_and_unexpected_origins() {
        assert!(!allows_authoritative_navigation(
            &"https://example.com".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"file:///tmp/index.html".parse().unwrap()
        ));
    }

    #[cfg(debug_assertions)]
    #[test]
    fn debug_navigation_policy_allows_only_local_dev_server() {
        assert!(allows_authoritative_navigation(
            &"http://127.0.0.1:5173/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"http://localhost:5173/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"http://127.0.0.1:9999/index.html".parse().unwrap()
        ));
    }

    #[cfg(not(debug_assertions))]
    #[test]
    fn release_navigation_policy_allows_only_bundled_app_origin() {
        assert!(allows_authoritative_navigation(
            &"http://tauri.localhost/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"tauri://localhost/index.html".parse().unwrap()
        ));
        assert!(!allows_authoritative_navigation(
            &"http://tauri.localhost:9999/index.html".parse().unwrap()
        ));
    }
}
