import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  BACKUP_CHUNK_SIZE_BYTES,
  BACKUP_DESCRIPTOR_MAX_BYTES,
  BACKUP_FORMAT_ID,
  BackupDescriptorError,
  canonicalizeBackupDescriptor,
  digestBackupDescriptor,
  parseBackupDescriptor,
  validateBackupDescriptor,
} from "../../../services/core/src/backup-descriptor.ts";

const descriptor = {
  domain: "jarvis.backup.package.v1",
  formatId: BACKUP_FORMAT_ID,
  formatVersion: 1,
  backupId: "018f3b8e-6c68-7abc-8def-0123456789ab",
  createdAt: "2026-08-14T00:00:00.000Z",
  protectionClass: "PORTABLE_STATE",
  outerAead: "AES_256_GCM",
  chunkSizeBytes: BACKUP_CHUNK_SIZE_BYTES,
  chunkCount: "2",
  plaintextBytes: "4194305",
  noncePrefix: Buffer.from([1, 2, 3, 4]).toString("base64url"),
  payloadManifestSha256: Buffer.alloc(32, 0x42).toString("base64url"),
  keySlotCount: 1,
};

test("JARVIS_BACKUP_V1 descriptor canonicalization and digest are deterministic", () => {
  const canonical = canonicalizeBackupDescriptor(descriptor);
  const expected =
    '{"backupId":"018f3b8e-6c68-7abc-8def-0123456789ab","chunkCount":"2","chunkSizeBytes":4194304,"createdAt":"2026-08-14T00:00:00.000Z","domain":"jarvis.backup.package.v1","formatId":"JARVIS_BACKUP_V1","formatVersion":1,"keySlotCount":1,"noncePrefix":"AQIDBA","outerAead":"AES_256_GCM","payloadManifestSha256":"' +
    Buffer.alloc(32, 0x42).toString("base64url") +
    '","plaintextBytes":"4194305","protectionClass":"PORTABLE_STATE"}';
  assert.equal(canonical.toString("utf8"), expected);
  const digest = digestBackupDescriptor(descriptor);
  assert.equal(digest.length, 32);
  assert.deepEqual(digest, createHash("sha256").update(expected, "utf8").digest());

  const parsed = parseBackupDescriptor(canonical);
  assert.deepEqual(parsed, descriptor);
  assert.deepEqual(digestBackupDescriptor(parsed), digest);
});
test("descriptor parser rejects non-canonical, duplicate, malformed, and over-bound input", () => {
  const canonical = canonicalizeBackupDescriptor(descriptor).toString("utf8");
  for (const invalid of [
    ` ${canonical}`,
    canonical.replace('"backupId"', '"z"'),
    canonical.replace('"keySlotCount":1', '"keySlotCount":17'),
    canonical.replace('"chunkCount":"2"', '"chunkCount":"1"'),
    canonical.replace('"noncePrefix":"AQIDBA"', '"noncePrefix":"AQIDBB"'),
    canonical.replace('"plaintextBytes":"4194305"', '"plaintextBytes":"1099511627777"'),
    canonical.replace('"backupId":"018f3b8e-6c68-7abc-8def-0123456789ab"', '"backupId":"not-a-uuid"'),
    canonical.replace('"createdAt":"2026-08-14T00:00:00.000Z"', '"createdAt":"not-a-date"'),
    `${canonical.slice(0, -1)},"keySlotCount":1}`,
  ]) {
    assert.throws(
      () => parseBackupDescriptor(invalid),
      (error) => error instanceof BackupDescriptorError,
    );
  }
  assert.throws(
    () => parseBackupDescriptor(Buffer.alloc(BACKUP_DESCRIPTOR_MAX_BYTES + 1, 0x20)),
    (error) => error instanceof BackupDescriptorError && error.code === "BACKUP_DESCRIPTOR_BOUNDS",
  );
  assert.throws(
    () => parseBackupDescriptor(Buffer.from([0xff, 0xfe])),
    (error) => error instanceof BackupDescriptorError && error.code === "BACKUP_DESCRIPTOR_INPUT_INVALID",
  );
});

test("descriptor validation enforces canonical uint64 and chunk-count bounds", () => {
  assert.equal(validateBackupDescriptor({ ...descriptor, plaintextBytes: "0", chunkCount: "0" }).chunkCount, "0");
  assert.throws(
    () => validateBackupDescriptor({ ...descriptor, plaintextBytes: "01" }),
    (error) => error instanceof BackupDescriptorError && error.code === "BACKUP_DESCRIPTOR_FORMAT_INVALID",
  );
  assert.throws(
    () => validateBackupDescriptor({ ...descriptor, chunkCount: "18446744073709551616" }),
    (error) => error instanceof BackupDescriptorError && error.code === "BACKUP_DESCRIPTOR_BOUNDS",
  );
  assert.throws(
    () => validateBackupDescriptor({ ...descriptor, plaintextBytes: "4194304", chunkCount: "2" }),
    (error) => error instanceof BackupDescriptorError && error.code === "BACKUP_DESCRIPTOR_FORMAT_INVALID",
  );
});
