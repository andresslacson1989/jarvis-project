# JARVIS Contract Lineage and Authority

**Current contract suite:** v1.0.5  
**Current authoritative branch:** `master`  
**Current manifest:** `docs/JARVIS-CONTRACT-MANIFEST-v1.0.5.md`  
**Date:** 2026-08-12

## Purpose

This file removes ambiguity about which JARVIS documents and decisions are current after review branches and contract revisions evolved over time.

## Canonical lineage

`master` is the only authoritative/latest repository branch.

The canonical decision history includes accepted ADR-054 through ADR-068, v1.0.2 consolidation in ADR-069, UI identity/adaptive Mission Control in ADR-070, v1.0.3 production hardening in ADR-071, the Windows/Linux platform/runtime-role boundary in ADR-072, and the pre-implementation security/sequence closure in ADR-073.

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
```

v1.0.4 did not make Linux a V1 release target. It made Linux an explicit future `FULL_HOST` target and required implementation to preserve the platform capability boundaries needed to reach it without weakening Windows V1.

v1.0.5 does not redesign the core architecture or reduce V1 scope. It freezes the remaining security-sensitive implementation choices that should not be invented during coding and moves one feasibility proof earlier.

## v1.0.5 closure

ADR-073 and the v1.0.5 suite establish:

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

These rules live in current normative documents. ADR-073 explains why and is not required as an implementation overlay.

## Current normative model

`docs/JARVIS-CONTRACT-MANIFEST-v1.0.5.md` is the authoritative index and records the exact component-revision set.

Some unchanged earlier component revisions remain current because their normative behavior did not change. The manifest explicitly identifies them; earlier suite top-level contracts are not current merely because an inherited component's historical header names an earlier parent.

The v1.0.5 specialized security contracts narrow compatible broad inherited rules. They do not require ADR overlay interpretation.

ADRs preserve context, alternatives, rationale, and historical decision identity. Implementers do not reconstruct current behavior by layering ADRs over stale contracts.

## Historical divergent review work

Former `codex/contract-*` branches are deleted/non-authoritative. Useful semantics were reconciled into the current suite. Duplicate ADR numbers from historical divergent branches SHALL NOT be cited as canonical.

## Future amendment rule

When a future material architectural/product/security/platform/release decision changes current behavior:

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
