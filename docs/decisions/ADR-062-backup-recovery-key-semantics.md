# ADR-062 — Backup Recovery Key Semantics

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Security/recovery architecture hardening  
**Scope:** JARVIS v1.0 backup encryption, local rollback, and portable disaster recovery

## Context

The JARVIS data contract requires safe SQLite backups, encrypted-at-rest protection, verified restore, and explicit separation of ordinary state backups from credential export.

The existing security contract recommends a random SQLCipher-compatible database key protected through Windows secure storage and requires backups containing database content to remain protected consistently.

One important recovery boundary was not yet explicit: Windows DPAPI is normally tied to the protecting Windows user and machine. That makes it appropriate for seamless local recovery, but by itself it is not a portable disaster-recovery mechanism for a lost machine, lost Windows profile, or administrative password reset scenario.

JARVIS therefore needs two different backup semantics:

1. automatic local recovery/rollback backups that restore without repeatedly asking the user for a recovery secret; and
2. portable disaster-recovery backups that remain decryptable after machine/profile loss through a user-controlled recovery mechanism.

The same backup encryption key also should not be reused as the live database encryption key.

---

## Decision

JARVIS V1 SHALL use envelope encryption for protected backup packages.

Each backup package SHALL receive a fresh cryptographically random per-backup data-encryption key (`backup DEK`).

The backup DEK SHALL encrypt the backup payload using an authenticated-encryption scheme. The backup DEK SHALL then be protected by one or more explicit key slots according to the backup class.

JARVIS SHALL distinguish at least:

```ts
type BackupProtectionClass =
  | 'LOCAL_RECOVERY'
  | 'PORTABLE_STATE';
```

Credential-bearing export, if implemented, SHALL remain a separate explicit export class and workflow rather than being silently added to normal state backups.

---

## 1. Backup classes

### LOCAL_RECOVERY

`LOCAL_RECOVERY` is the normal class for automatic scheduled, pre-update, pre-migration, and local rollback backups.

It SHALL be optimized for safe unattended creation and seamless restore on the same Windows user/machine context.

Its backup DEK SHALL be protected using current-user Windows secure storage/DPAPI semantics through the Rust secure-storage boundary.

A local recovery backup SHALL NOT be presented as portable disaster recovery merely because the encrypted file can be copied elsewhere.

### PORTABLE_STATE

`PORTABLE_STATE` is a user-created or explicitly configured disaster-recovery backup intended to survive loss of the original machine or Windows profile.

It SHALL contain a portable key slot independent of the original Windows DPAPI identity.

Portable state backups SHALL continue to exclude raw long-lived integration credentials by default.

---

## 2. Per-backup encryption key

Every protected backup SHALL generate a fresh random 256-bit backup DEK using an operating-system cryptographically secure random source.

The backup DEK SHALL NOT be:

- the live SQLCipher/database key;
- the JARVIS session password;
- an API/integration credential;
- a long-lived global backup key shared across all backup files;
- deterministically derived from backup metadata.

Using a distinct backup DEK limits key reuse and allows independent protection/rotation of each backup package.

---

## 3. Payload authenticated encryption

The V1 backup format SHALL use a well-supported authenticated-encryption construction.

The preferred V1 implementation is AES-256-GCM or another equally reviewed AEAD approved by the implementation security review.

Large backup payloads SHOULD use a chunked authenticated format so backup/restore does not require holding the entire encrypted archive in memory.

If chunked AEAD is used:

- every chunk SHALL have a unique nonce under the backup DEK;
- chunk ordering and index SHALL be authenticated;
- truncation, insertion, deletion, duplication, and reordering SHALL be detectable;
- package/header identity SHALL be bound through authenticated associated data or an equivalent authenticated manifest design.

The implementation SHALL NOT invent an unauthenticated custom encryption format.

---

## 4. Local DPAPI key slot

A local recovery package SHALL contain a key slot equivalent to:

```ts
interface LocalDpapiKeySlot {
  type: 'WINDOWS_DPAPI_CURRENT_USER';
  wrappedDek: string;
}
```

The Rust secure-storage/native layer SHALL perform DPAPI protection/unprotection.

Current-user protection is preferred over machine-wide protection for normal single-user JARVIS installations.

JARVIS SHALL NOT use `CRYPTPROTECT_LOCAL_MACHINE` or an equivalent machine-wide decryption scope as the normal backup protection mode merely for convenience.

The UI/diagnostics SHALL make the limitation clear: a local-only DPAPI backup may become unrecoverable if the original Windows protection context is lost.

---

## 5. Portable passphrase key slot

Portable state backups SHALL support a passphrase-based key slot independent of Windows DPAPI.

The logical representation SHALL be equivalent to:

```ts
interface PortablePassphraseKeySlot {
  type: 'ARGON2ID_PASSPHRASE';

  kdf: {
    algorithm: 'ARGON2ID';
    version: number;
    salt: string;
    memoryKiB: number;
    iterations: number;
    parallelism: number;
  };

  wrapAlgorithm: string;
  nonce: string;
  wrappedDek: string;
}
```

The passphrase SHALL be converted to a key-encryption key using Argon2id with a fresh random salt and recorded parameters.

The derived key SHALL protect only the random backup DEK; it SHALL not directly encrypt the entire backup payload.

The passphrase itself SHALL NOT be stored.

---

## 6. Argon2id calibration

The V1 baseline SHOULD use Argon2id settings no weaker than approximately:

```text
memory:      64 MiB
iterations:  3
parallelism: implementation-calibrated
```

unless the implementation security review selects a stronger profile that remains practical on supported JARVIS hardware.

Parameters SHALL be versioned and stored per key slot so future JARVIS releases can raise the work factor without invalidating existing backups.

Creation/import SHOULD reject trivially weak recovery passphrases according to a documented policy.

The KDF SHALL be calibrated for interactive backup export/restore rather than for high-frequency authentication.

---

## 7. Optional multiple key slots

The envelope format MAY contain more than one key slot for the same backup DEK.

For example, a portable backup MAY contain both:

```text
WINDOWS_DPAPI_CURRENT_USER
+
ARGON2ID_PASSPHRASE
```

This allows seamless restore on the original machine while preserving cross-machine disaster recovery.

Adding or replacing a key slot SHOULD require re-wrapping the backup DEK rather than re-encrypting the entire backup payload when the package format permits it safely.

No key slot may silently weaken another key slot's security guarantee.

---

## 8. Portable recovery semantics

A backup SHALL be labeled portable only when JARVIS has verified that at least one non-DPAPI recovery path can unlock the backup DEK.

Copying a `LOCAL_RECOVERY` file to cloud storage, another disk, or another computer does not make it portable.

JARVIS SHALL distinguish in UI/diagnostics:

```text
LOCAL RECOVERY
  protected for this Windows user/machine context

PORTABLE DISASTER RECOVERY
  protected with a user-controlled portable recovery mechanism
```

This distinction SHALL be visible during export and restore selection.

---

## 9. Backup contents

The content policy from the Data & State Contract remains binding.

Normal automatic/local and portable-state backups MAY contain:

- the authoritative database;
- non-secret validated configuration;
- module/integration registry metadata;
- required durable JARVIS-managed artifacts;
- migration/update/recovery metadata.

They SHALL NOT contain raw long-lived integration credentials by default.

Restoring state without credentials SHALL mark affected integrations as disconnected or re-authentication-required rather than fabricating access.

---

## 10. Credential export remains separate

If portable credential export is implemented, it SHALL be a separate explicit security-sensitive workflow.

It SHALL require:

- an explicit user request;
- final confirmation appropriate to secret export;
- strong encryption independent of the local DPAPI-only path;
- clear enumeration of credential/account scope being exported;
- no automatic scheduled export;
- no inclusion in ordinary backups merely because a portable passphrase exists;
- audit evidence without logging the secret material.

A state backup and a credential export MAY be stored together only in a formally defined container format that preserves separate authorization and encryption semantics; this is not required for V1.

---

## 11. Backup manifest

The authenticated backup manifest SHALL contain metadata equivalent to:

```ts
interface BackupPackageManifest {
  backupFormatVersion: number;
  backupId: UUIDv7;
  protectionClass: BackupProtectionClass;

  createdAt: UtcTimestamp;
  reason: string;

  jarvisVersion: string;
  schemaVersion: number;

  payloadEncryption: {
    algorithm: string;
    chunkSize?: number;
  };

  keySlotTypes: string[];

  contents: {
    logicalType: string;
    size: string;
    sha256: string;
  }[];
}
```

Exact binary/container layout MAY be refined during implementation, but the semantics are binding.

Sensitive information unnecessary for restore SHALL not be placed in unauthenticated/plaintext package headers.

---

## 12. Integrity and usability verification

A backup SHALL NOT be marked `VERIFIED` merely because file creation completed.

Verification SHALL include, as applicable:

1. authenticated package structure validation;
2. successful unwrap of an applicable backup DEK during creation-time validation without persisting plaintext key material;
3. authenticated payload verification;
4. content hash/manifest verification;
5. SQLite backup integrity validation;
6. required-file presence validation;
7. schema/version metadata validation.

Portable backup creation SHALL verify the portable key slot before reporting disaster-recovery readiness.

---

## 13. Restore order

Restore SHALL follow a fail-closed sequence equivalent to:

```text
select backup
  ↓
parse bounded/versioned header
  ↓
select applicable key slot
  ↓
unlock backup DEK
  ↓
authenticate/decrypt package
  ↓
verify manifest/content hashes
  ↓
verify schema/application compatibility
  ↓
validate SQLite integrity
  ↓
preserve current state when possible
  ↓
restore under exclusive maintenance lock
  ↓
reconcile external/live state
```

JARVIS SHALL NOT partially activate unauthenticated backup contents.

---

## 14. Wrong or unavailable recovery key

If a portable passphrase is incorrect, JARVIS SHALL report a generic decryption/authentication failure appropriate to the UI and SHALL not reveal information useful for offline passphrase guessing beyond what the portable file format inherently exposes.

If only a local DPAPI key slot exists and Windows cannot decrypt it, JARVIS SHALL report the backup as unavailable in the current identity/machine context.

JARVIS SHALL NOT attempt to bypass Windows protection by weakening key handling.

---

## 15. Database-key rotation independence

Because backup packages use independent backup DEKs, rotation of the live database key SHALL NOT require rewriting every historical backup.

Similarly, restoring an older backup SHALL not require restoring the old live SQLCipher key as the new long-lived production key.

After restore, JARVIS MAY re-key the restored database into the current local database-key policy before returning to normal operation.

This reduces coupling between operational database encryption and backup retention.

---

## 16. Off-machine copies

JARVIS MAY support copying portable state backups to a user-selected local, removable, network, or future supported cloud destination.

The destination does not become trusted merely because the backup is encrypted.

Backup confidentiality and integrity SHALL be provided by the backup package itself for portable backups.

Destination credentials, if any, remain governed by the Credential Broker and integration permissions.

Off-machine backup transport is not required to include arbitrary cloud-vendor-specific functionality in the core backup format.

---

## 17. Recovery testing

Production release verification SHALL include at minimum:

1. automatic local backup creation and restore under the same Windows user/machine context;
2. local backup failure to unlock when its DPAPI context is intentionally unavailable;
3. portable backup restore on a clean Windows installation/new JARVIS profile using only the portable recovery passphrase;
4. wrong-passphrase rejection;
5. backup payload tampering detection;
6. manifest tampering detection;
7. truncated/chunk-reordered package rejection where chunking is used;
8. database integrity validation after restore;
9. application/schema compatibility rejection paths;
10. confirmation that ordinary backups contain no raw long-lived credentials;
11. restore behavior that marks integrations re-authentication-required when credentials are absent;
12. live database-key rotation without invalidating previously created portable backups;
13. migration/update rollback using a local backup without requiring the portable passphrase when the local DPAPI slot remains available;
14. portable key-slot verification before UI reports the backup as disaster-recovery capable.

---

## Non-goals

This ADR does not require:

- exporting raw credentials in routine backups;
- making every automatic backup portable;
- storing a portable recovery passphrase in Windows secure storage as the only copy;
- using the session password as the backup encryption key;
- reusing the SQLCipher database key as the backup DEK;
- weakening local protection to machine-wide DPAPI merely for portability;
- a mandatory cloud backup provider in V1.

---

## Consequences

### Positive

- local rollback remains automatic and user-friendly;
- true disaster-recovery backups survive original-machine/profile loss;
- compromise of one backup DEK does not expose every historical backup;
- database-key rotation is decoupled from historical backup retention;
- portable backup semantics are explicit rather than implied;
- credential export remains a separately authorized high-risk operation;
- authenticated encryption covers database plus backup metadata/artifacts, not only the SQLCipher file.

### Trade-offs

- the backup container requires a versioned encrypted-envelope format;
- portable backup creation requires the user to manage a recovery passphrase;
- losing the portable recovery secret means portable recovery is impossible unless another valid key slot exists;
- restore testing must cover both Windows-local and portable paths.

These trade-offs are appropriate because a backup that cannot survive the failure mode it claims to protect against is not a production disaster-recovery backup.

---

## Governing Principle

> **Local rollback may trust the local Windows identity; disaster recovery must not depend on the identity or machine that was lost.**
