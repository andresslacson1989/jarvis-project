// Canonical mission, task, and attempt state names from the active data/state contract.
// Runtime transition policy lives in state-machine-runtime.mts so this file remains type-only.

export type MissionState =
  | "CREATED"
  | "PLANNING"
  | "QUEUED"
  | "RUNNING"
  | "WAITING_FOR_USER"
  | "WAITING_FOR_APPROVAL"
  | "PAUSING"
  | "PAUSED"
  | "BLOCKED"
  | "VERIFYING"
  | "RECOVERING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TaskState =
  | "CREATED"
  | "WAITING_FOR_DEPENDENCY"
  | "QUEUED"
  | "STARTING"
  | "RUNNING"
  | "WAITING_FOR_APPROVAL"
  | "PAUSING"
  | "PAUSED"
  | "RESUMING"
  | "BLOCKED"
  | "VERIFYING"
  | "RECOVERING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "INVALIDATED";

export type AttemptState =
  | "QUEUED"
  | "STARTING"
  | "RUNNING"
  | "CHECKPOINTING"
  | "WAITING_FOR_APPROVAL"
  | "PAUSING"
  | "PAUSED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT"
  | "UNCERTAIN";
