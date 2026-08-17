import type { AuthorityEnvelopeId, UUIDv7, UtcTimestamp } from "./common.js";
import type { PlatformCompatibility } from "./platform.js";
import type { ExecutionScope } from "./execution-scope.js";
import type { RiskClass } from "./authority.js";

export type ToolSideEffectClass = "READ_ONLY" | "REVERSIBLE_WRITE" | "EXTERNAL_WRITE" | "DESTRUCTIVE";
export type ToolCheckKind = "STATE_QUERY" | "FILE_STATE" | "PROCESS_STATE" | "INTEGRATION_STATE" | "CUSTOM_VERIFIER";
export type ToolIdempotency = "IDEMPOTENT" | "IDEMPOTENCY_KEY" | "NON_IDEMPOTENT" | "UNKNOWN";
export type ToolPreemptionPolicy = "PREEMPTIBLE" | "SAFE_POINT_ONLY" | "TEMPORARILY_NON_PREEMPTIBLE";
export type ToolCheckUnknownPolicy = "FAIL" | "UNCERTAIN";
export type ToolCriterionVerdict = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
export type ToolOutcome = "SUCCEEDED" | "FAILED" | "DENIED" | "CANCELLED" | "UNCERTAIN";

export interface ToolCheckSpec {
  readonly checkId: string;
  readonly kind: ToolCheckKind;
  readonly verifierId: string;
  readonly parametersSchemaId: string;
  readonly required: boolean;
  readonly timeoutMs?: number;
  readonly onUnknown: ToolCheckUnknownPolicy;
}

export interface ToolManifest {
  readonly toolId: string;
  readonly version: number;
  readonly description: string;
  readonly inputSchemaId: string;
  readonly outputSchemaId: string;
  readonly baselineRisk: RiskClass;
  readonly sideEffectClass: ToolSideEffectClass;
  readonly reversible: boolean;
  readonly requiredPermissionIds: readonly string[];
  readonly allowedEnvironments: readonly string[];
  readonly allowedScopeKinds: readonly ExecutionScope["kind"][];
  readonly secretCapabilities: readonly string[];
  readonly networkRequired: boolean;
  readonly requiredPlatformCapabilities: readonly string[];
  readonly platformCompatibility?: readonly PlatformCompatibility[];
  readonly idempotency: ToolIdempotency;
  readonly preconditions: readonly ToolCheckSpec[];
  readonly postconditions: readonly ToolCheckSpec[];
  readonly preemptionPolicy: ToolPreemptionPolicy;
}

export interface ToolRequest {
  readonly toolExecutionId: UUIDv7;
  readonly toolId: string;
  readonly toolVersion: number;
  readonly taskId?: UUIDv7;
  readonly executionScope: ExecutionScope;
  readonly authorityEnvelopeId: AuthorityEnvelopeId;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly idempotencyKey?: string;
}

export interface ToolArtifactRef {
  readonly artifactId: string;
  readonly logicalType: string;
  readonly storageRef: string;
}

export interface ToolCriterionResult {
  readonly criterionId: string;
  readonly verdict: ToolCriterionVerdict;
  readonly evidence: readonly ToolArtifactRef[];
  readonly summary: string;
  readonly verifiedAt: UtcTimestamp;
  readonly verifierType: "DETERMINISTIC" | "LIVE_STATE";
}

export interface ToolResult {
  readonly toolExecutionId: UUIDv7;
  readonly outcome: ToolOutcome;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly artifacts?: readonly ToolArtifactRef[];
  readonly preconditions?: readonly ToolCriterionResult[];
  readonly postconditions?: readonly ToolCriterionResult[];
  readonly error?: ToolError;
  readonly startedAt: UtcTimestamp;
  readonly endedAt: UtcTimestamp;
}

export interface ToolError {
  readonly code: string;
  readonly category: "VALIDATION" | "AUTHORIZATION" | "CONFLICT" | "PRECONDITION" | "POSTCONDITION" | "TOOL_FAILED" | "CANCELLED" | "INTERNAL" | "UNSUPPORTED";
  readonly message: string;
  readonly retryable: boolean;
  readonly correlationId: UUIDv7;
}

export interface ToolAdapter {
  readonly toolId: string;
  readonly toolVersion: number;
  execute(request: ToolRequest, manifest: ToolManifest, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>>;
}

export interface ToolAdmissionDecision {
  readonly outcome: "ALLOW" | "DENIED" | "UNCERTAIN";
  readonly error?: ToolError;
  readonly preconditions?: readonly ToolCriterionResult[];
}

export interface ToolExecutionHooks {
  admit(request: ToolRequest, manifest: ToolManifest): Promise<ToolAdmissionDecision>;
  evaluatePreconditions(request: ToolRequest, manifest: ToolManifest, input: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<readonly ToolCriterionResult[]>;
  evaluatePostconditions(request: ToolRequest, manifest: ToolManifest, output: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<readonly ToolCriterionResult[]>;
  recordAudit(result: ToolResult): Promise<void>;
}

export interface CanonicalTargetRef {
  readonly system: string;
  readonly accountId?: string;
  readonly environmentId?: string;
  readonly resourceType: string;
  readonly resourceId: string;
}

export interface ResolvedCanonicalTarget extends CanonicalTargetRef {
  readonly identityDigest: string;
  readonly versionToken: string;
}

export interface ToolTargetResolution {
  readonly resolutionId: string;
  readonly resolvedAt: UtcTimestamp;
  readonly descriptorDigest: string;
  readonly targetIdentityDigest: string;
  readonly targets: readonly ResolvedCanonicalTarget[];
}

export interface ToolCheckObservation {
  readonly verdict: ToolCriterionVerdict;
  readonly evidence: readonly ToolArtifactRef[];
  readonly summary: string;
  readonly verifiedAt: UtcTimestamp;
  readonly verifierType: "DETERMINISTIC" | "LIVE_STATE";
}

export interface ToolCheckVerificationContext {
  readonly request: ToolRequest;
  readonly manifest: ToolManifest;
  readonly targetResolution: ToolTargetResolution;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly output?: Readonly<Record<string, unknown>>;
}

export interface ToolCheckVerifier {
  readonly verifierId: string;
  verify(context: ToolCheckVerificationContext, parameters: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<ToolCheckObservation>;
}

export type ToolMutationState = "APPLIED" | "CONFLICT" | "UNCERTAIN";

export interface ToolConditionalMutationResult<T = Readonly<Record<string, unknown>>> {
  readonly state: ToolMutationState;
  readonly value?: T;
  readonly reasonCode: string;
}

export type ToolIdempotencyRecordState = "IN_FLIGHT" | "APPLIED" | "FAILED" | "UNCERTAIN";

export interface ToolIdempotencyRecord<T = Readonly<Record<string, unknown>>> {
  readonly idempotencyKey: string;
  readonly requestDigest: string;
  readonly state: ToolIdempotencyRecordState;
  readonly result?: T;
}

export interface ToolIdempotencyStore<T = Readonly<Record<string, unknown>>> {
  begin(idempotencyKey: string, requestDigest: string): Promise<{ readonly state: "NEW" } | { readonly state: "REPLAY" | "CONFLICT"; readonly record: ToolIdempotencyRecord<T> }>;
  finish(idempotencyKey: string, requestDigest: string, record: ToolIdempotencyRecord<T>): Promise<void>;
}
