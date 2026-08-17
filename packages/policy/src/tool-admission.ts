import { validatePermissionDecision } from "../../protocol/src/authority-runtime.mjs";
import { validateToolManifest, validateToolRequest } from "../../protocol/src/tool-runtime.mjs";
import type { PermissionDecision } from "../../protocol/src/authority.ts";
import type { ToolAdmissionDecision, ToolManifest, ToolRequest } from "../../protocol/src/tool.ts";
import { createToolError } from "../../protocol/src/tool-runtime.mjs";
import { evaluatePreAllowGates, validatePreAllowGateFacts } from "./pre-allow-gates.mjs";

export interface ToolAdmissionEvaluationInput {
  readonly request: ToolRequest;
  readonly manifest: ToolManifest;
  readonly permissionDecision: PermissionDecision;
  readonly preAllowFacts: unknown;
}

function denied(request: ToolRequest, code: string, message: string, retryable = false): ToolAdmissionDecision {
  return Object.freeze({ outcome: "DENIED", error: createToolError(code, "AUTHORIZATION", message, retryable, request.toolExecutionId) });
}

export function evaluateToolAdmission(value: unknown): ToolAdmissionDecision {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("tool admission input must be an object");
  const input = value as Record<string, unknown>;
  const request = validateToolRequest(input.request);
  const manifest = validateToolManifest(input.manifest);
  const permission = validatePermissionDecision(input.permissionDecision);
  validatePreAllowGateFacts(input.preAllowFacts);
  if (permission.toolExecutionId !== undefined && permission.toolExecutionId !== request.toolExecutionId) return denied(request, "TOOL_PERMISSION_DECISION_MISMATCH", "permission decision is bound to a different tool execution");
  if (permission.taskId !== undefined && request.taskId !== undefined && permission.taskId !== request.taskId) return denied(request, "TOOL_PERMISSION_TASK_MISMATCH", "permission decision is bound to a different task");
  if (!manifest.allowedScopeKinds.includes(request.executionScope.kind)) return denied(request, "TOOL_SCOPE_NOT_ALLOWED", "tool scope is not allowed by its manifest");
  if (permission.outcome !== "ALLOW") return denied(request, permission.outcome === "REQUIRE_APPROVAL" ? "TOOL_APPROVAL_REQUIRED" : "TOOL_PERMISSION_DENIED", permission.outcome === "REQUIRE_APPROVAL" ? "tool approval is required before execution" : "tool permission was denied");
  const preAllow = evaluatePreAllowGates(input.preAllowFacts);
  if (!preAllow.passed) {
    const unknown = preAllow.reasonCode.endsWith("_UNKNOWN");
    return Object.freeze({ outcome: unknown ? "UNCERTAIN" : "DENIED", error: createToolError(unknown ? "TOOL_PRE_ALLOW_GATE_UNKNOWN" : "TOOL_PRE_ALLOW_GATE_FAILED", "AUTHORIZATION", unknown ? "mandatory tool admission facts are unknown" : "a mandatory tool admission gate failed", unknown, request.toolExecutionId) });
  }
  return Object.freeze({ outcome: "ALLOW" });
}
