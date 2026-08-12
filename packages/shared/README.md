# Shared Utilities Boundary

`packages/shared` is limited to narrow non-domain utilities that are genuinely reusable across layers.

It MUST NOT become a hidden domain, service, platform, provider, persistence, authorization, or execution container. It must not import OS-native backend implementations or become a route around the explicit package/trust boundaries.
