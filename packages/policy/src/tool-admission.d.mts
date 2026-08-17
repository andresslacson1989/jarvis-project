import type { PermissionDecision } from "../../protocol/src/authority.ts";
import type { ToolAdmissionDecision, ToolManifest, ToolRequest } from "../../protocol/src/tool.ts";

export interface ToolAdmissionEvaluationInput {
  readonly request: ToolRequest;
  readonly manifest: ToolManifest;
  readonly permissionDecision: PermissionDecision;
  readonly preAllowFacts: unknown;
}

export function evaluateToolAdmission(value: unknown): ToolAdmissionDecision;
