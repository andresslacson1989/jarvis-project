import type { DataPolicy } from "./data.js";

export interface ArtifactRecord {
  readonly artifactId: string;
  readonly logicalType: string;
  readonly contentType: string;
  readonly size: number;
  readonly sha256?: string;
  readonly producingAttemptId: string;
  readonly projectId?: string;
  readonly dataPolicy: DataPolicy;
  readonly retention: string;
  readonly storageRef: string;
}

export interface ProviderResumeReference {
  readonly providerId: string;
  readonly providerVersion?: string;
  readonly modelId?: string;
  readonly handle: string;
  readonly createdAt: string;
  readonly lastVerifiedAt?: string;
}

export interface WorkerCheckpoint {
  readonly checkpointId: string;
  readonly taskId: string;
  readonly attemptId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly goalSummary: string;
  readonly completedWork: readonly string[];
  readonly decisions: readonly string[];
  readonly findings: readonly string[];
  readonly artifacts: readonly ArtifactRecord[];
  readonly verificationState: readonly Record<string, unknown>[];
  readonly currentActivity: string;
  readonly nextStep?: string;
  readonly blockers: readonly string[];
  readonly liveStateAssumptions: readonly string[];
  readonly providerResume?: ProviderResumeReference;
}

export interface LeaseRecord {
  readonly leaseId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ownerInstanceId: string;
  readonly ownerTaskId?: string;
  readonly ownerAttemptId?: string;
  readonly leaseType: string;
  readonly state: "ACTIVE" | "RELEASED" | "RECOVERY_REQUIRED";
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
}
