import type { AuthenticatedTextConversationInputV1, ConversationDecisionKind, ConversationStructuredDecisionV1, ConversationWorkProposalV1 } from "./conversation.ts";
import type { ContextPackageV1 } from "./content-authority.ts";
import type { DataPolicy } from "./data.ts";
import type { UserInstruction } from "./session.ts";
import { buildContextPackage } from "./content-authority-runtime.mjs";

export class ConversationValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ConversationValidationError"; }
}

const DECISION_KINDS = new Set<ConversationDecisionKind>(["ANSWER", "PROPOSE_WORK", "ASK_CLARIFICATION", "REFUSE"]);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ConversationValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) throw new ConversationValidationError("conversation record contains unsupported or missing fields");
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || value.includes("\0")) throw new ConversationValidationError(`${label} is invalid`);
  return value;
}

function id(value: unknown, label: string): string {
  return text(value, label, 256).match(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u) ? value as string : (() => { throw new ConversationValidationError(`${label} is invalid`); })();
}

function dataPolicy(value: unknown): DataPolicy {
  const input = record(value, "data policy");
  keys(input, ["sensitivity", "locality"]);
  if (!["PUBLIC", "PRIVATE", "SENSITIVE", "SECRET"].includes(input.sensitivity as string)) throw new ConversationValidationError("data policy sensitivity is invalid");
  if (!["LOCAL_ONLY", "ANY_APPROVED_PROVIDER"].includes(input.locality as string)) throw new ConversationValidationError("data policy locality is invalid");
  if (input.sensitivity === "SECRET") throw new ConversationValidationError("SECRET content cannot enter the normal conversation pipeline");
  return Object.freeze({ sensitivity: input.sensitivity as DataPolicy["sensitivity"], locality: input.locality as DataPolicy["locality"] });
}

function validateInstruction(value: unknown): UserInstruction {
  const input = record(value, "conversation instruction");
  keys(input, ["id", "sessionId", "modality", "origin", "text", "receivedAt", "conversationId"], ["activeProjectHint", "voiceMetadata"]);
  for (const key of ["id", "sessionId", "conversationId"] as const) {
    if (typeof input[key] !== "string" || !UUID_V7.test(input[key] as string)) throw new ConversationValidationError(`${key} must be UUIDv7`);
  }
  if (input.modality !== "TEXT" || input.origin !== "LOCAL_UI") throw new ConversationValidationError("authenticated text requires LOCAL_UI TEXT input");
  const textValue = text(input.text, "instruction text", 65536);
  if (typeof input.receivedAt !== "string" || Number.isNaN(Date.parse(input.receivedAt))) throw new ConversationValidationError("instruction timestamp is invalid");
  if (input.activeProjectHint !== undefined && (typeof input.activeProjectHint !== "string" || !UUID_V7.test(input.activeProjectHint))) throw new ConversationValidationError("active project hint is invalid");
  if (input.voiceMetadata !== undefined) throw new ConversationValidationError("text instruction cannot contain voice metadata");
  return Object.freeze({ id: input.id as string, sessionId: input.sessionId as string, modality: "TEXT", origin: "LOCAL_UI", text: textValue, receivedAt: input.receivedAt as string, conversationId: input.conversationId as string, ...(input.activeProjectHint === undefined ? {} : { activeProjectHint: input.activeProjectHint as string }) });
}

export function validateAuthenticatedTextConversationInput(value: unknown): AuthenticatedTextConversationInputV1 {
  const input = record(value, "authenticated text conversation input");
  keys(input, ["instruction", "context", "dataPolicy"]);
  const instruction = validateInstruction(input.instruction);
  const context = buildContextPackage(input.context) as ContextPackageV1;
  if (instruction.activeProjectHint !== undefined && context.projectId !== instruction.activeProjectHint) throw new ConversationValidationError("conversation context project does not match the active project hint");
  return Object.freeze({ instruction, context, dataPolicy: dataPolicy(input.dataPolicy) });
}

function workProposal(value: unknown): ConversationWorkProposalV1 {
  const input = record(value, "work proposal");
  keys(input, ["summary"]);
  return Object.freeze({ summary: text(input.summary, "work proposal summary", 4096) });
}

export function validateConversationStructuredDecision(value: unknown): ConversationStructuredDecisionV1 {
  const input = record(value, "conversation structured decision");
  keys(input, ["domain", "schemaVersion", "decisionId", "kind", "text"], ["proposedWork"]);
  if (input.domain !== "jarvis.structured-decision.v1" || input.schemaVersion !== 1) throw new ConversationValidationError("conversation decision identity/version is invalid");
  if (typeof input.kind !== "string" || !DECISION_KINDS.has(input.kind as ConversationDecisionKind)) throw new ConversationValidationError("conversation decision kind is invalid");
  const proposal = input.proposedWork === undefined ? undefined : workProposal(input.proposedWork);
  if (input.kind !== "PROPOSE_WORK" && proposal !== undefined) throw new ConversationValidationError("only PROPOSE_WORK may contain a work proposal");
  return Object.freeze({ domain: "jarvis.structured-decision.v1", schemaVersion: 1, decisionId: id(input.decisionId, "decisionId"), kind: input.kind as ConversationDecisionKind, text: text(input.text, "decision text", 8192), ...(proposal === undefined ? {} : { proposedWork: proposal }) });
}

export function bindConversationContext(inputValue: unknown): ContextPackageV1 {
  const input = validateAuthenticatedTextConversationInput(inputValue);
  return buildContextPackage({
    ...input.context,
    items: [
      ...input.context.items,
      {
        itemId: `instruction:${input.instruction.id}`,
        sourceLabel: {
          domain: "jarvis.content-authority.label.v1",
          schemaVersion: 1,
          sourceType: "USER_INSTRUCTION",
          sourceId: input.instruction.id,
          authorityClass: "SCOPED_INSTRUCTION",
          resolutionId: input.instruction.id,
        },
        content: input.instruction.text,
      },
    ],
  });
}

export function assertAuthenticatedSession(value: unknown, instruction: UserInstruction): void {
  const session = record(value, "authenticated session");
  if (session.state !== "UNLOCKED" || session.sessionId !== instruction.sessionId) throw new ConversationValidationError("an unlocked authenticated session is required");
}
