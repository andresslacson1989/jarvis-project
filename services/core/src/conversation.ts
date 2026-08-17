import type { ContextPackageV1, StructuredAiOutputV1 } from "../../../packages/protocol/src/content-authority.js";
import {
  assertAuthenticatedSession,
  bindConversationContext,
  validateAuthenticatedTextConversationInput,
  validateConversationStructuredDecision,
  ConversationValidationError,
} from "../../../packages/protocol/src/conversation-runtime.mjs";
import type {
  AuthenticatedTextConversationInputV1,
  ConversationStructuredDecisionV1,
} from "../../../packages/protocol/src/conversation.js";
import { validateProviderAdapterResult } from "../../../packages/protocol/src/provider-runtime.mjs";
import type { ProviderAdapterResult } from "../../../packages/protocol/src/provider.js";
import type { UserInstruction } from "../../../packages/protocol/src/session.js";
import { CoreSchemaError, CoreStateRepository } from "./schema.js";

export interface ConversationOrchestratorRequest {
  readonly input: AuthenticatedTextConversationInputV1;
  readonly context: ContextPackageV1;
  readonly repairAttempt: boolean;
}

export type ConversationOrchestrator = (request: ConversationOrchestratorRequest) => Promise<unknown>;

export interface ConversationServiceOptions {
  readonly providerId: string;
  readonly repository: CoreStateRepository;
  readonly orchestrator: ConversationOrchestrator;
  readonly createMessageId: () => string;
}

export interface ConversationPipelineResult {
  readonly instructionId: string;
  readonly context: ContextPackageV1;
  readonly providerResult: ProviderAdapterResult;
  readonly decision: ConversationStructuredDecisionV1;
  readonly repaired: boolean;
}

export type ConversationServiceErrorCode = "AUTHENTICATION_REQUIRED" | "PROVIDER_RESULT_INVALID" | "DECISION_INVALID" | "PROVIDER_ERROR" | "PERSISTENCE_FAILED";

export class ConversationServiceError extends Error {
  readonly code: ConversationServiceErrorCode;

  constructor(code: ConversationServiceErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConversationServiceError";
    this.code = code;
  }
}

function extractDecision(result: ProviderAdapterResult): ConversationStructuredDecisionV1 {
  if (result.error !== undefined) throw new ConversationServiceError("PROVIDER_ERROR", result.error.safeMessage);
  if (result.requestId.length < 1 || result.executionMode !== "ONE_SHOT" || result.output === undefined) throw new ConversationServiceError("PROVIDER_RESULT_INVALID", "provider result is not a completed one-shot output");
  const output: StructuredAiOutputV1 = result.output;
  if (output.items.length !== 1 || output.items[0]?.kind !== "DATA") throw new ConversationServiceError("DECISION_INVALID", "provider output must contain exactly one structured decision");
  try {
    return validateConversationStructuredDecision(output.items[0].data);
  } catch (error) {
    throw new ConversationServiceError("DECISION_INVALID", "provider output did not contain a valid structured decision", { cause: error });
  }
}

function isRepairable(error: unknown): boolean {
  return error instanceof ConversationValidationError
    || error instanceof ConversationServiceError && ["PROVIDER_RESULT_INVALID", "DECISION_INVALID"].includes(error.code)
    || error instanceof Error && error.name === "ProviderStateValidationError";
}

export class ConversationService {
  private readonly providerId: string;
  private readonly repository: CoreStateRepository;
  private readonly orchestrator: ConversationOrchestrator;
  private readonly createMessageId: () => string;

  constructor(options: ConversationServiceOptions) {
    if (!options.providerId || typeof options.providerId !== "string") throw new ConversationServiceError("PROVIDER_RESULT_INVALID", "provider identity is required");
    this.providerId = options.providerId;
    this.repository = options.repository;
    this.orchestrator = options.orchestrator;
    this.createMessageId = options.createMessageId;
  }

  async processAuthenticatedText(inputValue: unknown): Promise<ConversationPipelineResult> {
    let input: AuthenticatedTextConversationInputV1;
    try {
      input = validateAuthenticatedTextConversationInput(inputValue);
      const session = this.repository.getSessionSecurityState();
      if (!session) throw new ConversationValidationError("an authenticated session is not initialized");
      assertAuthenticatedSession(session, input.instruction);
    } catch (error) {
      throw new ConversationServiceError("AUTHENTICATION_REQUIRED", "authenticated text input was rejected", { cause: error });
    }

    const context = bindConversationContext(input);
    const instruction = input.instruction as UserInstruction;
    try {
      this.repository.appendConversationMessage({
        messageId: instruction.id,
        conversationId: instruction.conversationId,
        role: "USER",
        content: instruction.text,
        dataPolicy: input.dataPolicy,
        createdAt: instruction.receivedAt,
      });
    } catch (error) {
      throw new ConversationServiceError("PERSISTENCE_FAILED", "conversation input could not be recorded", { cause: error });
    }

    let repaired = false;
    let providerResult: ProviderAdapterResult | undefined;
    let decision: ConversationStructuredDecisionV1 | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const rawResult = await this.orchestrator({ input, context, repairAttempt: attempt === 1 });
        providerResult = validateProviderAdapterResult(rawResult);
        if (providerResult.providerId !== this.providerId || providerResult.requestId !== instruction.id) throw new ConversationServiceError("PROVIDER_RESULT_INVALID", "provider result identity does not match the authenticated request");
        decision = extractDecision(providerResult);
        repaired = attempt === 1;
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0 && isRepairable(error)) continue;
        if (error instanceof ConversationServiceError) throw error;
        throw new ConversationServiceError("PROVIDER_RESULT_INVALID", "provider result failed validation", { cause: error });
      }
    }
    if (providerResult === undefined || decision === undefined) throw new ConversationServiceError("PROVIDER_RESULT_INVALID", "provider did not produce a valid structured decision", { cause: lastError });

    try {
      this.repository.appendConversationMessage({
        messageId: this.createMessageId(),
        conversationId: instruction.conversationId,
        role: "ASSISTANT",
        content: decision.text,
        dataPolicy: input.dataPolicy,
        createdAt: providerResult.completedAt,
      });
    } catch (error) {
      if (error instanceof CoreSchemaError) throw new ConversationServiceError("PERSISTENCE_FAILED", "conversation decision could not be recorded", { cause: error });
      throw new ConversationServiceError("PERSISTENCE_FAILED", "conversation decision could not be recorded", { cause: error });
    }
    return Object.freeze({ instructionId: instruction.id, context, providerResult, decision, repaired });
  }
}
