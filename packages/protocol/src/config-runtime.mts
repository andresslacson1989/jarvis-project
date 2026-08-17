import type { ActiveConfiguration, ConfigurationCandidate, ConfigurationDomain } from "./config.ts";

export class ConfigurationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationValidationError";
  }
}

const DOMAINS = new Set<ConfigurationDomain>([
  "STARTUP", "SESSION_SECURITY", "VOICE", "PROVIDERS", "PRIVACY", "PERMISSIONS", "BUDGETS", "PROJECTS",
  "MODULES", "INTEGRATIONS", "NOTIFICATIONS", "RETENTION", "UPDATES", "PLATFORM_BACKEND", "DEVELOPER_MODE",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ConfigurationValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) {
    throw new ConfigurationValidationError("configuration contains unsupported or missing fields");
  }
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum || value.includes("\0")) throw new ConfigurationValidationError(`${label} is invalid`);
  return value;
}

function identifier(value: unknown, label: string): string {
  const result = text(value, label, 256);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(result)) throw new ConfigurationValidationError(`${label} is not an opaque identifier`);
  return result;
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label, 64);
  if (Number.isNaN(Date.parse(result))) throw new ConfigurationValidationError(`${label} must be an ISO timestamp`);
  return result;
}

function boundedValue(value: unknown, depth = 0): unknown {
  if (depth > 8) throw new ConfigurationValidationError("configuration nesting is too deep");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return text(value, "configuration value", 8192);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ConfigurationValidationError("configuration numbers must be finite");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 256) throw new ConfigurationValidationError("configuration array is too large");
    return Object.freeze(value.map((item) => boundedValue(item, depth + 1)));
  }
  const input = record(value, "configuration value");
  if (Object.keys(input).length > 128) throw new ConfigurationValidationError("configuration object is too large");
  return Object.freeze(Object.fromEntries(Object.entries(input).map(([key, item]) => {
    const normalizedKey = text(key, "configuration key", 128);
    if (/(password|secret|token|private.?key|credential|recovery|dek|oauth)/iu.test(normalizedKey)) throw new ConfigurationValidationError("secret-bearing configuration key is prohibited");
    if (/^(feature|flag)(?:[._:-]|$)/iu.test(normalizedKey)) throw new ConfigurationValidationError("unknown feature flags cannot be activated");
    return [normalizedKey, boundedValue(item, depth + 1)];
  })));
}

export function validateConfigurationDomain(value: unknown): ConfigurationDomain {
  if (typeof value !== "string" || !DOMAINS.has(value as ConfigurationDomain)) throw new ConfigurationValidationError("configuration domain is invalid");
  return value as ConfigurationDomain;
}

export function validateConfigurationCandidate(value: unknown): ConfigurationCandidate {
  const input = record(value, "configuration candidate");
  exactKeys(input, ["candidateId", "domain", "schemaVersion", "values", "expectedActiveVersion", "createdAt"]);
  if (!Number.isSafeInteger(input.schemaVersion) || (input.schemaVersion as number) < 1) throw new ConfigurationValidationError("schemaVersion is invalid");
  if (!Number.isSafeInteger(input.expectedActiveVersion) || (input.expectedActiveVersion as number) < 0) throw new ConfigurationValidationError("expectedActiveVersion is invalid");
  const values = record(input.values, "configuration values");
  return Object.freeze({
    candidateId: identifier(input.candidateId, "candidateId"),
    domain: validateConfigurationDomain(input.domain),
    schemaVersion: input.schemaVersion as number,
    values: boundedValue(values) as Readonly<Record<string, unknown>>,
    expectedActiveVersion: input.expectedActiveVersion as number,
    createdAt: timestamp(input.createdAt, "createdAt"),
  });
}

export function validateActiveConfiguration(value: unknown): ActiveConfiguration {
  const input = record(value, "active configuration");
  exactKeys(input, ["domain", "schemaVersion", "values", "version", "sourceCandidateId", "activatedAt"]);
  if (!Number.isSafeInteger(input.schemaVersion) || (input.schemaVersion as number) < 1 || !Number.isSafeInteger(input.version) || (input.version as number) < 1) throw new ConfigurationValidationError("active configuration version is invalid");
  return Object.freeze({
    domain: validateConfigurationDomain(input.domain),
    schemaVersion: input.schemaVersion as number,
    values: boundedValue(record(input.values, "active configuration values")) as Readonly<Record<string, unknown>>,
    version: input.version as number,
    sourceCandidateId: identifier(input.sourceCandidateId, "sourceCandidateId"),
    activatedAt: timestamp(input.activatedAt, "activatedAt"),
  });
}
