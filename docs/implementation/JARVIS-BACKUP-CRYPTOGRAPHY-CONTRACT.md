# JARVIS Backup Cryptography & Portable Recovery Format Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.5.md`  
**Version:** 1.0.5  
**Date:** August 12, 2026  
**Adopted by:** ADR-073

---

# 1. PURPOSE

This contract freezes the cryptographic and structural rules for the first production JARVIS portable-backup format. It removes algorithm/nonce/chunk/key-slot ambiguity while preserving the existing `DB_DEK` → `SnapshotDBKey` → `BackupDEK` separation.

The implementation SHALL use reviewed cryptographic libraries. JARVIS SHALL NOT implement AES, GCM, HKDF, Argon2id, SHA-256, DPAPI, or random-number generation itself.

The governing rule is:

> **A portable backup is an offline security boundary. Its format, key hierarchy, recovery strength, ordering, truncation resistance, and restore semantics are versioned protocol—not implementation preference.**

---

# 2. FORMAT IDENTITY

The first production format is:

```text
formatId: JARVIS_BACKUP_V1
formatVersion: 1
outerAead: AES_256_GCM
chunkSizeBytes: 4194304
maxPlaintextBytes: 1099511627776
chunkTagBytes: 16
chunkNonceBytes: 12
hash: SHA_256
canonicalMetadata: RFC_8785_JCS
```

`4194304` bytes is exactly 4 MiB. `1099511627776` bytes is exactly 1 TiB.

A package exceeding the V1 bounds SHALL be rejected before unbounded allocation or encryption/decryption. A future format may raise these bounds only through a versioned contract change.

---

# 3. KEY HIERARCHY

Every backup SHALL use independent cryptographic material:

```text
live DB_DEK
  └─ protects the active local SQLCipher database only

fresh SnapshotDBKey (256 random bits per backup)
  └─ protects the backup SQLCipher snapshot

fresh BackupDEK (256 random bits per backup)
  └─ AES-256-GCM encrypts/authenticates the outer backup payload

recovery/local key slots
  └─ protect only BackupDEK
```

`DB_DEK`, `SnapshotDBKey`, `BackupDEK`, generated recovery secrets, and passphrase-derived KEKs SHALL NOT be reused as one another.

`SnapshotDBKey` SHALL exist only inside the authenticated encrypted outer payload and transient trusted restore memory. It SHALL NOT appear in the cleartext package descriptor, a sidecar, logs, diagnostics, or ordinary manifests.

`BackupDEK` SHALL be generated from the qualified OS CSPRNG for every backup. BackupDEK reuse across backup IDs is prohibited.

---

# 4. SQLCIPHER SNAPSHOT REQUIREMENT

The database snapshot SHALL be produced through a release-qualified SQLite/SQLCipher-safe mechanism that proves a transactionally consistent encrypted snapshot and re-keys/exports it under the fresh `SnapshotDBKey`.

JARVIS SHALL NOT assume that a generic SQLite backup API has identical behavior for every SQLCipher version/binding. Phase 3 qualification SHALL prove the exact selected binding/version and snapshot/re-key/export path on the packaged application.

The release manifest SHALL record the exact SQLCipher/SQLite/binding identities and the tested snapshot mechanism.

---

# 5. PACKAGE DESCRIPTOR

The package begins with bounded cleartext metadata sufficient to parse and authenticate the package without exposing secret content.

Canonical semantic fields are equivalent to:

```ts
interface BackupPackageDescriptorV1 {
  domain: 'jarvis.backup.package.v1';
  formatId: 'JARVIS_BACKUP_V1';
  formatVersion: 1;
  backupId: string;                 // UUIDv7
  createdAt: string;                // UTC ISO-8601
  protectionClass: 'LOCAL_RECOVERY' | 'PORTABLE_STATE';
  outerAead: 'AES_256_GCM';
  chunkSizeBytes: 4194304;
  chunkCount: string;               // canonical uint64 decimal text
  plaintextBytes: string;           // canonical uint64 decimal text
  noncePrefix: string;              // base64url-no-pad, exactly 4 random bytes
  payloadManifestSha256: string;    // base64url-no-pad, 32 bytes
  keySlotCount: number;
}
```

The descriptor SHALL be RFC 8785 JCS canonicalized and hashed with SHA-256:

```text
descriptorDigest = SHA-256(UTF-8(JCS(descriptor)))
```

The descriptor and all parser-controlled metadata are bounded. V1 SHALL allow at most 16 key slots and a total unencrypted descriptor/key-slot metadata area of 256 KiB.

---

# 6. CHUNK ENCRYPTION

The outer payload SHALL be divided into 4 MiB plaintext chunks, except the final chunk which may be shorter.

For each backup, generate exactly one random 32-bit `noncePrefix`. The AES-GCM nonce for chunk `i` is:

```text
nonce = noncePrefix[4 bytes] || uint64_be(i)[8 bytes]
```

Chunk indices start at zero and SHALL be contiguous. Because each backup has a fresh BackupDEK and each chunk index is unique within that key, no two chunks under one BackupDEK may use the same nonce.

Every chunk SHALL use a 128-bit GCM authentication tag.

AAD is the RFC 8785 JCS encoding of:

```ts
interface BackupChunkAadV1 {
  domain: 'jarvis.backup.chunk.v1';
  backupId: string;
  descriptorSha256: string;
  chunkIndex: string;
  chunkCount: string;
  plaintextLength: number;
}
```

`descriptorSha256` is base64url-no-pad of `descriptorDigest`.

Decryption SHALL reject:

- duplicate, missing, out-of-order, or non-contiguous chunk indices;
- chunk count different from the descriptor;
- total plaintext length different from the descriptor;
- per-chunk length inconsistent with the fixed/final chunk rules;
- any GCM authentication failure;
- any trailing or unknown record after the declared package end;
- payload manifest hash different from `payloadManifestSha256`.

These checks make reordering, deletion, duplication, truncation, and unauthenticated extension detectable.

---

# 7. GENERATED PORTABLE RECOVERY SECRET

Every production `PORTABLE_STATE` backup SHALL contain at least one `GENERATED_RECOVERY_V1` key slot backed by a JARVIS-generated 256-bit recovery secret from the OS CSPRNG.

This generated recovery secret is the production portability anchor. A user-selected passphrase MAY be added as an additional convenience slot but SHALL NOT be the sole key slot used to label a backup `PORTABLE_STATE VERIFIED`.

The canonical generated secret representation is:

```text
JRV1-<base64url-no-pad of exactly 32 random bytes>
```

The prefix is presentation/version metadata and is not part of the 32-byte secret. JARVIS SHALL support copy/paste and SHOULD support QR/print presentation to reduce transcription errors.

The generated recovery secret SHALL be shown only through an explicit recovery-setup/export flow. It SHALL NOT be written to normal logs, SQLite domain rows, AI context, ordinary diagnostic exports, or ordinary backup plaintext metadata.

JARVIS MAY offer an explicitly labeled local convenience copy protected by PlatformSecureStorage, but possession of such a local copy does not count as proof that the user has preserved an independent disaster-recovery factor.

---

# 8. GENERATED-RECOVERY KEY SLOT

For a `GENERATED_RECOVERY_V1` slot:

1. parse the exact 32-byte recovery secret;
2. derive a 32-byte slot KEK using HKDF-SHA-256:

```text
IKM  = recoverySecret
salt = descriptorDigest
info = UTF-8("jarvis.backup.generated-recovery.v1/" + slotId)
L    = 32
```

3. generate a fresh random 96-bit AES-GCM wrap nonce;
4. AES-256-GCM encrypt `BackupDEK` with the slot KEK and a 128-bit tag.

The slot AAD is RFC 8785 JCS over an object equivalent to:

```ts
{
  domain: 'jarvis.backup.keyslot.v1',
  backupId,
  descriptorSha256,
  slotId,
  slotType: 'GENERATED_RECOVERY_V1',
  wrapAead: 'AES_256_GCM'
}
```

A slot record stores only the slot ID/type, wrap algorithm, wrap nonce, wrapped BackupDEK, authentication tag, and non-secret metadata needed to reproduce the AAD/derivation.

---

# 9. OPTIONAL PASSPHRASE KEY SLOT

A `PASSPHRASE_ARGON2ID_V1` slot MAY be added in addition to the generated-recovery slot.

The passphrase path SHALL:

- accept Unicode and normalize to NFC before UTF-8 encoding;
- accept paste/password-manager input;
- not truncate;
- accept at least 128 Unicode code points;
- require at least 20 Unicode code points for a production portable-backup passphrase;
- reject known common/compromised/context-specific values using a maintained blocklist;
- impose no character-class composition rules;
- use a fresh random salt of at least 16 bytes per slot.

The production portable-passphrase KDF SHALL use Argon2id version `0x13` with at least:

```text
memoryKiB  >= 262144
iterations >= 3
parallelism = 4
outputBytes >= 32
```

The exact KDF profile is recorded in the slot. The implementation SHALL enforce bounded maximum KDF parameters before allocating memory.

The derived 32-byte value is the slot KEK. `BackupDEK` is wrapped with AES-256-GCM using a fresh random 96-bit nonce, a 128-bit tag, and AAD binding `backupId`, `descriptorSha256`, `slotId`, `slotType`, and the exact KDF-profile identity/parameters.

Wrong passphrase fails authentication without modifying the source backup.

---

# 10. WINDOWS LOCAL-RECOVERY SLOT

`LOCAL_RECOVERY` on Windows V1 SHALL support a current-user Windows PlatformSecureStorage/DPAPI-backed slot for `BackupDEK`.

The local slot SHALL bind to the backup/descriptor identity using the qualified Windows backend's authenticated/additional-entropy facility where the selected implementation safely supports it.

A DPAPI-only package SHALL NOT be labeled portable.

---

# 11. ENCRYPTED PAYLOAD CONTENT

The authenticated encrypted payload SHALL contain at least:

- the SQLCipher snapshot encrypted under `SnapshotDBKey`;
- `SnapshotDBKey` as secret internal restore material;
- a bounded authenticated payload manifest;
- required non-secret validated configuration/registry state;
- required JARVIS-managed durable artifacts selected by backup policy;
- schema/migration/update/recovery compatibility metadata.

Raw long-lived integration/provider credentials remain excluded from ordinary backups.

The payload manifest SHALL identify every included object by logical type, bounded path/reference, size, and SHA-256 digest as applicable. The descriptor's `payloadManifestSha256` binds the decrypted manifest.

---

# 12. RESTORE ORDER

Portable restore SHALL fail closed in this order:

```text
parse bounded descriptor/key-slot metadata
→ validate format/version/bounds
→ canonicalize + hash descriptor
→ obtain generated recovery secret or optional passphrase
→ authenticate/unwrap BackupDEK
→ authenticate/decrypt every chunk in strict order
→ validate total length and payload-manifest digest
→ recover SnapshotDBKey transiently
→ open/integrity-check SQLCipher snapshot
→ validate schema/release compatibility
→ preserve current state where required
→ restore under exclusive maintenance lock
→ generate fresh local DB_DEK
→ re-key restored DB
→ protect new DB_DEK with current PlatformSecureStorage
→ mark missing credentials REAUTH_REQUIRED
→ reconcile provider/approval/lease/external live state
```

No partial decrypted state becomes authoritative before the entire package and database integrity checks pass.

---

# 13. ROTATION AND RECOVERY-FACTOR LIFECYCLE

Creating a new generated recovery secret SHALL create new key slots for future backups. Historical backup packages are not silently rewritten.

JARVIS SHALL clearly identify which verified backups are recoverable by which recovery-factor generation without storing the factors themselves.

Removing/losing the only generated-recovery factor for a backup means that backup can no longer satisfy the production `PORTABLE_STATE VERIFIED` claim, even if an optional user passphrase slot remains usable.

Recovery-factor setup/rotation/export is security-sensitive and auditable without recording the secret.

---

# 14. REQUIRED TEST VECTORS AND QUALIFICATION

Production qualification SHALL include deterministic cross-language/golden fixtures for:

- RFC 8785 descriptor/AAD canonicalization;
- descriptor SHA-256;
- nonce construction;
- chunk 0, middle, and final chunk encryption/decryption;
- 128-bit GCM tag validation;
- generated-recovery HKDF derivation;
- passphrase Argon2id slot derivation;
- BackupDEK wrapping/unwrapping;
- wrong recovery secret/passphrase;
- modified descriptor;
- modified slot metadata;
- nonce/tag/ciphertext corruption;
- chunk reorder/delete/duplicate/truncate/append;
- malicious oversized counts/lengths/KDF parameters;
- clean-profile restore without historical DPAPI/DB_DEK;
- SQLCipher snapshot/re-key behavior on the exact selected production binding;
- no plaintext key material in package metadata/logs/diagnostics.

At least one full disaster-recovery drill SHALL use the exact signed Release Candidate artifacts and a separately preserved generated recovery secret.

---

# 15. CRYPTOGRAPHIC PROFILE CHANGE

Changing the V1 backup cipher suite, nonce construction, tag length, chunk framing/AAD, key-slot derivation/wrapping, generated recovery-secret size, or passphrase KDF floor is a backup-format/security contract change and requires a new format version or explicitly proven backwards-compatible profile revision.

No implementation may substitute an "equivalent" construction under `JARVIS_BACKUP_V1` without a synchronous contract amendment.

---

# 16. STANDARDS BASIS

The production profile is grounded in reviewed standards including NIST SP 800-38D GCM requirements, RFC 5869 HKDF, RFC 9106 Argon2id, RFC 8785 JCS, SHA-256, and the platform-qualified Windows data-protection backend.

A standards update does not silently mutate an already-defined backup format. Future changes are versioned and migration-tested.

---

# 17. INVARIANTS

1. Every backup gets a fresh BackupDEK and SnapshotDBKey.
2. AES-GCM nonces never repeat under one BackupDEK.
3. Chunk order/count/length and payload manifest are authenticated.
4. Portable recovery does not require historical Windows DPAPI material.
5. A verified production portable backup always has a 256-bit generated-recovery slot.
6. A user passphrase is optional additional recovery, not the sole production portability anchor.
7. Secret keys/factors never appear in cleartext backup metadata/logs/AI context.
8. Restore authenticates the whole package and database before activation.
9. SQLCipher backup behavior is proven for the exact selected binding/version.
10. Backup-format crypto cannot vary by adapter preference.

---

**END — JARVIS BACKUP CRYPTOGRAPHY & PORTABLE RECOVERY FORMAT CONTRACT v1.0.5**
