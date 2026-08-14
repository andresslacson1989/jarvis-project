import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  BACKUP_CHUNK_NONCE_BYTES,
  BACKUP_CHUNK_SIZE_BYTES,
  BACKUP_CHUNK_TAG_BYTES,
  canonicalizeJcs,
  digestBackupDescriptor,
  validateBackupDescriptor,
} from "./backup-descriptor.js";
import type { BackupPackageDescriptorV1 } from "./backup-descriptor.js";

export const BACKUP_CHUNK_DOMAIN = "jarvis.backup.chunk.v1" as const;
export const BACKUP_AES_KEY_BYTES = 32 as const;
export const BACKUP_NONCE_PREFIX_BYTES = 4 as const;

export interface BackupChunkAadV1 {
  readonly domain: typeof BACKUP_CHUNK_DOMAIN;
  readonly backupId: string;
  readonly descriptorSha256: string;
  readonly chunkIndex: string;
  readonly chunkCount: string;
  readonly plaintextLength: number;
}

export interface BackupChunkRecordV1 {
  readonly index: string;
  readonly ciphertextAndTag: Buffer;
}

export interface EncryptedBackupChunksV1 {
  readonly noncePrefix: Buffer;
  readonly chunks: readonly BackupChunkRecordV1[];
}

export type BackupChunkFailureCode =
  | "BACKUP_CHUNK_INPUT_INVALID"
  | "BACKUP_CHUNK_BOUNDS"
  | "BACKUP_CHUNK_ORDER_INVALID"
  | "BACKUP_CHUNK_LENGTH_INVALID"
  | "BACKUP_CHUNK_AUTHENTICATION_FAILED";

export class BackupChunkError extends Error {
  readonly code: BackupChunkFailureCode;

  constructor(code: BackupChunkFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackupChunkError";
    this.code = code;
  }
}

function fail(code: BackupChunkFailureCode, message: string, options?: ErrorOptions): never {
  throw new BackupChunkError(code, message, options);
}

function requireKey(key: unknown): Buffer {
  if (!Buffer.isBuffer(key) || key.length !== BACKUP_AES_KEY_BYTES) {
    return fail("BACKUP_CHUNK_INPUT_INVALID", "BackupDEK must be exactly 256 bits");
  }
  return key;
}

function requireNoncePrefix(prefix: unknown): Buffer {
  if (!Buffer.isBuffer(prefix) || prefix.length !== BACKUP_NONCE_PREFIX_BYTES) {
    return fail("BACKUP_CHUNK_INPUT_INVALID", "noncePrefix must be exactly 32 bits");
  }
  return Buffer.from(prefix);
}

function requireDigest(digest: unknown, descriptor: BackupPackageDescriptorV1): Buffer {
  if (!Buffer.isBuffer(digest) || digest.length !== 32) {
    return fail("BACKUP_CHUNK_INPUT_INVALID", "descriptorSha256 must be exactly 256 bits");
  }
  const expected = digestBackupDescriptor(descriptor);
  if (!expected.equals(digest)) return fail("BACKUP_CHUNK_INPUT_INVALID", "descriptorSha256 does not bind the descriptor");
  return Buffer.from(digest);
}

function requireCanonicalUint64(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return fail("BACKUP_CHUNK_INPUT_INVALID", `${field} must be canonical uint64 decimal text`);
  }
  const parsed = BigInt(value);
  if (parsed > 18_446_744_073_709_551_615n) return fail("BACKUP_CHUNK_BOUNDS", `${field} exceeds uint64`);
  return parsed;
}

function nonceFor(prefix: Buffer, index: bigint): Buffer {
  if (index < 0n || index > 18_446_744_073_709_551_615n) return fail("BACKUP_CHUNK_BOUNDS", "chunk index exceeds uint64");
  const nonce = Buffer.alloc(BACKUP_CHUNK_NONCE_BYTES);
  prefix.copy(nonce, 0);
  nonce.writeBigUInt64BE(index, BACKUP_NONCE_PREFIX_BYTES);
  return nonce;
}

function aadFor(
  descriptor: BackupPackageDescriptorV1,
  descriptorDigest: Buffer,
  index: bigint,
  plaintextLength: number,
): { value: BackupChunkAadV1; bytes: Buffer } {
  const value = {
    domain: BACKUP_CHUNK_DOMAIN,
    backupId: descriptor.backupId,
    descriptorSha256: descriptorDigest.toString("base64url"),
    chunkIndex: index.toString(10),
    chunkCount: descriptor.chunkCount,
    plaintextLength,
  } satisfies BackupChunkAadV1;
  return { value, bytes: canonicalizeJcs(value) };
}

function expectedChunkPlaintextLength(descriptor: BackupPackageDescriptorV1, index: bigint): number {
  const total = BigInt(descriptor.plaintextBytes);
  const offset = index * BigInt(BACKUP_CHUNK_SIZE_BYTES);
  if (offset >= total) return 0;
  const remaining = total - offset;
  return Number(remaining > BigInt(BACKUP_CHUNK_SIZE_BYTES) ? BigInt(BACKUP_CHUNK_SIZE_BYTES) : remaining);
}

function validateChunkCount(descriptor: BackupPackageDescriptorV1, actual: bigint): void {
  const expected = requireCanonicalUint64(descriptor.chunkCount, "descriptor.chunkCount");
  if (expected !== actual) return fail("BACKUP_CHUNK_LENGTH_INVALID", "chunk count does not match descriptor");
}

export function encryptBackupChunks(
  descriptorInput: BackupPackageDescriptorV1,
  plaintextInput: Buffer,
  backupDekInput: Buffer,
  descriptorDigestInput: Buffer,
  noncePrefixInput?: Buffer,
): EncryptedBackupChunksV1 {
  const descriptor = validateBackupDescriptor(descriptorInput);
  const plaintext = Buffer.isBuffer(plaintextInput) ? plaintextInput : fail("BACKUP_CHUNK_INPUT_INVALID", "plaintext must be a Buffer");
  const backupDek = requireKey(backupDekInput);
  const descriptorDigest = requireDigest(descriptorDigestInput, descriptor);
  if (plaintext.length > 1_099_511_627_776) return fail("BACKUP_CHUNK_BOUNDS", "plaintext exceeds the V1 maximum");
  if (BigInt(plaintext.length) !== BigInt(descriptor.plaintextBytes)) {
    return fail("BACKUP_CHUNK_LENGTH_INVALID", "plaintext length does not match descriptor");
  }
  const chunkCount = plaintext.length === 0 ? 0n : (BigInt(plaintext.length) + BigInt(BACKUP_CHUNK_SIZE_BYTES) - 1n) / BigInt(BACKUP_CHUNK_SIZE_BYTES);
  validateChunkCount(descriptor, chunkCount);
  const noncePrefix = noncePrefixInput === undefined ? randomBytes(BACKUP_NONCE_PREFIX_BYTES) : requireNoncePrefix(noncePrefixInput);
  const chunks: BackupChunkRecordV1[] = [];
  for (let index = 0n; index < chunkCount; index += 1n) {
    const plaintextLength = expectedChunkPlaintextLength(descriptor, index);
    const start = Number(index * BigInt(BACKUP_CHUNK_SIZE_BYTES));
    const chunk = plaintext.subarray(start, start + plaintextLength);
    const { bytes: aad } = aadFor(descriptor, descriptorDigest, index, plaintextLength);
    const cipher = createCipheriv("aes-256-gcm", backupDek, nonceFor(noncePrefix, index));
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(chunk), cipher.final(), cipher.getAuthTag()]);
    chunks.push(Object.freeze({ index: index.toString(10), ciphertextAndTag: ciphertext }));
  }
  return Object.freeze({ noncePrefix, chunks: Object.freeze(chunks) });
}

export function decryptBackupChunks(
  descriptorInput: BackupPackageDescriptorV1,
  records: readonly BackupChunkRecordV1[],
  backupDekInput: Buffer,
  descriptorDigestInput: Buffer,
  noncePrefixInput: Buffer,
): Buffer {
  const descriptor = validateBackupDescriptor(descriptorInput);
  if (!Array.isArray(records)) return fail("BACKUP_CHUNK_INPUT_INVALID", "chunk records must be an array");
  const backupDek = requireKey(backupDekInput);
  const descriptorDigest = requireDigest(descriptorDigestInput, descriptor);
  const noncePrefix = requireNoncePrefix(noncePrefixInput);
  const expectedCount = requireCanonicalUint64(descriptor.chunkCount, "descriptor.chunkCount");
  if (BigInt(records.length) !== expectedCount) return fail("BACKUP_CHUNK_ORDER_INVALID", "chunk records are incomplete or have trailing records");
  const plaintextParts: Buffer[] = [];
  for (let position = 0; position < records.length; position += 1) {
    const record = records[position];
    if (!record || typeof record.index !== "string" || !Buffer.isBuffer(record.ciphertextAndTag)) {
      return fail("BACKUP_CHUNK_INPUT_INVALID", "chunk record shape is invalid");
    }
    const index = requireCanonicalUint64(record.index, "chunk.index");
    if (index !== BigInt(position)) return fail("BACKUP_CHUNK_ORDER_INVALID", "chunks must be contiguous and in order");
    const plaintextLength = expectedChunkPlaintextLength(descriptor, index);
    const expectedCiphertextLength = plaintextLength + BACKUP_CHUNK_TAG_BYTES;
    if (record.ciphertextAndTag.length !== expectedCiphertextLength) {
      return fail("BACKUP_CHUNK_LENGTH_INVALID", "chunk length is inconsistent with the descriptor");
    }
    const { bytes: aad } = aadFor(descriptor, descriptorDigest, index, plaintextLength);
    const ciphertext = record.ciphertextAndTag.subarray(0, -BACKUP_CHUNK_TAG_BYTES);
    const tag = record.ciphertextAndTag.subarray(-BACKUP_CHUNK_TAG_BYTES);
    try {
      const decipher = createDecipheriv("aes-256-gcm", backupDek, nonceFor(noncePrefix, index));
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      plaintextParts.push(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
    } catch (error) {
      return fail("BACKUP_CHUNK_AUTHENTICATION_FAILED", "chunk authentication failed", { cause: error });
    }
  }
  const plaintext = Buffer.concat(plaintextParts);
  if (BigInt(plaintext.length) !== BigInt(descriptor.plaintextBytes)) {
    return fail("BACKUP_CHUNK_LENGTH_INVALID", "decrypted length does not match descriptor");
  }
  return plaintext;
}
