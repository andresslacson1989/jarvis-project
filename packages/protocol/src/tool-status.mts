import type { CoreServiceStatus } from "./core.js";
import type { PlatformRuntimeIdentity } from "./platform.js";
import type { ProjectRecord, ProjectWorkspaceRecord } from "./project.js";
import { validatePlatformRuntimeIdentity } from "./platform-runtime.mjs";
import { validateProjectRecord, validateProjectWorkspaceRecord } from "./project-runtime.mjs";
import type { ToolAdapter, ToolManifest, ToolRequest } from "./tool.js";
import { validateToolManifest } from "./tool-runtime.mjs";

export type ProjectPolicyStatus =
  | "NO_POLICY_CANDIDATE"
  | "POLICY_DECISION_REQUIRED"
  | "TRUSTED_POLICY"
  | "POLICY_CHANGED_REVIEW_REQUIRED"
  | "POLICY_DISABLED"
  | "POLICY_REVOKED"
  | "POLICY_PATH_VALIDATION_ERROR";

export interface ProjectStatusSnapshot {
  readonly project: ProjectRecord;
  readonly workspace: ProjectWorkspaceRecord;
  readonly policyStatus: ProjectPolicyStatus;
}

export interface SystemStatusSnapshot {
  readonly core: CoreServiceStatus;
  readonly platform: PlatformRuntimeIdentity;
}

export interface ProjectSystemStatusInput {
  readonly query: "PROJECT" | "SYSTEM";
  readonly projectId?: string;
  readonly workspaceId?: string;
}

export interface ProjectSystemStatusOutput {
  readonly query: "PROJECT" | "SYSTEM";
  readonly observedAt: string;
  readonly project?: ProjectStatusSnapshot;
  readonly system?: SystemStatusSnapshot;
}

export interface ProjectSystemStatusProvider {
  readProjectStatus(projectId: string, workspaceId: string, signal?: AbortSignal): Promise<ProjectStatusSnapshot>;
  readSystemStatus(signal?: AbortSignal): Promise<SystemStatusSnapshot>;
}

export class ToolStatusValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolStatusValidationError";
  }
}

const POLICY_STATUSES = [
  "NO_POLICY_CANDIDATE",
  "POLICY_DECISION_REQUIRED",
  "TRUSTED_POLICY",
  "POLICY_CHANGED_REVIEW_REQUIRED",
  "POLICY_DISABLED",
  "POLICY_REVOKED",
  "POLICY_PATH_VALIDATION_ERROR",
] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ToolStatusValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new ToolStatusValidationError("status record contains unsupported or missing fields");
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ToolStatusValidationError(`${label} is invalid`);
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 64 || Number.isNaN(Date.parse(value))) throw new ToolStatusValidationError("observedAt is invalid");
  return value;
}

export function validateProjectSystemStatusInput(value: unknown): ProjectSystemStatusInput {
  const input = record(value, "status input");
  exactKeys(input, ["query", ...(input.query === "PROJECT" ? ["projectId", "workspaceId"] : [])]);
  if (input.query === "PROJECT") {
    if (input.projectId === undefined || input.workspaceId === undefined) throw new ToolStatusValidationError("project status requires projectId and workspaceId");
    return Object.freeze({ query: "PROJECT", projectId: id(input.projectId, "projectId"), workspaceId: id(input.workspaceId, "workspaceId") });
  }
  if (input.query !== "SYSTEM") throw new ToolStatusValidationError("status query is invalid");
  return Object.freeze({ query: "SYSTEM" });
}

export function validateProjectStatusSnapshot(value: unknown): ProjectStatusSnapshot {
  const input = record(value, "project status");
  exactKeys(input, ["project", "workspace", "policyStatus"]);
  if (typeof input.policyStatus !== "string" || !(POLICY_STATUSES as readonly string[]).includes(input.policyStatus)) throw new ToolStatusValidationError("policy status is invalid");
  return Object.freeze({ project: validateProjectRecord(input.project), workspace: validateProjectWorkspaceRecord(input.workspace), policyStatus: input.policyStatus as ProjectPolicyStatus });
}

export function validateSystemStatusSnapshot(value: unknown): SystemStatusSnapshot {
  const input = record(value, "system status");
  exactKeys(input, ["core", "platform"]);
  const core = record(input.core, "core status");
  exactKeys(core, ["protocolMajor", "platform", "runtimeRole", "architecture", "serviceState", "transportState"]);
  if (core.protocolMajor !== 1 || core.platform !== "WINDOWS" || core.runtimeRole !== "FULL_HOST" || core.architecture !== "x64" || core.serviceState !== "LOCKED" || core.transportState !== "NOT_CONNECTED") throw new ToolStatusValidationError("core status is unsupported or unqualified");
  return Object.freeze({
    core: Object.freeze({ protocolMajor: 1, platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", serviceState: "LOCKED", transportState: "NOT_CONNECTED" }),
    platform: validatePlatformRuntimeIdentity(input.platform),
  });
}

export function validateProjectSystemStatusOutput(value: unknown): ProjectSystemStatusOutput {
  const input = record(value, "status output");
  if (input.query === "PROJECT") {
    exactKeys(input, ["query", "observedAt", "project"]);
    return Object.freeze({ query: "PROJECT", observedAt: timestamp(input.observedAt), project: validateProjectStatusSnapshot(input.project) });
  }
  if (input.query === "SYSTEM") {
    exactKeys(input, ["query", "observedAt", "system"]);
    return Object.freeze({ query: "SYSTEM", observedAt: timestamp(input.observedAt), system: validateSystemStatusSnapshot(input.system) });
  }
  throw new ToolStatusValidationError("status output query is invalid");
}

export const PROJECT_SYSTEM_STATUS_TOOL_MANIFEST: ToolManifest = validateToolManifest({
  toolId: "jarvis.status.project-system",
  version: 1,
  description: "Read typed project policy/workspace or qualified local system status.",
  inputSchemaId: "jarvis.schema.tool-status.request.v1",
  outputSchemaId: "jarvis.schema.tool-status.response.v1",
  baselineRisk: "LOW",
  sideEffectClass: "READ_ONLY",
  reversible: true,
  requiredPermissionIds: ["status.read"],
  allowedEnvironments: ["WINDOWS_FULL_HOST"],
  allowedScopeKinds: ["PROJECT_WORKSPACE", "SYSTEM"],
  secretCapabilities: [],
  networkRequired: false,
  requiredPlatformCapabilities: ["core.status.read", "project.status.read"],
  platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }],
  idempotency: "IDEMPOTENT",
  preconditions: [],
  postconditions: [],
  preemptionPolicy: "PREEMPTIBLE",
});

export function createProjectSystemStatusAdapter(provider: ProjectSystemStatusProvider): ToolAdapter {
  return Object.freeze({
    toolId: PROJECT_SYSTEM_STATUS_TOOL_MANIFEST.toolId,
    toolVersion: PROJECT_SYSTEM_STATUS_TOOL_MANIFEST.version,
    async execute(request: ToolRequest, _manifest: ToolManifest, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
      const input = validateProjectSystemStatusInput(request.arguments);
      const snapshot = input.query === "PROJECT"
        ? await provider.readProjectStatus(input.projectId as string, input.workspaceId as string, signal)
        : await provider.readSystemStatus(signal);
      return validateProjectSystemStatusOutput({ query: input.query, observedAt: new Date().toISOString(), [input.query === "PROJECT" ? "project" : "system"]: snapshot }) as unknown as Readonly<Record<string, unknown>>;
    },
  });
}
