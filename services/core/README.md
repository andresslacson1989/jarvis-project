# Core Runtime Boundary

`services/core` is the home of the authoritative Node/TypeScript Core runtime.

Core owns authoritative mutable application/domain state and policy orchestration as defined by the active contract, including projects/scopes, conversations/memory, missions/tasks/attempts, authority/permission/approval state, queues/budgets, provider logical state, module/integration logical state, automation policy, project-policy trust records, and recovery/update logical state.

Core/domain code MUST NOT depend on UI code or directly import Windows/Linux native backend implementations. Native behavior is requested through semantic platform contracts. Provider-native and OS-native types terminate inside their adapters rather than entering canonical domain models.

The current Core slice provides a typed bootstrap boundary, explicit release-root/entrypoint validation, controlled-environment checks, truthful Windows `FULL_HOST` identity, and a fail-closed pre-IPC boundary. It is built with the pinned Node/TypeScript toolchain into `dist/main.js`; authenticated native IPC and authoritative services remain subsequent matrix work.
