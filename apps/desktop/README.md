# Desktop Application Boundary

This namespace owns the JARVIS desktop application shell. It is split between the unprivileged React presentation surface in `src/` and the Rust native composition/application shell in `src-tauri/`.

The desktop layer is not authoritative for mutable mission, task, approval, permission, provider, integration, budget, or recovery state. It must consume typed boundaries and truthful read models rather than reaching into Core persistence or execution internals.

Production implementation of the desktop host belongs to later implementation-matrix subsections; this file establishes only the repository responsibility boundary required by subsection 0.2.
