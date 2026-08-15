import type { DataSensitivity } from "./data.ts";
import type { SessionState } from "./session.ts";

export const SESSION_NOTIFICATION_CHANNELS = ["VOICE", "DESKTOP", "DASHBOARD", "SILENT"] as const;
export type SessionNotificationChannel = (typeof SESSION_NOTIFICATION_CHANNELS)[number];

export interface LockedSessionNotificationRequest {
  readonly session: Pick<SessionState, "state">;
  readonly sensitivity: DataSensitivity;
  readonly requestedChannels: readonly SessionNotificationChannel[];
}

export interface LockedSessionNotificationDecision {
  readonly channels: readonly SessionNotificationChannel[];
  readonly contentSuppressed: boolean;
  readonly deferUntilUnlocked: boolean;
}

function isPublic(sensitivity: DataSensitivity): boolean {
  return sensitivity === "PUBLIC";
}

function channels(value: readonly SessionNotificationChannel[]): readonly SessionNotificationChannel[] {
  const unique = [...new Set(value)];
  if (unique.length !== value.length || unique.length > SESSION_NOTIFICATION_CHANNELS.length) {
    throw new Error("notification channels must be unique and bounded");
  }
  for (const channel of unique) {
    if (!(SESSION_NOTIFICATION_CHANNELS as readonly string[]).includes(channel)) {
      throw new Error("notification channel is unsupported");
    }
  }
  return Object.freeze(unique);
}

export function shouldSuppressLockedSessionContent(
  session: Pick<SessionState, "state">,
  sensitivity: DataSensitivity,
): boolean {
  return session.state !== "UNLOCKED" && !isPublic(sensitivity);
}

export function decideLockedSessionNotification(
  request: LockedSessionNotificationRequest,
): LockedSessionNotificationDecision {
  const requested = channels(request.requestedChannels);
  const suppressed = shouldSuppressLockedSessionContent(request.session, request.sensitivity);
  if (!suppressed) {
    return Object.freeze({ channels: requested, contentSuppressed: false, deferUntilUnlocked: false });
  }
  return Object.freeze({ channels: Object.freeze(["SILENT"] as const), contentSuppressed: true, deferUntilUnlocked: true });
}
