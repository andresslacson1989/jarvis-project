export type DomainEventActorType = "USER" | "CORE" | "WORKER" | "PROVIDER" | "INTEGRATION" | "MODULE" | "SYSTEM";

export interface DomainEvent<T = unknown> {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly type: string;
  readonly payloadVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly actorType: DomainEventActorType;
  readonly actorId?: string;
  readonly payload: T;
}

export interface ExternalEventProvenance {
  readonly sourceType: string;
  readonly sourceId: string;
  readonly deduplicationKey?: string;
}

export interface DomainEventAppendResult {
  readonly eventId: string;
  readonly aggregateVersion: number;
  readonly duplicate: boolean;
}

export type DomainEventCommittedListener = (event: DomainEvent) => void;
