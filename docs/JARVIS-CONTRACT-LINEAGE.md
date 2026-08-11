# JARVIS Contract Lineage and Authority

**Current contract suite:** v1.0.4  
**Current authoritative branch:** `master`  
**Current manifest:** `docs/JARVIS-CONTRACT-MANIFEST-v1.0.4.md`  
**Date:** 2026-08-12

## Purpose

This file removes ambiguity about which JARVIS documents and decisions are current after review branches and contract revisions evolved over time.

## Canonical lineage

`master` is the only authoritative/latest repository branch.

The canonical decision history includes accepted ADR-054 through ADR-068, v1.0.2 consolidation in ADR-069, UI identity/adaptive Mission Control in ADR-070, v1.0.3 production hardening in ADR-071, and the Windows/Linux platform/runtime-role boundary in ADR-072.

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
```

v1.0.4 does not make Linux a V1 release target. It makes Linux an explicit future `FULL_HOST` target and requires implementation to preserve the platform capability boundaries needed to reach it without weakening Windows V1.

Android is recorded as a future `COMPANION` direction only, not as a full-host or current V1 obligation.

## v1.0.4 platform closure

ADR-072 and the v1.0.4 suite establish:

- `FULL_HOST` and `COMPANION` as separate runtime roles;
- Windows `FULL_HOST` as the sole V1 production target;
- Linux `FULL_HOST` as an explicit future production target;
- Android as a future non-authoritative companion direction;
- typed platform capability/composition boundaries for native services;
- prohibition on scattering Windows-native implementation dependencies through shared Core/domain/policy code;
- no-lowest-common-denominator security rule;
- platform-specific provider/tool/module qualification where native behavior differs;
- future companion Remote Access Gateway requirement while preserving V1's no-privileged-LAN/Internet-Core boundary.

These rules live in current normative documents. ADR-072 explains why and is not required as an implementation overlay.

## Current normative model

`docs/JARVIS-CONTRACT-MANIFEST-v1.0.4.md` is the authoritative index and records the exact component-revision set.

Some unchanged v1.0.3 component revisions remain current because their normative behavior did not change. The manifest explicitly identifies them; earlier suite top-level contracts are not current merely because an inherited component's historical header names an earlier parent.

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

> **There is one current contract suite on `master`, pinned by one manifest. Share product semantics; specialize native mechanisms.**
