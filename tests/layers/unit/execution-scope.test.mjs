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
import {
  strictestDataPolicy,
  validateDataPolicy,
  validateExecutionScope,
} from "../../../packages/protocol/src/execution-scope-runtime.mts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-execution-scope-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    await testBody(connection, new CoreStateRepository(connection));
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
}

function addTask(connection, taskId) {
  connection.database.prepare(
    "INSERT INTO tasks (task_id, mission_id, state, task_json, version, created_at, updated_at) VALUES (?, ?, 'CREATED', ?, 1, ?, ?)",
  ).run(taskId, "mission-scope", JSON.stringify({ state: "CREATED" }), "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
}

function scopeRequest(overrides = {}) {
  return {
    scopeId: "scope-1",
    taskId: "task-scope-1",
    scope: { kind: "PROJECT_WORKSPACE", projectId: "project-1", workspaceId: "workspace-1", environmentId: "environment-1" },
    dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" },
    expectedVersion: 0,
    now: "2026-08-15T00:00:01.000Z",
    ...overrides,
  };
}

test("execution scope validators preserve typed DataPolicy and reject malformed scope shapes", () => {
  assert.deepEqual(validateDataPolicy({ sensitivity: "SECRET", locality: "LOCAL_ONLY" }), {
    sensitivity: "SECRET",
    locality: "LOCAL_ONLY",
  });
  assert.deepEqual(validateExecutionScope({ kind: "GLOBAL" }), { kind: "GLOBAL" });
  assert.throws(() => validateExecutionScope({ kind: "PROJECT_WORKSPACE", projectId: "p", workspaceId: "w", extra: true }));
  assert.throws(() => validateExecutionScope({ kind: "INTEGRATION", bindings: [], environmentId: "e" }));
  assert.throws(() => validateDataPolicy({ sensitivity: "PRIVATE", locality: "REMOTE" }));
  assert.deepEqual(strictestDataPolicy([
    { sensitivity: "PUBLIC", locality: "ANY_APPROVED_PROVIDER" },
    { sensitivity: "SENSITIVE", locality: "LOCAL_ONLY" },
    { sensitivity: "PRIVATE", locality: "ANY_APPROVED_PROVIDER" },
  ]), { sensitivity: "SENSITIVE", locality: "LOCAL_ONLY" });
  assert.throws(() => strictestDataPolicy([]), /at least one/iu);
});

test("project workspace scope requires membership and remains one versioned scope per task", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    connection.database.prepare("INSERT INTO projects (project_id, project_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run("project-1", "{}", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
    connection.database.prepare("INSERT INTO projects (project_id, project_json, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?)").run("project-2", "{}", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
    connection.database.prepare("INSERT INTO project_workspaces (workspace_id, project_id, workspace_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run("workspace-1", "project-1", "{}", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
    connection.database.prepare("INSERT INTO project_environments (environment_id, project_id, environment_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run("environment-1", "project-1", "{}", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
    connection.database.prepare("INSERT INTO project_environments (environment_id, project_id, environment_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run("environment-2", "project-2", "{}", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
    addTask(connection, "task-scope-1");
    assert.deepEqual(repository.putTaskExecutionScope(scopeRequest()), { scopeId: "scope-1", taskId: "task-scope-1", version: 1 });
    assert.deepEqual(repository.getTaskExecutionScope("scope-1"), {
      scope: { kind: "PROJECT_WORKSPACE", projectId: "project-1", workspaceId: "workspace-1", environmentId: "environment-1" },
      dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" },
    });
    assert.deepEqual(repository.putTaskExecutionScope(scopeRequest({ expectedVersion: 1, dataPolicy: { sensitivity: "SENSITIVE", locality: "LOCAL_ONLY" } })), { scopeId: "scope-1", taskId: "task-scope-1", version: 2 });
    assert.throws(
      () => repository.putTaskExecutionScope(scopeRequest({ scopeId: "scope-2", expectedVersion: 0 })),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT",
    );
    assert.throws(
      () => repository.putTaskExecutionScope(scopeRequest({ scope: { kind: "PROJECT_WORKSPACE", projectId: "other", workspaceId: "workspace-1" }, expectedVersion: 2 })),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.throws(
      () => repository.putTaskExecutionScope(scopeRequest({ expectedVersion: 2, scope: { kind: "PROJECT_WORKSPACE", projectId: "project-1", workspaceId: "workspace-1", environmentId: "environment-2" } })),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.equal(connection.database.prepare("SELECT version FROM task_execution_scopes WHERE scope_id = ?").get("scope-1").version, 2);
  });
});

test("global scope does not create project authority and integration scope requires bound capabilities", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    addTask(connection, "task-global");
    assert.deepEqual(repository.putTaskExecutionScope({
      scopeId: "scope-global",
      taskId: "task-global",
      scope: { kind: "GLOBAL" },
      dataPolicy: { sensitivity: "PUBLIC", locality: "ANY_APPROVED_PROVIDER" },
      expectedVersion: 0,
      now: "2026-08-15T00:00:01.000Z",
    }), { scopeId: "scope-global", taskId: "task-global", version: 1 });
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM projects").get().count, 0);

    connection.database.prepare("INSERT INTO integration_accounts (integration_account_id, provider_id, account_label, credential_handle, state, version, created_at, updated_at) VALUES (?, ?, ?, NULL, 'ACTIVE', 1, ?, ?)").run("account-1", "provider-1", "Test", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
    connection.database.prepare("INSERT INTO integration_capabilities (capability_id, integration_account_id, capability_json, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run("capability-1", "account-1", "{}", "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
    addTask(connection, "task-integration");
    assert.deepEqual(repository.putTaskExecutionScope({
      scopeId: "scope-integration",
      taskId: "task-integration",
      scope: { kind: "INTEGRATION", bindings: [{ integrationId: "integration-1", accountId: "account-1", capabilityIds: ["capability-1"] }] },
      dataPolicy: { sensitivity: "PRIVATE", locality: "ANY_APPROVED_PROVIDER" },
      expectedVersion: 0,
      now: "2026-08-15T00:00:01.000Z",
    }), { scopeId: "scope-integration", taskId: "task-integration", version: 1 });
    assert.throws(
      () => repository.putTaskExecutionScope({
        scopeId: "scope-bad",
        taskId: "task-scope-missing",
        scope: { kind: "INTEGRATION", bindings: [{ integrationId: "integration-1", accountId: "account-1", capabilityIds: ["missing-capability"] }] },
        dataPolicy: { sensitivity: "PRIVATE", locality: "ANY_APPROVED_PROVIDER" },
        expectedVersion: 0,
        now: "2026-08-15T00:00:01.000Z",
      }),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
  });
});
