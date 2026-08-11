# ADR-069 — Canonical Contract v1.0.2 Consolidation

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Contract governance and production-architecture consolidation

## Context

JARVIS accumulated a strong v1.0 production contract plus many accepted ADRs. A second implementation-lock review branch also produced useful contract material but independently reused ADR-054/055/056 identifiers for different decisions.

Although document-precedence rules could theoretically resolve many individual conflicts, requiring implementers to reconstruct current behavior by overlaying stale contracts and later ADRs creates avoidable security, implementation, and maintenance risk.

A production architecture contract should present one current answer for each foundational question.

## Decision

JARVIS adopts `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md` and its listed normative appendices as the sole current implementation contract baseline.

The consolidation SHALL incorporate every still-valid accepted decision through ADR-068 plus the contract-hardening findings approved for this consolidation.

Earlier top-level contracts are historical and move under `docs/history/`.

ADRs remain decision history/rationale; implementation SHALL NOT require ADR overlay interpretation to know current behavior.

The duplicate ADR-054/055/056 files from the divergent `codex/contract-implementation-lock` branch are not part of the canonical ADR lineage. Useful semantics from that branch are incorporated as contract content without importing those duplicate identifiers.

## Synchronous amendment policy

A future material architecture change requires:

1. a new unique ADR;
2. updates to every affected active normative document in the same reviewed change;
3. Release Profile update when support scope changes;
4. verification/compatibility updates for the changed invariant.

Implementation SHALL NOT rely on a later ADR while contradictory current normative wording remains.

## Consolidated corrections

v1.0.2 also makes explicit the following previously underspecified boundaries:

- delegated shell-capable engineering workers operate under a bounded `WORKSPACE_ENGINEERING` profile and do not obtain consequential external authority merely because their provider can execute commands;
- Tauri/WebView production security requires explicit capabilities, restrictive CSP, local bundled authoritative UI content, navigation control, no privileged remote-origin capability, and qualified dependency/security-fix posture;
- PermissionEngine evaluation has deterministic precedence with mandatory safety invariants and explicit deny dominating grants; precedent cannot independently authorize HIGH/CRITICAL actions;
- portable SQLCipher backup semantics include an explicit clean-machine snapshot-key path and re-key restored data under a fresh local database key;
- consequential external writes use conditional/versioned mutation where the target system supports it to reduce target-change races;
- session-password recovery does not create a weak Windows-only bypass and is tied to an explicit verified JARVIS recovery factor;
- canonical vocabulary is normalized for sensitivity/locality, exact money, `RESUMING`, approval digest material, provider compatibility, module execution classes, and V1 integration scope.

## Consequence

An implementer should be able to read README/AGENTS and the v1.0.2 suite without asking which later ADR supersedes a sentence.

## Governing principle

> **History explains the contract. The current contract defines the product.**
