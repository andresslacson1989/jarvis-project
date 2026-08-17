import { lstat, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";
import type { IpcEnvelope, IpcResponse } from "../../../packages/protocol/src/ipc.js";
import type { JarvisError } from "../../../packages/protocol/src/errors.js";
import { validateToolRequest } from "../../../packages/protocol/src/tool-runtime.mjs";
import type { ToolResult } from "../../../packages/protocol/src/tool.ts";
import type { ProjectStatusSnapshot, ProjectPolicyStatus } from "../../../packages/protocol/src/tool-status.mjs";
import { createCoreToolRuntime, createFailClosedCoreToolRuntime, CoreToolRuntime } from "./tool-runtime.mjs";
import { createNativeToolPlatformBoundaries, CoreNativeCapabilityClient } from "./native-capability.mjs";
import type { ToolCriterionResult } from "../../../packages/protocol/src/tool.ts";
import type {
  CoreServiceStatus,
  CoreStatusResponse,
} from "../../../packages/protocol/src/core.js";
import { validateProviderSetupStartRequest } from "../../../packages/protocol/src/provider-runtime.mjs";
import type { ProviderSetupStatusView } from "./schema.js";
import { runQualifiedCodexConversation } from "../../../providers/ai/src/codex-cli-adapter.mjs";
import { ConversationService, ConversationServiceError, type ConversationPipelineResult } from "./conversation.mjs";
import { admitReleaseRuntime, type ReleaseTrustAdmission } from "./release-trust.js";
import {
  CorePersistenceError,
  openCoreDatabase,
  type CoreDatabaseConnection,
} from "./persistence.js";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "./schema.js";
import type { SessionSecurityState } from "../../../packages/protocol/src/session.js";
import { validateAuthenticatedTextConversationInput } from "../../../packages/protocol/src/conversation-runtime.mjs";
import type { AuthenticatedTextConversationInputV1 } from "../../../packages/protocol/src/conversation.js";
import { admitPersistedProviderWorkspaceEngineeringRequest, routePersistedProviderForRoleWithAdmission, type ProviderRoutingAdmission, type ProviderWorkspaceEngineeringAdmission } from "./provider-routing.js";
import type { ProviderRoutingRequestV1, ProviderRoutingResultV1 } from "../../../packages/protocol/src/provider.js";
import {
  restoreVerifiedLocalBackup,
  restoreVerifiedPortableBackup,
  type RestoreVerifiedLocalBackupInputV1,
  type RestoreVerifiedPortableBackupInputV1,
  type RestoredPortableBackupV1,
} from "./backup-package.js";
import {
  authenticateCoreTransport,
  connectCoreTransport,
  CoreIpcBootstrapError,
  CoreIpcFrameReader,
  CORE_IPC_FRAME_CEILING,
  deriveNewSessionPasswordThroughNativeStorage,
  verifySessionPasswordThroughNativeStorage,
  unprotectLocalBackupDekThroughNativeStorage,
  protectNewDbDekThroughNativeStorage,
  encodeCoreIpcJsonFrame,
  readBootstrapMaterial,
  type BootstrapMaterial,
  type AuthenticatedTransport,
} from "./ipc-bootstrap.js";

export const CORE_PROTOCOL_MAJOR = 1 as const;
const QUALIFIED_CODEX_PROVIDER_ID = "codex-cli";
const QUALIFIED_CODEX_DISTRIBUTION_ID = "codex-cli-standalone-windows-x64-0.147.0";
const QUALIFIED_CODEX_ADAPTER_VERSION = "1.0.0";
export const CORE_PLATFORM = "WINDOWS" as const;
export const CORE_RUNTIME_ROLE = "FULL_HOST" as const;
export const CORE_ARCHITECTURE = "x64" as const;
const CORE_STATUS_REQUEST = "get_core_status" as const;
const SESSION_STATUS_REQUEST = "get_session_status" as const;
const SESSION_INITIALIZE_REQUEST = "initialize_session" as const;
const SESSION_AUTHENTICATE_REQUEST = "authenticate_session" as const;
const CONVERSATION_REQUEST = "process_authenticated_text" as const;
const TOOL_EXECUTION_REQUEST = "execute_tool" as const;

export function evaluateOpenTargetPostcondition(
  request: { readonly arguments: unknown },
  output: Readonly<Record<string, unknown>>,
  verifiedAt = new Date().toISOString(),
): ToolCriterionResult {
  const requestArguments = typeof request.arguments === "object" && request.arguments !== null && !Array.isArray(request.arguments)
    ? request.arguments as Record<string, unknown>
    : undefined;
  const targetKind = requestArguments?.targetKind;
  const outputTargetKind = output.targetKind;
  const targetIdentity = output.targetIdentity;
  const state = output.state;
  const passed = (targetKind === "PROJECT" || targetKind === "FILE")
    && outputTargetKind === targetKind
    && typeof targetIdentity === "string"
    && targetIdentity.length > 0
    && state === "OPEN_REQUESTED";
  return {
    criterionId: "target-open-requested",
    verdict: passed ? "PASS" : "UNKNOWN",
    evidence: [],
    summary: passed
      ? "Windows returned the exact qualified open target and OPEN_REQUESTED state"
      : "Windows did not return matching qualified open-target postcondition evidence",
    verifiedAt,
    verifierType: "LIVE_STATE",
  };
}

export type CoreBootstrapState = "STARTING" | "RECOVERY" | "READY" | "STOPPING" | "STOPPED";
export type CoreBootstrapFailureCode =
  | "CORE_RUNTIME_MISSING"
  | "CORE_RUNTIME_INTEGRITY_FAILED"
  | "CORE_RUNTIME_INCOMPATIBLE"
  | "CORE_ENTRYPOINT_MISSING"
  | "CORE_START_FAILED";

export interface CoreRuntimeEnvironment {
  readonly releaseRoot: string;
  readonly entrypoint: string;
  readonly tufMetadataDirectory: string;
  readonly releaseTrust: ReleaseTrustAdmission;
  readonly databasePath?: string;
  readonly recoveryMode: boolean;
}

export interface CoreStatus {
  readonly protocolMajor: typeof CORE_PROTOCOL_MAJOR;
  readonly platform: typeof CORE_PLATFORM;
  readonly runtimeRole: typeof CORE_RUNTIME_ROLE;
  readonly architecture: typeof CORE_ARCHITECTURE;
  readonly state: CoreBootstrapState;
}

export const LOCKED_CORE_SERVICE_STATUS: CoreServiceStatus = {
  protocolMajor: 1,
  platform: "WINDOWS",
  runtimeRole: "FULL_HOST",
  architecture: "x64",
  serviceState: "LOCKED",
  transportState: "NOT_CONNECTED",
};

export class CoreBootstrapError extends Error {
  readonly code: CoreBootstrapFailureCode;

  constructor(code: CoreBootstrapFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CoreBootstrapError";
    this.code = code;
  }
}

function requiredEnvironmentValue(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key];
  if (!value) {
    throw new CoreBootstrapError("CORE_RUNTIME_INCOMPATIBLE", `${key} is required`);
  }
  return value;
}

function isCanonicalChild(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return (
    child.length > 0 &&
    !isAbsolute(child) &&
    child.split(/[\\/]/u).every((component) => component.length > 0 && component !== "..")
  );
}

async function canonicalDirectory(path: string): Promise<string> {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch {
    throw new CoreBootstrapError("CORE_RUNTIME_MISSING", "the release-owned Core root is missing");
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new CoreBootstrapError("CORE_RUNTIME_INTEGRITY_FAILED", "the Core root is not a regular directory");
  }
  return realpath(path);
}

/**
 * Validate the host-provided, controlled Core environment before any service
 * state is created. The host owns platform identity and process containment;
 * Core accepts only the explicit release paths it was given.
 */
export async function validateCoreEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<CoreRuntimeEnvironment> {
  if (environment.NODE_OPTIONS !== undefined || environment.NODE_PATH !== undefined) {
    throw new CoreBootstrapError(
      "CORE_RUNTIME_INCOMPATIBLE",
      "user-controlled Node execution modifiers are not permitted",
    );
  }

  const releaseRootInput = requiredEnvironmentValue(environment, "JARVIS_CORE_ROOT");
  const entrypointInput = requiredEnvironmentValue(environment, "JARVIS_CORE_ENTRYPOINT");
  const tufMetadataDirectoryInput = requiredEnvironmentValue(environment, "JARVIS_TUF_METADATA_DIR");
  const databasePathInput = environment.JARVIS_DATABASE_PATH;
  const recoveryModeInput = environment.JARVIS_RECOVERY_MODE;
  if (recoveryModeInput !== undefined && recoveryModeInput !== "1") {
    throw new CoreBootstrapError(
      "CORE_RUNTIME_INCOMPATIBLE",
      "JARVIS_RECOVERY_MODE must be exactly 1 when present",
    );
  }
  if (!isAbsolute(releaseRootInput) || !isAbsolute(entrypointInput)) {
    throw new CoreBootstrapError(
      "CORE_RUNTIME_INCOMPATIBLE",
      "Core release paths must be absolute",
    );
  }
  if (!isAbsolute(tufMetadataDirectoryInput)) {
    throw new CoreBootstrapError(
      "CORE_RUNTIME_INCOMPATIBLE",
      "TUF metadata paths must be absolute",
    );
  }

  const releaseRoot = await canonicalDirectory(resolve(releaseRootInput));
  const tufMetadataDirectory = await canonicalDirectory(resolve(tufMetadataDirectoryInput));
  if (!isCanonicalChild(releaseRoot, tufMetadataDirectory)) {
    throw new CoreBootstrapError(
      "CORE_RUNTIME_INTEGRITY_FAILED",
      "TUF metadata must remain inside the Core release root",
    );
  }
  let entryMetadata;
  try {
    entryMetadata = await lstat(entrypointInput);
  } catch {
    throw new CoreBootstrapError("CORE_ENTRYPOINT_MISSING", "the release-owned Core entrypoint is missing");
  }
  if (entryMetadata.isSymbolicLink()) {
    throw new CoreBootstrapError(
      "CORE_RUNTIME_INTEGRITY_FAILED",
      "the Core entrypoint cannot be a symbolic link",
    );
  }
  if (!entryMetadata.isFile()) {
    throw new CoreBootstrapError(
      "CORE_RUNTIME_INTEGRITY_FAILED",
      "the Core entrypoint is not a regular file",
    );
  }

  const entrypoint = await realpath(entrypointInput);
  if (!isCanonicalChild(releaseRoot, entrypoint)) {
    throw new CoreBootstrapError(
      "CORE_RUNTIME_INTEGRITY_FAILED",
      "the Core entrypoint is outside the release root",
    );
  }
  let releaseTrust: ReleaseTrustAdmission;
  try {
    releaseTrust = await admitReleaseRuntime(releaseRoot, tufMetadataDirectory);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown TUF admission failure";
    throw new CoreBootstrapError("CORE_RUNTIME_INTEGRITY_FAILED", detail, { cause: error });
  }
  return {
    releaseRoot,
    entrypoint,
    tufMetadataDirectory,
    releaseTrust,
    recoveryMode: recoveryModeInput === "1",
    ...(databasePathInput === undefined ? {} : { databasePath: databasePathInput }),
  };
}

export interface CoreIpcBoundaryStub {
  handle(request: IpcEnvelope<unknown>): Promise<IpcResponse<never>>;
}

export interface CoreServiceShellBoundary {
  handle(request: IpcEnvelope<unknown>): Promise<IpcResponse<unknown>>;
}

type ProviderSetupStartResponse = IpcResponse<{
  readonly requestId: string;
  readonly state: "SETUP_IN_PROGRESS";
}>;
type ProviderSetupCompleteResponse = IpcResponse<{ readonly requestId: string; readonly state: "SETUP_READY" | "SETUP_FAILED" }>;
type ProviderSetupStatusResponse = IpcResponse<{ readonly providers: readonly ProviderSetupStatusView[] }>;
type SessionStatusResponse = IpcResponse<{ readonly initialized: boolean; readonly state: SessionSecurityState | null }>;
type SessionInitializeResponse = IpcResponse<{ readonly initialized: true; readonly state: SessionSecurityState }>;
type SessionAuthenticateResponse = IpcResponse<{ readonly status: "UNLOCKED" | "DENIED" | "COOLDOWN"; readonly retryAfterMs: number; readonly state: SessionSecurityState }>;
type ConversationResponse = IpcResponse<ConversationPipelineResult>;

/**
 * Shared service-shell stub for the first UI/Core boundary slice. It exposes
 * only a harmless status request and remains locked until the authenticated
 * native transport is established; it never fabricates a ready response.
 */
export class CoreServiceShell implements CoreServiceShellBoundary {
  async handle(request: IpcEnvelope<unknown>): Promise<IpcResponse<unknown>> {
    if (!isCoreStatusRequest(request)) {
      return invalidCoreStatusResponse(request);
    }

    return {
      ok: false,
      error: {
        code: "CORE_IPC_NOT_READY",
        category: "UNSUPPORTED",
        message: "Core IPC is unavailable until the authenticated native transport is established",
        retryable: false,
        correlationId: request.correlationId,
        details: {
          request: CORE_STATUS_REQUEST,
          serviceState: LOCKED_CORE_SERVICE_STATUS.serviceState,
          transportState: LOCKED_CORE_SERVICE_STATUS.transportState,
        },
      },
    };
  }
}

/**
 * The authenticated native transport is the first point at which Core may
 * return a real status result. This shell still owns no mutable mission state
 * and exposes no provider operations. Tool execution is accepted only through
 * the explicit Core-owned handler supplied by the native composition root.
 */
export class AuthenticatedCoreServiceShell implements CoreServiceShellBoundary {
  private readonly startProviderSetup: ((request: IpcEnvelope<unknown>) => ProviderSetupStartResponse | Promise<ProviderSetupStartResponse>) | undefined;
  private readonly completeProviderSetup: ((request: IpcEnvelope<unknown>) => ProviderSetupCompleteResponse | Promise<ProviderSetupCompleteResponse>) | undefined;
  private readonly providerSetupStatus: ((request: IpcEnvelope<unknown>) => ProviderSetupStatusResponse | Promise<ProviderSetupStatusResponse>) | undefined;
  private readonly sessionStatus: ((request: IpcEnvelope<unknown>) => SessionStatusResponse | Promise<SessionStatusResponse>) | undefined;
  private readonly initializeSession: ((request: IpcEnvelope<unknown>) => SessionInitializeResponse | Promise<SessionInitializeResponse>) | undefined;
  private readonly authenticateSession: ((request: IpcEnvelope<unknown>) => SessionAuthenticateResponse | Promise<SessionAuthenticateResponse>) | undefined;
  private readonly processConversation: ((request: IpcEnvelope<unknown>) => ConversationResponse | Promise<ConversationResponse>) | undefined;
  private readonly executeTool: ((request: IpcEnvelope<unknown>) => ToolResult | Promise<ToolResult>) | undefined;

  constructor(startProviderSetup?: (request: IpcEnvelope<unknown>) => ProviderSetupStartResponse | Promise<ProviderSetupStartResponse>, completeProviderSetup?: (request: IpcEnvelope<unknown>) => ProviderSetupCompleteResponse | Promise<ProviderSetupCompleteResponse>, providerSetupStatus?: (request: IpcEnvelope<unknown>) => ProviderSetupStatusResponse | Promise<ProviderSetupStatusResponse>, sessionStatus?: (request: IpcEnvelope<unknown>) => SessionStatusResponse | Promise<SessionStatusResponse>, initializeSession?: (request: IpcEnvelope<unknown>) => SessionInitializeResponse | Promise<SessionInitializeResponse>, authenticateSession?: (request: IpcEnvelope<unknown>) => SessionAuthenticateResponse | Promise<SessionAuthenticateResponse>, processConversation?: (request: IpcEnvelope<unknown>) => ConversationResponse | Promise<ConversationResponse>, executeTool?: (request: IpcEnvelope<unknown>) => ToolResult | Promise<ToolResult>) {
    this.startProviderSetup = startProviderSetup;
    this.completeProviderSetup = completeProviderSetup;
    this.providerSetupStatus = providerSetupStatus;
    this.sessionStatus = sessionStatus;
    this.initializeSession = initializeSession;
    this.authenticateSession = authenticateSession;
    this.processConversation = processConversation;
    this.executeTool = executeTool;
  }

  async handle(request: IpcEnvelope<unknown>): Promise<IpcResponse<unknown>> {
    if (isProviderSetupStartRequest(request)) {
      try {
        return this.startProviderSetup ? await this.startProviderSetup(request) : providerSetupNotReadyResponse(request);
      } catch (error) {
        return providerSetupFailureResponse(request, error);
      }
    }
    if (isProviderSetupCompleteRequest(request)) {
      try {
        return this.completeProviderSetup ? await this.completeProviderSetup(request) : providerSetupNotReadyResponse(request) as ProviderSetupCompleteResponse;
      } catch (error) {
        return providerSetupFailureResponse(request, error) as ProviderSetupCompleteResponse;
      }
    }
    if (isProviderSetupStatusRequest(request)) {
      try { return this.providerSetupStatus ? await this.providerSetupStatus(request) : providerSetupStatusNotReadyResponse(request); }
      catch (error) { return providerSetupStatusFailureResponse(request, error); }
    }
    if (isSessionStatusRequest(request)) {
      try { return this.sessionStatus ? await this.sessionStatus(request) : sessionStatusNotReadyResponse(request); }
      catch (error) { return sessionStatusFailureResponse(request, error); }
    }
    if (isSessionInitializeRequest(request)) {
      try { return this.initializeSession ? await this.initializeSession(request) : sessionInitializeNotReadyResponse(request); }
      catch (error) { return sessionMutationFailureResponse(request, error); }
    }
    if (isSessionAuthenticateRequest(request)) {
      try { return this.authenticateSession ? await this.authenticateSession(request) : sessionAuthenticateNotReadyResponse(request); }
      catch (error) { return sessionMutationFailureResponse(request, error); }
    }
    if (isConversationRequest(request)) {
      try { return this.processConversation ? await this.processConversation(request) : conversationNotReadyResponse(request); }
      catch (error) { return conversationFailureResponse(request, error); }
    }
    if (isToolExecutionRequest(request)) {
      try {
        return this.executeTool
          ? { ok: true, result: await this.executeTool(request) }
          : toolExecutionNotReadyResponse(request);
      } catch {
        return toolExecutionFailureResponse(request);
      }
    }
    if (isToolExecutionEnvelope(request)) return invalidToolExecutionResponse(request);
    if (!isCoreStatusRequest(request)) return invalidCoreStatusResponse(request);
    return { ok: true, result: LOCKED_CORE_SERVICE_STATUS };
  }
}

type ToolExecutionResponse = IpcResponse<ToolResult>;

function toolExecutionNotReadyResponse(request: IpcEnvelope<unknown>): ToolExecutionResponse {
  const toolRequest = validateToolRequest(request.payload);
  return {
    ok: false,
    error: {
      code: "CORE_TOOL_RUNTIME_NOT_READY",
      category: "UNSUPPORTED",
      message: "Core tool execution is not available until typed platform boundaries are attached",
      retryable: true,
      correlationId: request.correlationId,
      details: { toolExecutionId: toolRequest.toolExecutionId },
    },
  };
}

function toolExecutionFailureResponse(request: IpcEnvelope<unknown>): ToolExecutionResponse {
  return {
    ok: false,
    error: {
      code: "CORE_TOOL_EXECUTION_FAILED",
      category: "INTERNAL",
      message: "Core tool execution could not be completed",
      retryable: true,
      correlationId: request.correlationId,
    },
  };
}

function invalidToolExecutionResponse(request: IpcEnvelope<unknown>): ToolExecutionResponse {
  return {
    ok: false,
    error: {
      code: "CORE_TOOL_REQUEST_INVALID",
      category: "VALIDATION",
      message: "Tool execution requests must contain a valid ToolRequest whose execution ID matches the IPC request ID",
      retryable: false,
      correlationId: correlationIdFor(request),
    },
  };
}

function conversationNotReadyResponse(request: IpcEnvelope<unknown>): ConversationResponse {
  return { ok: false, error: { code: "CORE_CONVERSATION_NOT_READY", category: "UNSUPPORTED", message: "Authenticated conversation is not available until the Core conversation boundary is attached", retryable: true, correlationId: request.correlationId } };
}

function conversationFailureResponse(request: IpcEnvelope<unknown>, error: unknown): ConversationResponse {
  const code = error instanceof ConversationServiceError ? error.code : "CORE_CONVERSATION_FAILED";
  const category = code === "AUTHENTICATION_REQUIRED" ? "AUTHENTICATION" : code === "PROVIDER_ERROR" ? "PROVIDER_FAILED" : code === "PERSISTENCE_FAILED" ? "INTERNAL" : "VALIDATION";
  return { ok: false, error: { code, category, message: error instanceof ConversationServiceError ? error.message : "Authenticated conversation could not be completed", retryable: code === "PROVIDER_ERROR", correlationId: request.correlationId } };
}

function sessionStatusNotReadyResponse(request: IpcEnvelope<unknown>): SessionStatusResponse {
  return { ok: false, error: { code: "CORE_SESSION_STATUS_NOT_READY", category: "UNSUPPORTED", message: "Session status is not available until the authenticated Core persistence boundary is attached", retryable: true, correlationId: request.correlationId } };
}

function sessionStatusFailureResponse(request: IpcEnvelope<unknown>, error: unknown): SessionStatusResponse {
  const code = error instanceof CoreSchemaError || error instanceof CorePersistenceError ? error.code : "CORE_SESSION_STATUS_FAILED";
  return { ok: false, error: { code, category: "INTERNAL", message: "Session status could not be read", retryable: true, correlationId: request.correlationId } };
}

function sessionInitializeNotReadyResponse(request: IpcEnvelope<unknown>): SessionInitializeResponse {
  return { ok: false, error: { code: "CORE_SESSION_INITIALIZE_NOT_READY", category: "UNSUPPORTED", message: "Session initialization is not available until the authenticated Core persistence and secure-storage boundaries are attached", retryable: true, correlationId: request.correlationId } };
}

function sessionAuthenticateNotReadyResponse(request: IpcEnvelope<unknown>): SessionAuthenticateResponse {
  return { ok: false, error: { code: "CORE_SESSION_AUTHENTICATION_NOT_READY", category: "UNSUPPORTED", message: "Session authentication is not available until the authenticated Core persistence and secure-storage boundaries are attached", retryable: true, correlationId: request.correlationId } };
}

function sessionMutationFailureResponse(request: IpcEnvelope<unknown>, error: unknown): SessionInitializeResponse | SessionAuthenticateResponse {
  const code = error instanceof CoreSchemaError || error instanceof CorePersistenceError || error instanceof CoreIpcBootstrapError ? error.code : "CORE_SESSION_MUTATION_FAILED";
  return { ok: false, error: { code, category: "INTERNAL", message: "JARVIS session transition failed", retryable: true, correlationId: request.correlationId } };
}

function providerSetupStatusNotReadyResponse(request: IpcEnvelope<unknown>): ProviderSetupStatusResponse {
  return { ok: false, error: { code: "CORE_PROVIDER_SETUP_NOT_READY", category: "UNSUPPORTED", message: "Provider setup status is not available until the authenticated Core setup workflow is attached", retryable: true, correlationId: request.correlationId } };
}

function providerSetupStatusFailureResponse(request: IpcEnvelope<unknown>, error: unknown): ProviderSetupStatusResponse {
  const code = error instanceof CoreSchemaError || error instanceof CorePersistenceError ? error.code : "CORE_PROVIDER_SETUP_STATUS_FAILED";
  return { ok: false, error: { code, category: "INTERNAL", message: "Provider setup status could not be read", retryable: true, correlationId: request.correlationId } };
}

const FALLBACK_CORRELATION_ID = "018f3b8e-6c68-7abc-8def-0123456789ab";

function invalidCoreStatusResponse(request: unknown): CoreStatusResponse {
  return {
    ok: false,
    error: {
      code: "CORE_IPC_REQUEST_INVALID",
      category: "VALIDATION",
      message: "Core status requests must use protocol 1, get_core_status, a UUIDv7 correlation ID, and an empty payload",
      retryable: false,
      correlationId: correlationIdFor(request),
    },
  };
}

function providerSetupNotReadyResponse(request: IpcEnvelope<unknown>): ProviderSetupStartResponse {
  const setup = validateProviderSetupStartRequest(request.payload);
  return {
    ok: false,
    error: {
      code: "CORE_PROVIDER_SETUP_NOT_READY",
      category: "UNSUPPORTED",
      message: "Provider setup is not available until the authenticated Core setup workflow is attached",
      retryable: true,
      correlationId: request.correlationId,
      details: {
        requestId: setup.requestId,
        providerId: setup.providerId,
        distributionId: setup.distributionId,
        adapterVersion: setup.adapterVersion,
      },
    },
  };
}

function providerSetupFailureResponse(request: IpcEnvelope<unknown>, error: unknown): ProviderSetupStartResponse {
  const code = error instanceof CoreSchemaError || error instanceof CorePersistenceError ? error.code : "CORE_PROVIDER_SETUP_FAILED";
  const conflict = code === "PERSISTENCE_CONFLICT";
  return {
    ok: false,
    error: {
      code,
      category: conflict ? "CONFLICT" : "INTERNAL",
      message: conflict ? "Provider setup state changed or is not eligible; refresh provider state before retrying" : "Provider setup could not be started",
      retryable: conflict,
      correlationId: request.correlationId,
    },
  };
}

function correlationIdFor(value: unknown): string {
  return isRecord(value) && isUuidV7(value.correlationId)
    ? value.correlationId
    : FALLBACK_CORRELATION_ID;
}

function isCoreStatusRequest(value: unknown): value is IpcEnvelope<Record<string, never>> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    JSON.stringify(keys) === JSON.stringify(["correlationId", "id", "kind", "name", "payload", "protocolVersion"]) &&
    value.protocolVersion === 1 &&
    value.kind === "request" &&
    (value.id === null || isUuidV7(value.id)) &&
    value.name === CORE_STATUS_REQUEST &&
    isUuidV7(value.correlationId) &&
    isRecord(value.payload) &&
    Object.keys(value.payload).length === 0
  );
}

function isProviderSetupStartRequest(value: unknown): value is IpcEnvelope<Record<string, unknown>> {
  if (!isRecord(value)) return false;
  if (value.protocolVersion !== 1 || value.kind !== "request" || value.name !== "start_provider_setup") return false;
  if (!isUuidV7(value.id) || !isUuidV7(value.correlationId) || !isRecord(value.payload)) return false;
  try {
    validateProviderSetupStartRequest(value.payload);
    return true;
  } catch {
    return false;
  }
}

function isProviderSetupCompleteRequest(value: unknown): value is IpcEnvelope<{ requestId: string; providerId: string; action: "SETUP_PROBE_PASSED" | "SETUP_PROBE_FAILED" }> {
  if (!isRecord(value) || value.protocolVersion !== 1 || value.kind !== "request" || value.name !== "complete_provider_setup" || !isUuidV7(value.id) || !isUuidV7(value.correlationId) || !isRecord(value.payload)) return false;
  return isUuidV7(value.payload.requestId) && typeof value.payload.providerId === "string" && value.payload.providerId.length > 0 && value.payload.providerId.length <= 256 && (value.payload.action === "SETUP_PROBE_PASSED" || value.payload.action === "SETUP_PROBE_FAILED");
}

function isProviderSetupStatusRequest(value: unknown): value is IpcEnvelope<Record<string, never>> {
  if (!isRecord(value) || value.protocolVersion !== 1 || value.kind !== "request" || value.name !== "get_provider_setup_status" || !isUuidV7(value.id) || !isUuidV7(value.correlationId) || !isRecord(value.payload)) return false;
  return Object.keys(value.payload).length === 0;
}

function isSessionStatusRequest(value: unknown): value is IpcEnvelope<Record<string, never>> {
  if (!isRecord(value) || value.protocolVersion !== 1 || value.kind !== "request" || value.name !== SESSION_STATUS_REQUEST || !isUuidV7(value.id) || !isUuidV7(value.correlationId) || !isRecord(value.payload)) return false;
  return Object.keys(value.payload).length === 0;
}

function isSessionInitializeRequest(value: unknown): value is IpcEnvelope<{ readonly userId: string; readonly password: string }> {
  if (!isRecord(value) || value.protocolVersion !== 1 || value.kind !== "request" || value.name !== SESSION_INITIALIZE_REQUEST || !isUuidV7(value.id) || !isUuidV7(value.correlationId) || !isRecord(value.payload)) return false;
  return Object.keys(value.payload).sort().join(",") === "password,userId" && boundedSecretText(value.payload.password) && boundedUserId(value.payload.userId);
}

function isSessionAuthenticateRequest(value: unknown): value is IpcEnvelope<{ readonly userId: string; readonly password: string }> {
  if (!isRecord(value) || value.protocolVersion !== 1 || value.kind !== "request" || value.name !== SESSION_AUTHENTICATE_REQUEST || !isUuidV7(value.id) || !isUuidV7(value.correlationId) || !isRecord(value.payload)) return false;
  return Object.keys(value.payload).sort().join(",") === "password,userId" && boundedSecretText(value.payload.password) && boundedUserId(value.payload.userId);
}

function isConversationRequest(value: unknown): value is IpcEnvelope<AuthenticatedTextConversationInputV1> {
  if (!isRecord(value) || value.protocolVersion !== 1 || value.kind !== "request" || value.name !== CONVERSATION_REQUEST || !isUuidV7(value.id) || !isUuidV7(value.correlationId) || !isRecord(value.payload)) return false;
  try {
    const input = validateAuthenticatedTextConversationInput(value.payload);
    return input.instruction.id === value.id;
  } catch {
    return false;
  }
}

function isToolExecutionEnvelope(value: unknown): value is IpcEnvelope<unknown> {
  return isRecord(value) && value.protocolVersion === 1 && value.kind === "request" && value.name === TOOL_EXECUTION_REQUEST;
}

function isToolExecutionRequest(value: unknown): value is IpcEnvelope<Record<string, unknown>> {
  if (!isToolExecutionEnvelope(value) || !isUuidV7(value.id) || !isUuidV7(value.correlationId) || !isRecord(value.payload)) return false;
  try {
    const request = validateToolRequest(value.payload);
    return request.toolExecutionId === value.id;
  } catch {
    return false;
  }
}

function boundedSecretText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 && !value.includes("\0");
}

function boundedUserId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !value.includes("\0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuidV7(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  );
}

/**
 * The first Core slice has no authenticated native transport yet. Returning a
 * typed failure is safer and more truthful than accepting an unbound request.
 */
export class LockedCoreIpcBoundary implements CoreIpcBoundaryStub {
  async handle(request: IpcEnvelope<unknown>): Promise<IpcResponse<never>> {
    const error: JarvisError = {
      code: "CORE_IPC_NOT_READY",
      category: "UNSUPPORTED",
      message: "Core IPC is unavailable until the authenticated native transport is established",
      retryable: false,
      correlationId: request.correlationId,
    };
    return { ok: false, error };
  }
}

export class CoreBootstrap {
  private state: CoreBootstrapState = "STARTING";
  private environment: CoreRuntimeEnvironment | undefined;
  private database: CoreDatabaseConnection | undefined;
  private toolRuntime: CoreToolRuntime | undefined;
  private secureStorageMaterial:
    Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret"> | undefined;

  async start(
    environment: NodeJS.ProcessEnv = process.env,
    databaseDek?: Buffer,
    bootstrapMaterial?: Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret">,
  ): Promise<CoreStatus> {
    if (this.state === "READY") return this.status();
    if (this.state !== "STARTING") {
      throw new CoreBootstrapError("CORE_START_FAILED", "Core cannot restart after shutdown");
    }
    this.environment = await validateCoreEnvironment(environment);
    if (bootstrapMaterial) {
      this.secureStorageMaterial = {
        secureStorageEndpoint: bootstrapMaterial.secureStorageEndpoint,
        secureStorageSecret: Buffer.from(bootstrapMaterial.secureStorageSecret),
      };
    }
    if (databaseDek !== undefined) {
      if (!this.environment.databasePath) {
        throw new CoreBootstrapError("CORE_RUNTIME_INCOMPATIBLE", "JARVIS_DATABASE_PATH is required with a DB_DEK");
      }
      try {
        this.database = openCoreDatabase(this.environment.databasePath, { dbDek: databaseDek });
        applyCoreMigrations(this.database);
        this.ensureQualifiedCodexProvider();
        this.toolRuntime = createFailClosedCoreToolRuntime(new CoreStateRepository(this.database));
      } catch (error) {
        this.database?.close();
        this.database = undefined;
        throw new CoreBootstrapError("CORE_START_FAILED", "Core persistence bootstrap failed", { cause: error });
      }
    }
    this.state = this.environment.recoveryMode ? "RECOVERY" : "READY";
    return this.status();
  }

  async executeTool(request: IpcEnvelope<unknown>): Promise<ToolResult> {
    if (!isToolExecutionRequest(request) || this.toolRuntime === undefined) {
      throw new CoreBootstrapError("CORE_START_FAILED", "Core tool runtime is not composed");
    }
    return this.toolRuntime.execute(request.payload);
  }

  getProjectWorkspace(projectId: string, workspaceId: string): { readonly projectId: string; readonly workspaceId: string; readonly canonicalRoot: { readonly platform: string; readonly value: string } } | undefined {
    if (this.database === undefined) return undefined;
    const workspace = new CoreStateRepository(this.database).getProjectWorkspace(workspaceId);
    if (workspace === undefined || workspace.projectId !== projectId) return undefined;
    return workspace;
  }

  getProjectStatus(projectId: string, workspaceId: string): ProjectStatusSnapshot | undefined {
    if (this.database === undefined) return undefined;
    const repository = new CoreStateRepository(this.database);
    const project = repository.getProject(projectId);
    const workspace = repository.getProjectWorkspace(workspaceId);
    if (project === undefined || workspace === undefined || workspace.projectId !== projectId) return undefined;
    const states = repository.getProjectPolicyTrustRecords(projectId).map((record) => record.state);
    const policyStatus: ProjectPolicyStatus = states.length === 0
      ? "NO_POLICY_CANDIDATE"
      : states.includes("CHANGED_REVIEW_REQUIRED")
        ? "POLICY_CHANGED_REVIEW_REQUIRED"
        : states.includes("UNTRUSTED_CANDIDATE")
          ? "POLICY_DECISION_REQUIRED"
          : states.includes("REVOKED")
            ? "POLICY_REVOKED"
            : states.includes("TRUSTED")
              ? "TRUSTED_POLICY"
              : "POLICY_DISABLED";
    return { project, workspace, policyStatus };
  }

  attachNativeCapabilityClient(client: CoreNativeCapabilityClient): void {
    if (this.database === undefined) throw new CoreBootstrapError("CORE_START_FAILED", "Core persistence must be ready before native capabilities attach");
    const repository = new CoreStateRepository(this.database);
    const releaseTrustReady = this.environment?.releaseTrust !== undefined;
    const nativeBoundaries = createNativeToolPlatformBoundaries(client);
    const criterion = (criterionId: string, verdict: ToolCriterionResult["verdict"], summary: string): ToolCriterionResult => ({
      criterionId,
      verdict,
      evidence: [],
      summary,
      verifiedAt: new Date().toISOString(),
      verifierType: "LIVE_STATE",
    });
    this.toolRuntime = createCoreToolRuntime(repository, nativeBoundaries, {
      readPermissionDecision: async (request) => repository.getPermissionDecisionForToolExecution(request.toolExecutionId) ?? (() => { throw new Error("CORE_TOOL_PERMISSION_DECISION_MISSING"); })(),
      readPreAllowGateFacts: async (request, manifest) => {
        const supportedPlatformCapabilities = new Set([
          "core.status.read",
          "project.status.read",
          "project.open",
          "file.open",
          "filesystem.workspace.read",
          "filesystem.workspace.write",
          "process.supervision",
          "workspace.engineering.test",
          "workspace.engineering.build",
          "git.workspace.read",
        ]);
        const requestArguments = typeof request.arguments === "object" && request.arguments !== null && !Array.isArray(request.arguments)
          ? request.arguments as Record<string, unknown>
          : undefined;
        const applicationOpenRequested = manifest.toolId === "jarvis.open.application-project-file" && requestArguments?.targetKind === "APPLICATION";
        const platformReady = !applicationOpenRequested && manifest.requiredPlatformCapabilities.every((capability) => supportedPlatformCapabilities.has(capability));
        const workspaceScope = request.executionScope.kind === "PROJECT_WORKSPACE";
        const projectStatus = workspaceScope
          ? this.getProjectStatus(request.executionScope.projectId, request.executionScope.workspaceId)
          : undefined;
        const statusRead = manifest.toolId === "jarvis.status.project-system";
        const projectPolicyFact = !workspaceScope || statusRead
          ? { state: "NOT_APPLICABLE" as const, reasonCode: "PROJECT_POLICY_NOT_CONSUMED" }
          : projectStatus === undefined
            ? { state: "UNKNOWN" as const, reasonCode: "PROJECT_POLICY_FACT_NOT_FOUND" }
            : projectStatus.policyStatus === "TRUSTED_POLICY"
              ? { state: "PASS" as const, reasonCode: "TRUSTED_PROJECT_POLICY" }
              : { state: "FAIL" as const, reasonCode: "PROJECT_POLICY_NOT_TRUSTED" };
        const workspaceTargetTool = manifest.toolId.startsWith("jarvis.project.")
          || manifest.toolId.startsWith("jarvis.git.")
          || manifest.toolId.startsWith("jarvis.filesystem.")
          || (manifest.toolId === "jarvis.open.application-project-file" && (requestArguments?.targetKind === "PROJECT" || requestArguments?.targetKind === "FILE"));
        const targetReadyFact = manifest.preconditions.length === 0
          ? { state: "NOT_APPLICABLE" as const, reasonCode: "NO_TOOL_PRECONDITION" }
          : workspaceScope
            && projectStatus !== undefined
            && workspaceTargetTool
              ? { state: "PASS" as const, reasonCode: "CORE_WORKSPACE_TARGET_PRESENT" }
              : applicationOpenRequested
                ? { state: "FAIL" as const, reasonCode: "APPLICATION_OPEN_UNQUALIFIED" }
                : { state: "UNKNOWN" as const, reasonCode: "TOOL_PRECONDITION_NOT_COMPOSED" };
        return {
          PLATFORM_CAPABILITY: { state: platformReady ? "PASS" : "UNKNOWN", reasonCode: platformReady ? "NATIVE_CAPABILITY_COMPOSED" : "NATIVE_CAPABILITY_UNQUALIFIED" },
          PROVIDER_SETUP: { state: "NOT_APPLICABLE", reasonCode: "LOCAL_TOOL_NO_PROVIDER_GATE" },
          INTEGRITY: { state: releaseTrustReady ? "PASS" : "UNKNOWN", reasonCode: releaseTrustReady ? "RELEASE_TUF_ADMITTED" : "RELEASE_TUF_UNKNOWN" },
          PROJECT_POLICY_TRUST: projectPolicyFact,
          SUPPLY_CHAIN_TRUST: { state: releaseTrustReady ? "PASS" : "UNKNOWN", reasonCode: releaseTrustReady ? "RELEASE_SUPPLY_CHAIN_ADMITTED" : "RELEASE_SUPPLY_CHAIN_UNKNOWN" },
          LOCALITY: { state: "PASS", reasonCode: "WINDOWS_LOCAL_HOST" },
          BUDGET: { state: "NOT_APPLICABLE", reasonCode: "LOCAL_TOOL_NO_MONETARY_BUDGET" },
          RESOURCE: { state: "PASS", reasonCode: "BOUNDED_TOOL_RESOURCE_INPUT" },
          PRECONDITION: targetReadyFact,
        };
      },
      evaluatePreconditions: async (request, manifest, input, signal) => {
        const projectId = input.projectId as string | undefined;
        const workspaceId = input.workspaceId as string | undefined;
        if (manifest.toolId === "jarvis.open.application-project-file") {
          if (input.targetKind === "APPLICATION") return [criterion("target-resolved", "UNKNOWN", "application opening is not qualified without a contract-defined application allowlist")];
          if (projectId === undefined || workspaceId === undefined) return [];
          try {
            const snapshot = await nativeBoundaries.status.readProjectStatus(projectId, workspaceId, signal);
            return [criterion("target-resolved", snapshot.workspace.projectId === projectId && snapshot.workspace.workspaceId === workspaceId ? "PASS" : "FAIL", "Core and Windows returned the exact registered workspace for the open target")];
          } catch {
            return [criterion("target-resolved", "UNKNOWN", "the registered open target could not be verified")];
          }
        }
        if (projectId === undefined || workspaceId === undefined) return [];
        if (manifest.toolId.startsWith("jarvis.project.")) {
          try {
            const snapshot = await nativeBoundaries.status.readProjectStatus(projectId, workspaceId, signal);
            return [criterion("engineering-target-ready", snapshot.workspace.projectId === projectId && snapshot.workspace.workspaceId === workspaceId ? "PASS" : "FAIL", "Core and Windows returned the exact registered engineering workspace")];
          } catch {
            return [criterion("engineering-target-ready", "UNKNOWN", "the registered engineering workspace could not be verified")];
          }
        }
        if (manifest.toolId.startsWith("jarvis.git.")) {
          try {
            const result = await nativeBoundaries.git.readStatus({ operation: "STATUS", projectId, workspaceId, maxEntries: 1 }, signal);
            return [criterion("git-workspace-resolved", result.workspaceIdentity.length > 0 && result.repositoryIdentity.length > 0 ? "PASS" : "FAIL", "Windows returned bounded Git identity evidence for the registered workspace")];
          } catch {
            return [criterion("git-workspace-resolved", "UNKNOWN", "the registered Git workspace could not be verified")];
          }
        }
        if (manifest.toolId === "jarvis.filesystem.write-text") {
          try {
            const result = await nativeBoundaries.filesystem.readText({ operation: "READ_TEXT", projectId, workspaceId, relativePath: input.relativePath as string, maxBytes: 1_048_576 }, signal);
            return [criterion("write-target-version", result.versionToken.length > 0 ? "PASS" : "FAIL", "Windows returned the current expected-state token for the write target")];
          } catch {
            return [criterion("write-target-version", "UNKNOWN", "the filesystem write target version could not be verified")];
          }
        }
        if (manifest.toolId === "jarvis.filesystem.read-text") {
          try {
            const result = await nativeBoundaries.filesystem.readText({ operation: "READ_TEXT", projectId, workspaceId, relativePath: input.relativePath as string, maxBytes: 1_048_576 }, signal);
            return [criterion("read-target-resolved", result.targetIdentity.length > 0 ? "PASS" : "FAIL", "Windows returned bounded identity evidence for the read target")];
          } catch {
            return [criterion("read-target-resolved", "UNKNOWN", "the filesystem read target could not be verified")];
          }
        }
        return [];
      },
      evaluatePostconditions: async (request, manifest, output) => {
        if (manifest.toolId === "jarvis.open.application-project-file") {
          return [evaluateOpenTargetPostcondition(request, output)];
        }
        if (manifest.toolId === "jarvis.project.test" || manifest.toolId === "jarvis.project.build") {
          const semanticState = output.semanticState;
          return [criterion("engineering-result-verified", semanticState === "UNCERTAIN" ? "UNKNOWN" : "PASS", `Windows supervised engineering returned semantic state ${String(semanticState)}`)];
        }
        if (manifest.toolId === "jarvis.filesystem.write-text") {
          return [criterion("write-target-verified", typeof output.targetIdentity === "string" && typeof output.versionToken === "string" && output.state === "WRITTEN" ? "PASS" : "UNKNOWN", "Windows returned the post-write target identity and version token")];
        }
        return [];
      },
    });
  }

  private ensureQualifiedCodexProvider(): void {
    if (!this.database) return;
    const repository = new CoreStateRepository(this.database);
    const now = new Date().toISOString();
    repository.putProviderProfile({
      providerId: QUALIFIED_CODEX_PROVIDER_ID,
      adapterType: "CODEX_CLI",
      adapterVersion: QUALIFIED_CODEX_ADAPTER_VERSION,
      providerVersion: "0.147.0",
      platform: { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", backendProfileId: "windows-v1" },
      setup: "SETUP_REQUIRED",
      compatibility: "COMPATIBLE",
      capabilities: { naturalLanguage: true, coding: true, structuredOutput: true, toolUse: true, locality: "LOCAL" },
      costClass: "FREE",
      latencyClass: "LOW",
      health: "READY",
    }, {
      providerId: QUALIFIED_CODEX_PROVIDER_ID,
      adapterVersion: QUALIFIED_CODEX_ADAPTER_VERSION,
      platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }],
      acceptedVersions: [{ kind: "EXACT", version: "0.147.0" }],
      requiredCapabilities: ["coding"],
      conformanceProfileId: "codex-cli-windows-v1",
      distributionPolicy: { distributionIds: [QUALIFIED_CODEX_DISTRIBUTION_ID], interfaceIds: ["codex-structured-v1"], executableFileNames: ["codex.exe"], setupHelperFileNames: ["codex-windows-sandbox-setup.exe"] },
    }, now);
    repository.ensureProviderSetupState({ providerId: QUALIFIED_CODEX_PROVIDER_ID, distributionId: QUALIFIED_CODEX_DISTRIBUTION_ID, adapterVersion: QUALIFIED_CODEX_ADAPTER_VERSION, providerVersion: "0.147.0", state: "SETUP_REQUIRED" }, now);
    repository.ensureProviderQualificationState({ providerId: QUALIFIED_CODEX_PROVIDER_ID, distributionId: QUALIFIED_CODEX_DISTRIBUTION_ID, providerVersion: "0.147.0", state: "UNQUALIFIED" }, now);
  }

  stop(): CoreStatus {
    this.database?.close();
    this.database = undefined;
    this.secureStorageMaterial?.secureStorageSecret.fill(0);
    this.secureStorageMaterial = undefined;
    if (this.state === "READY" || this.state === "RECOVERY") this.state = "STOPPING";
    this.state = "STOPPED";
    return this.status();
  }

  status(): CoreStatus {
    return {
      protocolMajor: CORE_PROTOCOL_MAJOR,
      platform: CORE_PLATFORM,
      runtimeRole: CORE_RUNTIME_ROLE,
      architecture: CORE_ARCHITECTURE,
      state: this.state,
    };
  }

  getRuntimeEnvironment(): CoreRuntimeEnvironment {
    if (!this.environment) {
      throw new CoreBootstrapError("CORE_START_FAILED", "Core has not completed bootstrap");
    }
    return this.environment;
  }

  routeProviderForRole(request: ProviderRoutingRequestV1, admission: ProviderRoutingAdmission): ProviderRoutingResultV1 {
    if (!this.database) throw new CoreBootstrapError("CORE_START_FAILED", "Core persistence is not available for provider routing");
    return routePersistedProviderForRoleWithAdmission(new CoreStateRepository(this.database), request, admission);
  }

  admitWorkspaceEngineeringRequest(value: unknown): ProviderWorkspaceEngineeringAdmission {
    if (!this.database) throw new CoreBootstrapError("CORE_START_FAILED", "Core persistence is not available for workspace engineering admission");
    return admitPersistedProviderWorkspaceEngineeringRequest(new CoreStateRepository(this.database), value);
  }

  startProviderSetup(request: IpcEnvelope<unknown>): ProviderSetupStartResponse {
    if (!isProviderSetupStartRequest(request)) return providerSetupNotReadyResponse(request);
    if (!this.database) return providerSetupNotReadyResponse(request);
    const setup = validateProviderSetupStartRequest(request.payload);
    const repository = new CoreStateRepository(this.database);
    repository.beginProviderSetup(setup.providerId, setup.distributionId, setup.adapterVersion, new Date().toISOString());
    return { ok: true, result: { requestId: setup.requestId, state: "SETUP_IN_PROGRESS" } };
  }

  completeProviderSetup(request: IpcEnvelope<unknown>): ProviderSetupCompleteResponse {
    if (!isProviderSetupCompleteRequest(request) || !this.database) return providerSetupNotReadyResponse(request) as ProviderSetupCompleteResponse;
    const repository = new CoreStateRepository(this.database);
    const now = new Date().toISOString();
    if (request.payload.action === "SETUP_PROBE_FAILED") {
      repository.failProviderSetup(request.payload.providerId, now);
      return { ok: true, result: { requestId: request.payload.requestId, state: "SETUP_FAILED" } };
    }
    repository.completeProviderSetup(request.payload.providerId, now);
    return { ok: true, result: { requestId: request.payload.requestId, state: "SETUP_READY" } };
  }

  providerSetupStatus(request: IpcEnvelope<unknown>): ProviderSetupStatusResponse {
    if (!isProviderSetupStatusRequest(request) || !this.database) return providerSetupStatusNotReadyResponse(request);
    return { ok: true, result: { providers: new CoreStateRepository(this.database).listProviderSetupStatusViews() } };
  }

  async processAuthenticatedText(request: IpcEnvelope<unknown>): Promise<ConversationResponse> {
    if (!isConversationRequest(request) || !this.database) return conversationNotReadyResponse(request);
    const repository = new CoreStateRepository(this.database);
    const provider = repository.listProviderSetupStates().find((record) => record.providerId === QUALIFIED_CODEX_PROVIDER_ID);
    if (!provider || provider.state !== "SETUP_READY") {
      return {
        ok: false,
        error: {
          code: "CORE_PROVIDER_SETUP_REQUIRED",
          category: "PRECONDITION",
          message: "Codex provider setup must be independently verified before conversation use",
          retryable: true,
          correlationId: request.correlationId,
        },
      };
    }
    const service = new ConversationService({
      providerId: QUALIFIED_CODEX_PROVIDER_ID,
      repository,
      createMessageId: () => `${request.id as string}:assistant`,
      orchestrator: ({ input, context, repairAttempt }) => runQualifiedCodexConversation({ input, context, repairAttempt, workingDirectory: this.getRuntimeEnvironment().releaseRoot }),
    });
    return { ok: true, result: await service.processAuthenticatedText(request.payload) };
  }

  sessionStatus(request: IpcEnvelope<unknown>): SessionStatusResponse {
    if (!isSessionStatusRequest(request) || !this.database) return sessionStatusNotReadyResponse(request);
    const state = new CoreStateRepository(this.database).getSessionSecurityState();
    return { ok: true, result: { initialized: state !== undefined, state: state ?? null } };
  }

  async initializeSession(request: IpcEnvelope<unknown>): Promise<SessionInitializeResponse> {
    if (!isSessionInitializeRequest(request) || !this.database || !this.secureStorageMaterial) return sessionInitializeNotReadyResponse(request);
    const password = Buffer.from(request.payload.password, "utf8");
    let verifier;
    try {
      verifier = await deriveNewSessionPasswordThroughNativeStorage(this.secureStorageMaterial, password);
      const now = new Date().toISOString();
      const result = new CoreStateRepository(this.database).initializeSession({ userId: request.payload.userId, sessionId: request.id as string, now, eventId: request.id as string, eventType: "SESSION_INIT", correlationId: request.correlationId }, verifier);
      return { ok: true, result: { initialized: true, state: result.state } };
    } finally {
      password.fill(0);
      verifier?.salt.fill(0);
      verifier?.verifier.fill(0);
    }
  }

  async authenticateSession(request: IpcEnvelope<unknown>): Promise<SessionAuthenticateResponse> {
    if (!isSessionAuthenticateRequest(request) || !this.database || !this.secureStorageMaterial) return sessionAuthenticateNotReadyResponse(request);
    const repository = new CoreStateRepository(this.database);
    const current = repository.getSessionSecurityState();
    const verifier = repository.getSessionPasswordVerifier();
    if (!current || !verifier) return sessionAuthenticateNotReadyResponse(request);
    const password = Buffer.from(request.payload.password, "utf8");
    try {
      const passwordVerified = await verifySessionPasswordThroughNativeStorage(this.secureStorageMaterial, password, verifier);
      const now = new Date().toISOString();
      const result = repository.authenticateSession({ userId: request.payload.userId, sessionId: request.id as string, now, eventId: request.id as string, eventType: passwordVerified ? "SESSION_AUTHENTICATION" : "SESSION_AUTH_COOLDOWN", correlationId: request.correlationId, passwordVerified });
      return { ok: true, result: { status: result.status, retryAfterMs: result.retryAfterMs, state: result.state } };
    } finally {
      password.fill(0);
      verifier.salt.fill(0);
      verifier.verifier.fill(0);
    }
  }

  async restorePortableBackup(
    input: Omit<RestoreVerifiedPortableBackupInputV1, "protectNewDbDek" | "sessionPasswordVerifier"> & {
      readonly newSessionPassword: Buffer;
    },
  ): Promise<RestoredPortableBackupV1> {
    const material = this.secureStorageMaterial;
    if (!material) {
      throw new CoreBootstrapError(
        "CORE_START_FAILED",
        "portable restore requires an authenticated native secure-storage boundary",
      );
    }
    this.database?.close();
    this.database = undefined;
    const newSessionPassword = Buffer.from(input.newSessionPassword);
    try {
      const sessionPasswordVerifier = await deriveNewSessionPasswordThroughNativeStorage(
        material,
        newSessionPassword,
      );
      try {
        const { newSessionPassword: _discardedPassword, ...restoreInput } = input;
        return await restoreVerifiedPortableBackup({
          ...restoreInput,
          sessionPasswordVerifier,
          protectNewDbDek: (dbDek) => protectNewDbDekThroughNativeStorage(material, dbDek),
        });
      } finally {
        sessionPasswordVerifier.salt.fill(0);
        sessionPasswordVerifier.verifier.fill(0);
      }
    } finally {
      newSessionPassword.fill(0);
      input.newSessionPassword.fill(0);
    }
  }

  async restoreLocalBackup(
    input: Omit<RestoreVerifiedLocalBackupInputV1, "protectNewDbDek" | "sessionPasswordVerifier" | "unprotectBackupDek"> & {
      readonly newSessionPassword: Buffer;
    },
  ): Promise<RestoredPortableBackupV1> {
    const material = this.secureStorageMaterial;
    if (!material) {
      throw new CoreBootstrapError(
        "CORE_START_FAILED",
        "local restore requires an authenticated native secure-storage boundary",
      );
    }
    this.database?.close();
    this.database = undefined;
    const newSessionPassword = Buffer.from(input.newSessionPassword);
    try {
      const sessionPasswordVerifier = await deriveNewSessionPasswordThroughNativeStorage(
        material,
        newSessionPassword,
      );
      try {
        const { newSessionPassword: _discardedPassword, ...restoreInput } = input;
        return await restoreVerifiedLocalBackup({
          ...restoreInput,
          sessionPasswordVerifier,
          unprotectBackupDek: (protectedBackupDek, descriptorDigest) =>
            unprotectLocalBackupDekThroughNativeStorage(material, protectedBackupDek, descriptorDigest),
          protectNewDbDek: (dbDek) => protectNewDbDekThroughNativeStorage(material, dbDek),
        });
      } finally {
        sessionPasswordVerifier.salt.fill(0);
        sessionPasswordVerifier.verifier.fill(0);
      }
    } finally {
      newSessionPassword.fill(0);
      input.newSessionPassword.fill(0);
    }
  }
}

export interface CoreTransportRuntime {
  readonly transport: AuthenticatedTransport;
}

async function writeCoreFrame(transport: AuthenticatedTransport, value: unknown): Promise<void> {
  const frame = encodeCoreIpcJsonFrame(value);
  await new Promise<void>((resolve, reject) => {
    transport.socket.write(frame, (error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function serveAuthenticatedCoreTransport(
  transport: AuthenticatedTransport,
  isStopping: () => boolean = () => false,
  startProviderSetup?: (request: IpcEnvelope<unknown>) => ProviderSetupStartResponse | Promise<ProviderSetupStartResponse>,
  completeProviderSetup?: (request: IpcEnvelope<unknown>) => ProviderSetupCompleteResponse | Promise<ProviderSetupCompleteResponse>,
  providerSetupStatus?: (request: IpcEnvelope<unknown>) => ProviderSetupStatusResponse | Promise<ProviderSetupStatusResponse>,
  sessionStatus?: (request: IpcEnvelope<unknown>) => SessionStatusResponse | Promise<SessionStatusResponse>,
  initializeSession?: (request: IpcEnvelope<unknown>) => SessionInitializeResponse | Promise<SessionInitializeResponse>,
  authenticateSession?: (request: IpcEnvelope<unknown>) => SessionAuthenticateResponse | Promise<SessionAuthenticateResponse>,
  processConversation?: (request: IpcEnvelope<unknown>) => ConversationResponse | Promise<ConversationResponse>,
  executeTool?: (request: IpcEnvelope<unknown>) => ToolResult | Promise<ToolResult>,
  nativeCapabilityClient?: CoreNativeCapabilityClient,
): Promise<void> {
  const reader = transport.reader;
  const shell = new AuthenticatedCoreServiceShell(startProviderSetup, completeProviderSetup, providerSetupStatus, sessionStatus, initializeSession, authenticateSession, processConversation, executeTool);
  while (!isStopping()) {
    let payload: Buffer;
    try {
      payload = await reader.read(CORE_IPC_FRAME_CEILING, 60_000);
    } catch (error) {
      if (
        error instanceof CoreIpcBootstrapError &&
        error.code === "IPC_HANDSHAKE_TIMEOUT" &&
        !isStopping()
      ) {
        continue;
      }
      return;
    }

    let request: unknown;
    try {
      request = JSON.parse(payload.toString("utf8")) as unknown;
    } catch {
      request = undefined;
    }
    if (nativeCapabilityClient?.handleResponse(request)) continue;
    const response = await shell.handle(request as IpcEnvelope<unknown>);
    try {
      await writeCoreFrame(transport, response);
    } catch {
      return;
    }
  }
}

async function runEntrypoint(): Promise<void> {
  const bootstrap = new CoreBootstrap();
  let transport: AuthenticatedTransport | undefined;
  try {
    const bootstrapMaterial = await readBootstrapMaterial(process.stdin);
    try {
      await bootstrap.start(process.env, bootstrapMaterial.databaseDek, bootstrapMaterial);
    } finally {
      bootstrapMaterial.databaseDek.fill(0);
    }
    const socket = await connectCoreTransport(bootstrapMaterial.endpoint);
    transport = await authenticateCoreTransport(bootstrapMaterial, socket);
  } catch (error) {
    const code = coreStartupFailureCode(error);
    process.stderr.write(`[${code}]\n`);
    process.exitCode = 1;
    return;
  }

  const authenticatedTransport = transport;
  if (!authenticatedTransport) {
    process.stderr.write("[CORE_START_FAILED]\n");
    process.exitCode = 1;
    return;
  }
  const nativeCapabilityClient = new CoreNativeCapabilityClient({
    write: async (frame) => writeCoreFrame(authenticatedTransport, frame),
  }, async (projectId, workspaceId) => {
    const workspace = bootstrap.getProjectWorkspace(projectId, workspaceId);
    if (workspace === undefined || workspace.canonicalRoot.platform !== CORE_PLATFORM) return undefined;
    return {
      projectId: workspace.projectId,
      workspaceId: workspace.workspaceId,
      workspaceRoot: workspace.canonicalRoot.value,
    };
  }, async (projectId, workspaceId) => bootstrap.getProjectStatus(projectId, workspaceId));
  bootstrap.attachNativeCapabilityClient(nativeCapabilityClient);
  let stopping = false;
  const shutdown = () => {
    stopping = true;
    authenticatedTransport.socket.destroy();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await serveAuthenticatedCoreTransport(authenticatedTransport, () => stopping, (request) => bootstrap.startProviderSetup(request), (request) => bootstrap.completeProviderSetup(request), (request) => bootstrap.providerSetupStatus(request), (request) => bootstrap.sessionStatus(request), (request) => bootstrap.initializeSession(request), (request) => bootstrap.authenticateSession(request), (request) => bootstrap.processAuthenticatedText(request), (request) => bootstrap.executeTool(request), nativeCapabilityClient);
  nativeCapabilityClient.close();
  process.off("SIGINT", shutdown);
  process.off("SIGTERM", shutdown);
  authenticatedTransport.socket.destroy();
  bootstrap.stop();
}

function coreStartupFailureCode(error: unknown): string {
  if (error instanceof CoreBootstrapError) {
    const cause = error.cause;
    if (cause instanceof CorePersistenceError || cause instanceof CoreSchemaError) {
      return cause.code;
    }
    return error.code;
  }
  if (error instanceof CoreIpcBootstrapError) return error.code;
  return "CORE_START_FAILED";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await runEntrypoint();
}
