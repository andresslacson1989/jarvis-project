import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { CorePersistenceError, openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const NOW = "2026-08-15T00:00:00.000Z";
const USER_ID = "local-user";
const SESSION_ID = "0190f2b0-0000-7000-8000-000000000051";

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-data-policy-${process.pid}-${Date.now()}-${Math.random()}`);
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

function sessionEvidence(eventId, eventType) {
  return {
    userId: USER_ID,
    sessionId: SESSION_ID,
    now: NOW,
    eventId,
    eventType,
    correlationId: eventId,
  };
}

function verifier() {
  return {
    profileId: "session-password-v1",
    purpose: "SESSION_PASSWORD",
    algorithm: "ARGON2ID",
    version: 0x13,
    memoryKiB: 65_536,
    iterations: 3,
    parallelism: 4,
    salt: Buffer.alloc(16, 0x71),
    verifier: Buffer.alloc(32, 0x72),
  };
}

test("declassification requires an unlocked session, lowers policy deterministically, and records only bounded audit metadata", async () => {
  await withDatabase(async (connection, repository) => {
    repository.initializeSession(sessionEvidence("0190f2b0-0000-7000-8000-000000000052", "SESSION_INIT"), verifier());
    repository.authenticateSession({
      ...sessionEvidence("0190f2b0-0000-7000-8000-000000000053", "SESSION_AUTHENTICATION"),
      now: "2026-08-15T00:00:01.000Z",
      passwordVerified: true,
    });
    const request = {
      ...sessionEvidence("0190f2b0-0000-7000-8000-000000000054", "DATA_POLICY_DECLASSIFIED"),
      now: "2026-08-15T00:00:02.000Z",
      decisionId: "declassify-1",
      sourcePolicy: { sensitivity: "SENSITIVE", locality: "LOCAL_ONLY" },
      targetPolicy: { sensitivity: "PRIVATE", locality: "ANY_APPROVED_PROVIDER" },
      reason: "approved redacted export",
      explicitConfirmation: true,
    };
    assert.deepEqual(repository.declassifyDataPolicy(request), {
      decisionId: "declassify-1",
      sourcePolicy: { sensitivity: "SENSITIVE", locality: "LOCAL_ONLY" },
      targetPolicy: { sensitivity: "PRIVATE", locality: "ANY_APPROVED_PROVIDER" },
    });
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM events WHERE aggregate_type = 'DATA_POLICY_DECLASSIFICATION'").get().count, 1);
    const audit = connection.database.prepare("SELECT audit_json FROM audit_events WHERE subject_id = ?").get("declassify-1").audit_json;
    assert.doesNotMatch(audit, /password|secret|token|raw-content/iu);
    assert.throws(() => repository.declassifyDataPolicy(request), (error) => error instanceof CorePersistenceError);
    assert.throws(() => repository.declassifyDataPolicy({ ...request, eventId: "0190f2b0-0000-7000-8000-000000000055", correlationId: "0190f2b0-0000-7000-8000-000000000055", decisionId: "declassify-2", sourcePolicy: { sensitivity: "PRIVATE", locality: "ANY_APPROVED_PROVIDER" }, targetPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" } }), /strict audited declassification/iu);
    assert.throws(() => repository.declassifyDataPolicy({ ...request, eventId: "0190f2b0-0000-7000-8000-000000000056", correlationId: "0190f2b0-0000-7000-8000-000000000056", decisionId: "declassify-3", reason: "export password" }), /secret-bearing/iu);
  });
});
