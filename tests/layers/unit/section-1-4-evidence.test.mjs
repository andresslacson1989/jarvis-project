import test from "node:test";
import assert from "node:assert/strict";
import { validateSection14Evidence } from "../../../tools/ci/verify-section-1-4-evidence.mjs";

const candidate = "a".repeat(40);
const tree = "b".repeat(40);

function hostedIdentity() {
  return {
    evidenceMode: "AUTHORITATIVE_GITHUB_ACTIONS",
    candidateSha: candidate,
    authority: {
      type: "GITHUB_ACTIONS",
      repository: "andresslacson1989/jarvis-project",
      ref: "refs/pull/18/merge",
      headRef: "codex/section1-4-current-master",
      workflow: "Static CI",
      runId: "34248432787",
      runAttempt: "1",
      job: "windows-tauri-build",
    },
    runner: { os: "Windows", arch: "X64", image: "windows-2025" },
    observed: {
      checkoutSha: candidate,
      treeSha: tree,
      remote: "https://github.com/andresslacson1989/jarvis-project.git",
      checkoutRelationship: "EXACT_CHECKOUT",
      worktreeClean: true,
      identityError: null,
    },
    startedAt: "2026-09-09T00:00:00.000Z",
    finishedAt: "2026-09-09T00:01:00.000Z",
    forcedCleanup: false,
  };
}

function tauriEvidence(overrides = {}) {
  return {
    schemaVersion: 2,
    scope: "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION",
    status: "PASS",
    ...hostedIdentity(),
    profile: { feature: "test-support" },
    executableSha256: "c".repeat(64),
    failure: null,
    ownerInitial: { pid: 10 },
    ownerHidden: { pid: 10 },
    second: { pid: 11, exitCode: 0 },
    ownerFinal: { pid: 10 },
    ...overrides,
  };
}

function nativeEvidence(overrides = {}) {
  return {
    schemaVersion: 2,
    scope: "SECTION_1_4_WINDOWS_NATIVE_QUALIFICATION",
    status: "PASS",
    ...hostedIdentity(),
    failure: null,
    manifestCount: 2,
    observedCount: 2,
    missingTests: [],
    unexpectedTests: [],
    manifestError: null,
    logSha256: "d".repeat(64),
    exitCode: 0,
    tests: [
      { test_id: "one", criterion: "first", result: "OK" },
      { test_id: "two", criterion: "second", result: "OK" },
    ],
    ...overrides,
  };
}

function assertRejected(value, options = {}) {
  assert.throws(
    () => validateSection14Evidence(value, options),
    /Section 1\.4 evidence rejected:/,
  );
}

test("valid hosted Tauri evidence proves exact candidate identity", () => {
  assert.deepEqual(
    validateSection14Evidence(tauriEvidence(), {
      authoritative: true,
      expectedCandidateSha: candidate,
    }),
    {
      scope: "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION",
      status: "PASS",
      evidenceMode: "AUTHORITATIVE_GITHUB_ACTIONS",
      candidateSha: candidate,
    },
  );
});

test("missing or malformed candidate evidence fails closed", () => {
  assertRejected(tauriEvidence({ candidateSha: null }), { authoritative: true });
  assertRejected(tauriEvidence({ candidateSha: "not-a-sha" }), { authoritative: true });
  assertRejected(tauriEvidence(), { authoritative: true, expectedCandidateSha: "f".repeat(40) });
});

test("null, wrong, or unsupported authority metadata is rejected", () => {
  assertRejected(tauriEvidence({ authority: { ...hostedIdentity().authority, repository: null } }), { authoritative: true });
  assertRejected(tauriEvidence({ authority: { ...hostedIdentity().authority, repository: "other/project" } }), { authoritative: true });
  assertRejected(tauriEvidence({ authority: { ...hostedIdentity().authority, ref: "main" } }), { authoritative: true });
  assertRejected(tauriEvidence({ authority: { ...hostedIdentity().authority, unexpected: "field" } }), { authoritative: true });
  assertRejected(tauriEvidence({ observed: { ...hostedIdentity().observed, checkoutSha: "f".repeat(40) } }), { authoritative: true });
});

test("supporting local evidence cannot be promoted to authoritative evidence", () => {
  const supporting = tauriEvidence({
    status: "SUPPORTING_PASS",
    evidenceMode: "SUPPORTING_LOCAL",
    authority: Object.fromEntries(Object.keys(hostedIdentity().authority).map((key) => [key, null])),
    observed: {
      ...hostedIdentity().observed,
      checkoutRelationship: "SUPPORTING_LOCAL",
    },
  });
  assert.deepEqual(validateSection14Evidence(supporting), {
    scope: "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION",
    status: "SUPPORTING_PASS",
    evidenceMode: "SUPPORTING_LOCAL",
    candidateSha: candidate,
  });
  assertRejected(supporting, { authoritative: true, expectedCandidateSha: candidate });
});

test("passing evidence cannot omit expected native records", () => {
  assertRejected(nativeEvidence({ observedCount: 1 }), { authoritative: true });
  assertRejected(nativeEvidence({ tests: [{ test_id: "one", criterion: "first", result: "OK" }] }), { authoritative: true });
  assertRejected(nativeEvidence({ tests: [{ test_id: "one", criterion: "first", result: "FAILED" }, { test_id: "two", criterion: "second", result: "OK" }] }), { authoritative: true });
});

test("authoritative failure evidence retains the common identity schema", () => {
  const failure = tauriEvidence({
    status: "FAIL",
    failure: "qualification process failed",
    ownerInitial: null,
    ownerHidden: null,
    ownerFinal: null,
    second: { pid: 0, exitCode: null },
  });
  assert.equal(validateSection14Evidence(failure, { authoritative: true }).status, "FAIL");
});

test("truncated or structurally invalid evidence is rejected", () => {
  assertRejected({ schemaVersion: 1 });
  assertRejected(nativeEvidence({ observed: { ...hostedIdentity().observed, worktreeClean: false } }), { authoritative: true });
  assertRejected(tauriEvidence({ finishedAt: "2026-09-08T23:59:59.000Z" }), { authoritative: true });
});
