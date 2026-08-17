export type CriterionType = "TEST" | "COMMAND" | "FILE_STATE" | "LIVE_STATE" | "SCHEMA" | "REVIEW" | "CUSTOM";
export type DependencyType = "REQUIRES_SUCCESS" | "REQUIRES_COMPLETION" | "REQUIRES_OUTPUT" | "OPTIONAL_INPUT";

export interface AcceptanceCriterion {
  readonly id: string;
  readonly type: CriterionType;
  readonly description: string;
  readonly required: boolean;
  readonly verifier: Readonly<Record<string, unknown>>;
}

export interface TaskDependency {
  readonly fromTaskId: string;
  readonly toTaskId: string;
  readonly type: DependencyType;
  readonly outputKey?: string;
}

export interface MissionAcceptancePolicy {
  readonly criteria: readonly AcceptanceCriterion[];
}

export interface MissionGraphVersion {
  readonly graphId: string;
  readonly missionId: string;
  readonly version: number;
  readonly createdAt: string;
  readonly reason: string;
  readonly causationEventId: string;
  readonly taskIds: readonly string[];
  readonly edges: readonly TaskDependency[];
  readonly acceptancePolicy: MissionAcceptancePolicy;
}
