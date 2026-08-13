fn main() {
    tauri::Builder::default()
        .run(tauri::tauri_build_context!())
        .expect("failed to run JARVIS desktop host");
}
