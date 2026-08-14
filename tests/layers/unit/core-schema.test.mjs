import { strict as assert } from "node:assert";
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
  const root = join(tmpdir(), `jarvis-schema-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    await testBody(connection);
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
}

test("schema migration is deterministic, idempotent, and rejects newer schemas", async () => {
  await withDatabase(async (connection) => {
    const first = applyCoreMigrations(connection, () => "2026-08-14T00:00:00.000Z");
    assert.deepEqual(first.appliedMigrationIds, ["0001-core-proof-schema"]);
    assert.equal(first.currentVersion, 1);
    const second = applyCoreMigrations(connection, () => "2026-08-14T00:00:01.000Z");
    assert.deepEqual(second, first);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count, 1);
    connection.database.pragma("user_version = 99");
    assert.throws(
      () => applyCoreMigrations(connection),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_UNSUPPORTED",
    );
  });
});

test("state transition commits authoritative state and causative event atomically with version checks", async () => {
  await withDatabase(async (connection) => {
    applyCoreMigrations(connection, () => "2026-08-14T00:00:00.000Z");
    const repository = new CoreStateRepository(connection);
    const first = repository.transition({
      recordId: "record-1",
      recordType: "PROOF_RECORD",
      state: { status: "CREATED" },
      expectedVersion: 0,
      eventId: "event-1",
      eventType: "PROOF_RECORD_CREATED",
      correlationId: "correlation-1",
      occurredAt: "2026-08-14T00:00:01.000Z",
    });
    assert.deepEqual(first, { recordId: "record-1", version: 1, eventId: "event-1" });
    const second = repository.transition({
      recordId: "record-1",
      recordType: "PROOF_RECORD",
      state: { status: "READY" },
      expectedVersion: 1,
      eventId: "event-2",
      eventType: "PROOF_RECORD_READY",
      correlationId: "correlation-2",
      occurredAt: "2026-08-14T00:00:02.000Z",
    });
    assert.equal(second.version, 2);
    assert.equal(connection.database.prepare("SELECT version FROM authoritative_records WHERE record_id = ?").get("record-1").version, 2);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM events WHERE aggregate_id = ?").get("record-1").count, 2);
    assert.throws(
      () => repository.transition({
        recordId: "record-1",
        recordType: "PROOF_RECORD",
        state: { status: "STALE" },
        expectedVersion: 1,
        eventId: "event-stale",
        eventType: "PROOF_RECORD_STALE",
        correlationId: "correlation-stale",
        occurredAt: "2026-08-14T00:00:03.000Z",
      }),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT",
    );
    assert.throws(() => repository.transition({
      recordId: "record-2",
      recordType: "PROOF_RECORD",
      state: { status: "DUPLICATE_EVENT" },
      expectedVersion: 0,
      eventId: "event-1",
      eventType: "PROOF_RECORD_DUPLICATE",
      correlationId: "correlation-duplicate",
      occurredAt: "2026-08-14T00:00:04.000Z",
    }));
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM authoritative_records WHERE record_id = ?").get("record-2").count, 0);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM events WHERE aggregate_id = ?").get("record-1").count, 2);
  });
});

test("integration-account proof schema stores only opaque credential handles and restore-safe state", async () => {
  await withDatabase(async (connection) => {
    applyCoreMigrations(connection);
    const columns = connection.database.pragma("table_info(integration_accounts)").map((row) => row.name);
    assert.deepEqual(columns, [
      "integration_account_id",
      "provider_id",
      "account_label",
      "credential_handle",
      "state",
      "version",
      "created_at",
      "updated_at",
    ]);
    assert.equal(columns.some((name) => /secret|token|password|key/iu.test(name)), false);
    connection.database.prepare(
      "INSERT INTO integration_accounts (integration_account_id, provider_id, account_label, credential_handle, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("account-1", "provider-1", "Example", null, "REAUTH_REQUIRED", 1, "2026-08-14T00:00:00.000Z", "2026-08-14T00:00:00.000Z");
    assert.equal(connection.database.prepare("SELECT state, credential_handle FROM integration_accounts WHERE integration_account_id = ?").get("account-1").state, "REAUTH_REQUIRED");
  });
});

test("portable restore invalidates copied integration handles and requires re-authentication", async () => {
  const root = join(tmpdir(), `jarvis-schema-restore-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    applyCoreMigrations(connection, () => "2026-08-14T00:00:00.000Z");
    connection.database
      .prepare(
        "INSERT INTO integration_accounts (integration_account_id, provider_id, account_label, credential_handle, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "account-restore",
        "provider-restore",
        "Example",
        "opaque-old-profile-handle",
        "ACTIVE",
        1,
        "2026-08-14T00:00:00.000Z",
        "2026-08-14T00:00:00.000Z",
      );
    const result = new CoreStateRepository(connection).markPortableRestoreCredentialsReauthRequired(
      "2026-08-14T01:00:00.000Z",
      {
        profileId: "session-password-v1",
        purpose: "SESSION_PASSWORD",
        algorithm: "ARGON2ID",
        version: 0x13,
        memoryKiB: 65536,
        iterations: 3,
        parallelism: 4,
        salt: Buffer.alloc(16, 0x51),
        verifier: Buffer.alloc(32, 0x52),
      },
    );
    assert.deepEqual(result.affectedIntegrationAccountIds, ["account-restore"]);
    assert.deepEqual(
      connection.database
        .prepare("SELECT credential_handle, state, version FROM integration_accounts WHERE integration_account_id = ?")
        .get("account-restore"),
      { credential_handle: null, state: "REAUTH_REQUIRED", version: 2 },
    );
    const storedVerifier = connection.database
      .prepare("SELECT meta_value FROM system_meta WHERE meta_key = ?")
      .get("session-password-verifier");
    assert.match(storedVerifier.meta_value, /session-password-v1/u);
    assert.doesNotMatch(storedVerifier.meta_value, /test-only-password/u);
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
