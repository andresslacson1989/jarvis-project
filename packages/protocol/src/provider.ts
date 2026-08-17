import type { PlatformCompatibility, PlatformPathRef, PlatformRuntimeIdentity } from "./platform.js";
import type { StructuredAiOutputV1 } from "./content-authority.js";
import type { DataPolicy } from "./data.js";
import type { ProviderSetupQualificationPlan } from "./provider-setup-plan.js";

export type ProviderSetupState = "NOT_REQUIRED" | "SETUP_REQUIRED" | "SETUP_IN_PROGRESS" | "SETUP_READY" | "REPAIR_REQUIRED" | "SETUP_FAILED";
export type ProviderCompatibilityState = "NOT_DETECTED" | "VERSION_UNKNOWN" | "VERSION_UNSUPPORTED" | "CONFORMANCE_UNQUALIFIED" | "COMPATIBLE";
export type ProviderHealth = "STARTING" | "READY" | "DEGRADED" | "UNAVAILABLE" | "FAILED";
export type ProviderExecutionMode = "ONE_SHOT" | "WARM" | "PERSISTENT" | "STREAMING" | "RESUMABLE" | "LOCAL_SERVER";
export type ProviderLifecycleState = "DISCOVERED" | "STARTING" | "READY" | "DEGRADED" | "STOPPING" | "STOPPED" | "FAILED" | "CANCELLED";

export interface ProviderCapabilityContract {
  readonly capabilityId: string;
  readonly executionModes: readonly ProviderExecutionMode[];
  readonly locality: "LOCAL" | "CLOUD" | "LAN";
  readonly supportsCancellation: boolean;
  readonly supportsResumption: boolean;
}

export interface ProviderAdapterContract {
  readonly providerId: string;
  readonly adapterType: string;
  readonly adapterVersion: string;
  readonly executionModes: readonly ProviderExecutionMode[];
  readonly lifecycleStates: readonly ProviderLifecycleState[];
  readonly capabilities: readonly ProviderCapabilityContract[];
  readonly startupTimeoutMs: number;
  readonly executionTimeoutMs: number;
  readonly cancellation: "COOPERATIVE_ONLY" | "COOPERATIVE_THEN_FORCE" | "UNSUPPORTED";
}

export interface ProviderCapabilities {
  readonly naturalLanguage?: boolean;
  readonly structuredOutput?: boolean;
  readonly toolUse?: boolean;
  readonly coding?: boolean;
  readonly research?: boolean;
  readonly vision?: boolean;
  readonly streaming?: boolean;
  readonly resumableSession?: boolean;
  readonly maxContextTokens?: number;
  readonly locality: "LOCAL" | "CLOUD" | "LAN";
}

export interface ProviderResourceProfile {
  readonly memoryMb?: number;
  readonly gpuVramMb?: number;
  readonly cpuClass?: "LOW" | "MEDIUM" | "HIGH";
  readonly gpuRequired?: boolean;
  readonly warmupMs?: number;
  readonly unloadable?: boolean;
}

export interface ProviderProfile {
  readonly providerId: string;
  readonly adapterType: string;
  readonly adapterVersion: string;
  readonly providerVersion?: string;
  readonly modelId?: string;
  readonly platform: PlatformRuntimeIdentity;
  readonly setup: ProviderSetupState;
  readonly compatibility: ProviderCompatibilityState;
  readonly capabilities: ProviderCapabilities;
  readonly costClass: "FREE" | "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  readonly latencyClass: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  readonly health: ProviderHealth;
  readonly resources?: ProviderResourceProfile;
}

export type ProviderWorkRole = "GENERALIST" | "SOFTWARE_ENGINEER" | "VERIFIER" | "SYNTHESIZER";
export type ProviderCapabilityName = "naturalLanguage" | "structuredOutput" | "toolUse" | "coding" | "research" | "vision" | "streaming" | "resumableSession";

export interface ProviderRoleProfileV1 {
  readonly domain: "jarvis.provider-role-profile.v1";
  readonly schemaVersion: 1;
  readonly role: ProviderWorkRole;
  readonly requiredCapabilities: readonly ProviderCapabilityName[];
  readonly preferredExecutionModes: readonly ProviderExecutionMode[];
  readonly maxIterations: number;
}

export interface ProviderRoutingRequestV1 {
  readonly domain: "jarvis.provider-routing-request.v1";
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly role: ProviderWorkRole;
  readonly platform: PlatformRuntimeIdentity;
  readonly dataPolicy: DataPolicy;
  readonly requiredCapabilities?: readonly ProviderCapabilityName[];
  readonly executionMode?: ProviderExecutionMode;
  readonly allowedProviderIds?: readonly string[];
}

export interface ProviderRoutingCandidateV1 {
  readonly profile: ProviderProfile;
  readonly adapter: ProviderAdapterContract;
  readonly setup: ProviderSetupRecord;
  readonly qualification: ProviderQualificationRecord;
}

export type ProviderRoutingRejectionCode =
  | "PROVIDER_NOT_ALLOWED"
  | "IDENTITY_MISMATCH"
  | "SETUP_NOT_READY"
  | "SETUP_EVIDENCE_MISSING"
  | "COMPATIBILITY_NOT_READY"
  | "HEALTH_NOT_READY"
  | "QUALIFICATION_NOT_READY"
  | "QUALIFICATION_EVIDENCE_MISSING"
  | "CAPABILITY_MISSING"
  | "EXECUTION_MODE_UNSUPPORTED"
  | "LOCALITY_NOT_ALLOWED"
  | "PLATFORM_NOT_SUPPORTED";

export interface ProviderRoutingCandidateResultV1 {
  readonly providerId: string;
  readonly eligible: boolean;
  readonly rejectionCodes: readonly ProviderRoutingRejectionCode[];
}

export interface ProviderRoutingResultV1 {
  readonly domain: "jarvis.provider-routing-result.v1";
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly role: ProviderWorkRole;
  readonly outcome: "SELECTED" | "NO_MATCH";
  readonly selectedProviderId?: string;
  readonly selectedExecutionMode?: ProviderExecutionMode;
  readonly candidates: readonly ProviderRoutingCandidateResultV1[];
}

export interface ProviderCompatibilityPolicy {
  readonly providerId: string;
  readonly adapterVersion: string;
  readonly platformCompatibility: readonly PlatformCompatibility[];
  readonly acceptedVersions: readonly ({ kind: "EXACT" | "RANGE"; version?: string; range?: string })[];
  readonly deniedVersions?: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly conformanceProfileId: string;
  readonly setupPolicyId?: string;
  readonly distributionPolicy?: ProviderDistributionPolicy;
}

export interface ProviderExecutableIdentity {
  readonly kind: "MAIN_EXECUTABLE" | "SETUP_HELPER";
  readonly fileName: string;
  readonly canonicalPath: PlatformPathRef;
  readonly sha256?: string;
  readonly fileVersion?: string;
  readonly productVersion?: string;
  readonly publisher?: string;
}

export interface ProviderDistributionIdentity {
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
  readonly interfaceId: string;
  readonly platform: PlatformRuntimeIdentity;
  readonly osVersion?: string;
  readonly providerVersion?: string;
  readonly executable: ProviderExecutableIdentity;
  readonly setupHelper?: ProviderExecutableIdentity;
  readonly discoveredAt: string;
}

export interface ProviderDistributionPolicy {
  readonly distributionIds: readonly string[];
  readonly interfaceIds: readonly string[];
  readonly executableFileNames: readonly string[];
  readonly executableSha256?: readonly string[];
  readonly setupHelperFileNames?: readonly string[];
  readonly setupHelperSha256?: readonly string[];
}

export type ProviderDistributionCompatibilityReason =
  | "PROVIDER_ID_MISMATCH"
  | "ADAPTER_VERSION_MISMATCH"
  | "PLATFORM_UNSUPPORTED"
  | "DISTRIBUTION_POLICY_MISSING"
  | "DISTRIBUTION_UNSUPPORTED"
  | "INTERFACE_UNSUPPORTED"
  | "EXECUTABLE_UNSUPPORTED"
  | "SETUP_HELPER_UNSUPPORTED"
  | "VERSION_MISSING"
  | "VERSION_DENIED"
  | "VERSION_UNSUPPORTED"
  | "VERSION_RANGE_UNDERSTOOD"
  | "VERSION_RANGE_UNKNOWN"
  | "QUALIFICATION_MISSING"
  | "QUALIFICATION_MISMATCH"
  | "COMPATIBLE";

export interface ProviderDistributionCompatibilityResult {
  readonly state: ProviderCompatibilityState;
  readonly reason: ProviderDistributionCompatibilityReason;
  readonly matchedVersionRule?: string;
}

export type ProviderNormalizedErrorCode =
  | "STARTUP_TIMEOUT"
  | "EXECUTION_TIMEOUT"
  | "CANCELLED"
  | "SETUP_REQUIRED"
  | "INCOMPATIBLE"
  | "UNAVAILABLE"
  | "INVALID_OUTPUT"
  | "PROVIDER_FAILURE"
  | "AUTH_REQUIRED"
  | "CONTAINMENT_FAILURE"
  | "UNKNOWN";

export interface ProviderNormalizedError {
  readonly code: ProviderNormalizedErrorCode;
  readonly retryable: boolean;
  readonly safeMessage: string;
  readonly providerCode?: string;
}

export type ProviderAdapterEventType = "STARTED" | "OUTPUT_RECEIVED" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface ProviderAdapterEvent {
  readonly domain: "jarvis.provider-event.v1";
  readonly schemaVersion: 1;
  readonly eventId: string;
  readonly requestId: string;
  readonly providerId: string;
  readonly sequence: number;
  readonly type: ProviderAdapterEventType;
  readonly occurredAt: string;
  readonly safeMessage?: string;
  readonly error?: ProviderNormalizedError;
}

export interface ProviderAdapterResult {
  readonly domain: "jarvis.provider-result.v1";
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
  readonly executionMode: ProviderExecutionMode;
  readonly completedAt: string;
  readonly output?: StructuredAiOutputV1;
  readonly error?: ProviderNormalizedError;
}

export type ProviderSetupWorkflowAction =
  | "DISCOVERY_REQUIRES_SETUP"
  | "DISCOVERY_REQUIRES_REPAIR"
  | "AUTHENTICATED_USER_START"
  | "HELPER_EXITED"
  | "SETUP_PROBE_PASSED"
  | "SETUP_PROBE_FAILED"
  | "CANCELLED"
  | "PROVIDER_UPDATED";

export interface ProviderSetupTransitionResult {
  readonly previousState: ProviderSetupState;
  readonly action: ProviderSetupWorkflowAction;
  readonly nextState: ProviderSetupState;
  readonly requiresAuthenticatedUser: boolean;
  readonly readyVerified: boolean;
}

export interface ProviderSetupStartRequest {
  readonly requestId: string;
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
  readonly action: "AUTHENTICATED_USER_START";
}

export interface ProviderSetupPresentation {
  readonly state: ProviderSetupState;
  readonly userActionRequired: boolean;
  readonly ready: boolean;
  readonly reason: string;
}

export interface ProviderSetupRecord {
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
  readonly providerVersion?: string;
  readonly setupPolicyId?: string;
  readonly state: ProviderSetupState;
  readonly lastAttemptAt?: string;
  readonly lastAttemptOutcome?: string;
  readonly sanitizedFailureReason?: string;
  readonly lastVerifiedAt?: string;
  readonly conformanceEvidenceRef?: string;
}

export interface ProviderQualificationRecord {
  readonly providerId: string;
  readonly distributionId: string;
  readonly providerVersion?: string;
  readonly state: "UNQUALIFIED" | "QUALIFIED" | "EXPIRED" | "REVOKED";
  readonly evidenceRef?: string;
  readonly verifiedAt?: string;
  readonly setupPlan?: ProviderSetupQualificationPlan;
}

export type ModuleExecutionClass = "DATA_ONLY" | "BUILT_IN_TRUSTED" | "EXTERNAL_MANAGED";
export interface ModuleManifest {
  readonly moduleId: string;
  readonly version: string;
  readonly displayName: string;
  readonly publisher: string;
  readonly source: string;
  readonly executionClass: ModuleExecutionClass;
  readonly compatibility: { readonly jarvis: string; readonly platforms: readonly PlatformCompatibility[] };
  readonly capabilities: readonly string[];
  readonly requestedPermissions: readonly string[];
  readonly networkBehavior: readonly string[];
  readonly resourceHints?: { readonly memoryMb?: number; readonly gpuVramMb?: number; readonly cpuClass?: "LOW" | "MEDIUM" | "HIGH" };
  readonly healthCheck: { readonly kind: "PROCESS_READY" | "IPC_PROBE" | "HTTP_LOCAL_PROBE"; readonly timeoutMs: number; readonly method?: string; readonly endpointId?: string };
  readonly integrity: { readonly sha256: string; readonly signature?: string; readonly catalogEntryId: string; readonly catalogSignature: string; readonly catalogKeyId: string };
  readonly lifecycle: { readonly activationBoundary: "SAFE_BOUNDARY" | "APP_RESTART"; readonly rollbackSupported: boolean; readonly retainsPreviousVersion: boolean };
}

export interface IntegrationAccount {
  readonly integrationId: string;
  readonly accountId: string;
  readonly displayName: string;
  readonly tenantOrDomain?: string;
  readonly credentialHandle: string;
  readonly enabledCapabilities: readonly string[];
  readonly grantedScopes: readonly string[];
  readonly status: "CONNECTED" | "DEGRADED" | "REAUTH_REQUIRED" | "DISABLED" | "ERROR";
  readonly lastVerifiedAt?: string;
}

export interface ProxmoxConnection {
  readonly connectionId: string;
  readonly displayName: string;
  readonly endpoint: string;
  readonly credentialHandle: string;
  readonly tlsTrust: { readonly mode: "SYSTEM_CA" } | { readonly mode: "PINNED_SHA256"; readonly fingerprint: string };
  readonly environmentId: string;
  readonly enabledCapabilities: readonly string[];
  readonly allowedNodes?: readonly string[];
  readonly allowedVmids?: readonly number[];
  readonly allowedPools?: readonly string[];
  readonly status: "CONNECTED" | "DEGRADED" | "REAUTH_REQUIRED" | "DISABLED" | "ERROR";
  readonly lastVerifiedAt?: string;
}
