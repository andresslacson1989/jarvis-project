import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { open, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import {
  BACKUP_CHUNK_SIZE_BYTES,
  BACKUP_FORMAT_ID,
  BACKUP_FORMAT_VERSION,
  digestBackupDescriptor,
  parseBackupDescriptor,
  validateBackupDescriptor,
  canonicalizeBackupDescriptor,
} from "./backup-descriptor.js";
import {
  digestBackupPayloadManifest,
  parseBackupPayloadManifest,
} from "./backup-manifest.js";
import { decryptBackupChunks, encryptBackupChunks } from "./backup-chunks.js";
import { createGeneratedRecoverySlot, unwrapGeneratedRecoverySlot } from "./backup-recovery.js";
import { parseAuthenticatedBackupPayload } from "./backup-payload.js";
import { buildAuthenticatedBackupPayload } from "./backup-payload.js";
import { openCoreDatabase, openSqlcipherSnapshot, restoreSqlcipherSnapshot } from "./persistence.js";
import { applyCoreMigrations, CoreStateRepository } from "./schema.js";
import type { SessionPasswordVerifier } from "./schema.js";
import type { BackupPackageDescriptorV1 } from "./backup-descriptor.js";
import type { BackupPayloadManifestV1 } from "./backup-manifest.js";
import type { BackupChunkRecordV1 } from "./backup-chunks.js";
import type { GeneratedRecoverySlotV1 } from "./backup-recovery.js";

export type BackupPackageVerificationFailureCode =
  | "BACKUP_PACKAGE_DESCRIPTOR_INVALID"
  | "BACKUP_PACKAGE_MANIFEST_INVALID"
  | "BACKUP_PACKAGE_BINDING_INVALID"
  | "BACKUP_PACKAGE_SLOT_INVALID"
  | "BACKUP_PACKAGE_AUTHENTICATION_FAILED"
  | "BACKUP_PACKAGE_MAINTENANCE_LOCKED"
  | "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID"
  | "BACKUP_PACKAGE_DB_DEK_PROTECTION_FAILED"
  | "BACKUP_PACKAGE_RECOVERY_MARKER_INVALID";

export class BackupPackageVerificationError extends Error {
  readonly code: BackupPackageVerificationFailureCode;

  constructor(code: BackupPackageVerificationFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BackupPackageVerificationError";
    this.code = code;
  }
}

export interface VerifyBackupPackagePrimitivesInputV1 {
  readonly descriptor: Buffer | string;
  /** The canonical manifest bytes extracted from the authenticated payload. */
  readonly payloadManifest: Buffer | string;
  readonly chunks: readonly BackupChunkRecordV1[];
  readonly generatedRecoverySlot: GeneratedRecoverySlotV1;
  readonly recoverySecret: Buffer;
  readonly noncePrefix: Buffer;
}

export interface VerifiedBackupPackagePrimitivesV1 {
  readonly descriptor: BackupPackageDescriptorV1;
  readonly manifest: BackupPayloadManifestV1;
  readonly descriptorDigest: Buffer;
  readonly plaintext: Buffer;
}

export interface VerifyAuthenticatedBackupPackageInputV1 {
  readonly descriptor: Buffer | string;
  readonly chunks: readonly BackupChunkRecordV1[];
  readonly generatedRecoverySlot: GeneratedRecoverySlotV1;
  readonly recoverySecret: Buffer;
  readonly noncePrefix: Buffer;
}

export interface CreateAuthenticatedBackupPackageInputV1 {
  readonly backupId: string;
  readonly createdAt: string;
  readonly protectionClass: "LOCAL_RECOVERY" | "PORTABLE_STATE";
  readonly manifestBytes: Buffer;
  readonly snapshotDbKey: Buffer;
  readonly backupDek: Buffer;
  readonly recoverySecret: Buffer;
  readonly slotId: string;
  readonly objects: readonly { readonly path: string; readonly data: Buffer }[];
  readonly noncePrefix?: Buffer;
}

export interface CreatedAuthenticatedBackupPackageV1 {
  readonly descriptor: BackupPackageDescriptorV1;
  readonly descriptorBytes: Buffer;
  readonly descriptorDigest: Buffer;
  readonly noncePrefix: Buffer;
  readonly chunks: readonly BackupChunkRecordV1[];
  readonly generatedRecoverySlot: GeneratedRecoverySlotV1;
}

export interface VerifiedAuthenticatedBackupPackageV1 {
  readonly descriptor: BackupPackageDescriptorV1;
  readonly manifest: BackupPayloadManifestV1;
  readonly descriptorDigest: Buffer;
  readonly snapshotDbKey: Buffer;
  readonly objects: readonly { readonly path: string; readonly data: Buffer }[];
}

export interface RestoreVerifiedPortableBackupInputV1 extends VerifyAuthenticatedBackupPackageInputV1 {
  readonly destinationPath: string;
  /** The application-owned exclusive maintenance lock path. */
  readonly maintenanceLockPath: string;
  /** The application-owned marker that makes the next startup enter recovery mode. */
  readonly recoveryMarkerPath: string;
  /**
   * Typed platform boundary invoked before publication. The callback must
   * protect the fresh key through the current profile secure-storage broker;
   * it must not persist or log the plaintext key.
   */
  readonly protectNewDbDek: (dbDek: Buffer) => Promise<RestoreDbDekProtectionLease>;
  /** Fresh verifier established by the authenticated clean-profile restore password. */
  readonly sessionPasswordVerifier: SessionPasswordVerifier;
  readonly newDbDek: Buffer;
  readonly now: string;
}

export interface RestoreDbDekProtectionLease {
  readonly handle: string;
  commit(): Promise<void>;
  abort(): Promise<void>;
}

export interface RestoredPortableBackupV1 {
  readonly databasePath: string;
  readonly affectedIntegrationAccountIds: readonly string[];
}

export const PORTABLE_RESTORE_RECOVERY_MARKER = "JARVIS_RECOVERY_REQUIRED_V1\n" as const;

function validateRecoveryMarkerPath(markerPath: string): string {
  const path = resolve(markerPath);
  if (
    path.length === 0 ||
    !markerPath ||
    !isAbsolute(markerPath) ||
    /^(?:[\\/]{2}|\\\\[?.])/u.test(markerPath) ||
    !existsSync(dirname(path))
  ) {
    throw new BackupPackageVerificationError(
      "BACKUP_PACKAGE_RECOVERY_MARKER_INVALID",
      "recovery marker path must be an absolute local path with an existing parent",
    );
  }
  return path;
}

/**
 * Publish an app-owned recovery marker before the restored database becomes
 * authoritative. Existing valid markers are idempotent; malformed markers
 * fail closed rather than being silently replaced.
 */
export async function writePortableRestoreRecoveryMarker(markerPath: string): Promise<void> {
  const path = validateRecoveryMarkerPath(markerPath);
  try {
    const existing = await readFile(path);
    if (existing.equals(Buffer.from(PORTABLE_RESTORE_RECOVERY_MARKER, "utf8"))) return;
    throw new BackupPackageVerificationError(
      "BACKUP_PACKAGE_RECOVERY_MARKER_INVALID",
      "existing recovery marker is malformed",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      if (error instanceof BackupPackageVerificationError) throw error;
      throw new BackupPackageVerificationError(
        "BACKUP_PACKAGE_RECOVERY_MARKER_INVALID",
        "existing recovery marker could not be read",
        { cause: error },
      );
    }
  }

  const temporaryPath = `${path}.tmp-${randomUUID()}`;
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(PORTABLE_RESTORE_RECOVERY_MARKER, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, path);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true });
    throw new BackupPackageVerificationError(
      "BACKUP_PACKAGE_RECOVERY_MARKER_INVALID",
      "recovery marker could not be published",
      { cause: error },
    );
  }
}

const MAINTENANCE_LOCK_STALE_AFTER_MS = 15 * 60 * 1000;

interface MaintenanceLockRecord {
  readonly ownerPid: number;
  readonly ownerToken: string;
  readonly createdAt: number;
}

export interface PortableRestoreMaintenanceLock {
  readonly path: string;
  readonly ownerToken: string;
  release(): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMaintenanceLockRecord(value: unknown): MaintenanceLockRecord {
  if (!isRecord(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["createdAt", "ownerPid", "ownerToken"])) {
    throw new BackupPackageVerificationError(
      "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
      "maintenance lock metadata is not exact",
    );
  }
  if (
    !Number.isSafeInteger(value.ownerPid) ||
    (value.ownerPid as number) < 1 ||
    typeof value.ownerToken !== "string" ||
    !/^[0-9a-f-]{36}$/u.test(value.ownerToken) ||
    !Number.isSafeInteger(value.createdAt) ||
    (value.createdAt as number) < 1
  ) {
    throw new BackupPackageVerificationError(
      "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
      "maintenance lock metadata is invalid",
    );
  }
  return {
    ownerPid: value.ownerPid as number,
    ownerToken: value.ownerToken,
    createdAt: value.createdAt as number,
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function readExistingMaintenanceLock(path: string): Promise<MaintenanceLockRecord> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    throw new BackupPackageVerificationError(
      "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
      "maintenance lock exists but cannot be read",
      { cause: error },
    );
  }
  try {
    return parseMaintenanceLockRecord(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof BackupPackageVerificationError) throw error;
    throw new BackupPackageVerificationError(
      "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
      "maintenance lock is not valid JSON",
      { cause: error },
    );
  }
}

/**
 * Acquire the application-owned maintenance lease before any restored state
 * can be published. A dead owner may be reclaimed only after its bounded
 * stale interval; malformed metadata fails closed.
 */
export async function acquirePortableRestoreMaintenanceLock(
  maintenanceLockPath: string,
): Promise<PortableRestoreMaintenanceLock> {
  const path = resolve(maintenanceLockPath);
  if (
    path.length === 0 ||
    !maintenanceLockPath ||
    !isAbsolute(maintenanceLockPath) ||
    /^(?:[\\/]{2}|\\\\[?.])/u.test(maintenanceLockPath) ||
    !existsSync(dirname(path))
  ) {
    throw new BackupPackageVerificationError(
      "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
      "maintenance lock path must be an absolute local path",
    );
  }
  const ownerToken = randomUUID();
  const record: MaintenanceLockRecord = {
    ownerPid: process.pid,
    ownerToken,
    createdAt: Date.now(),
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(path, "wx");
      try {
        await handle.writeFile(JSON.stringify(record));
        await handle.sync();
      } catch (error) {
        await handle.close();
        await unlink(path).catch(() => undefined);
        throw new BackupPackageVerificationError(
          "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
          "maintenance lock could not be initialized",
          { cause: error },
        );
      }
      await handle.close();
      return {
        path,
        ownerToken,
        async release(): Promise<void> {
          try {
            const current = parseMaintenanceLockRecord(JSON.parse(await readFile(path, "utf8")) as unknown);
            if (current.ownerToken === ownerToken && current.ownerPid === process.pid) {
              await unlink(path);
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt > 0) {
        if (error instanceof BackupPackageVerificationError) throw error;
        throw new BackupPackageVerificationError(
          "BACKUP_PACKAGE_MAINTENANCE_LOCK_INVALID",
          "maintenance lock could not be acquired",
          { cause: error },
        );
      }
      const existing = await readExistingMaintenanceLock(path);
      const stale =
        Date.now() - existing.createdAt > MAINTENANCE_LOCK_STALE_AFTER_MS &&
        !isProcessAlive(existing.ownerPid);
      if (!stale) {
        throw new BackupPackageVerificationError(
          "BACKUP_PACKAGE_MAINTENANCE_LOCKED",
          "another JARVIS maintenance or recovery operation is active",
        );
      }
      await unlink(path);
    }
  }
  throw new BackupPackageVerificationError(
    "BACKUP_PACKAGE_MAINTENANCE_LOCKED",
    "another JARVIS maintenance or recovery operation is active",
  );
}

function fail(code: BackupPackageVerificationFailureCode, message: string, options?: ErrorOptions): never {
  throw new BackupPackageVerificationError(code, message, options);
}

export function verifyBackupPackagePrimitives(
  input: VerifyBackupPackagePrimitivesInputV1,
): VerifiedBackupPackagePrimitivesV1 {
  let descriptor: BackupPackageDescriptorV1;
  try {
    descriptor = parseBackupDescriptor(input.descriptor);
  } catch (error) {
    return fail("BACKUP_PACKAGE_DESCRIPTOR_INVALID", "backup descriptor validation failed", { cause: error });
  }
  const descriptorDigest = digestBackupDescriptor(descriptor);
  let manifest: BackupPayloadManifestV1;
  try {
    manifest = parseBackupPayloadManifest(input.payloadManifest);
  } catch (error) {
    return fail("BACKUP_PACKAGE_MANIFEST_INVALID", "payload manifest validation failed", { cause: error });
  }
  if (
    manifest.backupId !== descriptor.backupId ||
    manifest.protectionClass !== descriptor.protectionClass ||
    digestBackupPayloadManifest(manifest).toString("base64url") !== descriptor.payloadManifestSha256
  ) {
    return fail("BACKUP_PACKAGE_BINDING_INVALID", "descriptor and payload manifest are not bound");
  }
  let backupDek: Buffer;
  try {
    backupDek = unwrapGeneratedRecoverySlot(
      input.generatedRecoverySlot,
      input.recoverySecret,
      descriptorDigest,
      descriptor.backupId,
    );
  } catch (error) {
    return fail("BACKUP_PACKAGE_SLOT_INVALID", "generated recovery slot could not unwrap BackupDEK", { cause: error });
  }
  try {
    let plaintext: Buffer;
    try {
      plaintext = decryptBackupChunks(descriptor, input.chunks, backupDek, descriptorDigest, input.noncePrefix);
    } catch (error) {
      return fail("BACKUP_PACKAGE_AUTHENTICATION_FAILED", "encrypted payload authentication failed", { cause: error });
    }
    return Object.freeze({ descriptor, manifest, descriptorDigest, plaintext });
  } finally {
    backupDek.fill(0);
  }
}

export function verifyAuthenticatedBackupPackage(
  input: VerifyAuthenticatedBackupPackageInputV1,
): VerifiedAuthenticatedBackupPackageV1 {
  let descriptor: BackupPackageDescriptorV1;
  try {
    descriptor = parseBackupDescriptor(input.descriptor);
  } catch (error) {
    return fail("BACKUP_PACKAGE_DESCRIPTOR_INVALID", "backup descriptor validation failed", { cause: error });
  }
  const descriptorDigest = digestBackupDescriptor(descriptor);
  const descriptorNoncePrefix = Buffer.from(descriptor.noncePrefix, "base64url");
  if (!descriptorNoncePrefix.equals(input.noncePrefix)) {
    return fail("BACKUP_PACKAGE_BINDING_INVALID", "descriptor and supplied nonce prefix are not bound");
  }
  let backupDek: Buffer;
  try {
    backupDek = unwrapGeneratedRecoverySlot(
      input.generatedRecoverySlot,
      input.recoverySecret,
      descriptorDigest,
      descriptor.backupId,
    );
  } catch (error) {
    return fail("BACKUP_PACKAGE_SLOT_INVALID", "generated recovery slot could not unwrap BackupDEK", { cause: error });
  }
  try {
    let payload: Buffer;
    try {
      payload = decryptBackupChunks(
        descriptor,
        input.chunks,
        backupDek,
        descriptorDigest,
        input.noncePrefix,
      );
    } catch (error) {
      return fail("BACKUP_PACKAGE_AUTHENTICATION_FAILED", "encrypted payload authentication failed", { cause: error });
    }
    let parsed;
    try {
      parsed = parseAuthenticatedBackupPayload(payload, backupDek, descriptorDigest);
    } catch (error) {
      return fail("BACKUP_PACKAGE_AUTHENTICATION_FAILED", "authenticated payload validation failed", { cause: error });
    }
  if (
    parsed.manifest.backupId !== descriptor.backupId ||
    parsed.manifest.protectionClass !== descriptor.protectionClass ||
    parsed.manifest.protocolVersion !== 1 ||
    parsed.manifest.schemaVersion !== 1 ||
    digestBackupPayloadManifest(parsed.manifest).toString("base64url") !== descriptor.payloadManifestSha256
    ) {
      parsed.snapshotDbKey.fill(0);
      return fail("BACKUP_PACKAGE_BINDING_INVALID", "descriptor and authenticated payload are not bound");
    }
    return Object.freeze({
      descriptor,
      manifest: parsed.manifest,
      descriptorDigest,
      snapshotDbKey: parsed.snapshotDbKey,
      objects: parsed.objects,
    });
  } finally {
    backupDek.fill(0);
  }
}

export function verifySqlcipherSnapshotFile(snapshotPath: string, snapshotDbKey: Buffer): void {
  const snapshot = openSqlcipherSnapshot(snapshotPath, snapshotDbKey);
  try {
    snapshot.verifyIntegrity();
  } finally {
    snapshot.close();
  }
}

export async function restoreVerifiedPortableBackup(
  input: RestoreVerifiedPortableBackupInputV1,
): Promise<RestoredPortableBackupV1> {
  const verified = verifyAuthenticatedBackupPackage(input);
  let snapshotStagingPath: string | undefined;
  let databaseStagingPath: string | undefined;
  let maintenanceLock: PortableRestoreMaintenanceLock | undefined;
  let protectionLease: RestoreDbDekProtectionLease | undefined;
  let published = false;
  try {
    const snapshotManifestObject = verified.manifest.objects.find(({ logicalType }) => logicalType === "SQLCIPHER_SNAPSHOT");
    const snapshotObject = verified.objects.find(({ path }) => path === snapshotManifestObject?.path);
    if (!snapshotObject) return fail("BACKUP_PACKAGE_BINDING_INVALID", "authenticated package has no snapshot object");

    const destinationPath = resolve(input.destinationPath);
    if (existsSync(destinationPath)) {
      return fail("BACKUP_PACKAGE_BINDING_INVALID", "clean-profile restore destination already exists");
    }
    snapshotStagingPath = `${destinationPath}.restore-snapshot-${randomUUID()}`;
    databaseStagingPath = `${destinationPath}.restore-database-${randomUUID()}`;
    maintenanceLock = await acquirePortableRestoreMaintenanceLock(input.maintenanceLockPath);
    await writeFile(snapshotStagingPath, snapshotObject.data, { flag: "wx" });
    verifySqlcipherSnapshotFile(snapshotStagingPath, verified.snapshotDbKey);
    await restoreSqlcipherSnapshot(
      snapshotStagingPath,
      verified.snapshotDbKey,
      databaseStagingPath,
      input.newDbDek,
    );
    const protectionKey = Buffer.from(input.newDbDek);
    try {
      protectionLease = await input.protectNewDbDek(protectionKey);
      if (!protectionLease || protectionLease.handle.length === 0) {
        throw new Error("secure-storage protection did not return a staged handle");
      }
    } catch (error) {
      throw new BackupPackageVerificationError(
        "BACKUP_PACKAGE_DB_DEK_PROTECTION_FAILED",
        "the fresh DB_DEK was not accepted by the secure-storage boundary",
        { cause: error },
      );
    } finally {
      protectionKey.fill(0);
    }

    const restoredConnection = openCoreDatabase(databaseStagingPath, { dbDek: input.newDbDek });
    let reconciliation: { readonly affectedIntegrationAccountIds: readonly string[] };
    try {
      applyCoreMigrations(restoredConnection);
      reconciliation = new CoreStateRepository(restoredConnection).markPortableRestoreCredentialsReauthRequired(
        input.now,
        input.sessionPasswordVerifier,
      );
      const checkpoint = restoredConnection.checkpoint("TRUNCATE");
      if (!checkpoint.complete) return fail("BACKUP_PACKAGE_BINDING_INVALID", "restored database WAL checkpoint is incomplete");
    } finally {
      restoredConnection.close();
    }
    await rm(`${databaseStagingPath}-wal`, { force: true });
    await rm(`${databaseStagingPath}-shm`, { force: true });
    await writePortableRestoreRecoveryMarker(input.recoveryMarkerPath);
    if (existsSync(destinationPath)) return fail("BACKUP_PACKAGE_BINDING_INVALID", "restore destination changed during authentication");
    await rename(databaseStagingPath, destinationPath);
    published = true;
    await protectionLease.commit();
    return Object.freeze({
      databasePath: destinationPath,
      affectedIntegrationAccountIds: reconciliation.affectedIntegrationAccountIds,
    });
  } finally {
    verified.snapshotDbKey.fill(0);
    for (const object of verified.objects) object.data.fill(0);
    input.sessionPasswordVerifier.salt.fill(0);
    input.sessionPasswordVerifier.verifier.fill(0);
    try {
      await Promise.all([
        ...(snapshotStagingPath
          ? [
              rm(snapshotStagingPath, { force: true }),
              rm(`${snapshotStagingPath}-wal`, { force: true }),
              rm(`${snapshotStagingPath}-shm`, { force: true }),
            ]
          : []),
        ...(!published && databaseStagingPath
          ? [
              rm(databaseStagingPath, { force: true }),
              rm(`${databaseStagingPath}-wal`, { force: true }),
              rm(`${databaseStagingPath}-shm`, { force: true }),
            ]
          : []),
      ]);
    } finally {
      if (!published && protectionLease) {
        await protectionLease.abort().catch(() => undefined);
      }
      if (maintenanceLock) await maintenanceLock.release();
    }
  }
}

export function createAuthenticatedBackupPackage(
  input: CreateAuthenticatedBackupPackageInputV1,
): CreatedAuthenticatedBackupPackageV1 {
  let manifest: BackupPayloadManifestV1;
  try {
    manifest = parseBackupPayloadManifest(input.manifestBytes);
  } catch (error) {
    return fail("BACKUP_PACKAGE_MANIFEST_INVALID", "payload manifest validation failed", { cause: error });
  }
  if (manifest.backupId !== input.backupId || manifest.protectionClass !== input.protectionClass) {
    return fail("BACKUP_PACKAGE_BINDING_INVALID", "package input does not match the payload manifest");
  }
  const payloadManifestSha256 = digestBackupPayloadManifest(manifest).toString("base64url");
  const noncePrefix = input.noncePrefix === undefined ? Buffer.from(randomBytes(4)) : Buffer.from(input.noncePrefix);
  if (noncePrefix.length !== 4) return fail("BACKUP_PACKAGE_DESCRIPTOR_INVALID", "noncePrefix must be exactly 4 bytes");
  const placeholderPayload = buildAuthenticatedBackupPayload({
    manifestBytes: input.manifestBytes,
    descriptorDigest: Buffer.alloc(32),
    backupId: input.backupId,
    snapshotDbKey: input.snapshotDbKey,
    backupDek: input.backupDek,
    objects: input.objects,
  });
  const plaintextBytes = placeholderPayload.length;
  const chunkCount = plaintextBytes === 0 ? 0 : Math.ceil(plaintextBytes / BACKUP_CHUNK_SIZE_BYTES);
  const descriptor = validateBackupDescriptor({
    domain: "jarvis.backup.package.v1",
    formatId: BACKUP_FORMAT_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    backupId: input.backupId,
    createdAt: input.createdAt,
    protectionClass: input.protectionClass,
    outerAead: "AES_256_GCM",
    chunkSizeBytes: BACKUP_CHUNK_SIZE_BYTES,
    chunkCount: chunkCount.toString(10),
    plaintextBytes: plaintextBytes.toString(10),
    noncePrefix: noncePrefix.toString("base64url"),
    payloadManifestSha256,
    keySlotCount: 1,
  });
  const descriptorDigest = digestBackupDescriptor(descriptor);
  const payload = buildAuthenticatedBackupPayload({
    manifestBytes: input.manifestBytes,
    descriptorDigest,
    backupId: input.backupId,
    snapshotDbKey: input.snapshotDbKey,
    backupDek: input.backupDek,
    objects: input.objects,
  });
  if (payload.length !== plaintextBytes) return fail("BACKUP_PACKAGE_BINDING_INVALID", "payload length changed after descriptor binding");
  const encrypted = encryptBackupChunks(descriptor, payload, input.backupDek, descriptorDigest, noncePrefix);
  const generatedRecoverySlot = createGeneratedRecoverySlot({
    backupId: input.backupId,
    descriptorDigest,
    slotId: input.slotId,
    recoverySecret: input.recoverySecret,
    backupDek: input.backupDek,
  });
  placeholderPayload.fill(0);
  payload.fill(0);
  return Object.freeze({
    descriptor,
    descriptorBytes: canonicalizeBackupDescriptor(descriptor),
    descriptorDigest,
    noncePrefix,
    chunks: encrypted.chunks,
    generatedRecoverySlot,
  });
}
