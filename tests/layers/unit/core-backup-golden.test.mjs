import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadSyntheticJsonFixture } from "../../harness/fixtures.mjs";
import {
  canonicalizeBackupDescriptor,
  digestBackupDescriptor,
  parseBackupDescriptor,
} from "../../../services/core/src/backup-descriptor.js";
import { decryptBackupChunks, encryptBackupChunks } from "../../../services/core/src/backup-chunks.js";
import { createGeneratedRecoverySlot, unwrapGeneratedRecoverySlot } from "../../../services/core/src/backup-recovery.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("JARVIS_BACKUP_V1 golden fixture matches canonical, nonce, and AES-GCM outputs", async () => {
  const fixture = await loadSyntheticJsonFixture(root, "backup-v1-golden");
  const descriptor = parseBackupDescriptor(fixture.descriptorCanonicalUtf8);
  const key = Buffer.from(fixture.keyHex, "hex");
  const noncePrefix = Buffer.from(fixture.noncePrefixHex, "hex");
  const plaintext = Buffer.alloc(Number(descriptor.plaintextBytes));
  for (let index = 0; index < plaintext.length; index += 1) plaintext[index] = index % 251;

  assert.equal(canonicalizeBackupDescriptor(descriptor).toString("utf8"), fixture.descriptorCanonicalUtf8);
  assert.equal(digestBackupDescriptor(descriptor).toString("hex"), fixture.descriptorSha256Hex);
  const encrypted = encryptBackupChunks(
    descriptor,
    plaintext,
    key,
    digestBackupDescriptor(descriptor),
    noncePrefix,
  );
  assert.equal(encrypted.chunks.length, fixture.chunks.length);
  for (const [index, expected] of fixture.chunks.entries()) {
    const actual = encrypted.chunks[index];
    assert.equal(actual.index, expected.index);
    assert.equal(actual.ciphertextAndTag.length, expected.plaintextLength + 16);
    assert.equal(
      createHash("sha256").update(actual.ciphertextAndTag).digest("hex"),
      expected.ciphertextSha256Hex,
    );
    const nonce = Buffer.alloc(12);
    noncePrefix.copy(nonce);
    nonce.writeBigUInt64BE(BigInt(index), 4);
    const aad = JSON.stringify({
      backupId: descriptor.backupId,
      chunkCount: descriptor.chunkCount,
      chunkIndex: actual.index,
      descriptorSha256: digestBackupDescriptor(descriptor).toString("base64url"),
      domain: "jarvis.backup.chunk.v1",
      plaintextLength: expected.plaintextLength,
    });
    assert.equal(aad, expected.aadCanonicalUtf8);
    assert.equal(nonce.toString("hex"), expected.nonceHex);
  }
  const recoverySecret = Buffer.from(fixture.recoverySecretHex, "hex");
  const recoverySlot = createGeneratedRecoverySlot({
    backupId: descriptor.backupId,
    descriptorDigest: digestBackupDescriptor(descriptor),
    slotId: fixture.recoverySlot.slotId,
    recoverySecret,
    backupDek: key,
    nonce: Buffer.from(fixture.recoverySlot.nonceHex, "hex"),
  });
  assert.equal(Buffer.from(recoverySlot.wrappedBackupDek, "base64url").toString("hex"), fixture.recoverySlot.wrappedBackupDekHex);
  assert.equal(Buffer.from(recoverySlot.tag, "base64url").toString("hex"), fixture.recoverySlot.tagHex);
  assert.deepEqual(
    unwrapGeneratedRecoverySlot(recoverySlot, recoverySecret, digestBackupDescriptor(descriptor), descriptor.backupId),
    key,
  );
  assert.deepEqual(
    decryptBackupChunks(descriptor, encrypted.chunks, key, digestBackupDescriptor(descriptor), noncePrefix),
    plaintext,
  );
});
