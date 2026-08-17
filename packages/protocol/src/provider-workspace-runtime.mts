import type { ProviderWorkspaceEngineeringRequestV1, WorkspaceEnvironmentPolicyV1 } from "./provider-workspace.js";
import type { WorkspaceNetworkMode } from "./provider-workspace.js";
import { validateDataPolicy } from "./execution-scope-runtime.mjs";
import { validateProjectWorkspaceRecord } from "./project-runtime.mjs";

export class ProviderWorkspaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderWorkspaceValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ProviderWorkspaceValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) throw new ProviderWorkspaceValidationError("workspace request contains unsupported or missing fields");
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ProviderWorkspaceValidationError(`${label} is invalid`);
  return value;
}

function text(value: unknown, label: string, maximum = 2048): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum || /[\u0000-\u001F\u007F]/u.test(value)) throw new ProviderWorkspaceValidationError(`${label} is invalid`);
  return value;
}

function variableNames(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 128 || new Set(value).size !== value.length) throw new ProviderWorkspaceValidationError("workspace environment variable names are invalid");
  return Object.freeze(value.map((item) => {
    const name = text(item, "environment variable name", 128);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) throw new ProviderWorkspaceValidationError("environment variable name is invalid");
    if (/(?:PASSWORD|SECRET|TOKEN|PRIVATE|CREDENTIAL|API[_-]?KEY|DB[_-]?DEK|RECOVERY)/iu.test(name)) throw new ProviderWorkspaceValidationError("secret-bearing environment variables are prohibited");
    return name;
  }));
}

function environment(value: unknown): WorkspaceEnvironmentPolicyV1 {
  const input = record(value, "workspace environment");
  keys(input, ["allowedVariableNames"]);
  return Object.freeze({ allowedVariableNames: variableNames(input.allowedVariableNames) });
}

export function validateProviderWorkspaceEngineeringRequest(value: unknown): ProviderWorkspaceEngineeringRequestV1 {
  const input = record(value, "workspace engineering request");
  keys(input, ["domain", "schemaVersion", "requestId", "providerId", "projectId", "workspace", "dataPolicy", "networkMode", "environment", "writeBoundary", "readBoundary", "externalActions"], ["networkPolicyId"]);
  if (input.domain !== "jarvis.provider-workspace-engineering-request.v1" || input.schemaVersion !== 1) throw new ProviderWorkspaceValidationError("workspace request identity/version is invalid");
  const workspace = validateProjectWorkspaceRecord(input.workspace);
  const projectId = id(input.projectId, "projectId");
  if (workspace.projectId !== projectId) throw new ProviderWorkspaceValidationError("workspace project identity disagrees");
  const networkMode = input.networkMode as WorkspaceNetworkMode;
  if (networkMode !== "ENABLED" && networkMode !== "DENIED" && networkMode !== "QUALIFIED_POLICY") throw new ProviderWorkspaceValidationError("workspace network mode is invalid");
  if (networkMode === "QUALIFIED_POLICY" && input.networkPolicyId === undefined) throw new ProviderWorkspaceValidationError("qualified workspace network mode requires a policy identity");
  if ((networkMode === "ENABLED" || networkMode === "DENIED") && input.networkPolicyId !== undefined) throw new ProviderWorkspaceValidationError("enabled or denied workspace network mode cannot carry a policy identity");
  return Object.freeze({
    domain: "jarvis.provider-workspace-engineering-request.v1",
    schemaVersion: 1,
    requestId: id(input.requestId, "requestId"),
    providerId: id(input.providerId, "providerId"),
    projectId,
    workspace,
    dataPolicy: validateDataPolicy(input.dataPolicy),
    networkMode,
    ...(input.networkPolicyId === undefined ? {} : { networkPolicyId: id(input.networkPolicyId, "networkPolicyId") }),
    environment: environment(input.environment),
    writeBoundary: input.writeBoundary === "ASSIGNED_WORKSPACE_ONLY" ? "ASSIGNED_WORKSPACE_ONLY" : (() => { throw new ProviderWorkspaceValidationError("workspace write boundary is invalid"); })(),
    readBoundary: input.readBoundary === "OUTSIDE_WORKSPACE_UNCLAIMED" ? "OUTSIDE_WORKSPACE_UNCLAIMED" : (() => { throw new ProviderWorkspaceValidationError("workspace read boundary is invalid"); })(),
    externalActions: input.externalActions === "JARVIS_TOOLS_ONLY" ? "JARVIS_TOOLS_ONLY" : (() => { throw new ProviderWorkspaceValidationError("workspace external-action boundary is invalid"); })(),
  });
}
