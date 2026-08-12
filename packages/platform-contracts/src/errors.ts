import type {
  PlatformCapabilityId,
  PlatformCapabilityStatus,
} from "./capabilities";

/** Stable JARVIS platform failure/reason codes established by the platform contract. */
export const PLATFORM_ERROR_CODES = [
  "PLATFORM_CAPABILITY_UNAVAILABLE",
  "PLATFORM_BACKEND_UNQUALIFIED",
  "PLATFORM_SECURE_STORAGE_FAILED",
  "PLATFORM_IPC_SECURITY_FAILED",
  "PLATFORM_PROCESS_CONTAINMENT_FAILED",
  "PLATFORM_SESSION_OBSERVER_FAILED",
  "PLATFORM_UPDATE_FAILED",
] as const;

export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[number];

/**
 * Cross-boundary platform failure identity. Platform adapters may retain
 * sanitized native diagnostics internally, but feature/UI code branches on the
 * stable code and semantic capability rather than native human-readable text.
 */
export interface PlatformFailure<
  TCapability extends PlatformCapabilityId = PlatformCapabilityId,
> {
  readonly code: PlatformErrorCode;
  readonly capability: TCapability;
}

export type PlatformCapabilityCheck<
  TCapability extends PlatformCapabilityId = PlatformCapabilityId,
> =
  | {
      readonly ready: true;
      readonly status: PlatformCapabilityStatus<TCapability>;
    }
  | {
      readonly ready: false;
      readonly status: PlatformCapabilityStatus<TCapability>;
      readonly failure: PlatformFailure<TCapability> & {
        readonly code:
          | "PLATFORM_CAPABILITY_UNAVAILABLE"
          | "PLATFORM_BACKEND_UNQUALIFIED";
      };
    };

/**
 * Converts technical discovery into a stable fail/degrade admission fact.
 * A `ready: true` result is still not authorization or a production-support
 * claim; it means only that the semantic native capability is technically
 * available and qualified for the current backend context.
 */
export function checkPlatformCapability<
  TCapability extends PlatformCapabilityId,
>(
  status: PlatformCapabilityStatus<TCapability>,
): PlatformCapabilityCheck<TCapability> {
  if (status.availability === "UNAVAILABLE") {
    return {
      ready: false,
      status,
      failure: {
        code: "PLATFORM_CAPABILITY_UNAVAILABLE",
        capability: status.capability,
      },
    };
  }

  if (status.qualification === "UNQUALIFIED") {
    return {
      ready: false,
      status,
      failure: {
        code: "PLATFORM_BACKEND_UNQUALIFIED",
        capability: status.capability,
      },
    };
  }

  return { ready: true, status };
}
