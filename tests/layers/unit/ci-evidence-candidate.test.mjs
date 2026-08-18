import test from "node:test";
import assert from "node:assert/strict";
import { buildCiEvidence } from "../../../tools/ci/generate-evidence.mjs";

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
    contractSuiteVersion: "1.0.6",
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
      contractSuiteVersion: "1.0.6",
      governanceMode: "COMPENSATING_CONTROLS",
    }),
    /JARVIS_CANDIDATE_SHA/,
  );

  assert.throws(
    () => buildCiEvidence({
      env: env({ JARVIS_CANDIDATE_SHA: "not-a-sha" }),
      versions,
      contractSuiteVersion: "1.0.6",
      governanceMode: "COMPENSATING_CONTROLS",
    }),
    /JARVIS_CANDIDATE_SHA/,
  );
});
