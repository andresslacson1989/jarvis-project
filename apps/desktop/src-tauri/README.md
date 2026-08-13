# Rust Native Application Shell Boundary

`apps/desktop/src-tauri` owns the Rust native application shell and composition boundary.

Subsection 1.1 provides only the minimal pinned Tauri 2 host required to load the bundled-local React frontend. The native shell does not become the authority for mutable JARVIS domain state or policy decisions.

Tauri capability/CSP/navigation hardening belongs to subsection 1.2. Windows platform-backend composition and native capability implementations belong to subsection 1.3 and later owning subsections. No generic native command surface, Windows API binding, privileged process control, secure storage, IPC, update, window policy, or session authority is introduced by 1.1.
