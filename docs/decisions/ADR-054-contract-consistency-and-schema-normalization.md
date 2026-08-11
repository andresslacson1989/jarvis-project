# ADR-054 — Contract Consistency and Schema Normalization

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Binding consistency correction  
**Scope:** JARVIS v1.0 production contract suite

## Context

A full consistency review of the JARVIS v1.0 production contract suite found a small set of places where later normative documents or accepted ADRs require behavior that is missing, represented differently, or ambiguously normalized in another normative document.

These are contract-integration defects, not reasons to redesign JARVIS. This ADR resolves them before implementation so developers do not have to choose between conflicting interpretations.

This ADR intentionally does **not** adopt broader production optimizations or new product scope. Those decisions remain separate.

Under the existing precedence rule, this later accepted ADR explicitly supersedes only the conflicting clauses identified below.

---

## 1. Normative document-set correction

ADR-052 made `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md` normative and made `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` the authoritative implementation-sequencing reference.

Therefore the canonical v1.0 implementation set SHALL be interpreted as:

1. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.md` — top-level product/architecture contract;
2. `docs/implementation/JARVIS-RUNTIME-CONTRACT.md` — normative runtime contract;
3. `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md` — normative persistence/state contract;
4. `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md` — normative security contract;
5. `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md` — normative qualification/release contract;
6. `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md` — normative cross-boundary protocol/schema contract;
7. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` — authoritative sequencing/exit-criteria reference, but not a separate product-policy authority.

Any wording in the top-level contract that lists only the first four appendices as normative is superseded by ADR-052 and this clarification.

---

## 2. Privacy classification and locality are orthogonal

The security contract describes `LOCAL_ONLY` as a routing constraint while also using confidentiality classifications such as `PRIVATE` and `SENSITIVE`. A single enum cannot correctly represent data that is both sensitive and local-only.

The canonical V1 model SHALL therefore separate confidentiality from provider locality.

```ts
type DataSensitivity = 'PUBLIC' | 'PRIVATE' | 'SENSITIVE';

type DataLocality = 'ANY_APPROVED_PROVIDER' | 'LOCAL_ONLY';
```

`SECRET` remains reserved for credential/key material and SHALL normally exist only in secure storage or transient trusted adapter memory. `SECRET` SHALL NOT be treated as an ordinary task, artifact, prompt, journal, or UI payload classification.

The `AuthorityEnvelope` definition in the protocol contract is normalized to:

```ts
interface AuthorityEnvelope {
  id: AuthorityEnvelopeId;
  originatingInstructionId: UUIDv7;
  projectIds: ProjectId[];
  workspaceIds: UUIDv7[];
  environmentIds: UUIDv7[];
  allowedActionClasses: ActionClass[];
  deniedActionClasses: ActionClass[];
  externalSystems: string[];
  sensitivity: DataSensitivity;
  locality: DataLocality;
  maxBudget?: {
    amount: number;
    currency: string;
  };
  createdAt: UtcTimestamp;
  expiresAt?: UtcTimestamp;
  policySnapshotVersion: number;
}
```

The former single `privacyClass` field is superseded for implementation.

The data-state authority-envelope representation SHALL persist equivalent `sensitivity` and `locality` fields rather than a single ambiguous privacy classification.

Artifact metadata and protocol references SHALL also preserve locality:

```ts
interface ArtifactRef {
  artifactId: ArtifactId;
  logicalType: string;
  contentType: string;
  size: number;
  sha256?: string;
  sensitivity: DataSensitivity;
  locality: DataLocality;
}
```

Persisted artifact metadata SHALL include equivalent locality information.

A `LOCAL_ONLY` artifact or task input SHALL remain `LOCAL_ONLY` through task construction, checkpointing, artifact handoff, verification, provider routing, and graph revision. No transformation or reference boundary may silently drop the routing constraint.

---

## 3. Tool manifests include precondition and postcondition contracts

The Security Hardening Contract requires every executable tool to declare preconditions and postconditions, while the protocol `ToolManifest` omitted them.

The canonical protocol `ToolManifest` SHALL include stable references to trusted condition/verifier definitions:

```ts
interface ToolManifest {
  toolId: string;
  version: number;
  description: string;
  inputSchemaId: string;
  outputSchemaId: string;
  baselineRisk: RiskClass;
  sideEffectClass: SideEffectClass;
  reversible: boolean;
  requiredPermissionIds: string[];
  allowedEnvironments: string[];
  secretCapabilities: string[];
  networkRequired: boolean;
  idempotency: 'IDEMPOTENT' | 'IDEMPOTENCY_KEY' | 'NON_IDEMPOTENT' | 'UNKNOWN';
  preconditionIds: string[];
  postconditionIds: string[];
  preemptionPolicy: PreemptionPolicy;
}
```

`preconditionIds` and `postconditionIds` SHALL resolve only through trusted registered deterministic/runtime verifier definitions. They SHALL NOT be interpreted as arbitrary executable strings supplied by AI or module content.

---

## 4. Mission graph protocol includes mission acceptance policy

The Data & State Contract requires each activated mission graph version to carry an acceptance policy, and the release contract requires graph-level acceptance criteria. The protocol `MissionGraphVersion` omitted that information.

The canonical schema SHALL include:

```ts
interface MissionAcceptancePolicy {
  requiredTerminalTaskIds: TaskId[];
  criteria: AcceptanceCriterion[];
}

interface MissionGraphVersion {
  missionId: MissionId;
  version: number;
  createdAt: UtcTimestamp;
  reason: string;
  causationEventId: EventId;
  taskIds: TaskId[];
  edges: TaskDependency[];
  acceptancePolicy: MissionAcceptancePolicy;
}
```

Core SHALL validate the acceptance policy with the graph before activation. A graph version is not complete merely because its node/edge structure is valid.

---

## 5. Provider profiles expose resource metadata required by scheduling

The runtime contract requires provider adapters to define resource metadata, while the canonical `ProviderProfile` schema omitted it.

The canonical provider profile SHALL support normalized resource information where known:

```ts
interface ProviderResourceProfile {
  memoryMb?: number;
  gpuVramMb?: number;
  cpuClass?: 'LOW' | 'MEDIUM' | 'HIGH';
  gpuRequired?: boolean;
  warmupMs?: number;
  unloadable?: boolean;
}

interface ProviderProfile {
  providerId: ProviderId;
  adapterType: string;
  modelId?: string;
  capabilities: ProviderCapabilities;
  costClass: 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  latencyClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  health: ProviderHealth;
  resources?: ProviderResourceProfile;
}
```

Unknown resource fields SHALL remain unknown rather than being invented. Scheduler decisions MAY use measured runtime telemetry in addition to declared metadata.

---

## 6. Module manifests include upgrade/rollback metadata

The top-level and security contracts require module manifests to declare upgrade/rollback behavior, while the protocol `ModuleManifest` omitted an explicit representation.

The canonical manifest SHALL add bounded lifecycle metadata equivalent to:

```ts
interface ModuleLifecycleMetadata {
  activationBoundary: 'SAFE_BOUNDARY' | 'APP_RESTART';
  rollbackSupported: boolean;
  retainsPreviousVersion: boolean;
}

interface ModuleManifest {
  // existing fields remain
  lifecycle: ModuleLifecycleMetadata;
}
```

This metadata describes lifecycle behavior; it does not grant module authority or permit arbitrary update commands.

---

## 7. Preemption terminology is normalized

ADR-048 used `NON_PREEMPTIBLE`, while the later production contract uses `TEMPORARILY_NON_PREEMPTIBLE` and explicitly requires such regions to be narrow and bounded.

For V1 implementation:

```text
ADR-048 NON_PREEMPTIBLE
    == historical synonym for
TEMPORARILY_NON_PREEMPTIBLE
```

`TEMPORARILY_NON_PREEMPTIBLE` is the canonical protocol/runtime enum value.

ADR-048 also described `RESUMING` as a lifecycle state. The later Data & State Contract intentionally does not define `RESUMING` as a durable `TaskState`.

For V1, resume SHALL be represented as a controlled runtime transition/activity beginning from `PAUSED`, performing live-state revalidation, then entering an existing durable state such as `QUEUED`, `RUNNING`, `BLOCKED`, `WAITING_FOR_USER`, `FAILED`, or `CANCELLED` as appropriate.

A UI/event stream MAY expose `RESUMING` as transient activity, but persisted canonical `TaskState` SHALL use the v1.0 data/protocol enum unless a future schema version deliberately adds a durable `RESUMING` state.

---

## 8. No other architecture is changed

This ADR does not change the accepted decisions to use:

- Windows 11;
- Tauri 2 + React/TypeScript desktop UI;
- Rust native host/supervisor;
- separate Node.js/TypeScript Core;
- SQLite authoritative state;
- Codex as the initial AI provider;
- capability-based provider routing;
- graph-orchestrated missions;
- bounded worker loops;
- deterministic permission and tool authorization;
- mandatory destructive final confirmation;
- local-first modular voice;
- deferred browser/LAN/local-LLM capabilities where already specified.

The purpose is solely to ensure the existing architecture has one implementable interpretation.

---

## Implementation rule

Until the base v1.0 documents are consolidated into a later clean contract revision, implementations SHALL apply the original v1.0 suite together with this ADR's explicit corrections.

Where this ADR names a corrected schema field or enum interpretation, that corrected form is canonical.

## Governing Principle

> **A production contract must have one authoritative meaning at every boundary.**
