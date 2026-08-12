# Rust Native Application Shell Boundary

`apps/desktop/src-tauri` is reserved for the Rust native application shell and composition boundary.

The native shell owns desktop/native composition responsibilities, but it does not become the authority for mutable JARVIS domain state or policy decisions. Native mechanisms are reached through explicit platform capability implementations and must not leak OS-native structures into shared domain/protocol code.

Concrete Tauri, Windows, IPC, privilege, update, process, window, session, and secure-storage implementation is owned by later implementation-matrix subsections.
