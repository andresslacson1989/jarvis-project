import type { ToolAdapter, ToolManifest, ToolRequest } from "./tool.js";
import { validateToolManifest } from "./tool-runtime.mjs";

export type OpenTargetKind = "APPLICATION" | "PROJECT" | "FILE";

export interface OpenApplicationInput {
  readonly targetKind: "APPLICATION";
  readonly applicationId: string;
  readonly arguments?: readonly string[];
}

export interface OpenProjectInput {
  readonly targetKind: "PROJECT";
  readonly projectId: string;
  readonly workspaceId: string;
}

export interface OpenFileInput {
  readonly targetKind: "FILE";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly relativePath: string;
}

export type OpenToolInput = OpenApplicationInput | OpenProjectInput | OpenFileInput;

export interface OpenToolOutput {
  readonly targetKind: OpenTargetKind;
  readonly targetIdentity: string;
  readonly state: "OPEN_REQUESTED";
}

export interface PlatformOpenBoundary {
  openApplication(applicationId: string, argumentsList: readonly string[], signal?: AbortSignal): Promise<OpenToolOutput>;
  openProject(projectId: string, workspaceId: string, signal?: AbortSignal): Promise<OpenToolOutput>;
  openFile(projectId: string, workspaceId: string, relativePath: string, signal?: AbortSignal): Promise<OpenToolOutput>;
}

export class ToolOpenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolOpenValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ToolOpenValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ToolOpenValidationError(`${label} is invalid`);
  return value;
}

function relativePath(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 1024 || value.includes("\0") || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("\\\\") || value.split(/[\\/]/u).includes("..")) throw new ToolOpenValidationError("relativePath must remain inside the resolved workspace");
  return value;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new ToolOpenValidationError("open request contains unsupported or missing fields");
}

export function validateOpenToolInput(value: unknown): OpenToolInput {
  const input = record(value, "open request");
  if (input.targetKind === "APPLICATION") {
    exactKeys(input, ["targetKind", "applicationId", ...(input.arguments === undefined ? [] : ["arguments"])]);
    if (input.arguments !== undefined && (!Array.isArray(input.arguments) || input.arguments.length > 32 || input.arguments.some((item) => typeof item !== "string" || item.length > 1024 || item.includes("\0")))) throw new ToolOpenValidationError("application arguments are invalid");
    return Object.freeze({ targetKind: "APPLICATION", applicationId: id(input.applicationId, "applicationId"), ...(input.arguments === undefined ? {} : { arguments: Object.freeze([...(input.arguments as string[])]) }) });
  }
  if (input.targetKind === "PROJECT") {
    exactKeys(input, ["targetKind", "projectId", "workspaceId"]);
    return Object.freeze({ targetKind: "PROJECT", projectId: id(input.projectId, "projectId"), workspaceId: id(input.workspaceId, "workspaceId") });
  }
  if (input.targetKind === "FILE") {
    exactKeys(input, ["targetKind", "projectId", "workspaceId", "relativePath"]);
    return Object.freeze({ targetKind: "FILE", projectId: id(input.projectId, "projectId"), workspaceId: id(input.workspaceId, "workspaceId"), relativePath: relativePath(input.relativePath) });
  }
  throw new ToolOpenValidationError("targetKind is invalid");
}

export function validateOpenToolOutput(value: unknown): OpenToolOutput {
  const input = record(value, "open output");
  exactKeys(input, ["targetKind", "targetIdentity", "state"]);
  if (!(input.targetKind === "APPLICATION" || input.targetKind === "PROJECT" || input.targetKind === "FILE") || input.state !== "OPEN_REQUESTED") throw new ToolOpenValidationError("open output state is invalid");
  return Object.freeze({ targetKind: input.targetKind, targetIdentity: id(input.targetIdentity, "targetIdentity"), state: "OPEN_REQUESTED" });
}

export const OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST: ToolManifest = validateToolManifest({
  toolId: "jarvis.open.application-project-file",
  version: 1,
  description: "Open an approved application, registered project workspace, or workspace-relative file through the platform boundary.",
  inputSchemaId: "jarvis.schema.tool-open.request.v1",
  outputSchemaId: "jarvis.schema.tool-open.response.v1",
  baselineRisk: "MODERATE",
  sideEffectClass: "REVERSIBLE_WRITE",
  reversible: true,
  requiredPermissionIds: ["workspace.open"],
  allowedEnvironments: ["WINDOWS_FULL_HOST"],
  allowedScopeKinds: ["PROJECT_WORKSPACE", "SYSTEM"],
  secretCapabilities: [],
  networkRequired: false,
  // The shared manifest covers all three typed targets, but only the
  // workspace-bound PROJECT/FILE operations are currently qualified. Core
  // keeps APPLICATION fail-closed until the active contract defines an
  // application allowlist and identity binding.
  requiredPlatformCapabilities: ["project.open", "file.open"],
  platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }],
  idempotency: "IDEMPOTENCY_KEY",
  preconditions: [{ checkId: "target-resolved", kind: "STATE_QUERY", verifierId: "canonical-target", parametersSchemaId: "jarvis.schema.tool-open.request.v1", required: true, onUnknown: "FAIL" }],
  postconditions: [{ checkId: "target-open-requested", kind: "PROCESS_STATE", verifierId: "open-target", parametersSchemaId: "jarvis.schema.tool-open.response.v1", required: true, onUnknown: "UNCERTAIN" }],
  preemptionPolicy: "SAFE_POINT_ONLY",
});

export function createPlatformOpenAdapter(boundary: PlatformOpenBoundary): ToolAdapter {
  return Object.freeze({
    toolId: OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST.toolId,
    toolVersion: OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST.version,
    async execute(request: ToolRequest, _manifest: ToolManifest, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
      const input = validateOpenToolInput(request.arguments);
      const output = input.targetKind === "APPLICATION"
        ? await boundary.openApplication(input.applicationId, input.arguments ?? [], signal)
        : input.targetKind === "PROJECT"
          ? await boundary.openProject(input.projectId, input.workspaceId, signal)
          : await boundary.openFile(input.projectId, input.workspaceId, input.relativePath, signal);
      return validateOpenToolOutput(output) as unknown as Readonly<Record<string, unknown>>;
    },
  });
}
