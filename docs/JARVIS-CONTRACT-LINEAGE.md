# JARVIS Contract Lineage and Authority

**Current contract:** v1.0.2  
**Current authoritative branch:** `master`  
**Date:** 2026-08-12

## Purpose

This file exists to remove ambiguity about which JARVIS documents and decisions are current after earlier review branches evolved independently.

## Canonical lineage

`master` is the only authoritative/latest repository branch.

The canonical decision history is the lineage that produced accepted ADR-054 through ADR-068, the v1.0.2 consolidation in ADR-069, and the JARVIS UI identity/adaptive-dashboard decision in ADR-070.

ADR identifiers in this lineage are unique. ADR-054 through ADR-070 on `master` retain their existing identities.

## Historical divergent review work

The former `codex/contract-implementation-lock` review branch diverged from an earlier common baseline and independently created different documents named ADR-054, ADR-055, and ADR-056. Those duplicate identifiers are not imported into the canonical lineage and SHALL NOT be cited as canonical JARVIS ADRs.

That historical review nevertheless contained valuable engineering work, including:

- a consolidated top-level contract structure;
- a concrete Release Profile;
- production coding standards;
- discriminated execution scopes;
- stronger early persistence/recovery proof sequencing;
- useful security/schema/recovery wording.

That useful content was reviewed and incorporated directly into the v1.0.2 normative suite where still valid.

The old review branches have been deleted from the remote repository. Their history is provenance only and not a parallel source of truth.

## Current normative model

The v1.0.2 top-level contract and its listed appendices on `master` are the current implementation source of truth.

This includes the normative UI identity/design-system contract adopted by ADR-070. Approved mockups and ADR rationale explain the direction; implementers use the active contract and canonical brand assets to determine what to build.

ADRs are architectural/product decision records. Their role is to preserve:

- context;
- alternatives considered;
- rationale;
- historical decision identity.

Their effective rules are incorporated into current normative documents. Implementers do not reconstruct current behavior by layering ADRs over stale contracts.

## Future amendment rule

When a future architectural or product-identity decision changes current behavior:

1. assign a new unique ADR identifier;
2. document the rationale and migration/compatibility consequences;
3. update every affected active normative contract file in the same change;
4. update the Release Profile if support scope changes;
5. add/modify verification requirements for the changed invariant;
6. update canonical assets/tokens when brand or UI identity changes;
7. only then may implementation depend on the change.

A new accepted ADR with contradictory old canonical wording is an incomplete contract change and SHALL NOT be treated as implementation-ready.

## Historical contracts

Earlier top-level contracts are stored under `docs/history/` and are explicitly non-normative. They exist to show how the architecture evolved.

## Governing rule

> **There is one current contract on `master`. ADRs explain how it got there; they do not force implementers to calculate the current architecture or product identity from a stack of superseding patches.**
