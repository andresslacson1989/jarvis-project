# JARVIS Protocol & Schema Contract

**Status:** Normative implementation reference  
**Version:** 1.0  
**Date:** August 11, 2026

This document defines canonical cross-boundary data contracts for JARVIS. Runtime code MAY use generated/inferred language types, but all messages crossing process, persistence-event, provider, tool, or module boundaries SHALL be validated against versioned schemas.

---

# 1. SCHEMA POLICY

Canonical runtime schemas SHALL live in `packages/schemas` and protocol/event types in `packages/protocol`.

JSON-compatible schemas SHALL be authoritative at trust boundaries.

TypeScript types SHALL be generated from or declared alongside runtime validators so compile-time and runtime shapes cannot silently diverge.

Rust/Tauri IPC types SHALL map explicitly to the same protocol version.

Unknown optional fields MAY be ignored only when protocol compatibility rules allow it. Unknown required message kinds/versions SHALL fail closed.

---

# 2. COMMON TYPES

```ts
type UUIDv7 = string;
type UtcTimestamp = string; // ISO-8601 UTC

type ProjectId = UUIDv7;
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
```

All IDs SHALL be validated before use.

---

# 3. IPC ENVELOPE

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
```

Responses SHALL use the request `id`.

Events SHALL use `id: null` unless a transport implementation chooses to assign an event-message id in addition to the domain event id inside payload.

---

# 4. ERROR ENVELOPE

All cross-boundary errors SHALL normalize to:

```ts
type ErrorCategory =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION'
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
  message: string;          // sanitized user/developer-safe message
  retryable: boolean;
  details?: Record<string, unknown>; // MUST be secret-safe
  correlationId: UUIDv7;
}
```

Provider-native raw errors SHALL be mapped before crossing into generic Core/UI layers.

---

# 5. SESSION STATE

```ts
type SessionTrustState = 'LOCKED' | 'UNLOCKING' | 'UNLOCKED' | 'LOCKING';

interface SessionState {
  state: SessionTrustState;
  sessionId: UUIDv7 | null;
  unlockedAt: UtcTimestamp | null;
  lockedReason: 'STARTUP' | 'USER' | 'WINDOWS_LOCK' | 'SIGN_OUT' | 'IDLE' | 'SECURITY' | null;
}
```

No secret/verifier material SHALL appear in this structure.

---

# 6. USER INPUT

```ts
type InputModality = 'TEXT' | 'VOICE';

interface UserInstruction {
  id: UUIDv7;
  sessionId: UUIDv7;
  modality: InputModality;
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

Voice transcript confidence is informational and SHALL NOT replace target/permission validation.

---

# 7. ORCHESTRATOR DECISION

The orchestrator SHALL return one normalized decision:

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
  rationaleSummary?: string; // concise decision summary, not chain-of-thought
  confidence?: number;
  payload: Record<string, unknown>;
}
```

`payload` SHALL be revalidated against an action-specific schema before Core uses it.

---

# 8. PROJECT

```ts
interface ProjectRef {
  projectId: ProjectId;
  name: string;
  workspaceId?: UUIDv7;
  environmentId?: UUIDv7;
}

interface Project {
  projectId: ProjectId;
  name: string;
  aliases: string[];
  rootPath: string;
  defaultEnvironmentId?: UUIDv7;
  defaultBranch?: string;
  enabled: boolean;
  version: number;
}
```

Paths SHALL be canonicalized by trusted runtime code before use.

---

# 9. AUTHORITY ENVELOPE

```ts
type PrivacyClass = 'PUBLIC' | 'PRIVATE' | 'SENSITIVE' | 'LOCAL_ONLY';

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
  projectIds: ProjectId[];
  workspaceIds: UUIDv7[];
  environmentIds: UUIDv7[];
  allowedActionClasses: ActionClass[];
  deniedActionClasses: ActionClass[];
  externalSystems: string[];
  privacyClass: PrivacyClass;
  maxBudget?: {
    amount: number;
    currency: string;
  };
  createdAt: UtcTimestamp;
  expiresAt?: UtcTimestamp;
  policySnapshotVersion: number;
}
```

Workers receive this as immutable input.

---

# 10. MISSION

```ts
type MissionState =
  | 'CREATED'
  | 'PLANNING'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_FOR_USER'
  | 'WAITING_FOR_APPROVAL'
  | 'PAUSING'
  | 'PAUSED'
  | 'BLOCKED'
  | 'VERIFYING'
  | 'RECOVERING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

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
```

---

# 11. TASK

```ts
type TaskState =
  | 'CREATED'
  | 'WAITING_FOR_DEPENDENCY'
  | 'QUEUED'
  | 'STARTING'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'PAUSING'
  | 'PAUSED'
  | 'BLOCKED'
  | 'VERIFYING'
  | 'RECOVERING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'INVALIDATED';

type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';

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

interface Task {
  taskId: TaskId;
  missionId: MissionId;
  graphVersion: number;
  title: string;
  goal: string;
  state: TaskState;
  role: WorkerRole;
  projectId: ProjectId;
  workspaceId: UUIDv7;
  environmentId?: UUIDv7;
  priority: Priority;
  authorityEnvelopeId: AuthorityEnvelopeId;
  recoveryPolicy: RecoveryPolicy;
  preemptionPolicy: PreemptionPolicy;
  acceptanceCriteria: AcceptanceCriterion[];
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  version: number;
}
```

---

# 12. ACCEPTANCE CRITERION

```ts
type CriterionType =
  | 'TEST'
  | 'COMMAND'
  | 'FILE_STATE'
  | 'LIVE_STATE'
  | 'SCHEMA'
  | 'REVIEW'
  | 'CUSTOM';

interface AcceptanceCriterion {
  id: string;
  type: CriterionType;
  description: string;
  required: boolean;
  verifier: Record<string, unknown>;
}

type CriterionVerdict = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

interface CriterionResult {
  criterionId: string;
  verdict: CriterionVerdict;
  evidence: ArtifactRef[];
  summary: string;
  verifiedAt: UtcTimestamp;
  verifierType: 'DETERMINISTIC' | 'LIVE_STATE' | 'INDEPENDENT_AI' | 'PRODUCER_SELF_CHECK';
}
```

Required `UNKNOWN` criteria prevent normal completion unless an explicit policy states otherwise.

---

# 13. GRAPH

```ts
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

interface MissionGraphVersion {
  missionId: MissionId;
  version: number;
  createdAt: UtcTimestamp;
  reason: string;
  causationEventId: EventId;
  taskIds: TaskId[];
  edges: TaskDependency[];
}
```

Core SHALL validate acyclicity before activation.

---

# 14. TASK ATTEMPT

```ts
type AttemptState =
  | 'QUEUED'
  | 'STARTING'
  | 'RUNNING'
  | 'CHECKPOINTING'
  | 'WAITING_FOR_APPROVAL'
  | 'PAUSING'
  | 'PAUSED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT'
  | 'UNCERTAIN';

interface TaskAttempt {
  attemptId: AttemptId;
  taskId: TaskId;
  state: AttemptState;
  providerId: ProviderId;
  modelId?: string;
  startedAt?: UtcTimestamp;
  endedAt?: UtcTimestamp;
  retryOfAttemptId?: AttemptId;
  routingReason: string;
  error?: JarvisError;
}
```

---

# 15. WORKER CHECKPOINT

```ts
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
  providerResumeHandle?: string;
}
```

This SHALL not contain private chain-of-thought.

---

# 16. ARTIFACT

```ts
interface ArtifactRef {
  artifactId: ArtifactId;
  logicalType: string;
  contentType: string;
  size: number;
  sha256?: string;
  sensitivity: 'PUBLIC' | 'PRIVATE' | 'SENSITIVE';
}
```

Direct file paths SHOULD remain internal where possible; workers/UI receive an artifact reference and request resolved access through Core.

---

# 17. WORKER RESULT

```ts
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

Core decides final task state.

---

# 18. TOOL MANIFEST

```ts
type RiskClass = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
type SideEffectClass = 'READ_ONLY' | 'REVERSIBLE_WRITE' | 'EXTERNAL_WRITE' | 'DESTRUCTIVE';

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
  preemptionPolicy: PreemptionPolicy;
}
```

---

# 19. TOOL REQUEST AND RESULT

```ts
interface ToolRequest {
  toolExecutionId: UUIDv7;
  toolId: string;
  taskId?: TaskId;
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
  postconditions?: CriterionResult[];
  error?: JarvisError;
  startedAt: UtcTimestamp;
  endedAt: UtcTimestamp;
}
```

---

# 20. PERMISSION DECISION

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

AI SHALL never produce an authoritative `PermissionDecision`.

---

# 21. APPROVAL

```ts
interface ApprovalRequest {
  approvalId: ApprovalId;
  kind: 'HIGH_RISK' | 'DESTRUCTIVE_FINAL_CONFIRMATION';
  actionDigest: string; // SHA-256 over canonical material action data
  actionSummary: string;
  targetSummary: string;
  environmentSummary?: string;
  consequenceSummary: string;
  createdAt: UtcTimestamp;
  expiresAt: UtcTimestamp;
}

type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' | 'CONSUMED';

interface ApprovalDecision {
  approvalId: ApprovalId;
  status: ApprovalStatus;
  decidedAt?: UtcTimestamp;
  sessionId?: UUIDv7;
}
```

---

# 22. PROVIDER PROFILE

```ts
type ProviderHealth = 'STARTING' | 'READY' | 'DEGRADED' | 'UNAVAILABLE' | 'FAILED';

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

interface ProviderProfile {
  providerId: ProviderId;
  adapterType: string;
  modelId?: string;
  capabilities: ProviderCapabilities;
  costClass: 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  latencyClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  health: ProviderHealth;
}
```

---

# 23. DOMAIN EVENT

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
  actorType: 'USER' | 'CORE' | 'WORKER' | 'PROVIDER' | 'INTEGRATION' | 'SYSTEM';
  actorId?: string;
  payload: T;
}
```

Event type names SHALL use stable dot notation, for example:

```text
session.locked
mission.created
mission.graph_revised
task.queued
task.started
task.paused
task.completed
worker.activity_changed
worker.checkpoint_created
provider.health_changed
tool.approval_required
tool.completed
budget.hard_limit_reached
backup.completed
recovery.action_required
```

---

# 24. MODULE MANIFEST

```ts
interface ModuleManifest {
  moduleId: ModuleId;
  version: string;
  displayName: string;
  publisher: string;
  source: string;
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
  healthCheck: string;
  integrity: {
    sha256: string;
    signature?: string;
  };
}
```

---

# 25. INTEGRATION ACCOUNT

```ts
interface IntegrationAccount {
  integrationId: IntegrationId;
  accountId: UUIDv7;
  displayName: string;
  tenantOrDomain?: string;
  credentialHandle: string;
  enabledCapabilities: string[];
  grantedScopes: string[];
  status: 'CONNECTED' | 'REAUTH_REQUIRED' | 'DISABLED' | 'ERROR';
  lastVerifiedAt?: UtcTimestamp;
}
```

`credentialHandle` is opaque and SHALL not resolve inside AI context/UI.

---

# 26. USAGE/BUDGET

```ts
interface UsageRecord {
  usageId: UUIDv7;
  providerId: ProviderId;
  modelId?: string;
  projectId?: ProjectId;
  missionId?: MissionId;
  taskId?: TaskId;
  attemptId?: AttemptId;
  units?: Record<string, number>;
  estimatedCost?: number;
  actualCost?: number;
  currency?: string;
  occurredAt: UtcTimestamp;
}

interface BudgetPolicy {
  budgetId: UUIDv7;
  scopeType: 'GLOBAL' | 'PROJECT' | 'MISSION' | 'PROVIDER';
  scopeId?: string;
  amount: number;
  currency: string;
  warningAtPercent: number;
  hardLimit: boolean;
  period: 'MISSION' | 'DAY' | 'MONTH' | 'CUSTOM';
}
```

---

# 27. NOTIFICATION

```ts
type NotificationSeverity = 'CRITICAL' | 'IMPORTANT' | 'NORMAL' | 'LOW_VALUE';
type NotificationChannel = 'VOICE' | 'DESKTOP' | 'DASHBOARD' | 'SILENT';

interface NotificationDecision {
  notificationId: UUIDv7;
  severity: NotificationSeverity;
  channels: NotificationChannel[];
  title: string;
  body: string;
  sensitive: boolean;
  deferUntilUnlocked: boolean;
}
```

---

# 28. CONFIGURATION

User configuration SHALL be divided into typed domains rather than one arbitrary free-form object:

```text
startup
session_security
voice
providers
privacy
permissions
budgets
projects
modules
integrations
notifications
retention
updates
developer_mode
```

Every configuration domain SHALL carry a schema version.

Invalid changed configuration SHALL be rejected atomically and the last valid configuration retained.

Secrets SHALL never be accepted in normal configuration schemas.

---

# 29. PROTOCOL COMPATIBILITY

Protocol evolution rules:

- adding optional fields is backward-compatible within a protocol major version;
- renaming/removing required fields is breaking;
- changing meaning of an existing enum value is breaking;
- adding enum values requires consumers to handle unknown/future values safely or protocol version negotiation;
- breaking IPC changes require protocol-major bump;
- persisted event payloads SHALL keep their own `payloadVersion` independent of IPC version.

The host and Core SHALL negotiate exact supported protocol-major version at startup.

---

# 30. VALIDATION LIMITS

Schemas SHALL include bounded limits for attacker-controlled or AI-controlled strings, arrays, and object depth where practical.

Examples:

- names/titles: bounded length;
- tool argument arrays: bounded;
- IPC frame: bounded;
- event payload: bounded;
- artifact upload/reference size: checked separately;
- recursive arbitrary JSON from AI: disallowed unless an explicitly bounded schema requires it.

Validation SHALL occur before expensive processing.

---

# 31. CANONICALIZATION

Action digests, idempotency keys, signatures, and approval binding SHALL use deterministic canonical serialization of material fields.

Filesystem targets SHALL be canonicalized before digest/authorization.

Environment/project IDs, not display names, SHALL be used in consequential action digests.

---

# 32. SCHEMA TESTING

CI SHALL verify:

- every schema has positive/negative fixtures;
- TypeScript types and runtime validators agree;
- Rust IPC structs serialize compatibly for shared messages;
- breaking changes cause protocol/schema version updates;
- unbounded AI/external fields are not introduced accidentally;
- secret-bearing fields are absent from AI-visible event/view models.

---

# 33. GOVERNING RULE

> **Cross a boundary only with a versioned, validated, bounded contract.**

---

**END — JARVIS PROTOCOL & SCHEMA CONTRACT v1.0**
