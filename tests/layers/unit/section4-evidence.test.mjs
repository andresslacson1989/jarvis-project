import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository, CURRENT_SCHEMA_VERSION } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const NOW = "2026-08-15T00:00:00.000Z";

test("Section 4 evidence proves migration integrity, illegal/stale rejection, atomic rollback, and secret-safe schema", async () => {
  const root = join(tmpdir(), `jarvis-section4-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  const connection = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK });
  try {
    const first = applyCoreMigrations(connection, () => NOW);
    assert.equal(first.currentVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(first.appliedMigrationIds.length, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(applyCoreMigrations(connection, () => "2026-08-15T00:00:01.000Z"), first);

    const repository = new CoreStateRepository(connection);
    assert.throws(
      () => repository.transitionMission({ missionId: "mission-4-16", nextState: "COMPLETED", state: { state: "COMPLETED" }, expectedVersion: 0, eventId: "illegal-event", eventType: "MISSION_COMPLETED", correlationId: "illegal-correlation", occurredAt: NOW }),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.deepEqual(repository.transitionMission({ missionId: "mission-4-16", nextState: "CREATED", state: { state: "CREATED" }, expectedVersion: 0, eventId: "created-event", eventType: "MISSION_CREATED", correlationId: "created-correlation", occurredAt: NOW }), { recordId: "mission-4-16", version: 1, eventId: "created-event" });
    assert.throws(
      () => repository.transitionMission({ missionId: "mission-4-16", nextState: "PLANNING", state: { state: "PLANNING" }, expectedVersion: 0, eventId: "stale-event", eventType: "MISSION_PLANNING", correlationId: "stale-correlation", occurredAt: "2026-08-15T00:00:02.000Z" }),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT",
    );

    repository.transition({ recordId: "section4-record", recordType: "EVIDENCE", state: { state: "READY" }, expectedVersion: 0, eventId: "rollback-event", eventType: "EVIDENCE_READY", correlationId: "rollback-correlation", occurredAt: NOW });
    assert.throws(() => repository.transition({ recordId: "section4-record", recordType: "EVIDENCE", state: { state: "DONE" }, expectedVersion: 1, eventId: "rollback-event", eventType: "EVIDENCE_DONE", correlationId: "rollback-correlation-2", occurredAt: "2026-08-15T00:00:03.000Z" }));
    assert.equal(connection.database.prepare("SELECT version FROM authoritative_records WHERE record_id = ?").get("section4-record").version, 1);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE subject_id = ?").get("section4-record").count, 1);

    const tables = connection.database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name);
    for (const table of tables) {
      for (const { name } of connection.database.pragma(`table_info(${table})`)) {
        assert.doesNotMatch(name, /password|private_key|raw_key|recovery_factor|db_dek|backup_dek|snapshot_db_key|oauth_token/iu, `${table}.${name} must not store raw secret material`);
      }
    }
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
