import type { AttemptState, MissionState, TaskState } from "./state-machine.ts";

export const MISSION_STATES = [
  "CREATED", "PLANNING", "QUEUED", "RUNNING", "WAITING_FOR_USER", "WAITING_FOR_APPROVAL",
  "PAUSING", "PAUSED", "BLOCKED", "VERIFYING", "RECOVERING", "COMPLETED", "FAILED", "CANCELLED",
] as const satisfies readonly MissionState[];

export const TASK_STATES = [
  "CREATED", "WAITING_FOR_DEPENDENCY", "QUEUED", "STARTING", "RUNNING", "WAITING_FOR_APPROVAL",
  "PAUSING", "PAUSED", "RESUMING", "BLOCKED", "VERIFYING", "RECOVERING", "COMPLETED", "FAILED",
  "CANCELLED", "INVALIDATED",
] as const satisfies readonly TaskState[];

export const ATTEMPT_STATES = [
  "QUEUED", "STARTING", "RUNNING", "CHECKPOINTING", "WAITING_FOR_APPROVAL", "PAUSING", "PAUSED",
  "SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "UNCERTAIN",
] as const satisfies readonly AttemptState[];

export const TERMINAL_MISSION_STATES = ["COMPLETED", "FAILED", "CANCELLED"] as const;
export const TERMINAL_TASK_STATES = ["COMPLETED", "FAILED", "CANCELLED", "INVALIDATED"] as const;
export const TERMINAL_ATTEMPT_STATES = ["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "UNCERTAIN"] as const;

const MISSION_TRANSITIONS: Readonly<Record<MissionState, readonly MissionState[]>> = {
  CREATED: ["PLANNING"],
  PLANNING: ["QUEUED", "WAITING_FOR_USER", "FAILED", "CANCELLED"],
  QUEUED: ["RUNNING", "PAUSED", "CANCELLED"],
  RUNNING: ["WAITING_FOR_USER", "WAITING_FOR_APPROVAL", "PAUSING", "BLOCKED", "VERIFYING", "RECOVERING", "FAILED", "CANCELLED"],
  WAITING_FOR_USER: ["QUEUED", "RUNNING", "CANCELLED"],
  WAITING_FOR_APPROVAL: ["QUEUED", "RUNNING", "CANCELLED"],
  PAUSING: ["PAUSED", "FAILED", "CANCELLED"],
  PAUSED: ["QUEUED", "RUNNING", "CANCELLED"],
  BLOCKED: ["QUEUED", "RUNNING", "WAITING_FOR_USER", "WAITING_FOR_APPROVAL", "FAILED", "CANCELLED"],
  VERIFYING: ["COMPLETED", "RUNNING", "BLOCKED", "FAILED"],
  RECOVERING: ["QUEUED", "RUNNING", "PAUSED", "BLOCKED", "WAITING_FOR_USER", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

const TASK_TRANSITIONS: Readonly<Record<TaskState, readonly TaskState[]>> = {
  CREATED: ["WAITING_FOR_DEPENDENCY", "QUEUED", "CANCELLED"],
  WAITING_FOR_DEPENDENCY: ["QUEUED", "BLOCKED", "FAILED", "CANCELLED"],
  QUEUED: ["STARTING", "PAUSED", "CANCELLED"],
  STARTING: ["RUNNING", "WAITING_FOR_APPROVAL", "PAUSING", "BLOCKED", "FAILED", "CANCELLED"],
  RUNNING: ["WAITING_FOR_APPROVAL", "PAUSING", "BLOCKED", "VERIFYING", "RECOVERING", "FAILED", "CANCELLED"],
  WAITING_FOR_APPROVAL: ["QUEUED", "RUNNING", "CANCELLED"],
  PAUSING: ["PAUSED", "FAILED", "CANCELLED"],
  PAUSED: ["RESUMING", "CANCELLED"],
  RESUMING: ["RUNNING", "QUEUED", "BLOCKED", "RECOVERING", "FAILED", "CANCELLED"],
  BLOCKED: ["QUEUED", "RUNNING", "WAITING_FOR_APPROVAL", "FAILED", "CANCELLED"],
  VERIFYING: ["COMPLETED", "RUNNING", "BLOCKED", "FAILED", "INVALIDATED"],
  RECOVERING: ["QUEUED", "RUNNING", "PAUSED", "BLOCKED", "FAILED", "CANCELLED"],
  COMPLETED: ["INVALIDATED"],
  FAILED: [],
  CANCELLED: [],
  INVALIDATED: [],
};

const ATTEMPT_TRANSITIONS: Readonly<Record<AttemptState, readonly AttemptState[]>> = {
  QUEUED: ["STARTING", "CANCELLED"],
  STARTING: ["RUNNING", "WAITING_FOR_APPROVAL", "FAILED", "CANCELLED", "TIMED_OUT", "UNCERTAIN"],
  RUNNING: ["CHECKPOINTING", "WAITING_FOR_APPROVAL", "PAUSING", "SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "UNCERTAIN"],
  CHECKPOINTING: ["RUNNING", "PAUSING", "FAILED", "UNCERTAIN"],
  WAITING_FOR_APPROVAL: ["QUEUED", "RUNNING", "FAILED", "CANCELLED"],
  PAUSING: ["PAUSED", "FAILED", "CANCELLED", "UNCERTAIN"],
  PAUSED: ["QUEUED", "STARTING", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
  TIMED_OUT: [],
  UNCERTAIN: [],
};

export class StateTransitionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateTransitionValidationError";
  }
}

function isMember(value: unknown, values: readonly string[]): boolean {
  return typeof value === "string" && values.includes(value);
}

function validateState<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!isMember(value, values)) throw new StateTransitionValidationError(`${label} is not canonical`);
  return value as T;
}

function assertTransition<T extends string>(current: unknown, next: unknown, values: readonly T[], transitions: Readonly<Record<T, readonly T[]>>, label: string): void {
  const from = validateState(current, values, `${label} current state`);
  const to = validateState(next, values, `${label} next state`);
  if (!transitions[from].includes(to)) {
    throw new StateTransitionValidationError(`${label} transition ${from} -> ${to} is not permitted`);
  }
}

export function validateMissionState(value: unknown): MissionState {
  return validateState(value, MISSION_STATES, "mission state");
}

export function validateTaskState(value: unknown): TaskState {
  return validateState(value, TASK_STATES, "task state");
}

export function validateAttemptState(value: unknown): AttemptState {
  return validateState(value, ATTEMPT_STATES, "attempt state");
}

export function assertMissionTransition(current: unknown, next: unknown): void {
  assertTransition(current, next, MISSION_STATES, MISSION_TRANSITIONS, "mission");
}

export function assertTaskTransition(current: unknown, next: unknown): void {
  assertTransition(current, next, TASK_STATES, TASK_TRANSITIONS, "task");
}

export function assertAttemptTransition(current: unknown, next: unknown): void {
  assertTransition(current, next, ATTEMPT_STATES, ATTEMPT_TRANSITIONS, "attempt");
}

export function assertMissionInitialState(value: unknown): void {
  if (validateMissionState(value) !== "CREATED") throw new StateTransitionValidationError("mission must be created in CREATED state");
}

export function assertTaskInitialState(value: unknown): void {
  if (validateTaskState(value) !== "CREATED") throw new StateTransitionValidationError("task must be created in CREATED state");
}

export function assertAttemptInitialState(value: unknown): void {
  if (validateAttemptState(value) !== "QUEUED") throw new StateTransitionValidationError("attempt must be created in QUEUED state");
}
