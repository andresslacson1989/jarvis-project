import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  BACKUP_KEY_BYTES,
  BackupManifestError,
  buildBackupPayloadManifest,
  createBackupKeyMaterial,
  destroyBackupKeyMaterial,
} from "../../../services/core/src/backup-manifest.ts";

const snapshot = {
  logicalType: "SQLCIPHER_SNAPSHOT",
  path: "database/state.db",
  bytes: "8192",
  sha256: Buffer.alloc(32, 0x11).toString("base64url"),
};

function input(overrides = {}) {
  return {
    backupId: "018f3b8e-6c68-7abc-8def-0123456789ab",
    createdAt: "2026-08-14T00:00:00.000Z",
    protectionClass: "PORTABLE_STATE",
    jarvisVersion: "1.0.6",
    protocolVersion: 1,
    schemaVersion: 1,
    snapshot,
    objects: [
      {
        logicalType: "VALIDATED_CONFIGURATION",
        path: "config/validated.json",
        bytes: "128",
        sha256: Buffer.alloc(32, 0x22).toString("base64url"),
      },
      {
        logicalType: "REGISTRY_METADATA",
        path: "registry/modules.json",
        bytes: "256",
        sha256: Buffer.alloc(32, 0x33).toString("base64url"),
      },
    ],
    keySlotProfiles: ["GENERATED_RECOVERY_V1", "PASSPHRASE_ARGON2ID_V1"],
    ...overrides,
  };
}

test("backup generation creates independent 256-bit transient keys and clears them", () => {
  const first = createBackupKeyMaterial();
  const second = createBackupKeyMaterial();
  assert.equal(first.snapshotDbKey.length, BACKUP_KEY_BYTES);
  assert.equal(first.backupDek.length, BACKUP_KEY_BYTES);
  assert.equal(first.snapshotDbKey.equals(first.backupDek), false);
  assert.equal(first.snapshotDbKey.equals(second.snapshotDbKey), false);
  assert.equal(first.backupDek.equals(second.backupDek), false);
  destroyBackupKeyMaterial(first);
  assert.deepEqual(first.snapshotDbKey, Buffer.alloc(BACKUP_KEY_BYTES));
  assert.deepEqual(first.backupDek, Buffer.alloc(BACKUP_KEY_BYTES));
  destroyBackupKeyMaterial(second);
});

test("payload manifest is bounded, canonical, sorted, and key-material-free", () => {
  const material = createBackupKeyMaterial();
  try {
    const built = buildBackupPayloadManifest(input());
    assert.equal(built.manifest.domain, "jarvis.backup.payload-manifest.v1");
    assert.equal(built.manifest.snapshotDbKeyRef, "INTERNAL_SECRET_PAYLOAD_ONLY");
    assert.deepEqual(
      built.manifest.objects.map((object) => object.path),
      ["config/validated.json", "database/state.db", "registry/modules.json"],
    );
    assert.deepEqual(built.digest, createHash("sha256").update(built.canonicalBytes).digest());
    assert.equal(built.canonicalBytes.includes(material.snapshotDbKey), false);
    assert.equal(built.canonicalBytes.includes(material.backupDek), false);
    assert.equal(built.canonicalBytes.byteLength < 262_144, true);
  } finally {
    destroyBackupKeyMaterial(material);
  }
});

test("payload manifest rejects secret-bearing content, duplicates, malformed bounds, and unknown fields", () => {
  const invalidInputs = [
    input({
      objects: [
        {
          logicalType: "DURABLE_ARTIFACT",
          path: "config/provider-credentials.json",
          bytes: "1",
          sha256: Buffer.alloc(32).toString("base64url"),
        },
      ],
    }),
    input({ objects: [input().objects[0], input().objects[0]] }),
    input({ snapshot: { ...snapshot, bytes: "01" } }),
    input({ snapshot: { ...snapshot, sha256: "not-a-digest" } }),
    { ...input(), snapshotDbKey: Buffer.alloc(32) },
  ];
  for (const invalid of invalidInputs) {
    assert.throws(
      () => buildBackupPayloadManifest(invalid),
      (error) => error instanceof BackupManifestError,
    );
  }
  assert.throws(
    () => buildBackupPayloadManifest(input({ objects: [{ ...input().objects[0], path: "../outside.json" }] })),
    (error) => error instanceof BackupManifestError && error.code === "BACKUP_MANIFEST_INPUT_INVALID",
  );
});
