import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateMemory } from "../../../packages/protocol/src/memory-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const POLICY = { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" };
const NOW = "2026-08-15T00:00:00.000Z";

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-memory-${process.pid}-${Date.now()}-${Math.random()}`);
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

function anchor(anchorId, recordType, recordId) {
  return { anchorId, recordType, recordId, policyId: "retention-default", retainUntil: "2027-08-15T00:00:00.000Z", reason: "contract retention window", createdAt: NOW };
}

test("memory validation preserves scope/confidence/revision metadata and rejects SECRET storage", () => {
  const value = validateMemory({
    memoryId: "memory-1",
    scope: { kind: "PROJECT", scopeId: "project-1" },
    content: "verified fact",
    confidence: "VERIFIED",
    sourceType: "USER_CONFIRMATION",
    sourceId: "session-1",
    sourceRevision: 1,
    observedAt: NOW,
    dataPolicy: POLICY,
    retentionAnchorId: "anchor-memory-1",
    expectedVersion: 0,
  });
  assert.equal(value.scope.kind, "PROJECT");
  assert.throws(() => validateMemory({ ...value, dataPolicy: { sensitivity: "SECRET", locality: "LOCAL_ONLY" } }), /SECRET/);
});

test("conversation history and memory are stored separately with durable revisions and retention anchors", async () => {
  await withDatabase(async (connection, repository) => {
    repository.putRetentionAnchor(anchor("anchor-conversation-1", "CONVERSATION", "conversation-1"));
    repository.putRetentionAnchor(anchor("anchor-memory-1", "MEMORY", "memory-1"));
    assert.deepEqual(
      repository.putConversation({ conversationId: "conversation-1", userId: "user-1", dataPolicy: POLICY, retentionAnchorId: "anchor-conversation-1", expectedVersion: 0, createdAt: NOW, updatedAt: NOW }),
      { conversationId: "conversation-1", version: 1 },
    );
    assert.deepEqual(
      repository.appendConversationMessage({ messageId: "message-1", conversationId: "conversation-1", role: "USER", content: "remember this", dataPolicy: POLICY, createdAt: NOW }),
      { messageId: "message-1" },
    );
    assert.throws(
      () => repository.appendConversationMessage({ messageId: "message-remote", conversationId: "conversation-1", role: "USER", content: "must remain local", dataPolicy: { sensitivity: "PRIVATE", locality: "ANY_APPROVED_PROVIDER" }, createdAt: NOW }),
      (error) => error instanceof CoreSchemaError && error.message.includes("data policy disagrees"),
    );
    assert.deepEqual(
      repository.putMemory({ memoryId: "memory-1", scope: { kind: "PROJECT", scopeId: "project-1" }, content: "remembered fact", confidence: "CONFIRMED", sourceType: "USER_CONFIRMATION", sourceId: "message-1", sourceRevision: 1, observedAt: NOW, dataPolicy: POLICY, retentionAnchorId: "anchor-memory-1", expectedVersion: 0 }),
      { memoryId: "memory-1", version: 1 },
    );
    assert.deepEqual(
      repository.putMemory({ memoryId: "memory-1", scope: { kind: "PROJECT", scopeId: "project-1" }, content: "updated fact", confidence: "VERIFIED", sourceType: "USER_CONFIRMATION", sourceId: "message-1", sourceRevision: 2, observedAt: "2026-08-15T00:00:01.000Z", verifiedAt: "2026-08-15T00:00:01.000Z", dataPolicy: POLICY, retentionAnchorId: "anchor-memory-1", expectedVersion: 1 }),
      { memoryId: "memory-1", version: 2 },
    );
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM messages").get().count, 1);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM memories").get().count, 1);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM memory_revisions").get().count, 2);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM conversations").get().count, 1);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM retention_anchors").get().count, 2);
    assert.throws(
      () => repository.putMemory({ memoryId: "memory-1", scope: { kind: "PROJECT", scopeId: "project-1" }, content: "stale", confidence: "STALE", sourceType: "USER_CONFIRMATION", sourceId: "message-1", sourceRevision: 1, observedAt: NOW, dataPolicy: POLICY, retentionAnchorId: "anchor-memory-1", expectedVersion: 2 }),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT",
    );
    assert.throws(
      () => repository.appendConversationMessage({ messageId: "message-secret", conversationId: "conversation-1", role: "USER", content: "secret", dataPolicy: { sensitivity: "SECRET", locality: "LOCAL_ONLY" }, createdAt: NOW }),
      (error) => error instanceof CoreSchemaError && error.cause?.message.includes("SECRET"),
    );
    repository.putRetentionAnchor(anchor("anchor-memory-2", "MEMORY", "memory-2"));
    repository.putMemory({ memoryId: "memory-2", scope: { kind: "PROJECT", scopeId: "project-1" }, content: "project fact", confidence: "CONFIRMED", sourceType: "USER_CONFIRMATION", sourceId: "source-2", sourceRevision: 1, observedAt: NOW, dataPolicy: POLICY, retentionAnchorId: "anchor-memory-2", expectedVersion: 0 });
    repository.putRetentionAnchor(anchor("anchor-memory-3", "MEMORY", "memory-3"));
    repository.putMemory({ memoryId: "memory-3", scope: { kind: "PROJECT", scopeId: "project-1" }, content: "live fact", confidence: "VERIFIED", sourceType: "LIVE_STATE", sourceId: "live-source-1", sourceRevision: 1, observedAt: NOW, dataPolicy: POLICY, retentionAnchorId: "anchor-memory-3", expectedVersion: 0 });
    const retrieved = repository.retrieveMemory({ requestId: "memory-query-1", applicableScopes: [{ kind: "PROJECT", scopeId: "project-1" }, { kind: "USER_GLOBAL" }], queryTerms: ["fact"], dataPolicy: POLICY, limit: 10, now: NOW, authoritativeSourceIds: ["live-source-1"] });
    assert.deepEqual(retrieved.map((item) => item.memory.memoryId), ["memory-1", "memory-2"]);
    assert.equal(retrieved[0].rankScore > 0, true);
  });
});

test("retention anchors cannot be shortened", async () => {
  await withDatabase(async (_connection, repository) => {
    repository.putRetentionAnchor(anchor("anchor-1", "MEMORY", "memory-1"));
    assert.throws(() => repository.putRetentionAnchor({ ...anchor("anchor-1", "MEMORY", "memory-1"), retainUntil: "2026-01-01T00:00:00.000Z" }), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
  });
});
