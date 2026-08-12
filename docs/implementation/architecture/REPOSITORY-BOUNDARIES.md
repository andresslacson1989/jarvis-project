# JARVIS Repository Responsibility and Dependency Boundaries

**Role:** non-normative implementation architecture map for subsection `0.2`.  
**Authority:** the active JARVIS contract suite remains authoritative. This document records repository placement and dependency direction; it does not add or weaken requirements.

## Full-host authority topology

```text
apps/desktop/src                  React/WebView presentation; unprivileged
        ↓ typed desktop/native boundary
apps/desktop/src-tauri           Rust native application shell/composition
        ↓ authenticated local boundary (implemented later)
services/core                     authoritative Node/TypeScript domain/policy runtime
        ↓ scoped capability/adapters
providers / tools / integrations / managed modules

platform/windows                  qualified Windows native mechanisms
platform/linux                    future namespace only; no Windows-V1 Linux runtime/support claim
```

External systems remain authoritative for their live external state. The Rust host is authoritative for qualified native mechanisms. Node Core is authoritative for mutable JARVIS application/domain state and policy decisions. Presentation code does not acquire any of those authorities.

## Repository responsibility map

| Namespace | Responsibility | Must not become |
|---|---|---|
| `apps/desktop/src` | React presentation/read models | authorization, persistence, native process/provider authority |
| `apps/desktop/src-tauri` | Rust native shell/composition | domain state/policy owner |
| `services/core` | authoritative Node/TS orchestration/state/policy runtime | UI or OS-native backend |
| `packages/protocol` | canonical cross-boundary types/contracts | provider/native implementation container |
| `packages/schemas` | runtime validators | authority grant or unvalidated cast escape hatch |
| `packages/policy` | deterministic side-effect-free policy/state logic | I/O/native/provider side-effect layer |
| `packages/platform-contracts` | semantic platform capabilities | concrete Windows/Linux backend |
| `packages/shared` | narrow non-domain utilities | hidden domain/service/platform container |
| `platform/windows` | Windows native backends/composition | shared product/domain semantics |
| `platform/linux` | future Linux boundary only | V1 Linux runtime/support by symmetry |
| `providers/*` | provider/integration adapters | authoritative domain-state owner |
| `tools/*` | typed scoped tool implementations | bypass around normal authorization/execution/audit |
| `modules` | managed-module implementations/assets under registry/trust rules | self-authorizing plugin marketplace |
| `tests` | contract-defined test responsibility buckets | production implementation layer |

## Dependency-direction invariants

1. React presentation does not import Core persistence, provider implementations, secure-store code, process supervision, tool executors, or native adapters.
2. Core/domain does not depend on UI code.
3. Shared Core/domain/policy/protocol code does not import Windows or Linux native backend implementations.
4. OS-native APIs and types terminate inside the platform adapter/native shell boundaries; product/domain models use semantic platform contracts.
5. Provider-native types terminate inside provider adapters; domain models use canonical JARVIS protocol/domain types.
6. Tools and integrations do not bypass ToolExecutor, PermissionEngine, AuthorityEnvelopeService, Credential Broker, locality/budget/resource/platform checks, or audit once those owning services are implemented.
7. `packages/policy` remains deterministic and side-effect-free except explicit injected clocks/randomness/test inputs.
8. `packages/shared` remains narrow and non-domain.
9. Circular package dependencies are prohibited.
10. Operating-system selection is concentrated at composition/startup/platform-adapter boundaries, not scattered through mission, permission, memory, budget, integration, or general feature semantics.
11. Platform capability unavailability blocks or truthfully degrades the dependent feature; no weaker generic fallback preserves nominal parity.
12. Windows production mechanisms are not weakened for future portability.
13. Linux or companion support is never inferred from an interface, namespace, modeled path, or directory presence; it requires later explicit qualification.

## Subsection ownership guard

Subsection `0.2` deliberately establishes only repository responsibility and dependency direction. It does not pre-implement:

- platform/runtime identity (`0.3`);
- semantic platform capability interfaces (`0.4`);
- platform composition/backends (`0.5` and later);
- protocol/schema primitives (`0.6`);
- machine-readable contract values/config schemas (`0.7`);
- package manager, TypeScript/Rust toolchains, workspaces, or lockfiles (`0.8`);
- test-layer implementation (`0.9`);
- architecture/forbidden-import CI enforcement (`0.10`);
- CI or protected-branch governance (`0.11–0.13`).

This separation keeps the repository skeleton production-oriented without creating throwaway implementations or unsupported capability claims.
