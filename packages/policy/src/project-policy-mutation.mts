import type { PermissionDecision } from "../../protocol/src/authority.js";
import { validateProjectPolicyCandidatePath } from "../../protocol/src/project-policy-runtime.mjs";
import type { ProjectPolicyMutationActorKind, ProjectPolicyMutationTarget } from "../../protocol/src/project-policy.js";

interface PermissionGateInput { readonly passed: boolean; readonly reasonCode: string; }
interface StandingPermissionEvaluation { readonly matchesExact: boolean; readonly nonExpired: boolean; readonly policyAllowsRisk: boolean; readonly permissionId?: string; }
interface PermissionEvaluationInput {
  readonly decisionId: string;
  readonly decidedAt: string;
  readonly policyVersion: number;
  readonly contextualRisk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  readonly mandatorySystemInvariant: PermissionGateInput;
  readonly explicitDeny: { readonly applies: boolean; readonly reasonCode: string };
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

declare function validatePermissionEvaluationInput(value: unknown): PermissionEvaluationInput;
declare function evaluatePermission(value: PermissionEvaluationInput): PermissionDecision;

export interface ProjectPolicyMutationAdmissionInput {
  readonly actorKind: ProjectPolicyMutationActorKind;
  readonly target: ProjectPolicyMutationTarget;
  readonly permission: PermissionEvaluationInput;
}

export class ProjectPolicyMutationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectPolicyMutationValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ProjectPolicyMutationValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[]): void {
  const allowed = new Set(required);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) throw new ProjectPolicyMutationValidationError("project-policy mutation contains unsupported or missing fields");
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ProjectPolicyMutationValidationError(`${label} is invalid`);
  return value;
}

function sha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new ProjectPolicyMutationValidationError(`${label} must be a lowercase SHA-256 digest`);
  return value;
}

export function validateProjectPolicyMutationAdmission(value: unknown): ProjectPolicyMutationAdmissionInput {
  const input = record(value, "project-policy mutation admission");
  keys(input, ["actorKind", "target", "permission"]);
  if (input.actorKind !== "AUTHENTICATED_USER" && input.actorKind !== "WORKER" && input.actorKind !== "TOOL") throw new ProjectPolicyMutationValidationError("actorKind is invalid");
  const target = record(input.target, "project-policy mutation target");
  keys(target, ["policyTrustId", "projectId", "canonicalRelativePath", "proposedContentSha256"]);
  const normalizedTarget = Object.freeze({
    policyTrustId: id(target.policyTrustId, "policyTrustId"),
    projectId: id(target.projectId, "projectId"),
    canonicalRelativePath: validateProjectPolicyCandidatePath(target.canonicalRelativePath),
    proposedContentSha256: sha256(target.proposedContentSha256, "proposedContentSha256"),
  });
  const permission = validatePermissionEvaluationInput(input.permission);
  if (permission.contextualRisk !== "HIGH") throw new ProjectPolicyMutationValidationError("trusted project-policy mutation must be HIGH risk");
  return Object.freeze({ actorKind: input.actorKind, target: normalizedTarget, permission });
}

export function evaluateProjectPolicyMutation(value: unknown): PermissionDecision {
  const input = validateProjectPolicyMutationAdmission(value);
  if (input.actorKind !== "AUTHENTICATED_USER") {
    return Object.freeze({
      ...input.permission,
      outcome: "DENY",
      contextualRisk: "HIGH",
      reasonCodes: Object.freeze(["PROJECT_POLICY_WORKER_CANNOT_AUTHORIZE"]),
    });
  }
  return evaluatePermission(input.permission);
}
