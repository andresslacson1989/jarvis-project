import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateMissionGraphVersion } from "../../../packages/protocol/src/mission-graph-runtime.mts";
import {
  applyCoreMigrations,
  CoreSchemaError,
  CoreStateRepository,
} from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-mission-graph-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    await testBody(connection, new CoreStateRepository(connection));
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
}

const graph = {
  graphId: "graph-1",
  missionId: "mission-graph-1",
  version: 1,
  createdAt: "2026-08-15T00:00:02.000Z",
  reason: "initial graph",
  causationEventId: "graph-event-1",
  taskIds: ["task-a", "task-b"],
  edges: [{ fromTaskId: "task-b", toTaskId: "task-a", type: "REQUIRES_COMPLETION" }],
  acceptancePolicy: {
    criteria: [{ id: "criterion-1", type: "TEST", description: "test passes", required: true, verifier: { command: "manual" } }],
  },
};

function seedTask(connection, taskId, envelopeId) {
  const taskJson = JSON.stringify({ state: "CREATED", authorityEnvelopeId: envelopeId, dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" } });
  connection.database.prepare(
    "INSERT INTO tasks (task_id, mission_id, state, task_json, version, created_at, updated_at) VALUES (?, ?, 'CREATED', ?, 1, ?, ?)",
  ).run(taskId, "mission-graph-1", taskJson, "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
  connection.database.prepare(
    "INSERT INTO authority_envelopes (envelope_id, mission_id, task_id, envelope_json, policy_version, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
  ).run(envelopeId, "mission-graph-1", taskId, "{}", "policy-v1", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
}

async function seedGraphReady(connection, repository) {
  applyCoreMigrations(connection);
  connection.database.prepare(
    "INSERT INTO missions (mission_id, state, mission_json, version, created_at, updated_at) VALUES (?, 'PLANNING', ?, 1, ?, ?)",
  ).run("mission-graph-1", JSON.stringify({ state: "PLANNING", activeGraphVersion: null }), "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
  seedTask(connection, "task-a", "envelope-a");
  seedTask(connection, "task-b", "envelope-b");
  repository.putTaskExecutionScope({ scopeId: "scope-a", taskId: "task-a", scope: { kind: "GLOBAL" }, dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" }, expectedVersion: 0, now: "2026-08-15T00:00:01.000Z" });
  repository.putTaskExecutionScope({ scopeId: "scope-b", taskId: "task-b", scope: { kind: "GLOBAL" }, dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" }, expectedVersion: 0, now: "2026-08-15T00:00:01.000Z" });
  connection.database.prepare("INSERT INTO authority_envelope_scopes (envelope_id, scope_id, scope_json, created_at) VALUES (?, ?, ?, ?)").run("envelope-a", "scope-a", "{}", "2026-08-15T00:00:01.000Z");
  connection.database.prepare("INSERT INTO authority_envelope_scopes (envelope_id, scope_id, scope_json, created_at) VALUES (?, ?, ?, ?)").run("envelope-b", "scope-b", "{}", "2026-08-15T00:00:01.000Z");
}

test("mission graph validator rejects cycles and malformed output dependencies", () => {
  assert.throws(() => validateMissionGraphVersion({ ...graph, edges: [{ fromTaskId: "task-a", toTaskId: "task-b", type: "REQUIRES_OUTPUT" }] }));
  assert.throws(() => validateMissionGraphVersion({ ...graph, edges: [{ fromTaskId: "task-a", toTaskId: "task-b", type: "REQUIRES_COMPLETION" }, { fromTaskId: "task-b", toTaskId: "task-a", type: "REQUIRES_COMPLETION" }] }));
  assert.throws(() => validateMissionGraphVersion({ ...graph, acceptancePolicy: { criteria: [] } }));
});

test("graph activation validates task ownership/scope/authority and advances the active mission pointer atomically", async () => {
  await withDatabase(async (connection, repository) => {
    await seedGraphReady(connection, repository);
    assert.deepEqual(repository.activateMissionGraphVersion({ graph, expectedMissionVersion: 1, eventId: "graph-event-1", eventType: "MISSION_GRAPH_ACTIVATED", correlationId: "correlation-1" }), {
      graphId: "graph-1",
      missionId: "mission-graph-1",
      graphVersion: 1,
      missionVersion: 2,
      eventId: "graph-event-1",
    });
    assert.equal(connection.database.prepare("SELECT json_extract(mission_json, '$.activeGraphVersion') AS active, version FROM missions WHERE mission_id = ?").get("mission-graph-1").active, 1);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM mission_graph_versions WHERE mission_id = ?").get("mission-graph-1").count, 1);
    assert.throws(() => connection.database.prepare("UPDATE mission_graph_versions SET graph_json = '{}' WHERE graph_id = 'graph-1'").run());
    assert.throws(() => connection.database.prepare("DELETE FROM mission_graph_versions WHERE graph_id = 'graph-1'").run());
    assert.throws(
      () => repository.activateMissionGraphVersion({ graph, expectedMissionVersion: 2, eventId: "graph-event-1", eventType: "MISSION_GRAPH_ACTIVATED", correlationId: "correlation-2" }),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT",
    );
  });
});

test("graph activation fails closed when a task lacks an authority scope binding", async () => {
  await withDatabase(async (connection, repository) => {
    await seedGraphReady(connection, repository);
    connection.database.prepare("DELETE FROM authority_envelope_scopes WHERE envelope_id = ?").run("envelope-b");
    assert.throws(
      () => repository.activateMissionGraphVersion({ graph, expectedMissionVersion: 1, eventId: "graph-event-1", eventType: "MISSION_GRAPH_ACTIVATED", correlationId: "correlation-1" }),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM mission_graph_versions").get().count, 0);
    assert.equal(connection.database.prepare("SELECT version FROM missions WHERE mission_id = ?").get("mission-graph-1").version, 1);
  });
});
