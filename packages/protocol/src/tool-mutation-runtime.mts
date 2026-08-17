import type { ToolConditionalMutationResult, ToolIdempotencyRecord, ToolIdempotencyStore, ToolTargetResolution } from "./tool.js";
import { assertTargetResolutionUnchanged, ToolTargetValidationError, validateToolTargetResolution } from "./tool-target-runtime.mjs";

function digest(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(value)) throw new ToolTargetValidationError(`${label} is invalid`);
  return value;
}

function key(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || value.includes("\0")) throw new ToolTargetValidationError("idempotency key is invalid");
  return value;
}

export async function executeConditionalMutation<T>(expectedValue: unknown, observedValue: unknown, mutate: (current: ToolTargetResolution) => Promise<T>): Promise<ToolConditionalMutationResult<T>> {
  let current: ToolTargetResolution;
  try {
    current = assertTargetResolutionUnchanged(expectedValue, observedValue);
  } catch (error) {
    if (error instanceof ToolTargetValidationError) return Object.freeze({ state: "CONFLICT", reasonCode: "TARGET_CHANGED" });
    return Object.freeze({ state: "UNCERTAIN", reasonCode: "TARGET_RESOLUTION_UNCERTAIN" });
  }
  try {
    const value = await mutate(current);
    return Object.freeze({ state: "APPLIED", value, reasonCode: "CONDITIONAL_MUTATION_APPLIED" });
  } catch {
    return Object.freeze({ state: "UNCERTAIN", reasonCode: "CONDITIONAL_MUTATION_UNCERTAIN" });
  }
}

export async function executeIdempotentMutation<T>(store: ToolIdempotencyStore<T>, idempotencyKeyValue: unknown, requestDigestValue: unknown, mutate: () => Promise<T>): Promise<ToolConditionalMutationResult<T>> {
  const idempotencyKey = key(idempotencyKeyValue);
  const requestDigest = digest(requestDigestValue, "requestDigest");
  const claim = await store.begin(idempotencyKey, requestDigest);
  if (claim.state === "REPLAY") return Object.freeze({ state: claim.record.state === "APPLIED" ? "APPLIED" : claim.record.state === "UNCERTAIN" ? "UNCERTAIN" : "CONFLICT", ...(claim.record.result === undefined ? {} : { value: claim.record.result }), reasonCode: "IDEMPOTENT_REPLAY" });
  if (claim.state === "CONFLICT") return Object.freeze({ state: "CONFLICT", reasonCode: "IDEMPOTENCY_KEY_REUSED" });
  try {
    const value = await mutate();
    await store.finish(idempotencyKey, requestDigest, { idempotencyKey, requestDigest, state: "APPLIED", result: value });
    return Object.freeze({ state: "APPLIED", value, reasonCode: "IDEMPOTENT_MUTATION_APPLIED" });
  } catch {
    const record: ToolIdempotencyRecord<T> = { idempotencyKey, requestDigest, state: "UNCERTAIN" };
    try { await store.finish(idempotencyKey, requestDigest, record); } catch { /* preserve UNCERTAIN when durable recording is unavailable */ }
    return Object.freeze({ state: "UNCERTAIN", reasonCode: "IDEMPOTENT_MUTATION_UNCERTAIN" });
  }
}

export function validateIdempotencyRecord<T>(value: unknown): ToolIdempotencyRecord<T> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ToolTargetValidationError("idempotency record must be an object");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["idempotencyKey", "requestDigest", "state", "result"]);
  if (Object.keys(input).some((item) => !allowed.has(item)) || !("idempotencyKey" in input) || !("requestDigest" in input) || !("state" in input)) throw new ToolTargetValidationError("idempotency record contains unsupported or missing fields");
  const state = input.state;
  if (state !== "IN_FLIGHT" && state !== "APPLIED" && state !== "FAILED" && state !== "UNCERTAIN") throw new ToolTargetValidationError("idempotency record state is invalid");
  key(input.idempotencyKey);
  digest(input.requestDigest, "requestDigest");
  return Object.freeze({ idempotencyKey: input.idempotencyKey as string, requestDigest: input.requestDigest as string, state, ...(input.result === undefined ? {} : { result: input.result as T }) });
}

