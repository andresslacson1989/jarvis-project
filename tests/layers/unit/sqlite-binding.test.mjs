import { strict as assert } from "node:assert";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const coreRequire = createRequire(new URL("../../../services/core/package.json", import.meta.url));
const Database = coreRequire("better-sqlite3-multiple-ciphers");

const QUALIFIED_SQLITE_VERSION = "3.53.2";
const QUALIFIED_SQLITE_SOURCE_ID =
  "2026-06-03 19:12:13 d6e03d8c777cfa2d35e3b60d8ec3e0187f3e9f99d8e2ee9cac695fd6fcdf1a24";

test("Windows x64 persistence binding exposes the qualified SQLite/WAL identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-sqlite-binding-"));
  const databasePath = join(root, "state.db");
  let database;
  try {
    database = new Database(databasePath, { timeout: 5000 });
    const identity = database
      .prepare("SELECT sqlite_version() AS version, sqlite_source_id() AS sourceId")
      .get();
    assert.equal(identity.version, QUALIFIED_SQLITE_VERSION);
    assert.equal(identity.sourceId, QUALIFIED_SQLITE_SOURCE_ID);

    const compileOptions = new Set(
      database.pragma("compile_options").map(({ compile_options: option }) => option),
    );
    assert.ok([...compileOptions].some((option) => option.startsWith("COMPILER=msvc-")));
    assert.ok(compileOptions.has("THREADSAFE=2"));

    assert.deepEqual(database.pragma("journal_mode = WAL"), [{ journal_mode: "wal" }]);
    database.pragma("synchronous = FULL");
    assert.deepEqual(database.pragma("synchronous"), [{ synchronous: 2 }]);
    database.pragma("foreign_keys = ON");
    assert.deepEqual(database.pragma("foreign_keys"), [{ foreign_keys: 1 }]);

    database.exec(
      "CREATE TABLE binding_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL); INSERT INTO binding_probe (value) VALUES ('ok');",
    );
    assert.equal(database.prepare("SELECT value FROM binding_probe WHERE id = 1").get().value, "ok");
  } finally {
    database?.close();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
