export interface MoneyAmount {
  readonly currency: string;
  readonly nanoUnits: string;
}

export type ProviderQuotaSource = "PROVIDER_REPORTED" | "JARVIS_CALCULATED" | "UNKNOWN";
export type ProviderQuotaType = "MONETARY" | "TOKENS" | "REQUESTS" | "COMPUTE" | "SUBSCRIPTION_ALLOWANCE" | "OTHER";
export type CostConfidence = "ESTIMATED" | "PROVIDER_REPORTED" | "JARVIS_CALCULATED" | "SETTLED" | "UNKNOWN";
export type BudgetReservationState = "RESERVED" | "SETTLED" | "RELEASED" | "EXPIRED" | "UNCERTAIN";

export interface ProviderQuotaSnapshot {
  readonly snapshotId: string;
  readonly providerId: string;
  readonly modelId?: string;
  readonly accountId?: string;
  readonly quotaType: ProviderQuotaType;
  readonly unit: string;
  readonly limit?: string;
  readonly used?: string;
  readonly remaining?: string;
  readonly resetsAt?: string;
  readonly observedAt: string;
  readonly source: ProviderQuotaSource;
}

export interface UsageRecord {
  readonly usageId: string;
  readonly providerId: string;
  readonly modelId?: string;
  readonly projectId?: string;
  readonly missionId?: string;
  readonly taskId?: string;
  readonly attemptId?: string;
  readonly units?: Readonly<Record<string, string>>;
  readonly estimatedCost?: MoneyAmount;
  readonly actualCost?: MoneyAmount;
  readonly costConfidence: CostConfidence;
  readonly pricingSnapshotId?: string;
  readonly occurredAt: string;
}

export interface BudgetPolicy {
  readonly budgetId: string;
  readonly scopeType: "GLOBAL" | "PROJECT" | "MISSION" | "PROVIDER";
  readonly scopeId?: string;
  readonly limit: MoneyAmount;
  readonly warningAtBasisPoints: number;
  readonly hardLimit: boolean;
  readonly period: "MISSION" | "DAY" | "MONTH" | "CUSTOM";
}

export interface BudgetReservation {
  readonly reservationId: string;
  readonly budgetId: string;
  readonly providerId: string;
  readonly taskId?: string;
  readonly attemptId?: string;
  readonly amount: MoneyAmount;
  readonly state: BudgetReservationState;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly settledUsageId?: string;
}
