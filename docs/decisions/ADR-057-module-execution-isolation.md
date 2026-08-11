# ADR-057 — Module Execution Isolation

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Runtime/security architecture refinement  
**Scope:** JARVIS v1.0 module system

## Context

JARVIS supports a module registry, module manifests, staged updates, rollback, integrity verification, requested permissions, resource hints, health checks, and compatibility metadata.

Those controls establish identity, provenance, lifecycle, and declared capability requirements, but they do not by themselves define where executable module code is allowed to run.

The authoritative JARVIS Core owns or coordinates missions, tasks, permissions, approvals, memory, provider routing, tool execution, credentials, integrations, budgets, and audit state. Executing separately installable third-party or externally supplied module code directly inside the Core process would allow that code to share Core memory and could bypass the application boundaries that otherwise require typed requests, deterministic authorization, and audited execution.

This ADR defines explicit module execution classes and prohibits externally installable executable modules from running in-process with the authoritative Core.

This decision is consistent with ADR-056: a separate process under the same Windows user is not claimed as a perfect same-user malware sandbox. The value of the boundary is application isolation, crash containment, capability scoping, and deterministic mediation.

---

## Decision

JARVIS V1 SHALL classify every module into exactly one execution class:

```ts
type ModuleExecutionClass =
  | 'DATA_ONLY'
  | 'BUILT_IN_TRUSTED'
  | 'EXTERNAL_MANAGED';
```

No `UNTRUSTED_IN_PROCESS` or equivalent execution class SHALL exist.

Separately installable executable modules SHALL NOT execute inside the authoritative JARVIS Core process.

---

## 1. DATA_ONLY

`DATA_ONLY` modules contain no executable code.

They MAY contain declarative content such as:

- schemas;
- prompt/template packs;
- workflow definitions;
- policy/configuration data;
- provider metadata;
- UI metadata;
- other schema-validated non-executable definitions.

`DATA_ONLY` content SHALL be parsed and validated as data.

A `DATA_ONLY` module SHALL NOT be allowed to cause arbitrary JavaScript, shell, PowerShell, native-code, WebAssembly, or other executable payloads to run merely because they are embedded in module content.

---

## 2. BUILT_IN_TRUSTED

`BUILT_IN_TRUSTED` modules are first-party executable components shipped as part of the signed JARVIS application release and qualified through the normal JARVIS source-review, CI, security, and release process.

Such code MAY execute inside trusted JARVIS processes where the implementation architecture requires it.

A module SHALL NOT become `BUILT_IN_TRUSTED` merely because:

- it is signed by a third party;
- the user installed it;
- it is popular;
- it passed an integrity check;
- it requests only low-risk permissions;
- it was previously installed successfully.

Trust class is determined by the JARVIS release boundary, not package popularity or signature presence alone.

---

## 3. EXTERNAL_MANAGED

`EXTERNAL_MANAGED` modules are separately installable executable modules that are not part of the trusted JARVIS release.

They SHALL run outside the authoritative Core process as supervised child processes or an equivalent separately isolated execution unit approved by a future ADR.

The default V1 architecture SHALL be equivalent to:

```text
JARVIS Core
    |
Module Supervisor
    |
versioned typed module protocol
    |
EXTERNAL_MANAGED module process
```

The Rust native host/process broker SHALL remain capable of supervising the external module process tree.

Where applicable, managed module processes SHOULD be assigned to the same production process-containment mechanisms used for other supervised children, including Windows Job Objects or the later governing equivalent.

A managed module crash SHALL degrade that module without crashing the authoritative Core unless an unavoidable platform failure affects the whole application.

---

## Capability-scoped module protocol

External managed modules SHALL interact with JARVIS only through a registered, versioned, schema-validated protocol.

The protocol SHALL expose narrow capabilities rather than Core objects, database handles, or unrestricted native execution.

A module capability envelope SHALL carry enough authority information to constrain requests, equivalent to:

```ts
interface ModuleCapabilityEnvelope {
  moduleId: ModuleId;
  moduleVersion: string;
  allowedApiIds: string[];
  projectIds: ProjectId[];
  environmentIds: UUIDv7[];
  credentialCapabilities: string[];
  networkPolicyId?: string;
  sensitivity: DataSensitivity;
  locality: DataLocality;
  resourcePolicyId?: string;
}
```

Exact schema placement MAY be refined during protocol implementation, but the semantic requirements are binding.

The module protocol MAY expose capabilities equivalent to:

```text
module.artifact.read
module.artifact.write
module.event.publish
module.project.read
module.integration.request
module.tool.request
module.health.report
```

only when the relevant capability is registered and authorized.

The protocol SHALL NOT expose equivalents of:

```text
getDatabase()
getAllSecrets()
setPermission()
executeAnything()
mutateAuthoritativeStateDirectly()
```

External module requests SHALL pass the same deterministic authorization, authority-envelope, budget, integration, credential, and audit boundaries that apply to other consequential execution paths.

---

## Credential handling

External modules SHALL NOT receive broad access to JARVIS secure storage.

The preferred interaction model is capability-mediated use:

```text
module request
    ↓
Core validates authority + permission
    ↓
trusted integration/credential broker path
    ↓
credential used transiently
```

A raw credential MAY be provided to an external managed module only when all of the following are true:

- direct credential possession is technically required for that module capability;
- the manifest declares the credential capability;
- the active authority envelope permits the action;
- the Permission Engine authorizes it;
- the credential is scoped to the intended account/environment;
- exposure is minimized in duration and breadth;
- the value is excluded from normal logs, journals, artifacts, prompts, and unrelated child processes.

No module SHALL receive all JARVIS credentials or unrestricted secure-store enumeration.

---

## Module manifest normalization

The canonical module manifest SHALL include the execution class.

Equivalent protocol representation:

```ts
interface ModuleManifest {
  moduleId: ModuleId;
  version: string;
  displayName: string;
  publisher: string;
  source: string;
  executionClass: ModuleExecutionClass;
  compatibility: {
    jarvis: string;
    windows?: string;
  };
  capabilities: string[];
  requestedPermissions: string[];
  networkBehavior: string[];
  resourceHints?: {
    memoryMb?: number;
    gpuVramMb?: number;
    cpuClass?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  healthCheck: ModuleHealthCheck;
  integrity: {
    sha256: string;
    signature?: string;
  };
  lifecycle: ModuleLifecycleMetadata;
}
```

This supersedes the earlier ambiguous `healthCheck: string` representation.

---

## Typed health checks

Module health checks SHALL be declarative and typed.

A manifest SHALL NOT contain an arbitrary command string to be executed as a health check.

The V1 model SHALL be equivalent to:

```ts
type ModuleHealthCheck =
  | {
      kind: 'PROCESS_READY';
      timeoutMs: number;
    }
  | {
      kind: 'IPC_PROBE';
      method: string;
      timeoutMs: number;
    }
  | {
      kind: 'HTTP_LOCAL_PROBE';
      endpointId: string;
      timeoutMs: number;
    };
```

For `HTTP_LOCAL_PROBE`, `endpointId` SHALL resolve only to a supervisor-registered local endpoint owned by that module instance. It SHALL NOT be interpreted as an arbitrary URL supplied by the module manifest.

JARVIS implements and enforces the health-check mechanism; the module manifest only declares the permitted check type and bounded parameters.

---

## Process environment and containment

External managed modules SHALL:

- run non-elevated by default;
- receive an allowlisted environment;
- receive only explicitly required project/workspace paths;
- receive only explicitly required credential capabilities;
- receive bounded resource policy where the platform supports it;
- be supervised for start, stop, crash, timeout, and shutdown;
- use deterministic IPC framing/schema validation;
- be independently restartable where safe;
- be prevented from silently becoming an unsupervised detached process tree.

Node-specific permission controls MAY be applied to Node-based managed modules as defense in depth where compatibility permits, but the module architecture SHALL NOT depend on Node-only security mechanisms because future managed modules may use other runtimes.

---

## Stronger future isolation

JARVIS MAY later support stronger isolation for selected external managed modules, including AppContainer or other Windows isolation primitives, if justified by compatibility and risk.

Such stronger isolation is not mandatory for all V1 modules.

The module protocol SHALL be designed so adding a stronger host isolation mechanism does not require changing the logical capability contract exposed to the module.

A future ADR SHALL govern any mandatory AppContainer, separate-principal, VM, or equivalent isolation tier.

---

## Module signatures and integrity

Integrity/signature verification remains mandatory according to the existing module supply-chain contract.

A valid signature proves package identity/integrity according to the configured trust model; it does not by itself make executable code safe enough to run in Core.

Therefore production trust SHALL combine:

```text
source/publisher verification
+ package integrity/signature
+ manifest validation
+ permission/capability review
+ execution-class enforcement
+ supervised process boundary where external
+ typed IPC
+ health verification
+ staged activation/rollback
```

---

## Update and rollback implications

Module updates SHALL preserve execution class unless a signed, explicitly reviewed manifest change is accepted through the normal module update policy.

A module update SHALL NOT silently transition an external module into trusted in-process execution.

External managed module activation SHALL occur only after:

- package integrity validation;
- compatibility validation;
- manifest validation;
- permission/capability review;
- health-check validation;
- successful supervised start at the safe activation boundary required by the lifecycle contract.

Failed activation SHALL leave the prior working version available where the existing rollback contract requires it.

---

## Verification requirements

Production verification SHALL include at minimum:

1. a `DATA_ONLY` fixture containing embedded executable-looking content that is parsed only as data and never executed;
2. rejection of an externally installed manifest that requests in-process trusted execution;
3. proof that an `EXTERNAL_MANAGED` module cannot directly access Core memory objects or database handles through the supported protocol;
4. schema rejection of unauthorized/unknown module protocol operations;
5. capability denial when a module requests an ungranted project, environment, integration, credential, network, or tool capability;
6. module process crash without authoritative Core crash;
7. module timeout/forced termination with auditable state;
8. rejection of arbitrary-command health-check definitions;
9. health-check timeout/failure causing module activation or health state to fail safely;
10. secret-redaction and environment-minimization tests for external managed module launches;
11. update/rollback tests proving a failed external module version does not destroy the last known-good version;
12. confirmation that stronger optional isolation, when enabled, does not weaken the logical module capability protocol.

---

## Non-goals

This ADR does not require:

- a public plugin marketplace;
- Docker or containers for modules;
- a VM per module;
- a custom bytecode runtime;
- mandatory AppContainer for all modules;
- mandatory Node as the external-module runtime;
- a generic unrestricted shell plugin API;
- a claim that same-user managed processes form a perfect malware sandbox.

---

## Consequences

### Positive

- Externally supplied executable code cannot directly share authoritative Core memory by design.
- Module crashes are isolated from Core more effectively.
- Module authority becomes visible and testable through a capability protocol.
- Credentials and integrations remain behind deterministic mediation.
- Future stronger Windows isolation can be added without redesigning the logical module API.
- Declarative extensions avoid executable code entirely when code is unnecessary.

### Trade-offs

- External executable modules require a supervisor and protocol rather than a simple in-process import.
- Cross-process calls add modest implementation complexity and serialization overhead.
- Some third-party module authors may need to adapt libraries that assume direct in-process access.
- Stronger OS isolation remains optional and may need future work for high-risk modules.

---

## Governing Principle

> **Built-in code may share trust; external executable code must cross a supervised, capability-scoped boundary.**
