// Canonical platform/runtime protocol shapes from the active JARVIS contract.
//
// These types model identity and compatibility only. They do not establish
// production support, qualification, user authority, or capability availability.

export type PlatformFamily = "WINDOWS" | "LINUX" | "ANDROID";

export type RuntimeRole = "FULL_HOST" | "COMPANION";

export interface PlatformRuntimeIdentity {
  platform: PlatformFamily;
  runtimeRole: RuntimeRole;
  architecture: string;
  backendProfileId: string;
}

export interface PlatformCompatibility {
  platform: PlatformFamily;
  runtimeRoles: RuntimeRole[];
  osVersionRange?: string;
  architecture?: string[];
}

export interface PlatformPathRef {
  platform: PlatformFamily;
  value: string;
}
