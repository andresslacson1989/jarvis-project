import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
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
    assert.deepEqual(first.appliedMigrationIds, ["0001-core-proof-schema", "0002-authoritative-state-ownership", "0003-platform-identity-and-path-state", "0004-execution-scope-uniqueness", "0005-mission-graph-immutability", "0006-authority-records", "0007-provider-integration-state", "0008-project-policy-trust", "0009-update-trust-state", "0010-domain-event-provenance", "0011-configuration-authority", "0012-memory-retention", "0013-session-security", "0014-approval-lifecycle"]);
    assert.equal(first.currentVersion, 14);
    assert.equal(existsSync(`${connection.databasePath}.pre-migration-v0-to-v14.bak`), true);
    assert.equal(existsSync(`${connection.databasePath}.migration.lock`), false);
    const second = applyCoreMigrations(connection, () => "2026-08-14T00:00:01.000Z");
    assert.deepEqual(second, first);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count, 14);
    connection.database.pragma("user_version = 99");
    assert.throws(
      () => applyCoreMigrations(connection),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_UNSUPPORTED",
    );
  });
});

test("full authoritative ownership migration is complete, monotonic, and secret-free", async () => {
  await withDatabase(async (connection) => {
    const result = applyCoreMigrations(connection, () => "2026-08-14T00:00:00.000Z");
    const expectedTables = [
      "schema_migrations", "system_meta", "settings", "feature_flags", "release_profile_state", "kdf_profiles",
      "user_profile", "trusted_sessions", "session_auth_verifiers", "conversations", "messages", "conversation_context",
      "projects", "project_aliases", "project_environments", "project_workspaces", "project_integrations",
      "task_execution_scopes", "task_integration_scope_bindings", "memories", "memory_links", "memory_revisions",
      "missions", "mission_graph_versions", "tasks", "task_dependencies", "task_attempts", "task_inputs", "task_outputs",
      "authority_envelopes", "authority_envelope_scopes", "worker_checkpoints", "worker_events", "artifacts", "artifact_links",
      "workspace_leases", "resource_leases", "permission_policies", "standing_permissions", "permission_decisions", "approval_requests",
      "approval_decisions", "precedent_records", "providers", "provider_profiles", "provider_setup_state",
      "provider_qualification_state", "provider_health_history", "modules", "module_versions", "module_catalog_entries",
      "module_catalog_keys", "integration_accounts", "integration_capabilities", "proxmox_connections", "events", "event_dedup",
      "subscriptions", "automation_rules", "automation_runs", "notifications", "provider_quota_snapshots", "usage_records",
      "pricing_snapshots", "budgets", "budget_reservations", "audit_events", "backup_history", "update_history", "recovery_actions",
      "platform_runtime_identities", "platform_compatibility_records", "platform_path_refs", "session_security_state",
    ];
    const actualTables = connection.database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map(({ name }) => name);
    for (const table of expectedTables) assert.ok(actualTables.includes(table), `missing authoritative table ${table}`);
    assert.equal(result.currentVersion, 14);
    assert.equal(connection.database.prepare("SELECT version FROM schema_migrations ORDER BY version").all().at(-1).version, 14);
    assert.ok(actualTables.includes("integration_account_state"));
    assert.ok(actualTables.includes("project_policy_trust_records"));
    assert.ok(actualTables.includes("project_policy_snapshots"));
    assert.ok(actualTables.includes("trusted_update_metadata"));
    assert.ok(actualTables.includes("trusted_release_state"));
    assert.ok(actualTables.includes("update_incidents"));
    assert.ok(actualTables.includes("update_operation_state"));
    assert.ok(actualTables.includes("domain_event_envelopes"));
    assert.ok(actualTables.includes("event_provenance"));
    assert.ok(actualTables.includes("configuration_candidates"));
    assert.ok(actualTables.includes("active_configurations"));
    assert.ok(actualTables.includes("retention_anchors"));
    assert.equal(connection.database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get("task_execution_scopes_task_idx").name, "task_execution_scopes_task_idx");

    const columns = connection.database
      .pragma("table_info(integration_accounts)")
      .map(({ name }) => name);
    assert.equal(columns.some((name) => /secret|token|password|private_key|raw_key/iu.test(name)), false);
  });
});

test("migration ledger checksum drift fails closed before applying later migrations", async () => {
  await withDatabase(async (connection) => {
    applyCoreMigrations(connection);
    connection.database.prepare("UPDATE schema_migrations SET checksum_sha256 = ? WHERE version = 2").run("tampered");
    assert.throws(
      () => applyCoreMigrations(connection),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
  });
});

test("migration lock is exclusive, reclaims only a dead owner, and preserves backup on failure", async () => {
  await withDatabase(async (connection) => {
    const lockPath = `${connection.databasePath}.migration.lock`;
    await writeFile(lockPath, JSON.stringify({ pid: process.pid }), "utf8");
    assert.throws(
      () => applyCoreMigrations(connection),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_MIGRATION_LOCKED",
    );
    await rm(lockPath, { force: true });

    await writeFile(lockPath, JSON.stringify({ pid: 99999999 }), "utf8");
    assert.throws(
      () => applyCoreMigrations(connection, () => "not-a-timestamp"),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.equal(existsSync(`${connection.databasePath}.pre-migration-v0-to-v14.bak`), true);
    assert.equal(existsSync(lockPath), false);
  });
});

test("platform identity, compatibility, and tagged path records validate before durable storage", async () => {
  await withDatabase(async (connection) => {
    applyCoreMigrations(connection, () => "2026-08-14T00:00:00.000Z");
    const repository = new CoreStateRepository(connection);
    assert.deepEqual(
      repository.putPlatformRuntimeIdentity(
        "runtime-windows-v1",
        { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", backendProfileId: "windows-v1-x64-full-host" },
        "2026-08-14T00:00:01.000Z",
      ),
      { id: "runtime-windows-v1", version: 1 },
    );
    assert.deepEqual(
      repository.putPlatformCompatibility(
        "compat-windows-v1",
        { platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] },
        "2026-08-14T00:00:01.000Z",
      ),
      { id: "compat-windows-v1", version: 1 },
    );
    assert.deepEqual(
      repository.putPlatformPathRef(
        "path-project-root",
        { platform: "WINDOWS", value: "C:\\Jarvis Project" },
        "2026-08-14T00:00:01.000Z",
      ),
      { id: "path-project-root", version: 1 },
    );
    assert.deepEqual(repository.getPlatformPathRef("path-project-root"), {
      platform: "WINDOWS",
      value: "C:\\Jarvis Project",
    });
    assert.throws(
      () => repository.putPlatformPathRef("path-project-root", { platform: "LINUX", value: "" }, "2026-08-14T00:00:02.000Z"),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.equal(connection.database.prepare("SELECT version FROM platform_path_refs WHERE path_ref_id = ?").get("path-project-root").version, 1);
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
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE subject_id = ?").get("record-1").count, 2);
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

test("state, causative event, and audit evidence roll back together on event conflict", async () => {
  await withDatabase(async (connection) => {
    applyCoreMigrations(connection, () => "2026-08-15T00:00:00.000Z");
    const repository = new CoreStateRepository(connection);
    repository.transition({
      recordId: "record-atomic",
      recordType: "PROOF",
      state: { state: "READY" },
      expectedVersion: 0,
      eventId: "atomic-event-1",
      eventType: "PROOF_READY",
      correlationId: "atomic-correlation-1",
      occurredAt: "2026-08-15T00:00:01.000Z",
    });
    assert.throws(
      () => repository.transition({
        recordId: "record-atomic",
        recordType: "PROOF",
        state: { state: "DONE" },
        expectedVersion: 1,
        eventId: "atomic-event-1",
        eventType: "PROOF_DONE",
        correlationId: "atomic-correlation-2",
        occurredAt: "2026-08-15T00:00:02.000Z",
      }),
    );
    assert.equal(connection.database.prepare("SELECT version, state_json FROM authoritative_records WHERE record_id = ?").get("record-atomic").version, 1);
    assert.deepEqual(JSON.parse(connection.database.prepare("SELECT state_json FROM authoritative_records WHERE record_id = ?").get("record-atomic").state_json), { state: "READY" });
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM events WHERE aggregate_id = ?").get("record-atomic").count, 1);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE subject_id = ?").get("record-atomic").count, 1);
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
