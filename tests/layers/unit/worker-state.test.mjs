import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateArtifact, validateLease } from "../../../packages/protocol/src/worker-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const now = "2026-08-15T00:00:00.000Z";

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-worker-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try { await testBody(connection, new CoreStateRepository(connection)); } finally { connection.close(); await rm(root, { recursive: true, force: true }); }
}

function seedAttempt(connection) {
  connection.database.prepare("INSERT INTO projects (project_id, project_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run("project-1", "{}", now, now);
  connection.database.prepare("INSERT INTO project_workspaces (workspace_id, project_id, workspace_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run("workspace-1", "project-1", "{}", now, now);
  connection.database.prepare("INSERT INTO missions (mission_id, state, mission_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run("mission-1", "QUEUED", JSON.stringify({ state: "QUEUED" }), now, now);
  connection.database.prepare("INSERT INTO tasks (task_id, mission_id, state, task_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run("task-1", "mission-1", "QUEUED", JSON.stringify({ state: "QUEUED" }), now, now);
  connection.database.prepare("INSERT INTO task_attempts (attempt_id, task_id, state, attempt_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)").run("attempt-1", "task-1", "RUNNING", JSON.stringify({ state: "RUNNING" }), now, now);
}

const artifact = {
  artifactId: "artifact-1",
  logicalType: "test-output",
  contentType: "text/plain",
  size: 3,
  sha256: "a".repeat(64),
  producingAttemptId: "attempt-1",
  projectId: "project-1",
  dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" },
  retention: "MISSION",
  storageRef: "artifact://artifact-1",
};

function checkpoint(sequence) {
  return {
    checkpointId: `checkpoint-${sequence}`,
    taskId: "task-1",
    attemptId: "attempt-1",
    sequence,
    createdAt: now,
    goalSummary: "Run the bounded task",
    completedWork: sequence === 1 ? [] : ["captured first checkpoint"],
    decisions: ["continue from durable state"],
    findings: [],
    artifacts: [artifact],
    verificationState: [{ name: "worker-state", result: "recorded" }],
    currentActivity: "checkpointing",
    blockers: [],
    liveStateAssumptions: ["task remains owned by this attempt"],
    ...(sequence === 2 ? { providerResume: { providerId: "provider-1", providerVersion: "1", modelId: "model-1", handle: "opaque-resume-handle", createdAt: now, lastVerifiedAt: now } } : {}),
  };
}

test("worker protocol rejects secret artifacts and validates lease ownership shape", () => {
  assert.throws(() => validateArtifact({ ...artifact, dataPolicy: { sensitivity: "SECRET", locality: "LOCAL_ONLY" } }));
  assert.throws(() => validateLease({ leaseId: "lease-1", resourceType: "GPU", resourceId: "gpu-1", ownerInstanceId: "instance-1", ownerAttemptId: "attempt-1", leaseType: "EXCLUSIVE", state: "ACTIVE", acquiredAt: now, heartbeatAt: now }));
  assert.equal(validateLease({ leaseId: "lease-1", resourceType: "GPU", resourceId: "gpu-1", ownerInstanceId: "instance-1", ownerTaskId: "task-1", ownerAttemptId: "attempt-1", leaseType: "EXCLUSIVE", state: "ACTIVE", acquiredAt: now, heartbeatAt: now }).state, "ACTIVE");
});

test("worker checkpoints persist artifacts and enforce monotonic attempt progress", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    seedAttempt(connection);
    assert.deepEqual(repository.putArtifact(artifact), { artifactId: "artifact-1" });
    assert.deepEqual(repository.appendWorkerCheckpoint("worker-1", checkpoint(1)), { checkpointId: "checkpoint-1", sequence: 1 });
    assert.deepEqual(repository.appendWorkerCheckpoint("worker-1", checkpoint(2)), { checkpointId: "checkpoint-2", sequence: 2 });
    assert.equal(connection.database.prepare("SELECT json_extract(checkpoint_json, '$.providerResume.handle') AS handle FROM worker_checkpoints WHERE checkpoint_id = ?").get("checkpoint-2").handle, "opaque-resume-handle");
    assert.throws(() => repository.appendWorkerCheckpoint("worker-1", checkpoint(2)), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    assert.throws(() => repository.putArtifact({ ...artifact, storageRef: "artifact://changed" }), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
  });
});

test("workspace and resource leases are exclusive and retain owner metadata", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    seedAttempt(connection);
    const workspaceLease = { leaseId: "lease-workspace-1", resourceType: "WORKSPACE", resourceId: "workspace-1", ownerInstanceId: "instance-1", ownerTaskId: "task-1", ownerAttemptId: "attempt-1", leaseType: "EXCLUSIVE", state: "ACTIVE", acquiredAt: now, heartbeatAt: now };
    assert.deepEqual(repository.acquireWorkspaceLease(workspaceLease), { leaseId: "lease-workspace-1", version: 1 });
    assert.throws(() => repository.acquireWorkspaceLease({ ...workspaceLease, leaseId: "lease-workspace-2" }), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    const resourceLease = { leaseId: "lease-gpu-1", resourceType: "GPU", resourceId: "gpu-1", ownerInstanceId: "instance-1", ownerTaskId: "task-1", ownerAttemptId: "attempt-1", leaseType: "EXCLUSIVE", state: "ACTIVE", acquiredAt: now, heartbeatAt: now };
    assert.deepEqual(repository.acquireResourceLease(resourceLease), { leaseId: "lease-gpu-1", version: 1 });
    assert.throws(() => repository.acquireResourceLease({ ...resourceLease, leaseId: "lease-gpu-2" }), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
  });
});
