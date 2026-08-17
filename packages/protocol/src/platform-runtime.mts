import type {
  PlatformCompatibility,
  PlatformFamily,
  PlatformPathRef,
  PlatformRuntimeIdentity,
  RuntimeRole,
} from "./platform.ts";

export const PLATFORM_FAMILIES = ["WINDOWS", "LINUX", "ANDROID"] as const;
export const RUNTIME_ROLES = ["FULL_HOST", "COMPANION"] as const;

const MAX_PLATFORM_VALUE_LENGTH = 32_767;
const MAX_IDENTITY_TOKEN_LENGTH = 128;

export class PlatformValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new PlatformValidationError("platform value contains unsupported or missing fields");
  }
}

function assertPlatform(value: unknown): PlatformFamily {
  if (typeof value !== "string" || !(PLATFORM_FAMILIES as readonly string[]).includes(value)) {
    throw new PlatformValidationError("platform family is unsupported");
  }
  return value as PlatformFamily;
}

function assertRuntimeRole(value: unknown): RuntimeRole {
  if (typeof value !== "string" || !(RUNTIME_ROLES as readonly string[]).includes(value)) {
    throw new PlatformValidationError("runtime role is unsupported");
  }
  return value as RuntimeRole;
}

function assertIdentityToken(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_IDENTITY_TOKEN_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  ) {
    throw new PlatformValidationError(`${field} must be a bounded opaque identity token`);
  }
  return value;
}

function assertPathValue(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_PLATFORM_VALUE_LENGTH ||
    value.includes("\0")
  ) {
    throw new PlatformValidationError("platform path value is invalid");
  }
  return value;
}

export function validateOpaquePlatformIdentifier(value: unknown): string {
  return assertIdentityToken(value, "platform identifier");
}

export function validatePlatformRuntimeIdentity(value: unknown): PlatformRuntimeIdentity {
  if (!isRecord(value)) throw new PlatformValidationError("platform runtime identity must be an object");
  assertExactKeys(value, ["platform", "runtimeRole", "architecture", "backendProfileId"]);
  return Object.freeze({
    platform: assertPlatform(value.platform),
    runtimeRole: assertRuntimeRole(value.runtimeRole),
    architecture: assertIdentityToken(value.architecture, "architecture"),
    backendProfileId: assertIdentityToken(value.backendProfileId, "backendProfileId"),
  });
}

export function validatePlatformCompatibility(value: unknown): PlatformCompatibility {
  if (!isRecord(value)) throw new PlatformValidationError("platform compatibility must be an object");
  const keys = [
    "platform",
    "runtimeRoles",
    ...(value.osVersionRange === undefined ? [] : ["osVersionRange"]),
    ...(value.architecture === undefined ? [] : ["architecture"]),
  ];
  assertExactKeys(value, keys);
  if (!Array.isArray(value.runtimeRoles) || value.runtimeRoles.length === 0) {
    throw new PlatformValidationError("runtimeRoles must be a non-empty array");
  }
  const runtimeRoles = value.runtimeRoles.map(assertRuntimeRole);
  if (new Set(runtimeRoles).size !== runtimeRoles.length) {
    throw new PlatformValidationError("runtimeRoles must not contain duplicates");
  }
  const architecture = value.architecture === undefined
    ? undefined
    : (() => {
        if (!Array.isArray(value.architecture) || value.architecture.length === 0) {
          throw new PlatformValidationError("architecture must be a non-empty array when present");
        }
        const values = value.architecture.map((item) => assertIdentityToken(item, "architecture"));
        if (new Set(values).size !== values.length) {
          throw new PlatformValidationError("architecture must not contain duplicates");
        }
        return Object.freeze(values);
      })();
  if (value.osVersionRange !== undefined) assertIdentityToken(value.osVersionRange, "osVersionRange");
  return Object.freeze({
    platform: assertPlatform(value.platform),
    runtimeRoles: Object.freeze(runtimeRoles),
    ...(value.osVersionRange === undefined ? {} : { osVersionRange: value.osVersionRange as string }),
    ...(architecture === undefined ? {} : { architecture }),
  });
}

export function validatePlatformPathRef(value: unknown): PlatformPathRef {
  if (!isRecord(value)) throw new PlatformValidationError("platform path reference must be an object");
  assertExactKeys(value, ["platform", "value"]);
  return Object.freeze({ platform: assertPlatform(value.platform), value: assertPathValue(value.value) });
}
