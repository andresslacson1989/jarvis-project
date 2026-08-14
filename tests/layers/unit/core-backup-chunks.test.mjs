import { strict as assert } from "node:assert";
import test from "node:test";
import {
  BACKUP_CHUNK_SIZE_BYTES,
  digestBackupDescriptor,
} from "../../../services/core/src/backup-descriptor.ts";
import {
  BackupChunkError,
  decryptBackupChunks,
  encryptBackupChunks,
} from "../../../services/core/src/backup-chunks.ts";

const descriptor = {
  domain: "jarvis.backup.package.v1",
  formatId: "JARVIS_BACKUP_V1",
  formatVersion: 1,
  backupId: "018f3b8e-6c68-7abc-8def-0123456789ab",
  createdAt: "2026-08-14T00:00:00.000Z",
  protectionClass: "PORTABLE_STATE",
  outerAead: "AES_256_GCM",
  chunkSizeBytes: BACKUP_CHUNK_SIZE_BYTES,
  chunkCount: "2",
  plaintextBytes: "4194307",
  noncePrefix: Buffer.from([9, 8, 7, 6]).toString("base64url"),
  payloadManifestSha256: Buffer.alloc(32, 0x55).toString("base64url"),
  keySlotCount: 1,
};

const plaintext = Buffer.concat([Buffer.alloc(BACKUP_CHUNK_SIZE_BYTES, 0x31), Buffer.from([0x32, 0x33, 0x34])]);
const backupDek = Buffer.alloc(32, 0x44);
const noncePrefix = Buffer.from([1, 2, 3, 4]);

test("AES-256-GCM chunk framing is deterministic for fixed inputs and round-trips", () => {
  const descriptorDigest = digestBackupDescriptor(descriptor);
  const first = encryptBackupChunks(descriptor, plaintext, backupDek, descriptorDigest, noncePrefix);
  const second = encryptBackupChunks(descriptor, plaintext, backupDek, descriptorDigest, noncePrefix);
  assert.deepEqual(first.noncePrefix, noncePrefix);
  assert.equal(first.chunks.length, 2);
  assert.equal(first.chunks[0].ciphertextAndTag.length, BACKUP_CHUNK_SIZE_BYTES + 16);
  assert.equal(first.chunks[1].ciphertextAndTag.length, 3 + 16);
  assert.deepEqual(first.chunks, second.chunks);
  assert.deepEqual(
    decryptBackupChunks(descriptor, first.chunks, backupDek, descriptorDigest, noncePrefix),
    plaintext,
  );
});

test("chunk decryption rejects tampering, wrong keys, reordering, duplication, truncation, and append", () => {
  const descriptorDigest = digestBackupDescriptor(descriptor);
  const encrypted = encryptBackupChunks(descriptor, plaintext, backupDek, descriptorDigest, noncePrefix);
  const tampered = encrypted.chunks.map((chunk) => ({
    ...chunk,
    ciphertextAndTag: Buffer.from(chunk.ciphertextAndTag),
  }));
  tampered[1].ciphertextAndTag[0] ^= 0x01;
  assert.throws(
    () => decryptBackupChunks(descriptor, tampered, backupDek, descriptorDigest, noncePrefix),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_AUTHENTICATION_FAILED",
  );
  assert.throws(
    () => decryptBackupChunks(descriptor, encrypted.chunks, Buffer.alloc(32, 0x45), descriptorDigest, noncePrefix),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_AUTHENTICATION_FAILED",
  );
  assert.throws(
    () => decryptBackupChunks(descriptor, [encrypted.chunks[1], encrypted.chunks[0]], backupDek, descriptorDigest, noncePrefix),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_ORDER_INVALID",
  );
  assert.throws(
    () => decryptBackupChunks(descriptor, [{ ...encrypted.chunks[0], index: "0" }, { ...encrypted.chunks[0], index: "1" }], backupDek, descriptorDigest, noncePrefix),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_LENGTH_INVALID",
  );
  assert.throws(
    () => decryptBackupChunks(descriptor, [encrypted.chunks[0]], backupDek, descriptorDigest, noncePrefix),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_ORDER_INVALID",
  );
  assert.throws(
    () => decryptBackupChunks(descriptor, [...encrypted.chunks, encrypted.chunks[1]], backupDek, descriptorDigest, noncePrefix),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_ORDER_INVALID",
  );
});

test("chunk encryption rejects key, descriptor, digest, and nonce mismatches", () => {
  const descriptorDigest = digestBackupDescriptor(descriptor);
  assert.throws(
    () => encryptBackupChunks(descriptor, plaintext, Buffer.alloc(31), descriptorDigest, noncePrefix),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_INPUT_INVALID",
  );
  assert.throws(
    () => encryptBackupChunks(descriptor, plaintext, backupDek, Buffer.alloc(32), noncePrefix),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_INPUT_INVALID",
  );
  assert.throws(
    () => encryptBackupChunks(descriptor, plaintext, backupDek, descriptorDigest, Buffer.alloc(3)),
    (error) => error instanceof BackupChunkError && error.code === "BACKUP_CHUNK_INPUT_INVALID",
  );
  assert.throws(
    () => encryptBackupChunks({ ...descriptor, chunkCount: "1" }, plaintext, backupDek, descriptorDigest, noncePrefix),
    (error) => error instanceof Error && /chunkCount does not match plaintextBytes/u.test(error.message),
  );
});
