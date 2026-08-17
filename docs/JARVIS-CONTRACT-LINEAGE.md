# JARVIS Contract Lineage and Authority

**Current contract suite:** v1.0.8
**Current authoritative branch:** `master`  
**Current manifest:** `docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md`  
**Date:** 2026-08-17

## Purpose

This file removes ambiguity about which JARVIS documents and decisions are current after review branches and contract revisions evolved over time.

## Canonical lineage

`master` is the only authoritative/latest repository branch.

The canonical decision history includes accepted ADR-054 through ADR-068, v1.0.2 consolidation in ADR-069, UI identity/adaptive Mission Control in ADR-070, v1.0.3 production hardening in ADR-071, the Windows/Linux platform/runtime-role boundary in ADR-072, the pre-implementation security/sequence closure in ADR-073, hosting-capability-aware repository governance in ADR-074, private/internal Windows release scope in ADR-075, and delegated Codex worker network availability in ADR-076.

ADR identifiers in this lineage are unique. Duplicate ADR identifiers from deleted historical review branches are non-canonical.

## Contract-suite evolution

```text
historical v0.1 / v1.0
        ↓
reviewed accepted ADR lineage
        ↓
v1.0.2 — canonical consolidation / no-overlay baseline (ADR-069)
        ↓
ADR-070 — approved JARVIS UI identity + adaptive Mission Control
        ↓
v1.0.3 — production-hardening closure (ADR-071)
        ↓
v1.0.4 — platform runtime roles / Windows-Linux portability boundary (ADR-072)
        ↓
v1.0.5 — backup/policy/supply-chain security closure + delivery sequencing (ADR-073)
        ↓
v1.0.6 — hosting-capability-aware repository governance (ADR-074)
        ↓
v1.0.7 — private/internal Windows release scope (ADR-075)
```

v1.0.4 did not make Linux a V1 release target. It made Linux an explicit future `FULL_HOST` target and required implementation to preserve the platform capability boundaries needed to reach it without weakening Windows V1.

v1.0.5 does not redesign the core architecture or reduce V1 scope. It freezes the remaining security-sensitive implementation choices that should not be invented during coding and moves one feasibility proof earlier.

v1.0.6 does not change V1 platform, runtime, provider, integration, UI, backup, voice, or product capability scope. It changes only repository-governance qualification so a hosting feature unavailable because of the repository plan does not become a hidden paid prerequisite, while stronger server-side enforcement remains mandatory whenever the hosting capability exists.

v1.0.7 does not remove Windows artifact signing, TUF metadata, updater, rollback, recovery, or exact-artifact qualification. It narrows the active release claim to `PRIVATE_INTERNAL`: explicitly enrolled self-signed/private-CA Authenticode is acceptable for controlled targets, while public Microsoft Store/public Internet/public-trust distribution is out of scope.

## v1.0.5 closure retained by v1.0.6

ADR-073 and the inherited v1.0.5 security closure establish:

- exact `JARVIS_BACKUP_V1` outer cryptographic framing and key-slot semantics;
- mandatory generated 256-bit recovery secret for production portable-state verification, with optional additional strong passphrase slot;
- exact SQLCipher snapshot/re-key behavior must be proven on the selected production binding rather than assumed;
- explicit authenticated project-policy candidate/enrollment/hash-change/nesting/revocation boundary for `AGENTS.md`;
- TUF 1.0.35 update/module trust metadata with Ed25519 role keys, offline 2-of-3 root threshold, delegation, expiration, rotation/revocation and anti-rollback/freeze/mix-and-match behavior;
- cumulative TUF + Tauri updater + Windows code-signing + JARVIS compatibility gates;
- monotonic application `releaseSequence` and `securityEpoch` policy;
- early real-hardware voice feasibility spike after the persistence/recovery proof;
- independent post-V1 delivery of SSH, Google Workspace, Microsoft 365 and Cloudflare while retaining all four as binding roadmap targets;
- Phase-0 machine-readable repeated contract values/CI drift checks where practical;
- exact-build/fix evidence rather than raw numeric SQLite version comparison as production qualification.

These rules remain current normative behavior in v1.0.8. ADR-073 explains why and is not required as an implementation overlay.

## v1.0.6 repository-governance closure

ADR-074 establishes:

- `master` remains the sole authoritative/latest branch;
- server-side branch protection/rulesets are mandatory whenever the authoritative repository's hosting provider/account exposes them;
- a verified hosting plan/platform limitation may use the explicit `COMPENSATING_CONTROLS` mode instead of making a paid hosting feature a hidden JARVIS prerequisite;
- compensating mode requires temporary implementation branches, exact candidate mandatory CI, immediate live-`master` tip revalidation, reconciliation on stale movement, non-force integration, and post-integration tip/diff/CI/audit verification;
- compensating mode must state truthfully that `master` is not server-protected and does not hard-block an out-of-band administrator force push/deletion;
- server-enforced mode becomes mandatory again when the hosting capability becomes available.

## Current normative model

`docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md` is the authoritative index and records the exact component-revision set for v1.0.8.

Some unchanged earlier component revisions remain current because their normative behavior did not change. The manifest explicitly identifies them; earlier suite top-level contracts are not current merely because an inherited component's historical header names an earlier parent.

The v1.0.5 specialized security contracts remain current cumulative specializations of compatible broad inherited rules. The v1.0.6 top-level, Verification, and Implementation Plan revisions add the repository-governance qualification, the v1.0.7 top-level, Release Profile, Supply-Chain, Verification, and Implementation Plan revisions add private/internal release scope, and the v1.0.8 revisions add the Codex worker network-availability decision. These rules are one current suite, not an ADR overlay.

ADRs preserve context, alternatives, rationale, and historical decision identity. Implementers do not reconstruct current behavior by layering ADRs over stale contracts.

## Historical divergent review work

Former `codex/contract-*` branches are deleted/non-authoritative. Useful semantics were reconciled into the current suite. Duplicate ADR numbers from historical divergent branches SHALL NOT be cited as canonical.

## Future amendment rule

When a future material architectural/product/security/platform/release/governance decision changes current behavior:

1. assign a new unique ADR;
2. document rationale and migration/compatibility consequences;
3. update every affected active normative file in the same change;
4. update the contract manifest and component revisions;
5. update the Release Profile when support/capability scope changes;
6. update verification and implementation sequencing;
7. advance the suite version when semantic current behavior changes;
8. only then may implementation depend on the change.

## Governing rule

> **There is one current contract suite on `master`, pinned by one manifest. Share product semantics; specialize native mechanisms; freeze security formats that must remain recoverable and trustworthy over time.**
