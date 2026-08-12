import type {
  PlatformFamily,
  PlatformRuntimeIdentity,
  RuntimeRole,
} from "../../protocol/src/platform";
import type {
  PlatformAudioBackend,
  PlatformLocalIpc,
  PlatformNotificationBackend,
  PlatformPathsAndIdentity,
  PlatformPrivilegeMediator,
  PlatformProcessSupervisor,
  PlatformSecureStorage,
  PlatformSessionObserver,
  PlatformSystemInfo,
  PlatformUpdateBackend,
  PlatformWindowController,
} from "./capabilities";

/**
 * Concrete native capability instances owned by one selected platform backend.
 * `null` means the capability implementation has not yet been supplied by its
 * owning subsection; null never implies a fallback or technical qualification.
 */
export interface PlatformCapabilityBindings {
  readonly secureStorage: PlatformSecureStorage | null;
  readonly localIpc: PlatformLocalIpc | null;
  readonly processSupervisor: PlatformProcessSupervisor | null;
  readonly sessionObserver: PlatformSessionObserver | null;
  readonly windowController: PlatformWindowController | null;
  readonly notificationBackend: PlatformNotificationBackend | null;
  readonly pathsAndIdentity: PlatformPathsAndIdentity | null;
  readonly audioBackend: PlatformAudioBackend | null;
  readonly updateBackend: PlatformUpdateBackend | null;
  readonly privilegeMediator: PlatformPrivilegeMediator | null;
  readonly systemInfo: PlatformSystemInfo | null;
}

export interface PlatformBackendRegistration {
  readonly identity: PlatformRuntimeIdentity;
  createCapabilityBindings(): PlatformCapabilityBindings;
}

export interface PlatformCompositionRequest {
  readonly platform: PlatformFamily;
  readonly runtimeRole: RuntimeRole;
  readonly architecture: string;
}

export type PlatformCompositionResult =
  | {
      readonly status: "SELECTED";
      readonly backend: PlatformBackendRegistration;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly reason: "PLATFORM_BACKEND_UNQUALIFIED";
      readonly request: PlatformCompositionRequest;
    };
