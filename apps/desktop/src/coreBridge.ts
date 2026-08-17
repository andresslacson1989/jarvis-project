import { invoke } from "@tauri-apps/api/core";
import type {
  CoreStatusResponse,
  AuthenticatedTextConversationInputV1,
  SessionSecurityState,
  UUIDv7,
} from "../../../packages/protocol/src/index";
import type { ToolRequest, ToolResult } from "../../../packages/protocol/src/tool";

export interface CoreBridgeRequest {
  readonly protocolVersion: 1;
  readonly correlationId: UUIDv7;
}

export interface ProviderSetupStartRequest {
  readonly requestId: UUIDv7;
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
}

export interface ProviderSetupStartResponse {
  readonly requestId: UUIDv7;
  /**
   * The native command performs the authenticated setup and readiness probe
   * synchronously, so a successful response may already be SETUP_READY. Keep
   * SETUP_IN_PROGRESS valid for a provider boundary that reports the initial
   * transition before completion.
   */
  readonly state: "SETUP_IN_PROGRESS" | "SETUP_READY";
}

export interface ProviderSetupStatusRecord {
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
  readonly state: "NOT_REQUIRED" | "SETUP_REQUIRED" | "SETUP_IN_PROGRESS" | "SETUP_READY" | "REPAIR_REQUIRED" | "SETUP_FAILED";
  readonly providerVersion?: string;
  readonly setupPolicyId?: string;
  readonly lastAttemptAt?: string;
  readonly lastAttemptOutcome?: string;
  readonly sanitizedFailureReason?: string;
  readonly lastVerifiedAt?: string;
  readonly conformanceEvidenceRef?: string;
  readonly compatibility?: "NOT_DETECTED" | "VERSION_UNKNOWN" | "VERSION_UNSUPPORTED" | "CONFORMANCE_UNQUALIFIED" | "COMPATIBLE";
  readonly health?: "STARTING" | "READY" | "DEGRADED" | "UNAVAILABLE" | "FAILED";
  readonly qualificationState?: "UNQUALIFIED" | "QUALIFIED" | "EXPIRED" | "REVOKED";
  readonly qualificationEvidenceRef?: string;
  readonly locality?: "LOCAL" | "CLOUD" | "LAN";
  readonly capabilities?: readonly { readonly capabilityId: string; readonly supported: boolean }[];
  readonly supportState?: "SUPPORTED" | "SETUP_REQUIRED" | "QUALIFICATION_REQUIRED" | "HEALTH_UNAVAILABLE" | "UNSUPPORTED";
}

export interface SessionStatusResponse {
  readonly initialized: boolean;
  readonly state: SessionSecurityState | null;
}

export interface SessionAuthenticationResponse {
  readonly status: "UNLOCKED" | "DENIED" | "COOLDOWN";
  readonly retryAfterMs: number;
  readonly state: SessionSecurityState;
}

export async function processAuthenticatedText(input: AuthenticatedTextConversationInputV1): Promise<unknown> {
  const response: unknown = await invoke("process_authenticated_text", {
    request: {
      requestId: input.instruction.id,
      instruction: input.instruction,
      context: input.context,
      dataPolicy: input.dataPolicy,
    },
  });
  if (!isRecord(response)) throw new Error("native conversation response failed runtime validation");
  return response;
}

/**
 * Renderer callers can request a tool only through the typed native bridge.
 * Core remains the authority for validation, admission, execution, and audit;
 * this boundary verifies that the returned result belongs to the request.
 */
export async function executeTool(input: ToolRequest): Promise<ToolResult> {
  const response: unknown = await invoke("execute_tool", { request: { toolRequest: input } });
  if (!isToolResult(response) || response.toolExecutionId !== input.toolExecutionId) {
    throw new Error("native tool result failed runtime validation");
  }
  return response;
}

export async function requestProviderSetupStart(request: ProviderSetupStartRequest): Promise<ProviderSetupStartResponse> {
  const response: unknown = await invoke("start_provider_setup", { request });
  if (!isProviderSetupStartResponse(response)) {
    throw new Error("native provider setup response failed runtime validation");
  }
  return response;
}

export async function requestProviderSetupStatus(): Promise<readonly ProviderSetupStatusRecord[]> {
  const response: unknown = await invoke("get_provider_setup_status");
  if (!Array.isArray(response) || !response.every(isProviderSetupStatusRecord)) {
    throw new Error("native provider setup status failed runtime validation");
  }
  return response;
}

export async function requestSessionStatus(): Promise<SessionStatusResponse> {
  const response: unknown = await invoke("get_session_status");
  if (!isSessionStatusResponse(response)) {
    throw new Error("native session status response failed runtime validation");
  }
  return response;
}

export async function initializeSession(password: string): Promise<SessionStatusResponse> {
  const response: unknown = await invoke("initialize_session", { request: { password } });
  if (!isSessionStatusResponse(response)) {
    throw new Error("native session initialization response failed runtime validation");
  }
  return response;
}

export async function authenticateSession(password: string): Promise<SessionAuthenticationResponse> {
  const response: unknown = await invoke("authenticate_session", { request: { password } });
  if (!isSessionAuthenticationResponse(response)) {
    throw new Error("native session authentication response failed runtime validation");
  }
  return response;
}

/**
 * Typed UI → Rust boundary stub. The renderer never opens Core IPC directly;
 * Rust owns the native hop and currently returns the truthful locked state.
 */
export async function requestCoreStatus(correlationId: UUIDv7): Promise<CoreStatusResponse> {
  const request: CoreBridgeRequest = { protocolVersion: 1, correlationId };
  const response: unknown = await invoke("get_core_status", { request });
  if (!isCoreStatusResponse(response)) {
    throw new Error("native Core status response failed runtime validation");
  }
  return response;
}

function isCoreStatusResponse(value: unknown): value is CoreStatusResponse {
  if (!isRecord(value)) return false;
  if (value.ok === false) {
    return Object.keys(value).sort().join(",") === "error,ok" && isJarvisError(value.error);
  }
  return (
    Object.keys(value).sort().join(",") === "ok,result" &&
    value.ok === true &&
    isCoreServiceStatus(value.result)
  );
}

function isProviderSetupStartResponse(value: unknown): value is ProviderSetupStartResponse {
  return isRecord(value) && Object.keys(value).sort().join(",") === "requestId,state" && isUuidV7(value.requestId) && (value.state === "SETUP_IN_PROGRESS" || value.state === "SETUP_READY");
}

function isProviderSetupStatusRecord(value: unknown): value is ProviderSetupStatusRecord {
  if (!isRecord(value) || typeof value.providerId !== "string" || typeof value.distributionId !== "string" || typeof value.adapterVersion !== "string" || !["NOT_REQUIRED", "SETUP_REQUIRED", "SETUP_IN_PROGRESS", "SETUP_READY", "REPAIR_REQUIRED", "SETUP_FAILED"].includes(value.state as string)) return false;
  const strings = ["providerVersion", "setupPolicyId", "lastAttemptAt", "lastAttemptOutcome", "sanitizedFailureReason", "lastVerifiedAt", "conformanceEvidenceRef", "compatibility", "health", "qualificationState", "qualificationEvidenceRef", "locality", "supportState"];
  if (strings.some((key) => value[key] !== undefined && typeof value[key] !== "string")) return false;
  if (value.compatibility !== undefined && !["NOT_DETECTED", "VERSION_UNKNOWN", "VERSION_UNSUPPORTED", "CONFORMANCE_UNQUALIFIED", "COMPATIBLE"].includes(value.compatibility as string)) return false;
  if (value.health !== undefined && !["STARTING", "READY", "DEGRADED", "UNAVAILABLE", "FAILED"].includes(value.health as string)) return false;
  if (value.qualificationState !== undefined && !["UNQUALIFIED", "QUALIFIED", "EXPIRED", "REVOKED"].includes(value.qualificationState as string)) return false;
  if (value.locality !== undefined && !["LOCAL", "CLOUD", "LAN"].includes(value.locality as string)) return false;
  if (value.supportState !== undefined && !["SUPPORTED", "SETUP_REQUIRED", "QUALIFICATION_REQUIRED", "HEALTH_UNAVAILABLE", "UNSUPPORTED"].includes(value.supportState as string)) return false;
  return value.capabilities === undefined || (Array.isArray(value.capabilities) && value.capabilities.every((capability) => isRecord(capability) && typeof capability.capabilityId === "string" && typeof capability.supported === "boolean"));
}

function isSessionStatusResponse(value: unknown): value is SessionStatusResponse {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "initialized,state" || typeof value.initialized !== "boolean") return false;
  if (value.state === null) return value.initialized === false;
  if (!value.initialized || !isRecord(value.state)) return false;
  return isSessionSecurityState(value.state);
}

function isSessionAuthenticationResponse(value: unknown): value is SessionAuthenticationResponse {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "retryAfterMs,state,status" || !["UNLOCKED", "DENIED", "COOLDOWN"].includes(value.status as string) || typeof value.retryAfterMs !== "number" || !Number.isSafeInteger(value.retryAfterMs) || value.retryAfterMs < 0 || !isRecord(value.state)) return false;
  return isSessionSecurityState(value.state);
}

function isSessionSecurityState(value: unknown): value is SessionSecurityState {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "cooldownUntil,failedUnlockAttempts,lockedReason,sessionId,state,unlockedAt,userId") return false;
  if (typeof value.userId !== "string" || value.userId.length === 0 || value.userId.length > 256) return false;
  if (!("LOCKED" === value.state || "UNLOCKING" === value.state || "UNLOCKED" === value.state || "LOCKING" === value.state)) return false;
  if (!(value.sessionId === null || isUuidV7(value.sessionId))) return false;
  if (!(value.unlockedAt === null || typeof value.unlockedAt === "string")) return false;
  if (!(value.lockedReason === null || ["STARTUP", "USER", "OS_SESSION_LOCK", "OS_SESSION_END", "IDLE", "SECURITY"].includes(value.lockedReason as string))) return false;
  if (typeof value.failedUnlockAttempts !== "number" || !Number.isSafeInteger(value.failedUnlockAttempts) || value.failedUnlockAttempts < 0 || value.failedUnlockAttempts > 31) return false;
  if (!(value.cooldownUntil === null || typeof value.cooldownUntil === "string")) return false;
  return value.state === "UNLOCKED"
    ? value.sessionId !== null && value.unlockedAt !== null && value.lockedReason === null
    : value.unlockedAt === null && (value.state !== "LOCKED" || value.lockedReason !== null);
}

function isCoreServiceStatus(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    Object.keys(value).sort().join(",") !==
    "architecture,platform,protocolMajor,runtimeRole,serviceState,transportState"
  ) return false;
  return (
    value.protocolMajor === 1 &&
    value.platform === "WINDOWS" &&
    value.runtimeRole === "FULL_HOST" &&
    value.architecture === "x64" &&
    value.serviceState === "LOCKED" &&
    value.transportState === "NOT_CONNECTED"
  );
}

function isJarvisError(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.some((key) => !["category", "code", "correlationId", "details", "message", "retryable"].includes(key))) {
    return false;
  }
  const categories = new Set([
    "VALIDATION",
    "AUTHENTICATION",
    "AUTHORIZATION",
    "NOT_FOUND",
    "CONFLICT",
    "PRECONDITION",
    "POSTCONDITION",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_FAILED",
    "TOOL_FAILED",
    "TIMEOUT",
    "CANCELLED",
    "BUDGET",
    "RESOURCE",
    "INTEGRITY",
    "RECOVERY_REQUIRED",
    "UNSUPPORTED",
    "INTERNAL",
  ]);
  return (
    typeof value.code === "string" &&
    typeof value.category === "string" &&
    categories.has(value.category) &&
    typeof value.message === "string" &&
    typeof value.retryable === "boolean" &&
    isUuidV7(value.correlationId) &&
    (value.details === undefined || isRecord(value.details))
  );
}

function isToolResult(value: unknown): value is ToolResult {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  const allowed = new Set(["toolExecutionId", "outcome", "output", "artifacts", "preconditions", "postconditions", "error", "startedAt", "endedAt"]);
  if (keys.some((key) => !allowed.has(key))) return false;
  if (!isUuidV7(value.toolExecutionId) || !["SUCCEEDED", "FAILED", "DENIED", "CANCELLED", "UNCERTAIN"].includes(value.outcome as string)) return false;
  if (typeof value.startedAt !== "string" || Number.isNaN(Date.parse(value.startedAt)) || typeof value.endedAt !== "string" || Number.isNaN(Date.parse(value.endedAt))) return false;
  if (value.output !== undefined && !isRecord(value.output)) return false;
  if (value.artifacts !== undefined && !Array.isArray(value.artifacts)) return false;
  if (value.preconditions !== undefined && !Array.isArray(value.preconditions)) return false;
  if (value.postconditions !== undefined && !Array.isArray(value.postconditions)) return false;
  return value.error === undefined || isJarvisError(value.error);
}

function isUuidV7(value: unknown): value is UUIDv7 {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
