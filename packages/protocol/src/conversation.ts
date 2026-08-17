import type { ContextPackageV1 } from "./content-authority.js";
import type { DataPolicy } from "./data.js";
import type { UserInstruction } from "./session.js";

export type ConversationDecisionKind = "ANSWER" | "PROPOSE_WORK" | "ASK_CLARIFICATION" | "REFUSE";

export interface ConversationWorkProposalV1 {
  readonly summary: string;
}

export interface ConversationStructuredDecisionV1 {
  readonly domain: "jarvis.structured-decision.v1";
  readonly schemaVersion: 1;
  readonly decisionId: string;
  readonly kind: ConversationDecisionKind;
  readonly text: string;
  readonly proposedWork?: ConversationWorkProposalV1;
}

export interface AuthenticatedTextConversationInputV1 {
  readonly instruction: UserInstruction;
  readonly context: ContextPackageV1;
  readonly dataPolicy: DataPolicy;
}
