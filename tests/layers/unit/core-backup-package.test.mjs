import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  BACKUP_CHUNK_SIZE_BYTES,
  canonicalizeBackupDescriptor,
  digestBackupDescriptor,
} from "../../../services/core/src/backup-descriptor.ts";
import {
  buildBackupPayloadManifest,
  digestBackupPayloadManifest,
  parseBackupPayloadManifest,
} from "../../../services/core/src/backup-manifest.ts";
import { encryptBackupChunks } from "../../../services/core/src/backup-chunks.ts";
import { openCoreDatabase, exportSqlcipherSnapshot } from "../../../services/core/src/persistence.ts";
import { applyCoreMigrations } from "../../../services/core/src/schema.ts";
import {
  createGeneratedRecoverySlot,
} from "../../../services/core/src/backup-recovery.ts";
import { buildAuthenticatedBackupPayload } from "../../../services/core/src/backup-payload.ts";
import {
  BackupPackageVerificationError,
  acquirePortableRestoreMaintenanceLock,
  createAuthenticatedBackupPackage,
  restoreVerifiedPortableBackup,
  verifyAuthenticatedBackupPackage,
  verifySqlcipherSnapshotFile,
  verifyBackupPackagePrimitives,
} from "../../../services/core/src/backup-package.ts";

const backupId = "018f3b8e-6c68-7abc-8def-0123456789ab";
const recoverySecret = Buffer.alloc(32, 0x61);
const backupDek = Buffer.alloc(32, 0x62);
const noncePrefix = Buffer.from([5, 6, 7, 8]);

function buildSessionPasswordVerifier() {
  return {
    profileId: "session-password-v1",
    purpose: "SESSION_PASSWORD",
    algorithm: "ARGON2ID",
    version: 0x13,
    memoryKiB: 65536,
    iterations: 3,
    parallelism: 4,
    salt: Buffer.alloc(16, 0x51),
    verifier: Buffer.alloc(32, 0x52),
  };
}

function buildFixture() {
  const builtManifest = buildBackupPayloadManifest({
    backupId,
    createdAt: "2026-08-14T00:00:00.000Z",
    protectionClass: "PORTABLE_STATE",
    jarvisVersion: "1.0.6",
    protocolVersion: 1,
    schemaVersion: 1,
    snapshot: {
      logicalType: "SQLCIPHER_SNAPSHOT",
      path: "database/state.db",
      bytes: "7",
      sha256: Buffer.alloc(32, 0x71).toString("base64url"),
    },
    objects: [],
    keySlotProfiles: ["GENERATED_RECOVERY_V1"],
  });
  const plaintext = Buffer.from("payload", "utf8");
  const descriptor = {
    domain: "jarvis.backup.package.v1",
    formatId: "JARVIS_BACKUP_V1",
    formatVersion: 1,
    backupId,
    createdAt: "2026-08-14T00:00:00.000Z",
    protectionClass: "PORTABLE_STATE",
    outerAead: "AES_256_GCM",
    chunkSizeBytes: BACKUP_CHUNK_SIZE_BYTES,
    chunkCount: "1",
    plaintextBytes: "7",
    noncePrefix: noncePrefix.toString("base64url"),
    payloadManifestSha256: digestBackupPayloadManifest(builtManifest.manifest).toString("base64url"),
    keySlotCount: 1,
  };
  const descriptorDigest = digestBackupDescriptor(descriptor);
  const slot = createGeneratedRecoverySlot({
    backupId,
    descriptorDigest,
    slotId: "generated-01",
    recoverySecret,
    backupDek,
    nonce: Buffer.alloc(12, 0x63),
  });
  const encrypted = encryptBackupChunks(descriptor, plaintext, backupDek, descriptorDigest, noncePrefix);
  return { descriptor, builtManifest, plaintext, slot, encrypted };
}

test("payload manifest parser and package verifier bind descriptor, slot, manifest, and chunks", () => {
  const fixture = buildFixture();
  const parsedManifest = parseBackupPayloadManifest(fixture.builtManifest.canonicalBytes);
  assert.deepEqual(parsedManifest, fixture.builtManifest.manifest);
  const verified = verifyBackupPackagePrimitives({
    descriptor: canonicalizeBackupDescriptor(fixture.descriptor),
    payloadManifest: fixture.builtManifest.canonicalBytes,
    chunks: fixture.encrypted.chunks,
    generatedRecoverySlot: fixture.slot,
    recoverySecret,
    noncePrefix,
  });
  assert.deepEqual(verified.plaintext, fixture.plaintext);
  assert.equal(verified.descriptorDigest.length, 32);
});

test("package verifier fails closed for noncanonical manifests, binding drift, wrong factors, and ciphertext tamper", () => {
  const fixture = buildFixture();
  const base = {
    descriptor: canonicalizeBackupDescriptor(fixture.descriptor),
    payloadManifest: fixture.builtManifest.canonicalBytes,
    chunks: fixture.encrypted.chunks,
    generatedRecoverySlot: fixture.slot,
    recoverySecret,
    noncePrefix,
  };
  assert.throws(
    () => verifyBackupPackagePrimitives({ ...base, payloadManifest: Buffer.concat([Buffer.from(" "), fixture.builtManifest.canonicalBytes]) }),
    (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_MANIFEST_INVALID",
  );
  assert.throws(
    () => verifyBackupPackagePrimitives({ ...base, recoverySecret: Buffer.alloc(32, 0x64) }),
    (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_SLOT_INVALID",
  );
  const tamperedChunks = fixture.encrypted.chunks.map((chunk) => ({
    ...chunk,
    ciphertextAndTag: Buffer.from(chunk.ciphertextAndTag),
  }));
  tamperedChunks[0].ciphertextAndTag[0] ^= 0x01;
  assert.throws(
    () => verifyBackupPackagePrimitives({ ...base, chunks: tamperedChunks }),
    (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_AUTHENTICATION_FAILED",
  );
  assert.throws(
    () => verifyBackupPackagePrimitives({
      ...base,
      descriptor: canonicalizeBackupDescriptor({ ...fixture.descriptor, payloadManifestSha256: Buffer.alloc(32, 0x70).toString("base64url") }),
    }),
    (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_BINDING_INVALID",
  );
});

test("authenticated payload envelope carries only wrapped SnapshotDBKey and verifies through package chunks", () => {
  const builtManifest = buildBackupPayloadManifest({
    backupId,
    createdAt: "2026-08-14T00:00:00.000Z",
    protectionClass: "PORTABLE_STATE",
    jarvisVersion: "1.0.6",
    protocolVersion: 1,
    schemaVersion: 1,
    snapshot: {
      logicalType: "SQLCIPHER_SNAPSHOT",
      path: "database/state.db",
      bytes: "6",
      sha256: createHash("sha256").update("snap!!", "utf8").digest("base64url"),
    },
    objects: [],
    keySlotProfiles: ["GENERATED_RECOVERY_V1"],
  });
  const snapshotDbKey = Buffer.alloc(32, 0x65);
  const payloadObjects = [{ path: "database/state.db", data: Buffer.from("snap!!", "utf8") }];
  const placeholderDigest = Buffer.alloc(32);
  const placeholderPayload = buildAuthenticatedBackupPayload({
    manifestBytes: builtManifest.canonicalBytes,
    descriptorDigest: placeholderDigest,
    backupId,
    snapshotDbKey,
    backupDek,
    objects: payloadObjects,
  });
  const descriptor = {
    domain: "jarvis.backup.package.v1",
    formatId: "JARVIS_BACKUP_V1",
    formatVersion: 1,
    backupId,
    createdAt: "2026-08-14T00:00:00.000Z",
    protectionClass: "PORTABLE_STATE",
    outerAead: "AES_256_GCM",
    chunkSizeBytes: BACKUP_CHUNK_SIZE_BYTES,
    chunkCount: "1",
    plaintextBytes: placeholderPayload.length.toString(10),
    noncePrefix: noncePrefix.toString("base64url"),
    payloadManifestSha256: digestBackupPayloadManifest(builtManifest.manifest).toString("base64url"),
    keySlotCount: 1,
  };
  const descriptorDigest = digestBackupDescriptor(descriptor);
  const payload = buildAuthenticatedBackupPayload({
    manifestBytes: builtManifest.canonicalBytes,
    descriptorDigest,
    backupId,
    snapshotDbKey,
    backupDek,
    objects: payloadObjects,
  });
  assert.equal(payload.length, placeholderPayload.length);
  const chunks = encryptBackupChunks(descriptor, payload, backupDek, descriptorDigest, noncePrefix);
  const slot = createGeneratedRecoverySlot({
    backupId,
    descriptorDigest,
    slotId: "generated-envelope",
    recoverySecret,
    backupDek,
    nonce: Buffer.alloc(12, 0x66),
  });
  const verified = verifyAuthenticatedBackupPackage({
    descriptor: canonicalizeBackupDescriptor(descriptor),
    chunks: chunks.chunks,
    generatedRecoverySlot: slot,
    recoverySecret,
    noncePrefix,
  });
  assert.deepEqual(verified.snapshotDbKey, snapshotDbKey);
  assert.deepEqual(verified.objects[0].data, Buffer.from("snap!!", "utf8"));
  assert.equal(payload.includes(snapshotDbKey), false);
  verified.snapshotDbKey.fill(0);
});

test("authenticated package verification reopens the qualified SQLCipher snapshot under recovered SnapshotDBKey", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-backup-package-"));
  await mkdir(join(root, "recovery"), { recursive: true });
  const livePath = join(root, "live.db");
  const snapshotPath = join(root, "snapshot.db");
  let live;
  try {
    live = openCoreDatabase(livePath, { dbDek: Buffer.alloc(32, 0x67) });
    applyCoreMigrations(live, () => "2026-08-14T00:00:00.000Z");
    live.database.prepare("INSERT INTO authoritative_records(record_id, record_type, state_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run("package-proof", "TEST", "{\"state\":\"READY\"}", 1, "2026-08-14T00:00:00.000Z", "2026-08-14T00:00:00.000Z");
    live.database.prepare("INSERT INTO integration_accounts (integration_account_id, provider_id, account_label, credential_handle, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("package-account", "provider-proof", "Example", "old-profile-handle", "ACTIVE", 1, "2026-08-14T00:00:00.000Z", "2026-08-14T00:00:00.000Z");
    const snapshotDbKey = Buffer.alloc(32, 0x68);
    await exportSqlcipherSnapshot(live, snapshotPath, snapshotDbKey);
    live.close();
    const snapshotBytes = await readFile(snapshotPath);
    const snapshotHash = createHash("sha256").update(snapshotBytes).digest("base64url");
    const builtManifest = buildBackupPayloadManifest({
      backupId,
      createdAt: "2026-08-14T00:00:00.000Z",
      protectionClass: "PORTABLE_STATE",
      jarvisVersion: "1.0.6",
      protocolVersion: 1,
      schemaVersion: 1,
      snapshot: { logicalType: "SQLCIPHER_SNAPSHOT", path: "database/state.db", bytes: snapshotBytes.length.toString(10), sha256: snapshotHash },
      objects: [],
      keySlotProfiles: ["GENERATED_RECOVERY_V1"],
    });
    const builtPackage = createAuthenticatedBackupPackage({
      backupId,
      createdAt: "2026-08-14T00:00:00.000Z",
      protectionClass: "PORTABLE_STATE",
      manifestBytes: builtManifest.canonicalBytes,
      snapshotDbKey,
      backupDek,
      recoverySecret,
      slotId: "generated-sqlcipher",
      objects: [{ path: "database/state.db", data: snapshotBytes }],
      noncePrefix,
    });
    const verified = verifyAuthenticatedBackupPackage({
      descriptor: builtPackage.descriptorBytes,
      chunks: builtPackage.chunks,
      generatedRecoverySlot: builtPackage.generatedRecoverySlot,
      recoverySecret,
      noncePrefix: builtPackage.noncePrefix,
    });
    const extractedPath = join(root, "extracted.db");
    await writeFile(extractedPath, verified.objects[0].data, { flag: "wx" });
    verifySqlcipherSnapshotFile(extractedPath, verified.snapshotDbKey);
    const restoredPath = join(root, "clean-profile.db");
    const newDbDek = Buffer.alloc(32, 0x69);
    let protectedDbDek;
    let committed = false;
    const restored = await restoreVerifiedPortableBackup({
      descriptor: builtPackage.descriptorBytes,
      chunks: builtPackage.chunks,
      generatedRecoverySlot: builtPackage.generatedRecoverySlot,
      recoverySecret,
      noncePrefix: builtPackage.noncePrefix,
      destinationPath: restoredPath,
      maintenanceLockPath: join(root, "maintenance.lock"),
      recoveryMarkerPath: join(root, "recovery", "restore-required.marker"),
      sessionPasswordVerifier: buildSessionPasswordVerifier(),
      protectNewDbDek: async (dbDek) => {
        protectedDbDek = Buffer.from(dbDek);
        return {
          handle: "dpapi-v1-test-handle",
          commit: async () => {
            committed = true;
          },
          abort: async () => undefined,
        };
      },
      newDbDek,
      now: "2026-08-14T01:00:00.000Z",
    });
    assert.deepEqual(protectedDbDek, newDbDek);
    assert.equal(committed, true);
    assert.deepEqual(restored.affectedIntegrationAccountIds, ["package-account"]);
    assert.equal(
      (await readFile(join(root, "recovery", "restore-required.marker"), "utf8")),
      "JARVIS_RECOVERY_REQUIRED_V1\n",
    );
    const cleanProfile = openCoreDatabase(restoredPath, { dbDek: newDbDek });
    try {
      assert.equal(cleanProfile.database.prepare("SELECT record_id FROM authoritative_records WHERE record_id = ?").get("package-proof").record_id, "package-proof");
      assert.deepEqual(
        cleanProfile.database.prepare("SELECT credential_handle, state FROM integration_accounts WHERE integration_account_id = ?").get("package-account"),
        { credential_handle: null, state: "REAUTH_REQUIRED" },
      );
    } finally {
      cleanProfile.close();
    }
    const entriesBeforeRejectedRestores = (await readdir(root)).sort();
    const wrongFactorDestination = join(root, "wrong-factor.db");
    await assert.rejects(
      () => restoreVerifiedPortableBackup({
        descriptor: builtPackage.descriptorBytes,
        chunks: builtPackage.chunks,
        generatedRecoverySlot: builtPackage.generatedRecoverySlot,
        recoverySecret: Buffer.alloc(32, 0x64),
        noncePrefix: builtPackage.noncePrefix,
        destinationPath: wrongFactorDestination,
        maintenanceLockPath: join(root, "wrong-factor.maintenance.lock"),
        recoveryMarkerPath: join(root, "recovery", "wrong-factor.marker"),
        sessionPasswordVerifier: buildSessionPasswordVerifier(),
        protectNewDbDek: async () => {
          throw new Error("wrong-factor restore must fail before DB_DEK protection");
        },
        newDbDek: Buffer.alloc(32, 0x72),
        now: "2026-08-14T01:00:00.000Z",
      }),
      (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_SLOT_INVALID",
    );
    await assert.rejects(() => readFile(wrongFactorDestination));
    assert.deepEqual(await readFile(snapshotPath), snapshotBytes);

    const tamperedRestoreChunks = builtPackage.chunks.map((chunk) => ({
      ...chunk,
      ciphertextAndTag: Buffer.from(chunk.ciphertextAndTag),
    }));
    tamperedRestoreChunks[0].ciphertextAndTag[0] ^= 0x01;
    const tamperedDestination = join(root, "tampered.db");
    await assert.rejects(
      () => restoreVerifiedPortableBackup({
        descriptor: builtPackage.descriptorBytes,
        chunks: tamperedRestoreChunks,
        generatedRecoverySlot: builtPackage.generatedRecoverySlot,
        recoverySecret,
        noncePrefix: builtPackage.noncePrefix,
        destinationPath: tamperedDestination,
        maintenanceLockPath: join(root, "tampered.maintenance.lock"),
        recoveryMarkerPath: join(root, "recovery", "tampered.marker"),
        sessionPasswordVerifier: buildSessionPasswordVerifier(),
        protectNewDbDek: async () => {
          throw new Error("tampered restore must fail before DB_DEK protection");
        },
        newDbDek: Buffer.alloc(32, 0x73),
        now: "2026-08-14T01:00:00.000Z",
      }),
      (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_AUTHENTICATION_FAILED",
    );
    await assert.rejects(() => readFile(tamperedDestination));
    assert.deepEqual((await readdir(root)).sort(), entriesBeforeRejectedRestores);
    await assert.rejects(
      () => restoreVerifiedPortableBackup({
        descriptor: builtPackage.descriptorBytes,
        chunks: builtPackage.chunks,
        generatedRecoverySlot: builtPackage.generatedRecoverySlot,
        recoverySecret,
        noncePrefix: builtPackage.noncePrefix,
        destinationPath: join(root, "protection-failed.db"),
        maintenanceLockPath: join(root, "protection-failed.maintenance.lock"),
        recoveryMarkerPath: join(root, "recovery", "protection-failed.marker"),
        sessionPasswordVerifier: buildSessionPasswordVerifier(),
        protectNewDbDek: async () => {
          throw new Error("secure-storage test rejection");
        },
        newDbDek: Buffer.alloc(32, 0x70),
        now: "2026-08-14T01:00:00.000Z",
      }),
      (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_DB_DEK_PROTECTION_FAILED",
    );
    await assert.rejects(() => readFile(join(root, "protection-failed.db")));
    await assert.rejects(
      () => restoreVerifiedPortableBackup({
        descriptor: builtPackage.descriptorBytes,
        chunks: builtPackage.chunks,
        generatedRecoverySlot: builtPackage.generatedRecoverySlot,
        recoverySecret,
        noncePrefix: builtPackage.noncePrefix,
        destinationPath: join(root, "marker-failed.db"),
        maintenanceLockPath: join(root, "marker-failed.maintenance.lock"),
        recoveryMarkerPath: join(root, "missing-recovery", "restore-required.marker"),
        sessionPasswordVerifier: buildSessionPasswordVerifier(),
        protectNewDbDek: async () => ({
          handle: "dpapi-v1-marker-test-handle",
          commit: async () => undefined,
          abort: async () => undefined,
        }),
        newDbDek: Buffer.alloc(32, 0x71),
        now: "2026-08-14T01:00:00.000Z",
      }),
      (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_RECOVERY_MARKER_INVALID",
    );
    await assert.rejects(() => readFile(join(root, "marker-failed.db")));
    protectedDbDek?.fill(0);
    newDbDek.fill(0);
    verified.snapshotDbKey.fill(0);
  } finally {
    live?.close();
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test("portable restore maintenance locking is exclusive and reclaims only a dead stale owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-maintenance-lock-"));
  const lockPath = join(root, "maintenance.lock");
  try {
    await assert.rejects(
      () => acquirePortableRestoreMaintenanceLock("relative-maintenance.lock"),
      (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
    );
    const first = await acquirePortableRestoreMaintenanceLock(lockPath);
    await assert.rejects(
      () => acquirePortableRestoreMaintenanceLock(lockPath),
      (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_MAINTENANCE_LOCKED",
    );
    await first.release();

    await writeFile(
      lockPath,
      JSON.stringify({ ownerPid: 2_147_483_647, ownerToken: "018f3b8e-6c68-7abc-8def-0123456789ab", createdAt: Date.now() - 16 * 60 * 1000 }),
      { flag: "wx" },
    );
    const reclaimed = await acquirePortableRestoreMaintenanceLock(lockPath);
    await reclaimed.release();

    await writeFile(lockPath, "{}", { flag: "wx" });
    await assert.rejects(
      () => acquirePortableRestoreMaintenanceLock(lockPath),
      (error) => error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
    );
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
