import type {
  ContentAuthorityClass,
  ContentAuthorityLabelV1,
  ContentSourceType,
  ContextItemV1,
  ContextPackageV1,
  StructuredAiDataItemV1,
  StructuredAiOutputItemV1,
  StructuredAiOutputV1,
  StructuredAiTextItemV1,
} from "./content-authority.ts";

export class ContentAuthorityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentAuthorityValidationError";
  }
}

const CONTENT_SOURCE_TYPES = new Set<ContentSourceType>([
  "SYSTEM_POLICY",
  "USER_INSTRUCTION",
  "PROJECT_POLICY",
  "VERIFIED_STATE",
  "RETRIEVED_MEMORY",
  "UNTRUSTED_EXTERNAL_CONTENT",
  "TASK_ARTIFACT",
  "AI_OUTPUT",
]);
const AUTHORITY_CLASSES = new Set<ContentAuthorityClass>(["CONTENT_ONLY", "SCOPED_INSTRUCTION", "VERIFIED_STATE"]);
const SCOPED_INSTRUCTION_SOURCES = new Set<ContentSourceType>(["SYSTEM_POLICY", "USER_INSTRUCTION", "PROJECT_POLICY"]);
const SECRET_OR_AUTHORITY_KEY = /(?:password|secret|token|private[_-]?key|credential|authority|permission|approval|execute|command|shell|elevation|scope|policy|module|provider.?setup)/iu;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContentAuthorityValidationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) {
    throw new ContentAuthorityValidationError("content record contains unsupported or missing fields");
  }
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || value.includes("\0")) {
    throw new ContentAuthorityValidationError(`${label} is invalid`);
  }
  return value;
}

function opaqueId(value: unknown, label: string): string {
  const result = text(value, label, 256);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(result)) {
    throw new ContentAuthorityValidationError(`${label} is not an opaque identifier`);
  }
  return result;
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label, 64);
  if (Number.isNaN(Date.parse(result))) {
    throw new ContentAuthorityValidationError(`${label} must be an ISO timestamp`);
  }
  return result;
}

function enumValue<T extends string>(value: unknown, values: ReadonlySet<T>, label: string): T {
  if (typeof value !== "string" || !values.has(value as T)) {
    throw new ContentAuthorityValidationError(`${label} is unsupported`);
  }
  return value as T;
}

function validateResolutionId(value: unknown): string {
  return opaqueId(value, "resolutionId");
}

export function validateContentAuthorityLabel(value: unknown): ContentAuthorityLabelV1 {
  const input = record(value, "content authority label");
  keys(input, ["domain", "schemaVersion", "sourceType", "sourceId", "authorityClass"], ["resolutionId"]);
  if (input.domain !== "jarvis.content-authority.label.v1" || input.schemaVersion !== 1) {
    throw new ContentAuthorityValidationError("content authority label identity/version is invalid");
  }
  const sourceType = enumValue(input.sourceType, CONTENT_SOURCE_TYPES, "sourceType");
  const authorityClass = enumValue(input.authorityClass, AUTHORITY_CLASSES, "authorityClass");
  const sourceId = opaqueId(input.sourceId, "sourceId");
  const resolutionId = input.resolutionId === undefined ? undefined : validateResolutionId(input.resolutionId);

  if (sourceType === "AI_OUTPUT" || sourceType === "UNTRUSTED_EXTERNAL_CONTENT" || sourceType === "TASK_ARTIFACT") {
    if (authorityClass !== "CONTENT_ONLY" || resolutionId !== undefined) {
      throw new ContentAuthorityValidationError("untrusted content cannot carry scoped authority");
    }
  } else if (authorityClass === "SCOPED_INSTRUCTION") {
    if (!SCOPED_INSTRUCTION_SOURCES.has(sourceType) || resolutionId === undefined) {
      throw new ContentAuthorityValidationError("scoped instruction requires Core resolution evidence");
    }
  } else if (authorityClass === "VERIFIED_STATE" && sourceType !== "VERIFIED_STATE") {
    throw new ContentAuthorityValidationError("verified-state authority requires verified-state provenance");
  } else if (resolutionId !== undefined) {
    throw new ContentAuthorityValidationError("resolution evidence is invalid for this content authority class");
  }

  return Object.freeze({
    domain: "jarvis.content-authority.label.v1",
    schemaVersion: 1,
    sourceType,
    sourceId,
    authorityClass,
    ...(resolutionId === undefined ? {} : { resolutionId }),
  });
}

function validateContextItem(value: unknown): ContextItemV1 {
  const input = record(value, "context item");
  keys(input, ["itemId", "sourceLabel", "content"], ["policyRevision"]);
  const sourceLabel = validateContentAuthorityLabel(input.sourceLabel);
  const content = text(input.content, "context content", 32768);
  if (input.policyRevision !== undefined && (!Number.isSafeInteger(input.policyRevision) || (input.policyRevision as number) < 1)) {
    throw new ContentAuthorityValidationError("context policy revision is invalid");
  }
  if (sourceLabel.sourceType === "PROJECT_POLICY") {
    if (sourceLabel.authorityClass !== "SCOPED_INSTRUCTION" || sourceLabel.resolutionId === undefined || input.policyRevision === undefined) {
      throw new ContentAuthorityValidationError("trusted project-policy context requires resolution and revision evidence");
    }
  } else if (input.policyRevision !== undefined) {
    throw new ContentAuthorityValidationError("policy revision evidence is only valid for trusted project-policy context");
  }
  return Object.freeze({ itemId: opaqueId(input.itemId, "context itemId"), sourceLabel, content, ...(input.policyRevision === undefined ? {} : { policyRevision: input.policyRevision as number }) });
}

export function validateContextPackage(value: unknown): ContextPackageV1 {
  const input = record(value, "context package");
  keys(input, ["domain", "schemaVersion", "contextId", "items"], ["projectId"]);
  if (input.domain !== "jarvis.context-package.v1" || input.schemaVersion !== 1) throw new ContentAuthorityValidationError("context package identity/version is invalid");
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 128) throw new ContentAuthorityValidationError("context package items are invalid");
  const items = input.items.map((item) => validateContextItem(item));
  if (new Set(items.map((item) => item.itemId)).size !== items.length) throw new ContentAuthorityValidationError("context package item IDs must be unique");
  if (items.reduce((total, item) => total + item.content.length, 0) > 262144) throw new ContentAuthorityValidationError("context package exceeds the bounded content limit");
  return Object.freeze({ domain: "jarvis.context-package.v1", schemaVersion: 1, contextId: opaqueId(input.contextId, "contextId"), ...(input.projectId === undefined ? {} : { projectId: opaqueId(input.projectId, "projectId") }), items: Object.freeze(items) });
}

export function buildContextPackage(value: unknown): ContextPackageV1 {
  return validateContextPackage(value);
}

function boundedData(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    throw new ContentAuthorityValidationError("structured AI data is too deeply nested");
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new ContentAuthorityValidationError("structured AI data contains a non-finite number");
    }
    return value;
  }
  if (typeof value === "string") {
    return text(value, "structured AI data string", 8192);
  }
  if (Array.isArray(value)) {
    if (value.length > 128) {
      throw new ContentAuthorityValidationError("structured AI data array is too large");
    }
    return Object.freeze(value.map((item) => boundedData(item, depth + 1)));
  }
  const input = record(value, "structured AI data");
  if (Object.keys(input).length > 64) {
    throw new ContentAuthorityValidationError("structured AI data object is too large");
  }
  const entries = Object.entries(input).map(([key, item]) => {
    if (key.length < 1 || key.length > 128 || key.includes("\0")) {
      throw new ContentAuthorityValidationError("structured AI data key is invalid");
    }
    if (SECRET_OR_AUTHORITY_KEY.test(key)) {
      throw new ContentAuthorityValidationError(`structured AI data key '${key}' is not permitted`);
    }
    return [key, boundedData(item, depth + 1)] as const;
  });
  return Object.freeze(Object.fromEntries(entries));
}

function validateItem(value: unknown): StructuredAiOutputItemV1 {
  const input = record(value, "structured AI output item");
  keys(input, ["kind"], ["text", "data"]);
  if (input.kind === "TEXT") {
    keys(input, ["kind", "text"]);
    const item: StructuredAiTextItemV1 = { kind: "TEXT", text: text(input.text, "structured AI text", 8192) };
    return Object.freeze(item);
  }
  if (input.kind === "DATA") {
    keys(input, ["kind", "data"]);
    const item: StructuredAiDataItemV1 = { kind: "DATA", data: boundedData(input.data) };
    return Object.freeze(item);
  }
  throw new ContentAuthorityValidationError("structured AI output item kind is unsupported");
}

export function validateStructuredAiOutput(value: unknown): StructuredAiOutputV1 {
  const input = record(value, "structured AI output");
  keys(input, ["domain", "schemaVersion", "outputId", "providerId", "generatedAt", "sourceLabel", "items"]);
  if (input.domain !== "jarvis.ai-output.v1" || input.schemaVersion !== 1) {
    throw new ContentAuthorityValidationError("structured AI output identity/version is invalid");
  }
  const sourceLabel = validateContentAuthorityLabel(input.sourceLabel);
  if (sourceLabel.sourceType !== "AI_OUTPUT" || sourceLabel.authorityClass !== "CONTENT_ONLY") {
    throw new ContentAuthorityValidationError("AI output must remain content-only and AI-sourced");
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 64) {
    throw new ContentAuthorityValidationError("structured AI output items are invalid");
  }
  const items = input.items.map((item) => validateItem(item));
  return Object.freeze({
    domain: "jarvis.ai-output.v1",
    schemaVersion: 1,
    outputId: opaqueId(input.outputId, "outputId"),
    providerId: opaqueId(input.providerId, "providerId"),
    generatedAt: timestamp(input.generatedAt, "generatedAt"),
    sourceLabel,
    items: Object.freeze(items),
  });
}
