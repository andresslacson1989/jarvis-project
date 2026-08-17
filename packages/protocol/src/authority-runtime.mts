import { validateMoneyAmount } from "./accounting-runtime.mjs";
import type { MoneyAmount } from "./accounting.ts";
import type { DataPolicy } from "./data.ts";
import { validateDataPolicy, validateExecutionScope } from "./execution-scope-runtime.mjs";
import type {
  ActionClass,
  ApprovalRequest,
  ApprovalDecision,
  AuthorityContainmentRequest,
  AuthorityEnvelope,
  CanonicalActionDescriptorV1,
  FinalDestructiveConfirmation,
  FreshTargetResolution,
  PermissionDecision,
  RiskClass,
} from "./authority.ts";

export const ACTION_CLASSES = ["READ", "LOCAL_WRITE", "EXTERNAL_WRITE", "PUBLISH", "DEPLOY", "INFRASTRUCTURE_CHANGE", "SECURITY_CHANGE", "DESTRUCTIVE"] as const satisfies readonly ActionClass[];
export const RISK_CLASSES = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const satisfies readonly RiskClass[];
export const PERMISSION_OUTCOMES = ["ALLOW", "DENY", "REQUIRE_APPROVAL"] as const;
export const APPROVAL_KINDS = ["HIGH_RISK", "DESTRUCTIVE_FINAL_CONFIRMATION"] as const;
export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "CONSUMED"] as const;
export const FRESH_EXECUTION_EVIDENCE_MAX_AGE_MS = 60_000;

export class AuthorityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorityValidationError";
  }
}

export class AuthorityContainmentError extends AuthorityValidationError {
  constructor(message: string) {
    super(message);
    this.name = "AuthorityContainmentError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new AuthorityValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) throw new AuthorityValidationError("authority record contains unsupported or missing fields");
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) throw new AuthorityValidationError(`${label} is invalid`);
  return value;
}

function text(value: unknown, label: string, max = 4096): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || value.includes("\0")) throw new AuthorityValidationError(`${label} is invalid`);
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new AuthorityValidationError(`${label} is unsupported`);
  return value as T;
}

function idArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 256) throw new AuthorityValidationError(`${label} is invalid`);
  const values = value.map((item) => id(item, label));
  if (new Set(values).size !== values.length) throw new AuthorityValidationError(`${label} contains duplicates`);
  return Object.freeze(values);
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label, 64);
  if (Number.isNaN(Date.parse(result))) throw new AuthorityValidationError(`${label} must be an ISO timestamp`);
  return result;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(value)) throw new AuthorityValidationError(`${label} is invalid`);
  return value;
}

function rejectSecretKeys(value: unknown, path = "value"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSecretKeys(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    if (/(?:password|secret|token|private[_-]?key|credential)/iu.test(key)) throw new AuthorityValidationError(`${path}.${key} cannot contain secret material`);
    rejectSecretKeys(item, `${path}.${key}`);
  }
}

function nonNegativeMoney(value: unknown, label: string): MoneyAmount {
  const amount = validateMoneyAmount(value);
  if (BigInt(amount.nanoUnits) < 0n) throw new AuthorityValidationError(`${label} must be non-negative`);
  return amount;
}

function environmentContains(container: { readonly environmentId?: string }, candidate: { readonly environmentId?: string }): boolean {
  return container.environmentId === undefined || container.environmentId === candidate.environmentId;
}

function optionalIdentityContains(container: { readonly projectId?: string; readonly environmentId?: string }, candidate: { readonly projectId?: string; readonly environmentId?: string }): boolean {
  return (container.projectId === undefined || container.projectId === candidate.projectId) &&
    (container.environmentId === undefined || container.environmentId === candidate.environmentId);
}

function scopeContains(container: AuthorityEnvelope["scopes"][number], candidate: AuthorityEnvelope["scopes"][number]): boolean {
  if (container.kind !== candidate.kind) return false;
  if (container.kind === "GLOBAL" && candidate.kind === "GLOBAL") return true;
  if (container.kind === "PROJECT_WORKSPACE" && candidate.kind === "PROJECT_WORKSPACE") {
    return container.projectId === candidate.projectId && container.workspaceId === candidate.workspaceId && environmentContains(container, candidate);
  }
  if (container.kind === "SYSTEM" && candidate.kind === "SYSTEM") {
    return environmentContains(container, candidate) && candidate.capabilityIds.every((capabilityId) => container.capabilityIds.includes(capabilityId));
  }
  if (container.kind === "INTEGRATION" && candidate.kind === "INTEGRATION") {
    if (!optionalIdentityContains(container, candidate)) return false;
    return candidate.bindings.every((candidateBinding) => container.bindings.some((containerBinding) =>
      containerBinding.integrationId === candidateBinding.integrationId &&
      containerBinding.accountId === candidateBinding.accountId &&
      candidateBinding.capabilityIds.every((capabilityId) => containerBinding.capabilityIds.includes(capabilityId))));
  }
  return false;
}

function sensitivityRank(value: DataPolicy["sensitivity"]): number {
  return ["PUBLIC", "PRIVATE", "SENSITIVE", "SECRET"].indexOf(value);
}

function dataPolicyContained(container: DataPolicy, candidate: DataPolicy): boolean {
  return sensitivityRank(candidate.sensitivity) <= sensitivityRank(container.sensitivity) &&
    (container.locality === "ANY_APPROVED_PROVIDER" || candidate.locality === "LOCAL_ONLY");
}

function budgetContained(container: MoneyAmount | undefined, candidate: MoneyAmount | undefined): boolean {
  if (candidate === undefined) return true;
  if (container === undefined || container.currency !== candidate.currency) return false;
  return BigInt(candidate.nanoUnits) <= BigInt(container.nanoUnits);
}

export function validateAuthorityEnvelope(value: unknown): AuthorityEnvelope {
  const input = record(value, "authority envelope");
  keys(input, ["id", "originatingInstructionId", "scopes", "allowedActionClasses", "deniedActionClasses", "externalSystems", "dataPolicy", "createdAt", "policySnapshotVersion"], ["maxBudget", "expiresAt"]);
  if (!Array.isArray(input.scopes) || input.scopes.length < 1 || input.scopes.length > 256) throw new AuthorityValidationError("authority scopes are invalid");
  const scopes = Object.freeze(input.scopes.map((scope) => validateExecutionScope(scope)));
  const allowed = input.allowedActionClasses as unknown;
  const denied = input.deniedActionClasses as unknown;
  const allowedClasses = idArray(allowed, "allowedActionClasses").map((item) => enumValue(item, ACTION_CLASSES, "action class"));
  const deniedClasses = idArray(denied, "deniedActionClasses").map((item) => enumValue(item, ACTION_CLASSES, "action class"));
  if (new Set([...allowedClasses, ...deniedClasses]).size !== allowedClasses.length + deniedClasses.length) throw new AuthorityValidationError("action class cannot be both allowed and denied");
  const dataPolicy = validateDataPolicy(input.dataPolicy) as DataPolicy;
  const createdAt = timestamp(input.createdAt, "createdAt");
  const expiresAt = input.expiresAt === undefined ? undefined : timestamp(input.expiresAt, "expiresAt");
  if (expiresAt !== undefined && Date.parse(expiresAt) <= Date.parse(createdAt)) throw new AuthorityValidationError("expiresAt must be after createdAt");
  if (!Number.isSafeInteger(input.policySnapshotVersion) || (input.policySnapshotVersion as number) < 1) throw new AuthorityValidationError("policySnapshotVersion is invalid");
  const maxBudget = input.maxBudget === undefined ? undefined : nonNegativeMoney(input.maxBudget, "maxBudget");
  return Object.freeze({
    id: id(input.id, "authority id"),
    originatingInstructionId: id(input.originatingInstructionId, "originating instruction id"),
    scopes,
    allowedActionClasses: Object.freeze(allowedClasses),
    deniedActionClasses: Object.freeze(deniedClasses),
    externalSystems: idArray(input.externalSystems, "externalSystems"),
    dataPolicy,
    ...(maxBudget === undefined ? {} : { maxBudget }),
    createdAt,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    policySnapshotVersion: input.policySnapshotVersion as number,
  });
}

export function assertAuthorityEnvelopeContains(
  envelopeValue: unknown,
  requestValue: unknown,
): true {
  const envelope = validateAuthorityEnvelope(envelopeValue);
  const input = record(requestValue, "authority containment request");
  keys(input, ["actionClass", "executionScope", "externalSystems", "dataPolicy"], ["estimatedBudget"]);
  const request: AuthorityContainmentRequest = Object.freeze({
    actionClass: enumValue(input.actionClass, ACTION_CLASSES, "action class"),
    executionScope: validateExecutionScope(input.executionScope),
    externalSystems: idArray(input.externalSystems, "externalSystems"),
    dataPolicy: validateDataPolicy(input.dataPolicy),
    ...(input.estimatedBudget === undefined ? {} : { estimatedBudget: nonNegativeMoney(input.estimatedBudget, "estimatedBudget") }),
  });
  if (envelope.deniedActionClasses.includes(request.actionClass) || !envelope.allowedActionClasses.includes(request.actionClass)) {
    throw new AuthorityContainmentError("action class is outside the authority envelope");
  }
  if (!envelope.scopes.some((scope) => scopeContains(scope, request.executionScope))) {
    throw new AuthorityContainmentError("execution scope is outside the authority envelope");
  }
  if (!request.externalSystems.every((systemId) => envelope.externalSystems.includes(systemId))) {
    throw new AuthorityContainmentError("external system is outside the authority envelope");
  }
  if (!dataPolicyContained(envelope.dataPolicy, request.dataPolicy)) {
    throw new AuthorityContainmentError("data policy is outside the authority envelope");
  }
  if (!budgetContained(envelope.maxBudget, request.estimatedBudget)) {
    throw new AuthorityContainmentError("estimated budget is outside the authority envelope");
  }
  return true;
}

export function validatePermissionDecision(value: unknown): PermissionDecision {
  const input = record(value, "permission decision");
  keys(input, ["decisionId", "outcome", "contextualRisk", "reasonCodes", "matchedPolicyIds", "matchedPrecedentIds", "decidedAt", "policyVersion"], ["toolExecutionId", "taskId", "approvalRequestId"]);
  if (!Number.isSafeInteger(input.policyVersion) || (input.policyVersion as number) < 1) throw new AuthorityValidationError("policyVersion is invalid");
  return Object.freeze({
    decisionId: id(input.decisionId, "decision id"),
    ...(input.toolExecutionId === undefined ? {} : { toolExecutionId: id(input.toolExecutionId, "tool execution id") }),
    ...(input.taskId === undefined ? {} : { taskId: id(input.taskId, "task id") }),
    outcome: enumValue(input.outcome, PERMISSION_OUTCOMES, "permission outcome"),
    contextualRisk: enumValue(input.contextualRisk, RISK_CLASSES, "contextual risk"),
    reasonCodes: idArray(input.reasonCodes, "reasonCodes"),
    matchedPolicyIds: idArray(input.matchedPolicyIds, "matchedPolicyIds"),
    matchedPrecedentIds: idArray(input.matchedPrecedentIds, "matchedPrecedentIds"),
    ...(input.approvalRequestId === undefined ? {} : { approvalRequestId: id(input.approvalRequestId, "approval request id") }),
    decidedAt: timestamp(input.decidedAt, "decidedAt"),
    policyVersion: input.policyVersion as number,
  });
}

export function validateCanonicalActionDescriptor(value: unknown): CanonicalActionDescriptorV1 {
  const input = record(value, "canonical action descriptor");
  keys(input, ["domain", "descriptorVersion", "toolId", "toolVersion", "actionClass", "sideEffectClass", "executionScope", "targets", "arguments", "authorityEnvelopeId", "policySnapshotVersion"], ["integrationBindings"]);
  if (input.domain !== "jarvis.approval.action.v1" || input.descriptorVersion !== 1 || !Number.isSafeInteger(input.toolVersion) || (input.toolVersion as number) < 1 || !Number.isSafeInteger(input.policySnapshotVersion) || (input.policySnapshotVersion as number) < 1) throw new AuthorityValidationError("canonical action descriptor identity/version is invalid");
  if (!Array.isArray(input.targets) || input.targets.length > 256 || input.targets.some((target) => typeof target !== "object" || target === null || Array.isArray(target))) throw new AuthorityValidationError("canonical action targets are invalid");
  const args = record(input.arguments, "action arguments");
  rejectSecretKeys(args);
  return Object.freeze({
    domain: "jarvis.approval.action.v1",
    descriptorVersion: 1,
    toolId: id(input.toolId, "tool id"),
    toolVersion: input.toolVersion as number,
    actionClass: enumValue(input.actionClass, ACTION_CLASSES, "action class"),
    sideEffectClass: enumValue(input.sideEffectClass, ["READ_ONLY", "REVERSIBLE_WRITE", "EXTERNAL_WRITE", "DESTRUCTIVE"], "side effect class"),
    executionScope: input.executionScope,
    targets: Object.freeze(input.targets as Array<Record<string, unknown>>),
    arguments: Object.freeze({ ...args }),
    ...(input.integrationBindings === undefined ? {} : { integrationBindings: Object.freeze(input.integrationBindings as Array<Record<string, unknown>>) }),
    authorityEnvelopeId: id(input.authorityEnvelopeId, "authority envelope id"),
    policySnapshotVersion: input.policySnapshotVersion as number,
  });
}

export function validateApprovalRequest(value: unknown): ApprovalRequest {
  const input = record(value, "approval request");
  keys(input, ["approvalId", "kind", "descriptorVersion", "actionDigestAlgorithm", "actionDigestEncoding", "actionDigest", "actionSummary", "targetSummary", "consequenceSummary", "createdAt", "expiresAt", "status"], ["environmentSummary"]);
  if (input.descriptorVersion !== 1 || input.actionDigestAlgorithm !== "SHA-256" || input.actionDigestEncoding !== "BASE64URL_NOPAD" || typeof input.actionDigest !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(input.actionDigest)) throw new AuthorityValidationError("approval descriptor digest fields are invalid");
  const createdAt = timestamp(input.createdAt, "createdAt");
  const expiresAt = timestamp(input.expiresAt, "expiresAt");
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) throw new AuthorityValidationError("approval expiresAt must be after createdAt");
  return Object.freeze({
    approvalId: id(input.approvalId, "approval id"),
    kind: enumValue(input.kind, ["HIGH_RISK", "DESTRUCTIVE_FINAL_CONFIRMATION"], "approval kind"),
    descriptorVersion: 1,
    actionDigestAlgorithm: "SHA-256",
    actionDigestEncoding: "BASE64URL_NOPAD",
    actionDigest: input.actionDigest,
    actionSummary: text(input.actionSummary, "actionSummary"),
    targetSummary: text(input.targetSummary, "targetSummary"),
    ...(input.environmentSummary === undefined ? {} : { environmentSummary: text(input.environmentSummary, "environmentSummary") }),
    consequenceSummary: text(input.consequenceSummary, "consequenceSummary"),
    createdAt,
    expiresAt,
    status: enumValue(input.status, ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "CONSUMED"], "approval status"),
  });
}

export function validateApprovalDecision(value: unknown): ApprovalDecision {
  const input = record(value, "approval decision");
  keys(input, ["decisionId", "approvalId", "status", "decidedAt", "sessionId", "reasonCode"]);
  return Object.freeze({
    decisionId: id(input.decisionId, "decisionId"),
    approvalId: id(input.approvalId, "approvalId"),
    status: enumValue(input.status, ["APPROVED", "REJECTED"], "approval decision status"),
    decidedAt: timestamp(input.decidedAt, "decidedAt"),
    sessionId: id(input.sessionId, "sessionId"),
    reasonCode: id(input.reasonCode, "reasonCode"),
  });
}

export function validateFreshTargetResolution(value: unknown): FreshTargetResolution {
  const input = record(value, "fresh target resolution");
  keys(input, ["resolutionId", "resolvedAt", "descriptorDigest", "targetIdentityDigest"]);
  return Object.freeze({
    resolutionId: id(input.resolutionId, "resolutionId"),
    resolvedAt: timestamp(input.resolvedAt, "resolvedAt"),
    descriptorDigest: digest(input.descriptorDigest, "descriptorDigest"),
    targetIdentityDigest: digest(input.targetIdentityDigest, "targetIdentityDigest"),
  });
}

export function validateFinalDestructiveConfirmation(value: unknown): FinalDestructiveConfirmation {
  const input = record(value, "final destructive confirmation");
  keys(input, ["confirmationId", "approvalId", "descriptorDigest", "sessionId", "confirmedAt", "actionSummary", "targetSummary", "consequenceSummary"], ["environmentSummary"]);
  return Object.freeze({
    confirmationId: id(input.confirmationId, "confirmationId"),
    approvalId: id(input.approvalId, "approvalId"),
    descriptorDigest: digest(input.descriptorDigest, "descriptorDigest"),
    sessionId: id(input.sessionId, "sessionId"),
    confirmedAt: timestamp(input.confirmedAt, "confirmedAt"),
    actionSummary: text(input.actionSummary, "actionSummary"),
    targetSummary: text(input.targetSummary, "targetSummary"),
    ...(input.environmentSummary === undefined ? {} : { environmentSummary: text(input.environmentSummary, "environmentSummary") }),
    consequenceSummary: text(input.consequenceSummary, "consequenceSummary"),
  });
}
