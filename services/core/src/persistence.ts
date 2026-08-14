import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { rename, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3-multiple-ciphers";

export const QUALIFIED_SQLITE_VERSION = "3.53.2" as const;
export const QUALIFIED_SQLITE_SOURCE_ID =
  "2026-06-03 19:12:13 d6e03d8c777cfa2d35e3b60d8ec3e0187f3e9f99d8e2ee9cac695fd6fcdf1a24" as const;
export const QUALIFIED_SQLITE_BINDING = "better-sqlite3-multiple-ciphers" as const;
export const QUALIFIED_SQLITE_BINDING_VERSION = "12.11.1" as const;
export const QUALIFIED_SQLITE_CIPHER = "sqlcipher" as const;
export const QUALIFIED_SQLITE_WAL_RESET_FIX_VERSION = "3.51.3" as const;
export const QUALIFIED_SQLCIPHER_PROFILE = "sqlcipher-legacy-v4" as const;
export const DB_DEK_BYTES = 32 as const;
export const SNAPSHOT_DB_KEY_BYTES = 32 as const;
export const SQLCIPHER_SNAPSHOT_MECHANISM = "attached-sqlcipher-schema-export-v1" as const;
export const DEFAULT_BUSY_TIMEOUT_MS = 5_000 as const;
export const MAX_BUSY_TIMEOUT_MS = 30_000 as const;

const WAL_CHECKPOINT_MODES = ["PASSIVE", "FULL", "RESTART", "TRUNCATE"] as const;

export type WalCheckpointMode = (typeof WAL_CHECKPOINT_MODES)[number];

export interface SqliteBuildIdentity {
  readonly binding: typeof QUALIFIED_SQLITE_BINDING;
  readonly bindingVersion: typeof QUALIFIED_SQLITE_BINDING_VERSION;
  readonly cipher: "sqlcipher";
  readonly cipherProfile: typeof QUALIFIED_SQLCIPHER_PROFILE;
  readonly sqliteVersion: typeof QUALIFIED_SQLITE_VERSION;
  readonly sqliteSourceId: typeof QUALIFIED_SQLITE_SOURCE_ID;
  readonly compileOptions: readonly string[];
}

export interface WalCheckpointDiagnostics {
  readonly mode: WalCheckpointMode;
  readonly busy: number;
  readonly logFrames: number;
  readonly checkpointedFrames: number;
  readonly complete: boolean;
}

export interface SqlcipherSnapshotResult {
  readonly databasePath: string;
  readonly bytes: number;
  readonly mechanism: typeof SQLCIPHER_SNAPSHOT_MECHANISM;
  readonly identity: SqliteBuildIdentity;
}

export interface CoreDatabaseOptions {
  /** Transient DB_DEK obtained from the qualified native secure-storage path. */
  readonly dbDek: Buffer;
  readonly busyTimeoutMs?: number;
}

export type CoreDatabaseFailureCode =
  | "PERSISTENCE_PATH_INVALID"
  | "PERSISTENCE_PATH_NOT_READY"
  | "PERSISTENCE_INIT_FAILED"
  | "PERSISTENCE_IDENTITY_FAILED"
  | "PERSISTENCE_KEY_REQUIRED"
  | "PERSISTENCE_KEY_INVALID"
  | "PERSISTENCE_INTEGRITY_FAILED"
  | "PERSISTENCE_SNAPSHOT_KEY_REQUIRED"
  | "PERSISTENCE_SNAPSHOT_DESTINATION_INVALID"
  | "PERSISTENCE_SNAPSHOT_DESTINATION_EXISTS"
  | "PERSISTENCE_SNAPSHOT_ACTIVE_TRANSACTION"
  | "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED"
  | "PERSISTENCE_SNAPSHOT_FAILED"
  | "PERSISTENCE_SNAPSHOT_INTEGRITY_FAILED"
  | "PERSISTENCE_RESTORE_DESTINATION_INVALID"
  | "PERSISTENCE_RESTORE_DESTINATION_EXISTS"
  | "PERSISTENCE_RESTORE_FAILED"
  | "PERSISTENCE_RESTORE_INTEGRITY_FAILED";

export class CorePersistenceError extends Error {
  readonly code: CoreDatabaseFailureCode;

  constructor(code: CoreDatabaseFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CorePersistenceError";
    this.code = code;
  }
}

interface SqliteIdentityRow {
  readonly version: string;
  readonly sourceId: string;
}

interface CheckpointRow {
  readonly busy: number;
  readonly log: number;
  readonly checkpointed: number;
}

interface SnapshotSchemaRow {
  readonly type: string;
  readonly name: string;
  readonly tbl_name: string;
  readonly sql: string | null;
}

interface SnapshotColumnRow {
  readonly name: string;
}

interface SnapshotSequenceRow {
  readonly name: string;
  readonly seq: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotDatabaseError(value: unknown): boolean {
  return (
    (isRecord(value) && value.code === "SQLITE_NOTADB") ||
    (value instanceof Error && /encrypted|not a database|file is not/iu.test(value.message))
  );
}

function readSimplePragma<T>(database: Database.Database, source: string): T {
  return database.pragma(source, { simple: true }) as T;
}

function rejectUnqualifiedPath(databasePath: string): string {
  if (databasePath.length === 0 || databasePath.includes("\0") || !isAbsolute(databasePath)) {
    throw new CorePersistenceError(
      "PERSISTENCE_PATH_INVALID",
      "the authoritative database path must be an absolute local path",
    );
  }

  // UNC, DOS device, and extended-length paths are not accepted as the live
  // authoritative store. A mapped drive is still qualified by its resolved
  // local policy in the owning application; this factory never silently turns
  // a remote-looking path into an accepted database location.
  if (/^(?:[\\/]{2}|\\\\[?.])/u.test(databasePath)) {
    throw new CorePersistenceError(
      "PERSISTENCE_PATH_INVALID",
      "network and device database paths are not qualified for authoritative state",
    );
  }

  const canonicalPath = resolve(databasePath);
  if (!existsSync(dirname(canonicalPath))) {
    throw new CorePersistenceError(
      "PERSISTENCE_PATH_NOT_READY",
      "the authoritative database parent directory must already exist",
    );
  }
  return canonicalPath;
}

function validateBusyTimeout(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_BUSY_TIMEOUT_MS) {
    throw new CorePersistenceError(
      "PERSISTENCE_INIT_FAILED",
      `busy timeout must be an integer from 1 to ${MAX_BUSY_TIMEOUT_MS} milliseconds`,
    );
  }
  return value;
}

function validateDbDek(value: unknown): Buffer {
  if (!Buffer.isBuffer(value) || value.length !== DB_DEK_BYTES) {
    throw new CorePersistenceError(
      "PERSISTENCE_KEY_REQUIRED",
      `the authoritative database requires a ${DB_DEK_BYTES}-byte transient DB_DEK`,
    );
  }
  return value;
}

function validateSnapshotDbKey(value: unknown): Buffer {
  if (!Buffer.isBuffer(value) || value.length !== SNAPSHOT_DB_KEY_BYTES) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_KEY_REQUIRED",
      `the SQLCipher snapshot requires a fresh ${SNAPSHOT_DB_KEY_BYTES}-byte SnapshotDBKey`,
    );
  }
  return value;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function firstTopLevelParenthesis(sql: string): number {
  let quote: string | undefined;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      if (character === quote) {
        if (sql[index + 1] === quote) {
          index += 1;
        } else {
          quote = undefined;
        }
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[") {
      quote = "]";
      continue;
    }
    if (character === "(") return index;
  }
  return -1;
}

function snapshotTableSql(row: SnapshotSchemaRow, targetSchema: string): string {
  if (/^\s*CREATE\s+VIRTUAL\s+TABLE\b/iu.test(row.sql ?? "")) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
      "SQLCipher snapshot export does not support virtual tables in the authoritative schema",
    );
  }
  const sql = row.sql;
  const parenthesis = sql ? firstTopLevelParenthesis(sql) : -1;
  if (!sql || !/^\s*CREATE\s+TABLE\b/iu.test(sql) || parenthesis < 0) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
      "SQLCipher snapshot export encountered an unsupported table definition",
    );
  }
  return `CREATE TABLE ${quoteIdentifier(targetSchema)}.${quoteIdentifier(row.name)} ${sql.slice(parenthesis)}`;
}

function snapshotIndexSql(row: SnapshotSchemaRow, targetSchema: string): string {
  const sql = row.sql;
  const parenthesis = sql ? firstTopLevelParenthesis(sql) : -1;
  if (!sql || !/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/iu.test(sql) || parenthesis < 0) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
      "SQLCipher snapshot export encountered an unsupported index definition",
    );
  }
  const unique = /^\s*CREATE\s+UNIQUE\s+INDEX\b/iu.test(sql) ? " UNIQUE" : "";
  return `CREATE${unique} INDEX ${quoteIdentifier(targetSchema)}.${quoteIdentifier(row.name)} ON ${quoteIdentifier(row.tbl_name)} ${sql.slice(parenthesis)}`;
}

function snapshotViewSql(row: SnapshotSchemaRow, targetSchema: string): string {
  const sql = row.sql;
  const asMatch = sql?.match(/\bAS\b/iu);
  if (!sql || !/^\s*CREATE\s+VIEW\b/iu.test(sql) || !asMatch || asMatch.index === undefined) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
      "SQLCipher snapshot export encountered an unsupported view definition",
    );
  }
  return `CREATE VIEW ${quoteIdentifier(targetSchema)}.${quoteIdentifier(row.name)} ${sql.slice(asMatch.index)}`;
}

function snapshotTriggerSql(row: SnapshotSchemaRow, targetSchema: string): string {
  const sql = row.sql;
  if (!sql || /^\s*CREATE\s+TEMP\s+TRIGGER\b/iu.test(sql)) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
      "SQLCipher snapshot export does not support temporary trigger definitions",
    );
  }
  const renamed = sql.replace(
    /^(\s*CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?)(?:"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[(?:[^\]])*\]|\S+)/iu,
    `$1${quoteIdentifier(targetSchema)}.${quoteIdentifier(row.name)}`,
  );
  const qualifiedTable = renamed.replace(
    /(\s+ON\s+)(?:"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[(?:[^\]])*\]|\S+)/iu,
    `$1${quoteIdentifier(row.tbl_name)}`,
  );
  if (qualifiedTable === sql) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
      "SQLCipher snapshot export could not safely qualify a trigger definition",
    );
  }
  return qualifiedTable;
}

function snapshotSchemaRows(database: Database.Database, sourceSchema: string): SnapshotSchemaRow[] {
  const rows = database
    .prepare(
      `SELECT type, name, tbl_name, sql
         FROM ${quoteIdentifier(sourceSchema)}.sqlite_schema
        WHERE sql IS NOT NULL
          AND name NOT LIKE 'sqlite_%'
        ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, name`,
    )
    .all() as unknown[];
  return rows.map((value) => {
    if (!isRecord(value) || typeof value.type !== "string" || typeof value.name !== "string" ||
      typeof value.tbl_name !== "string" || (value.sql !== null && typeof value.sql !== "string")) {
      throw new CorePersistenceError(
        "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
        "SQLite returned malformed authoritative schema metadata",
      );
    }
    const row = {
      type: value.type,
      name: value.name,
      tbl_name: value.tbl_name,
      sql: value.sql,
    } satisfies SnapshotSchemaRow;
    if (row.type !== "table" && row.type !== "index" && row.type !== "view" && row.type !== "trigger") {
      throw new CorePersistenceError(
        "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
        "SQLCipher snapshot export encountered an unsupported schema object",
      );
    }
    return row;
  });
}

function copySnapshotContents(database: Database.Database, sourceSchema = "main", targetSchema = "snapshot"): void {
  const rows = snapshotSchemaRows(database, sourceSchema);
  const tables = rows.filter(({ type }) => type === "table");
  for (const table of tables) database.exec(snapshotTableSql(table, targetSchema));

  const userVersion = readSimplePragma<unknown>(database, `${quoteIdentifier(sourceSchema)}.user_version`);
  if (typeof userVersion !== "number" || !Number.isInteger(userVersion) || userVersion < 0) {
    throw new CorePersistenceError("PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED", "SQLite returned a malformed schema version");
  }
  database.pragma(`${quoteIdentifier(targetSchema)}.user_version = ${userVersion}`);

  for (const table of tables) {
    const columns = database
      .prepare(`SELECT name FROM ${quoteIdentifier(sourceSchema)}.pragma_table_info(?) ORDER BY cid`)
      .all(table.name) as SnapshotColumnRow[];
    if (columns.length === 0) {
      throw new CorePersistenceError(
        "PERSISTENCE_SNAPSHOT_SCHEMA_UNSUPPORTED",
        "SQLCipher snapshot export encountered a table without copyable columns",
      );
    }
    const quotedColumns = columns.map(({ name }) => quoteIdentifier(name)).join(", ");
    database.exec(
      `INSERT INTO ${quoteIdentifier(targetSchema)}.${quoteIdentifier(table.name)} (${quotedColumns})
       SELECT ${quotedColumns} FROM ${quoteIdentifier(sourceSchema)}.${quoteIdentifier(table.name)}`,
    );
  }

  const sequenceExists = database
    .prepare(
      `SELECT 1 AS present FROM ${quoteIdentifier(sourceSchema)}.sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`,
    )
    .get() as { present?: number } | undefined;
  if (sequenceExists?.present === 1) {
    const sequences = database.prepare(`SELECT name, seq FROM ${quoteIdentifier(sourceSchema)}.sqlite_sequence`).all() as SnapshotSequenceRow[];
    const insertSequence = database.prepare(
      `INSERT OR REPLACE INTO ${quoteIdentifier(targetSchema)}.sqlite_sequence (name, seq) VALUES (?, ?)`,
    );
    for (const sequence of sequences) insertSequence.run(sequence.name, sequence.seq);
  }

  for (const row of rows.filter(({ type }) => type === "index")) database.exec(snapshotIndexSql(row, targetSchema));
  for (const row of rows.filter(({ type }) => type === "view")) database.exec(snapshotViewSql(row, targetSchema));
  for (const row of rows.filter(({ type }) => type === "trigger")) database.exec(snapshotTriggerSql(row, targetSchema));
}

function assertAttachedSnapshotIntegrity(database: Database.Database, schema = "snapshot"): void {
  const integrity = readSimplePragma<unknown>(database, `${quoteIdentifier(schema)}.integrity_check`);
  const foreignKeys = database.pragma(`${quoteIdentifier(schema)}.foreign_key_check`);
  if (integrity !== "ok" || !Array.isArray(foreignKeys) || foreignKeys.length !== 0) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_INTEGRITY_FAILED",
      "the exported SQLCipher snapshot failed integrity or foreign-key verification",
    );
  }
}

function configureCipher(database: Database.Database, dbDek: Buffer): void {
  const transientKey = Buffer.from(dbDek);
  try {
    database.pragma("cipher = 'sqlcipher'");
    database.pragma("legacy = 4");
    const result = database.key(transientKey);
    if (result !== 0) {
      throw new CorePersistenceError(
        "PERSISTENCE_KEY_INVALID",
        "the database encryption key was rejected by the qualified cipher",
      );
    }
  } catch (error) {
    if (error instanceof CorePersistenceError) throw error;
    throw new CorePersistenceError(
      "PERSISTENCE_KEY_INVALID",
      "the database encryption key could not be applied",
      { cause: error },
    );
  } finally {
    transientKey.fill(0);
  }
}

function verifyCipherConfiguration(database: Database.Database): void {
  const cipher = readSimplePragma<unknown>(database, "cipher");
  const legacy = readSimplePragma<unknown>(database, "legacy");
  if (cipher !== "sqlcipher" || legacy !== "4") {
    throw new CorePersistenceError(
      "PERSISTENCE_IDENTITY_FAILED",
      "the database is not using the release-qualified SQLCipher profile",
    );
  }
}

function assertDatabaseIntegrity(database: Database.Database): void {
  try {
    const result = readSimplePragma<unknown>(database, "integrity_check");
    if (result !== "ok") {
      throw new CorePersistenceError(
        "PERSISTENCE_INTEGRITY_FAILED",
        "SQLite integrity_check did not return ok",
      );
    }
    const foreignKeys = database.pragma("foreign_key_check");
    if (!Array.isArray(foreignKeys) || foreignKeys.length !== 0) {
      throw new CorePersistenceError(
        "PERSISTENCE_INTEGRITY_FAILED",
        "SQLite foreign_key_check did not return an empty result",
      );
    }
  } catch (error) {
    if (error instanceof CorePersistenceError) throw error;
    const detail = error instanceof Error ? error.message : "unknown integrity failure";
    if (/encrypted|not a database|file is not/iu.test(detail)) {
      throw new CorePersistenceError(
        "PERSISTENCE_KEY_INVALID",
        "the database could not be opened with the supplied DB_DEK",
        { cause: error },
      );
    }
    throw new CorePersistenceError(
      "PERSISTENCE_INTEGRITY_FAILED",
      "SQLite integrity_check failed; recovery is required",
      { cause: error },
    );
  }
}

function readBuildIdentity(database: Database.Database): SqliteBuildIdentity {
  const row = database
    .prepare("SELECT sqlite_version() AS version, sqlite_source_id() AS sourceId")
    .get() as SqliteIdentityRow | undefined;
  const compileRows = database.pragma("compile_options") as unknown;
  const compileOptions = (Array.isArray(compileRows) ? compileRows : [])
    .map((value: unknown) => (isRecord(value) ? value.compile_options : undefined))
    .filter((value): value is string => typeof value === "string")
    .sort();
  if (
    !row ||
    row.version !== QUALIFIED_SQLITE_VERSION ||
    row.sourceId !== QUALIFIED_SQLITE_SOURCE_ID ||
    !compileOptions.includes("THREADSAFE=2")
  ) {
    throw new CorePersistenceError(
      "PERSISTENCE_IDENTITY_FAILED",
      "embedded SQLite identity is not the release-qualified Windows x64 build",
    );
  }
  return {
    binding: QUALIFIED_SQLITE_BINDING,
    bindingVersion: QUALIFIED_SQLITE_BINDING_VERSION,
    cipher: "sqlcipher",
    cipherProfile: QUALIFIED_SQLCIPHER_PROFILE,
    sqliteVersion: QUALIFIED_SQLITE_VERSION,
    sqliteSourceId: QUALIFIED_SQLITE_SOURCE_ID,
    compileOptions,
  };
}

function readCheckpoint(
  database: Database.Database,
  mode: WalCheckpointMode,
): WalCheckpointDiagnostics {
  const result = database.pragma(`wal_checkpoint(${mode})`);
  const row = Array.isArray(result) && isRecord(result[0]) ? result[0] : undefined;
  const busy = row?.busy;
  const logFrames = row?.log;
  const checkpointedFrames = row?.checkpointed;
  if (
    typeof busy !== "number" ||
    typeof logFrames !== "number" ||
    typeof checkpointedFrames !== "number" ||
    !Number.isInteger(busy) ||
    !Number.isInteger(logFrames) ||
    !Number.isInteger(checkpointedFrames) ||
    busy < 0 ||
    logFrames < 0 ||
    checkpointedFrames < 0
  ) {
    throw new CorePersistenceError(
      "PERSISTENCE_INIT_FAILED",
      "SQLite returned malformed WAL checkpoint diagnostics",
    );
  }
  return {
    mode,
    busy,
    logFrames,
    checkpointedFrames,
    complete: busy === 0 && checkpointedFrames >= logFrames,
  };
}

export class CoreDatabaseConnection {
  readonly databasePath: string;
  readonly busyTimeoutMs: number;
  readonly identity: SqliteBuildIdentity;
  readonly database: Database.Database;

  constructor(databasePath: string, options?: CoreDatabaseOptions) {
    this.databasePath = rejectUnqualifiedPath(databasePath);
    this.busyTimeoutMs = validateBusyTimeout(options?.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS);
    const dbDek = validateDbDek(options?.dbDek);

    let database: Database.Database | undefined;
    try {
      database = new Database(this.databasePath, { timeout: this.busyTimeoutMs });
      configureCipher(database, dbDek);
      database.pragma("journal_mode = WAL");
      database.pragma("synchronous = FULL");
      database.pragma("foreign_keys = ON");
      database.pragma(`busy_timeout = ${this.busyTimeoutMs}`);

      const journalMode = readSimplePragma<string>(database, "journal_mode").toLowerCase();
      const synchronous = readSimplePragma<number>(database, "synchronous");
      const foreignKeys = readSimplePragma<number>(database, "foreign_keys");
      const busyTimeout = readSimplePragma<number>(database, "busy_timeout");
      if (journalMode !== "wal" || synchronous !== 2 || foreignKeys !== 1 || busyTimeout !== this.busyTimeoutMs) {
        throw new CorePersistenceError(
          "PERSISTENCE_INIT_FAILED",
          "SQLite connection initialization did not establish the required WAL/FULL/FK/busy policy",
        );
      }
      verifyCipherConfiguration(database);
      this.identity = readBuildIdentity(database);
      assertDatabaseIntegrity(database);
      this.database = database;
    } catch (error) {
      database?.close();
      if (error instanceof CorePersistenceError) throw error;
      if (isNotDatabaseError(error)) {
        throw new CorePersistenceError(
          "PERSISTENCE_KEY_INVALID",
          "the database could not be opened with the supplied DB_DEK",
          { cause: error },
        );
      }
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "SQLite connection initialization failed", {
        cause: error,
      });
    }
  }

  checkpoint(mode: WalCheckpointMode = "PASSIVE"): WalCheckpointDiagnostics {
    if (!WAL_CHECKPOINT_MODES.includes(mode)) {
      throw new CorePersistenceError("PERSISTENCE_INIT_FAILED", "unsupported WAL checkpoint mode");
    }
    return readCheckpoint(this.database, mode);
  }

  verifyIntegrity(): void {
    assertDatabaseIntegrity(this.database);
  }

  async exportSnapshot(
    destinationPath: string,
    snapshotDbKey: Buffer,
  ): Promise<SqlcipherSnapshotResult> {
    return exportSqlcipherSnapshot(this, destinationPath, snapshotDbKey);
  }

  close(): void {
    if (this.database.open) this.database.close();
  }
}

export class SqlcipherSnapshotConnection {
  readonly databasePath: string;
  readonly identity: SqliteBuildIdentity;
  readonly database: Database.Database;

  constructor(databasePath: string, snapshotDbKey: Buffer, readonly = true) {
    const canonicalPath = rejectUnqualifiedPath(databasePath);
    if (!existsSync(canonicalPath)) {
      throw new CorePersistenceError(
        "PERSISTENCE_SNAPSHOT_FAILED",
        "the SQLCipher snapshot file does not exist",
      );
    }
    const key = validateSnapshotDbKey(snapshotDbKey);
    let database: Database.Database | undefined;
    try {
      database = new Database(canonicalPath, { readonly, timeout: DEFAULT_BUSY_TIMEOUT_MS });
      configureCipher(database, key);
      const journalMode = readSimplePragma<string>(database, "journal_mode").toLowerCase();
      if (journalMode !== "delete") {
        throw new CorePersistenceError(
          "PERSISTENCE_SNAPSHOT_FAILED",
          "the SQLCipher snapshot is not using the qualified non-WAL snapshot journal mode",
        );
      }
      verifyCipherConfiguration(database);
      const identity = readBuildIdentity(database);
      assertDatabaseIntegrity(database);
      this.databasePath = canonicalPath;
      this.identity = identity;
      this.database = database;
    } catch (error) {
      database?.close();
      if (error instanceof CorePersistenceError) throw error;
      if (isNotDatabaseError(error)) {
        throw new CorePersistenceError(
          "PERSISTENCE_KEY_INVALID",
          "the SQLCipher snapshot could not be opened with the supplied SnapshotDBKey",
          { cause: error },
        );
      }
      throw new CorePersistenceError("PERSISTENCE_SNAPSHOT_FAILED", "SQLCipher snapshot open failed", {
        cause: error,
      });
    }
  }

  verifyIntegrity(): void {
    assertDatabaseIntegrity(this.database);
  }

  close(): void {
    if (this.database.open) this.database.close();
  }
}

export function createSnapshotDbKey(): Buffer {
  return randomBytes(SNAPSHOT_DB_KEY_BYTES);
}

export function openSqlcipherSnapshot(
  databasePath: string,
  snapshotDbKey: Buffer,
): SqlcipherSnapshotConnection {
  return new SqlcipherSnapshotConnection(databasePath, snapshotDbKey);
}

export async function exportSqlcipherSnapshot(
  connection: CoreDatabaseConnection,
  destinationPath: string,
  snapshotDbKey: Buffer,
): Promise<SqlcipherSnapshotResult> {
  const canonicalDestination = rejectUnqualifiedPath(destinationPath);
  if (canonicalDestination === connection.databasePath) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_DESTINATION_INVALID",
      "the SQLCipher snapshot destination must differ from the live database",
    );
  }
  if (existsSync(canonicalDestination)) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_DESTINATION_EXISTS",
      "refusing to overwrite an existing SQLCipher snapshot",
    );
  }
  if (!connection.database.open) {
    throw new CorePersistenceError("PERSISTENCE_SNAPSHOT_FAILED", "the live database connection is closed");
  }
  if (connection.database.inTransaction) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_ACTIVE_TRANSACTION",
      "SQLCipher snapshot export requires an idle live database connection",
    );
  }

  const key = validateSnapshotDbKey(snapshotDbKey);
  const temporaryPath = `${canonicalDestination}.partial-${randomUUID()}`;
  if (existsSync(temporaryPath)) {
    throw new CorePersistenceError(
      "PERSISTENCE_SNAPSHOT_DESTINATION_INVALID",
      "the generated SQLCipher snapshot staging path already exists",
    );
  }

  let attached = false;
  let transactionStarted = false;
  let published = false;
  let verification: SqlcipherSnapshotConnection | undefined;
  try {
    const transientKey = Buffer.from(key);
    try {
      connection.database.prepare("ATTACH DATABASE ? AS snapshot KEY ?").run(temporaryPath, transientKey);
    } finally {
      transientKey.fill(0);
    }
    attached = true;
    connection.database.pragma("snapshot.journal_mode = DELETE");
    connection.database.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    connection.database.pragma("defer_foreign_keys = ON");
    copySnapshotContents(connection.database);
    assertAttachedSnapshotIntegrity(connection.database);
    connection.database.exec("COMMIT");
    transactionStarted = false;
    connection.database.exec("DETACH DATABASE snapshot");
    attached = false;

    verification = new SqlcipherSnapshotConnection(temporaryPath, key);
    const identity = verification.identity;
    verification.close();
    verification = undefined;
    await rename(temporaryPath, canonicalDestination);
    published = true;
    const information = await stat(canonicalDestination);
    return {
      databasePath: canonicalDestination,
      bytes: information.size,
      mechanism: SQLCIPHER_SNAPSHOT_MECHANISM,
      identity,
    };
  } catch (error) {
    if (error instanceof CorePersistenceError) throw error;
    throw new CorePersistenceError("PERSISTENCE_SNAPSHOT_FAILED", "SQLCipher snapshot export failed", {
      cause: error,
    });
  } finally {
    verification?.close();
    if (transactionStarted && connection.database.open) {
      try {
        connection.database.exec("ROLLBACK");
      } catch {
        // Preserve the original snapshot failure; the connection remains owned by Core.
      }
    }
    if (attached && connection.database.open) {
      try {
        connection.database.exec("DETACH DATABASE snapshot");
      } catch {
        // A failed detach is reflected by the owning connection's subsequent health check.
      }
    }
    if (!published) {
      await Promise.all([
        rm(temporaryPath, { force: true }),
        rm(`${temporaryPath}-wal`, { force: true }),
        rm(`${temporaryPath}-shm`, { force: true }),
      ]);
    }
  }
}

export async function restoreSqlcipherSnapshot(
  snapshotPath: string,
  snapshotDbKey: Buffer,
  destinationPath: string,
  newDbDek: Buffer,
): Promise<SqlcipherSnapshotResult> {
  const canonicalSnapshot = rejectUnqualifiedPath(snapshotPath);
  const canonicalDestination = rejectUnqualifiedPath(destinationPath);
  if (canonicalSnapshot === canonicalDestination) {
    throw new CorePersistenceError(
      "PERSISTENCE_RESTORE_DESTINATION_INVALID",
      "the restored database destination must differ from the authenticated snapshot",
    );
  }
  if (existsSync(canonicalDestination)) {
    throw new CorePersistenceError(
      "PERSISTENCE_RESTORE_DESTINATION_EXISTS",
      "refusing to overwrite an existing authoritative database during restore",
    );
  }
  const key = validateSnapshotDbKey(snapshotDbKey);
  const dbDek = validateDbDek(newDbDek);
  const temporaryPath = `${canonicalDestination}.partial-${randomUUID()}`;
  let source: SqlcipherSnapshotConnection | undefined;
  let attached = false;
  let transactionStarted = false;
  let published = false;
  let verification: SqlcipherSnapshotConnection | undefined;
  try {
    source = new SqlcipherSnapshotConnection(canonicalSnapshot, key, false);
    const transientKey = Buffer.from(dbDek);
    try {
      source.database.prepare("ATTACH DATABASE ? AS restored KEY ?").run(temporaryPath, transientKey);
    } finally {
      transientKey.fill(0);
    }
    attached = true;
    source.database.pragma("restored.journal_mode = DELETE");
    source.database.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    source.database.pragma("defer_foreign_keys = ON");
    copySnapshotContents(source.database, "main", "restored");
    assertAttachedSnapshotIntegrity(source.database, "restored");
    source.database.exec("COMMIT");
    transactionStarted = false;
    source.database.exec("DETACH DATABASE restored");
    attached = false;

    verification = new SqlcipherSnapshotConnection(temporaryPath, dbDek);
    const identity = verification.identity;
    verification.verifyIntegrity();
    verification.close();
    verification = undefined;
    await rename(temporaryPath, canonicalDestination);
    published = true;
    const information = await stat(canonicalDestination);
    return {
      databasePath: canonicalDestination,
      bytes: information.size,
      mechanism: SQLCIPHER_SNAPSHOT_MECHANISM,
      identity,
    };
  } catch (error) {
    if (error instanceof CorePersistenceError) throw error;
    throw new CorePersistenceError("PERSISTENCE_RESTORE_FAILED", "SQLCipher clean-profile restore failed", {
      cause: error,
    });
  } finally {
    verification?.close();
    if (transactionStarted && source?.database.open) {
      try {
        source.database.exec("ROLLBACK");
      } catch {
        // Preserve the original restore failure; the staged destination is discarded below.
      }
    }
    if (attached && source?.database.open) {
      try {
        source.database.exec("DETACH DATABASE restored");
      } catch {
        // The source is closed immediately below and the staged destination is discarded.
      }
    }
    source?.close();
    if (!published) {
      await Promise.all([
        rm(temporaryPath, { force: true }),
        rm(`${temporaryPath}-wal`, { force: true }),
        rm(`${temporaryPath}-shm`, { force: true }),
      ]);
    }
  }
}

export function openCoreDatabase(
  databasePath: string,
  options?: CoreDatabaseOptions,
): CoreDatabaseConnection {
  return new CoreDatabaseConnection(databasePath, options);
}

export function isSqliteBusyError(error: unknown): boolean {
  return isRecord(error) && error.code === "SQLITE_BUSY";
}
