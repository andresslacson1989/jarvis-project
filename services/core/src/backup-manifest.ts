import { createHash, randomBytes } from "node:crypto";
import { TextDecoder } from "node:util";
import {
  BACKUP_CHUNK_SIZE_BYTES,
  BACKUP_FORMAT_ID,
  BACKUP_FORMAT_VERSION,
  canonicalizeJcs,
} from "./backup-descriptor.js";
import type { BackupProtectionClass } from "./backup-descriptor.js";

export const BACKUP_PAYLOAD_MANIFEST_DOMAIN = "jarvis.backup.payload-manifest.v1" as const;
export const BACKUP_KEY_BYTES = 32 as const;
export const BACKUP_PAYLOAD_MANIFEST_MAX_BYTES = 262_144 as const;

const MAX_UINT64 = 18_446_744_073_709_551_615n;
const MAX_OBJECTS = 4_096;
const MAX_KEY_SLOT_PROFILES = 16;
const SHA256_BYTES = 32;
const SECRET_PATH_TOKEN = /(?:credential|password|passwd|secret|token|api[-_]?key|private[-_]?key|db[-_]?dek|backup[-_]?dek|snapshot[-_]?db[-_]?key)/iu;
const decoder = new TextDecoder("utf-8", { fatal: true });
const ALLOWED_LOGICAL_TYPES = new Set([
  "SQLCIPHER_SNAPSHOT",
  "VALIDATED_CONFIGURATION",
  "REGISTRY_METADATA",
  "DURABLE_ARTIFACT",
  "MIGRATION_METADATA",
  "UPDATE_METADATA",
  "RECOVERY_METADATA",
  "RELEASE_METADATA",
]);

export type BackupPayloadObjectType =
  | "SQLCIPHER_SNAPSHOT"
  | "VALIDATED_CONFIGURATION"
  | "REGISTRY_METADATA"
  | "DURABLE_ARTIFACT"
  | "MIGRATION_METADATA"
  | "UPDATE_METADATA"
  | "RECOVERY_METADATA"
  | "RELEASE_METADATA";

export interface BackupKeyMaterialV1 {
  readonly snapshotDbKey: Buffer;
  readonly backupDek: Buffer;
}

export interface BackupPayloadObjectInputV1 {
  readonly logicalType: BackupPayloadObjectType;
  readonly path: string;
  readonly bytes: string;
  readonly sha256: string;
}

export interface BackupPayloadManifestInputV1 {
  readonly backupId: string;
  readonly createdAt: string;
  readonly protectionClass: BackupProtectionClass;
  readonly jarvisVersion: string;
  readonly protocolVersion: number;
  readonly schemaVersion: number;
  readonly snapshot: BackupPayloadObjectInputV1;
  readonly objects: readonly BackupPayloadObjectInputV1[];
  readonly keySlotProfiles: readonly string[];
}

export interface BackupPayloadManifestObjectV1 {
  readonly logicalType: BackupPayloadObjectType;
  readonly path: string;
  readonly bytes: string;
  readonly sha256: string;
}

export interface BackupPayloadManifestV1 {
  readonly domain: typeof BACKUP_PAYLOAD_MANIFEST_DOMAIN;
  readonly formatId: typeof BACKUP_FORMAT_ID;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly backupId: string;
  readonly createdAt: string;
  readonly protectionClass: BackupProtectionClass;
  readonly jarvisVersion: string;
  readonly protocolVersion: number;
  readonly schemaVersion: number;
  readonly outerAead: "AES_256_GCM";
  readonly chunkSizeBytes: typeof BACKUP_CHUNK_SIZE_BYTES;
  readonly snapshotDbKeyRef: "INTERNAL_SECRET_PAYLOAD_ONLY";
  readonly keySlotProfiles: readonly string[];
  readonly objects: readonly BackupPayloadManifestObjectV1[];
}

export interface BuiltBackupPayloadManifestV1 {
  readonly manifest: BackupPayloadManifestV1;
  readonly canonicalBytes: Buffer;
  readonly digest: Buffer;
}

export type BackupManifestFailureCode =
  | "BACKUP_KEY_MATERIAL_INVALID"
  | "BACKUP_MANIFEST_INPUT_INVALID"
  | "BACKUP_MANIFEST_BOUNDS"
  | "BACKUP_MANIFEST_SECRET_EXCLUDED"
  | "BACKUP_MANIFEST_NOT_CANONICAL";

export class BackupManifestError extends Error {
  readonly code: BackupManifestFailureCode;

  constructor(code: BackupManifestFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackupManifestError";
    this.code = code;
  }
}

function fail(code: BackupManifestFailureCode, message: string, options?: ErrorOptions): never {
  throw new BackupManifestError(code, message, options);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(record: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${label} contains an unexpected or missing field`);
  }
}

function requireBoundedString(value: unknown, field: string, maximum = 256): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${field} is invalid or exceeds its bound`);
  }
  return value;
}

function requireCanonicalUint64(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${field} must be canonical uint64 decimal text`);
  }
  const parsed = BigInt(value);
  if (parsed > MAX_UINT64) return fail("BACKUP_MANIFEST_BOUNDS", `${field} exceeds uint64`);
  return value;
}

function requireSha256(value: unknown, field: string): string {
  const encoded = requireBoundedString(value, field, 43);
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded) || encoded.length % 4 === 1) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${field} must be unpadded base64url`);
  }
  const decoded = Buffer.from(encoded, "base64url");
  if (decoded.length !== SHA256_BYTES || decoded.toString("base64url") !== encoded) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${field} must encode exactly 32 bytes`);
  }
  return encoded;
}

function requireSafePath(value: unknown, field: string): string {
  const path = requireBoundedString(value, field, 512);
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${field} must be a canonical relative path`);
  }
  if (SECRET_PATH_TOKEN.test(path)) {
    return fail("BACKUP_MANIFEST_SECRET_EXCLUDED", `${field} names a secret-bearing object`);
  }
  return path;
}

function normalizeObject(value: unknown, field: string): BackupPayloadManifestObjectV1 {
  const record = requireRecord(value, field);
  requireExactKeys(record, ["logicalType", "path", "bytes", "sha256"], field);
  if (typeof record.logicalType !== "string" || !ALLOWED_LOGICAL_TYPES.has(record.logicalType)) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${field}.logicalType is unsupported`);
  }
  const logicalType = record.logicalType as BackupPayloadObjectType;
  if (logicalType === "SQLCIPHER_SNAPSHOT" && !String(record.path).endsWith(".db")) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", `${field}.path must identify the SQLCipher snapshot`);
  }
  return Object.freeze({
    logicalType,
    path: requireSafePath(record.path, `${field}.path`),
    bytes: requireCanonicalUint64(record.bytes, `${field}.bytes`),
    sha256: requireSha256(record.sha256, `${field}.sha256`),
  });
}

function validateBackupId(value: unknown): string {
  const backupId = requireBoundedString(value, "backupId", 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(backupId)) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "backupId must be UUIDv7");
  }
  return backupId;
}

function validateCreatedAt(value: unknown): string {
  const createdAt = requireBoundedString(value, "createdAt", 64);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,})?Z$/u.test(createdAt) || Number.isNaN(Date.parse(createdAt))) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "createdAt must be a UTC ISO-8601 timestamp");
  }
  return createdAt;
}

function normalizeKeySlotProfiles(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_KEY_SLOT_PROFILES) {
    return fail("BACKUP_MANIFEST_BOUNDS", "key-slot profile metadata exceeds the V1 bound");
  }
  const profiles = value.map((profile, index) => requireBoundedString(profile, `keySlotProfiles[${index}]`, 128));
  if (profiles.some((profile) => SECRET_PATH_TOKEN.test(profile) || /^JRV1-/u.test(profile))) {
    return fail("BACKUP_MANIFEST_SECRET_EXCLUDED", "key-slot metadata contains recovery or secret material");
  }
  return Object.freeze([...new Set(profiles)].sort());
}

export function createBackupKeyMaterial(): BackupKeyMaterialV1 {
  const snapshotDbKey = randomBytes(BACKUP_KEY_BYTES);
  let backupDek = randomBytes(BACKUP_KEY_BYTES);
  while (backupDek.equals(snapshotDbKey)) backupDek = randomBytes(BACKUP_KEY_BYTES);
  return { snapshotDbKey, backupDek };
}

export function destroyBackupKeyMaterial(material: BackupKeyMaterialV1): void {
  if (
    !material ||
    !Buffer.isBuffer(material.snapshotDbKey) ||
    !Buffer.isBuffer(material.backupDek) ||
    material.snapshotDbKey.length !== BACKUP_KEY_BYTES ||
    material.backupDek.length !== BACKUP_KEY_BYTES
  ) {
    return fail("BACKUP_KEY_MATERIAL_INVALID", "backup key material must contain two 256-bit buffers");
  }
  material.snapshotDbKey.fill(0);
  material.backupDek.fill(0);
}

export function buildBackupPayloadManifest(input: BackupPayloadManifestInputV1): BuiltBackupPayloadManifestV1 {
  const record = requireRecord(input, "backup manifest input");
  requireExactKeys(
    record,
    ["backupId", "createdAt", "protectionClass", "jarvisVersion", "protocolVersion", "schemaVersion", "snapshot", "objects", "keySlotProfiles"],
    "backup manifest input",
  );
  const objectsInput = record.objects;
  if (!Array.isArray(objectsInput) || objectsInput.length > MAX_OBJECTS - 1) {
    return fail("BACKUP_MANIFEST_BOUNDS", "backup manifest object count exceeds the V1 bound");
  }
  const snapshot = normalizeObject(record.snapshot, "snapshot");
  if (snapshot.logicalType !== "SQLCIPHER_SNAPSHOT") {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "snapshot must be a SQLCIPHER_SNAPSHOT object");
  }
  const objects = [snapshot, ...objectsInput.map((object, index) => normalizeObject(object, `objects[${index}]`))];
  const protectionClass =
    record.protectionClass === "LOCAL_RECOVERY" || record.protectionClass === "PORTABLE_STATE"
      ? record.protectionClass
      : fail("BACKUP_MANIFEST_INPUT_INVALID", "protectionClass is invalid");
  const keySlotProfiles = normalizeKeySlotProfiles(record.keySlotProfiles);
  if (protectionClass === "PORTABLE_STATE" && !keySlotProfiles.includes("GENERATED_RECOVERY_V1")) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "PORTABLE_STATE requires a GENERATED_RECOVERY_V1 key slot");
  }
  const seen = new Set<string>();
  for (const object of objects) {
    if (seen.has(object.path)) return fail("BACKUP_MANIFEST_INPUT_INVALID", "backup manifest contains duplicate object paths");
    seen.add(object.path);
  }
  objects.sort((left, right) => left.path.localeCompare(right.path));
  const manifest = Object.freeze({
    domain: BACKUP_PAYLOAD_MANIFEST_DOMAIN,
    formatId: BACKUP_FORMAT_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    backupId: validateBackupId(record.backupId),
    createdAt: validateCreatedAt(record.createdAt),
    protectionClass,
    jarvisVersion: requireBoundedString(record.jarvisVersion, "jarvisVersion", 64),
    protocolVersion:
      typeof record.protocolVersion === "number" && Number.isSafeInteger(record.protocolVersion) && record.protocolVersion >= 1
        ? record.protocolVersion
        : fail("BACKUP_MANIFEST_INPUT_INVALID", "protocolVersion is invalid"),
    schemaVersion:
      typeof record.schemaVersion === "number" && Number.isSafeInteger(record.schemaVersion) && record.schemaVersion >= 1
        ? record.schemaVersion
        : fail("BACKUP_MANIFEST_INPUT_INVALID", "schemaVersion is invalid"),
    outerAead: "AES_256_GCM" as const,
    chunkSizeBytes: BACKUP_CHUNK_SIZE_BYTES,
    snapshotDbKeyRef: "INTERNAL_SECRET_PAYLOAD_ONLY" as const,
    keySlotProfiles,
    objects: Object.freeze(objects),
  }) satisfies BackupPayloadManifestV1;
  const canonicalBytes = canonicalizeJcs(manifest);
  if (canonicalBytes.byteLength > BACKUP_PAYLOAD_MANIFEST_MAX_BYTES) {
    return fail("BACKUP_MANIFEST_BOUNDS", "backup payload manifest exceeds the V1 metadata bound");
  }
  return Object.freeze({
    manifest,
    canonicalBytes,
    digest: createHash("sha256").update(canonicalBytes).digest(),
  });
}

export function digestBackupPayloadManifest(manifest: BackupPayloadManifestV1): Buffer {
  return createHash("sha256").update(canonicalizeJcs(manifest)).digest();
}

export function parseBackupPayloadManifest(input: Buffer | string): BackupPayloadManifestV1 {
  const bytes = Buffer.isBuffer(input) ? Buffer.from(input) : Buffer.from(input, "utf8");
  if (bytes.length === 0 || bytes.length > BACKUP_PAYLOAD_MANIFEST_MAX_BYTES) {
    return fail("BACKUP_MANIFEST_BOUNDS", "backup payload manifest exceeds the V1 metadata bound");
  }
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch (error) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "backup payload manifest is not valid UTF-8", { cause: error });
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "backup payload manifest is not valid JSON", { cause: error });
  }
  const record = requireRecord(value, "backup payload manifest");
  requireExactKeys(
    record,
    [
      "backupId",
      "chunkSizeBytes",
      "createdAt",
      "domain",
      "formatId",
      "formatVersion",
      "jarvisVersion",
      "keySlotProfiles",
      "objects",
      "outerAead",
      "protectionClass",
      "protocolVersion",
      "schemaVersion",
      "snapshotDbKeyRef",
    ],
    "backup payload manifest",
  );
  if (
    record.domain !== BACKUP_PAYLOAD_MANIFEST_DOMAIN ||
    record.formatId !== BACKUP_FORMAT_ID ||
    record.formatVersion !== BACKUP_FORMAT_VERSION ||
    record.outerAead !== "AES_256_GCM" ||
    record.chunkSizeBytes !== BACKUP_CHUNK_SIZE_BYTES ||
    record.snapshotDbKeyRef !== "INTERNAL_SECRET_PAYLOAD_ONLY"
  ) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "backup payload manifest identity is invalid");
  }
  if (!Array.isArray(record.objects) || record.objects.length === 0) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "backup payload manifest must include its snapshot object");
  }
  const normalizedObjects = record.objects.map((object, index) => normalizeObject(object, `objects[${index}]`));
  const snapshot = normalizedObjects.find((object) => object.logicalType === "SQLCIPHER_SNAPSHOT");
  if (!snapshot || normalizedObjects.filter((object) => object.logicalType === "SQLCIPHER_SNAPSHOT").length !== 1) {
    return fail("BACKUP_MANIFEST_INPUT_INVALID", "backup payload manifest must contain exactly one snapshot object");
  }
  const built = buildBackupPayloadManifest({
    backupId: record.backupId as string,
    createdAt: record.createdAt as string,
    protectionClass: record.protectionClass as BackupProtectionClass,
    jarvisVersion: record.jarvisVersion as string,
    protocolVersion: record.protocolVersion as number,
    schemaVersion: record.schemaVersion as number,
    snapshot,
    objects: normalizedObjects.filter((object) => object !== snapshot),
    keySlotProfiles: record.keySlotProfiles as readonly string[],
  });
  if (!built.canonicalBytes.equals(bytes)) {
    return fail("BACKUP_MANIFEST_NOT_CANONICAL", "backup payload manifest is not RFC 8785 canonical JSON");
  }
  return built.manifest;
}
