import assert from "node:assert/strict";
import test from "node:test";
import { evaluateToolAdmission } from "../../../packages/policy/src/tool-admission.mjs";

const request = {
  toolExecutionId: "018f0000-0000-7000-8000-000000000021",
  toolId: "jarvis.test.admission",
  toolVersion: 1,
  executionScope: { kind: "PROJECT_WORKSPACE", projectId: "project-1", workspaceId: "workspace-1" },
  authorityEnvelopeId: "018f0000-0000-7000-8000-000000000022",
  arguments: {},
};
const manifest = {
  toolId: "jarvis.test.admission",
  version: 1,
  description: "admission test tool",
  inputSchemaId: "jarvis.schema.admission.input.v1",
  outputSchemaId: "jarvis.schema.admission.output.v1",
  baselineRisk: "LOW",
  sideEffectClass: "READ_ONLY",
  reversible: true,
  requiredPermissionIds: ["project.read"],
  allowedEnvironments: ["WINDOWS_FULL_HOST"],
  allowedScopeKinds: ["PROJECT_WORKSPACE"],
  secretCapabilities: [],
  networkRequired: false,
  requiredPlatformCapabilities: ["filesystem.read"],
  idempotency: "IDEMPOTENT",
  preconditions: [],
  postconditions: [],
  preemptionPolicy: "PREEMPTIBLE",
};

function permission(outcome = "ALLOW", overrides = {}) {
  return {
    decisionId: "decision-1",
    outcome,
    contextualRisk: "LOW",
    reasonCodes: ["LOW_ACTION_ALLOWED"],
    matchedPolicyIds: ["policy-1"],
    matchedPrecedentIds: [],
    decidedAt: "2026-08-17T00:00:00.000Z",
    policyVersion: 1,
    ...overrides,
  };
}

function facts(overrides = {}) {
  const names = ["PLATFORM_CAPABILITY", "PROVIDER_SETUP", "INTEGRITY", "PROJECT_POLICY_TRUST", "SUPPLY_CHAIN_TRUST", "LOCALITY", "BUDGET", "RESOURCE", "PRECONDITION"];
  return Object.fromEntries(names.map((name) => [name, overrides[name] ?? { state: "PASS", reasonCode: `${name}_PASS` },]));
}

test("tool admission requires bound permission and all pre-ALLOW gates", () => {
  const result = evaluateToolAdmission({ request, manifest, permissionDecision: permission(), preAllowFacts: facts() });
  assert.equal(result.outcome, "ALLOW");
  assert.equal(result.error, undefined);
});

test("tool admission blocks approval-required, mismatched, and denied decisions before execution", () => {
  const approval = evaluateToolAdmission({ request, manifest, permissionDecision: permission("REQUIRE_APPROVAL"), preAllowFacts: facts() });
  assert.deepEqual([approval.outcome, approval.error?.code], ["DENIED", "TOOL_APPROVAL_REQUIRED"]);
  const mismatched = evaluateToolAdmission({ request, manifest, permissionDecision: permission("ALLOW", { toolExecutionId: "018f0000-0000-7000-8000-000000000099" }), preAllowFacts: facts() });
  assert.deepEqual([mismatched.outcome, mismatched.error?.code], ["DENIED", "TOOL_PERMISSION_DECISION_MISMATCH"]);
  const denied = evaluateToolAdmission({ request, manifest, permissionDecision: permission("DENY"), preAllowFacts: facts() });
  assert.deepEqual([denied.outcome, denied.error?.code], ["DENIED", "TOOL_PERMISSION_DENIED"]);
});

test("unknown pre-ALLOW facts become UNCERTAIN while failed facts remain denied", () => {
  const unknownFacts = facts();
  unknownFacts.PROVIDER_SETUP = { state: "UNKNOWN", reasonCode: "SETUP_UNKNOWN" };
  const unknown = evaluateToolAdmission({ request, manifest, permissionDecision: permission(), preAllowFacts: unknownFacts });
  assert.deepEqual([unknown.outcome, unknown.error?.code], ["UNCERTAIN", "TOOL_PRE_ALLOW_GATE_UNKNOWN"]);
  const failedFacts = facts();
  failedFacts.LOCALITY = { state: "FAIL", reasonCode: "LOCALITY_NOT_ALLOWED" };
  const failed = evaluateToolAdmission({ request, manifest, permissionDecision: permission(), preAllowFacts: failedFacts });
  assert.deepEqual([failed.outcome, failed.error?.code], ["DENIED", "TOOL_PRE_ALLOW_GATE_FAILED"]);
});
