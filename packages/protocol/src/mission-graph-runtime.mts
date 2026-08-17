import type {
  AcceptanceCriterion,
  CriterionType,
  DependencyType,
  MissionAcceptancePolicy,
  MissionGraphVersion,
  TaskDependency,
} from "./mission-graph.ts";

export const CRITERION_TYPES = ["TEST", "COMMAND", "FILE_STATE", "LIVE_STATE", "SCHEMA", "REVIEW", "CUSTOM"] as const satisfies readonly CriterionType[];
export const DEPENDENCY_TYPES = ["REQUIRES_SUCCESS", "REQUIRES_COMPLETION", "REQUIRES_OUTPUT", "OPTIONAL_INPUT"] as const satisfies readonly DependencyType[];

export class MissionGraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissionGraphValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) {
    throw new MissionGraphValidationError("mission graph contains unsupported or missing fields");
  }
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) {
    throw new MissionGraphValidationError(`${label} must be a bounded opaque identifier`);
  }
  return value;
}

function text(value: unknown, label: string, max = 4096): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || value.includes("\0")) {
    throw new MissionGraphValidationError(`${label} is invalid`);
  }
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new MissionGraphValidationError(`${label} is unsupported`);
  return value as T;
}

function verifier(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new MissionGraphValidationError("criterion verifier must be an object");
  return Object.freeze({ ...value });
}

function criterion(value: unknown): AcceptanceCriterion {
  if (!isRecord(value)) throw new MissionGraphValidationError("acceptance criterion must be an object");
  exactKeys(value, ["id", "type", "description", "required", "verifier"]);
  if (typeof value.required !== "boolean") throw new MissionGraphValidationError("criterion required must be boolean");
  return Object.freeze({
    id: id(value.id, "criterion id"),
    type: enumValue(value.type, CRITERION_TYPES, "criterion type"),
    description: text(value.description, "criterion description"),
    required: value.required,
    verifier: verifier(value.verifier),
  });
}

function acceptancePolicy(value: unknown): MissionAcceptancePolicy {
  if (!isRecord(value)) throw new MissionGraphValidationError("acceptance policy must be an object");
  exactKeys(value, ["criteria"]);
  if (!Array.isArray(value.criteria) || value.criteria.length < 1 || value.criteria.length > 256) {
    throw new MissionGraphValidationError("acceptance policy criteria must be a non-empty bounded array");
  }
  const criteria = value.criteria.map(criterion);
  const ids = criteria.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new MissionGraphValidationError("acceptance criterion ids must be unique");
  return Object.freeze({ criteria: Object.freeze(criteria) });
}

function dependency(value: unknown): TaskDependency {
  if (!isRecord(value)) throw new MissionGraphValidationError("task dependency must be an object");
  exactKeys(value, ["fromTaskId", "toTaskId", "type"], ["outputKey"]);
  const type = enumValue(value.type, DEPENDENCY_TYPES, "dependency type");
  const outputKey = value.outputKey === undefined ? undefined : text(value.outputKey, "dependency outputKey", 256);
  if (type === "REQUIRES_OUTPUT" && outputKey === undefined) {
    throw new MissionGraphValidationError("REQUIRES_OUTPUT dependency requires outputKey");
  }
  return Object.freeze({
    fromTaskId: id(value.fromTaskId, "dependency fromTaskId"),
    toTaskId: id(value.toTaskId, "dependency toTaskId"),
    type,
    ...(outputKey === undefined ? {} : { outputKey }),
  });
}

function assertAcyclic(taskIds: readonly string[], edges: readonly TaskDependency[]): void {
  const next = new Map(taskIds.map((taskId) => [taskId, [] as string[]]));
  const indegree = new Map(taskIds.map((taskId) => [taskId, 0]));
  for (const edge of edges) {
    if (edge.fromTaskId === edge.toTaskId) throw new MissionGraphValidationError("mission graph cannot contain self-dependencies");
    const children = next.get(edge.toTaskId);
    const target = indegree.get(edge.fromTaskId);
    if (!children || target === undefined) throw new MissionGraphValidationError("dependency references a task outside the graph");
    children.push(edge.fromTaskId);
    indegree.set(edge.fromTaskId, target + 1);
  }
  const queue = taskIds.filter((taskId) => indegree.get(taskId) === 0);
  let visited = 0;
  while (queue.length > 0) {
    const taskId = queue.shift();
    if (taskId === undefined) break;
    visited += 1;
    for (const child of next.get(taskId) ?? []) {
      const childDegree = (indegree.get(child) ?? 1) - 1;
      indegree.set(child, childDegree);
      if (childDegree === 0) queue.push(child);
    }
  }
  if (visited !== taskIds.length) throw new MissionGraphValidationError("mission graph dependencies must be acyclic");
}

export function validateMissionGraphVersion(value: unknown): MissionGraphVersion {
  if (!isRecord(value)) throw new MissionGraphValidationError("mission graph version must be an object");
  exactKeys(value, ["graphId", "missionId", "version", "createdAt", "reason", "causationEventId", "taskIds", "edges", "acceptancePolicy"]);
  const versionValue = value.version;
  if (typeof versionValue !== "number" || !Number.isSafeInteger(versionValue) || versionValue < 1) throw new MissionGraphValidationError("graph version must be a positive safe integer");
  const version = versionValue;
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) throw new MissionGraphValidationError("graph createdAt must be an ISO timestamp");
  if (!Array.isArray(value.taskIds) || value.taskIds.length < 1 || value.taskIds.length > 4096) throw new MissionGraphValidationError("graph taskIds must be a non-empty bounded array");
  const taskIds = Object.freeze(value.taskIds.map((item) => id(item, "task id")));
  if (new Set(taskIds).size !== taskIds.length) throw new MissionGraphValidationError("graph taskIds must be unique");
  if (!Array.isArray(value.edges) || value.edges.length > 16_384) throw new MissionGraphValidationError("graph edges exceed the bounded limit");
  const edges = Object.freeze(value.edges.map(dependency));
  const edgeKeys = edges.map((edge) => `${edge.fromTaskId}\0${edge.toTaskId}\0${edge.type}\0${edge.outputKey ?? ""}`);
  if (new Set(edgeKeys).size !== edgeKeys.length) throw new MissionGraphValidationError("graph edges must be unique");
  assertAcyclic(taskIds, edges);
  return Object.freeze({
    graphId: id(value.graphId, "graph id"),
    missionId: id(value.missionId, "mission id"),
    version,
    createdAt: value.createdAt,
    reason: text(value.reason, "graph reason"),
    causationEventId: id(value.causationEventId, "causation event id"),
    taskIds,
    edges,
    acceptancePolicy: acceptancePolicy(value.acceptancePolicy),
  });
}
