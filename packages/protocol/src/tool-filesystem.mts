import type { ToolAdapter, ToolManifest, ToolRequest } from "./tool.js";
import { validateToolManifest } from "./tool-runtime.mjs";

export type FilesystemOperation = "READ_TEXT" | "WRITE_TEXT";

export interface FilesystemReadInput {
  readonly operation: "READ_TEXT";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly relativePath: string;
  readonly maxBytes: number;
}

export interface FilesystemWriteInput {
  readonly operation: "WRITE_TEXT";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly relativePath: string;
  readonly content: string;
  readonly expectedVersionToken: string;
}

export type FilesystemToolInput = FilesystemReadInput | FilesystemWriteInput;

export interface FilesystemReadOutput {
  readonly operation: "READ_TEXT";
  readonly targetIdentity: string;
  readonly versionToken: string;
  readonly content: string;
  readonly bytes: number;
}

export interface FilesystemWriteOutput {
  readonly operation: "WRITE_TEXT";
  readonly targetIdentity: string;
  readonly versionToken: string;
  readonly state: "WRITE_REQUESTED";
}

export interface PlatformFilesystemBoundary {
  readText(input: FilesystemReadInput, signal?: AbortSignal): Promise<FilesystemReadOutput>;
  writeText(input: FilesystemWriteInput, signal?: AbortSignal): Promise<FilesystemWriteOutput>;
}

export class ToolFilesystemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolFilesystemValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ToolFilesystemValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new ToolFilesystemValidationError("filesystem record contains unsupported or missing fields");
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ToolFilesystemValidationError(`${label} is invalid`);
  return value;
}

function boundedText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength || value.includes("\0")) throw new ToolFilesystemValidationError(`${label} is invalid`);
  return value;
}

function relativePath(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 1024 || value.includes("\0") || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("\\\\") || value.split(/[\\/]/u).includes("..")) throw new ToolFilesystemValidationError("relativePath must remain inside the resolved workspace");
  return value;
}

function versionToken(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || value.includes("\0")) throw new ToolFilesystemValidationError("versionToken is invalid");
  return value;
}

export function validateFilesystemToolInput(value: unknown): FilesystemToolInput {
  const input = record(value, "filesystem request");
  if (input.operation === "READ_TEXT") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "relativePath", "maxBytes"]);
    if (!Number.isSafeInteger(input.maxBytes) || (input.maxBytes as number) < 1 || (input.maxBytes as number) > 1_048_576) throw new ToolFilesystemValidationError("maxBytes is invalid");
    return Object.freeze({ operation: "READ_TEXT", projectId: id(input.projectId, "projectId"), workspaceId: id(input.workspaceId, "workspaceId"), relativePath: relativePath(input.relativePath), maxBytes: input.maxBytes as number });
  }
  if (input.operation === "WRITE_TEXT") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "relativePath", "content", "expectedVersionToken"]);
    return Object.freeze({ operation: "WRITE_TEXT", projectId: id(input.projectId, "projectId"), workspaceId: id(input.workspaceId, "workspaceId"), relativePath: relativePath(input.relativePath), content: boundedText(input.content, "content", 1_048_576), expectedVersionToken: versionToken(input.expectedVersionToken) });
  }
  throw new ToolFilesystemValidationError("filesystem operation is invalid");
}

export function validateFilesystemToolOutput(value: unknown): FilesystemReadOutput | FilesystemWriteOutput {
  const input = record(value, "filesystem output");
  if (input.operation === "READ_TEXT") {
    exactKeys(input, ["operation", "targetIdentity", "versionToken", "content", "bytes"]);
    if (!Number.isSafeInteger(input.bytes) || (input.bytes as number) < 0 || (input.bytes as number) > 1_048_576) throw new ToolFilesystemValidationError("bytes is invalid");
    const content = boundedText(input.content, "content", 1_048_576);
    if (new TextEncoder().encode(content).byteLength !== input.bytes) throw new ToolFilesystemValidationError("bytes does not match content");
    return Object.freeze({ operation: "READ_TEXT", targetIdentity: id(input.targetIdentity, "targetIdentity"), versionToken: versionToken(input.versionToken), content, bytes: input.bytes as number });
  }
  if (input.operation === "WRITE_TEXT") {
    exactKeys(input, ["operation", "targetIdentity", "versionToken", "state"]);
    if (input.state !== "WRITE_REQUESTED") throw new ToolFilesystemValidationError("write state is invalid");
    return Object.freeze({ operation: "WRITE_TEXT", targetIdentity: id(input.targetIdentity, "targetIdentity"), versionToken: versionToken(input.versionToken), state: "WRITE_REQUESTED" });
  }
  throw new ToolFilesystemValidationError("filesystem output operation is invalid");
}

export const FILESYSTEM_READ_TOOL_MANIFEST: ToolManifest = validateToolManifest({
  toolId: "jarvis.filesystem.read-text",
  version: 1,
  description: "Read bounded UTF-8 text from a workspace-relative file through the platform boundary.",
  inputSchemaId: "jarvis.schema.tool-filesystem-read.request.v1",
  outputSchemaId: "jarvis.schema.tool-filesystem-read.response.v1",
  baselineRisk: "MODERATE",
  sideEffectClass: "READ_ONLY",
  reversible: true,
  requiredPermissionIds: ["workspace.read"],
  allowedEnvironments: ["WINDOWS_FULL_HOST"],
  allowedScopeKinds: ["PROJECT_WORKSPACE"],
  secretCapabilities: [],
  networkRequired: false,
  requiredPlatformCapabilities: ["filesystem.workspace.read"],
  platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }],
  idempotency: "IDEMPOTENT",
  preconditions: [{ checkId: "read-target-resolved", kind: "FILE_STATE", verifierId: "canonical-workspace-file", parametersSchemaId: "jarvis.schema.tool-filesystem-read.request.v1", required: true, onUnknown: "FAIL" }],
  postconditions: [],
  preemptionPolicy: "PREEMPTIBLE",
});

export const FILESYSTEM_WRITE_TOOL_MANIFEST: ToolManifest = validateToolManifest({
  toolId: "jarvis.filesystem.write-text",
  version: 1,
  description: "Write bounded UTF-8 text to a workspace-relative file with an expected version token.",
  inputSchemaId: "jarvis.schema.tool-filesystem-write.request.v1",
  outputSchemaId: "jarvis.schema.tool-filesystem-write.response.v1",
  baselineRisk: "HIGH",
  sideEffectClass: "REVERSIBLE_WRITE",
  reversible: true,
  requiredPermissionIds: ["workspace.write"],
  allowedEnvironments: ["WINDOWS_FULL_HOST"],
  allowedScopeKinds: ["PROJECT_WORKSPACE"],
  secretCapabilities: [],
  networkRequired: false,
  requiredPlatformCapabilities: ["filesystem.workspace.write"],
  platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }],
  idempotency: "IDEMPOTENCY_KEY",
  preconditions: [{ checkId: "write-target-version", kind: "FILE_STATE", verifierId: "canonical-workspace-file-version", parametersSchemaId: "jarvis.schema.tool-filesystem-write.request.v1", required: true, onUnknown: "FAIL" }],
  postconditions: [{ checkId: "write-target-verified", kind: "FILE_STATE", verifierId: "canonical-workspace-file-version", parametersSchemaId: "jarvis.schema.tool-filesystem-write.response.v1", required: true, onUnknown: "UNCERTAIN" }],
  preemptionPolicy: "SAFE_POINT_ONLY",
});

export function createPlatformFilesystemAdapter(boundary: PlatformFilesystemBoundary, operation: FilesystemOperation): ToolAdapter {
  const manifest = operation === "READ_TEXT" ? FILESYSTEM_READ_TOOL_MANIFEST : FILESYSTEM_WRITE_TOOL_MANIFEST;
  return Object.freeze({
    toolId: manifest.toolId,
    toolVersion: manifest.version,
    async execute(request: ToolRequest, _manifest: ToolManifest, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
      const input = validateFilesystemToolInput(request.arguments);
      if (input.operation !== operation) throw new ToolFilesystemValidationError("filesystem adapter operation does not match request");
      const output = operation === "READ_TEXT" ? await boundary.readText(input as FilesystemReadInput, signal) : await boundary.writeText(input as FilesystemWriteInput, signal);
      return validateFilesystemToolOutput(output) as unknown as Readonly<Record<string, unknown>>;
    },
  });
}
