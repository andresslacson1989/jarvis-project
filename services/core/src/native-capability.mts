import { randomBytes } from "node:crypto";
import type { ToolResult } from "../../../packages/protocol/src/tool.ts";
import {
  validateEngineeringExecutionOutput,
  type EngineeringExecutionInput,
  type EngineeringExecutionOutput,
  type PlatformEngineeringExecutionBoundary,
} from "../../../packages/protocol/src/tool-engineering.mjs";
import {
  validateFilesystemToolOutput,
  type FilesystemReadInput,
  type FilesystemReadOutput,
  type FilesystemWriteInput,
  type FilesystemWriteOutput,
  type PlatformFilesystemBoundary,
} from "../../../packages/protocol/src/tool-filesystem.mjs";
import {
  validateGitReadOutput,
  type GitBranchInput,
  type GitBranchOutput,
  type GitDiffInput,
  type GitDiffOutput,
  type GitLogInput,
  type GitLogOutput,
  type GitReadOperation,
  type GitStatusInput,
  type GitStatusOutput,
  type PlatformGitReadBoundary,
} from "../../../packages/protocol/src/tool-git.mjs";
import {
  validateOpenToolOutput,
  type OpenToolOutput,
  type PlatformOpenBoundary,
} from "../../../packages/protocol/src/tool-open.mjs";
import {
  validateProjectStatusSnapshot,
  validateSystemStatusSnapshot,
  type ProjectStatusSnapshot,
  type ProjectSystemStatusProvider,
  type SystemStatusSnapshot,
} from "../../../packages/protocol/src/tool-status.mjs";
import type { CoreToolPlatformBoundaries } from "./tool-runtime.ts";

export const CORE_NATIVE_CAPABILITY_PROTOCOL_MAJOR = 1 as const;
export const CORE_NATIVE_CAPABILITY_TIMEOUT_MS = 60_000;
const CORE_NATIVE_CAPABILITY_FRAME_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_NATIVE_CAPABILITY_PAYLOAD_BYTES = 512 * 1024;

export type NativeCapabilityName =
  | "workspace.bind"
  | "filesystem.read_text"
  | "filesystem.write_text"
  | "open.application"
  | "open.project"
  | "open.file"
  | "status.project"
  | "status.system"
  | "git.status"
  | "git.branch"
  | "git.diff"
  | "git.log"
  | "engineering.execute";

export interface NativeCapabilityRequestFrame {
  readonly protocolVersion: typeof CORE_NATIVE_CAPABILITY_PROTOCOL_MAJOR;
  readonly kind: "request";
  readonly id: string;
  readonly name: "native_capability";
  readonly correlationId: string;
  readonly payload: {
    readonly capability: NativeCapabilityName;
    readonly arguments: Readonly<Record<string, unknown>>;
  };
}

export interface NativeCapabilityResponseFrame {
  readonly ok: boolean;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly error?: {
    readonly code: string;
    readonly category: string;
    readonly message: string;
    readonly retryable: boolean;
    readonly correlationId: string;
  };
  readonly correlationId: string;
}

export interface NativeCapabilityTransport {
  write(frame: NativeCapabilityRequestFrame): Promise<void>;
}

/**
 * Core-owned workspace identity resolved from the encrypted Core database.
 * The native host receives this only as a short-lived platform binding; it
 * never becomes the source of project policy, permission, or approval state.
 */
export interface NativeWorkspaceBinding {
  readonly projectId: string;
  readonly workspaceId: string;
  readonly workspaceRoot: string;
}

export type NativeWorkspaceBindingResolver = (projectId: string, workspaceId: string) => Promise<NativeWorkspaceBinding | undefined>;
export type NativeProjectStatusResolver = (projectId: string, workspaceId: string) => Promise<ProjectStatusSnapshot | undefined>;

export class NativeCapabilityError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "NativeCapabilityError";
    this.code = code;
    this.retryable = retryable;
  }
}

interface PendingRequest {
  readonly resolve: (value: Readonly<Record<string, unknown>>) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
  readonly signal: AbortSignal | undefined;
  readonly abortHandler: (() => void) | undefined;
}

function randomUuidV7(): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(Date.now());
  for (let index = 0; index < 6; index += 1) bytes[index] = Number((timestamp >> BigInt(40 - index * 8)) & 0xffn);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", `${label} must be an object`);
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, label: string, maxLength = 256): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.includes("\0")) throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", `${label} is invalid`);
  return value;
}

function validateCorrelationId(value: unknown): string {
  const result = boundedText(value, "correlationId", 36).toLowerCase();
  if (!CORE_NATIVE_CAPABILITY_FRAME_ID_PATTERN.test(result)) throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", "correlationId is not UUIDv7");
  return result;
}

function validateResponseFrame(value: unknown, expectedCorrelationId: string): NativeCapabilityResponseFrame {
  const response = record(value, "native capability response");
  const correlationId = validateCorrelationId(response.correlationId);
  if (correlationId !== expectedCorrelationId) throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_RETARGETED", "native capability response correlation does not match the request");
  if (typeof response.ok !== "boolean") throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", "native capability response ok flag is invalid");
  if (response.ok) {
    if (response.error !== undefined || response.result === undefined) throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", "successful native capability response must contain only a result");
    const result = record(response.result, "native capability result");
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_NATIVE_CAPABILITY_PAYLOAD_BYTES) throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_TOO_LARGE", "native capability response exceeds its bounded payload");
    return { ok: true, result, correlationId };
  }
  if (response.result !== undefined || response.error === undefined) throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", "failed native capability response must contain only an error");
  const error = record(response.error, "native capability error");
  if (typeof error.retryable !== "boolean") throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", "native capability retryability is invalid");
  if (validateCorrelationId(error.correlationId) !== expectedCorrelationId) throw new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", "native capability error correlation does not match the request");
  return {
    ok: false,
    error: {
      code: boundedText(error.code, "native capability error code"),
      category: boundedText(error.category, "native capability error category"),
      message: boundedText(error.message, "native capability error message", 1024),
      retryable: error.retryable,
      correlationId: expectedCorrelationId,
    },
    correlationId,
  };
}

/**
 * Multiplexes typed Core→native requests over the already authenticated IPC
 * connection. It has no arbitrary operation or shell escape hatch: callers
 * can send only the enumerated native capability names and bounded records.
 */
export class CoreNativeCapabilityClient {
  private readonly transport: NativeCapabilityTransport;
  private readonly workspaceResolver: NativeWorkspaceBindingResolver | undefined;
  private readonly projectStatusResolver: NativeProjectStatusResolver | undefined;
  private readonly pending = new Map<string, PendingRequest>();
  private closed = false;

  constructor(transport: NativeCapabilityTransport, workspaceResolver?: NativeWorkspaceBindingResolver, projectStatusResolver?: NativeProjectStatusResolver) {
    this.transport = transport;
    this.workspaceResolver = workspaceResolver;
    this.projectStatusResolver = projectStatusResolver;
  }

  async bindWorkspace(projectId: string, workspaceId: string, signal?: AbortSignal): Promise<void> {
    if (this.workspaceResolver === undefined) throw new NativeCapabilityError("NATIVE_WORKSPACE_BINDING_UNAVAILABLE", "Core has no workspace binding resolver", false);
    const binding = await this.workspaceResolver(projectId, workspaceId);
    if (binding === undefined) throw new NativeCapabilityError("NATIVE_WORKSPACE_NOT_REGISTERED", "project workspace is not registered in Core", false);
    if (binding.projectId !== projectId || binding.workspaceId !== workspaceId || binding.workspaceRoot.length === 0) throw new NativeCapabilityError("NATIVE_WORKSPACE_BINDING_INVALID", "Core returned an invalid workspace binding", false);
    const result = await this.request("workspace.bind", { projectId: binding.projectId, workspaceId: binding.workspaceId, workspaceRoot: binding.workspaceRoot }, signal);
    if (Object.keys(result).length !== 1 || result.state !== "BOUND") throw new NativeCapabilityError("NATIVE_WORKSPACE_BINDING_INVALID", "native host did not return the required workspace binding state", false);
  }

  async requestWorkspaceCapability(capability: NativeCapabilityName, argumentsValue: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
    if (capability !== "workspace.bind") {
      const projectId = argumentsValue.projectId;
      const workspaceId = argumentsValue.workspaceId;
      if (typeof projectId === "string" && typeof workspaceId === "string") await this.bindWorkspace(projectId, workspaceId, signal);
    }
    return this.request(capability, argumentsValue, signal);
  }

  async requestProjectStatus(projectId: string, workspaceId: string, signal?: AbortSignal): Promise<ProjectStatusSnapshot> {
    if (this.projectStatusResolver === undefined) throw new NativeCapabilityError("NATIVE_PROJECT_STATUS_UNAVAILABLE", "Core has no project status resolver", false);
    const snapshot = await this.projectStatusResolver(projectId, workspaceId);
    if (snapshot === undefined) throw new NativeCapabilityError("NATIVE_PROJECT_STATUS_UNAVAILABLE", "project status is not available in Core", false);
    return this.requestWorkspaceCapability("status.project", { projectId, workspaceId, snapshot }, signal).then(validateProjectStatusSnapshot);
  }

  async request(capability: NativeCapabilityName, argumentsValue: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
    if (this.closed) throw new NativeCapabilityError("NATIVE_CAPABILITY_TRANSPORT_CLOSED", "native capability transport is closed", true);
    if (Buffer.byteLength(JSON.stringify(argumentsValue), "utf8") > MAX_NATIVE_CAPABILITY_PAYLOAD_BYTES) throw new NativeCapabilityError("NATIVE_CAPABILITY_REQUEST_TOO_LARGE", "native capability request exceeds its bounded payload");
    if (signal?.aborted) throw new NativeCapabilityError("NATIVE_CAPABILITY_CANCELLED", "native capability request was cancelled", true);
    const correlationId = randomUuidV7();
    const frame: NativeCapabilityRequestFrame = {
      protocolVersion: CORE_NATIVE_CAPABILITY_PROTOCOL_MAJOR,
      kind: "request",
      id: correlationId,
      name: "native_capability",
      correlationId,
      payload: { capability, arguments: Object.freeze({ ...argumentsValue }) },
    };
    const result = new Promise<Readonly<Record<string, unknown>>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new NativeCapabilityError("NATIVE_CAPABILITY_TIMEOUT", "native capability request timed out", true));
      }, CORE_NATIVE_CAPABILITY_TIMEOUT_MS);
      const abortHandler = signal === undefined ? undefined : () => {
        if (!this.pending.delete(correlationId)) return;
        clearTimeout(timer);
        reject(new NativeCapabilityError("NATIVE_CAPABILITY_CANCELLED", "native capability request was cancelled", true));
      };
      if (abortHandler !== undefined) signal?.addEventListener("abort", abortHandler, { once: true });
      this.pending.set(correlationId, { resolve, reject, timer, signal, abortHandler });
    });
    try {
      await this.transport.write(frame);
    } catch (error) {
      const pending = this.pending.get(correlationId);
      if (pending !== undefined) {
        this.pending.delete(correlationId);
        clearTimeout(pending.timer);
        if (pending.signal !== undefined && pending.abortHandler !== undefined) pending.signal.removeEventListener("abort", pending.abortHandler);
        pending.reject(new NativeCapabilityError("NATIVE_CAPABILITY_WRITE_FAILED", "native capability request could not be sent", true));
      }
    }
    return result;
  }

  /** Deliver a frame read by the single authenticated Core reader loop. */
  handleResponse(value: unknown): boolean {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    const correlationId = typeof candidate.correlationId === "string" ? candidate.correlationId.toLowerCase() : "";
    const pending = this.pending.get(correlationId);
    if (pending === undefined) return false;
    this.pending.delete(correlationId);
    clearTimeout(pending.timer);
    if (pending.signal !== undefined && pending.abortHandler !== undefined) pending.signal.removeEventListener("abort", pending.abortHandler);
    try {
      const response = validateResponseFrame(value, correlationId);
      if (response.ok) pending.resolve(response.result as Readonly<Record<string, unknown>>);
      else pending.reject(new NativeCapabilityError(response.error?.code ?? "NATIVE_CAPABILITY_FAILED", response.error?.message ?? "native capability request failed", response.error?.retryable ?? false));
    } catch (error) {
      pending.reject(error instanceof Error ? error : new NativeCapabilityError("NATIVE_CAPABILITY_RESPONSE_INVALID", "native capability response is invalid"));
    }
    return true;
  }

  close(reason = "native capability transport closed"): void {
    if (this.closed) return;
    this.closed = true;
    for (const [correlationId, pending] of this.pending) {
      this.pending.delete(correlationId);
      clearTimeout(pending.timer);
      if (pending.signal !== undefined && pending.abortHandler !== undefined) pending.signal.removeEventListener("abort", pending.abortHandler);
      pending.reject(new NativeCapabilityError("NATIVE_CAPABILITY_TRANSPORT_CLOSED", reason, true));
    }
  }
}

function requestOutput<T>(client: CoreNativeCapabilityClient, capability: NativeCapabilityName, input: Readonly<Record<string, unknown>>, validate: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
  return client.requestWorkspaceCapability(capability, input, signal).then(validate);
}

export function createNativeToolPlatformBoundaries(client: CoreNativeCapabilityClient): CoreToolPlatformBoundaries {
  const filesystem: PlatformFilesystemBoundary = {
    readText: (input: FilesystemReadInput, signal) => requestOutput(client, "filesystem.read_text", input as unknown as Readonly<Record<string, unknown>>, validateFilesystemToolOutput, signal) as Promise<FilesystemReadOutput>,
    writeText: (input: FilesystemWriteInput, signal) => requestOutput(client, "filesystem.write_text", input as unknown as Readonly<Record<string, unknown>>, validateFilesystemToolOutput, signal) as Promise<FilesystemWriteOutput>,
  };
  const open: PlatformOpenBoundary = {
    openApplication: (applicationId, argumentsList, signal) => requestOutput(client, "open.application", { applicationId, arguments: [...argumentsList] }, validateOpenToolOutput, signal) as Promise<OpenToolOutput>,
    openProject: (projectId, workspaceId, signal) => requestOutput(client, "open.project", { projectId, workspaceId }, validateOpenToolOutput, signal) as Promise<OpenToolOutput>,
    openFile: (projectId, workspaceId, relativePath, signal) => requestOutput(client, "open.file", { projectId, workspaceId, relativePath }, validateOpenToolOutput, signal) as Promise<OpenToolOutput>,
  };
  const status: ProjectSystemStatusProvider = {
    readProjectStatus: (projectId, workspaceId, signal) => client.requestProjectStatus(projectId, workspaceId, signal),
    readSystemStatus: (signal) => requestOutput(client, "status.system", {}, validateSystemStatusSnapshot, signal) as Promise<SystemStatusSnapshot>,
  };
  const gitRequest = <T,>(operation: GitReadOperation, input: Readonly<Record<string, unknown>>, validate: (value: unknown) => T, signal?: AbortSignal): Promise<T> => requestOutput(client, `git.${operation.toLowerCase()}` as NativeCapabilityName, input, validate, signal);
  const git: PlatformGitReadBoundary = {
    readStatus: (input: GitStatusInput, signal) => gitRequest("STATUS", input as unknown as Readonly<Record<string, unknown>>, validateGitReadOutput, signal) as Promise<GitStatusOutput>,
    readBranch: (input: GitBranchInput, signal) => gitRequest("BRANCH", input as unknown as Readonly<Record<string, unknown>>, validateGitReadOutput, signal) as Promise<GitBranchOutput>,
    readDiff: (input: GitDiffInput, signal) => gitRequest("DIFF", input as unknown as Readonly<Record<string, unknown>>, validateGitReadOutput, signal) as Promise<GitDiffOutput>,
    readLog: (input: GitLogInput, signal) => gitRequest("LOG", input as unknown as Readonly<Record<string, unknown>>, validateGitReadOutput, signal) as Promise<GitLogOutput>,
  };
  const engineering: PlatformEngineeringExecutionBoundary = {
    execute: (input: EngineeringExecutionInput, signal) => requestOutput(client, "engineering.execute", input as unknown as Readonly<Record<string, unknown>>, validateEngineeringExecutionOutput, signal) as Promise<EngineeringExecutionOutput>,
  };
  return { status, open, filesystem, engineering, git };
}

export function isNativeCapabilityResponse(value: unknown): value is NativeCapabilityResponseFrame {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.correlationId === "string" && CORE_NATIVE_CAPABILITY_FRAME_ID_PATTERN.test(candidate.correlationId.toLowerCase()) && typeof candidate.ok === "boolean";
}

export type NativeCapabilityToolResponse = ToolResult;
