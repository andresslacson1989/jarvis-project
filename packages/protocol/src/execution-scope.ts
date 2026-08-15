import type { DataPolicy } from "./data.js";

export interface ProjectWorkspaceScope {
  readonly kind: "PROJECT_WORKSPACE";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly environmentId?: string;
}

export interface IntegrationBinding {
  readonly integrationId: string;
  readonly accountId: string;
  readonly capabilityIds: readonly string[];
}

export interface IntegrationScope {
  readonly kind: "INTEGRATION";
  readonly bindings: readonly IntegrationBinding[];
  readonly projectId?: string;
  readonly environmentId?: string;
}

export interface SystemScope {
  readonly kind: "SYSTEM";
  readonly capabilityIds: readonly string[];
  readonly environmentId?: string;
}

export interface GlobalScope {
  readonly kind: "GLOBAL";
}

export type ExecutionScope = ProjectWorkspaceScope | IntegrationScope | SystemScope | GlobalScope;

export interface TaskExecutionScopeRecord {
  readonly scope: ExecutionScope;
  readonly dataPolicy: DataPolicy;
}
