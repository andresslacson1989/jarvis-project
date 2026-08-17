import { strict as assert } from "node:assert";
import test from "node:test";
import { evaluatePermission } from "../../../packages/policy/src/permission-engine.ts";

function input(overrides = {}) {
  return {
    decisionId: "decision-1",
    decidedAt: "2026-08-15T00:00:00.000Z",
    policyVersion: 1,
    contextualRisk: "LOW",
    mandatorySystemInvariant: { passed: true, reasonCode: "SYSTEM_INVARIANTS_PASS" },
    explicitDeny: { applies: false, reasonCode: "NO_APPLICABLE_DENY" },
    sessionEligibility: { passed: true, reasonCode: "SESSION_ELIGIBLE" },
    authorityEnvelopeContainment: { passed: true, reasonCode: "ENVELOPE_CONTAINED" },
    capabilityAndIdentity: { passed: true, reasonCode: "CAPABILITY_RESOLVED" },
    preflightGates: { passed: true, reasonCode: "PREFLIGHT_PASS" },
    currentInstructionAuthorizes: true,
    standingPermission: { matchesExact: false, nonExpired: false, policyAllowsRisk: false },
    materiallyUnrecoverable: false,
    freshFinalConfirmation: false,
    matchedPolicyIds: ["policy-1"],
    matchedPrecedentIds: ["precedent-1"],
    ...overrides,
  };
}

test("permission engine follows mandatory invariant, deny, session, containment, capability, and preflight precedence", () => {
  const base = input({ contextualRisk: "HIGH" });
  assert.equal(evaluatePermission({ ...base, mandatorySystemInvariant: { passed: false, reasonCode: "SYSTEM_INVARIANT_FAILED" }, explicitDeny: { applies: true, reasonCode: "EXPLICIT_DENY" } }).outcome, "DENY");
  assert.deepEqual(evaluatePermission({ ...base, explicitDeny: { applies: true, reasonCode: "EXPLICIT_DENY" } }).reasonCodes, ["EXPLICIT_DENY"]);
  assert.equal(evaluatePermission({ ...base, sessionEligibility: { passed: false, reasonCode: "SESSION_REQUIRED" } }).outcome, "DENY");
  assert.equal(evaluatePermission({ ...base, authorityEnvelopeContainment: { passed: false, reasonCode: "ENVELOPE_OUTSIDE" } }).outcome, "DENY");
  assert.equal(evaluatePermission({ ...base, capabilityAndIdentity: { passed: false, reasonCode: "CAPABILITY_MISSING" } }).outcome, "DENY");
  assert.equal(evaluatePermission({ ...base, preflightGates: { passed: false, reasonCode: "BUDGET_BLOCKED" } }).outcome, "DENY");
});

test("precedent never authorizes HIGH, while exact non-expired standing permission can", () => {
  const highWithoutAuthority = input({ contextualRisk: "HIGH", currentInstructionAuthorizes: false });
  assert.deepEqual(evaluatePermission(highWithoutAuthority), {
    decisionId: "decision-1",
    outcome: "REQUIRE_APPROVAL",
    contextualRisk: "HIGH",
    reasonCodes: ["CURRENT_OR_STANDING_AUTHORITY_REQUIRED"],
    matchedPolicyIds: ["policy-1"],
    matchedPrecedentIds: ["precedent-1"],
    decidedAt: "2026-08-15T00:00:00.000Z",
    policyVersion: 1,
  });
  assert.equal(evaluatePermission({
    ...highWithoutAuthority,
    standingPermission: { matchesExact: true, nonExpired: true, policyAllowsRisk: true, permissionId: "permission-1" },
  }).outcome, "ALLOW");
  assert.equal(evaluatePermission({
    ...highWithoutAuthority,
    standingPermission: { matchesExact: true, nonExpired: false, policyAllowsRisk: true, permissionId: "permission-1" },
  }).outcome, "REQUIRE_APPROVAL");
});

test("CRITICAL and materially unrecoverable actions always require fresh final confirmation", () => {
  const critical = input({ contextualRisk: "CRITICAL", currentInstructionAuthorizes: true });
  assert.deepEqual(evaluatePermission(critical).reasonCodes, ["CRITICAL_FINAL_CONFIRMATION_REQUIRED"]);
  assert.equal(evaluatePermission({ ...critical, freshFinalConfirmation: true }).outcome, "ALLOW");
  assert.equal(evaluatePermission({ ...input({ contextualRisk: "HIGH", materiallyUnrecoverable: true }), freshFinalConfirmation: false }).outcome, "REQUIRE_APPROVAL");
  assert.equal(evaluatePermission({ ...input({ contextualRisk: "MODERATE", currentInstructionAuthorizes: false }), standingPermission: { matchesExact: true, nonExpired: true, policyAllowsRisk: true } }).outcome, "ALLOW");
});
