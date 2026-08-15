export type ProjectPolicyTrustState = "UNTRUSTED_CANDIDATE" | "TRUSTED" | "CHANGED_REVIEW_REQUIRED" | "DISABLED_BY_USER" | "REVOKED";
export type ProjectPolicyMutationGateStatus = "ALLOWED" | "PROJECT_POLICY_DECISION_REQUIRED";
export type ProjectPolicyDecision = "TRUST" | "DISABLE" | "REVOKE";
export type ProjectPolicyMutationActorKind = "AUTHENTICATED_USER" | "WORKER" | "TOOL";
export type ProjectPolicyRevalidationTrigger = "NEW_ATTEMPT" | "RESUMING" | "CONSEQUENTIAL_ACTION";

export interface ProjectPolicyDecisionRequest {
  readonly policyTrustId: string;
  readonly expectedRevision: number;
  readonly decision: ProjectPolicyDecision;
  readonly userId: string;
  readonly sessionId: string;
  readonly now: string;
}

export interface ProjectPolicyMutationGateResult {
  readonly status: ProjectPolicyMutationGateStatus;
  readonly policyState?: ProjectPolicyTrustState;
}

export interface ProjectPolicyMutationTarget {
  readonly policyTrustId: string;
  readonly projectId: string;
  readonly canonicalRelativePath: string;
  readonly proposedContentSha256: string;
}

export interface ProjectPolicySnapshotRevalidationRequest {
  readonly snapshotId: string;
  readonly projectId: string;
  readonly attemptId: string;
  readonly trigger: ProjectPolicyRevalidationTrigger;
}

export interface ProjectPolicyTrustRecord {
  readonly policyTrustId: string;
  readonly projectId: string;
  readonly canonicalRelativePath: string;
  readonly canonicalScopeRoot: string;
  readonly contentSha256: string;
  readonly gitBlobOid?: string;
  readonly sourceCommit?: string;
  readonly state: ProjectPolicyTrustState;
  readonly acceptedAt?: string;
  readonly acceptedSessionId?: string;
  readonly revision: number;
}

export interface ProjectPolicySnapshotRecord {
  readonly snapshotId: string;
  readonly projectId: string;
  readonly attemptId: string;
  readonly createdAt: string;
  readonly policies: readonly Readonly<{
    policyTrustId: string;
    revision: number;
    contentSha256: string;
  }>[];
}
