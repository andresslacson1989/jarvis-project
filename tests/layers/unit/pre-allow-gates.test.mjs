import { strict as assert } from "node:assert";
import test from "node:test";
import {
  evaluatePreAllowGates,
  validatePreAllowGateFacts,
} from "../../../packages/policy/src/pre-allow-gates.ts";

const passFacts = {
  PLATFORM_CAPABILITY: { state: "PASS", reasonCode: "PLATFORM_CAPABILITY_READY" },
  PROVIDER_SETUP: { state: "PASS", reasonCode: "PROVIDER_SETUP_READY" },
  INTEGRITY: { state: "PASS", reasonCode: "INTEGRITY_VERIFIED" },
  PROJECT_POLICY_TRUST: { state: "NOT_APPLICABLE", reasonCode: "NO_PROJECT_POLICY_SCOPE" },
  SUPPLY_CHAIN_TRUST: { state: "NOT_APPLICABLE", reasonCode: "NO_UPDATE_OR_MODULE_SCOPE" },
  LOCALITY: { state: "PASS", reasonCode: "LOCALITY_COMPLIANT" },
  BUDGET: { state: "PASS", reasonCode: "BUDGET_AVAILABLE" },
  RESOURCE: { state: "PASS", reasonCode: "RESOURCES_AVAILABLE" },
  PRECONDITION: { state: "PASS", reasonCode: "PRECONDITIONS_MATCH" },
};

test("pre-ALLOW gate evaluation requires every applicable fact to pass", () => {
  const result = evaluatePreAllowGates(passFacts);
  assert.equal(result.passed, true);
  assert.equal(result.reasonCode, "PRE_ALLOW_GATES_PASS");
  assert.equal(result.evaluatedGates.length, 9);
  assert.equal(validatePreAllowGateFacts(passFacts).PROJECT_POLICY_TRUST.state, "NOT_APPLICABLE");
});

test("pre-ALLOW gate evaluation fails closed on the first failed or unknown gate in contract order", () => {
  const failed = evaluatePreAllowGates({ ...passFacts, INTEGRITY: { state: "FAIL", reasonCode: "RELEASE_INTEGRITY_FAILED" } });
  assert.deepEqual(failed, {
    passed: false,
    reasonCode: "RELEASE_INTEGRITY_FAILED",
    failedGate: "INTEGRITY",
    evaluatedGates: ["PLATFORM_CAPABILITY", "PROVIDER_SETUP", "INTEGRITY", "PROJECT_POLICY_TRUST", "SUPPLY_CHAIN_TRUST", "LOCALITY", "BUDGET", "RESOURCE", "PRECONDITION"],
  });
  assert.equal(evaluatePreAllowGates({ ...passFacts, BUDGET: { state: "UNKNOWN", reasonCode: "BUDGET_UNAVAILABLE" } }).reasonCode, "BUDGET_UNKNOWN");
});

test("pre-ALLOW facts reject missing, extra, malformed, and unsupported gate records", () => {
  assert.throws(() => validatePreAllowGateFacts({ ...passFacts, PRECONDITION: undefined }), /fact|object/iu);
  assert.throws(() => validatePreAllowGateFacts({ ...passFacts, EXTRA: { state: "PASS", reasonCode: "EXTRA" } }), /unsupported/iu);
  assert.throws(() => validatePreAllowGateFacts({ ...passFacts, RESOURCE: { state: "READY", reasonCode: "RESOURCE_READY" } }), /unsupported/iu);
  assert.throws(() => validatePreAllowGateFacts({ ...passFacts, RESOURCE: { state: "PASS", reasonCode: "bad reason" } }), /invalid/iu);
});
