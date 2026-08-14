import { strict as assert } from "node:assert";
import { mkdir, readdir, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";
import {
  CorePersistenceError,
  createSnapshotDbKey,
  exportSqlcipherSnapshot,
  openCoreDatabase,
  openSqlcipherSnapshot,
  restoreSqlcipherSnapshot,
  isSqliteBusyError,
  QUALIFIED_SQLITE_SOURCE_ID,
  QUALIFIED_SQLITE_VERSION,
  SQLCIPHER_SNAPSHOT_MECHANISM,
} from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);

test("owned Core database factory enforces local WAL/FULL/FK identity and reports checkpoints", async () => {
  const root = join(tmpdir(), `jarvis-persistence-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  const connection = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK, busyTimeoutMs: 250 });
  try {
    assert.equal(connection.databasePath, databasePath);
    assert.equal(connection.busyTimeoutMs, 250);
    assert.equal(connection.identity.sqliteVersion, QUALIFIED_SQLITE_VERSION);
    assert.equal(connection.identity.sqliteSourceId, QUALIFIED_SQLITE_SOURCE_ID);
    assert.equal(connection.identity.binding, "better-sqlite3-multiple-ciphers");
    assert.equal(connection.identity.bindingVersion, "12.11.1");
    assert.equal(connection.identity.cipher, "sqlcipher");
    assert.equal(connection.identity.cipherProfile, "sqlcipher-legacy-v4");
    assert.equal(connection.identity.compileOptions.includes("THREADSAFE=2"), true);
    assert.equal(connection.database.pragma("journal_mode", { simple: true }), "wal");
    assert.equal(connection.database.pragma("synchronous", { simple: true }), 2);
    assert.equal(connection.database.pragma("foreign_keys", { simple: true }), 1);
    assert.equal(connection.database.pragma("busy_timeout", { simple: true }), 250);

    connection.database.exec(
      "CREATE TABLE parent (id INTEGER PRIMARY KEY); CREATE TABLE child (parent_id INTEGER REFERENCES parent(id));",
    );
    assert.throws(() => connection.database.prepare("INSERT INTO child (parent_id) VALUES (?)").run(99));
    connection.database.prepare("INSERT INTO parent (id) VALUES (?)").run(1);
    connection.database.prepare("INSERT INTO child (parent_id) VALUES (?)").run(1);

    const checkpoint = connection.checkpoint();
    assert.equal(checkpoint.mode, "PASSIVE");
    assert.equal(Number.isInteger(checkpoint.busy), true);
    assert.equal(Number.isInteger(checkpoint.logFrames), true);
    assert.equal(Number.isInteger(checkpoint.checkpointedFrames), true);
    assert.equal(checkpoint.checkpointedFrames <= checkpoint.logFrames, true);
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("owned Core database factory bounds writer contention and preserves state after reopen", async () => {
  const root = join(tmpdir(), `jarvis-persistence-busy-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  const owner = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK, busyTimeoutMs: 100 });
  const contender = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK, busyTimeoutMs: 100 });
  try {
    owner.database.exec("CREATE TABLE values_table (value TEXT NOT NULL);");
    owner.database.exec("BEGIN IMMEDIATE");
    const started = performance.now();
    assert.throws(
      () => contender.database.prepare("INSERT INTO values_table (value) VALUES (?)").run("blocked"),
      (error) => isSqliteBusyError(error),
    );
    const elapsed = performance.now() - started;
    assert.equal(elapsed < 1_000, true);
    owner.database.exec("ROLLBACK");
    owner.database.prepare("INSERT INTO values_table (value) VALUES (?)").run("durable");
  } finally {
    contender.close();
    owner.close();
  }

  const reopened = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK, busyTimeoutMs: 100 });
  try {
    assert.equal(reopened.database.prepare("SELECT value FROM values_table").get().value, "durable");
  } finally {
    reopened.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("owned Core database factory rejects relative, network, device, and unready paths", async () => {
  for (const databasePath of [
    "state.db",
    "\\\\server\\share\\state.db",
    "\\\\.\\pipe\\jarvis-state",
    "\\\\?\\C:\\state.db",
  ]) {
    assert.throws(
      () => openCoreDatabase(databasePath),
      (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_PATH_INVALID",
    );
  }

  const missingParent = join(tmpdir(), `jarvis-missing-${process.pid}-${Date.now()}`, "state.db");
  assert.throws(
    () => openCoreDatabase(missingParent, { dbDek: TEST_DB_DEK }),
    (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_PATH_NOT_READY",
  );
});

test("encrypted database requires the DB_DEK and rejects the wrong key", async () => {
  const root = join(tmpdir(), `jarvis-persistence-key-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  const connection = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK });
  try {
    connection.database.exec("CREATE TABLE secret_proof (value TEXT NOT NULL); INSERT INTO secret_proof VALUES ('durable');");
  } finally {
    connection.close();
  }
  assert.notEqual(readFileSync(databasePath).subarray(0, 15).toString("ascii"), "SQLite format 3");

  assert.throws(
    () => openCoreDatabase(databasePath, { dbDek: Buffer.alloc(32, 0x43) }),
    (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_KEY_INVALID",
  );
  await rm(root, { recursive: true, force: true });
});

test("database factory requires a 256-bit transient DB_DEK", async () => {
  const root = join(tmpdir(), `jarvis-persistence-required-key-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  assert.throws(
    () => openCoreDatabase(databasePath),
    (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_KEY_REQUIRED",
  );
  assert.throws(
    () => openCoreDatabase(databasePath, { dbDek: Buffer.alloc(31) }),
    (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_KEY_REQUIRED",
  );
  await rm(root, { recursive: true, force: true });
});

test("encrypted WAL survives an ungraceful process stop and reopens with durable state", async () => {
  const root = join(tmpdir(), `jarvis-persistence-crash-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  const childScript = `
    const Database = require("better-sqlite3-multiple-ciphers");
    const database = new Database(process.env.JARVIS_TEST_DB_PATH, { timeout: 5000 });
    database.pragma("cipher = 'sqlcipher'");
    database.pragma("legacy = 4");
    database.key(Buffer.alloc(32, 0x42));
    database.pragma("journal_mode = WAL");
    database.pragma("wal_autocheckpoint = 0");
    database.exec("CREATE TABLE IF NOT EXISTS crash_proof (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
    const insert = database.prepare("INSERT INTO crash_proof (value) VALUES (?)");
    database.transaction(() => {
      for (let index = 0; index < 200; index += 1) insert.run("durable-" + index);
    })();
    process.stdout.write("READY");
    setInterval(() => {}, 1000);
  `;
  const child = spawn(process.execPath, ["-e", childScript], {
    cwd: resolve("services/core"),
    env: { ...process.env, JARVIS_TEST_DB_PATH: databasePath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  await new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectReady(new Error("crash fixture did not reach its WAL write point"));
    }, 10_000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes("READY")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      rejectReady(error);
    });
    child.once("exit", (code) => {
      if (code !== null && !output.includes("READY")) {
        clearTimeout(timer);
        rejectReady(new Error(`crash fixture exited before readiness: ${code}`));
      }
    });
  });
  const childExit = new Promise((resolveExit) => child.once("exit", resolveExit));
  assert.equal(child.kill("SIGKILL"), true);
  await childExit;
  assert.equal(existsSync(`${databasePath}-wal`), true);

  const reopened = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK });
  try {
    assert.equal(reopened.database.prepare("SELECT COUNT(*) AS count FROM crash_proof").get().count, 200);
    reopened.verifyIntegrity();
  } finally {
    reopened.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("integrity failure is typed and leaves the damaged database for recovery", async () => {
  const root = join(tmpdir(), `jarvis-persistence-integrity-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  const connection = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK });
  try {
    connection.database.exec(
      "CREATE TABLE integrity_parent (id INTEGER PRIMARY KEY); CREATE TABLE integrity_child (parent_id INTEGER REFERENCES integrity_parent(id));",
    );
    connection.database.pragma("foreign_keys = OFF");
    connection.database.prepare("INSERT INTO integrity_child (parent_id) VALUES (?)").run(999_999);
    connection.database.pragma("foreign_keys = ON");
    assert.throws(
      () => connection.verifyIntegrity(),
      (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_INTEGRITY_FAILED",
    );
  } finally {
    connection.close();
    assert.equal(existsSync(databasePath), true);
    await rm(root, { recursive: true, force: true });
  }
});

test("SQLCipher snapshot export is transactionally consistent, independently keyed, and fail-closed", async () => {
  const root = join(tmpdir(), `jarvis-persistence-snapshot-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  const snapshotPath = join(root, "snapshot.db");
  const restoredPath = join(root, "restored.db");
  const snapshotKey = Buffer.alloc(32, 0x55);
  const restoredDbDek = Buffer.alloc(32, 0x66);
  const connection = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK });
  try {
    connection.database.exec(`
      CREATE TABLE snapshot_parent (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL);
      CREATE TABLE snapshot_child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES snapshot_parent(id), value TEXT NOT NULL);
      CREATE UNIQUE INDEX snapshot_child_value_idx ON snapshot_child (value);
      CREATE VIEW snapshot_child_view AS SELECT value FROM snapshot_child;
    `);
    connection.database.prepare("INSERT INTO snapshot_parent (label) VALUES (?)").run("parent");
    connection.database.prepare("INSERT INTO snapshot_child (id, parent_id, value) VALUES (?, ?, ?)").run(1, 1, "durable");
    connection.database.exec(`
      CREATE TRIGGER snapshot_child_after_insert AFTER INSERT ON snapshot_child
      BEGIN
        UPDATE snapshot_parent SET label = label || '-trigger' WHERE id = NEW.parent_id;
      END;
    `);

    const result = await exportSqlcipherSnapshot(connection, snapshotPath, snapshotKey);
    assert.equal(result.databasePath, snapshotPath);
    assert.equal(result.mechanism, SQLCIPHER_SNAPSHOT_MECHANISM);
    assert.equal(result.bytes > 0, true);
    assert.notEqual(readFileSync(snapshotPath).subarray(0, 15).toString("ascii"), "SQLite format 3");
    assert.equal(connection.database.pragma("journal_mode", { simple: true }), "wal");

    const snapshot = openSqlcipherSnapshot(snapshotPath, snapshotKey);
    try {
      assert.equal(snapshot.database.pragma("journal_mode", { simple: true }), "delete");
      assert.equal(snapshot.database.prepare("SELECT label FROM snapshot_parent").get().label, "parent");
      assert.equal(snapshot.database.prepare("SELECT value FROM snapshot_child_view").get().value, "durable");
      assert.equal(snapshot.database.prepare("SELECT seq FROM sqlite_sequence WHERE name = ?").get("snapshot_parent").seq, 1);
      assert.equal(snapshot.database.prepare("SELECT type FROM sqlite_schema WHERE name = ?").get("snapshot_child_after_insert").type, "trigger");
      snapshot.verifyIntegrity();
    } finally {
      snapshot.close();
    }

    const restored = await restoreSqlcipherSnapshot(snapshotPath, snapshotKey, restoredPath, restoredDbDek);
    assert.equal(restored.databasePath, restoredPath);
    assert.equal(restored.mechanism, SQLCIPHER_SNAPSHOT_MECHANISM);
    const restoredConnection = openCoreDatabase(restoredPath, { dbDek: restoredDbDek });
    try {
      assert.equal(restoredConnection.database.prepare("SELECT label FROM snapshot_parent").get().label, "parent");
      assert.equal(restoredConnection.database.prepare("SELECT value FROM snapshot_child_view").get().value, "durable");
      restoredConnection.verifyIntegrity();
    } finally {
      restoredConnection.close();
    }
    assert.throws(
      () => openCoreDatabase(restoredPath, { dbDek: TEST_DB_DEK }),
      (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_KEY_INVALID",
    );

    assert.throws(
      () => openSqlcipherSnapshot(snapshotPath, Buffer.alloc(32, 0x56)),
      (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_KEY_INVALID",
    );
    assert.throws(
      () => openSqlcipherSnapshot(snapshotPath, Buffer.alloc(31)),
      (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_SNAPSHOT_KEY_REQUIRED",
    );
    await assert.rejects(
      () => exportSqlcipherSnapshot(connection, snapshotPath, createSnapshotDbKey()),
      (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_SNAPSHOT_DESTINATION_EXISTS",
    );

    connection.database.exec("BEGIN IMMEDIATE");
    try {
      await assert.rejects(
        () => exportSqlcipherSnapshot(connection, join(root, "active-transaction.db"), createSnapshotDbKey()),
        (error) => error instanceof CorePersistenceError && error.code === "PERSISTENCE_SNAPSHOT_ACTIVE_TRANSACTION",
      );
    } finally {
      connection.database.exec("ROLLBACK");
    }
  } finally {
    connection.close();
    const files = await readdir(root);
    assert.equal(files.some((file) => file.includes(".partial-")), false);
    assert.equal(files.includes("snapshot.db-wal"), false);
    assert.equal(files.includes("snapshot.db-shm"), false);
    await rm(root, { recursive: true, force: true });
  }
});
