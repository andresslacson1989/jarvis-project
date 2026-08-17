import type { ProviderResumeReference, WorkerCheckpoint } from "./worker.js";

export type WorkerRecoveryStrategy = "PROVIDER_RESUME" | "FRESH_SESSION";
export type WorkerRecoveryReason =
  | "PROVIDER_RESUME_ELIGIBLE"
  | "NO_RESUME_REFERENCE"
  | "PROVIDER_RESUME_UNSUPPORTED"
  | "PROVIDER_IDENTITY_MISMATCH"
  | "AUTHENTICATION_NOT_VERIFIED"
  | "PRIVACY_NOT_AUTHORIZED"
  | "AUTHORITY_NOT_VERIFIED"
  | "SETUP_NOT_READY"
  | "PROVIDER_RESUME_FAILED";

export interface WorkerResumeEligibility {
  readonly providerSupportsResume: boolean;
  readonly providerIdentityMatches: boolean;
  readonly authenticationVerified: boolean;
  readonly privacyAuthorized: boolean;
  readonly authorityVerified: boolean;
  readonly setupReady: boolean;
}

export interface FreshWorkerSessionContext {
  readonly checkpointId: string;
  readonly taskId: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly goalSummary: string;
  readonly completedWork: readonly string[];
  readonly decisions: readonly string[];
  readonly findings: readonly string[];
  readonly artifacts: WorkerCheckpoint["artifacts"];
  readonly verificationState: WorkerCheckpoint["verificationState"];
  readonly currentActivity: string;
  readonly nextStep?: string;
  readonly blockers: readonly string[];
  readonly liveStateAssumptions: readonly string[];
}

export interface WorkerRecoveryPlan {
  readonly strategy: WorkerRecoveryStrategy;
  readonly reason: WorkerRecoveryReason;
  readonly context: FreshWorkerSessionContext;
  readonly providerResume?: ProviderResumeReference;
}
