import { validatePlatformCompatibility } from "./platform-runtime.mjs";
import type { ExecutionScope } from "./execution-scope.js";
import type { ToolAdapter, ToolCheckSpec, ToolCriterionResult, ToolError, ToolExecutionHooks, ToolManifest, ToolOutcome, ToolRequest, ToolResult } from "./tool.js";
import { ToolSchemaRegistry, ToolSchemaValidationError } from "./tool-runtime-types.mjs";

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolValidationError";
  }
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const RISK_CLASSES = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
const SIDE_EFFECTS = ["READ_ONLY", "REVERSIBLE_WRITE", "EXTERNAL_WRITE", "DESTRUCTIVE"] as const;
const CHECK_KINDS = ["STATE_QUERY", "FILE_STATE", "PROCESS_STATE", "INTEGRATION_STATE", "CUSTOM_VERIFIER"] as const;
const UNKNOWN_POLICIES = ["FAIL", "UNCERTAIN"] as const;
const IDEMPOTENCY = ["IDEMPOTENT", "IDEMPOTENCY_KEY", "NON_IDEMPOTENT", "UNKNOWN"] as const;
const PREEMPTION = ["PREEMPTIBLE", "SAFE_POINT_ONLY", "TEMPORARILY_NON_PREEMPTIBLE"] as const;
const SCOPE_KINDS = ["PROJECT_WORKSPACE", "INTEGRATION", "SYSTEM", "GLOBAL"] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ToolValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) throw new ToolValidationError("tool record contains unsupported or missing fields");
}

function id(value: unknown, label: string, max = 256): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || !ID.test(value)) throw new ToolValidationError(`${label} is invalid`);
  return value;
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || value.includes("\0")) throw new ToolValidationError(`${label} is invalid`);
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new ToolValidationError(`${label} is invalid`);
  return value as T;
}

function stringArray(value: unknown, label: string, maxItems = 128): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string") || new Set(value).size !== value.length) throw new ToolValidationError(`${label} must be a unique string array`);
  return Object.freeze(value.map((item) => id(item, label)));
}

function schemaId(value: unknown, label: string): string {
  return id(value, label);
}

function boundedParameters(value: unknown, depth = 0): Readonly<Record<string, unknown>> {
  if (depth > 6) throw new ToolValidationError("tool arguments are too deeply nested");
  const input = record(value, "tool arguments");
  if (Object.keys(input).length > 128) throw new ToolValidationError("tool arguments contain too many fields");
  for (const [key, item] of Object.entries(input)) {
    if (key.length < 1 || key.length > 128 || key.includes("\0")) throw new ToolValidationError("tool argument key is invalid");
    if (item !== null && typeof item === "object") {
      if (Array.isArray(item)) {
        if (item.length > 128) throw new ToolValidationError("tool argument array is too large");
        item.forEach((child) => { if (child !== null && typeof child === "object") boundedParameters(child, depth + 1); });
      } else boundedParameters(item, depth + 1);
    } else if (typeof item === "number" && !Number.isFinite(item)) throw new ToolValidationError("tool arguments contain a non-finite number");
  }
  return Object.freeze(input);
}

function checkSpec(value: unknown): ToolCheckSpec {
  const input = record(value, "tool check");
  keys(input, ["checkId", "kind", "verifierId", "parametersSchemaId", "required", "onUnknown"], ["timeoutMs"]);
  if (typeof input.required !== "boolean") throw new ToolValidationError("tool check required flag is invalid");
  if (input.timeoutMs !== undefined && (!Number.isSafeInteger(input.timeoutMs) || (input.timeoutMs as number) < 1 || (input.timeoutMs as number) > 86_400_000)) throw new ToolValidationError("tool check timeout is invalid");
  return Object.freeze({ checkId: id(input.checkId, "checkId"), kind: enumValue(input.kind, CHECK_KINDS, "check kind"), verifierId: id(input.verifierId, "verifierId"), parametersSchemaId: schemaId(input.parametersSchemaId, "parametersSchemaId"), required: input.required as boolean, ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs as number }), onUnknown: enumValue(input.onUnknown, UNKNOWN_POLICIES, "onUnknown") });
}

function checks(value: unknown, label: string): readonly ToolCheckSpec[] {
  if (!Array.isArray(value) || value.length > 64) throw new ToolValidationError(`${label} are invalid`);
  const result = value.map(checkSpec);
  if (new Set(result.map((item) => item.checkId)).size !== result.length) throw new ToolValidationError(`${label} contain duplicate check IDs`);
  return Object.freeze(result);
}

export function validateToolManifest(value: unknown): ToolManifest {
  const input = record(value, "tool manifest");
  keys(input, ["toolId", "version", "description", "inputSchemaId", "outputSchemaId", "baselineRisk", "sideEffectClass", "reversible", "requiredPermissionIds", "allowedEnvironments", "allowedScopeKinds", "secretCapabilities", "networkRequired", "requiredPlatformCapabilities", "idempotency", "preconditions", "postconditions", "preemptionPolicy"], ["platformCompatibility"]);
  if (!Number.isSafeInteger(input.version) || (input.version as number) < 1) throw new ToolValidationError("tool version is invalid");
  if (typeof input.reversible !== "boolean" || typeof input.networkRequired !== "boolean") throw new ToolValidationError("tool manifest boolean is invalid");
  const sideEffectClass = enumValue(input.sideEffectClass, SIDE_EFFECTS, "sideEffectClass");
  const preconditions = checks(input.preconditions, "preconditions");
  const postconditions = checks(input.postconditions, "postconditions");
  if (sideEffectClass !== "READ_ONLY" && !postconditions.some((check) => check.required)) throw new ToolValidationError("consequential tools require a required postcondition");
  const allowedScopeKinds = stringArray(input.allowedScopeKinds, "allowedScopeKinds", 4).map((item) => enumValue(item, SCOPE_KINDS, "allowed scope kind")) as readonly ExecutionScope["kind"][];
  if (allowedScopeKinds.length === 0 || stringArray(input.allowedEnvironments, "allowedEnvironments").length === 0) throw new ToolValidationError("tool manifest requires an allowed environment and scope");
  const platformCompatibility = input.platformCompatibility === undefined ? undefined : Object.freeze((Array.isArray(input.platformCompatibility) ? input.platformCompatibility : []).map((item) => validatePlatformCompatibility(item)));
  if (input.platformCompatibility !== undefined && platformCompatibility?.length === 0) throw new ToolValidationError("platformCompatibility is invalid");
  return Object.freeze({ toolId: id(input.toolId, "toolId"), version: input.version as number, description: text(input.description, "description", 4096), inputSchemaId: schemaId(input.inputSchemaId, "inputSchemaId"), outputSchemaId: schemaId(input.outputSchemaId, "outputSchemaId"), baselineRisk: enumValue(input.baselineRisk, RISK_CLASSES, "baselineRisk"), sideEffectClass, reversible: input.reversible as boolean, requiredPermissionIds: stringArray(input.requiredPermissionIds, "requiredPermissionIds"), allowedEnvironments: stringArray(input.allowedEnvironments, "allowedEnvironments"), allowedScopeKinds: Object.freeze(allowedScopeKinds), secretCapabilities: stringArray(input.secretCapabilities, "secretCapabilities"), networkRequired: input.networkRequired as boolean, requiredPlatformCapabilities: stringArray(input.requiredPlatformCapabilities, "requiredPlatformCapabilities"), ...(platformCompatibility === undefined ? {} : { platformCompatibility }), idempotency: enumValue(input.idempotency, IDEMPOTENCY, "idempotency"), preconditions, postconditions, preemptionPolicy: enumValue(input.preemptionPolicy, PREEMPTION, "preemptionPolicy") });
}

export class ToolRegistry {
  private readonly manifests = new Map<string, ToolManifest>();
  private readonly adapters = new Map<string, ToolAdapter>();

  register(manifestValue: unknown, adapter: ToolAdapter): void {
    const manifest = validateToolManifest(manifestValue);
    const key = `${manifest.toolId}@${manifest.version}`;
    if (this.manifests.has(key) || this.adapters.has(key)) throw new Error("tool version is already registered");
    if (adapter.toolId !== manifest.toolId || adapter.toolVersion !== manifest.version) throw new Error("tool adapter identity does not match manifest");
    this.manifests.set(key, manifest);
    this.adapters.set(key, adapter);
  }

  resolve(toolId: string, version: number): ToolManifest {
    const manifest = this.manifests.get(`${toolId}@${version}`);
    if (manifest === undefined) throw new Error("tool manifest is not registered");
    return manifest;
  }

  adapter(toolId: string, version: number): ToolAdapter {
    const adapter = this.adapters.get(`${toolId}@${version}`);
    if (adapter === undefined) throw new Error("tool adapter is not registered");
    return adapter;
  }

  list(): readonly ToolManifest[] {
    return Object.freeze([...this.manifests.values()]);
  }
}

function validateScope(value: unknown): ExecutionScope {
  const input = record(value, "execution scope");
  if (typeof input.kind !== "string" || !SCOPE_KINDS.includes(input.kind as (typeof SCOPE_KINDS)[number])) throw new ToolValidationError("execution scope kind is invalid");
  return Object.freeze(input) as unknown as ExecutionScope;
}

export function validateToolRequest(value: unknown): ToolRequest {
  const input = record(value, "tool request");
  keys(input, ["toolExecutionId", "toolId", "toolVersion", "executionScope", "authorityEnvelopeId", "arguments"], ["taskId", "idempotencyKey"]);
  for (const key of ["toolExecutionId", "authorityEnvelopeId", "taskId"] as const) if (input[key] !== undefined && (typeof input[key] !== "string" || (key !== "taskId" ? !UUID_V7.test(input[key] as string) : !UUID_V7.test(input[key] as string)))) throw new ToolValidationError(`${key} must be UUIDv7`);
  if (!Number.isSafeInteger(input.toolVersion) || (input.toolVersion as number) < 1) throw new ToolValidationError("toolVersion is invalid");
  if (input.idempotencyKey !== undefined) id(input.idempotencyKey, "idempotencyKey", 512);
  return Object.freeze({ toolExecutionId: input.toolExecutionId as string, toolId: id(input.toolId, "toolId"), toolVersion: input.toolVersion as number, ...(input.taskId === undefined ? {} : { taskId: input.taskId as string }), executionScope: validateScope(input.executionScope), authorityEnvelopeId: input.authorityEnvelopeId as string, arguments: boundedParameters(input.arguments), ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey as string }) });
}

export function createToolError(code: string, category: ToolError["category"], message: string, retryable: boolean, correlationId: string): ToolError {
  return Object.freeze({ code: id(code, "error code"), category, message: text(message, "error message", 4096), retryable, correlationId });
}

function now(): string { return new Date().toISOString(); }

function outcomeError(outcome: Exclude<ToolOutcome, "SUCCEEDED">, request: ToolRequest, startedAt: string, error: ToolError, preconditions?: readonly ToolCriterionResult[], postconditions?: readonly ToolCriterionResult[]): ToolResult {
  return Object.freeze({ toolExecutionId: request.toolExecutionId, outcome, ...(preconditions === undefined ? {} : { preconditions }), ...(postconditions === undefined ? {} : { postconditions }), error, startedAt, endedAt: now() });
}

export async function executeRegisteredTool(registry: ToolRegistry, schemas: ToolSchemaRegistry, requestValue: unknown, hooks: ToolExecutionHooks, signal?: AbortSignal): Promise<ToolResult> {
  const request = validateToolRequest(requestValue);
  const startedAt = now();
  let result: ToolResult;
  try {
    const manifest = registry.resolve(request.toolId, request.toolVersion);
    if (!manifest.allowedScopeKinds.includes(request.executionScope.kind)) {
      result = outcomeError("DENIED", request, startedAt, createToolError("TOOL_SCOPE_NOT_ALLOWED", "AUTHORIZATION", "tool scope is not allowed by its manifest", false, request.toolExecutionId));
    } else if (manifest.idempotency === "IDEMPOTENCY_KEY" && request.idempotencyKey === undefined) {
      result = outcomeError("DENIED", request, startedAt, createToolError("TOOL_IDEMPOTENCY_KEY_REQUIRED", "VALIDATION", "tool requires an idempotency key", false, request.toolExecutionId));
    } else {
      const input = schemas.validate(manifest.inputSchemaId, request.arguments);
      const admission = await hooks.admit(request, manifest);
      if (admission.outcome !== "ALLOW") {
        result = outcomeError(admission.outcome, request, startedAt, admission.error ?? createToolError("TOOL_ADMISSION_FAILED", "AUTHORIZATION", "tool admission did not allow execution", admission.outcome === "UNCERTAIN", request.toolExecutionId), admission.preconditions);
      } else {
        const preconditions = await hooks.evaluatePreconditions(request, manifest, input, signal);
        const missingRequiredPrecondition = manifest.preconditions.find((spec) => spec.required && !preconditions.some((item) => item.criterionId === spec.checkId));
        const failedPrecondition = preconditions.find((item) => {
          const spec = manifest.preconditions.find((candidate) => candidate.checkId === item.criterionId);
          return item.verdict === "FAIL" || item.verdict === "UNKNOWN" && spec?.required === true && spec.onUnknown === "FAIL";
        });
        if (missingRequiredPrecondition !== undefined) {
          result = outcomeError("UNCERTAIN", request, startedAt, createToolError("TOOL_PRECONDITION_EVIDENCE_MISSING", "PRECONDITION", "required tool precondition evidence was not returned", true, request.toolExecutionId), preconditions);
        } else if (failedPrecondition !== undefined) {
          const outcome = failedPrecondition.verdict === "UNKNOWN" ? "UNCERTAIN" : "FAILED";
          result = outcomeError(outcome, request, startedAt, createToolError("TOOL_PRECONDITION_FAILED", "PRECONDITION", "tool precondition did not pass", outcome === "UNCERTAIN", request.toolExecutionId), preconditions);
        } else if (signal?.aborted === true) {
          result = outcomeError("CANCELLED", request, startedAt, createToolError("TOOL_CANCELLED", "CANCELLED", "tool execution was cancelled", true, request.toolExecutionId), preconditions);
        } else {
          const adapter = registry.adapter(request.toolId, request.toolVersion);
          const rawOutput = await adapter.execute(request, manifest, signal);
          if (signal !== undefined && Boolean(signal.aborted)) {
            result = outcomeError("UNCERTAIN", request, startedAt, createToolError("TOOL_CANCELLED_DURING_EXECUTION", "CANCELLED", "tool execution was cancelled after adapter execution began", true, request.toolExecutionId), preconditions);
            await hooks.recordAudit(result);
            return result;
          }
          const output = schemas.validate(manifest.outputSchemaId, rawOutput);
          const postconditions = await hooks.evaluatePostconditions(request, manifest, output, signal);
          const missingRequiredPostcondition = manifest.postconditions.find((spec) => spec.required && !postconditions.some((item) => item.criterionId === spec.checkId));
          const failedPostcondition = postconditions.find((item) => {
            const spec = manifest.postconditions.find((candidate) => candidate.checkId === item.criterionId);
            return item.verdict === "FAIL" || item.verdict === "UNKNOWN" && spec?.required === true;
          });
          if (missingRequiredPostcondition !== undefined) {
            result = outcomeError("UNCERTAIN", request, startedAt, createToolError("TOOL_POSTCONDITION_EVIDENCE_MISSING", "POSTCONDITION", "required tool postcondition evidence was not returned", true, request.toolExecutionId), preconditions, postconditions);
          } else if (failedPostcondition !== undefined) {
            const spec = manifest.postconditions.find((candidate) => candidate.checkId === failedPostcondition.criterionId);
            const uncertain = failedPostcondition.verdict === "UNKNOWN" && spec?.onUnknown === "UNCERTAIN";
            result = outcomeError(uncertain ? "UNCERTAIN" : "FAILED", request, startedAt, createToolError("TOOL_POSTCONDITION_FAILED", "POSTCONDITION", "tool postcondition did not pass", uncertain, request.toolExecutionId), preconditions, postconditions);
          } else {
            result = Object.freeze({ toolExecutionId: request.toolExecutionId, outcome: "SUCCEEDED", output, preconditions, postconditions, startedAt, endedAt: now() });
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof ToolValidationError || error instanceof ToolSchemaValidationError) result = outcomeError("FAILED", request, startedAt, createToolError("TOOL_VALIDATION_FAILED", "VALIDATION", error.message, false, request.toolExecutionId));
    else result = outcomeError("FAILED", request, startedAt, createToolError("TOOL_ADAPTER_FAILED", "TOOL_FAILED", "registered tool execution failed", true, request.toolExecutionId));
  }
  try {
    await hooks.recordAudit(result);
    return result;
  } catch {
    return outcomeError("UNCERTAIN", request, startedAt, createToolError("TOOL_AUDIT_FAILED", "INTERNAL", "tool audit recording could not be verified", true, request.toolExecutionId), result.preconditions, result.postconditions);
  }
}

export { ToolSchemaRegistry, ToolSchemaValidationError } from "./tool-runtime-types.mjs";
