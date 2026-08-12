# React Presentation Boundary

`apps/desktop/src` is reserved for React presentation, interaction, and read-model code.

It MUST NOT:

- hold long-lived credentials;
- authorize tools or widen execution authority;
- mutate authoritative mission/task/approval state directly;
- import Core persistence, provider implementations, secure-store code, process supervision, tool executors, or OS-native backend implementations;
- spawn arbitrary native processes or connect directly to privileged provider CLIs.

It may depend on canonical protocol/schema/read-model types and narrow presentation utilities through defined package boundaries. Privileged or consequential behavior crosses the typed desktop/native/Core boundaries defined by the active contract.
