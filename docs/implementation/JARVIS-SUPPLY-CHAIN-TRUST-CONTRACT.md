# JARVIS Supply-Chain, Update & Module Trust Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md`
**Version:** 1.0.6
**Date:** August 12, 2026  
**Adopted by:** ADR-075

---

# 1. PURPOSE

This contract defines the trust-root lifecycle for JARVIS application updates and the supported module catalog. It closes the gap between "artifact has a valid signature" and "artifact is currently authorized, non-revoked, non-rollback, and issued under a recoverable trust hierarchy."

JARVIS SHALL use The Update Framework (TUF) trust model rather than inventing an ad-hoc key-rotation/revocation protocol.

> **A valid historical signature is provenance, not perpetual authorization to install or activate.**

---

# 2. TUF PROFILE

The initial production trust-metadata profile SHALL implement TUF specification **1.0.35** semantics for:

```text
root
targets
snapshot
timestamp
consistent snapshots
target delegations
metadata version monotonicity
metadata expiration
root rotation
rollback/freeze/mix-and-match protection
```

Production metadata SHALL use canonical deterministic serialization supported by the selected audited TUF implementation.

`consistent_snapshot` SHALL be enabled.

Changing to a different TUF major/minor semantic profile requires a synchronous security/update contract review. A patch-level TUF library update does not change this contract when wire/trust semantics remain compatible and release qualification passes.

---

# 3. SIGNATURE ALGORITHM

The JARVIS TUF V1 role-key profile SHALL use:

```text
keytype: ed25519
scheme:  ed25519
```

Key IDs and role metadata follow TUF 1.0.35 rules.

JARVIS SHALL use a maintained reviewed TUF/Ed25519 implementation and SHALL NOT implement signature primitives itself.

---

# 4. ROOT TRUST

The production root role SHALL have at least three independently stored root keys and threshold **2-of-3**.

Root private keys SHALL be kept offline from ordinary application runtime, developer workstations used for normal coding, and general CI execution. At least two threshold-capable root-key copies SHALL be stored in separately protected locations/devices so one compromised/lost storage location does not immediately destroy the trust root.

Production clients ship with an authenticated initial trusted root metadata version.

A client SHALL NOT fetch an arbitrary network key and treat it as a new root merely because it signs itself.

---

# 5. ROLE KEY CUSTODY AND THRESHOLDS

Root metadata SHALL authorize distinct keys for:

```text
root
targets
snapshot
timestamp
```

The production JARVIS profile SHALL use at least:

```text
root:      2-of-3, offline
targets:   2-of-3, offline/release-signing only
snapshot:  1-of-1 or stronger, offline/release-signing only
timestamp: 1-of-1 or stronger, online automation permitted
modules delegated targets role: 2-of-3, offline/release-signing only
```

`offline/release-signing only` means the private key is not available to ordinary application runtime, update servers, developer workstations used for normal coding, or general-purpose CI jobs. A narrowly isolated release-signing environment or hardware-backed signing ceremony MAY use the key when producing authorized metadata and SHALL keep key custody separate from ordinary build/test automation.

The timestamp role is intentionally the minimally trusted routinely-online role. Its key MAY be available to narrowly scoped automated infrastructure because timestamp metadata cannot by itself authorize a new target file.

Targets and delegated module-target keys authorize installable content and therefore SHALL NOT be ordinary online service/runtime keys. Snapshot keys also SHALL remain offline in accordance with the TUF key-management model, even though snapshot metadata does not directly authorize target bytes.

Root role keys SHALL NOT be reused for targets, snapshot, timestamp, or module-delegation signing. Targets/module keys SHALL NOT be reused as the online timestamp key.

Production key custody, key IDs, thresholds, storage class, and rotation procedure are release/security-operational records.

---

# 6. MODULE CATALOG DELEGATION

Supported externally installable module/catalog targets SHALL be authorized through a dedicated TUF delegated targets role such as:

```text
modules
```

The delegation SHALL be path/target-scoped so module-catalog authority cannot sign arbitrary JARVIS application release targets.

The production `modules` delegated role SHALL use at least three independent Ed25519 keys with a **2-of-3** signature threshold and offline/release-signing custody as defined above.

A publisher/self-signature MAY provide additional provenance, but it does not make a module `SUPPORTED` without current TUF catalog authorization, manifest compatibility, integrity, permission review, and conformance.

Revoking the module delegation/key or removing a target from current trusted catalog metadata prevents new installation/activation under normal supported policy.

---

# 7. ROOT ROTATION AND REVOCATION

Root rotation SHALL follow TUF's sequential root-update chain.

For root version `N+1`:

- version SHALL be exactly `N+1`;
- the new root metadata SHALL meet the old root's signature threshold;
- the new root metadata SHALL also meet the new root's signature threshold;
- the client SHALL persist successfully verified root versions monotonically;
- skipped/intermediate root versions are not silently bypassed.

Compromised/replaced top-level role keys are revoked by trusted root metadata that removes/replaces them.

If fewer than the root threshold keys are compromised, normal threshold rotation/revocation is the supported recovery path.

If an attacker compromises a full root threshold, JARVIS SHALL NOT claim that ordinary in-band update metadata can securely self-recover. Recovery requires an out-of-band trusted recovery/reinstall procedure and incident response.

---

# 8. METADATA EXPIRATION / FREEZE RESISTANCE

Production metadata maximum validity periods are:

```text
timestamp: <= 7 days
snapshot:  <= 30 days
targets:   <= 90 days
root:      <= 365 days
```

A release may use shorter periods.

Expired required metadata is not trusted to authorize a new target/module activation.

The one narrow exception is the TUF root-update procedure: an already trusted root metadata version MAY be used, even if its expiration has passed, only to authenticate the strictly sequential `N+1` root chain. After attempting root update, the final trusted root's expiration SHALL be checked against the fixed update-start time before timestamp/snapshot/targets processing or target activation proceeds. If that final trusted root is expired, the update cycle aborts and reports a potential freeze/trust-expiry condition.

If update metadata is expired/unavailable, the installed application may continue operating according to its normal security policy, but JARVIS SHALL truthfully report update/catalog trust as stale/unavailable and SHALL NOT activate newly obtained targets under expired authorization.

The client persists last-trusted metadata versions and update observation state. A material system-clock rollback relative to already trusted update observations SHALL produce a diagnostic/trust-degraded state rather than silently treating obviously stale metadata as fresh.

---

# 9. TARGET INTEGRITY AND CONSISTENT SNAPSHOTS

Application/module targets SHALL be bound by trusted TUF metadata to at least:

- target path/identity;
- exact byte length;
- SHA-256 digest;
- release/module identity and version in signed custom metadata;
- applicable platform/runtime-role/architecture metadata;
- release/catalog sequence data required by JARVIS policy.

Downloads are bounded by trusted target length before unbounded storage/allocation.

A hash/length mismatch rejects the target regardless of transport TLS success.

---

# 10. JARVIS RELEASE ANTI-ROLLBACK POLICY

TUF metadata rollback protection is mandatory but not sufficient by itself to authorize an older application target.

Every production JARVIS application target SHALL carry signed metadata equivalent to:

```text
releaseId
jarvisVersion
releaseSequence       // monotonically increasing uint64
securityEpoch         // monotonically non-decreasing uint64
platform/runtime/arch
sourceCommitSha
artifactSha256
rollbackPolicy
```

The client persists the highest trusted `releaseSequence` and `securityEpoch` it has accepted.

Normal update SHALL reject an application target whose `releaseSequence` is lower than the highest trusted sequence.

A controlled rollback is allowed only when **current trusted targets metadata** explicitly authorizes that exact rollback target for the installed/current release and:

- the target is not revoked;
- its `securityEpoch` is not below the client's minimum allowed security epoch;
- the paired database/schema rollback state is available/verified;
- normal update/recovery policy authorizes activation.

Possession of an old validly signed installer alone is insufficient for in-app rollback authorization.

A security response may raise the minimum allowed `securityEpoch` or revoke specific release IDs/hashes, after which those targets SHALL NOT be reactivated through the normal updater.

---

# 11. MODULE ANTI-ROLLBACK / REVOCATION

Module catalog metadata SHALL identify immutable module version target hashes and catalog sequence/revocation state.

A previously valid module artifact SHALL NOT be newly installed/activated when the current trusted catalog metadata revokes its target hash/version or no longer authorizes it for the active JARVIS/platform profile.

Rollback to a retained module version requires that the exact target remains currently authorized by trusted catalog metadata and is compatible with the active release/security policy.

---

# 12. TAURI UPDATER AND WINDOWS SIGNING LAYERS

For Windows V1, private/internal application updates SHALL pass all applicable layers:

```text
TUF metadata authorization + hash/length/version/anti-rollback
AND
Tauri updater artifact-signature verification
AND
Windows private/internal code-signing / Authenticode policy
AND
JARVIS release-manifest / schema / rollback compatibility checks
```

Tauri's runtime updater public key, when rotation is required, SHALL be selected only from already trusted JARVIS/TUF-authorized metadata or an embedded trusted bootstrap. It SHALL NOT be accepted directly from an unauthenticated update-server response.

A valid Tauri/Authenticode signature does not override TUF revocation/rollback/security-epoch policy.

A valid TUF target does not bypass the platform's required artifact signing checks.

For the active `PRIVATE_INTERNAL` Release Profile, Windows Authenticode accepts a self-signed or private-CA certificate only when the exact certificate identity is recorded in the release manifest, the authorized target profile has explicitly enrolled that identity, and the release evidence does not claim public trust. Unsigned artifacts remain invalid. Public CA trust is required only for a future profile that explicitly enables public distribution.

---

# 13. STAGED ACTIVATION

Downloaded application/module targets remain staged/untrusted-for-execution until every required trust, compatibility, platform, migration, health, and policy gate passes.

Application activation SHALL preserve the existing paired binary/database backup/rollback semantics.

Module activation SHALL preserve immutable-version staging and retained rollback points.

No target is executed from an unverified temporary download path merely to run a health check.

---

# 14. TRUST METADATA STORAGE

The client SHALL durably retain the minimum trusted TUF state required to detect rollback/freeze/mix-and-match attempts, including current trusted root and the last accepted role metadata versions/hashes as required by the selected implementation.

Trusted update metadata is authoritative security state. It SHALL use crash-safe persistence and SHALL NOT be silently reset because cache cleanup occurred.

Deleting ordinary application cache SHALL NOT reset the trusted-root/version floor.

---

# 15. KEY INCIDENTS

A key-security incident SHALL support explicit states/reason codes equivalent to:

```text
UPDATE_TRUST_METADATA_EXPIRED
UPDATE_ROOT_ROTATION_REQUIRED
UPDATE_SIGNATURE_INVALID
UPDATE_TARGET_REVOKED
UPDATE_ROLLBACK_BLOCKED
UPDATE_SECURITY_EPOCH_BLOCKED
UPDATE_TRUST_ROOT_COMPROMISE_SUSPECTED
MODULE_TARGET_REVOKED
CATALOG_TRUST_UNAVAILABLE
```

Security-sensitive trust failures fail closed for new activation while preserving truthful diagnostics/recovery options.

---

# 16. RELEASE MANIFEST / PROVENANCE

Every production release SHALL record at least:

```text
tuf_spec_version
trusted_root_version
root_key_ids + threshold + custody class
targets_key_ids + threshold + custody class
snapshot_key_ids + threshold + custody class
timestamp_key_ids + threshold + custody class
module delegated-role identity/key ids + threshold + custody class
release_sequence
security_epoch
target metadata version/hash
Tauri updater signing key identity
Windows code-signing identity/timestamp metadata
Windows signing trust mode and target enrollment evidence
revocation/minimum-version policy reference
```

Private signing keys never appear in the release manifest.

---

# 17. REQUIRED QUALIFICATION

Production tests SHALL prove at minimum:

- bootstrap trusted root validation;
- 2-of-3 root threshold success/failure;
- top-level targets 2-of-3 threshold success/failure;
- delegated module-targets 2-of-3 threshold success/failure;
- root/targets/snapshot/module private keys are unavailable to ordinary runtime/update-server/general CI contexts;
- timestamp automation works without exposing higher-authority offline keys;
- root N→N+1 rotation with old+new thresholds;
- expired current root can participate only in the sequential root-update process and cannot authorize targets unless the resulting final trusted root is unexpired;
- attempted skipped/untrusted root rejection;
- revoked role key rejection;
- expired timestamp/snapshot/targets behavior;
- stale metadata/freeze detection;
- metadata rollback rejection;
- mix-and-match snapshot/targets rejection;
- target length/hash tamper rejection;
- target signed by unauthorized delegated role rejection;
- module delegation cannot authorize application target;
- application targets cannot be activated from module-only delegation;
- old validly signed but currently revoked JARVIS release rejected;
- unauthorized lower releaseSequence rejected;
- explicitly authorized rollback succeeds only with current trusted metadata and compatible paired state;
- securityEpoch downgrade rejected;
- current catalog revocation prevents module activation;
- Tauri signature failure blocks even when TUF metadata is valid;
- TUF failure blocks even when Tauri/Authenticode signature is valid;
- interrupted trust-metadata update does not corrupt the last trusted state;
- cache cleanup does not reset trusted-root/version floors.

---

# 18. STANDARDS BASIS

The trust lifecycle is based on The Update Framework specification 1.0.35. TUF's root, targets, snapshot, timestamp, threshold-signature, expiration, versioning, delegation, offline-key custody, and sequential root-update model is the normative update-metadata foundation for this JARVIS profile.

Tauri/Windows signing remains an additional artifact/platform integrity layer, not a replacement for TUF trust lifecycle semantics.

---

# 19. INVARIANTS

1. Root trust is threshold-based and recoverable from fewer-than-threshold key compromise.
2. Root, targets, snapshot, and install-authorizing module private keys are not ordinary online/CI/runtime keys; the timestamp key is the routinely-online minimally trusted role.
3. Application targets and supported executable-module targets require thresholded offline signing authority.
4. Role/key rotation and revocation are versioned authenticated state.
5. An expired already-trusted root may authenticate only the sequential root-update chain; final root freshness is required before normal update authorization continues.
6. Expired/stale metadata does not silently authorize new targets.
7. Old valid signatures do not bypass current revocation/anti-rollback policy.
8. Application and module trust authorities are scoped/delegated separately.
9. TUF, Tauri signature, and Windows code-signing gates are cumulative for Windows private/internal updates; the active private/internal mode does not claim public trust.
10. Trusted metadata survives ordinary cache cleanup and crashes.
11. A full root-threshold compromise is not falsely claimed to be safely recoverable in-band.
12. Update/module trust failures block activation and remain diagnostically explicit.

---

**END — JARVIS SUPPLY-CHAIN, UPDATE & MODULE TRUST CONTRACT v1.0.6**
