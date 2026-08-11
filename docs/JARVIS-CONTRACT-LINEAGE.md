# JARVIS Contract Lineage and Authority

**Current contract suite:** v1.0.3  
**Current authoritative branch:** `master`  
**Current manifest:** `docs/JARVIS-CONTRACT-MANIFEST-v1.0.3.md`  
**Date:** 2026-08-12

## Purpose

This file removes ambiguity about which JARVIS documents and decisions are current after earlier review branches and contract revisions evolved over time.

## Canonical lineage

`master` is the only authoritative/latest repository branch.

The canonical decision history is the lineage that produced accepted ADR-054 through ADR-068, the v1.0.2 consolidation in ADR-069, the approved UI identity/adaptive-dashboard decision in ADR-070, and the v1.0.3 production-hardening/release-closure decision in ADR-071.

ADR identifiers in this lineage are unique. ADR-054 through ADR-071 on `master` retain their existing identities.

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
```

v1.0.3 is not a second overlay on v1.0.2. The current v1.0.3 files directly contain the effective rules. The former v1.0.2 top-level contract and its reconciliation report are retained only under `docs/history/`.

## Historical divergent review work

The former `codex/contract-implementation-lock` review branch diverged from an earlier common baseline and independently created different documents named ADR-054, ADR-055, and ADR-056. Those duplicate identifiers are not imported into the canonical lineage and SHALL NOT be cited as canonical JARVIS ADRs.

That historical review nevertheless contained valuable engineering work, including:

- a consolidated top-level contract structure;
- a concrete Release Profile;
- production coding standards;
- discriminated execution scopes;
- stronger early persistence/recovery proof sequencing;
- useful security/schema/recovery wording.

That useful content was reviewed and incorporated directly into the canonical suite where still valid.

All former `codex/contract-*` remote branches were deleted after reconciliation. Their history is provenance only and not a parallel source of truth.

## v1.0.3 production-hardening closure

The fresh post-UI review identified production-readiness gaps rather than a need for architecture redesign. ADR-071 and the v1.0.3 suite close them directly by adding/propagating:

- central UI identity/adaptive/accessibility release gates;
- Codex Windows setup/repair/UAC lifecycle separate from normal worker execution;
- versioned Argon2id session/recovery KDF profiles with a deterministic production floor;
- exact mandatory V1 GitHub and Proxmox capability matrices;
- canonical mark/lockup/app-icon sources and visual-asset license/provenance rules;
- contract-suite semantic versioning and manifest governance;
- protected-`master`/CI repository governance as a Phase 0 requirement.

These rules live in the current normative documents. ADR-071 explains why; it is not required to discover what to implement.

## Current normative model

`docs/JARVIS-CONTRACT-MANIFEST-v1.0.3.md` is the authoritative index of the current suite.

The v1.0.3 top-level contract and every document listed by that manifest are the current implementation source of truth.

ADRs preserve:

- context;
- alternatives considered;
- rationale;
- historical decision identity.

Their effective current rules are incorporated into current normative documents. Implementers do not reconstruct current behavior by layering ADRs over stale contracts.

## Future amendment rule

When a future material architectural/product/security/release decision changes current behavior:

1. assign a new unique ADR identifier;
2. document rationale and migration/compatibility consequences;
3. update every affected active normative contract file in the same change;
4. update the contract manifest;
5. update the Release Profile if support/capability scope changes;
6. add/modify verification and implementation-sequencing requirements for the changed invariant;
7. advance the contract-suite version when semantic current behavior changes;
8. update canonical assets/tokens when brand/UI identity changes;
9. only then may implementation depend on the change.

A new accepted ADR with contradictory or incomplete current canonical wording is an incomplete contract change and SHALL NOT be treated as implementation-ready.

## Historical contracts

Earlier top-level contracts and previous reconciliation/audit documents are stored under `docs/history/` and are explicitly non-normative. They exist to show how the architecture evolved.

## Governing rule

> **There is one current contract suite on `master`, pinned by one manifest. ADRs explain how it got there; they do not force implementers to calculate current architecture from a stack of superseding patches.**
