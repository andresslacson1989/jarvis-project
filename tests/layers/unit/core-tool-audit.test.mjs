import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_TEST_TOOL_MANIFEST } from "../../../packages/protocol/src/tool-engineering.mjs";
import { applyCoreMigrations, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

test("Core durable tool audit records outcome facts without persisting tool output", async () => {
  const root = join(tmpdir(), `jarvis-tool-audit-${process.pid}-${Date.now()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: Buffer.alloc(32, 0x42) });
  try {
    applyCoreMigrations(connection, () => "2026-08-17T00:00:00.000Z");
    const repository = new CoreStateRepository(connection);
    const executionId = "018f0000-0000-7000-8000-000000000201";
    repository.recordToolExecutionAudit({
      toolExecutionId: executionId,
      outcome: "SUCCEEDED",
      output: { secret: "must-not-be-stored" },
      preconditions: [],
      postconditions: [],
      startedAt: "2026-08-17T00:00:00.000Z",
      endedAt: "2026-08-17T00:00:01.000Z",
    }, PROJECT_TEST_TOOL_MANIFEST);
    const row = connection.database.prepare("SELECT event_type, subject_type, subject_id, audit_json FROM audit_events WHERE subject_id = ?").get(executionId);
    assert.equal(row.event_type, "TOOL_EXECUTION");
    assert.equal(row.subject_type, "TOOL_EXECUTION");
    assert.equal(row.subject_id, executionId);
    assert.doesNotMatch(row.audit_json, /must-not-be-stored/iu);
    assert.match(row.audit_json, /TOOL_EXECUTION_SUCCEEDED/iu);
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
