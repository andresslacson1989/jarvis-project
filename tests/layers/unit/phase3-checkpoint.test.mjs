import { strict as assert } from "node:assert";
import test from "node:test";
import { validatePhase3Checkpoint } from "../../../tools/checkpoints/phase3-checkpoint.mjs";

const requiredIds = [
  "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9",
  "3.10", "3.11", "3.12", "3.14", "3.15", "3.16", "3.17", "3.18",
];

function matrix(status = "VERIFIED") {
  const rows = requiredIds.map((id) => `| ↳ **${id}** proof | **${status}** |`).join("\n");
  return `${rows}\n| ↳ **3.13** optional | **DEFERRED** |`;
}

function evidence(overrides = {}) {
  return {
    status: "PASS",
    artifactQualification: "PACKAGED_CORE_RUNTIME",
    tufShape: "PASS",
    tufProfile: "1.0.35",
    recoverySecretFile: "EXTERNAL_INPUT_NOT_RECORDED",
    secretExported: false,
    stdout: "",
    stderr: "",
    restoreDrill: {
      wrongRecoveryFactorRejected: true,
      cleanProfileRestored: true,
      freshDbDekCommitted: true,
      recoveryMarkerWritten: true,
      integrationCredentialsReauthRequired: true,
      secretExported: false,
    },
    ...overrides,
  };
}

test("Section 3 checkpoint accepts verified child rows and packaged restore evidence", async () => {
  assert.deepEqual(await validatePhase3Checkpoint({ matrix: matrix(), evidence: evidence() }), []);
});

test("Section 3 checkpoint rejects an unverified child row", async () => {
  const violations = await validatePhase3Checkpoint({
    matrix: matrix("IN PROGRESS"),
    evidence: evidence(),
  });
  assert.ok(violations.some(({ code }) => code === "PHASE3_CHILD_NOT_VERIFIED"));
});

test("Section 3 checkpoint rejects exported or logged recovery evidence", async () => {
  const violations = await validatePhase3Checkpoint({
    matrix: matrix(),
    evidence: evidence({ secretExported: true, stdout: "recovery secret" }),
  });
  assert.ok(violations.some(({ code }) => code === "PHASE3_SECRET_FREE_EVIDENCE"));
});
