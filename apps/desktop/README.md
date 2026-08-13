# Desktop Application Boundary

This namespace owns the JARVIS desktop application shell. It is split between the unprivileged React presentation surface in `src/` and the Rust native composition/application shell in `src-tauri/`.

The desktop layer is not authoritative for mutable mission, task, approval, permission, provider, integration, budget, or recovery state. It must consume typed boundaries and truthful read models rather than reaching into Core persistence or execution internals.

Subsection 1.1 establishes the concrete Tauri 2 + React workspace, a bundled-local production frontend, and a minimal Rust host. It intentionally does not implement CSP/capability/navigation hardening, Windows platform-backend composition, application-owned Core packaging, native process/window/session services, or the full Mission Control product shell; those remain owned by their later Section 1 subsections.
