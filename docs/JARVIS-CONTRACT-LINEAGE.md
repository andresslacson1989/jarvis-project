# JARVIS Contract Lineage and Authority

**Current contract:** v1.0.2  
**Date:** 2026-08-11

## Purpose

This file exists to remove ambiguity about which JARVIS documents are current after two review branches evolved independently.

## Canonical lineage

The canonical decision history is the lineage that produced `codex/contract-consistency-fixes` through accepted ADR-068, followed by the v1.0.2 consolidation on `codex/contract-v1.0.2-consolidation`.

ADR identifiers in this lineage are unique. In particular, ADR-054 through ADR-068 on the canonical branch retain their existing identities.

## Divergent implementation-lock branch

`codex/contract-implementation-lock` diverged from the earlier common baseline and independently created different documents named ADR-054, ADR-055, and ADR-056. Those duplicate identifiers are not imported into the canonical lineage and SHALL NOT be cited as canonical JARVIS ADRs.

The branch nevertheless contained valuable engineering work, including:

- a consolidated top-level contract structure;
- a concrete Release Profile;
- production coding standards;
- discriminated execution scopes;
- stronger early persistence/recovery proof sequencing;
- useful security/schema/recovery wording.

That useful content has been reviewed and incorporated directly into the v1.0.2 normative suite where still valid.

Therefore the old branch is **historical/non-authoritative**, not discarded evidence and not a parallel source of truth.

## Current normative model

The v1.0.2 top-level contract and its listed appendices are the current implementation source of truth.

ADRs are architectural decision records. Their role is to preserve:

- context;
- alternatives considered;
- rationale;
- historical decision identity.

Their effective rules are incorporated into current normative documents. Implementers do not reconstruct current behavior by layering ADRs over stale contracts.

## Future amendment rule

When a future architectural decision changes current behavior:

1. assign a new unique ADR identifier;
2. document the rationale and migration/compatibility consequences;
3. update every affected active normative contract file in the same change;
4. update the Release Profile if support scope changes;
5. add/modify verification requirements for the changed invariant;
6. only then may implementation depend on the change.

A new accepted ADR with contradictory old canonical wording is an incomplete contract change and SHALL NOT be treated as implementation-ready.

## Historical contracts

Earlier top-level contracts are stored under `docs/history/` and are explicitly non-normative. They exist to show how the architecture evolved.

## Governing rule

> **There is one current contract. ADRs explain how it got there; they do not force implementers to calculate the current architecture from a stack of superseding patches.**
