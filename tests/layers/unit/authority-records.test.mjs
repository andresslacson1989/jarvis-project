import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateCanonicalActionDescriptor } from "../../../packages/protocol/src/authority-runtime.mts";
import { canonicalizeJcs } from "../../../services/core/src/backup-descriptor.ts";
import {
  applyCoreMigrations,
  CoreSchemaError,
  CoreStateRepository,
} from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-authority-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    await testBody(connection, new CoreStateRepository(connection));
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
}

const descriptor = {
  domain: "jarvis.approval.action.v1",
  descriptorVersion: 1,
  toolId: "tool-read",
  toolVersion: 1,
  actionClass: "READ",
  sideEffectClass: "READ_ONLY",
  executionScope: { kind: "GLOBAL" },
  targets: [{ system: "local", resourceType: "status", resourceId: "core" }],
  arguments: { value: 1 },
  authorityEnvelopeId: "envelope-1",
  policySnapshotVersion: 1,
};

function digest(value) {
  return createHash("sha256").update(canonicalizeJcs(value)).digest("base64url");
}

function freshTargetResolution(descriptorValue, resolvedAt = "2026-08-15T00:00:01.000Z") {
  return {
    resolutionId: "resolution-1",
    resolvedAt,
    descriptorDigest: digest(descriptorValue),
    targetIdentityDigest: digest(descriptorValue.targets),
  };
}

test("authority validators reject secret-bearing descriptors and preserve canonical digest inputs", () => {
  assert.deepEqual(validateCanonicalActionDescriptor(descriptor).domain, "jarvis.approval.action.v1");
  assert.throws(() => validateCanonicalActionDescriptor({ ...descriptor, arguments: { accessToken: "never" } }));
});

test("authority envelopes are immutable, permission decisions are persisted, and approvals are single-use", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    assert.deepEqual(repository.putAuthorityEnvelope({
      id: "envelope-1",
      originatingInstructionId: "instruction-1",
      scopes: [{ kind: "GLOBAL" }],
      allowedActionClasses: ["READ"],
      deniedActionClasses: ["DESTRUCTIVE"],
      externalSystems: [],
      dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" },
      createdAt: "2026-08-15T00:00:00.000Z",
      policySnapshotVersion: 1,
    }), { envelopeId: "envelope-1" });
    assert.throws(() => connection.database.prepare("UPDATE authority_envelopes SET envelope_json = '{}' WHERE envelope_id = 'envelope-1'").run());
    assert.throws(() => connection.database.prepare("DELETE FROM authority_envelopes WHERE envelope_id = 'envelope-1'").run());
    assert.deepEqual(repository.putPermissionDecision({
      decisionId: "decision-1",
      toolExecutionId: "018f0000-0000-7000-8000-000000000201",
      outcome: "REQUIRE_APPROVAL",
      contextualRisk: "HIGH",
      reasonCodes: ["HIGH_RISK"],
      matchedPolicyIds: ["policy-1"],
      matchedPrecedentIds: [],
      approvalRequestId: "approval-1",
      decidedAt: "2026-08-15T00:00:01.000Z",
      policyVersion: 1,
    }), { decisionId: "decision-1" });
    assert.deepEqual(repository.getPermissionDecisionForToolExecution("018f0000-0000-7000-8000-000000000201"), {
      decisionId: "decision-1",
      toolExecutionId: "018f0000-0000-7000-8000-000000000201",
      outcome: "REQUIRE_APPROVAL",
      contextualRisk: "HIGH",
      reasonCodes: ["HIGH_RISK"],
      matchedPolicyIds: ["policy-1"],
      matchedPrecedentIds: [],
      approvalRequestId: "approval-1",
      decidedAt: "2026-08-15T00:00:01.000Z",
      policyVersion: 1,
    });
    assert.equal(repository.getPermissionDecisionForToolExecution("018f0000-0000-7000-8000-000000000202"), undefined);
    assert.throws(
      () => repository.getPermissionDecisionForToolExecution("not-a-uuid"),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID",
    );
    assert.deepEqual(repository.putApprovalRequest({
      descriptor,
      approval: {
        approvalId: "approval-1",
        kind: "HIGH_RISK",
        descriptorVersion: 1,
        actionDigestAlgorithm: "SHA-256",
        actionDigestEncoding: "BASE64URL_NOPAD",
        actionDigest: digest(descriptor),
        actionSummary: "Read status",
        targetSummary: "local core status",
        consequenceSummary: "No side effect",
        createdAt: "2026-08-15T00:00:00.000Z",
        expiresAt: "2026-08-15T01:00:00.000Z",
        status: "PENDING",
      },
    }), { approvalId: "approval-1", version: 1 });
    connection.database.prepare("UPDATE approval_requests SET state = 'APPROVED' WHERE approval_request_id = ?").run("approval-1");
    assert.deepEqual(repository.consumeApproval({ approvalId: "approval-1", expectedVersion: 1, sessionId: "session-1", freshDescriptor: descriptor, freshTargetResolution: freshTargetResolution(descriptor), now: "2026-08-15T00:00:02.000Z" }), {
      approvalId: "approval-1",
      version: 2,
      status: "CONSUMED",
    });
    const auditTypes = connection.database.prepare("SELECT event_type FROM audit_events WHERE subject_id IN (?, ?) ORDER BY audit_event_id").all("decision-1", "approval-1").map((row) => row.event_type);
    assert.deepEqual(auditTypes, ["APPROVAL_CONSUMED", "APPROVAL_ISSUED", "PERMISSION_DECISION"]);
    assert.throws(
      () => repository.consumeApproval({ approvalId: "approval-1", expectedVersion: 2, sessionId: "session-1", freshDescriptor: descriptor, freshTargetResolution: freshTargetResolution(descriptor), now: "2026-08-15T00:00:03.000Z" }),
      (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT",
    );
  });
});

test("approval lifecycle persists decisions, cancellation, expiry, and single-use consumption atomically", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    const approval = (approvalId, expiresAt) => ({
      approvalId,
      kind: "HIGH_RISK",
      descriptorVersion: 1,
      actionDigestAlgorithm: "SHA-256",
      actionDigestEncoding: "BASE64URL_NOPAD",
      actionDigest: digest(descriptor),
      actionSummary: "Read status",
      targetSummary: "local core status",
      consequenceSummary: "No side effect",
      createdAt: "2026-08-15T00:00:00.000Z",
      expiresAt,
      status: "PENDING",
    });
    assert.deepEqual(repository.putApprovalRequest({ approval: approval("approval-life-1", "2026-08-15T01:00:00.000Z"), descriptor }), { approvalId: "approval-life-1", version: 1 });
    assert.deepEqual(repository.decideApproval({
      approvalId: "approval-life-1",
      expectedVersion: 1,
      now: "2026-08-15T00:00:02.000Z",
      decision: {
        decisionId: "approval-decision-1",
        approvalId: "approval-life-1",
        status: "APPROVED",
        decidedAt: "2026-08-15T00:00:01.000Z",
        sessionId: "session-1",
        reasonCode: "USER_APPROVED",
      },
    }), { approvalId: "approval-life-1", version: 2, status: "APPROVED" });
    assert.deepEqual(repository.consumeApproval({ approvalId: "approval-life-1", expectedVersion: 2, sessionId: "session-1", freshDescriptor: descriptor, freshTargetResolution: freshTargetResolution(descriptor), now: "2026-08-15T00:00:03.000Z" }), { approvalId: "approval-life-1", version: 3, status: "CONSUMED" });
    assert.throws(() => repository.consumeApproval({ approvalId: "approval-life-1", expectedVersion: 3, sessionId: "session-1", freshDescriptor: descriptor, freshTargetResolution: freshTargetResolution(descriptor), now: "2026-08-15T00:00:04.000Z" }), /stale|not approved|already consumed/iu);

    assert.deepEqual(repository.putApprovalRequest({ approval: approval("approval-life-2", "2026-08-15T01:00:00.000Z"), descriptor }), { approvalId: "approval-life-2", version: 1 });
    assert.deepEqual(repository.cancelApproval({ approvalId: "approval-life-2", expectedVersion: 1, now: "2026-08-15T00:00:05.000Z" }), { approvalId: "approval-life-2", version: 2, status: "CANCELLED" });
    assert.throws(() => repository.decideApproval({
      approvalId: "approval-life-2",
      expectedVersion: 2,
      now: "2026-08-15T00:00:06.000Z",
      decision: { decisionId: "approval-decision-2", approvalId: "approval-life-2", status: "APPROVED", decidedAt: "2026-08-15T00:00:06.000Z", sessionId: "session-1", reasonCode: "USER_APPROVED" },
    }), /not pending/iu);

    assert.deepEqual(repository.putApprovalRequest({ approval: approval("approval-life-3", "2026-08-15T00:00:07.000Z"), descriptor }), { approvalId: "approval-life-3", version: 1 });
    assert.deepEqual(repository.expireApproval({ approvalId: "approval-life-3", expectedVersion: 1, now: "2026-08-15T00:00:08.000Z" }), { approvalId: "approval-life-3", version: 2, status: "EXPIRED" });
    assert.throws(() => repository.decideApproval({
      approvalId: "approval-life-3",
      expectedVersion: 2,
      now: "2026-08-15T00:00:09.000Z",
      decision: { decisionId: "approval-decision-3", approvalId: "approval-life-3", status: "APPROVED", decidedAt: "2026-08-15T00:00:09.000Z", sessionId: "session-1", reasonCode: "USER_APPROVED" },
    }), /not pending/iu);
  });
});

test("approval consumption requires fresh target resolution and exact destructive final confirmation", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    const destructiveDescriptor = {
      ...descriptor,
      toolId: "tool-delete",
      actionClass: "DESTRUCTIVE",
      sideEffectClass: "DESTRUCTIVE",
      targets: [{ system: "local", resourceType: "file", resourceId: "important.db" }],
      arguments: { confirmedScope: "single-file" },
    };
    const approval = {
      approvalId: "approval-destructive-1",
      kind: "DESTRUCTIVE_FINAL_CONFIRMATION",
      descriptorVersion: 1,
      actionDigestAlgorithm: "SHA-256",
      actionDigestEncoding: "BASE64URL_NOPAD",
      actionDigest: digest(destructiveDescriptor),
      actionSummary: "Delete one file",
      targetSummary: "local file important.db",
      environmentSummary: "local Windows host",
      consequenceSummary: "The file will be permanently deleted",
      createdAt: "2026-08-15T00:00:00.000Z",
      expiresAt: "2026-08-15T01:00:00.000Z",
      status: "PENDING",
    };
    const resolution = freshTargetResolution(destructiveDescriptor);
    const confirmation = {
      confirmationId: "confirmation-1",
      approvalId: approval.approvalId,
      descriptorDigest: approval.actionDigest,
      sessionId: "session-destructive",
      confirmedAt: "2026-08-15T00:00:02.000Z",
      actionSummary: approval.actionSummary,
      targetSummary: approval.targetSummary,
      environmentSummary: approval.environmentSummary,
      consequenceSummary: approval.consequenceSummary,
    };
    assert.deepEqual(repository.putApprovalRequest({ approval, descriptor: destructiveDescriptor }), { approvalId: approval.approvalId, version: 1 });
    assert.deepEqual(repository.decideApproval({
      approvalId: approval.approvalId,
      expectedVersion: 1,
      now: "2026-08-15T00:00:03.000Z",
      decision: {
        decisionId: "decision-destructive-1",
        approvalId: approval.approvalId,
        status: "APPROVED",
        decidedAt: "2026-08-15T00:00:03.000Z",
        sessionId: "session-destructive",
        reasonCode: "USER_APPROVED",
      },
    }), { approvalId: approval.approvalId, version: 2, status: "APPROVED" });
    assert.throws(
      () => repository.consumeApproval({ approvalId: approval.approvalId, expectedVersion: 2, sessionId: "session-destructive", freshDescriptor: destructiveDescriptor, freshTargetResolution: resolution, now: "2026-08-15T00:00:03.000Z" }),
      /fresh final confirmation/iu,
    );
    assert.throws(
      () => repository.consumeApproval({ approvalId: approval.approvalId, expectedVersion: 2, sessionId: "session-destructive", freshDescriptor: destructiveDescriptor, freshTargetResolution: { ...resolution, descriptorDigest: digest(descriptor) }, finalConfirmation: confirmation, now: "2026-08-15T00:00:03.000Z" }),
      /descriptor changed/iu,
    );
    assert.throws(
      () => repository.consumeApproval({ approvalId: approval.approvalId, expectedVersion: 2, sessionId: "session-other", freshDescriptor: destructiveDescriptor, freshTargetResolution: resolution, finalConfirmation: confirmation, now: "2026-08-15T00:00:03.000Z" }),
      /not bound/iu,
    );
    assert.deepEqual(repository.consumeApproval({ approvalId: approval.approvalId, expectedVersion: 2, sessionId: "session-destructive", freshDescriptor: destructiveDescriptor, freshTargetResolution: resolution, finalConfirmation: confirmation, now: "2026-08-15T00:00:03.000Z" }), { approvalId: approval.approvalId, version: 3, status: "CONSUMED" });
  });
});
