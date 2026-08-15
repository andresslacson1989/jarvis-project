import { invoke } from "@tauri-apps/api/core";
import type {
  CoreStatusResponse,
  UUIDv7,
} from "../../../packages/protocol/src/index";

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
  readonly state: "SETUP_IN_PROGRESS";
}

export interface ProviderSetupStatusRecord {
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
  readonly state: "NOT_REQUIRED" | "SETUP_REQUIRED" | "SETUP_IN_PROGRESS" | "SETUP_READY" | "REPAIR_REQUIRED" | "SETUP_FAILED";
  readonly sanitizedFailureReason?: string;
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
  return isRecord(value) && Object.keys(value).sort().join(",") === "requestId,state" && isUuidV7(value.requestId) && value.state === "SETUP_IN_PROGRESS";
}

function isProviderSetupStatusRecord(value: unknown): value is ProviderSetupStatusRecord {
  return isRecord(value) && typeof value.providerId === "string" && typeof value.distributionId === "string" && typeof value.adapterVersion === "string" && ["NOT_REQUIRED", "SETUP_REQUIRED", "SETUP_IN_PROGRESS", "SETUP_READY", "REPAIR_REQUIRED", "SETUP_FAILED"].includes(value.state as string) && (value.sanitizedFailureReason === undefined || typeof value.sanitizedFailureReason === "string");
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

function isUuidV7(value: unknown): value is UUIDv7 {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
