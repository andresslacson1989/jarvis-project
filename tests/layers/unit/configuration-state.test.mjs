import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateConfigurationCandidate } from "../../../packages/protocol/src/config-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const NOW = "2026-08-15T00:00:00.000Z";

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-config-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    applyCoreMigrations(connection, () => NOW);
    await testBody(connection, new CoreStateRepository(connection));
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
}

function candidate(candidateId, expectedActiveVersion, values = { mode: "safe" }) {
  return { candidateId, domain: "STARTUP", schemaVersion: 1, values, expectedActiveVersion, createdAt: NOW };
}

test("configuration candidates are bounded, versioned, non-secret, and reject unknown flags", () => {
  assert.equal(validateConfigurationCandidate(candidate("candidate-1", 0)).schemaVersion, 1);
  assert.throws(() => validateConfigurationCandidate(candidate("candidate-secret", 0, { apiToken: "never-store" })), /secret-bearing/);
  assert.throws(() => validateConfigurationCandidate(candidate("candidate-flag", 0, { "feature.experimental": true })), /feature flags/);
  assert.throws(() => validateConfigurationCandidate({ ...candidate("candidate-extra", 0), unexpected: true }), /unsupported/);
});

test("configuration activation is one authoritative atomic pointer and preserves the prior version on conflict", async () => {
  await withDatabase(async (connection, repository) => {
    assert.deepEqual(repository.stageConfigurationCandidate(candidate("candidate-1", 0)), { candidateId: "candidate-1", state: "STAGED" });
    assert.deepEqual(repository.activateConfigurationCandidate("candidate-1", 0, NOW), { candidateId: "candidate-1", domain: "STARTUP", version: 1 });
    assert.deepEqual(repository.getActiveConfiguration("STARTUP"), {
      domain: "STARTUP",
      schemaVersion: 1,
      values: { mode: "safe" },
      version: 1,
      sourceCandidateId: "candidate-1",
      activatedAt: NOW,
    });

    assert.deepEqual(repository.stageConfigurationCandidate(candidate("candidate-2", 1, { mode: "strict" })), { candidateId: "candidate-2", state: "STAGED" });
    assert.deepEqual(repository.activateConfigurationCandidate("candidate-2", 1, "2026-08-15T00:00:01.000Z"), { candidateId: "candidate-2", domain: "STARTUP", version: 2 });
    assert.throws(
      () => repository.activateConfigurationCandidate("candidate-2", 2, "2026-08-15T00:00:02.000Z"),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT",
    );
    assert.equal(repository.getActiveConfiguration("STARTUP").sourceCandidateId, "candidate-2");
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE event_type = 'CONFIGURATION_ACTIVATED'").get().count, 2);
  });
});

test("configuration activation rolls back active state and candidate state when audit persistence fails", async () => {
  await withDatabase(async (connection, repository) => {
    repository.stageConfigurationCandidate(candidate("candidate-audit-conflict", 0));
    connection.database
      .prepare("INSERT INTO audit_events (audit_event_id, event_type, subject_type, subject_id, audit_json, occurred_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("configuration-activation:candidate-audit-conflict:1", "FIXTURE", "FIXTURE", "fixture", "{}", NOW);
    assert.throws(() => repository.activateConfigurationCandidate("candidate-audit-conflict", 0, NOW));
    assert.equal(repository.getActiveConfiguration("STARTUP"), undefined);
    assert.equal(connection.database.prepare("SELECT state FROM configuration_candidates WHERE candidate_id = ?").get("candidate-audit-conflict").state, "STAGED");
  });
});
