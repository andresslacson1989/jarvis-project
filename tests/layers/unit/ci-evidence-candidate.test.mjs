import test from "node:test";
import assert from "node:assert/strict";
import { buildCiEvidence, buildLocalCiExecutionEvidence, GATES, parseLocalCiGateResults } from "../../../tools/ci/generate-evidence.mjs";

const candidateSha = "a".repeat(40);
const syntheticMergeSha = "b".repeat(40);

function env(overrides = {}) {
  return {
    GITHUB_SHA: syntheticMergeSha,
    JARVIS_CANDIDATE_SHA: candidateSha,
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_REF: "refs/pull/7/merge",
    RUNNER_OS: "Windows",
    RUNNER_ARCH: "X64",
    JARVIS_STATIC_CI_GATES_PASSED: "1",
    JARVIS_PHASE0_CHECKPOINT_PASSED: "1",
    JARVIS_WINDOWS_TAURI_GATES_PASSED: "1",
    JARVIS_RUST_AUDIT_PASSED: "1",
    JARVIS_RUSTSEC_REVIEW_PASSED: "1",
    ...overrides,
  };
}

const versions = {
  node: "24.18.0",
  pnpm: "11.21.0",
  typescript: "6.0.3",
  rust: "1.97.1",
  cargo: "1.97.1",
};

test("CI evidence binds to the explicitly verified candidate SHA instead of pull-request GITHUB_SHA", () => {
  const evidence = buildCiEvidence({
    env: env(),
    versions,
    contractSuiteVersion: "1.0.7",
    governanceMode: "COMPENSATING_CONTROLS",
  });

  assert.equal(evidence.commitSha, candidateSha);
  assert.notEqual(evidence.commitSha, syntheticMergeSha);
});

test("CI evidence fails closed when the verified candidate SHA is absent or malformed", () => {
  assert.throws(
    () => buildCiEvidence({
      env: env({ JARVIS_CANDIDATE_SHA: "" }),
      versions,
      contractSuiteVersion: "1.0.7",
      governanceMode: "COMPENSATING_CONTROLS",
    }),
    /JARVIS_CANDIDATE_SHA/,
  );

  assert.throws(
    () => buildCiEvidence({
      env: env({ JARVIS_CANDIDATE_SHA: "not-a-sha" }),
      versions,
      contractSuiteVersion: "1.0.7",
      governanceMode: "COMPENSATING_CONTROLS",
    }),
    /JARVIS_CANDIDATE_SHA/,
  );
});

function localCiEnv(overrides = {}) {
  return {
    JARVIS_CANDIDATE_SHA: candidateSha,
    LOCALCI_EXPECTED_COMMIT: candidateSha,
    LOCALCI_RESOLVED_COMMIT: candidateSha,
    LOCALCI_INSTANCE_ID: "CT107-WINDOWS-01",
    LOCALCI_JOB_ID: "01M1TEST0000000000000000000",
    LOCALCI_PIPELINE_ID: "static-ci",
    LOCALCI_PIPELINE_VERSION: "tauri2418-windows-v1",
    LOCALCI_REQUESTED_REF: "refs/heads/codex/example",
    LOCALCI_QUEUED_AT: "2026-09-04T00:00:00Z",
    LOCALCI_STARTED_AT: "2026-09-04T00:00:01Z",
    LOCALCI_RUNNER_OS: "Windows",
    LOCALCI_RUNNER_ARCH: "X64",
    ...overrides,
  };
}

function localCiGateText(gates = GATES, exitCode = 0) {
  return gates.map((gate) => JSON.stringify({
    gate,
    startedAt: "2026-09-04T00:00:01Z",
    finishedAt: "2026-09-04T00:00:02Z",
    exitCode,
  })).join("\n");
}

test("LocalCI execution evidence binds server identities and every measured gate", () => {
  const gateResults = parseLocalCiGateResults(localCiGateText());
  const evidence = buildLocalCiExecutionEvidence({
    env: localCiEnv(),
    versions,
    contractSuiteVersion: "1.0.7",
    governanceMode: "COMPENSATING_CONTROLS",
    gateResults,
  });
  assert.equal(evidence.authority.type, "LOCALCI");
  assert.equal(evidence.requestedRevision.expectedCommit, candidateSha);
  assert.equal(evidence.requestedRevision.resolvedCommit, candidateSha);
  assert.deepEqual(evidence.gateResults.map(({ gate }) => gate), GATES);
  assert.equal(evidence.status, "GATES_PASS_PENDING_AUTHORITY_FINALIZATION");
});

test("LocalCI evidence rejects omitted, duplicate, failed, and mismatched gate/source evidence", () => {
  assert.throws(() => parseLocalCiGateResults(localCiGateText(GATES.slice(1))), /every mandatory gate/);
  assert.throws(() => parseLocalCiGateResults(localCiGateText([...GATES, GATES.at(-1)])), /every mandatory gate/);
  assert.throws(() => parseLocalCiGateResults(localCiGateText(GATES, 1)), /not successful/);
  assert.throws(() => buildLocalCiExecutionEvidence({
    env: localCiEnv({ LOCALCI_RESOLVED_COMMIT: syntheticMergeSha }),
    versions,
    contractSuiteVersion: "1.0.7",
    governanceMode: "COMPENSATING_CONTROLS",
    gateResults: parseLocalCiGateResults(localCiGateText()),
  }), /must match exactly/);
});
