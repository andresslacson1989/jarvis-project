import type { SessionSecurityState, SessionState, SessionTrustState, SessionLockedReason } from "./session.ts";

const SESSION_STATES = ["LOCKED", "UNLOCKING", "UNLOCKED", "LOCKING"] as const;
const LOCKED_REASONS = ["STARTUP", "USER", "OS_SESSION_LOCK", "OS_SESSION_END", "IDLE", "SECURITY"] as const;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const SESSION_COOLDOWN_BASE_MS = 1_000;
export const SESSION_COOLDOWN_MAX_MS = 15 * 60 * 1_000;
export const SESSION_MAX_FAILED_UNLOCK_ATTEMPTS = 31;

export class SessionValidationError extends Error {
  constructor(message: string) { super(message); this.name = "SessionValidationError"; }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SessionValidationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    throw new SessionValidationError("session record contains unsupported or missing fields");
  }
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 64 || Number.isNaN(Date.parse(value))) {
    throw new SessionValidationError(`${label} must be an ISO timestamp`);
  }
  return value;
}

function nullableTimestamp(value: unknown, label: string): string | null {
  return value === null ? null : timestamp(value, label);
}

function sessionId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !UUID_V7.test(value)) throw new SessionValidationError("sessionId must be UUIDv7 or null");
  return value;
}

function state(value: unknown): SessionTrustState {
  if (typeof value !== "string" || !(SESSION_STATES as readonly string[]).includes(value)) throw new SessionValidationError("session state is invalid");
  return value as SessionTrustState;
}

function lockedReason(value: unknown): SessionLockedReason | null {
  if (value === null) return null;
  if (typeof value !== "string" || !(LOCKED_REASONS as readonly string[]).includes(value)) throw new SessionValidationError("locked reason is invalid");
  return value as SessionLockedReason;
}

export function validateSessionState(value: unknown): SessionState {
  const input = record(value, "session state");
  exactKeys(input, ["state", "sessionId", "unlockedAt", "lockedReason"]);
  const currentState = state(input.state);
  const result = Object.freeze({
    state: currentState,
    sessionId: sessionId(input.sessionId),
    unlockedAt: nullableTimestamp(input.unlockedAt, "unlockedAt"),
    lockedReason: lockedReason(input.lockedReason),
  });
  if (currentState === "UNLOCKED" && (result.sessionId === null || result.unlockedAt === null || result.lockedReason !== null)) {
    throw new SessionValidationError("UNLOCKED session must have an id/time and no locked reason");
  }
  if (currentState !== "UNLOCKED" && result.unlockedAt !== null) throw new SessionValidationError("locked session cannot retain unlockedAt");
  if (currentState === "LOCKED" && result.lockedReason === null) throw new SessionValidationError("LOCKED session requires a reason");
  return result;
}

export function validateSessionSecurityState(value: unknown): SessionSecurityState {
  const input = record(value, "session security state");
  exactKeys(input, ["userId", "state", "sessionId", "unlockedAt", "lockedReason", "failedUnlockAttempts", "cooldownUntil"]);
  if (typeof input.userId !== "string" || input.userId.length < 1 || input.userId.length > 256 || input.userId.includes("\0")) throw new SessionValidationError("userId is invalid");
  if (!Number.isSafeInteger(input.failedUnlockAttempts) || (input.failedUnlockAttempts as number) < 0 || (input.failedUnlockAttempts as number) > SESSION_MAX_FAILED_UNLOCK_ATTEMPTS) throw new SessionValidationError("failedUnlockAttempts is invalid");
  const base = validateSessionState({ state: input.state, sessionId: input.sessionId, unlockedAt: input.unlockedAt, lockedReason: input.lockedReason });
  return Object.freeze({ ...base, userId: input.userId, failedUnlockAttempts: input.failedUnlockAttempts as number, cooldownUntil: nullableTimestamp(input.cooldownUntil, "cooldownUntil") });
}

export function progressiveCooldownMs(failedUnlockAttempts: number): number {
  if (!Number.isSafeInteger(failedUnlockAttempts) || failedUnlockAttempts < 0 || failedUnlockAttempts > SESSION_MAX_FAILED_UNLOCK_ATTEMPTS) throw new SessionValidationError("failedUnlockAttempts is invalid");
  return Math.min(SESSION_COOLDOWN_MAX_MS, SESSION_COOLDOWN_BASE_MS * (2 ** Math.min(failedUnlockAttempts - 1, 10)));
}

export function isSessionCooldownActive(state: Pick<SessionSecurityState, "cooldownUntil">, now: string): boolean {
  const current = Date.parse(now);
  if (Number.isNaN(current)) throw new SessionValidationError("now must be an ISO timestamp");
  return state.cooldownUntil !== null && Date.parse(state.cooldownUntil) > current;
}
