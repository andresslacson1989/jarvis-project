import { createHash } from "node:crypto";
import type Database from "better-sqlite3-multiple-ciphers";
import {
  CoreDatabaseConnection,
  CorePersistenceError,
} from "./persistence.js";

export const CURRENT_SCHEMA_VERSION = 1 as const;
const INITIAL_MIGRATION_ID = "0001-core-proof-schema" as const;

const INITIAL_MIGRATION_SQL = `
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY CHECK (version > 0),
  migration_id TEXT NOT NULL UNIQUE,
  checksum_sha256 TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE system_meta (
  meta_key TEXT PRIMARY KEY,
  meta_value TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE authoritative_records (
  record_id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  state_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  payload_json TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE UNIQUE INDEX events_aggregate_version_idx
  ON events (aggregate_type, aggregate_id, aggregate_version);
CREATE TABLE integration_accounts (
  integration_account_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  account_label TEXT,
  credential_handle TEXT,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'REAUTH_REQUIRED')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

const INITIAL_MIGRATION_CHECKSUM = createHash("sha256")
  .update(INITIAL_MIGRATION_SQL, "utf8")
  .digest("hex");

export interface MigrationResult {
  readonly currentVersion: number;
  readonly appliedMigrationIds: readonly string[];
}

export interface StateTransition {
  readonly recordId: string;
  readonly recordType: string;
  readonly state: unknown;
  readonly expectedVersion: number;
  readonly eventId: string;
  readonly eventType: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}

export interface StateTransitionResult {
  readonly recordId: string;
  readonly version: number;
  readonly eventId: string;
}

export interface PortableRestoreCredentialReconciliation {
  readonly affectedIntegrationAccountIds: readonly string[];
}

export interface SessionPasswordVerifier {
  readonly profileId: string;
  readonly purpose: "SESSION_PASSWORD";
  readonly algorithm: "ARGON2ID";
  readonly version: 0x13;
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: 4;
  readonly salt: Buffer;
  readonly verifier: Buffer;
}

export type CoreSchemaFailureCode =
  | "PERSISTENCE_SCHEMA_UNSUPPORTED"
  | "PERSISTENCE_SCHEMA_INVALID"
  | "PERSISTENCE_CONFLICT";

export class CoreSchemaError extends Error {
  readonly code: CoreSchemaFailureCode;

  constructor(code: CoreSchemaFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CoreSchemaError";
    this.code = code;
  }
}

interface MigrationRow {
  readonly version: number;
  readonly migration_id: string;
  readonly checksum_sha256: string;
}

interface RecordRow {
  readonly version: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tableExists(database: Database.Database, name: string): boolean {
  const row = database
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { present?: number } | undefined;
  return row?.present === 1;
}

function assertJsonObject(value: unknown): string {
  if (!isRecord(value)) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "authoritative state must be a JSON object");
  }
  return JSON.stringify(value);
}

function assertSessionPasswordVerifier(verifier: SessionPasswordVerifier, now: string): string {
  if (
    verifier.profileId !== "session-password-v1" ||
    verifier.purpose !== "SESSION_PASSWORD" ||
    verifier.algorithm !== "ARGON2ID" ||
    verifier.version !== 0x13 ||
    verifier.memoryKiB < 65_536 ||
    verifier.iterations < 3 ||
    verifier.parallelism !== 4 ||
    verifier.salt.length < 16 ||
    verifier.verifier.length < 32 ||
    !Number.isInteger(verifier.memoryKiB) ||
    !Number.isInteger(verifier.iterations)
  ) {
    throw new CoreSchemaError(
      "PERSISTENCE_SCHEMA_INVALID",
      "session-password verifier does not meet the approved Argon2id profile",
    );
  }
  return JSON.stringify({
    profileId: verifier.profileId,
    purpose: verifier.purpose,
    algorithm: verifier.algorithm,
    version: verifier.version,
    memoryKiB: verifier.memoryKiB,
    iterations: verifier.iterations,
    parallelism: verifier.parallelism,
    salt: verifier.salt.toString("hex"),
    verifier: verifier.verifier.toString("hex"),
    createdAt: now,
  });
}

function assertIntegrity(database: Database.Database): void {
  const integrity = database.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "SQLite integrity check failed after migration");
  }
  const foreignKeys = database.pragma("foreign_key_check");
  if (!Array.isArray(foreignKeys) || foreignKeys.length !== 0) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "SQLite foreign-key check failed after migration");
  }
}

function assertMigrationRow(row: MigrationRow | undefined): void {
  if (
    !row ||
    row.version !== 1 ||
    row.migration_id !== INITIAL_MIGRATION_ID ||
    row.checksum_sha256 !== INITIAL_MIGRATION_CHECKSUM
  ) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "recorded migration identity is not deterministic");
  }
}

export function applyCoreMigrations(
  connection: CoreDatabaseConnection,
  now: () => string = () => new Date().toISOString(),
): MigrationResult {
  const database = connection.database;
  const userVersion = database.pragma("user_version", { simple: true });
  if (typeof userVersion !== "number" || !Number.isInteger(userVersion) || userVersion < 0) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "SQLite schema version is malformed");
  }
  if (userVersion > CURRENT_SCHEMA_VERSION) {
    throw new CoreSchemaError(
      "PERSISTENCE_SCHEMA_UNSUPPORTED",
      `database schema ${userVersion} is newer than supported schema ${CURRENT_SCHEMA_VERSION}`,
    );
  }

  if (userVersion === CURRENT_SCHEMA_VERSION) {
    if (!tableExists(database, "schema_migrations")) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "schema version has no migration ledger");
    }
    const row = database
      .prepare("SELECT version, migration_id, checksum_sha256 FROM schema_migrations WHERE version = 1")
      .get() as MigrationRow | undefined;
    assertMigrationRow(row);
    assertIntegrity(database);
    return { currentVersion: CURRENT_SCHEMA_VERSION, appliedMigrationIds: [INITIAL_MIGRATION_ID] };
  }

  if (tableExists(database, "schema_migrations")) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "schema migration ledger exists at schema version zero");
  }

  const appliedAt = now();
  if (!appliedAt || Number.isNaN(Date.parse(appliedAt))) {
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "migration timestamp must be an ISO timestamp");
  }

  const apply = database.transaction(() => {
    database.exec(INITIAL_MIGRATION_SQL);
    database
      .prepare(
        "INSERT INTO schema_migrations (version, migration_id, checksum_sha256, applied_at) VALUES (?, ?, ?, ?)",
      )
      .run(CURRENT_SCHEMA_VERSION, INITIAL_MIGRATION_ID, INITIAL_MIGRATION_CHECKSUM, appliedAt);
    database.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
    assertIntegrity(database);
  });
  try {
    apply();
  } catch (error) {
    if (error instanceof CoreSchemaError) throw error;
    throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "deterministic schema migration failed", {
      cause: error,
    });
  }
  return { currentVersion: CURRENT_SCHEMA_VERSION, appliedMigrationIds: [INITIAL_MIGRATION_ID] };
}

export class CoreStateRepository {
  private readonly connection: CoreDatabaseConnection;

  constructor(connection: CoreDatabaseConnection) {
    this.connection = connection;
  }

  markPortableRestoreCredentialsReauthRequired(
    now: string,
    sessionPasswordVerifier: SessionPasswordVerifier,
  ): PortableRestoreCredentialReconciliation {
    if (!now || Number.isNaN(Date.parse(now))) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "restore reconciliation timestamp must be an ISO timestamp");
    }
    const sessionPasswordVerifierJson = assertSessionPasswordVerifier(sessionPasswordVerifier, now);
    try {
      const reconcile = this.connection.database.transaction(() => {
        const rows = this.connection.database
          .prepare(
            "SELECT integration_account_id FROM integration_accounts WHERE credential_handle IS NOT NULL OR state <> 'REAUTH_REQUIRED' ORDER BY integration_account_id",
          )
          .all() as Array<{ integration_account_id: string }>;
        this.connection.database
          .prepare(
            "UPDATE integration_accounts SET credential_handle = NULL, state = 'REAUTH_REQUIRED', version = version + 1, updated_at = ? WHERE credential_handle IS NOT NULL OR state <> 'REAUTH_REQUIRED'",
          )
          .run(now);
        this.connection.database
          .prepare(
            "INSERT INTO system_meta (meta_key, meta_value, version, created_at, updated_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT(meta_key) DO UPDATE SET meta_value = excluded.meta_value, version = system_meta.version + 1, updated_at = excluded.updated_at",
          )
          .run("session-password-verifier", sessionPasswordVerifierJson, now, now);
        return Object.freeze({
          affectedIntegrationAccountIds: Object.freeze(rows.map(({ integration_account_id }) => integration_account_id)),
        });
      });
      return reconcile();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "portable restore credential reconciliation failed", {
        cause: error,
      });
    }
  }

  transition(request: StateTransition): StateTransitionResult {
    if (!Number.isInteger(request.expectedVersion) || request.expectedVersion < 0) {
      throw new CoreSchemaError("PERSISTENCE_SCHEMA_INVALID", "expected state version must be a non-negative integer");
    }
    const stateJson = assertJsonObject(request.state);
    const apply = this.connection.database.transaction(() => {
      const existing = this.connection.database
        .prepare("SELECT version FROM authoritative_records WHERE record_id = ?")
        .get(request.recordId) as RecordRow | undefined;
      const currentVersion = existing?.version ?? 0;
      if (currentVersion !== request.expectedVersion) {
        throw new CoreSchemaError(
          "PERSISTENCE_CONFLICT",
          `record ${request.recordId} expected version ${request.expectedVersion}, found ${currentVersion}`,
        );
      }
      const nextVersion = currentVersion + 1;
      if (existing) {
        this.connection.database
          .prepare(
            "UPDATE authoritative_records SET state_json = ?, version = ?, updated_at = ? WHERE record_id = ? AND version = ?",
          )
          .run(stateJson, nextVersion, request.occurredAt, request.recordId, currentVersion);
      } else {
        this.connection.database
          .prepare(
            "INSERT INTO authoritative_records (record_id, record_type, state_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            request.recordId,
            request.recordType,
            stateJson,
            nextVersion,
            request.occurredAt,
            request.occurredAt,
          );
      }
      this.connection.database
        .prepare(
          "INSERT INTO events (event_id, event_type, aggregate_type, aggregate_id, aggregate_version, payload_json, correlation_id, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          request.eventId,
          request.eventType,
          request.recordType,
          request.recordId,
          nextVersion,
          stateJson,
          request.correlationId,
          request.occurredAt,
        );
      return { recordId: request.recordId, version: nextVersion, eventId: request.eventId };
    });
    try {
      return apply();
    } catch (error) {
      if (error instanceof CoreSchemaError || error instanceof CorePersistenceError) throw error;
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "authoritative state transition failed", {
        cause: error,
      });
    }
  }
}
