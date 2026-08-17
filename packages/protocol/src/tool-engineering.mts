import type { ToolAdapter, ToolManifest, ToolRequest } from "./tool.js";
import { validateToolManifest } from "./tool-runtime.mjs";

export type EngineeringOperation = "TEST" | "BUILD";

export interface EngineeringExecutionInput {
  readonly operation: EngineeringOperation;
  readonly projectId: string;
  readonly workspaceId: string;
  readonly profileId: string;
  readonly timeoutMs: number;
}

export interface EngineeringExecutionOutput {
  readonly operation: EngineeringOperation;
  readonly projectId: string;
  readonly workspaceId: string;
  readonly profileId: string;
  readonly workspaceIdentity: string;
  readonly supervision: "WINDOWS_JOB_OBJECT";
  readonly privilege: "STANDARD_USER";
  readonly semanticState: "PASSED" | "FAILED" | "TIMED_OUT" | "CANCELLED" | "UNCERTAIN";
  readonly exitCode?: number;
}

export interface PlatformEngineeringExecutionBoundary {
  execute(input: EngineeringExecutionInput, signal?: AbortSignal): Promise<EngineeringExecutionOutput>;
}

export class ToolEngineeringValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolEngineeringValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ToolEngineeringValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new ToolEngineeringValidationError("engineering record contains unsupported or missing fields");
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ToolEngineeringValidationError(`${label} is invalid`);
  return value;
}

export function validateEngineeringExecutionInput(value: unknown): EngineeringExecutionInput {
  const input = record(value, "engineering execution request");
  exactKeys(input, ["operation", "projectId", "workspaceId", "profileId", "timeoutMs"]);
  if (input.operation !== "TEST" && input.operation !== "BUILD") throw new ToolEngineeringValidationError("engineering operation is invalid");
  if (!Number.isSafeInteger(input.timeoutMs) || (input.timeoutMs as number) < 1_000 || (input.timeoutMs as number) > 3_600_000) throw new ToolEngineeringValidationError("timeoutMs is invalid");
  return Object.freeze({ operation: input.operation, projectId: id(input.projectId, "projectId"), workspaceId: id(input.workspaceId, "workspaceId"), profileId: id(input.profileId, "profileId"), timeoutMs: input.timeoutMs as number });
}

export function validateEngineeringExecutionOutput(value: unknown): EngineeringExecutionOutput {
  const input = record(value, "engineering execution output");
  exactKeys(input, ["operation", "projectId", "workspaceId", "profileId", "workspaceIdentity", "supervision", "privilege", "semanticState", ...(input.exitCode === undefined ? [] : ["exitCode"])]);
  if (input.operation !== "TEST" && input.operation !== "BUILD") throw new ToolEngineeringValidationError("engineering output operation is invalid");
  if (input.supervision !== "WINDOWS_JOB_OBJECT" || input.privilege !== "STANDARD_USER") throw new ToolEngineeringValidationError("engineering execution supervision or privilege is unqualified");
  if (!(input.semanticState === "PASSED" || input.semanticState === "FAILED" || input.semanticState === "TIMED_OUT" || input.semanticState === "CANCELLED" || input.semanticState === "UNCERTAIN")) throw new ToolEngineeringValidationError("engineering semantic state is invalid");
  if (input.exitCode !== undefined && (!Number.isSafeInteger(input.exitCode) || (input.exitCode as number) < 0)) throw new ToolEngineeringValidationError("exitCode is invalid");
  return Object.freeze({ operation: input.operation, projectId: id(input.projectId, "projectId"), workspaceId: id(input.workspaceId, "workspaceId"), profileId: id(input.profileId, "profileId"), workspaceIdentity: id(input.workspaceIdentity, "workspaceIdentity"), supervision: "WINDOWS_JOB_OBJECT", privilege: "STANDARD_USER", semanticState: input.semanticState, ...(input.exitCode === undefined ? {} : { exitCode: input.exitCode as number }) });
}

const ENGINEERING_PRECONDITION = { checkId: "engineering-target-ready", kind: "STATE_QUERY", verifierId: "workspace-engineering-target", parametersSchemaId: "jarvis.schema.tool-engineering.request.v1", required: true, onUnknown: "FAIL" } as const;
const ENGINEERING_POSTCONDITION = { checkId: "engineering-result-verified", kind: "PROCESS_STATE", verifierId: "workspace-engineering-result", parametersSchemaId: "jarvis.schema.tool-engineering.response.v1", required: true, onUnknown: "UNCERTAIN" } as const;

export const PROJECT_TEST_TOOL_MANIFEST: ToolManifest = validateToolManifest({
  toolId: "jarvis.project.test",
  version: 1,
  description: "Run an approved project test profile inside the assigned workspace through supervised process execution.",
  inputSchemaId: "jarvis.schema.tool-engineering.request.v1",
  outputSchemaId: "jarvis.schema.tool-engineering.response.v1",
  baselineRisk: "HIGH",
  sideEffectClass: "REVERSIBLE_WRITE",
  reversible: true,
  requiredPermissionIds: ["project.test"],
  allowedEnvironments: ["WINDOWS_FULL_HOST"],
  allowedScopeKinds: ["PROJECT_WORKSPACE"],
  secretCapabilities: [],
  networkRequired: false,
  requiredPlatformCapabilities: ["process.supervision", "workspace.engineering.test"],
  platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }],
  idempotency: "IDEMPOTENCY_KEY",
  preconditions: [ENGINEERING_PRECONDITION],
  postconditions: [ENGINEERING_POSTCONDITION],
  preemptionPolicy: "SAFE_POINT_ONLY",
});

export const PROJECT_BUILD_TOOL_MANIFEST: ToolManifest = validateToolManifest({
  ...PROJECT_TEST_TOOL_MANIFEST,
  toolId: "jarvis.project.build",
  description: "Run an approved project build profile inside the assigned workspace through supervised process execution.",
  requiredPermissionIds: ["project.build"],
  requiredPlatformCapabilities: ["process.supervision", "workspace.engineering.build"],
});

export function createEngineeringExecutionAdapter(boundary: PlatformEngineeringExecutionBoundary, operation: EngineeringOperation): ToolAdapter {
  const manifest = operation === "TEST" ? PROJECT_TEST_TOOL_MANIFEST : PROJECT_BUILD_TOOL_MANIFEST;
  return Object.freeze({
    toolId: manifest.toolId,
    toolVersion: manifest.version,
    async execute(request: ToolRequest, _manifest: ToolManifest, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
      const input = validateEngineeringExecutionInput(request.arguments);
      if (input.operation !== operation) throw new ToolEngineeringValidationError("engineering adapter operation does not match request");
      return validateEngineeringExecutionOutput(await boundary.execute(input, signal)) as unknown as Readonly<Record<string, unknown>>;
    },
  });
}
