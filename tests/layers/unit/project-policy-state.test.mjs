import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateProjectPolicyMutation } from "../../../packages/policy/src/project-policy-mutation.mjs";
import { validateProjectPolicyDecisionRequest, validateProjectPolicySnapshot, validateProjectPolicyTrustRecord } from "../../../packages/protocol/src/project-policy-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const now = "2026-08-15T00:00:00.000Z";
const sessionId = "0190f2b0-0000-7000-8000-000000000001";

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-policy-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try { await testBody(connection, new CoreStateRepository(connection)); } finally { connection.close(); await rm(root, { recursive: true, force: true }); }
}

function seedAttempt(connection) {
  connection.database.prepare("INSERT INTO projects (project_id, project_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run("project-1", "{}", now, now);
  connection.database.prepare("INSERT INTO missions (mission_id, state, mission_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run("mission-1", "QUEUED", JSON.stringify({ state: "QUEUED", projectId: "project-1" }), now, now);
  connection.database.prepare("INSERT INTO tasks (task_id, mission_id, state, task_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run("task-1", "mission-1", "QUEUED", JSON.stringify({ state: "QUEUED" }), now, now);
  connection.database.prepare("INSERT INTO task_attempts (attempt_id, task_id, state, attempt_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run("attempt-1", "task-1", "RUNNING", JSON.stringify({ state: "RUNNING" }), now, now);
}

function seedUnlockedSession(connection) {
  connection.database.prepare("INSERT INTO session_security_state (state_id, state_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run("primary", JSON.stringify({ userId: "user-1", state: "UNLOCKED", sessionId, unlockedAt: now, lockedReason: null, failedUnlockAttempts: 0, cooldownUntil: null }), now, now);
}

const candidate = { policyTrustId: "policy-1", projectId: "project-1", canonicalRelativePath: "AGENTS.md", canonicalScopeRoot: "C:/work/jarvis", contentSha256: "a".repeat(64), gitBlobOid: "b".repeat(40), sourceCommit: "c".repeat(40), state: "UNTRUSTED_CANDIDATE", revision: 1 };
const policyContent = "trusted project policy snapshot content";

function permission(overrides = {}) {
  return {
    decisionId: "decision-policy-mutation",
    decidedAt: now,
    policyVersion: 1,
    contextualRisk: "HIGH",
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
    matchedPrecedentIds: [],
    ...overrides,
  };
}

test("project policy validators keep candidates untrusted and require acceptance evidence", () => {
  assert.deepEqual(validateProjectPolicyTrustRecord(candidate), candidate);
  assert.throws(() => validateProjectPolicyTrustRecord({ ...candidate, canonicalRelativePath: "../AGENTS.md" }));
  assert.throws(() => validateProjectPolicyTrustRecord({ ...candidate, canonicalRelativePath: "README.md" }), /only AGENTS\.md/u);
  assert.throws(() => validateProjectPolicyTrustRecord({ ...candidate, state: "TRUSTED" }));
  assert.deepEqual(validateProjectPolicyDecisionRequest({ policyTrustId: "policy-1", expectedRevision: 1, decision: "TRUST", userId: "user-1", sessionId, now }), { policyTrustId: "policy-1", expectedRevision: 1, decision: "TRUST", userId: "user-1", sessionId, now });
  assert.deepEqual(validateProjectPolicySnapshot({ snapshotId: "snapshot-1", projectId: "project-1", attemptId: "attempt-1", createdAt: now, policies: [] }).policies, []);
});

test("policy enrollment is versioned, changed content loses trust, and snapshots are immutable", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    seedAttempt(connection);
    seedUnlockedSession(connection);
    assert.deepEqual(repository.registerProjectPolicyCandidate(candidate, now), { id: "policy-1", version: 1 });
    assert.deepEqual(repository.registerProjectPolicyCandidate(candidate, now), { id: "policy-1", version: 1 });
    assert.deepEqual(repository.getProjectPolicyTrustRecords("project-1").map((record) => record.state), ["UNTRUSTED_CANDIDATE"]);
    assert.deepEqual(repository.assertProjectPolicyMutationAllowed("project-1", false), { status: "ALLOWED", policyState: "UNTRUSTED_CANDIDATE" });
    assert.throws(
      () => repository.assertProjectPolicyMutationAllowed("project-1", true),
      (error) => error instanceof CoreSchemaError && error.code === "PROJECT_POLICY_DECISION_REQUIRED",
    );
    const nestedCandidate = { ...candidate, policyTrustId: "policy-2", canonicalRelativePath: "services/AGENTS.md", canonicalScopeRoot: "C:/work/jarvis/services", contentSha256: "d".repeat(64) };
    assert.deepEqual(repository.registerProjectPolicyCandidate(nestedCandidate, now), { id: "policy-2", version: 1 });
    assert.deepEqual(repository.getApplicableProjectPolicies("project-1", "C:/work/jarvis/services/api/file.ts"), []);
    assert.deepEqual(repository.decideProjectPolicyTrust({ policyTrustId: "policy-1", expectedRevision: 1, decision: "TRUST", userId: "user-1", sessionId, now }), { id: "policy-1", version: 2 });
    assert.throws(
      () => repository.assertProjectPolicyMutationAllowed("project-1", true),
      (error) => error instanceof CoreSchemaError && error.code === "PROJECT_POLICY_DECISION_REQUIRED",
    );
    assert.deepEqual(repository.getApplicableProjectPolicies("project-1", "C:/work/jarvis/services/api/file.ts").map((policy) => policy.policyTrustId), ["policy-1"]);
    assert.deepEqual(repository.decideProjectPolicyTrust({ policyTrustId: "policy-2", expectedRevision: 1, decision: "TRUST", userId: "user-1", sessionId, now }), { id: "policy-2", version: 2 });
    assert.deepEqual(repository.getApplicableProjectPolicies("project-1", "C:/work/jarvis/services/api/file.ts").map((policy) => policy.policyTrustId), ["policy-1", "policy-2"]);
    const conflictingCandidate = { ...nestedCandidate, policyTrustId: "policy-3", canonicalRelativePath: "services/other/AGENTS.md", contentSha256: "e".repeat(64) };
    assert.deepEqual(repository.registerProjectPolicyCandidate(conflictingCandidate, now), { id: "policy-3", version: 1 });
    assert.deepEqual(repository.decideProjectPolicyTrust({ policyTrustId: "policy-3", expectedRevision: 1, decision: "TRUST", userId: "user-1", sessionId, now }), { id: "policy-3", version: 2 });
    assert.throws(() => repository.getApplicableProjectPolicies("project-1", "C:/work/jarvis/services/api/file.ts"), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID");
    assert.deepEqual(repository.createProjectPolicySnapshot({ snapshotId: "snapshot-1", projectId: "project-1", attemptId: "attempt-1", createdAt: now, policies: [{ policyTrustId: "policy-1", revision: 2, contentSha256: "a".repeat(64) }] }), { snapshotId: "snapshot-1", attemptId: "attempt-1" });
    assert.deepEqual(repository.getProjectPolicySnapshot("snapshot-1", "project-1", "attempt-1"), { snapshotId: "snapshot-1", projectId: "project-1", attemptId: "attempt-1", createdAt: now, policies: [{ policyTrustId: "policy-1", revision: 2, contentSha256: "a".repeat(64) }] });
    assert.deepEqual(repository.revalidateProjectPolicySnapshot({ snapshotId: "snapshot-1", projectId: "project-1", attemptId: "attempt-1", trigger: "RESUMING" }), { snapshotId: "snapshot-1", projectId: "project-1", attemptId: "attempt-1", trigger: "RESUMING" });
    assert.throws(() => connection.database.prepare("UPDATE project_policy_snapshots SET snapshot_json = '{}' WHERE snapshot_id = 'snapshot-1'").run());
    assert.throws(() => connection.database.prepare("DELETE FROM project_policy_snapshots WHERE snapshot_id = 'snapshot-1'").run());
    assert.deepEqual(repository.putProjectPolicyTrustRecord({ ...candidate, contentSha256: "b".repeat(64), sourceCommit: "d".repeat(40), state: "TRUSTED", acceptedAt: now, acceptedSessionId: "session-2", revision: 3 }, now), { id: "policy-1", version: 3 });
    assert.equal(connection.database.prepare("SELECT state FROM project_policy_trust_records WHERE policy_trust_id = ?").get("policy-1").state, "CHANGED_REVIEW_REQUIRED");
    assert.throws(() => repository.revalidateProjectPolicySnapshot({ snapshotId: "snapshot-1", projectId: "project-1", attemptId: "attempt-1", trigger: "CONSEQUENTIAL_ACTION" }), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    connection.database.prepare("INSERT INTO task_attempts (attempt_id, task_id, state, attempt_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run("attempt-2", "task-1", "RUNNING", JSON.stringify({ state: "RUNNING" }), now, now);
    assert.throws(() => repository.createProjectPolicySnapshot({ snapshotId: "snapshot-2", projectId: "project-1", attemptId: "attempt-2", createdAt: now, policies: [{ policyTrustId: "policy-1", revision: 3, contentSha256: "b".repeat(64) }] }), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
  });
});

test("trusted project-policy context injection is hash-bound and fails closed", async () => {
  const digest = createHash("sha256").update(policyContent, "utf8").digest("hex");
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    seedAttempt(connection);
    seedUnlockedSession(connection);
    const trustedCandidate = { ...candidate, contentSha256: digest };
    repository.registerProjectPolicyCandidate(trustedCandidate, now);
    repository.decideProjectPolicyTrust({ policyTrustId: "policy-1", expectedRevision: 1, decision: "TRUST", userId: "user-1", sessionId, now });
    repository.createProjectPolicySnapshot({ snapshotId: "snapshot-context-1", projectId: "project-1", attemptId: "attempt-1", createdAt: now, policies: [{ policyTrustId: "policy-1", revision: 2, contentSha256: digest }] });
    const items = repository.buildProjectPolicyContextItems("snapshot-context-1", "project-1", "attempt-1", [{ policyTrustId: "policy-1", revision: 2, content: policyContent }]);
    assert.equal(items[0].sourceLabel.sourceType, "PROJECT_POLICY");
    assert.equal(items[0].sourceLabel.authorityClass, "SCOPED_INSTRUCTION");
    assert.equal(items[0].policyRevision, 2);
    assert.match(items[0].sourceLabel.resolutionId, /^project-policy-snapshot:/u);
    assert.throws(() => repository.buildProjectPolicyContextItems("snapshot-context-1", "project-1", "attempt-1", [{ policyTrustId: "policy-1", revision: 2, content: "changed" }]), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    assert.throws(() => repository.buildProjectPolicyContextItems("snapshot-context-1", "project-1", "attempt-1", []), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    assert.throws(() => repository.buildProjectPolicyContextItems("snapshot-context-1", "project-1", "attempt-1", [{ policyTrustId: "policy-1", revision: 1, content: policyContent }]), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
  });
});

test("trusted project-policy mutation is HIGH, user-authorized, target-bound, and never worker-authorized", () => {
  const target = { policyTrustId: "policy-1", projectId: "project-1", canonicalRelativePath: "AGENTS.md", proposedContentSha256: "d".repeat(64) };
  assert.equal(evaluateProjectPolicyMutation({ actorKind: "AUTHENTICATED_USER", target, permission: permission() }).outcome, "ALLOW");
  assert.deepEqual(evaluateProjectPolicyMutation({ actorKind: "WORKER", target, permission: permission() }).reasonCodes, ["PROJECT_POLICY_WORKER_CANNOT_AUTHORIZE"]);
  assert.throws(() => evaluateProjectPolicyMutation({ actorKind: "AUTHENTICATED_USER", target, permission: permission({ contextualRisk: "MODERATE" }) }), /must be HIGH risk/u);
  assert.throws(() => evaluateProjectPolicyMutation({ actorKind: "AUTHENTICATED_USER", target: { ...target, canonicalRelativePath: "README.md" }, permission: permission() }), /only AGENTS\.md/u);
});
