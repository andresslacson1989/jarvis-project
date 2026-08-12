# ADR-073 — Contract v1.0.5 Security Closure and Release Sequencing

**Status:** Accepted  
**Date:** August 12, 2026  
**Decision scope:** backup cryptography/recovery strength, project-policy trust admission, update/module trust-root lifecycle, early voice feasibility sequencing, post-V1 integration release coupling, contract-drift reduction

---

## Context

The v1.0.4 architecture was independently reviewed after the Windows/Linux full-host portability amendment. The review confirmed that the core architecture remained sound but identified three security areas whose high-level designs were not sufficiently frozen for a production implementation contract:

1. the exact portable-backup cryptographic container and offline recovery-factor strength;
2. the deterministic trust transition by which repository policy-looking files such as `AGENTS.md` become trusted project policy;
3. application-update/module-catalog signing trust-root rotation, revocation, expiry, and anti-rollback semantics.

The same review identified two useful delivery improvements that do not change the product architecture: prove mandatory full-duplex voice feasibility much earlier, and remove the artificial requirement that SSH, Google Workspace, Microsoft 365, and Cloudflare all ship atomically in the first feature-bearing post-V1 release.

A final contract-maintainability concern is repeated constants/capability matrices across human documents. The current suite is consistent, but Phase 0 should establish machine-readable canonical values and CI drift checks instead of relying indefinitely on manual synchronization.

---

## Decision

### 1. Freeze `JARVIS_BACKUP_V1`

The suite adopts a dedicated Backup Cryptography & Portable Recovery Format Contract.

`JARVIS_BACKUP_V1` uses a fresh 256-bit BackupDEK per backup, AES-256-GCM outer encryption with 96-bit nonces and 128-bit tags, fixed 4 MiB chunks, authenticated chunk ordering/count/length, RFC 8785 canonical AAD/metadata, and an explicit bounded package profile.

A production `PORTABLE_STATE VERIFIED` backup requires at least one JARVIS-generated 256-bit recovery secret. A user-chosen passphrase may be an additional convenience key slot but is not the sole production portability anchor. Optional passphrase slots use a stronger Argon2id portable-backup profile.

The exact SQLCipher backup/re-key mechanism remains implementation-selected but must be proven against the exact packaged SQLCipher/SQLite binding; generic SQLite API behavior is never assumed.

### 2. Explicit project-policy enrollment

Repository text is untrusted by default. `AGENTS.md` is a policy candidate filename, not a magic trust marker.

A candidate becomes trusted only after an authenticated user explicitly enrolls an exact canonical project/path/scope/content identity. Trust is content-hash/revision bound. Content changes enter review-required state.

Trusted project policy constrains project work but cannot grant external authority, widen scopes, waive security/approval/DataPolicy, expose credentials, or authorize elevation.

Nested policy requires separate enrollment. Active attempts bind immutable policy snapshots. Mutating a trusted project policy is contextually HIGH and does not auto-trust the new contents.

### 3. TUF trust lifecycle for updates/modules

JARVIS adopts TUF specification 1.0.35 semantics for production update/catalog metadata, including root/targets/snapshot/timestamp roles, consistent snapshots, target delegations, version monotonicity, expiration, rotation, rollback/freeze/mix-and-match protection.

The production root uses Ed25519 with at least three root keys and a 2-of-3 threshold kept offline from ordinary CI/runtime.

Modules use a separately delegated catalog targets role. Windows application updates must satisfy TUF authorization as well as Tauri updater signature verification, Windows production code-signing policy, and JARVIS compatibility/rollback checks.

JARVIS adds signed monotonic `releaseSequence` and `securityEpoch` policy so an old but historically valid signature cannot by itself authorize downgrade/reactivation. Controlled rollback requires current trusted metadata, non-revoked target status, compatible security epoch, and paired recovery state.

### 4. Early voice feasibility spike

Voice remains mandatory V1 and full implementation remains in its later phases, but the Implementation Plan adds an early feasibility gate immediately after the Phase-3 persistence/recovery proof.

The spike must exercise candidate local STT, VAD, TTS, AEC, barge-in/double-talk, interruption latency, device behavior, resource pressure, packaging, and licensing on representative qualification hardware. The objective is to discover stack/licensing/hardware infeasibility before the rest of the product depends on assumptions about the voice stack.

### 5. Decouple post-V1 integrations

SSH, Google Workspace, Microsoft 365, and Cloudflare remain binding post-V1 product targets. They no longer have to be delivered atomically in the first feature-bearing post-V1 release.

They may ship independently in production-qualified feature releases as each integration is complete. Security/maintenance releases remain independent.

### 6. Machine-readable repeated contract values

Phase 0 shall establish machine-readable canonical definitions/checks for repeated security/profile values and capability matrices where practical. Human contracts remain normative, but CI must detect divergence rather than relying solely on manual duplication discipline.

### 7. SQLite qualification wording

SQLite support is based on the exact embedded SQLite/SQLCipher build and proof that the required WAL-reset fix is present. `3.51.3` remains the first known fixed upstream SQLite point for that defect, but numerical `>= 3.51.3` comparison alone does not establish production qualification.

---

## Consequences

- The fundamental Rust/Tauri → Node Core → providers/tools/workers architecture is unchanged.
- Windows remains the only V1 production platform; Linux remains a future `FULL_HOST` target.
- V1 scope is not reduced.
- Backup format implementation loses discretionary cipher/chunk/key-slot substitutions under format V1.
- Portable disaster recovery gains a high-entropy generated recovery anchor rather than relying solely on user passphrase quality.
- Opening an unfamiliar repository can no longer silently turn attacker-controlled `AGENTS.md` into trusted policy.
- Update/module trust now has a standard rotation/revocation/anti-rollback lifecycle instead of a simple signature-valid boolean.
- Voice feasibility risk is moved earlier without moving complete voice product implementation earlier.
- Post-V1 integration releases can be incremental without abandoning any of the four committed targets.
- Contract duplication is constrained by planned machine-readable CI drift checks.

---

## Alternatives rejected

### Keep flexible backup AEAD wording

Rejected. Long-lived disaster-recovery data requires a reproducible versioned cryptographic format, not adapter-level freedom.

### Let passphrase strength alone define portable recovery

Rejected. An offline copied backup is guessable without online rate limiting; a generated high-entropy recovery secret provides a deterministic minimum recovery strength.

### Auto-trust `AGENTS.md` when inside project root

Rejected. Filename/location establishes candidate scope, not author identity or user consent.

### Invent custom update-signing rotation

Rejected. TUF already models root rotation, threshold trust, expiry, delegation, rollback/freeze and mix-and-match protection.

### Remove mandatory voice from V1

Rejected. Voice is part of the intended V1 product. The improvement is earlier feasibility evidence, not scope deletion.

### Force all four post-V1 integrations into one release

Rejected. Their production readiness is independent and atomic coupling adds delivery risk without a trust/security benefit.

---

## Verification impact

The active suite now requires backup-format cryptographic vectors/tamper tests, generated-recovery disaster restore, project-policy enrollment/change/nesting tests, TUF root/role rotation/revocation/rollback/freeze tests, early real-hardware voice feasibility evidence, and contract-profile drift checks.

These are contract/release requirements. No application implementation is performed by this ADR.

---

**END — ADR-073**
