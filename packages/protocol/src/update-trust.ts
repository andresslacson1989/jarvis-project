export interface TrustedUpdateRoleMetadata {
  readonly version: string;
  readonly sha256: string;
  readonly keyIds: readonly string[];
  readonly threshold: number;
  readonly custodyClass: string;
}

export interface TrustedUpdateMetadataRecord {
  readonly metadataId: string;
  readonly tufSpecVersion: "1.0.35";
  readonly trustedRootVersion: string;
  readonly trustedRootSha256: string;
  readonly roles: Readonly<{
    root: TrustedUpdateRoleMetadata;
    targets: TrustedUpdateRoleMetadata;
    snapshot: TrustedUpdateRoleMetadata;
    timestamp: TrustedUpdateRoleMetadata;
    modules: TrustedUpdateRoleMetadata;
  }>;
  readonly metadataVersion: string;
  readonly metadataSha256: string;
  readonly minimumSecurityEpoch: string;
  readonly observedAt: string;
  readonly expiresAt: string;
  readonly state: "TRUSTED" | "STALE" | "UNAVAILABLE" | "DEGRADED";
}

export interface ReleaseTrustRecord {
  readonly releaseId: string;
  readonly jarvisVersion: string;
  readonly releaseSequence: string;
  readonly securityEpoch: string;
  readonly platform: string;
  readonly runtimeRole: string;
  readonly architecture: string;
  readonly sourceCommitSha: string;
  readonly artifactSha256: string;
  readonly tufTargetPath: string;
  readonly tufTargetMetadataVersion: string;
  readonly rollbackPolicy: "NORMAL_ONLY" | "EXPLICIT_TRUSTED_TARGET";
  readonly revoked: boolean;
}

export type UpdateIncidentReason = "UPDATE_TRUST_METADATA_EXPIRED" | "UPDATE_ROOT_ROTATION_REQUIRED" | "UPDATE_SIGNATURE_INVALID" | "UPDATE_TARGET_REVOKED" | "UPDATE_ROLLBACK_BLOCKED" | "UPDATE_SECURITY_EPOCH_BLOCKED" | "UPDATE_TRUST_ROOT_COMPROMISE_SUSPECTED" | "MODULE_TARGET_REVOKED" | "CATALOG_TRUST_UNAVAILABLE";

export interface UpdateIncidentRecord {
  readonly incidentId: string;
  readonly reason: UpdateIncidentReason;
  readonly releaseId?: string;
  readonly observedAt: string;
  readonly details: string;
}

export interface UpdateOperationRecord {
  readonly operationId: string;
  readonly kind: "BACKUP" | "UPDATE" | "RECOVERY";
  readonly state: "STARTED" | "STAGED" | "VERIFIED" | "COMMITTED" | "FAILED" | "UNCERTAIN";
  readonly metadataRef?: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly failureReason?: string;
}
