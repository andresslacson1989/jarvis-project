import type { SecurityAuditEvent } from "./security-audit.mjs";
import { SECURITY_AUDIT_EVENT_TYPES, SECURITY_AUDIT_REASON_CODES } from "./security-audit.mjs";

export class SecurityAuditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityAuditValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new SecurityAuditValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[]): void {
  if (Object.keys(value).some((key) => !required.includes(key)) || required.some((key) => !(key in value))) throw new SecurityAuditValidationError("security audit contains unsupported or missing fields");
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) throw new SecurityAuditValidationError(`${label} is invalid`);
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 64 || Number.isNaN(Date.parse(value))) throw new SecurityAuditValidationError("occurredAt is invalid");
  return value;
}

function rejectSecrets(value: unknown, path = "details", depth = 0): void {
  if (depth > 5) throw new SecurityAuditValidationError("security audit details are too deep");
  if (Array.isArray(value)) {
    if (value.length > 64) throw new SecurityAuditValidationError("security audit details are too large");
    value.forEach((item, index) => rejectSecrets(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const entries = Object.entries(value);
  if (entries.length > 64) throw new SecurityAuditValidationError("security audit details are too large");
  for (const [key, item] of entries) {
    if (/(?:password|secret|token|private[_-]?key|credential|recovery|dek|keymaterial)/iu.test(key)) throw new SecurityAuditValidationError(`${path}.${key} cannot contain secret material`);
    rejectSecrets(item, `${path}.${key}`, depth + 1);
  }
}

export function validateSecurityAuditEvent(value: unknown): SecurityAuditEvent {
  const input = record(value, "security audit");
  keys(input, ["auditEventId", "eventType", "subjectType", "subjectId", "reasonCode", "occurredAt", "details"]);
  const details = record(input.details, "security audit details");
  rejectSecrets(details);
  const serialized = JSON.stringify(details);
  if (serialized.length > 16_384) throw new SecurityAuditValidationError("security audit details exceed the size bound");
  return Object.freeze({
    auditEventId: id(input.auditEventId, "auditEventId"),
    eventType: typeof input.eventType === "string" && SECURITY_AUDIT_EVENT_TYPES.includes(input.eventType as SecurityAuditEvent["eventType"]) ? input.eventType as SecurityAuditEvent["eventType"] : (() => { throw new SecurityAuditValidationError("eventType is unsupported"); })(),
    subjectType: id(input.subjectType, "subjectType"),
    subjectId: id(input.subjectId, "subjectId"),
    reasonCode: typeof input.reasonCode === "string" && SECURITY_AUDIT_REASON_CODES.includes(input.reasonCode as SecurityAuditEvent["reasonCode"]) ? input.reasonCode as SecurityAuditEvent["reasonCode"] : (() => { throw new SecurityAuditValidationError("reasonCode is unsupported"); })(),
    occurredAt: timestamp(input.occurredAt),
    details: Object.freeze({ ...details }),
  });
}
