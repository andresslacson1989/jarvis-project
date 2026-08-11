# JARVIS Protocol & Schema Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.4.md`  
**Contract Version:** 1.0.4  
**Protocol Major:** 1  
**Date:** August 12, 2026

---

# 1. PURPOSE

This document defines the canonical cross-boundary types and representations for JARVIS. All data crossing process, AI/provider, tool, integration, module, persistence-event, approval, artifact, import/export, configuration, authentication, platform-capability, or security-material boundaries SHALL be runtime validated against versioned schemas.

The schemas below are the effective V1 definitions. Older schema shapes in ADRs or historical contracts are rationale/history only.

---

# 2. SCHEMA POLICY

Canonical validators SHALL live in `packages/schemas`; protocol/domain boundary types SHALL live in `packages/protocol` or generated equivalents.

Rules:

- TypeScript compile-time types never substitute for runtime validation.
- Rust boundary structs map explicitly to the same protocol definitions.
- Untrusted input enters as `unknown`/unparsed bytes and becomes a domain type only after bounded validation.
- Unknown required message/version semantics fail closed.
- Unknown optional fields may be ignored only where compatibility rules explicitly permit it.
- Security-material and money fields SHALL not be permissively coerced.
- Arrays, maps, strings, object depth, frame sizes, and arbitrary JSON fields SHALL be bounded.
- Shared domain schemas SHALL not encode an OS-native implementation object where a semantic platform-independent identity is sufficient.

---

# 3. COMMON TYPES AND PLATFORM IDENTITY

```ts
type UUIDv7 = string;
type UtcTimestamp = string; // ISO-8601 UTC

type ProjectId = UUIDv7;
type WorkspaceId = UUIDv7;
type EnvironmentId = UUIDv7;
type MissionId = UUIDv7;
type TaskId = UUIDv7;
type AttemptId = UUIDv7;
type EventId = UUIDv7;
type ArtifactId = UUIDv7;
type ApprovalId = UUIDv7;
type AuthorityEnvelopeId = UUIDv7;
type ProviderId = string;
type ModuleId = string;
type IntegrationId = string;
type IntegrationAccountId = UUIDv7;
type ConnectionId = UUIDv7;

type PlatformFamily = 'WINDOWS' | 'LINUX' | 'ANDROID';
type RuntimeRole = 'FULL_HOST' | 'COMPANION';

interface PlatformRuntimeIdentity {
  platform: PlatformFamily;
  runtimeRole: RuntimeRole;
  architecture: string;
  backendProfileId: string;
}

interface PlatformCompatibility {
  platform: PlatformFamily;
  runtimeRoles: RuntimeRole[];
  osVersionRange?: string;
  architecture?: string[];
}

interface PlatformPathRef {
  platform: PlatformFamily;
  value: string;
}
```

Identifiers are opaque and SHALL be validated before use. Display names are never authoritative identity for consequential execution.

V1 production identity is `WINDOWS + FULL_HOST`. Modeling `LINUX`/`ANDROID` does not itself grant support.

---

# 4. DATA POLICY

Sensitivity and routing locality are independent.

```ts
type DataSensitivity =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'SENSITIVE'
  | 'SECRET';

type DataLocality =
  | 'LOCAL_ONLY'
  | 'ANY_APPROVED_PROVIDER';

interface DataPolicy {
  sensitivity: DataSensitivity;
  locality: DataLocality;
}
```

`SECRET` is reserved for credentials/key material and normally exists only in secure storage or transient trusted adapter memory.

`LOCAL_ONLY` prohibits sending protected content to cloud/LAN/remote AI or speech providers.

A future companion transport requires a separate remote-device data-delivery policy contract; this V1 enum SHALL NOT be interpreted as silently authorizing `LOCAL_ONLY` content to leave the host.

Derived context/artifacts SHALL inherit the strictest applicable policy unless an explicit deterministic audited declassification/export decision changes it.

---

# 5. EXACT MONEY AND QUANTITIES

Authoritative monetary values SHALL not use binary floating point.

```ts
interface MoneyAmount {
  currency: string;
  nanoUnits: string;
}

type CanonicalQuantity = string;
```

Examples:

```text
USD 1.00      => 1000000000
USD 0.10      => 100000000
USD 0.0000025 => 2500
```

TypeScript SHOULD use `bigint` after parsing; Rust SHALL use a checked exact integer/decimal representation. Overflow, malformed integer text, unsupported precision, or currency mismatch fails authoritative budget decisions closed.

---

# 6. KDF PROFILES

```ts
type KdfPurpose = 'SESSION_PASSWORD' | 'PORTABLE_RECOVERY';

interface Argon2idProfile {
  profileId: string;
  purpose: KdfPurpose;
  algorithm: 'ARGON2ID';
  version: 0x13;
  memoryKiB: number;
  iterations: number;
  parallelism: 4;
  saltBytes: number;
  outputBytes: number;
}
```

A production V1 profile SHALL satisfy at least:

```text
memoryKiB  >= 65536
iterations >= 3
parallelism = 4
saltBytes  >= 16
outputBytes >= 32
```

Exact parameter metadata used to create a verifier/key slot SHALL be retained with that verifier/key slot so future releases can verify/derive historical values and then upgrade them deliberately.

Schema validation rejects unsupported Argon2 version, under-floor production profile, out-of-range resource values, or missing profile identity. Test/development-only weaker fixtures SHALL never be accepted by production configuration.

---

# 7. IPC ENVELOPE AND RESPONSE UNION

```ts
type IpcKind = 'request' | 'response' | 'event';

interface IpcEnvelope<T = unknown> {
  protocolVersion: 1;
  kind: IpcKind;
  id: UUIDv7 | null;
  name: string;
  correlationId: UUIDv7;
  payload: T;
}

type IpcResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: JarvisError };
```

For a request/response pair:

```text
response.id            = request.id
response.name          = request.name
response.correlationId = request.correlationId
```

Events use `id: null` and carry domain identity in their payload.

A success response SHALL NOT contain `error`; a failure response SHALL NOT contain `result`. Missing/nullable/ad-hoc status conventions do not substitute for this union.

One accepted request id receives at most one terminal response. Long-running progress uses events or operation/task identifiers.

Malformed frames/envelopes whose identity cannot be trusted may be rejected by closing the transport without fabricating an application response.

The envelope is transport-neutral. Windows V1 uses it over the qualified local named-pipe framing. A future Linux full host may use the same logical protocol over a separately qualified local transport without changing semantic message shapes.

---

# 8. ERROR MODEL

```ts
type ErrorCategory =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION'
  | 'POSTCONDITION'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_FAILED'
  | 'TOOL_FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'BUDGET'
  | 'RESOURCE'
  | 'PRIVACY'
  | 'INTEGRITY'
  | 'RECOVERY_REQUIRED'
  | 'UNSUPPORTED'
  | 'INTERNAL';

interface JarvisError {
  code: string;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  correlationId: UUIDv7;
}
```

`retryable` is advisory only. Idempotency, uncertainty, approval, budget, and recovery policy still govern replay.

Raw provider/native/SQLite stack traces or secret-bearing payloads SHALL be normalized before crossing generic boundaries.

Platform errors use stable codes such as `PLATFORM_CAPABILITY_UNAVAILABLE`, `PLATFORM_BACKEND_UNQUALIFIED`, `PLATFORM_IPC_SECURITY_FAILED`, or more specific registered equivalents rather than exposing native error text as policy input.

---

# 9. SESSION AND USER INPUT

```ts
type SessionTrustState = 'LOCKED' | 'UNLOCKING' | 'UNLOCKED' | 'LOCKING';

type SessionLockedReason =
  | 'STARTUP'
  | 'USER'
  | 'OS_SESSION_LOCK'
  | 'OS_SESSION_END'
  | 'IDLE'
  | 'SECURITY';

interface SessionState {
  state: SessionTrustState;
  sessionId: UUIDv7 | null;
  unlockedAt: UtcTimestamp | null;
  lockedReason: SessionLockedReason | null;
}

type InputModality = 'TEXT' | 'VOICE';

type InstructionOrigin = 'LOCAL_UI' | 'LOCAL_VOICE' | 'AUTOMATION' | 'EVENT_GATEWAY';

interface UserInstruction {
  id: UUIDv7;
  sessionId: UUIDv7;
  modality: InputModality;
  origin: InstructionOrigin;
  text: string;
  receivedAt: UtcTimestamp;
  conversationId: UUIDv7;
  activeProjectHint?: ProjectId;
  voiceMetadata?: {
    transcriptConfidence?: number;
    utteranceId: UUIDv7;
  };
}
```

No password, verifier, recovery factor, database key, token, or other secret appears in session state.

Voice confidence is informational and never authorizes an action or target.

A future companion origin is deliberately not added in V1. Remote-device instruction provenance requires the future Remote Access Gateway/security contract rather than being inferred from generic input.

---

# 10. ORCHESTRATOR DECISION

```ts
type OrchestratorAction =
  | 'RESPOND'
  | 'CLARIFY'
  | 'PROPOSE_TOOL'
  | 'PROPOSE_TASK'
  | 'PROPOSE_MISSION'
  | 'REQUEST_CONTEXT'
  | 'REQUEST_APPROVAL'
  | 'REPRIORITIZE'
  | 'CANCEL';

interface OrchestratorDecision {
  schemaVersion: 1;
  action: OrchestratorAction;
  userMessage?: string;
  rationaleSummary?: string;
  confidence?: number;
  payload: Record<string, unknown>;
}
```

`payload` is validated again against the selected action-specific schema. AI confidence is not an authorization field.

---

# 11. PROJECT AND EXECUTION SCOPE

```ts
interface Project {
  projectId: ProjectId;
  name: string;
  aliases: string[];
  rootPath: PlatformPathRef;
  defaultEnvironmentId?: EnvironmentId;
  defaultBranch?: string;
  enabled: boolean;
  version: number;
}

type ExecutionScope =
  | ProjectWorkspaceScope
  | IntegrationScope
  | SystemScope
  | GlobalScope;

interface ProjectWorkspaceScope {
  kind: 'PROJECT_WORKSPACE';
  projectId: ProjectId;
  workspaceId: WorkspaceId;
  environmentId?: EnvironmentId;
}

interface IntegrationBinding {
  integrationId: IntegrationId;
  accountId: IntegrationAccountId;
  capabilityIds: string[];
}

interface IntegrationScope {
  kind: 'INTEGRATION';
  bindings: IntegrationBinding[];
  projectId?: ProjectId;
  environmentId?: EnvironmentId;
}

interface SystemScope {
  kind: 'SYSTEM';
  capabilityIds: string[];
  environmentId?: EnvironmentId;
}

interface GlobalScope {
  kind: 'GLOBAL';
}
```

Rules:

- filesystem/repository/project-write tools require `PROJECT_WORKSPACE`;
- `INTEGRATION`, `SYSTEM`, and `GLOBAL` do not gain filesystem authority implicitly;
- `GLOBAL` itself grants no consequential tool authority;
- project/workspace/environment/account identities are stable IDs, never display-name guesses;
- a `PlatformPathRef` SHALL be interpreted only by the matching platform-aware path service or an explicit migration/import process.

---

# 12. AUTHORITY ENVELOPE

```ts
type ActionClass =
  | 'READ'
  | 'LOCAL_WRITE'
  | 'EXTERNAL_WRITE'
  | 'PUBLISH'
  | 'DEPLOY'
  | 'INFRASTRUCTURE_CHANGE'
  | 'SECURITY_CHANGE'
  | 'DESTRUCTIVE';

interface AuthorityEnvelope {
  id: AuthorityEnvelopeId;
  originatingInstructionId: UUIDv7;
  scopes: ExecutionScope[];
  allowedActionClasses: ActionClass[];
  deniedActionClasses: ActionClass[];
  externalSystems: string[];
  dataPolicy: DataPolicy;
  maxBudget?: MoneyAmount;
  createdAt: UtcTimestamp;
  expiresAt?: UtcTimestamp;
  policySnapshotVersion: number;
}
```

An envelope is immutable for an active attempt. A broader scope requires a new validated authority/revision record.

---

# 13. MISSIONS, TASKS, ATTEMPTS

```ts
type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';

type MissionState =
  | 'CREATED' | 'PLANNING' | 'QUEUED' | 'RUNNING'
  | 'WAITING_FOR_USER' | 'WAITING_FOR_APPROVAL'
  | 'PAUSING' | 'PAUSED' | 'BLOCKED' | 'VERIFYING'
  | 'RECOVERING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

type TaskState =
  | 'CREATED' | 'WAITING_FOR_DEPENDENCY' | 'QUEUED' | 'STARTING'
  | 'RUNNING' | 'WAITING_FOR_APPROVAL' | 'PAUSING' | 'PAUSED'
  | 'RESUMING' | 'BLOCKED' | 'VERIFYING' | 'RECOVERING'
  | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INVALIDATED';

type AttemptState =
  | 'QUEUED' | 'STARTING' | 'RUNNING' | 'CHECKPOINTING'
  | 'WAITING_FOR_APPROVAL' | 'PAUSING' | 'PAUSED'
  | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT' | 'UNCERTAIN';

type WorkerRole =
  | 'GENERALIST'
  | 'SOFTWARE_ENGINEER'
  | 'RESEARCHER'
  | 'VERIFIER'
  | 'SYNTHESIZER'
  | 'DATA_ANALYST';

type RecoveryPolicy =
  | 'SAFE_TO_RETRY'
  | 'VERIFY_THEN_RESUME'
  | 'REQUIRES_USER'
  | 'DO_NOT_AUTO_RESUME';

type PreemptionPolicy =
  | 'PREEMPTIBLE'
  | 'SAFE_POINT_ONLY'
  | 'TEMPORARILY_NON_PREEMPTIBLE';

interface Mission {
  missionId: MissionId;
  title: string;
  goal: string;
  state: MissionState;
  projectIds: ProjectId[];
  activeGraphVersion: number | null;
  authorityEnvelopeId: AuthorityEnvelopeId;
  priority: Priority;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  version: number;
}

interface Task {
  taskId: TaskId;
  missionId: MissionId;
  graphVersion: number;
  title: string;
  goal: string;
  state: TaskState;
  role: WorkerRole;
  executionScope: ExecutionScope;
  dataPolicy: DataPolicy;
  priority: Priority;
  authorityEnvelopeId: AuthorityEnvelopeId;
  recoveryPolicy: RecoveryPolicy;
  preemptionPolicy: PreemptionPolicy;
  acceptanceCriteria: AcceptanceCriterion[];
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  version: number;
}

interface TaskAttempt {
  attemptId: AttemptId;
  taskId: TaskId;
  state: AttemptState;
  providerId: ProviderId;
  providerVersion?: string;
  modelId?: string;
  platform: PlatformRuntimeIdentity;
  startedAt?: UtcTimestamp;
  endedAt?: UtcTimestamp;
  retryOfAttemptId?: AttemptId;
  routingReason: string;
  error?: JarvisError;
}
```

`RESUMING` is one durable TaskState. It is not a transient alias outside the state model.

---

# 14. ACCEPTANCE AND GRAPH VERSIONING

```ts
type CriterionType =
  | 'TEST' | 'COMMAND' | 'FILE_STATE' | 'LIVE_STATE'
  | 'SCHEMA' | 'REVIEW' | 'CUSTOM';

type CriterionVerdict = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

interface AcceptanceCriterion {
  id: string;
  type: CriterionType;
  description: string;
  required: boolean;
  verifier: Record<string, unknown>;
}

interface CriterionResult {
  criterionId: string;
  verdict: CriterionVerdict;
  evidence: ArtifactRef[];
  summary: string;
  verifiedAt: UtcTimestamp;
  verifierType:
    | 'DETERMINISTIC'
    | 'LIVE_STATE'
    | 'INDEPENDENT_AI'
    | 'PRODUCER_SELF_CHECK';
}

type DependencyType =
  | 'REQUIRES_SUCCESS'
  | 'REQUIRES_COMPLETION'
  | 'REQUIRES_OUTPUT'
  | 'OPTIONAL_INPUT';

interface TaskDependency {
  fromTaskId: TaskId;
  toTaskId: TaskId;
  type: DependencyType;
  outputKey?: string;
}

interface MissionAcceptancePolicy {
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

Activated graph versions are immutable. Core validates acyclicity, dependencies, scope coherence, acceptance policy, and authority before activation.

---

# 15. CHECKPOINTS, ARTIFACTS, RESULTS

```ts
interface ArtifactRef {
  artifactId: ArtifactId;
  logicalType: string;
  contentType: string;
  size: number;
  sha256?: string;
  dataPolicy: DataPolicy;
}

interface ProviderResumeReference {
  providerId: ProviderId;
  providerVersion?: string;
  modelId?: string;
  handle: string;
  createdAt: UtcTimestamp;
  lastVerifiedAt?: UtcTimestamp;
}

interface WorkerCheckpoint {
  checkpointId: UUIDv7;
  taskId: TaskId;
  attemptId: AttemptId;
  sequence: number;
  createdAt: UtcTimestamp;
  goalSummary: string;
  completedWork: string[];
  decisions: string[];
  findings: string[];
  artifacts: ArtifactRef[];
  verificationState: CriterionResult[];
  currentActivity: string;
  nextStep?: string;
  blockers: string[];
  liveStateAssumptions: string[];
  providerResume?: ProviderResumeReference;
}

type WorkerResultKind =
  | 'COMPLETION_PROPOSAL'
  | 'BLOCKED'
  | 'REPLAN_REQUESTED'
  | 'FAILED';

interface WorkerResult {
  schemaVersion: 1;
  kind: WorkerResultKind;
  taskId: TaskId;
  attemptId: AttemptId;
  summary: string;
  findings: string[];
  artifacts: ArtifactRef[];
  criterionResults: CriterionResult[];
  unresolvedRisks: string[];
  proposedNextActions: string[];
}
```

Provider resume handles are opaque potentially expiring capability material. They are optional continuity optimizations, not durable task truth.

---

# 16. TOOL MANIFEST AND OUTCOMES

```ts
type RiskClass = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

type SideEffectClass =
  | 'READ_ONLY'
  | 'REVERSIBLE_WRITE'
  | 'EXTERNAL_WRITE'
  | 'DESTRUCTIVE';

type ToolCheckKind =
  | 'STATE_QUERY'
  | 'FILE_STATE'
  | 'PROCESS_STATE'
  | 'INTEGRATION_STATE'
  | 'CUSTOM_VERIFIER';

interface ToolCheckSpec {
  checkId: string;
  kind: ToolCheckKind;
  verifierId: string;
  parametersSchemaId: string;
  required: boolean;
  timeoutMs?: number;
  onUnknown: 'FAIL' | 'UNCERTAIN';
}

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
  allowedScopeKinds: ExecutionScope['kind'][];
  secretCapabilities: string[];
  networkRequired: boolean;
  requiredPlatformCapabilities: string[];
  platformCompatibility?: PlatformCompatibility[];
  idempotency:
    | 'IDEMPOTENT'
    | 'IDEMPOTENCY_KEY'
    | 'NON_IDEMPOTENT'
    | 'UNKNOWN';
  preconditions: ToolCheckSpec[];
  postconditions: ToolCheckSpec[];
  preemptionPolicy: PreemptionPolicy;
}

interface ToolRequest {
  toolExecutionId: UUIDv7;
  toolId: string;
  toolVersion: number;
  taskId?: TaskId;
  executionScope: ExecutionScope;
  authorityEnvelopeId: AuthorityEnvelopeId;
  arguments: Record<string, unknown>;
  idempotencyKey?: string;
}

type ToolOutcome = 'SUCCEEDED' | 'FAILED' | 'DENIED' | 'CANCELLED' | 'UNCERTAIN';

interface ToolResult {
  toolExecutionId: UUIDv7;
  outcome: ToolOutcome;
  output?: Record<string, unknown>;
  artifacts?: ArtifactRef[];
  preconditions?: CriterionResult[];
  postconditions?: CriterionResult[];
  error?: JarvisError;
  startedAt: UtcTimestamp;
  endedAt: UtcTimestamp;
}
```

A missing/invalid manifest blocks AI execution. Consequential success requires declared postcondition evidence or explicit `UNCERTAIN` semantics.

Platform compatibility/technical availability is not action authority.

---

# 17. PERMISSION DECISION

```ts
type PermissionOutcome = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

interface PermissionDecision {
  decisionId: UUIDv7;
  toolExecutionId?: UUIDv7;
  taskId?: TaskId;
  outcome: PermissionOutcome;
  contextualRisk: RiskClass;
  reasonCodes: string[];
  matchedPolicyIds: string[];
  matchedPrecedentIds: UUIDv7[];
  approvalRequestId?: ApprovalId;
  decidedAt: UtcTimestamp;
  policyVersion: number;
}
```

Only deterministic Core policy produces an authoritative PermissionDecision.

---

# 18. CANONICAL ACTION DESCRIPTOR AND APPROVAL

```ts
interface CanonicalTargetRef {
  system: string;
  accountId?: string;
  environmentId?: string;
  resourceType: string;
  resourceId: string;
}

interface CanonicalActionDescriptorV1 {
  domain: 'jarvis.approval.action.v1';
  descriptorVersion: 1;
  toolId: string;
  toolVersion: number;
  actionClass: ActionClass;
  sideEffectClass: SideEffectClass;
  executionScope: ExecutionScope;
  targets: CanonicalTargetRef[];
  arguments: Record<string, unknown>;
  integrationBindings?: Array<{
    integrationId: IntegrationId;
    accountId: IntegrationAccountId;
  }>;
  authorityEnvelopeId: AuthorityEnvelopeId;
  policySnapshotVersion: number;
}

interface ApprovalRequest {
  approvalId: ApprovalId;
  kind: 'HIGH_RISK' | 'DESTRUCTIVE_FINAL_CONFIRMATION';
  descriptorVersion: 1;
  actionDigestAlgorithm: 'SHA-256';
  actionDigestEncoding: 'BASE64URL_NOPAD';
  actionDigest: string;
  actionSummary: string;
  targetSummary: string;
  environmentSummary?: string;
  consequenceSummary: string;
  createdAt: UtcTimestamp;
  expiresAt: UtcTimestamp;
}

type ApprovalStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED'
  | 'EXPIRED' | 'CANCELLED' | 'CONSUMED';
```

The digest pipeline is exactly:

```text
CanonicalActionDescriptorV1
→ schema validation
→ RFC 8785 JCS canonical JSON
→ UTF-8 bytes
→ SHA-256
→ base64url without padding
```

Canonicalization rejects duplicate object keys before materialization, non-finite numbers, negative zero, invalid Unicode, and unsafe numeric ambiguity. High-precision domain values use schema-defined integer/decimal strings.

Immediately before approval consumption JARVIS freshly resolves material identities/arguments, rebuilds the descriptor, recomputes the digest, and rejects any mismatch. Digest equality never bypasses expiry, single-use, session/policy, or transactional consumption checks.

Raw credentials never enter the descriptor.

---

# 19. PROVIDER SETUP, COMPATIBILITY, HEALTH, RESOURCES, PLATFORM

```ts
type ProviderSetupState =
  | 'NOT_REQUIRED'
  | 'SETUP_REQUIRED'
  | 'SETUP_IN_PROGRESS'
  | 'SETUP_READY'
  | 'REPAIR_REQUIRED'
  | 'SETUP_FAILED';

type ProviderCompatibilityState =
  | 'NOT_DETECTED'
  | 'VERSION_UNKNOWN'
  | 'VERSION_UNSUPPORTED'
  | 'CONFORMANCE_UNQUALIFIED'
  | 'COMPATIBLE';

type ProviderHealth =
  | 'STARTING'
  | 'READY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'FAILED';

interface ProviderCapabilities {
  naturalLanguage?: boolean;
  structuredOutput?: boolean;
  toolUse?: boolean;
  coding?: boolean;
  research?: boolean;
  vision?: boolean;
  streaming?: boolean;
  resumableSession?: boolean;
  maxContextTokens?: number;
  locality: 'LOCAL' | 'CLOUD' | 'LAN';
}

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
  adapterVersion: string;
  providerVersion?: string;
  modelId?: string;
  platform: PlatformRuntimeIdentity;
  setup: ProviderSetupState;
  compatibility: ProviderCompatibilityState;
  capabilities: ProviderCapabilities;
  costClass: 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  latencyClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  health: ProviderHealth;
  resources?: ProviderResourceProfile;
}

interface ProviderCompatibilityPolicy {
  providerId: ProviderId;
  adapterVersion: string;
  platformCompatibility: PlatformCompatibility[];
  acceptedVersions: Array<
    | { kind: 'EXACT'; version: string }
    | { kind: 'RANGE'; range: string }
  >;
  deniedVersions?: string[];
  requiredCapabilities: string[];
  conformanceProfileId: string;
  setupPolicyId?: string;
}
```

`SUPPORTED` requires compatible version/interface, required setup ready, current health/auth/capabilities, matching platform/runtime role, and platform-specific conformance evidence where native behavior matters. Executable presence alone is insufficient.

---

# 20. MODULE EXECUTION AND MANIFEST

```ts
type ModuleExecutionClass =
  | 'DATA_ONLY'
  | 'BUILT_IN_TRUSTED'
  | 'EXTERNAL_MANAGED';

type ModuleHealthCheck =
  | { kind: 'PROCESS_READY'; timeoutMs: number }
  | { kind: 'IPC_PROBE'; method: string; timeoutMs: number }
  | { kind: 'HTTP_LOCAL_PROBE'; endpointId: string; timeoutMs: number };

interface ModuleLifecycleMetadata {
  activationBoundary: 'SAFE_BOUNDARY' | 'APP_RESTART';
  rollbackSupported: boolean;
  retainsPreviousVersion: boolean;
}

interface ModuleManifest {
  moduleId: ModuleId;
  version: string;
  displayName: string;
  publisher: string;
  source: string;
  executionClass: ModuleExecutionClass;
  compatibility: {
    jarvis: string;
    platforms: PlatformCompatibility[];
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
    catalogEntryId: string;
    catalogSignature: string;
    catalogKeyId: string;
  };
  lifecycle: ModuleLifecycleMetadata;
}

interface ModuleCapabilityEnvelope {
  moduleId: ModuleId;
  moduleVersion: string;
  allowedApiIds: string[];
  projectIds: ProjectId[];
  environmentIds: EnvironmentId[];
  credentialCapabilities: string[];
  networkPolicyId?: string;
  sensitivity: DataSensitivity;
  locality: DataLocality;
  resourcePolicyId?: string;
}
```

There is no untrusted-in-process execution class. `HTTP_LOCAL_PROBE.endpointId` resolves only to a supervisor-registered local endpoint, never an arbitrary URL.

Platform compatibility does not itself enable/install/authorize a module.

---

# 21. INTEGRATION ACCOUNT, GITHUB, AND PROXMOX

```ts
interface IntegrationAccount {
  integrationId: IntegrationId;
  accountId: IntegrationAccountId;
  displayName: string;
  tenantOrDomain?: string;
  credentialHandle: string;
  enabledCapabilities: string[];
  grantedScopes: string[];
  status: 'CONNECTED' | 'DEGRADED' | 'REAUTH_REQUIRED' | 'DISABLED' | 'ERROR';
  lastVerifiedAt?: UtcTimestamp;
}

type GitHubCapability =
  | 'GITHUB_REPOSITORY_READ'
  | 'GITHUB_REF_READ'
  | 'GITHUB_REF_WRITE'
  | 'GITHUB_PULL_REQUEST_READ'
  | 'GITHUB_PULL_REQUEST_WRITE'
  | 'GITHUB_ISSUE_READ'
  | 'GITHUB_COMMENT_WRITE'
  | 'GITHUB_CHECKS_READ'
  | 'GITHUB_ACTIONS_READ'
  | 'GITHUB_ACTIONS_DISPATCH';

type ProxmoxCapability =
  | 'PROXMOX_READ'
  | 'PROXMOX_POWER_CONTROL'
  | 'PROXMOX_SNAPSHOT'
  | 'PROXMOX_BACKUP'
  | 'PROXMOX_GUEST_CONFIG'
  | 'PROXMOX_GUEST_CREATE'
  | 'PROXMOX_MIGRATE'
  | 'PROXMOX_STORAGE_WRITE'
  | 'PROXMOX_NETWORK_WRITE'
  | 'PROXMOX_DESTROY';

interface ProxmoxConnection {
  connectionId: ConnectionId;
  displayName: string;
  endpoint: string;
  credentialHandle: string;
  tlsTrust:
    | { mode: 'SYSTEM_CA' }
    | { mode: 'PINNED_SHA256'; fingerprint: string };
  environmentId: EnvironmentId;
  enabledCapabilities: ProxmoxCapability[];
  allowedNodes?: string[];
  allowedVmids?: number[];
  allowedPools?: string[];
  status: 'CONNECTED' | 'DEGRADED' | 'REAUTH_REQUIRED' | 'DISABLED' | 'ERROR';
  lastVerifiedAt?: UtcTimestamp;
}

interface ProxmoxGuestIdentity {
  connectionId: ConnectionId;
  environmentId: EnvironmentId;
  nodeId: string;
  guestType: 'QEMU' | 'LXC';
  vmid: number;
}
```

GitHub/Proxmox capability support claims are governed by the active Release Profile and platform support matrix. Modeling a capability does not mean the current release/platform supports it.

Proxmox control-plane identity is separate from guest OS connection/credential identity.

---

# 22. PROVIDER QUOTA, USAGE, BUDGET RESERVATION

```ts
type ProviderQuotaType =
  | 'MONETARY' | 'TOKENS' | 'REQUESTS'
  | 'COMPUTE' | 'SUBSCRIPTION_ALLOWANCE' | 'OTHER';

type ProviderQuotaSource = 'PROVIDER_REPORTED' | 'JARVIS_CALCULATED' | 'UNKNOWN';

interface ProviderQuotaSnapshot {
  snapshotId: UUIDv7;
  providerId: ProviderId;
  modelId?: string;
  accountId?: UUIDv7;
  quotaType: ProviderQuotaType;
  unit: string;
  limit?: CanonicalQuantity;
  used?: CanonicalQuantity;
  remaining?: CanonicalQuantity;
  resetsAt?: UtcTimestamp;
  observedAt: UtcTimestamp;
  source: ProviderQuotaSource;
}

type CostConfidence =
  | 'ESTIMATED'
  | 'PROVIDER_REPORTED'
  | 'JARVIS_CALCULATED'
  | 'SETTLED'
  | 'UNKNOWN';

interface UsageRecord {
  usageId: UUIDv7;
  providerId: ProviderId;
  modelId?: string;
  projectId?: ProjectId;
  missionId?: MissionId;
  taskId?: TaskId;
  attemptId?: AttemptId;
  units?: Record<string, CanonicalQuantity>;
  estimatedCost?: MoneyAmount;
  actualCost?: MoneyAmount;
  costConfidence: CostConfidence;
  pricingSnapshotId?: UUIDv7;
  occurredAt: UtcTimestamp;
}

interface BudgetPolicy {
  budgetId: UUIDv7;
  scopeType: 'GLOBAL' | 'PROJECT' | 'MISSION' | 'PROVIDER';
  scopeId?: string;
  limit: MoneyAmount;
  warningAtBasisPoints: number;
  hardLimit: boolean;
  period: 'MISSION' | 'DAY' | 'MONTH' | 'CUSTOM';
}

type BudgetReservationState =
  | 'RESERVED' | 'SETTLED' | 'RELEASED' | 'EXPIRED' | 'UNCERTAIN';

interface BudgetReservation {
  reservationId: UUIDv7;
  budgetId: UUIDv7;
  providerId: ProviderId;
  taskId?: TaskId;
  attemptId?: AttemptId;
  amount: MoneyAmount;
  state: BudgetReservationState;
  createdAt: UtcTimestamp;
  expiresAt?: UtcTimestamp;
  settledUsageId?: UUIDv7;
}
```

Different currencies SHALL not be added without a separately defined conversion policy.

---

# 23. DOMAIN EVENTS

```ts
interface DomainEvent<T = unknown> {
  eventId: EventId;
  occurredAt: UtcTimestamp;
  type: string;
  payloadVersion: number;
  aggregateType: string;
  aggregateId: string;
  correlationId: UUIDv7;
  causationId?: UUIDv7;
  actorType:
    | 'USER' | 'CORE' | 'WORKER' | 'PROVIDER'
    | 'INTEGRATION' | 'MODULE' | 'SYSTEM';
  actorId?: string;
  payload: T;
}
```

Event payloads are independently versioned. Authoritative events use stable dot-notation names.

---

# 24. NOTIFICATION AND CONFIGURATION

```ts
type NotificationSeverity = 'CRITICAL' | 'IMPORTANT' | 'NORMAL' | 'LOW_VALUE';
type NotificationChannel = 'VOICE' | 'DESKTOP' | 'DASHBOARD' | 'SILENT';

interface NotificationDecision {
  notificationId: UUIDv7;
  severity: NotificationSeverity;
  channels: NotificationChannel[];
  title: string;
  body: string;
  dataPolicy: DataPolicy;
  deferUntilUnlocked: boolean;
}
```

Configuration domains are typed/versioned and include at least startup, session security, voice, providers, privacy, permissions, budgets, projects, modules, integrations, notifications, retention, updates, platform backend profile, and developer mode. Normal configuration never accepts raw secrets.

---

# 25. CRYPTOGRAPHIC CANONICALIZATION RULES

Security-material canonicalization is one shared implementation contract.

Required Rust/TypeScript golden vectors cover:

- property order invariance;
- Unicode;
- optional/empty fields;
- canonical IDs/paths/resources;
- integration/account bindings;
- target/environment/argument/tool-version changes;
- duplicate-key rejection;
- NaN/infinity/negative-zero rejection;
- unsafe numeric precision rejection/string representation;
- expired approval rejection despite matching digest;
- second consumption/replay rejection;
- secret exclusion.

No adapter/tool chooses its own approval material field set.

---

# 26. PROTOCOL COMPATIBILITY

After the first production protocol-major 1 release:

- adding optional fields is compatible only if receivers safely ignore them;
- removing/renaming required fields is breaking;
- changing the meaning of an enum value is breaking;
- adding enum values requires safe unknown handling or version negotiation;
- breaking IPC changes require protocol-major bump;
- persisted events retain independent `payloadVersion`;
- persistence schema changes follow migration rules even if IPC is unchanged.

Host and Core SHALL establish a mutually supported protocol major before normal operation.

Contract-suite version changes do not automatically require an IPC protocol-major change when wire compatibility is preserved.

The v1.0.4 contract changes occur before the first production protocol-major-1 release, so platform-neutralizing the pre-production schema does not require protocol major 2.

---

# 27. SCHEMA QUALIFICATION

CI/release qualification SHALL prove:

- positive and negative fixtures for every boundary schema;
- Rust/TypeScript round-trip compatibility;
- explicit IpcResponse union behavior;
- PlatformFamily/RuntimeRole/PlatformRuntimeIdentity validation;
- PlatformPathRef cannot be interpreted by the wrong platform path backend without explicit migration/import;
- provider/module/tool platform compatibility schemas;
- one durable `RESUMING` enum meaning;
- execution-scope enforcement;
- sensitivity/locality propagation;
- exact money arithmetic/serialization;
- Argon2id profile validation and under-floor production rejection;
- provider setup/compatibility/health/platform separation;
- module execution-class/health/lifecycle/platform validation;
- approval canonicalization/digest vectors;
- GitHub/Proxmox capability schemas;
- Proxmox identity schemas;
- unbounded arbitrary AI/external fields are not introduced;
- secret-bearing fields are absent from AI/UI-safe views.

---

# 28. GOVERNING RULES

> **Cross a boundary only with a versioned, validated, bounded contract.**

> **Authorize the canonical resolved action, not ambiguous display text.**

> **Provider setup, compatibility, health, capability, platform support, and authorization are different facts.**

> **Platform identity belongs in typed compatibility/state, not scattered native assumptions.**

---

**END — JARVIS PROTOCOL & SCHEMA CONTRACT v1.0.4**
