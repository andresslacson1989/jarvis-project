import type {
  PlatformBackendRegistration,
  PlatformCapabilityBindings,
} from "../../../packages/platform-contracts/src/composition";

export const WINDOWS_V1_BACKEND_PROFILE_ID = "windows-v1-x64-full-host" as const;

function createUnboundWindowsCapabilities(): PlatformCapabilityBindings {
  return Object.freeze({
    secureStorage: null,
    localIpc: null,
    processSupervisor: null,
    sessionObserver: null,
    windowController: null,
    notificationBackend: null,
    pathsAndIdentity: null,
    audioBackend: null,
    updateBackend: null,
    privilegeMediator: null,
    systemInfo: null,
  });
}

/**
 * V1 composition registration only. Concrete Windows capabilities are supplied
 * and qualified by their owning later subsections. Registration alone does not
 * make any capability AVAILABLE/QUALIFIED or claim release support evidence.
 */
export const WINDOWS_V1_BACKEND_REGISTRATION: PlatformBackendRegistration =
  Object.freeze({
    identity: Object.freeze({
      platform: "WINDOWS",
      runtimeRole: "FULL_HOST",
      architecture: "x64",
      backendProfileId: WINDOWS_V1_BACKEND_PROFILE_ID,
    }),
    createCapabilityBindings: createUnboundWindowsCapabilities,
  });
