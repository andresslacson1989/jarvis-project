import type { ToolCheckSpec, ToolCheckVerificationContext, ToolCriterionResult, ToolTargetResolution, ToolCheckVerifier, CanonicalTargetRef } from "./tool.js";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const DIGEST = /^[A-Za-z0-9_-]{43}$/u;

export class ToolTargetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolTargetValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ToolTargetValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) throw new ToolTargetValidationError("target record contains unsupported or missing fields");
}

function text(value: unknown, label: string, max = 2048): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || value.includes("\0")) throw new ToolTargetValidationError(`${label} is invalid`);
  return value;
}

function identifier(value: unknown, label: string): string {
  const result = text(value, label, 256);
  if (!ID.test(result)) throw new ToolTargetValidationError(`${label} is invalid`);
  return result;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== "string" || !DIGEST.test(value)) throw new ToolTargetValidationError(`${label} is invalid`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 64 || Number.isNaN(Date.parse(value))) throw new ToolTargetValidationError(`${label} is invalid`);
  return value;
}

export function validateCanonicalTargetRef(value: unknown): CanonicalTargetRef {
  const input = record(value, "canonical target");
  keys(input, ["system", "resourceType", "resourceId"], ["accountId", "environmentId"]);
  return Object.freeze({ system: identifier(input.system, "target system"), ...(input.accountId === undefined ? {} : { accountId: identifier(input.accountId, "target accountId") }), ...(input.environmentId === undefined ? {} : { environmentId: identifier(input.environmentId, "target environmentId") }), resourceType: identifier(input.resourceType, "target resourceType"), resourceId: text(input.resourceId, "target resourceId", 4096) });
}

function resolvedTarget(value: unknown): ToolTargetResolution["targets"][number] {
  const input = record(value, "resolved target");
  const target = validateCanonicalTargetRef({ system: input.system, ...(input.accountId === undefined ? {} : { accountId: input.accountId }), ...(input.environmentId === undefined ? {} : { environmentId: input.environmentId }), resourceType: input.resourceType, resourceId: input.resourceId });
  keys(input, ["system", "resourceType", "resourceId", "identityDigest", "versionToken"], ["accountId", "environmentId"]);
  return Object.freeze({ ...target, identityDigest: digest(input.identityDigest, "target identityDigest"), versionToken: text(input.versionToken, "target versionToken", 4096) });
}

export function validateToolTargetResolution(value: unknown): ToolTargetResolution {
  const input = record(value, "tool target resolution");
  keys(input, ["resolutionId", "resolvedAt", "descriptorDigest", "targetIdentityDigest", "targets"]);
  if (!Array.isArray(input.targets) || input.targets.length < 1 || input.targets.length > 128) throw new ToolTargetValidationError("target resolution targets are invalid");
  const targets = input.targets.map(resolvedTarget);
  if (new Set(targets.map((target) => `${target.system}:${target.resourceType}:${target.resourceId}`)).size !== targets.length) throw new ToolTargetValidationError("target resolution contains duplicate targets");
  return Object.freeze({ resolutionId: identifier(input.resolutionId, "resolutionId"), resolvedAt: timestamp(input.resolvedAt, "resolvedAt"), descriptorDigest: digest(input.descriptorDigest, "descriptorDigest"), targetIdentityDigest: digest(input.targetIdentityDigest, "targetIdentityDigest"), targets: Object.freeze(targets) });
}

export function canonicalizeTargetRef(value: unknown): string {
  const target = validateCanonicalTargetRef(value);
  return JSON.stringify(Object.fromEntries(Object.entries(target).sort(([left], [right]) => left.localeCompare(right, "en"))));
}

export function assertTargetResolutionUnchanged(expected: unknown, actual: unknown): ToolTargetResolution {
  const expectedResolution = validateToolTargetResolution(expected);
  const actualResolution = validateToolTargetResolution(actual);
  if (expectedResolution.targetIdentityDigest !== actualResolution.targetIdentityDigest || expectedResolution.targets.length !== actualResolution.targets.length) throw new ToolTargetValidationError("target resolution changed");
  for (let index = 0; index < expectedResolution.targets.length; index += 1) {
    const before = expectedResolution.targets[index];
    const after = actualResolution.targets[index];
    if (before === undefined || after === undefined) throw new ToolTargetValidationError("target resolution shape changed");
    if (before.identityDigest !== after.identityDigest || before.versionToken !== after.versionToken) throw new ToolTargetValidationError("target version changed");
  }
  return actualResolution;
}

export class ToolCheckVerifierRegistry {
  private readonly verifiers = new Map<string, ToolCheckVerifier>();

  register(verifier: ToolCheckVerifier): void {
    if (!ID.test(verifier.verifierId) || this.verifiers.has(verifier.verifierId)) throw new ToolTargetValidationError("tool verifier identity is invalid or already registered");
    this.verifiers.set(verifier.verifierId, verifier);
  }

  get(verifierId: string): ToolCheckVerifier | undefined { return this.verifiers.get(verifierId); }
}

export async function evaluateToolChecks(checks: readonly ToolCheckSpec[], registry: ToolCheckVerifierRegistry, context: ToolCheckVerificationContext, parameters: (check: ToolCheckSpec) => Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<readonly ToolCriterionResult[]> {
  const results: ToolCriterionResult[] = [];
  for (const check of checks) {
    const verifier = registry.get(check.verifierId);
    if (verifier === undefined) {
      results.push(Object.freeze({ criterionId: check.checkId, verdict: "UNKNOWN", evidence: [], summary: "tool verifier is unavailable", verifiedAt: new Date().toISOString(), verifierType: "LIVE_STATE" }));
      continue;
    }
    try {
      const observation = await verifier.verify(context, parameters(check), signal);
      results.push(Object.freeze({ criterionId: check.checkId, verdict: observation.verdict, evidence: Object.freeze(observation.evidence), summary: observation.summary.slice(0, 4096), verifiedAt: observation.verifiedAt, verifierType: observation.verifierType }));
    } catch {
      results.push(Object.freeze({ criterionId: check.checkId, verdict: "UNKNOWN", evidence: [], summary: "tool verifier failed without a trusted result", verifiedAt: new Date().toISOString(), verifierType: "LIVE_STATE" }));
    }
  }
  return Object.freeze(results);
}
