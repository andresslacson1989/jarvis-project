// Canonical platform/runtime protocol shapes from the active JARVIS contract.
//
// These types model identity and compatibility only. They do not establish
// production support, qualification, user authority, or capability availability.

export type PlatformFamily = "WINDOWS" | "LINUX" | "ANDROID";

export type RuntimeRole = "FULL_HOST" | "COMPANION";

export interface PlatformRuntimeIdentity {
  readonly platform: PlatformFamily;
  readonly runtimeRole: RuntimeRole;
  readonly architecture: string;
  readonly backendProfileId: string;
}

export interface PlatformCompatibility {
  readonly platform: PlatformFamily;
  readonly runtimeRoles: readonly RuntimeRole[];
  readonly osVersionRange?: string;
  readonly architecture?: readonly string[];
}

export interface PlatformPathRef {
  readonly platform: PlatformFamily;
  readonly value: string;
}
