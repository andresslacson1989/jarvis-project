import { strict as assert } from "node:assert";
import test from "node:test";
import { digestBackupDescriptor } from "../../../services/core/src/backup-descriptor.ts";
import {
  GeneratedRecoveryError,
  createGeneratedRecoverySecret,
  createGeneratedRecoverySlot,
  destroyGeneratedRecoverySecret,
  formatGeneratedRecoverySecret,
  parseGeneratedRecoverySecret,
  unwrapGeneratedRecoverySlot,
} from "../../../services/core/src/backup-recovery.ts";

const descriptor = {
  domain: "jarvis.backup.package.v1",
  formatId: "JARVIS_BACKUP_V1",
  formatVersion: 1,
  backupId: "018f3b8e-6c68-7abc-8def-0123456789ab",
  createdAt: "2026-08-14T00:00:00.000Z",
  protectionClass: "PORTABLE_STATE",
  outerAead: "AES_256_GCM",
  chunkSizeBytes: 4194304,
  chunkCount: "0",
  plaintextBytes: "0",
  noncePrefix: Buffer.from([1, 2, 3, 4]).toString("base64url"),
  payloadManifestSha256: Buffer.alloc(32, 0x55).toString("base64url"),
  keySlotCount: 1,
};

const descriptorDigest = digestBackupDescriptor(descriptor);
const backupDek = Buffer.alloc(32, 0x22);
const recoverySecret = Buffer.alloc(32, 0x33);

test("generated recovery representation is exact, reversible, and clearable", () => {
  const presentation = formatGeneratedRecoverySecret(recoverySecret);
  assert.match(presentation, /^JRV1-[A-Za-z0-9_-]{43}$/u);
  assert.deepEqual(parseGeneratedRecoverySecret(presentation), recoverySecret);
  assert.equal(createGeneratedRecoverySecret().length, 32);
  const transient = Buffer.from(recoverySecret);
  destroyGeneratedRecoverySecret(transient);
  assert.deepEqual(transient, Buffer.alloc(32));
  for (const invalid of ["JRV2-abc", "JRV1-", `JRV1-${"A".repeat(44)}`, `JRV1-${"A".repeat(42)}=`]) {
    assert.throws(
      () => parseGeneratedRecoverySecret(invalid),
      (error) => error instanceof GeneratedRecoveryError && error.code === "GENERATED_RECOVERY_SECRET_INVALID",
    );
  }
});

test("generated recovery slot derives HKDF KEK and wraps BackupDEK with exact authenticated metadata", () => {
  const slot = createGeneratedRecoverySlot({
    backupId: descriptor.backupId,
    descriptorDigest,
    slotId: "recovery-01",
    recoverySecret,
    backupDek,
    nonce: Buffer.alloc(12, 0x44),
  });
  assert.equal(slot.slotType, "GENERATED_RECOVERY_V1");
  assert.equal(slot.wrapAead, "AES_256_GCM");
  assert.equal(slot.nonce, Buffer.alloc(12, 0x44).toString("base64url"));
  assert.notEqual(slot.wrappedBackupDek, backupDek.toString("base64url"));
  assert.equal(JSON.stringify(slot).includes(recoverySecret.toString("base64url")), false);
  assert.deepEqual(
    unwrapGeneratedRecoverySlot(slot, recoverySecret, descriptorDigest, descriptor.backupId),
    backupDek,
  );
});

test("generated recovery slot fails closed for wrong factors and modified metadata", () => {
  const slot = createGeneratedRecoverySlot({
    backupId: descriptor.backupId,
    descriptorDigest,
    slotId: "recovery-02",
    recoverySecret,
    backupDek,
    nonce: Buffer.alloc(12, 0x45),
  });
  assert.throws(
    () => unwrapGeneratedRecoverySlot(slot, Buffer.alloc(32, 0x34), descriptorDigest, descriptor.backupId),
    (error) => error instanceof GeneratedRecoveryError && error.code === "GENERATED_RECOVERY_AUTHENTICATION_FAILED",
  );
  assert.throws(
    () => unwrapGeneratedRecoverySlot({ ...slot, slotId: "changed" }, recoverySecret, descriptorDigest, descriptor.backupId),
    (error) => error instanceof GeneratedRecoveryError && error.code === "GENERATED_RECOVERY_AUTHENTICATION_FAILED",
  );
  assert.throws(
    () => unwrapGeneratedRecoverySlot({ ...slot, descriptorSha256: Buffer.alloc(32).toString("base64url") }, recoverySecret, descriptorDigest, descriptor.backupId),
    (error) => error instanceof GeneratedRecoveryError && error.code === "GENERATED_RECOVERY_METADATA_INVALID",
  );
  assert.throws(
    () => unwrapGeneratedRecoverySlot({ ...slot, tag: Buffer.alloc(16).toString("base64url") }, recoverySecret, descriptorDigest, descriptor.backupId),
    (error) => error instanceof GeneratedRecoveryError && error.code === "GENERATED_RECOVERY_AUTHENTICATION_FAILED",
  );
});
