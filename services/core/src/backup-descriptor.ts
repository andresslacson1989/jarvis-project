import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

export const BACKUP_FORMAT_ID = "JARVIS_BACKUP_V1" as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_DESCRIPTOR_DOMAIN = "jarvis.backup.package.v1" as const;
export const BACKUP_OUTER_AEAD = "AES_256_GCM" as const;
export const BACKUP_CHUNK_SIZE_BYTES = 4_194_304 as const;
export const BACKUP_MAX_PLAINTEXT_BYTES = 1_099_511_627_776 as const;
export const BACKUP_CHUNK_TAG_BYTES = 16 as const;
export const BACKUP_CHUNK_NONCE_BYTES = 12 as const;
export const BACKUP_DESCRIPTOR_MAX_BYTES = 262_144 as const;
export const BACKUP_MAX_KEY_SLOTS = 16 as const;

const MAX_UINT64 = 18_446_744_073_709_551_615n;
const MAX_PLAINTEXT_BYTES = BigInt(BACKUP_MAX_PLAINTEXT_BYTES);
const MAX_CHUNK_COUNT =
  (MAX_PLAINTEXT_BYTES + BigInt(BACKUP_CHUNK_SIZE_BYTES) - 1n) / BigInt(BACKUP_CHUNK_SIZE_BYTES);
const decoder = new TextDecoder("utf-8", { fatal: true });

export type BackupProtectionClass = "LOCAL_RECOVERY" | "PORTABLE_STATE";

export interface BackupPackageDescriptorV1 {
  readonly domain: typeof BACKUP_DESCRIPTOR_DOMAIN;
  readonly formatId: typeof BACKUP_FORMAT_ID;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly backupId: string;
  readonly createdAt: string;
  readonly protectionClass: BackupProtectionClass;
  readonly outerAead: typeof BACKUP_OUTER_AEAD;
  readonly chunkSizeBytes: typeof BACKUP_CHUNK_SIZE_BYTES;
  readonly chunkCount: string;
  readonly plaintextBytes: string;
  readonly noncePrefix: string;
  readonly payloadManifestSha256: string;
  readonly keySlotCount: number;
}

export type BackupDescriptorFailureCode =
  | "BACKUP_DESCRIPTOR_INPUT_INVALID"
  | "BACKUP_DESCRIPTOR_BOUNDS"
  | "BACKUP_DESCRIPTOR_FORMAT_INVALID"
  | "BACKUP_DESCRIPTOR_NOT_CANONICAL";

export class BackupDescriptorError extends Error {
  readonly code: BackupDescriptorFailureCode;

  constructor(code: BackupDescriptorFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackupDescriptorError";
    this.code = code;
  }
}

function fail(code: BackupDescriptorFailureCode, message: string, options?: ErrorOptions): never {
  throw new BackupDescriptorError(code, message, options);
}

function canonicalizeValue(value: unknown, active: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "descriptor numbers must be safe integers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (active.has(value)) return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "descriptor contains a cycle");
    active.add(value);
    const result = `[${value.map((item) => canonicalizeValue(item, active)).join(",")}]`;
    active.delete(value);
    return result;
  }
  if (typeof value === "object") {
    if (active.has(value)) return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "descriptor contains a cycle");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "descriptor objects must be plain records");
    }
    active.add(value);
    const result = `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeValue((value as Record<string, unknown>)[key], active)}`)
      .join(",")}}`;
    active.delete(value);
    return result;
  }
  return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "descriptor contains a non-JSON value");
}

/** RFC 8785-compatible JCS for the bounded integer/string/boolean V1 domains. */
export function canonicalizeJcs(value: unknown): Buffer {
  return Buffer.from(canonicalizeValue(value, new Set<object>()), "utf8");
}

export function canonicalizeBackupDescriptor(value: unknown): Buffer {
  return canonicalizeJcs(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "backup descriptor must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(record: Record<string, unknown>): void {
  const expected = [
    "backupId",
    "chunkCount",
    "chunkSizeBytes",
    "createdAt",
    "domain",
    "formatId",
    "formatVersion",
    "keySlotCount",
    "noncePrefix",
    "outerAead",
    "payloadManifestSha256",
    "plaintextBytes",
    "protectionClass",
  ];
  const actual = Object.keys(record).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "backup descriptor fields are not the exact V1 set");
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", `${field} must be a non-empty string`);
  }
  return value;
}

function requireCanonicalUint64(value: unknown, field: string, maximum?: bigint): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", `${field} must be canonical uint64 decimal text`);
  }
  let parsed;
  try {
    parsed = BigInt(value);
  } catch (error) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", `${field} is not a valid uint64`, { cause: error });
  }
  if (parsed > MAX_UINT64 || (maximum !== undefined && parsed > maximum)) {
    return fail("BACKUP_DESCRIPTOR_BOUNDS", `${field} exceeds the V1 bound`);
  }
  return parsed;
}

function requireBase64Url(value: unknown, field: string, bytes: number): string {
  const encoded = requireString(value, field);
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded) || encoded.length % 4 === 1) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", `${field} must be unpadded base64url text`);
  }
  const decoded = Buffer.from(encoded, "base64url");
  if (decoded.length !== bytes || decoded.toString("base64url") !== encoded) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", `${field} must encode exactly ${bytes} bytes`);
  }
  return encoded;
}

function requireDescriptorShape(value: unknown): BackupPackageDescriptorV1 {
  const record = requireRecord(value);
  requireExactKeys(record);
  if (record.domain !== BACKUP_DESCRIPTOR_DOMAIN) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "descriptor domain is not JARVIS_BACKUP_V1");
  }
  if (record.formatId !== BACKUP_FORMAT_ID || record.formatVersion !== BACKUP_FORMAT_VERSION) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "descriptor format identity is not JARVIS_BACKUP_V1");
  }
  const backupId = requireString(record.backupId, "backupId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(backupId)) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "backupId must be UUIDv7");
  }
  const createdAt = requireString(record.createdAt, "createdAt");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,})?Z$/u.test(createdAt) ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "createdAt must be a UTC ISO-8601 timestamp");
  }
  if (record.protectionClass !== "LOCAL_RECOVERY" && record.protectionClass !== "PORTABLE_STATE") {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "protectionClass is invalid");
  }
  if (record.outerAead !== BACKUP_OUTER_AEAD || record.chunkSizeBytes !== BACKUP_CHUNK_SIZE_BYTES) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "descriptor encryption identity is not the V1 profile");
  }
  const plaintextBytes = requireCanonicalUint64(record.plaintextBytes, "plaintextBytes", MAX_PLAINTEXT_BYTES);
  const expectedChunkCount =
    plaintextBytes === 0n ? 0n : (plaintextBytes + BigInt(BACKUP_CHUNK_SIZE_BYTES) - 1n) / BigInt(BACKUP_CHUNK_SIZE_BYTES);
  const chunkCount = requireCanonicalUint64(record.chunkCount, "chunkCount", MAX_CHUNK_COUNT);
  if (chunkCount !== expectedChunkCount) {
    return fail("BACKUP_DESCRIPTOR_FORMAT_INVALID", "chunkCount does not match plaintextBytes");
  }
  const noncePrefix = requireBase64Url(record.noncePrefix, "noncePrefix", 4);
  const payloadManifestSha256 = requireBase64Url(record.payloadManifestSha256, "payloadManifestSha256", 32);
  if (
    typeof record.keySlotCount !== "number" ||
    !Number.isSafeInteger(record.keySlotCount) ||
    record.keySlotCount < 0 ||
    record.keySlotCount > BACKUP_MAX_KEY_SLOTS
  ) {
    return fail("BACKUP_DESCRIPTOR_BOUNDS", "keySlotCount exceeds the V1 bound");
  }
  return {
    domain: BACKUP_DESCRIPTOR_DOMAIN,
    formatId: BACKUP_FORMAT_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    backupId,
    createdAt,
    protectionClass: record.protectionClass,
    outerAead: BACKUP_OUTER_AEAD,
    chunkSizeBytes: BACKUP_CHUNK_SIZE_BYTES,
    chunkCount: record.chunkCount as string,
    plaintextBytes: record.plaintextBytes as string,
    noncePrefix,
    payloadManifestSha256,
    keySlotCount: record.keySlotCount,
  };
}

export function validateBackupDescriptor(value: unknown): BackupPackageDescriptorV1 {
  const descriptor = requireDescriptorShape(value);
  const canonical = canonicalizeBackupDescriptor(descriptor);
  if (canonical.byteLength > BACKUP_DESCRIPTOR_MAX_BYTES) {
    return fail("BACKUP_DESCRIPTOR_BOUNDS", "backup descriptor exceeds the V1 metadata bound");
  }
  return Object.freeze(descriptor);
}

export function parseBackupDescriptor(input: Buffer | string): BackupPackageDescriptorV1 {
  const bytes = Buffer.isBuffer(input) ? Buffer.from(input) : Buffer.from(input, "utf8");
  if (bytes.length === 0 || bytes.length > BACKUP_DESCRIPTOR_MAX_BYTES) {
    return fail("BACKUP_DESCRIPTOR_BOUNDS", "backup descriptor exceeds the V1 metadata bound");
  }
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch (error) {
    return fail("BACKUP_DESCRIPTOR_INPUT_INVALID", "backup descriptor is not valid UTF-8", { cause: error });
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    return fail("BACKUP_DESCRIPTOR_INPUT_INVALID", "backup descriptor is not valid JSON", { cause: error });
  }
  const descriptor = validateBackupDescriptor(value);
  const canonical = canonicalizeBackupDescriptor(descriptor);
  if (!canonical.equals(bytes)) {
    return fail("BACKUP_DESCRIPTOR_NOT_CANONICAL", "backup descriptor is not RFC 8785 canonical JSON");
  }
  return descriptor;
}

export function digestBackupDescriptor(value: BackupPackageDescriptorV1): Buffer {
  const descriptor = validateBackupDescriptor(value);
  return createHash("sha256").update(canonicalizeBackupDescriptor(descriptor)).digest();
}
