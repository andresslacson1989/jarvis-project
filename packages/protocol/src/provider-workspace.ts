import type { DataPolicy } from "./data.js";
import type { ProjectWorkspaceRecord } from "./project.js";

export type WorkspaceNetworkMode = "ENABLED" | "DENIED" | "QUALIFIED_POLICY";

export interface WorkspaceEnvironmentPolicyV1 {
  readonly allowedVariableNames: readonly string[];
}

export interface ProviderWorkspaceEngineeringRequestV1 {
  readonly domain: "jarvis.provider-workspace-engineering-request.v1";
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly providerId: string;
  readonly projectId: string;
  readonly workspace: ProjectWorkspaceRecord;
  readonly dataPolicy: DataPolicy;
  readonly networkMode: WorkspaceNetworkMode;
  readonly networkPolicyId?: string;
  readonly environment: WorkspaceEnvironmentPolicyV1;
  readonly writeBoundary: "ASSIGNED_WORKSPACE_ONLY";
  readonly readBoundary: "OUTSIDE_WORKSPACE_UNCLAIMED";
  readonly externalActions: "JARVIS_TOOLS_ONLY";
}
