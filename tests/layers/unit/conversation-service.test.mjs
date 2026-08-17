import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ConversationService } from "../../../services/core/src/conversation.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";
import { applyCoreMigrations, CoreStateRepository } from "../../../services/core/src/schema.ts";

const NOW = "2026-08-16T00:00:00.000Z";
const SESSION_ID = "0198c6e2-1f00-7000-8000-000000000001";
const CONVERSATION_ID = "0198c6e2-1f00-7000-8000-000000000002";
const INSTRUCTION_ID = "0198c6e2-1f00-7000-8000-000000000003";
const POLICY = { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" };

function context() {
  return {
    domain: "jarvis.context-package.v1",
    schemaVersion: 1,
    contextId: "context-1",
    items: [{
      itemId: "system-1",
      sourceLabel: { domain: "jarvis.content-authority.label.v1", schemaVersion: 1, sourceType: "SYSTEM_POLICY", sourceId: "system-1", authorityClass: "CONTENT_ONLY" },
      content: "Answer without taking action.",
    }],
  };
}

function input() {
  return {
    instruction: { id: INSTRUCTION_ID, sessionId: SESSION_ID, modality: "TEXT", origin: "LOCAL_UI", text: "What is the status?", receivedAt: NOW, conversationId: CONVERSATION_ID },
    context: context(),
    dataPolicy: POLICY,
  };
}

function result(data, overrides = {}) {
  return {
    domain: "jarvis.provider-result.v1", schemaVersion: 1, requestId: INSTRUCTION_ID, providerId: "codex-cli", distributionId: "codex-test", adapterVersion: "1.0.0", executionMode: "ONE_SHOT", completedAt: NOW,
    output: { domain: "jarvis.ai-output.v1", schemaVersion: 1, outputId: "output-1", providerId: "codex-cli", generatedAt: NOW, sourceLabel: { domain: "jarvis.content-authority.label.v1", schemaVersion: 1, sourceType: "AI_OUTPUT", sourceId: "output-1", authorityClass: "CONTENT_ONLY" }, items: [{ kind: "DATA", data }] },
    ...overrides,
  };
}

function seed(repository) {
  repository.putRetentionAnchor({ anchorId: "anchor-1", recordType: "CONVERSATION", recordId: CONVERSATION_ID, policyId: "retention-v1", retainUntil: "2027-08-16T00:00:00.000Z", reason: "test", createdAt: NOW });
  repository.putConversation({ conversationId: CONVERSATION_ID, userId: "user-1", dataPolicy: POLICY, retentionAnchorId: "anchor-1", expectedVersion: 0, createdAt: NOW, updatedAt: NOW });
  repository.initializeSession({ userId: "user-1", sessionId: SESSION_ID, now: NOW, eventId: "0198c6e2-1f00-7000-8000-000000000004", eventType: "SESSION_INIT", correlationId: "0198c6e2-1f00-7000-8000-000000000005" }, { profileId: "session-password-v1", purpose: "SESSION_PASSWORD", algorithm: "ARGON2ID", version: 0x13, memoryKiB: 65536, iterations: 3, parallelism: 4, salt: Buffer.alloc(16, 0x51), verifier: Buffer.alloc(32, 0x52) });
  repository.authenticateSession({ userId: "user-1", sessionId: SESSION_ID, now: NOW, eventId: "0198c6e2-1f00-7000-8000-000000000006", eventType: "SESSION_AUTHENTICATED", correlationId: "0198c6e2-1f00-7000-8000-000000000007", passwordVerified: true });
}

async function createTestCoreDatabase() {
  const root = join(tmpdir(), `jarvis-conversation-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: Buffer.alloc(32, 0x42) });
  applyCoreMigrations(connection, () => NOW);
  const repository = new CoreStateRepository(connection);
  return { connection, repository, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("ConversationService binds authenticated input, performs one-shot structured decision, and persists both messages", async () => {
  const { connection, repository, cleanup } = await createTestCoreDatabase();
  seed(repository);
  const service = new ConversationService({ providerId: "codex-cli", repository, createMessageId: () => "0198c6e2-1f00-7000-8000-000000000008", orchestrator: async ({ context: boundContext, repairAttempt }) => {
    assert.equal(repairAttempt, false);
    assert.equal(boundContext.items.at(-1).sourceLabel.sourceType, "USER_INSTRUCTION");
    return result({ domain: "jarvis.structured-decision.v1", schemaVersion: 1, decisionId: "decision-1", kind: "ANSWER", text: "The system is ready." });
  } });
  const output = await service.processAuthenticatedText(input());
  assert.equal(output.decision.kind, "ANSWER");
  assert.equal(output.repaired, false);
  assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM messages").get().count, 2);
  connection.close();
  await cleanup();
});

test("ConversationService permits exactly one bounded repair and never accepts authority-bearing decision data", async () => {
  const { connection, repository, cleanup } = await createTestCoreDatabase();
  seed(repository);
  let calls = 0;
  const service = new ConversationService({ providerId: "codex-cli", repository, createMessageId: () => "0198c6e2-1f00-7000-8000-000000000009", orchestrator: async ({ repairAttempt }) => {
    calls += 1;
    if (!repairAttempt) return { malformed: true };
    return result({ domain: "jarvis.structured-decision.v1", schemaVersion: 1, decisionId: "decision-2", kind: "PROPOSE_WORK", text: "I can prepare a plan.", proposedWork: { summary: "Prepare a plan" } });
  } });
  const output = await service.processAuthenticatedText(input());
  assert.equal(output.repaired, true);
  assert.equal(calls, 2);
  connection.close();
  await cleanup();

  const second = await createTestCoreDatabase();
  seed(second.repository);
  const rejecting = new ConversationService({ providerId: "codex-cli", repository: second.repository, createMessageId: () => "0198c6e2-1f00-7000-8000-000000000010", orchestrator: async () => result({ domain: "jarvis.structured-decision.v1", schemaVersion: 1, decisionId: "decision-3", kind: "ANSWER", text: "No.", authorityEnvelopeId: "fake" }) });
  await assert.rejects(() => rejecting.processAuthenticatedText(input()), (error) => error?.code === "PROVIDER_RESULT_INVALID");
  second.connection.close();
  await second.cleanup();
});
