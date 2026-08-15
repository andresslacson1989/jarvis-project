import type { DataLocality, DataPolicy, DataSensitivity } from "./data.ts";
import type {
  ExecutionScope,
  GlobalScope,
  IntegrationBinding,
  IntegrationScope,
  ProjectWorkspaceScope,
  SystemScope,
  TaskExecutionScopeRecord,
} from "./execution-scope.ts";

export const DATA_SENSITIVITIES = ["PUBLIC", "PRIVATE", "SENSITIVE", "SECRET"] as const satisfies readonly DataSensitivity[];
export const DATA_LOCALITIES = ["LOCAL_ONLY", "ANY_APPROVED_PROVIDER"] as const satisfies readonly DataLocality[];
export const EXECUTION_SCOPE_KINDS = ["PROJECT_WORKSPACE", "INTEGRATION", "SYSTEM", "GLOBAL"] as const;

export class ExecutionScopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionScopeValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  const actual = Object.keys(value);
  if (actual.some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) {
    throw new ExecutionScopeValidationError("execution scope contains unsupported or missing fields");
  }
}

function opaqueId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) {
    throw new ExecutionScopeValidationError(`${label} must be a bounded opaque identifier`);
  }
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new ExecutionScopeValidationError(`${label} is unsupported`);
  }
  return value as T;
}

function idArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 256) {
    throw new ExecutionScopeValidationError(`${label} must be a non-empty bounded array`);
  }
  const ids = value.map((item) => opaqueId(item, label));
  if (new Set(ids).size !== ids.length) throw new ExecutionScopeValidationError(`${label} must not contain duplicates`);
  return Object.freeze(ids);
}

function validateBinding(value: unknown): IntegrationBinding {
  if (!isRecord(value)) throw new ExecutionScopeValidationError("integration binding must be an object");
  exactKeys(value, ["integrationId", "accountId", "capabilityIds"]);
  return Object.freeze({
    integrationId: opaqueId(value.integrationId, "integrationId"),
    accountId: opaqueId(value.accountId, "accountId"),
    capabilityIds: idArray(value.capabilityIds, "capabilityIds"),
  });
}

export function validateDataPolicy(value: unknown): DataPolicy {
  if (!isRecord(value)) throw new ExecutionScopeValidationError("data policy must be an object");
  exactKeys(value, ["sensitivity", "locality"]);
  return Object.freeze({
    sensitivity: enumValue(value.sensitivity, DATA_SENSITIVITIES, "sensitivity"),
    locality: enumValue(value.locality, DATA_LOCALITIES, "locality"),
  });
}

const SENSITIVITY_RANK: Readonly<Record<DataSensitivity, number>> = Object.freeze({
  PUBLIC: 0,
  PRIVATE: 1,
  SENSITIVE: 2,
  SECRET: 3,
});

export function strictestDataPolicy(policies: readonly unknown[]): DataPolicy {
  if (!Array.isArray(policies) || policies.length === 0 || policies.length > 256) {
    throw new ExecutionScopeValidationError("at least one bounded data policy is required");
  }
  const validated = policies.map(validateDataPolicy);
  const sensitivity = validated.reduce<DataSensitivity>(
    (current, candidate) => (SENSITIVITY_RANK[candidate.sensitivity] > SENSITIVITY_RANK[current] ? candidate.sensitivity : current),
    "PUBLIC",
  );
  const locality = validated.some((policy) => policy.locality === "LOCAL_ONLY") ? "LOCAL_ONLY" : "ANY_APPROVED_PROVIDER";
  return Object.freeze({ sensitivity, locality });
}

export function compareDataSensitivity(left: DataSensitivity, right: DataSensitivity): number {
  if (!(left in SENSITIVITY_RANK) || !(right in SENSITIVITY_RANK)) {
    throw new ExecutionScopeValidationError("sensitivity is unsupported");
  }
  return SENSITIVITY_RANK[left] - SENSITIVITY_RANK[right];
}

export function validateExecutionScope(value: unknown): ExecutionScope {
  if (!isRecord(value)) throw new ExecutionScopeValidationError("execution scope must be an object");
  const kind = enumValue(value.kind, EXECUTION_SCOPE_KINDS, "scope kind");
  if (kind === "PROJECT_WORKSPACE") {
    exactKeys(value, ["kind", "projectId", "workspaceId"], ["environmentId"]);
    const scope: ProjectWorkspaceScope = {
      kind,
      projectId: opaqueId(value.projectId, "projectId"),
      workspaceId: opaqueId(value.workspaceId, "workspaceId"),
      ...(value.environmentId === undefined ? {} : { environmentId: opaqueId(value.environmentId, "environmentId") }),
    };
    return Object.freeze(scope);
  }
  if (kind === "INTEGRATION") {
    exactKeys(value, ["kind", "bindings"], ["projectId", "environmentId"]);
    if (!Array.isArray(value.bindings) || value.bindings.length < 1 || value.bindings.length > 256) {
      throw new ExecutionScopeValidationError("integration bindings must be a non-empty bounded array");
    }
    const bindings = value.bindings.map(validateBinding);
    const scope: IntegrationScope = {
      kind,
      bindings: Object.freeze(bindings),
      ...(value.projectId === undefined ? {} : { projectId: opaqueId(value.projectId, "projectId") }),
      ...(value.environmentId === undefined ? {} : { environmentId: opaqueId(value.environmentId, "environmentId") }),
    };
    if (scope.environmentId !== undefined && scope.projectId === undefined) {
      throw new ExecutionScopeValidationError("environmentId requires projectId in an integration scope");
    }
    return Object.freeze(scope);
  }
  if (kind === "SYSTEM") {
    exactKeys(value, ["kind", "capabilityIds"], ["environmentId"]);
    return Object.freeze({
      kind,
      capabilityIds: idArray(value.capabilityIds, "capabilityIds"),
      ...(value.environmentId === undefined ? {} : { environmentId: opaqueId(value.environmentId, "environmentId") }),
    } satisfies SystemScope);
  }
  exactKeys(value, ["kind"]);
  return Object.freeze({ kind } satisfies GlobalScope);
}

export function validateTaskExecutionScopeRecord(value: unknown): TaskExecutionScopeRecord {
  if (!isRecord(value)) throw new ExecutionScopeValidationError("task execution scope record must be an object");
  exactKeys(value, ["scope", "dataPolicy"]);
  return Object.freeze({ scope: validateExecutionScope(value.scope), dataPolicy: validateDataPolicy(value.dataPolicy) });
}
