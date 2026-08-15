import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  validateProjectAliasRecord,
  validateProjectEnvironmentRecord,
  validateProjectRecord,
  validateProjectWorkspaceRecord,
} from "../../../packages/protocol/src/project-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const now = "2026-08-15T00:00:00.000Z";

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-project-registry-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    applyCoreMigrations(connection);
    await testBody(connection, new CoreStateRepository(connection));
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
}

const project = {
  projectId: "project-1",
  displayName: "JARVIS",
  canonicalRoot: { platform: "WINDOWS", value: "G:\\Jarvis Project" },
  canonicalIdentity: "project-canonical-1",
  repositoryIdentity: "repo-jarvis-1",
};

test("project registry validators keep canonical paths platform-tagged and identities bounded", () => {
  assert.deepEqual(validateProjectRecord(project), project);
  assert.deepEqual(validateProjectAliasRecord({ alias: "jarvis", projectId: "project-1" }), { alias: "jarvis", projectId: "project-1" });
  assert.deepEqual(validateProjectEnvironmentRecord({ environmentId: "env-1", projectId: "project-1", displayName: "local", kind: "LOCAL", platform: "WINDOWS" }).platform, "WINDOWS");
  assert.equal(validateProjectWorkspaceRecord({ workspaceId: "workspace-1", projectId: "project-1", displayName: "primary", kind: "PRIMARY", canonicalRoot: project.canonicalRoot }).kind, "PRIMARY");
  assert.equal(validateProjectWorkspaceRecord({ workspaceId: "workspace-2", projectId: "project-1", displayName: "feature", kind: "WORKTREE", canonicalRoot: { platform: "WINDOWS", value: "G:\\Jarvis Project-feature" }, worktreeIdentity: "worktree-1", branch: "feature/one" }).worktreeIdentity, "worktree-1");
  assert.throws(() => validateProjectRecord({ ...project, credential: "secret" }), /unsupported or missing fields/u);
  assert.equal(validateProjectRecord({ ...project, canonicalRoot: { platform: "LINUX", value: "/srv/jarvis" } }).canonicalRoot.platform, "LINUX");
  assert.throws(() => validateProjectWorkspaceRecord({ workspaceId: "workspace-2", projectId: "project-1", displayName: "feature", kind: "WORKTREE", canonicalRoot: project.canonicalRoot }), /worktree requires/u);
  assert.throws(() => validateProjectWorkspaceRecord({ workspaceId: "workspace-1", projectId: "project-1", displayName: "primary", kind: "PRIMARY", canonicalRoot: project.canonicalRoot, worktreeIdentity: "worktree-1" }), /primary workspace/u);
});

test("project registry persists aliases, environments, workspaces, and immutable canonical identity", async () => {
  await withDatabase(async (connection, repository) => {
    assert.deepEqual(repository.putProject(project, now), { id: "project-1", version: 1 });
    assert.deepEqual(repository.putProject({ ...project, displayName: "JARVIS Project" }, now), { id: "project-1", version: 2 });
    assert.deepEqual(repository.putProjectAlias({ alias: "jarvis", projectId: "project-1" }, now), { id: "jarvis", version: 1 });
    assert.deepEqual(repository.putProjectAlias({ alias: "jarvis", projectId: "project-1" }, now), { id: "jarvis", version: 2 });
    assert.deepEqual(repository.putProjectEnvironment({ environmentId: "env-1", projectId: "project-1", displayName: "local", kind: "LOCAL", platform: "WINDOWS" }, now), { id: "env-1", version: 1 });
    assert.deepEqual(repository.putProjectWorkspace({ workspaceId: "workspace-1", projectId: "project-1", displayName: "primary", kind: "PRIMARY", canonicalRoot: project.canonicalRoot }, now), { id: "workspace-1", version: 1 });
    assert.deepEqual(repository.putProjectWorkspace({ workspaceId: "workspace-1", projectId: "project-1", displayName: "primary", kind: "PRIMARY", canonicalRoot: project.canonicalRoot, branch: "master" }, now), { id: "workspace-1", version: 2 });

    assert.equal(connection.database.prepare("SELECT project_id FROM project_aliases WHERE alias = ?").get("jarvis").project_id, "project-1");
    assert.equal(connection.database.prepare("SELECT project_id FROM project_environments WHERE environment_id = ?").get("env-1").project_id, "project-1");
    assert.equal(connection.database.prepare("SELECT version FROM project_workspaces WHERE workspace_id = ?").get("workspace-1").version, 2);

    assert.throws(() => repository.putProject({ ...project, canonicalRoot: { platform: "WINDOWS", value: "G:\\Moved" } }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    assert.throws(() => repository.putProjectAlias({ alias: "jarvis", projectId: "project-2" }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID");
    assert.throws(() => repository.putProjectEnvironment({ environmentId: "env-2", projectId: "project-2", displayName: "other", kind: "LOCAL", platform: "WINDOWS" }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID");
    assert.throws(() => repository.putProjectWorkspace({ workspaceId: "workspace-2", projectId: "project-1", displayName: "duplicate", kind: "PRIMARY", canonicalRoot: project.canonicalRoot }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
  });
});
