import type { WorkerCheckpoint } from "./worker.ts";
import type { FreshWorkerSessionContext, WorkerRecoveryPlan, WorkerResumeEligibility } from "./worker-recovery.ts";
import { validateWorkerCheckpoint } from "./worker-runtime.mjs";

function context(checkpoint: WorkerCheckpoint): FreshWorkerSessionContext {
  return Object.freeze({
    checkpointId: checkpoint.checkpointId,
    taskId: checkpoint.taskId,
    attemptId: checkpoint.attemptId,
    sequence: checkpoint.sequence,
    createdAt: checkpoint.createdAt,
    goalSummary: checkpoint.goalSummary,
    completedWork: checkpoint.completedWork,
    decisions: checkpoint.decisions,
    findings: checkpoint.findings,
    artifacts: checkpoint.artifacts,
    verificationState: checkpoint.verificationState,
    currentActivity: checkpoint.currentActivity,
    ...(checkpoint.nextStep === undefined ? {} : { nextStep: checkpoint.nextStep }),
    blockers: checkpoint.blockers,
    liveStateAssumptions: checkpoint.liveStateAssumptions,
  });
}

function fresh(checkpoint: WorkerCheckpoint, reason: WorkerRecoveryPlan["reason"]): WorkerRecoveryPlan {
  return Object.freeze({ strategy: "FRESH_SESSION", reason, context: context(checkpoint) });
}

function allResumeGatesPass(eligibility: WorkerResumeEligibility | undefined): boolean {
  return eligibility !== undefined
    && eligibility.providerSupportsResume === true
    && eligibility.providerIdentityMatches === true
    && eligibility.authenticationVerified === true
    && eligibility.privacyAuthorized === true
    && eligibility.authorityVerified === true
    && eligibility.setupReady === true;
}

function firstFailedResumeGate(eligibility: WorkerResumeEligibility | undefined): WorkerRecoveryPlan["reason"] {
  if (!eligibility?.providerSupportsResume) return "PROVIDER_RESUME_UNSUPPORTED";
  if (!eligibility.providerIdentityMatches) return "PROVIDER_IDENTITY_MISMATCH";
  if (!eligibility.authenticationVerified) return "AUTHENTICATION_NOT_VERIFIED";
  if (!eligibility.privacyAuthorized) return "PRIVACY_NOT_AUTHORIZED";
  if (!eligibility.authorityVerified) return "AUTHORITY_NOT_VERIFIED";
  if (!eligibility.setupReady) return "SETUP_NOT_READY";
  return "PROVIDER_RESUME_UNSUPPORTED";
}

export function planWorkerRecovery(checkpointValue: unknown, eligibility?: WorkerResumeEligibility): WorkerRecoveryPlan {
  const checkpoint = validateWorkerCheckpoint(checkpointValue);
  if (checkpoint.providerResume === undefined) return fresh(checkpoint, "NO_RESUME_REFERENCE");
  if (!allResumeGatesPass(eligibility)) return fresh(checkpoint, firstFailedResumeGate(eligibility));
  return Object.freeze({
    strategy: "PROVIDER_RESUME",
    reason: "PROVIDER_RESUME_ELIGIBLE",
    context: context(checkpoint),
    providerResume: checkpoint.providerResume,
  });
}

export function fallbackToFreshWorkerSession(plan: WorkerRecoveryPlan): WorkerRecoveryPlan {
  if (plan.strategy === "FRESH_SESSION") return plan;
  return Object.freeze({ strategy: "FRESH_SESSION", reason: "PROVIDER_RESUME_FAILED", context: plan.context });
}
