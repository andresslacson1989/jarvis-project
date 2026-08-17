import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { TextDecoder } from "node:util";
import { canonicalizeJcs } from "./backup-descriptor.js";
import { parseBackupPayloadManifest } from "./backup-manifest.js";
import type { BackupPayloadManifestV1 } from "./backup-manifest.js";

export const BACKUP_PAYLOAD_MAGIC = "JRVPLD01" as const;
export const BACKUP_PAYLOAD_INTERNAL_DOMAIN = "jarvis.backup.internal.v1" as const;
export const BACKUP_PAYLOAD_INTERNAL_PURPOSE = "SNAPSHOT_DB_KEY" as const;
export const BACKUP_PAYLOAD_INTERNAL_NONCE_BYTES = 12 as const;
export const BACKUP_PAYLOAD_INTERNAL_TAG_BYTES = 16 as const;
export const BACKUP_PAYLOAD_INTERNAL_RECORD_BYTES = 60 as const;
export const BACKUP_PAYLOAD_MAX_BYTES = 1_099_511_627_776 as const;
const MAX_OBJECTS = 4_096;
const MAX_PATH_BYTES = 512;
const HEADER_BYTES = 20;
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface BackupPayloadObjectInputV1 {
  readonly path: string;
  readonly data: Buffer;
}

export interface BuildBackupPayloadInputV1 {
  readonly manifestBytes: Buffer;
  readonly descriptorDigest: Buffer;
  readonly backupId: string;
  readonly snapshotDbKey: Buffer;
  readonly backupDek: Buffer;
  readonly objects: readonly BackupPayloadObjectInputV1[];
}

export interface ParsedBackupPayloadV1 {
  readonly manifest: BackupPayloadManifestV1;
  readonly snapshotDbKey: Buffer;
  readonly objects: readonly BackupPayloadObjectInputV1[];
}

export type BackupPayloadFailureCode =
  | "BACKUP_PAYLOAD_INPUT_INVALID"
  | "BACKUP_PAYLOAD_BOUNDS"
  | "BACKUP_PAYLOAD_FORMAT_INVALID"
  | "BACKUP_PAYLOAD_AUTHENTICATION_FAILED"
  | "BACKUP_PAYLOAD_CONTENT_MISMATCH";

export class BackupPayloadError extends Error {
  readonly code: BackupPayloadFailureCode;

  constructor(code: BackupPayloadFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackupPayloadError";
    this.code = code;
  }
}

function fail(code: BackupPayloadFailureCode, message: string, options?: ErrorOptions): never {
  throw new BackupPayloadError(code, message, options);
}

function requireKey(value: unknown, field: string): Buffer {
  if (!Buffer.isBuffer(value) || value.length !== 32) return fail("BACKUP_PAYLOAD_INPUT_INVALID", `${field} must be exactly 256 bits`);
  return value;
}

function requireDigest(value: unknown): Buffer {
  if (!Buffer.isBuffer(value) || value.length !== 32) return fail("BACKUP_PAYLOAD_INPUT_INVALID", "descriptor digest must be exactly 256 bits");
  return Buffer.from(value);
}

function requireBackupId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    return fail("BACKUP_PAYLOAD_INPUT_INVALID", "backupId must be UUIDv7");
  }
  return value;
}

function internalAad(backupId: string, descriptorDigest: Buffer): Buffer {
  return canonicalizeJcs({
    domain: BACKUP_PAYLOAD_INTERNAL_DOMAIN,
    backupId,
    descriptorSha256: descriptorDigest.toString("base64url"),
    purpose: BACKUP_PAYLOAD_INTERNAL_PURPOSE,
    wrapAead: "AES_256_GCM",
  });
}

function digest(data: Buffer): string {
  return createHash("sha256").update(data).digest("base64url");
}

function writeU64(target: Buffer, offset: number, value: bigint): void {
  if (value < 0n || value > 18_446_744_073_709_551_615n) return fail("BACKUP_PAYLOAD_BOUNDS", "payload length exceeds uint64");
  target.writeBigUInt64BE(value, offset);
}

function readU64(source: Buffer, offset: number, field: string): bigint {
  if (offset < 0 || offset + 8 > source.length) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", `${field} length field is truncated`);
  return source.readBigUInt64BE(offset);
}

function normalizeObjects(manifest: BackupPayloadManifestV1, objects: readonly BackupPayloadObjectInputV1[]): readonly BackupPayloadObjectInputV1[] {
  if (!Array.isArray(objects) || objects.length !== manifest.objects.length || objects.length > MAX_OBJECTS) {
    return fail("BACKUP_PAYLOAD_CONTENT_MISMATCH", "payload objects do not match the manifest count");
  }
  const byPath = new Map<string, BackupPayloadObjectInputV1>();
  for (const object of objects) {
    if (!object || typeof object.path !== "string" || !Buffer.isBuffer(object.data) || byPath.has(object.path)) {
      return fail("BACKUP_PAYLOAD_CONTENT_MISMATCH", "payload object shape or uniqueness is invalid");
    }
    byPath.set(object.path, object);
  }
  const normalized: BackupPayloadObjectInputV1[] = [];
  for (const expected of manifest.objects) {
    const object = byPath.get(expected.path);
    if (!object || BigInt(object.data.length).toString(10) !== expected.bytes || digest(object.data) !== expected.sha256) {
      return fail("BACKUP_PAYLOAD_CONTENT_MISMATCH", `payload object does not match manifest: ${expected.path}`);
    }
    normalized.push({ path: object.path, data: Buffer.from(object.data) });
  }
  return normalized;
}

function wrapSnapshotDbKey(backupId: string, descriptorDigest: Buffer, snapshotDbKey: Buffer, backupDek: Buffer): Buffer {
  const nonce = randomBytes(BACKUP_PAYLOAD_INTERNAL_NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", backupDek, nonce);
  cipher.setAAD(internalAad(backupId, descriptorDigest));
  const ciphertext = Buffer.concat([cipher.update(snapshotDbKey), cipher.final()]);
  return Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]);
}

function unwrapSnapshotDbKey(backupId: string, descriptorDigest: Buffer, record: Buffer, backupDek: Buffer): Buffer {
  if (record.length !== BACKUP_PAYLOAD_INTERNAL_RECORD_BYTES) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "internal SnapshotDBKey record length is invalid");
  const nonce = record.subarray(0, BACKUP_PAYLOAD_INTERNAL_NONCE_BYTES);
  const ciphertext = record.subarray(BACKUP_PAYLOAD_INTERNAL_NONCE_BYTES, -BACKUP_PAYLOAD_INTERNAL_TAG_BYTES);
  const tag = record.subarray(-BACKUP_PAYLOAD_INTERNAL_TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", backupDek, nonce);
    decipher.setAAD(internalAad(backupId, descriptorDigest));
    decipher.setAuthTag(tag);
    const snapshotDbKey = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (snapshotDbKey.length !== 32) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "internal SnapshotDBKey length is invalid");
    return snapshotDbKey;
  } catch (error) {
    return fail("BACKUP_PAYLOAD_AUTHENTICATION_FAILED", "internal SnapshotDBKey authentication failed", { cause: error });
  }
}

export function buildAuthenticatedBackupPayload(input: BuildBackupPayloadInputV1): Buffer {
  const descriptorDigest = requireDigest(input.descriptorDigest);
  const backupId = requireBackupId(input.backupId);
  const snapshotDbKey = requireKey(input.snapshotDbKey, "SnapshotDBKey");
  const backupDek = requireKey(input.backupDek, "BackupDEK");
  if (!Buffer.isBuffer(input.manifestBytes) || input.manifestBytes.length === 0) return fail("BACKUP_PAYLOAD_INPUT_INVALID", "manifest bytes are required");
  let manifest: BackupPayloadManifestV1;
  try {
    manifest = parseBackupPayloadManifest(input.manifestBytes);
  } catch (error) {
    return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "payload manifest cannot be parsed", { cause: error });
  }
  if (manifest.backupId !== backupId) return fail("BACKUP_PAYLOAD_CONTENT_MISMATCH", "payload backupId does not match manifest");
  const objects = normalizeObjects(manifest, input.objects);
  if (input.manifestBytes.length > 0xffff_ffff) return fail("BACKUP_PAYLOAD_BOUNDS", "manifest length exceeds payload bounds");
  const internalRecord = wrapSnapshotDbKey(backupId, descriptorDigest, snapshotDbKey, backupDek);
  const pathBytes = objects.map((object) => Buffer.from(object.path, "utf8"));
  if (pathBytes.some((path) => path.length === 0 || path.length > MAX_PATH_BYTES)) return fail("BACKUP_PAYLOAD_BOUNDS", "payload path exceeds its bound");
  const totalBytes = HEADER_BYTES + input.manifestBytes.length + internalRecord.length + objects.reduce((sum, object, index) => {
    const path = pathBytes[index];
    if (!path) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "payload path ordering is invalid");
    return sum + 2 + path.length + 8 + object.data.length;
  }, 0);
  if (totalBytes > BACKUP_PAYLOAD_MAX_BYTES) return fail("BACKUP_PAYLOAD_BOUNDS", "authenticated payload exceeds the V1 bound");
  const output = Buffer.alloc(totalBytes);
  let offset = 0;
  output.write(BACKUP_PAYLOAD_MAGIC, offset, "ascii");
  offset += 8;
  output.writeUInt32BE(input.manifestBytes.length, offset);
  offset += 4;
  output.writeUInt32BE(internalRecord.length, offset);
  offset += 4;
  output.writeUInt32BE(objects.length, offset);
  offset += 4;
  input.manifestBytes.copy(output, offset);
  offset += input.manifestBytes.length;
  internalRecord.copy(output, offset);
  offset += internalRecord.length;
  objects.forEach((object, index) => {
    const path = pathBytes[index];
    if (!path) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "payload path ordering is invalid");
    output.writeUInt16BE(path.length, offset);
    offset += 2;
    path.copy(output, offset);
    offset += path.length;
    writeU64(output, offset, BigInt(object.data.length));
    offset += 8;
    object.data.copy(output, offset);
    offset += object.data.length;
  });
  return output;
}

export function parseAuthenticatedBackupPayload(input: Buffer, backupDekInput: Buffer, descriptorDigestInput: Buffer): ParsedBackupPayloadV1 {
  const backupDek = requireKey(backupDekInput, "BackupDEK");
  const descriptorDigest = requireDigest(descriptorDigestInput);
  if (!Buffer.isBuffer(input) || input.length < HEADER_BYTES || input.length > BACKUP_PAYLOAD_MAX_BYTES) return fail("BACKUP_PAYLOAD_BOUNDS", "authenticated payload exceeds the V1 bounds");
  if (input.subarray(0, 8).toString("ascii") !== BACKUP_PAYLOAD_MAGIC) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "authenticated payload magic is invalid");
  let offset = 8;
  const manifestLength = input.readUInt32BE(offset);
  offset += 4;
  const internalLength = input.readUInt32BE(offset);
  offset += 4;
  const objectCount = input.readUInt32BE(offset);
  offset += 4;
  if (manifestLength === 0 || manifestLength > 262_144 || internalLength !== BACKUP_PAYLOAD_INTERNAL_RECORD_BYTES || objectCount > MAX_OBJECTS) return fail("BACKUP_PAYLOAD_BOUNDS", "authenticated payload header exceeds the V1 bounds");
  if (offset + manifestLength + internalLength > input.length) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "authenticated payload header is truncated");
  const manifestBytes = input.subarray(offset, offset + manifestLength);
  offset += manifestLength;
  let manifest: BackupPayloadManifestV1;
  try {
    manifest = parseBackupPayloadManifest(manifestBytes);
  } catch (error) {
    return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "authenticated payload manifest is invalid", { cause: error });
  }
  if (manifest.objects.length !== objectCount) return fail("BACKUP_PAYLOAD_CONTENT_MISMATCH", "payload object count differs from manifest");
  const snapshotDbKey = unwrapSnapshotDbKey(manifest.backupId, descriptorDigest, input.subarray(offset, offset + internalLength), backupDek);
  offset += internalLength;
  const objects: BackupPayloadObjectInputV1[] = [];
  try {
    for (let index = 0; index < objectCount; index += 1) {
      if (offset + 2 > input.length) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "payload path length is truncated");
      const pathLength = input.readUInt16BE(offset);
      offset += 2;
      if (pathLength === 0 || pathLength > MAX_PATH_BYTES || offset + pathLength + 8 > input.length) return fail("BACKUP_PAYLOAD_BOUNDS", "payload path exceeds its bound");
      let path: string;
      try {
        path = decoder.decode(input.subarray(offset, offset + pathLength));
      } catch (error) {
        return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "payload path is not valid UTF-8", { cause: error });
      }
      offset += pathLength;
      const bytes = readU64(input, offset, "payload object");
      offset += 8;
      if (bytes > BigInt(input.length - offset)) return fail("BACKUP_PAYLOAD_BOUNDS", "payload object length exceeds available bytes");
      const data = Buffer.from(input.subarray(offset, offset + Number(bytes)));
      offset += Number(bytes);
      const expected = manifest.objects[index];
      if (!expected || path !== expected.path || bytes.toString(10) !== expected.bytes || digest(data) !== expected.sha256) return fail("BACKUP_PAYLOAD_CONTENT_MISMATCH", "payload object does not match its manifest entry");
      objects.push({ path, data });
    }
    if (offset !== input.length) return fail("BACKUP_PAYLOAD_FORMAT_INVALID", "payload contains trailing bytes");
    return Object.freeze({ manifest, snapshotDbKey, objects: Object.freeze(objects) });
  } catch (error) {
    snapshotDbKey.fill(0);
    throw error;
  }
}
