export const CONTENT_SOURCE_TYPES = [
  "SYSTEM_POLICY",
  "USER_INSTRUCTION",
  "PROJECT_POLICY",
  "VERIFIED_STATE",
  "RETRIEVED_MEMORY",
  "UNTRUSTED_EXTERNAL_CONTENT",
  "TASK_ARTIFACT",
  "AI_OUTPUT",
] as const;

export type ContentSourceType = (typeof CONTENT_SOURCE_TYPES)[number];
export type ContentAuthorityClass = "CONTENT_ONLY" | "SCOPED_INSTRUCTION" | "VERIFIED_STATE";

/**
 * A label describes content provenance. It is not an authority grant.
 * Core resolution evidence is required before an instruction source may be
 * treated as scoped policy, and AI/external content can never satisfy it.
 */
export interface ContentAuthorityLabelV1 {
  readonly domain: "jarvis.content-authority.label.v1";
  readonly schemaVersion: 1;
  readonly sourceType: ContentSourceType;
  readonly sourceId: string;
  readonly authorityClass: ContentAuthorityClass;
  readonly resolutionId?: string;
}

export interface ContextItemV1 {
  readonly itemId: string;
  readonly sourceLabel: ContentAuthorityLabelV1;
  readonly content: string;
  readonly policyRevision?: number;
}

export interface ContextPackageV1 {
  readonly domain: "jarvis.context-package.v1";
  readonly schemaVersion: 1;
  readonly contextId: string;
  readonly projectId?: string;
  readonly items: readonly ContextItemV1[];
}

export interface StructuredAiTextItemV1 {
  readonly kind: "TEXT";
  readonly text: string;
}

export interface StructuredAiDataItemV1 {
  readonly kind: "DATA";
  readonly data: unknown;
}

export type StructuredAiOutputItemV1 = StructuredAiTextItemV1 | StructuredAiDataItemV1;

export interface StructuredAiOutputV1 {
  readonly domain: "jarvis.ai-output.v1";
  readonly schemaVersion: 1;
  readonly outputId: string;
  readonly providerId: string;
  readonly generatedAt: string;
  readonly sourceLabel: ContentAuthorityLabelV1;
  readonly items: readonly StructuredAiOutputItemV1[];
}
