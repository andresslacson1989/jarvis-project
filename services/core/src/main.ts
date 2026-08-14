import { lstat, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";
import type { IpcEnvelope, IpcResponse } from "../../../packages/protocol/src/ipc.js";
import type { JarvisError } from "../../../packages/protocol/src/errors.js";
import type {
  CoreServiceStatus,
  CoreStatusResponse,
} from "../../../packages/protocol/src/core.js";
import { admitReleaseRuntime, type ReleaseTrustAdmission } from "./release-trust.js";
import {
  CorePersistenceError,
  openCoreDatabase,
  type CoreDatabaseConnection,
} from "./persistence.js";
import { applyCoreMigrations, CoreSchemaError } from "./schema.js";
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
  unprotectLocalBackupDekThroughNativeStorage,
  protectNewDbDekThroughNativeStorage,
  encodeCoreIpcJsonFrame,
  readBootstrapMaterial,
  type BootstrapMaterial,
  type AuthenticatedTransport,
} from "./ipc-bootstrap.js";

export const CORE_PROTOCOL_MAJOR = 1 as const;
export const CORE_PLATFORM = "WINDOWS" as const;
export const CORE_RUNTIME_ROLE = "FULL_HOST" as const;
export const CORE_ARCHITECTURE = "x64" as const;
const CORE_STATUS_REQUEST = "get_core_status" as const;

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
  handle(request: IpcEnvelope<unknown>): Promise<CoreStatusResponse>;
}

/**
 * Shared service-shell stub for the first UI/Core boundary slice. It exposes
 * only a harmless status request and remains locked until the authenticated
 * native transport is established; it never fabricates a ready response.
 */
export class CoreServiceShell implements CoreServiceShellBoundary {
  async handle(request: IpcEnvelope<unknown>): Promise<CoreStatusResponse> {
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
 * and exposes no tools or provider operations.
 */
export class AuthenticatedCoreServiceShell implements CoreServiceShellBoundary {
  async handle(request: IpcEnvelope<unknown>): Promise<CoreStatusResponse> {
    if (!isCoreStatusRequest(request)) return invalidCoreStatusResponse(request);
    return { ok: true, result: LOCKED_CORE_SERVICE_STATUS };
  }
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
      } catch (error) {
        this.database?.close();
        this.database = undefined;
        throw new CoreBootstrapError("CORE_START_FAILED", "Core persistence bootstrap failed", { cause: error });
      }
    }
    this.state = this.environment.recoveryMode ? "RECOVERY" : "READY";
    return this.status();
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
): Promise<void> {
  const reader = transport.reader;
  const shell = new AuthenticatedCoreServiceShell();
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
  let stopping = false;
  const shutdown = () => {
    stopping = true;
    authenticatedTransport.socket.destroy();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await serveAuthenticatedCoreTransport(authenticatedTransport, () => stopping);
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
