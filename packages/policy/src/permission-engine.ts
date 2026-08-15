import type { PermissionDecision, RiskClass } from "../../protocol/src/authority.ts";

export interface PermissionGateInput {
  readonly passed: boolean;
  readonly reasonCode: string;
}

export interface ExplicitDenyInput {
  readonly applies: boolean;
  readonly reasonCode: string;
}

export interface StandingPermissionEvaluation {
  readonly matchesExact: boolean;
  readonly nonExpired: boolean;
  readonly policyAllowsRisk: boolean;
  readonly permissionId?: string;
}

export interface PermissionEvaluationInput {
  readonly decisionId: string;
  readonly decidedAt: string;
  readonly policyVersion: number;
  readonly contextualRisk: RiskClass;
  readonly mandatorySystemInvariant: PermissionGateInput;
  readonly explicitDeny: ExplicitDenyInput;
  readonly sessionEligibility: PermissionGateInput;
  readonly authorityEnvelopeContainment: PermissionGateInput;
  readonly capabilityAndIdentity: PermissionGateInput;
  readonly preflightGates: PermissionGateInput;
  readonly currentInstructionAuthorizes: boolean;
  readonly standingPermission: StandingPermissionEvaluation;
  readonly materiallyUnrecoverable: boolean;
  readonly freshFinalConfirmation: boolean;
  readonly matchedPolicyIds: readonly string[];
  readonly matchedPrecedentIds: readonly string[];
  readonly toolExecutionId?: string;
  readonly taskId?: string;
}

export class PermissionEngineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionEngineValidationError";
  }
}

const RISK_CLASSES = new Set<RiskClass>(["LOW", "MODERATE", "HIGH", "CRITICAL"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PermissionEngineValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) {
    throw new PermissionEngineValidationError("permission evaluation contains unsupported or missing fields");
  }
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || !ID_PATTERN.test(value)) throw new PermissionEngineValidationError(`${label} is invalid`);
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 64 || Number.isNaN(Date.parse(value))) throw new PermissionEngineValidationError("decidedAt must be an ISO timestamp");
  return value;
}

function idArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 256) throw new PermissionEngineValidationError(`${label} is invalid`);
  const result = value.map((item) => id(item, label));
  if (new Set(result).size !== result.length) throw new PermissionEngineValidationError(`${label} contains duplicates`);
  return Object.freeze(result);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new PermissionEngineValidationError(`${label} must be boolean`);
  return value;
}

function gate(value: unknown, label: string): PermissionGateInput {
  const input = record(value, label);
  keys(input, ["passed", "reasonCode"]);
  return Object.freeze({ passed: boolean(input.passed, `${label}.passed`), reasonCode: id(input.reasonCode, `${label}.reasonCode`) });
}

function validateStandingPermission(value: unknown): StandingPermissionEvaluation {
  const input = record(value, "standingPermission");
  keys(input, ["matchesExact", "nonExpired", "policyAllowsRisk"], ["permissionId"]);
  const permissionId = input.permissionId === undefined ? undefined : id(input.permissionId, "permissionId");
  return Object.freeze({
    matchesExact: boolean(input.matchesExact, "standingPermission.matchesExact"),
    nonExpired: boolean(input.nonExpired, "standingPermission.nonExpired"),
    policyAllowsRisk: boolean(input.policyAllowsRisk, "standingPermission.policyAllowsRisk"),
    ...(permissionId === undefined ? {} : { permissionId }),
  });
}

export function validatePermissionEvaluationInput(value: unknown): PermissionEvaluationInput {
  const input = record(value, "permission evaluation");
  keys(input, [
    "decisionId", "decidedAt", "policyVersion", "contextualRisk", "mandatorySystemInvariant", "explicitDeny",
    "sessionEligibility", "authorityEnvelopeContainment", "capabilityAndIdentity", "preflightGates",
    "currentInstructionAuthorizes", "standingPermission", "materiallyUnrecoverable", "freshFinalConfirmation",
    "matchedPolicyIds", "matchedPrecedentIds",
  ], ["toolExecutionId", "taskId"]);
  if (!Number.isSafeInteger(input.policyVersion) || (input.policyVersion as number) < 1) throw new PermissionEngineValidationError("policyVersion is invalid");
  if (typeof input.contextualRisk !== "string" || !RISK_CLASSES.has(input.contextualRisk as RiskClass)) throw new PermissionEngineValidationError("contextualRisk is unsupported");
  return Object.freeze({
    decisionId: id(input.decisionId, "decisionId"),
    decidedAt: timestamp(input.decidedAt),
    policyVersion: input.policyVersion as number,
    contextualRisk: input.contextualRisk as RiskClass,
    mandatorySystemInvariant: gate(input.mandatorySystemInvariant, "mandatorySystemInvariant"),
    explicitDeny: (() => {
      const deny = record(input.explicitDeny, "explicitDeny");
      keys(deny, ["applies", "reasonCode"]);
      return Object.freeze({ applies: boolean(deny.applies, "explicitDeny.applies"), reasonCode: id(deny.reasonCode, "explicitDeny.reasonCode") });
    })(),
    sessionEligibility: gate(input.sessionEligibility, "sessionEligibility"),
    authorityEnvelopeContainment: gate(input.authorityEnvelopeContainment, "authorityEnvelopeContainment"),
    capabilityAndIdentity: gate(input.capabilityAndIdentity, "capabilityAndIdentity"),
    preflightGates: gate(input.preflightGates, "preflightGates"),
    currentInstructionAuthorizes: boolean(input.currentInstructionAuthorizes, "currentInstructionAuthorizes"),
    standingPermission: validateStandingPermission(input.standingPermission),
    materiallyUnrecoverable: boolean(input.materiallyUnrecoverable, "materiallyUnrecoverable"),
    freshFinalConfirmation: boolean(input.freshFinalConfirmation, "freshFinalConfirmation"),
    matchedPolicyIds: idArray(input.matchedPolicyIds, "matchedPolicyIds"),
    matchedPrecedentIds: idArray(input.matchedPrecedentIds, "matchedPrecedentIds"),
    ...(input.toolExecutionId === undefined ? {} : { toolExecutionId: id(input.toolExecutionId, "toolExecutionId") }),
    ...(input.taskId === undefined ? {} : { taskId: id(input.taskId, "taskId") }),
  });
}

function decision(input: PermissionEvaluationInput, outcome: PermissionDecision["outcome"], reasonCode: string): PermissionDecision {
  return Object.freeze({
    decisionId: input.decisionId,
    ...(input.toolExecutionId === undefined ? {} : { toolExecutionId: input.toolExecutionId }),
    ...(input.taskId === undefined ? {} : { taskId: input.taskId }),
    outcome,
    contextualRisk: input.contextualRisk,
    reasonCodes: Object.freeze([reasonCode]),
    matchedPolicyIds: input.matchedPolicyIds,
    matchedPrecedentIds: input.matchedPrecedentIds,
    decidedAt: input.decidedAt,
    policyVersion: input.policyVersion,
  });
}

function failedGate(input: PermissionEvaluationInput, gateInput: PermissionGateInput): PermissionDecision {
  return decision(input, "DENY", gateInput.reasonCode);
}

export function evaluatePermission(value: unknown): PermissionDecision {
  const input = validatePermissionEvaluationInput(value);
  if (!input.mandatorySystemInvariant.passed) return failedGate(input, input.mandatorySystemInvariant);
  if (input.explicitDeny.applies) return decision(input, "DENY", input.explicitDeny.reasonCode);
  if (!input.sessionEligibility.passed) return failedGate(input, input.sessionEligibility);
  if (!input.authorityEnvelopeContainment.passed) return failedGate(input, input.authorityEnvelopeContainment);
  if (!input.capabilityAndIdentity.passed) return failedGate(input, input.capabilityAndIdentity);
  if (!input.preflightGates.passed) return failedGate(input, input.preflightGates);

  const standingAuthorized = input.standingPermission.matchesExact && input.standingPermission.nonExpired && input.standingPermission.policyAllowsRisk;
  const directOrStandingAuthority = input.currentInstructionAuthorizes || standingAuthorized;
  if (!directOrStandingAuthority) {
    return decision(input, input.contextualRisk === "LOW" ? "DENY" : "REQUIRE_APPROVAL", "CURRENT_OR_STANDING_AUTHORITY_REQUIRED");
  }
  if (input.contextualRisk === "CRITICAL" || input.materiallyUnrecoverable) {
    return input.freshFinalConfirmation
      ? decision(input, "ALLOW", "FRESH_FINAL_CONFIRMATION_PRESENT")
      : decision(input, "REQUIRE_APPROVAL", "CRITICAL_FINAL_CONFIRMATION_REQUIRED");
  }
  if (input.contextualRisk === "HIGH" && !input.currentInstructionAuthorizes && !standingAuthorized) {
    return decision(input, "REQUIRE_APPROVAL", "HIGH_ACTION_REQUIRES_APPROVAL");
  }
  return decision(input, "ALLOW", input.contextualRisk === "LOW" ? "LOW_ACTION_ALLOWED" : input.contextualRisk === "MODERATE" ? "MODERATE_ACTION_ALLOWED" : "HIGH_ACTION_ALLOWED");
}
