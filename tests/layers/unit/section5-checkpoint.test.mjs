import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluatePermission } from "../../../packages/policy/src/permission-engine.ts";

const matrixPath = new URL("../../../docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md", import.meta.url);

const baseEvaluation = {
  decisionId: "decision-checkpoint-1",
  decidedAt: "2026-08-15T00:00:00.000Z",
  policyVersion: 1,
  contextualRisk: "CRITICAL",
  mandatorySystemInvariant: { passed: true, reasonCode: "SYSTEM_INVARIANTS_PASS" },
  explicitDeny: { applies: false, reasonCode: "NO_APPLICABLE_DENY" },
  sessionEligibility: { passed: true, reasonCode: "SESSION_ELIGIBLE" },
  authorityEnvelopeContainment: { passed: true, reasonCode: "ENVELOPE_CONTAINED" },
  capabilityAndIdentity: { passed: true, reasonCode: "CAPABILITY_RESOLVED" },
  preflightGates: { passed: true, reasonCode: "PREFLIGHT_PASS" },
  currentInstructionAuthorizes: true,
  standingPermission: { matchesExact: false, nonExpired: false, policyAllowsRisk: false },
  materiallyUnrecoverable: true,
  freshFinalConfirmation: false,
  matchedPolicyIds: ["policy-checkpoint-1"],
  matchedPrecedentIds: [],
};

test("Section 5 checkpoint requires every security child, parent evidence, and final-confirmation invariant", async () => {
  const matrix = await readFile(matrixPath, "utf8");
  for (const subsection of ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11", "5.12", "5.13", "5.14"]) {
    assert.match(matrix, new RegExp(`\\| ↳ \\*\\*${subsection.replace(".", "\\.")}\\*\\*[^\\n]*\\| \\*\\*VERIFIED\\*\\* \\|`), `${subsection} is not VERIFIED`);
  }
  assert.match(matrix, /\| \*\*SECTION 5 — Session Security \/ PermissionEngine \/ Approval\*\* \| \*\*VERIFIED\*\* \|/);
  assert.match(matrix, /\| ↳ \*\*5\.CP\*\*[^\n]*\| \*\*VERIFIED\*\* \|/);
  assert.equal(evaluatePermission(baseEvaluation).outcome, "REQUIRE_APPROVAL");
  assert.equal(evaluatePermission({ ...baseEvaluation, freshFinalConfirmation: true }).outcome, "ALLOW");
});
