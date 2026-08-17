export const SECURITY_AUDIT_EVENT_TYPES = [
  "PERMISSION_DECISION",
  "APPROVAL_ISSUED",
  "APPROVAL_DECIDED",
  "APPROVAL_EXPIRED",
  "APPROVAL_CANCELLED",
  "APPROVAL_CONSUMED",
  "TOOL_EXECUTION",
  "SECURITY_POLICY_FAILURE",
] as const;

export type SecurityAuditEventType = (typeof SECURITY_AUDIT_EVENT_TYPES)[number];

export const SECURITY_AUDIT_REASON_CODES = [
  "PERMISSION_ALLOWED",
  "PERMISSION_DENIED",
  "PERMISSION_APPROVAL_REQUIRED",
  "APPROVAL_REQUESTED",
  "APPROVAL_APPROVED",
  "APPROVAL_REJECTED",
  "APPROVAL_EXPIRED",
  "APPROVAL_CANCELLED",
  "APPROVAL_CONSUMED",
  "TOOL_EXECUTION_SUCCEEDED",
  "TOOL_EXECUTION_FAILED",
  "TOOL_EXECUTION_DENIED",
  "TOOL_EXECUTION_CANCELLED",
  "TOOL_EXECUTION_UNCERTAIN",
  "SECURITY_POLICY_BLOCKED",
] as const;

export type SecurityAuditReasonCode = (typeof SECURITY_AUDIT_REASON_CODES)[number];

export interface SecurityAuditEvent {
  readonly auditEventId: string;
  readonly eventType: SecurityAuditEventType;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly reasonCode: SecurityAuditReasonCode;
  readonly occurredAt: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export const SAME_USER_THREAT_LIMITS_V1 = Object.freeze([
  "JARVIS does not claim hard isolation from arbitrary malicious code already executing with an equivalent same-user/logon security context and sufficient local process access.",
  "JARVIS does not claim hard isolation from Administrator or kernel compromise.",
  "JARVIS does not claim hard isolation from physical control of an already-unlocked Windows and JARVIS session.",
] as const);
