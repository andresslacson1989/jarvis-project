import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyCoreMigrations,
  CoreSchemaError,
  CoreStateRepository,
} from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-state-machine-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    await testBody(connection, new CoreStateRepository(connection));
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
}

function transition(record, nextState, state, expectedVersion, eventNumber) {
  return {
    ...record,
    nextState,
    state: { state, marker: `${record.eventPrefix}-${eventNumber}` },
    expectedVersion,
    eventId: `${record.eventPrefix}-event-${eventNumber}`,
    eventType: `${record.eventPrefix.toUpperCase()}_${nextState}`,
    correlationId: `${record.eventPrefix}-correlation-${eventNumber}`,
    occurredAt: `2026-08-15T00:00:${String(eventNumber).padStart(2, "0")}.000Z`,
  };
}

test("mission transitions enforce canonical edges, monotonic versions, and terminal invariants", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    const record = { missionId: "mission-1", eventPrefix: "mission-1" };
    assert.equal(repository.transitionMission(transition(record, "CREATED", "CREATED", 0, 1)).version, 1);
    assert.equal(repository.transitionMission(transition(record, "PLANNING", "PLANNING", 1, 2)).version, 2);
    assert.throws(
      () => repository.transitionMission(transition(record, "RUNNING", "RUNNING", 2, 3)),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.equal(connection.database.prepare("SELECT version FROM missions WHERE mission_id = ?").get("mission-1").version, 2);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM events WHERE aggregate_id = ?").get("mission-1").count, 2);
    assert.equal(repository.transitionMission(transition(record, "QUEUED", "QUEUED", 2, 3)).version, 3);
    assert.equal(repository.transitionMission(transition(record, "RUNNING", "RUNNING", 3, 4)).version, 4);
    assert.equal(repository.transitionMission(transition(record, "VERIFYING", "VERIFYING", 4, 5)).version, 5);
    assert.equal(repository.transitionMission(transition(record, "COMPLETED", "COMPLETED", 5, 6)).version, 6);
    assert.throws(
      () => repository.transitionMission(transition(record, "RUNNING", "RUNNING", 6, 7)),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
  });
});

test("task RESUMING is durable and cannot be bypassed from PAUSED", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    const mission = { missionId: "mission-2", eventPrefix: "mission-2" };
    repository.transitionMission(transition(mission, "CREATED", "CREATED", 0, 1));
    const task = { taskId: "task-1", missionId: "mission-2", eventPrefix: "task-1" };
    assert.equal(repository.transitionTask(transition(task, "CREATED", "CREATED", 0, 2)).version, 1);
    assert.equal(repository.transitionTask(transition(task, "QUEUED", "QUEUED", 1, 3)).version, 2);
    assert.equal(repository.transitionTask(transition(task, "STARTING", "STARTING", 2, 4)).version, 3);
    assert.equal(repository.transitionTask(transition(task, "RUNNING", "RUNNING", 3, 5)).version, 4);
    assert.equal(repository.transitionTask(transition(task, "PAUSING", "PAUSING", 4, 6)).version, 5);
    assert.equal(repository.transitionTask(transition(task, "PAUSED", "PAUSED", 5, 7)).version, 6);
    assert.throws(
      () => repository.transitionTask(transition(task, "RUNNING", "RUNNING", 6, 8)),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.equal(repository.transitionTask(transition(task, "RESUMING", "RESUMING", 6, 8)).version, 7);
    assert.equal(connection.database.prepare("SELECT state, version FROM tasks WHERE task_id = ?").get("task-1").state, "RESUMING");
    assert.equal(repository.transitionTask(transition(task, "RUNNING", "RUNNING", 7, 9)).version, 8);
  });
});

test("mission resume refuses to bypass paused task RESUMING validation", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    const mission = { missionId: "mission-3", eventPrefix: "mission-3" };
    repository.transitionMission(transition(mission, "CREATED", "CREATED", 0, 1));
    repository.transitionMission(transition(mission, "PLANNING", "PLANNING", 1, 2));
    repository.transitionMission(transition(mission, "QUEUED", "QUEUED", 2, 3));
    repository.transitionMission(transition(mission, "RUNNING", "RUNNING", 3, 4));
    repository.transitionMission(transition(mission, "PAUSING", "PAUSING", 4, 5));
    repository.transitionMission(transition(mission, "PAUSED", "PAUSED", 5, 6));
    const task = { taskId: "task-2", missionId: "mission-3", eventPrefix: "task-2" };
    repository.transitionTask(transition(task, "CREATED", "CREATED", 0, 7));
    repository.transitionTask(transition(task, "QUEUED", "QUEUED", 1, 8));
    repository.transitionTask(transition(task, "STARTING", "STARTING", 2, 9));
    repository.transitionTask(transition(task, "RUNNING", "RUNNING", 3, 10));
    repository.transitionTask(transition(task, "PAUSING", "PAUSING", 4, 11));
    repository.transitionTask(transition(task, "PAUSED", "PAUSED", 5, 12));
    assert.throws(
      () => repository.transitionMission(transition(mission, "RUNNING", "RUNNING", 6, 13)),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.equal(connection.database.prepare("SELECT state, version FROM missions WHERE mission_id = ?").get("mission-3").state, "PAUSED");
    repository.transitionTask(transition(task, "RESUMING", "RESUMING", 6, 13));
    assert.equal(repository.transitionMission(transition(mission, "RUNNING", "RUNNING", 6, 14)).version, 7);
  });
});

test("attempt terminal UNCERTAIN state is durable and cannot be retried in place", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    const mission = { missionId: "mission-4", eventPrefix: "mission-4" };
    repository.transitionMission(transition(mission, "CREATED", "CREATED", 0, 1));
    const task = { taskId: "task-3", missionId: "mission-4", eventPrefix: "task-3" };
    repository.transitionTask(transition(task, "CREATED", "CREATED", 0, 2));
    const attempt = { attemptId: "attempt-1", taskId: "task-3", eventPrefix: "attempt-1" };
    assert.equal(repository.transitionAttempt(transition(attempt, "QUEUED", "QUEUED", 0, 3)).version, 1);
    assert.equal(repository.transitionAttempt(transition(attempt, "STARTING", "STARTING", 1, 4)).version, 2);
    assert.equal(repository.transitionAttempt(transition(attempt, "RUNNING", "RUNNING", 2, 5)).version, 3);
    assert.equal(repository.transitionAttempt(transition(attempt, "UNCERTAIN", "UNCERTAIN", 3, 6)).version, 4);
    assert.throws(
      () => repository.transitionAttempt(transition(attempt, "QUEUED", "QUEUED", 4, 7)),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.equal(connection.database.prepare("SELECT state FROM task_attempts WHERE attempt_id = ?").get("attempt-1").state, "UNCERTAIN");
  });
});
