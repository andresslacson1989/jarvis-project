import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { canonicalizeJcs } from "./backup-descriptor.js";

export const GENERATED_RECOVERY_PREFIX = "JRV1-" as const;
export const GENERATED_RECOVERY_BYTES = 32 as const;
export const GENERATED_RECOVERY_SLOT_DOMAIN = "jarvis.backup.keyslot.v1" as const;
export const GENERATED_RECOVERY_SLOT_TYPE = "GENERATED_RECOVERY_V1" as const;
export const GENERATED_RECOVERY_WRAP_AEAD = "AES_256_GCM" as const;
export const GENERATED_RECOVERY_NONCE_BYTES = 12 as const;
export const GENERATED_RECOVERY_TAG_BYTES = 16 as const;
const GENERATED_RECOVERY_INFO_PREFIX = "jarvis.backup.generated-recovery.v1/";

export interface GeneratedRecoverySlotV1 {
  readonly domain: typeof GENERATED_RECOVERY_SLOT_DOMAIN;
  readonly backupId: string;
  readonly descriptorSha256: string;
  readonly slotId: string;
  readonly slotType: typeof GENERATED_RECOVERY_SLOT_TYPE;
  readonly wrapAead: typeof GENERATED_RECOVERY_WRAP_AEAD;
  readonly nonce: string;
  readonly wrappedBackupDek: string;
  readonly tag: string;
}

export type GeneratedRecoveryFailureCode =
  | "GENERATED_RECOVERY_INPUT_INVALID"
  | "GENERATED_RECOVERY_SECRET_INVALID"
  | "GENERATED_RECOVERY_METADATA_INVALID"
  | "GENERATED_RECOVERY_AUTHENTICATION_FAILED";

export class GeneratedRecoveryError extends Error {
  readonly code: GeneratedRecoveryFailureCode;

  constructor(code: GeneratedRecoveryFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GeneratedRecoveryError";
    this.code = code;
  }
}

function fail(code: GeneratedRecoveryFailureCode, message: string, options?: ErrorOptions): never {
  throw new GeneratedRecoveryError(code, message, options);
}

function requireSecret(secret: unknown): Buffer {
  if (!Buffer.isBuffer(secret) || secret.length !== GENERATED_RECOVERY_BYTES) {
    return fail("GENERATED_RECOVERY_SECRET_INVALID", "generated recovery secret must be exactly 256 bits");
  }
  return secret;
}

function requireDigest(digest: unknown): Buffer {
  if (!Buffer.isBuffer(digest) || digest.length !== 32) {
    return fail("GENERATED_RECOVERY_INPUT_INVALID", "descriptor digest must be exactly 256 bits");
  }
  return Buffer.from(digest);
}

function requireBackupDek(backupDek: unknown): Buffer {
  if (!Buffer.isBuffer(backupDek) || backupDek.length !== 32) {
    return fail("GENERATED_RECOVERY_INPUT_INVALID", "BackupDEK must be exactly 256 bits");
  }
  return backupDek;
}

function requireSlotId(slotId: unknown): string {
  if (typeof slotId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(slotId)) {
    return fail("GENERATED_RECOVERY_METADATA_INVALID", "slotId is invalid or exceeds its bound");
  }
  return slotId;
}

function requireBackupId(backupId: unknown): string {
  if (
    typeof backupId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(backupId)
  ) {
    return fail("GENERATED_RECOVERY_METADATA_INVALID", "backupId must be UUIDv7");
  }
  return backupId;
}

function requireBase64Url(value: unknown, field: string, bytes: number): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) {
    return fail("GENERATED_RECOVERY_METADATA_INVALID", `${field} must be unpadded base64url`);
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== bytes || decoded.toString("base64url") !== value) {
    return fail("GENERATED_RECOVERY_METADATA_INVALID", `${field} must encode exactly ${bytes} bytes`);
  }
  return decoded;
}

function slotAad(slot: Pick<GeneratedRecoverySlotV1, "backupId" | "descriptorSha256" | "slotId">): Buffer {
  return canonicalizeJcs({
    domain: GENERATED_RECOVERY_SLOT_DOMAIN,
    backupId: slot.backupId,
    descriptorSha256: slot.descriptorSha256,
    slotId: slot.slotId,
    slotType: GENERATED_RECOVERY_SLOT_TYPE,
    wrapAead: GENERATED_RECOVERY_WRAP_AEAD,
  });
}

function slotKek(secret: Buffer, descriptorDigest: Buffer, slotId: string): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      secret,
      descriptorDigest,
      Buffer.from(`${GENERATED_RECOVERY_INFO_PREFIX}${slotId}`, "utf8"),
      32,
    ),
  );
}

function normalizeSlot(slot: unknown): GeneratedRecoverySlotV1 {
  if (typeof slot !== "object" || slot === null || Array.isArray(slot)) {
    return fail("GENERATED_RECOVERY_METADATA_INVALID", "generated recovery slot must be an object");
  }
  const record = slot as Record<string, unknown>;
  const expected = ["backupId", "descriptorSha256", "domain", "nonce", "slotId", "slotType", "tag", "wrapAead", "wrappedBackupDek"];
  const actual = Object.keys(record).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== [...expected].sort()[index])) {
    return fail("GENERATED_RECOVERY_METADATA_INVALID", "generated recovery slot fields are not exact");
  }
  const normalized = Object.freeze({
    domain: record.domain === GENERATED_RECOVERY_SLOT_DOMAIN ? GENERATED_RECOVERY_SLOT_DOMAIN : fail("GENERATED_RECOVERY_METADATA_INVALID", "slot domain is invalid"),
    backupId: requireBackupId(record.backupId),
    descriptorSha256: typeof record.descriptorSha256 === "string" ? record.descriptorSha256 : fail("GENERATED_RECOVERY_METADATA_INVALID", "descriptorSha256 is invalid"),
    slotId: requireSlotId(record.slotId),
    slotType: record.slotType === GENERATED_RECOVERY_SLOT_TYPE ? GENERATED_RECOVERY_SLOT_TYPE : fail("GENERATED_RECOVERY_METADATA_INVALID", "slot type is invalid"),
    wrapAead: record.wrapAead === GENERATED_RECOVERY_WRAP_AEAD ? GENERATED_RECOVERY_WRAP_AEAD : fail("GENERATED_RECOVERY_METADATA_INVALID", "wrap AEAD is invalid"),
    nonce: typeof record.nonce === "string" ? record.nonce : fail("GENERATED_RECOVERY_METADATA_INVALID", "nonce is invalid"),
    wrappedBackupDek: typeof record.wrappedBackupDek === "string" ? record.wrappedBackupDek : fail("GENERATED_RECOVERY_METADATA_INVALID", "wrapped BackupDEK is invalid"),
    tag: typeof record.tag === "string" ? record.tag : fail("GENERATED_RECOVERY_METADATA_INVALID", "tag is invalid"),
  }) satisfies GeneratedRecoverySlotV1;
  return normalized;
}

export function createGeneratedRecoverySecret(): Buffer {
  return randomBytes(GENERATED_RECOVERY_BYTES);
}

export function formatGeneratedRecoverySecret(secretInput: Buffer): string {
  const secret = requireSecret(secretInput);
  return `${GENERATED_RECOVERY_PREFIX}${secret.toString("base64url")}`;
}

export function parseGeneratedRecoverySecret(value: unknown): Buffer {
  if (typeof value !== "string" || !value.startsWith(GENERATED_RECOVERY_PREFIX)) {
    return fail("GENERATED_RECOVERY_SECRET_INVALID", "generated recovery secret has an invalid prefix");
  }
  const encoded = value.slice(GENERATED_RECOVERY_PREFIX.length);
  try {
    return requireBase64Url(encoded, "recovery secret", GENERATED_RECOVERY_BYTES);
  } catch (error) {
    return fail("GENERATED_RECOVERY_SECRET_INVALID", "generated recovery secret encoding is invalid", { cause: error });
  }
}

export function destroyGeneratedRecoverySecret(secretInput: Buffer): void {
  requireSecret(secretInput).fill(0);
}

export function createGeneratedRecoverySlot(input: {
  readonly backupId: string;
  readonly descriptorDigest: Buffer;
  readonly slotId: string;
  readonly recoverySecret: Buffer;
  readonly backupDek: Buffer;
  readonly nonce?: Buffer;
}): GeneratedRecoverySlotV1 {
  const backupId = requireBackupId(input.backupId);
  const descriptorDigest = requireDigest(input.descriptorDigest);
  const slotId = requireSlotId(input.slotId);
  const secret = requireSecret(input.recoverySecret);
  const backupDek = requireBackupDek(input.backupDek);
  const nonce = input.nonce === undefined ? randomBytes(GENERATED_RECOVERY_NONCE_BYTES) : input.nonce;
  if (!Buffer.isBuffer(nonce) || nonce.length !== GENERATED_RECOVERY_NONCE_BYTES) {
    return fail("GENERATED_RECOVERY_INPUT_INVALID", "recovery slot nonce must be exactly 96 bits");
  }
  const descriptorSha256 = descriptorDigest.toString("base64url");
  const metadata = { backupId, descriptorSha256, slotId };
  const kek = slotKek(secret, descriptorDigest, slotId);
  try {
    const cipher = createCipheriv("aes-256-gcm", kek, nonce);
    cipher.setAAD(slotAad(metadata));
    const wrappedBackupDek = Buffer.concat([cipher.update(backupDek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Object.freeze({
      domain: GENERATED_RECOVERY_SLOT_DOMAIN,
      backupId,
      descriptorSha256,
      slotId,
      slotType: GENERATED_RECOVERY_SLOT_TYPE,
      wrapAead: GENERATED_RECOVERY_WRAP_AEAD,
      nonce: nonce.toString("base64url"),
      wrappedBackupDek: wrappedBackupDek.toString("base64url"),
      tag: tag.toString("base64url"),
    });
  } finally {
    kek.fill(0);
  }
}

export function unwrapGeneratedRecoverySlot(
  slotInput: GeneratedRecoverySlotV1,
  recoverySecretInput: Buffer,
  descriptorDigestInput: Buffer,
  expectedBackupId: string,
): Buffer {
  const slot = normalizeSlot(slotInput);
  const descriptorDigest = requireDigest(descriptorDigestInput);
  const recoverySecret = requireSecret(recoverySecretInput);
  const backupId = requireBackupId(expectedBackupId);
  if (slot.backupId !== backupId || slot.descriptorSha256 !== descriptorDigest.toString("base64url")) {
    return fail("GENERATED_RECOVERY_METADATA_INVALID", "slot is bound to a different backup or descriptor");
  }
  const nonce = requireBase64Url(slot.nonce, "nonce", GENERATED_RECOVERY_NONCE_BYTES);
  const wrappedBackupDek = requireBase64Url(slot.wrappedBackupDek, "wrappedBackupDek", 32);
  const tag = requireBase64Url(slot.tag, "tag", GENERATED_RECOVERY_TAG_BYTES);
  const kek = slotKek(recoverySecret, descriptorDigest, slot.slotId);
  try {
    const decipher = createDecipheriv("aes-256-gcm", kek, nonce);
    decipher.setAAD(slotAad(slot));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(wrappedBackupDek), decipher.final()]);
  } catch (error) {
    return fail("GENERATED_RECOVERY_AUTHENTICATION_FAILED", "generated recovery slot authentication failed", { cause: error });
  } finally {
    kek.fill(0);
  }
}
