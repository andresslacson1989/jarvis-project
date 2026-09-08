import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSection14Evidence,
  validateSection14Evidence,
} from "../../../tools/ci/verify-section-1-4-evidence.mjs";

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

function snapshot() {
  return {
    pid: 10,
    handle: "0x1",
    title: "JARVIS",
    visible: true,
    foregroundPid: 10,
    foregroundOwner: true,
    running: true,
  };
}

function toolchain() {
  return {
    rust: "rustc 1.97.1",
    cargo: "cargo 1.97.1",
    node: "v24.18.0",
    pnpm: "11.21.0",
  };
}

function tauriEvidence(overrides = {}) {
  return {
    schemaVersion: 2,
    scope: "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION",
    status: "PASS",
    ...hostedIdentity(),
    toolchain: toolchain(),
    profile: {
      executable: "target/x86_64-pc-windows-msvc/release/jarvis-desktop.exe",
      feature: "test-support",
      dataRoot: "fresh temporary test-support LocalAppData override",
      startupBoundSeconds: 15,
      activationBoundSeconds: 10,
      readinessGraceSeconds: 5,
      hideBoundSeconds: 5,
    },
    executableSha256: "c".repeat(64),
    cleanup: { attempted: true, succeeded: true, error: null },
    failure: null,
    ownerInitial: snapshot(),
    ownerHidden: { ...snapshot(), visible: false, foregroundOwner: false },
    second: { pid: 11, exitCode: 0 },
    ownerFinal: snapshot(),
    diagnostics: { ownerStderr: "", secondStderr: "" },
    ...overrides,
  };
}

function nativeEvidence(overrides = {}) {
  return {
    schemaVersion: 2,
    scope: "SECTION_1_4_WINDOWS_NATIVE_QUALIFICATION",
    status: "PASS",
    ...hostedIdentity(),
    toolchain: toolchain(),
    profile: {
      cargoCommand: "cargo test --locked -p jarvis-windows-native --features test-support --all-targets -- --test-threads=1",
      features: ["test-support"],
      target: "host Windows x64",
      testThreads: 1,
    },
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

test("repository and remote identity are exact allowlisted authority inputs", () => {
  assertRejected(tauriEvidence({
    authority: { ...hostedIdentity().authority, repository: "evil/evilrepo" },
    observed: { ...hostedIdentity().observed, remote: "https://evil.com/evil/evilrepo.git" },
  }), { authoritative: true });
  assertRejected(tauriEvidence({
    observed: { ...hostedIdentity().observed, remote: "https://github.com.evil/andresslacson1989/jarvis-project.git" },
  }), { authoritative: true });
  assertRejected(tauriEvidence({
    observed: { ...hostedIdentity().observed, remote: "https://github.com/andresslacson1989/jarvis-project-extra.git" },
  }), { authoritative: true });
  assert.deepEqual(validateSection14Evidence(tauriEvidence({
    observed: { ...hostedIdentity().observed, remote: "ssh://github.com:andresslacson1989/jarvis-project.git" },
  }), { authoritative: true }).status, "PASS");
});

test("pull-request identity requires a valid headRef and push policy is bounded", () => {
  assertRejected(tauriEvidence({
    authority: { ...hostedIdentity().authority, headRef: null },
  }), { authoritative: true });
  assertRejected(tauriEvidence({
    authority: { ...hostedIdentity().authority, headRef: "refs/heads/../evil" },
  }), { authoritative: true });
  assertRejected(tauriEvidence({
    authority: { ...hostedIdentity().authority, ref: "refs/heads/codex/unsupported", headRef: null },
  }), { authoritative: true });
  assert.deepEqual(validateSection14Evidence(tauriEvidence({
    authority: { ...hostedIdentity().authority, ref: "refs/heads/master", headRef: null },
  }), { authoritative: true }).status, "PASS");
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
    cleanup: { attempted: true, succeeded: false, error: "injected cleanup failure" },
  });
  assert.equal(validateSection14Evidence(failure, { authoritative: true }).status, "FAIL");
});

test("truncated or structurally invalid evidence is rejected", () => {
  assertRejected({ schemaVersion: 1 });
  assertRejected(nativeEvidence({ observed: { ...hostedIdentity().observed, worktreeClean: false } }), { authoritative: true });
  assertRejected(tauriEvidence({ finishedAt: "2026-09-08T23:59:59.000Z" }), { authoritative: true });
  assertRejected(tauriEvidence({ unexpectedTopLevel: true }), { authoritative: true });
  assertRejected(tauriEvidence({ toolchain: { ...toolchain(), extra: "ignored" } }), { authoritative: true });
  assertRejected(nativeEvidence({ tests: [{ test_id: "one", test_name: "one", criterion: "first", result: "OK", extra: true }, { test_id: "two", test_name: "two", criterion: "second", result: "OK" }] }), { authoritative: true });
  assertRejected(tauriEvidence({ startedAt: "2026-09-09T00:00:00+00:00" }), { authoritative: true });
  assertRejected(tauriEvidence({ cleanup: { attempted: true, succeeded: true, error: "not null" } }), { authoritative: true });
});

test("duplicate JSON keys are rejected before JSON.parse can collapse them", () => {
  const raw = JSON.stringify(tauriEvidence()).replace('"schemaVersion":2,', '"schemaVersion":2,"schemaVersion":2,');
  assert.throws(() => parseSection14Evidence(raw), /duplicate JSON object key schemaVersion/);
});
