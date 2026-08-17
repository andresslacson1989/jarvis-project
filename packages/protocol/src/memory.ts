import type { DataPolicy } from "./data.js";

export type MemoryScopeKind = "USER_GLOBAL" | "PROJECT" | "MISSION" | "TASK" | "SESSION";
export type MemoryConfidence = "VERIFIED" | "CONFIRMED" | "INFERRED" | "STALE";
export type ConversationMessageRole = "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
export type RetentionRecordType = "CONVERSATION" | "MESSAGE" | "MEMORY" | "AUDIT";

export interface MemoryScope {
  readonly kind: MemoryScopeKind;
  readonly scopeId?: string;
}

export interface RetentionAnchor {
  readonly anchorId: string;
  readonly recordType: RetentionRecordType;
  readonly recordId: string;
  readonly policyId: string;
  readonly retainUntil: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface ConversationRecord {
  readonly conversationId: string;
  readonly userId: string;
  readonly dataPolicy: DataPolicy;
  readonly retentionAnchorId: string;
  readonly expectedVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConversationMessage {
  readonly messageId: string;
  readonly conversationId: string;
  readonly role: ConversationMessageRole;
  readonly content: string;
  readonly dataPolicy: DataPolicy;
  readonly createdAt: string;
}

export interface MemoryRecord {
  readonly memoryId: string;
  readonly scope: MemoryScope;
  readonly content: string;
  readonly confidence: MemoryConfidence;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceRevision: number;
  readonly observedAt: string;
  readonly verifiedAt?: string;
  readonly staleAt?: string;
  readonly dataPolicy: DataPolicy;
  readonly retentionAnchorId: string;
  readonly expectedVersion: number;
}

export interface MemoryRetrievalRequest {
  readonly requestId: string;
  readonly applicableScopes: readonly MemoryScope[];
  readonly queryTerms: readonly string[];
  readonly dataPolicy: DataPolicy;
  readonly limit: number;
  readonly now: string;
  readonly authoritativeSourceIds: readonly string[];
}

export interface MemoryRetrievalResult {
  readonly memory: MemoryRecord;
  readonly rankScore: number;
}
