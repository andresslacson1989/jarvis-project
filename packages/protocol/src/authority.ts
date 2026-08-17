import type { MoneyAmount } from "./accounting.ts";
import type { DataPolicy } from "./data.ts";
import type { ExecutionScope } from "./execution-scope.ts";

export type ActionClass = "READ" | "LOCAL_WRITE" | "EXTERNAL_WRITE" | "PUBLISH" | "DEPLOY" | "INFRASTRUCTURE_CHANGE" | "SECURITY_CHANGE" | "DESTRUCTIVE";
export type RiskClass = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type PermissionOutcome = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
export type ApprovalKind = "HIGH_RISK" | "DESTRUCTIVE_FINAL_CONFIRMATION";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "CONSUMED";

export interface AuthorityEnvelope {
  readonly id: string;
  readonly originatingInstructionId: string;
  readonly scopes: readonly ExecutionScope[];
  readonly allowedActionClasses: readonly ActionClass[];
  readonly deniedActionClasses: readonly ActionClass[];
  readonly externalSystems: readonly string[];
  readonly dataPolicy: DataPolicy;
  readonly maxBudget?: MoneyAmount;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly policySnapshotVersion: number;
}

export interface AuthorityContainmentRequest {
  readonly actionClass: ActionClass;
  readonly executionScope: ExecutionScope;
  readonly externalSystems: readonly string[];
  readonly dataPolicy: DataPolicy;
  readonly estimatedBudget?: MoneyAmount;
}

export interface PermissionDecision {
  readonly decisionId: string;
  readonly toolExecutionId?: string;
  readonly taskId?: string;
  readonly outcome: PermissionOutcome;
  readonly contextualRisk: RiskClass;
  readonly reasonCodes: readonly string[];
  readonly matchedPolicyIds: readonly string[];
  readonly matchedPrecedentIds: readonly string[];
  readonly approvalRequestId?: string;
  readonly decidedAt: string;
  readonly policyVersion: number;
}

export interface CanonicalActionDescriptorV1 {
  readonly domain: "jarvis.approval.action.v1";
  readonly descriptorVersion: 1;
  readonly toolId: string;
  readonly toolVersion: number;
  readonly actionClass: ActionClass;
  readonly sideEffectClass: "READ_ONLY" | "REVERSIBLE_WRITE" | "EXTERNAL_WRITE" | "DESTRUCTIVE";
  readonly executionScope: unknown;
  readonly targets: readonly Record<string, unknown>[];
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly integrationBindings?: readonly Record<string, unknown>[];
  readonly authorityEnvelopeId: string;
  readonly policySnapshotVersion: number;
}

export type CanonicalActionDescriptorBuildInput = Omit<CanonicalActionDescriptorV1, "domain" | "descriptorVersion">;

export interface ApprovalRequest {
  readonly approvalId: string;
  readonly kind: ApprovalKind;
  readonly descriptorVersion: 1;
  readonly actionDigestAlgorithm: "SHA-256";
  readonly actionDigestEncoding: "BASE64URL_NOPAD";
  readonly actionDigest: string;
  readonly actionSummary: string;
  readonly targetSummary: string;
  readonly environmentSummary?: string;
  readonly consequenceSummary: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly status: ApprovalStatus;
}

export interface ApprovalDecision {
  readonly decisionId: string;
  readonly approvalId: string;
  readonly status: "APPROVED" | "REJECTED";
  readonly decidedAt: string;
  readonly sessionId: string;
  readonly reasonCode: string;
}

export interface FreshTargetResolution {
  readonly resolutionId: string;
  readonly resolvedAt: string;
  readonly descriptorDigest: string;
  readonly targetIdentityDigest: string;
}

export interface FinalDestructiveConfirmation {
  readonly confirmationId: string;
  readonly approvalId: string;
  readonly descriptorDigest: string;
  readonly sessionId: string;
  readonly confirmedAt: string;
  readonly actionSummary: string;
  readonly targetSummary: string;
  readonly environmentSummary?: string;
  readonly consequenceSummary: string;
}
