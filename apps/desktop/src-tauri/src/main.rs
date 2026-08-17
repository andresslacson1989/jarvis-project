#![forbid(unsafe_code)]

#[cfg(target_os = "windows")]
fn main() {
    tauri::Builder::default()
        .run(tauri::tauri_build_context!())
        .expect("failed to run JARVIS desktop host");
}

#[cfg(not(target_os = "windows"))]
fn main() {
    eprintln!("JARVIS V1 desktop host is only qualified for Windows.");
}
