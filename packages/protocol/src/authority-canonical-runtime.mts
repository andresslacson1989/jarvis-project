import { validateCanonicalActionDescriptor } from "./authority-runtime.mjs";
import type { CanonicalActionDescriptorV1, CanonicalActionDescriptorBuildInput } from "./authority.ts";

export class AuthorityCanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorityCanonicalizationError";
  }
}

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function canonical(value: unknown, active: ReadonlySet<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    if (hasUnpairedSurrogate(value)) throw new AuthorityCanonicalizationError("canonical action contains invalid Unicode");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new AuthorityCanonicalizationError("canonical action numbers must be safe integers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (active.has(value)) throw new AuthorityCanonicalizationError("canonical action contains a cycle");
    const next = new Set(active);
    next.add(value);
    return `[${value.map((item) => canonical(item, next)).join(",")}]`;
  }
  if (typeof value === "object") {
    if (active.has(value)) throw new AuthorityCanonicalizationError("canonical action contains a cycle");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new AuthorityCanonicalizationError("canonical action objects must be plain records");
    const next = new Set(active);
    next.add(value);
    const input = value as Record<string, unknown>;
    const entries = Object.keys(input).sort().map((key) => {
      if (hasUnpairedSurrogate(key)) throw new AuthorityCanonicalizationError("canonical action contains invalid Unicode key");
      return `${JSON.stringify(key)}:${canonical(input[key], next)}`;
    });
    return `{${entries.join(",")}}`;
  }
  throw new AuthorityCanonicalizationError("canonical action contains a non-JSON value");
}

export function buildCanonicalActionDescriptorV1(value: unknown): CanonicalActionDescriptorV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new AuthorityCanonicalizationError("canonical action builder input must be an object");
  const input = value as Record<string, unknown>;
  if ("domain" in input || "descriptorVersion" in input) throw new AuthorityCanonicalizationError("builder input must not provide descriptor identity");
  return validateCanonicalActionDescriptor({ domain: "jarvis.approval.action.v1", descriptorVersion: 1, ...input });
}

export function canonicalizeCanonicalActionDescriptor(value: unknown): string {
  const descriptor = validateCanonicalActionDescriptor(value);
  return canonical(descriptor, new Set<object>());
}

export function canonicalizeBuiltActionDescriptor(value: CanonicalActionDescriptorBuildInput): string {
  return canonicalizeCanonicalActionDescriptor(buildCanonicalActionDescriptorV1(value));
}
