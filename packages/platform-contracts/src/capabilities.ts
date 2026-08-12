/**
 * Platform-neutral native capability identities and discovery contracts.
 *
 * Capability status is a technical availability/qualification fact only. It
 * never grants user authority, action permission, product support, or release
 * qualification. Dependent features must block or degrade truthfully when a
 * required capability is not both available and qualified.
 */

export const PLATFORM_CAPABILITY_IDS = [
  "secure_storage",
  "local_ipc",
  "managed_process_tree",
  "session_lock_observation",
  "native_window_control",
  "notifications",
  "paths_and_identity",
  "voice_capture",
  "voice_output",
  "hardware_acceleration",
  "platform_update",
  "privilege_mediation",
  "system_info",
] as const;

export type PlatformCapabilityId = (typeof PLATFORM_CAPABILITY_IDS)[number];

export type PlatformCapabilityAvailability = "AVAILABLE" | "UNAVAILABLE";
export type PlatformCapabilityQualification = "QUALIFIED" | "UNQUALIFIED";

/**
 * Invalid combinations are unrepresentable: an unavailable capability cannot
 * simultaneously be qualified.
 */
export type PlatformCapabilityStatus<
  TCapability extends PlatformCapabilityId = PlatformCapabilityId,
> =
  | {
      readonly capability: TCapability;
      readonly availability: "UNAVAILABLE";
      readonly qualification: "UNQUALIFIED";
    }
  | {
      readonly capability: TCapability;
      readonly availability: "AVAILABLE";
      readonly qualification: "UNQUALIFIED";
    }
  | {
      readonly capability: TCapability;
      readonly availability: "AVAILABLE";
      readonly qualification: "QUALIFIED";
    };

/**
 * Base contract for deterministic, application-owned technical discovery.
 * Concrete native operation methods are added by the later owning subsections;
 * this Phase-0 foundation deliberately does not encode any OS mechanism.
 */
export interface PlatformCapabilityContract<
  TCapability extends PlatformCapabilityId,
> {
  readonly capabilityIds: readonly TCapability[];
  getCapabilityStatus(
    capability: TCapability,
  ): Promise<PlatformCapabilityStatus<TCapability>>;
}

export interface PlatformSecureStorage
  extends PlatformCapabilityContract<"secure_storage"> {}

export interface PlatformLocalIpc
  extends PlatformCapabilityContract<"local_ipc"> {}

export interface PlatformProcessSupervisor
  extends PlatformCapabilityContract<"managed_process_tree"> {}

export interface PlatformSessionObserver
  extends PlatformCapabilityContract<"session_lock_observation"> {}

export interface PlatformWindowController
  extends PlatformCapabilityContract<"native_window_control"> {}

export interface PlatformNotificationBackend
  extends PlatformCapabilityContract<"notifications"> {}

export interface PlatformPathsAndIdentity
  extends PlatformCapabilityContract<"paths_and_identity"> {}

export interface PlatformAudioBackend
  extends PlatformCapabilityContract<"voice_capture" | "voice_output"> {}

export interface PlatformUpdateBackend
  extends PlatformCapabilityContract<"platform_update"> {}

export interface PlatformPrivilegeMediator
  extends PlatformCapabilityContract<"privilege_mediation"> {}

export interface PlatformSystemInfo
  extends PlatformCapabilityContract<"hardware_acceleration" | "system_info"> {}
