import assert from "node:assert/strict";
import test from "node:test";
import {
  SAME_USER_THREAT_LIMITS_V1,
  SECURITY_AUDIT_EVENT_TYPES,
  SECURITY_AUDIT_REASON_CODES,
} from "../../../packages/protocol/src/security-audit.mts";
import { validateSecurityAuditEvent } from "../../../packages/protocol/src/security-audit-runtime.mts";

test("security audit records are bounded, reason-coded, and secret-free", () => {
  for (const eventType of SECURITY_AUDIT_EVENT_TYPES) {
    const event = validateSecurityAuditEvent({
      auditEventId: `audit-${eventType.toLowerCase()}`,
      eventType,
      subjectType: "APPROVAL",
      subjectId: "approval-1",
      reasonCode: SECURITY_AUDIT_REASON_CODES[0],
      occurredAt: "2026-08-15T00:00:00.000Z",
      details: { state: "PENDING", version: 1 },
    });
    assert.equal(event.eventType, eventType);
  }
  assert.throws(() => validateSecurityAuditEvent({
    auditEventId: "audit-secret",
    eventType: "SECURITY_POLICY_FAILURE",
    subjectType: "SECURITY",
    subjectId: "failure-1",
    reasonCode: "SECURITY_POLICY_BLOCKED",
    occurredAt: "2026-08-15T00:00:00.000Z",
    details: { recoverySecret: "never" },
  }), /secret material/iu);
  assert.throws(() => validateSecurityAuditEvent({
    auditEventId: "audit-extra",
    eventType: "SECURITY_POLICY_FAILURE",
    subjectType: "SECURITY",
    subjectId: "failure-1",
    reasonCode: "SECURITY_POLICY_BLOCKED",
    occurredAt: "2026-08-15T00:00:00.000Z",
    details: {},
    extra: true,
  }), /unsupported or missing/iu);
});

test("same-user threat limits are explicit and do not overclaim isolation", () => {
  assert.equal(SAME_USER_THREAT_LIMITS_V1.length, 3);
  assert.match(SAME_USER_THREAT_LIMITS_V1[0], /same-user\/logon security context/iu);
  assert.match(SAME_USER_THREAT_LIMITS_V1[1], /Administrator or kernel compromise/iu);
  assert.match(SAME_USER_THREAT_LIMITS_V1[2], /already-unlocked Windows and JARVIS session/iu);
});
