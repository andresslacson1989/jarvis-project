import type {
  PlatformCompositionRequest,
  PlatformCompositionResult,
} from "../packages/platform-contracts/src/composition";
import { WINDOWS_V1_BACKEND_REGISTRATION } from "./windows/src/registration";

/**
 * Narrow V1 platform composition root. OS/runtime selection belongs here, not
 * in shared domain/feature code. Only the qualified V1 target tuple is
 * registered. Future platform namespaces do not become runtime registrations.
 */
export function composePlatformBackend(
  request: PlatformCompositionRequest,
): PlatformCompositionResult {
  const identity = WINDOWS_V1_BACKEND_REGISTRATION.identity;

  if (
    request.platform === identity.platform &&
    request.runtimeRole === identity.runtimeRole &&
    request.architecture === identity.architecture
  ) {
    return Object.freeze({
      status: "SELECTED",
      backend: WINDOWS_V1_BACKEND_REGISTRATION,
    });
  }

  return Object.freeze({
    status: "UNAVAILABLE",
    reason: "PLATFORM_BACKEND_UNQUALIFIED",
    request: Object.freeze({ ...request }),
  });
}
