import { validateProjectPolicyCandidatePath } from "../../../packages/protocol/src/project-policy-runtime.mjs";
import { evaluatePermission, validatePermissionEvaluationInput } from "./permission-engine.ts";

export class ProjectPolicyMutationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectPolicyMutationValidationError";
  }
}

function record(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ProjectPolicyMutationValidationError(`${label} must be an object`);
  return value;
}

function keys(value, required) {
  const allowed = new Set(required);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) throw new ProjectPolicyMutationValidationError("project-policy mutation contains unsupported or missing fields");
}

function id(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ProjectPolicyMutationValidationError(`${label} is invalid`);
  return value;
}

function sha256(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new ProjectPolicyMutationValidationError(`${label} must be a lowercase SHA-256 digest`);
  return value;
}

export function validateProjectPolicyMutationAdmission(value) {
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

export function evaluateProjectPolicyMutation(value) {
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
