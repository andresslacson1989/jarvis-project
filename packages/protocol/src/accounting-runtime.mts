import type { MoneyAmount, ProviderQuotaSnapshot, UsageRecord, BudgetPolicy, BudgetReservation } from "./accounting.ts";

export const PROVIDER_QUOTA_SOURCES = ["PROVIDER_REPORTED", "JARVIS_CALCULATED", "UNKNOWN"] as const;
export const PROVIDER_QUOTA_TYPES = ["MONETARY", "TOKENS", "REQUESTS", "COMPUTE", "SUBSCRIPTION_ALLOWANCE", "OTHER"] as const;
export const COST_CONFIDENCES = ["ESTIMATED", "PROVIDER_REPORTED", "JARVIS_CALCULATED", "SETTLED", "UNKNOWN"] as const;
export const BUDGET_RESERVATION_STATES = ["RESERVED", "SETTLED", "RELEASED", "EXPIRED", "UNCERTAIN"] as const;

export class AccountingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountingValidationError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new AccountingValidationError("accounting value must be an object");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) throw new AccountingValidationError("accounting value contains unsupported or missing fields");
}
function id(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) throw new AccountingValidationError(`${label} is invalid`);
  return value;
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new AccountingValidationError(`${label} must be an ISO timestamp`);
  return value;
}
function quantity(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)) throw new AccountingValidationError(`${label} must be a canonical non-negative quantity string`);
  return value;
}
function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new AccountingValidationError(`${label} is unsupported`);
  return value as T;
}
export function validateMoneyAmount(value: unknown): MoneyAmount {
  const input = record(value);
  keys(input, ["currency", "nanoUnits"]);
  if (typeof input.currency !== "string" || !/^[A-Z][A-Z0-9_-]{2,11}$/u.test(input.currency)) throw new AccountingValidationError("currency is invalid");
  if (typeof input.nanoUnits !== "string" || !/^-?(?:0|[1-9][0-9]*)$/u.test(input.nanoUnits)) throw new AccountingValidationError("nanoUnits must be a canonical integer string");
  return Object.freeze({ currency: input.currency, nanoUnits: input.nanoUnits });
}
function optionalId(value: unknown, label: string): string | undefined { return value === undefined ? undefined : id(value, label); }
export function validateProviderQuotaSnapshot(value: unknown): ProviderQuotaSnapshot {
  const input = record(value); keys(input, ["snapshotId", "providerId", "quotaType", "unit", "observedAt", "source"], ["modelId", "accountId", "limit", "used", "remaining", "resetsAt"]);
  return Object.freeze({ snapshotId: id(input.snapshotId, "snapshotId"), providerId: id(input.providerId, "providerId"), ...(input.modelId === undefined ? {} : { modelId: id(input.modelId, "modelId") }), ...(input.accountId === undefined ? {} : { accountId: id(input.accountId, "accountId") }), quotaType: enumValue(input.quotaType, PROVIDER_QUOTA_TYPES, "quotaType"), unit: id(input.unit, "unit"), ...(input.limit === undefined ? {} : { limit: quantity(input.limit, "limit") }), ...(input.used === undefined ? {} : { used: quantity(input.used, "used") }), ...(input.remaining === undefined ? {} : { remaining: quantity(input.remaining, "remaining") }), ...(input.resetsAt === undefined ? {} : { resetsAt: timestamp(input.resetsAt, "resetsAt") }), observedAt: timestamp(input.observedAt, "observedAt"), source: enumValue(input.source, PROVIDER_QUOTA_SOURCES, "source") });
}
export function validateUsageRecord(value: unknown): UsageRecord {
  const input = record(value); keys(input, ["usageId", "providerId", "costConfidence", "occurredAt"], ["modelId", "projectId", "missionId", "taskId", "attemptId", "units", "estimatedCost", "actualCost", "pricingSnapshotId"]);
  let units: Readonly<Record<string, string>> | undefined;
  if (input.units !== undefined) { const raw = record(input.units); units = Object.freeze(Object.fromEntries(Object.entries(raw).map(([key, item]) => [id(key, "unit"), quantity(item, "unit quantity")]))); }
  return Object.freeze({ usageId: id(input.usageId, "usageId"), providerId: id(input.providerId, "providerId"), ...(input.modelId === undefined ? {} : { modelId: id(input.modelId, "modelId") }), ...(input.projectId === undefined ? {} : { projectId: id(input.projectId, "projectId") }), ...(input.missionId === undefined ? {} : { missionId: id(input.missionId, "missionId") }), ...(input.taskId === undefined ? {} : { taskId: id(input.taskId, "taskId") }), ...(input.attemptId === undefined ? {} : { attemptId: id(input.attemptId, "attemptId") }), ...(units === undefined ? {} : { units }), ...(input.estimatedCost === undefined ? {} : { estimatedCost: validateMoneyAmount(input.estimatedCost) }), ...(input.actualCost === undefined ? {} : { actualCost: validateMoneyAmount(input.actualCost) }), costConfidence: enumValue(input.costConfidence, COST_CONFIDENCES, "costConfidence"), ...(input.pricingSnapshotId === undefined ? {} : { pricingSnapshotId: id(input.pricingSnapshotId, "pricingSnapshotId") }), occurredAt: timestamp(input.occurredAt, "occurredAt") });
}
export function validateBudgetPolicy(value: unknown): BudgetPolicy { const input = record(value); keys(input, ["budgetId", "scopeType", "limit", "warningAtBasisPoints", "hardLimit", "period"], ["scopeId"]); if (!Number.isInteger(input.warningAtBasisPoints) || (input.warningAtBasisPoints as number) < 0 || (input.warningAtBasisPoints as number) > 10000 || typeof input.hardLimit !== "boolean") throw new AccountingValidationError("budget policy bounds are invalid"); return Object.freeze({ budgetId: id(input.budgetId, "budgetId"), scopeType: enumValue(input.scopeType, ["GLOBAL", "PROJECT", "MISSION", "PROVIDER"], "scopeType"), ...(input.scopeId === undefined ? {} : { scopeId: id(input.scopeId, "scopeId") }), limit: validateMoneyAmount(input.limit), warningAtBasisPoints: input.warningAtBasisPoints as number, hardLimit: input.hardLimit, period: enumValue(input.period, ["MISSION", "DAY", "MONTH", "CUSTOM"], "period") }); }
export function validateBudgetReservation(value: unknown): BudgetReservation { const input = record(value); keys(input, ["reservationId", "budgetId", "providerId", "amount", "state", "createdAt"], ["taskId", "attemptId", "expiresAt", "settledUsageId"]); return Object.freeze({ reservationId: id(input.reservationId, "reservationId"), budgetId: id(input.budgetId, "budgetId"), providerId: id(input.providerId, "providerId"), ...(input.taskId === undefined ? {} : { taskId: id(input.taskId, "taskId") }), ...(input.attemptId === undefined ? {} : { attemptId: id(input.attemptId, "attemptId") }), amount: validateMoneyAmount(input.amount), state: enumValue(input.state, BUDGET_RESERVATION_STATES, "reservation state"), createdAt: timestamp(input.createdAt, "createdAt"), ...(input.expiresAt === undefined ? {} : { expiresAt: timestamp(input.expiresAt, "expiresAt") }), ...(input.settledUsageId === undefined ? {} : { settledUsageId: id(input.settledUsageId, "settledUsageId") }) }); }
