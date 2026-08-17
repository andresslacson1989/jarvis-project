use std::fs::create_dir_all;
use std::path::Path;

fn main() {
    let runtime_resource_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("core-runtime");
    create_dir_all(&runtime_resource_root)
        .expect("failed to create the empty Core runtime resource staging directory");

    tauri_build::try_build(
        tauri_build::Attributes::new().codegen(tauri_build::CodegenContext::new()),
    )
    .expect("failed to generate JARVIS Tauri build context");
}
