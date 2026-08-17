import type { ProjectId, UUIDv7, UtcTimestamp } from "./common.js";

export type SessionTrustState = "LOCKED" | "UNLOCKING" | "UNLOCKED" | "LOCKING";
export type SessionLockedReason =
  | "STARTUP"
  | "USER"
  | "OS_SESSION_LOCK"
  | "OS_SESSION_END"
  | "IDLE"
  | "SECURITY";

export interface SessionState {
  state: SessionTrustState;
  sessionId: UUIDv7 | null;
  unlockedAt: UtcTimestamp | null;
  lockedReason: SessionLockedReason | null;
}

/**
 * Durable authentication state for the single authoritative local session.
 * Passwords, verifiers, and derived key material are deliberately not part
 * of this record.
 */
export interface SessionSecurityState extends SessionState {
  userId: string;
  failedUnlockAttempts: number;
  cooldownUntil: UtcTimestamp | null;
}

export type InputModality = "TEXT" | "VOICE";
export type InstructionOrigin = "LOCAL_UI" | "LOCAL_VOICE" | "AUTOMATION" | "EVENT_GATEWAY";

export interface UserInstruction {
  id: UUIDv7;
  sessionId: UUIDv7;
  modality: InputModality;
  origin: InstructionOrigin;
  text: string;
  receivedAt: UtcTimestamp;
  conversationId: UUIDv7;
  activeProjectHint?: ProjectId;
  voiceMetadata?: {
    transcriptConfidence?: number;
    utteranceId: UUIDv7;
  };
}
