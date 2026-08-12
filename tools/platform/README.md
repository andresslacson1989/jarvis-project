# Platform Tool Boundary

`tools/platform` is reserved for typed tool capabilities that operate through qualified semantic platform boundaries.

Tool code cannot widen authority, bypass the owning ToolExecutor/PermissionEngine/AuthorityEnvelope/Credential/Budget/Locality/Platform/Audit controls, or call a weaker native fallback when a required capability is unavailable. The execution pipeline is implemented later; this namespace grants no direct execution authority by itself.
