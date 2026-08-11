# ADR-052 — Protocol Schema Contract and Production Implementation Plan

**Status:** Accepted  
**Date:** 2026-08-11

## Context

ADR-051 established the JARVIS v1.0 production implementation contract suite. A final implementation-readiness review identified two remaining areas where developers could still be forced to invent foundational behavior during coding:

1. exact cross-process/domain message and schema shapes;
2. the dependency order in which the control plane, security boundary, workers, integrations, voice, recovery, and qualification should be built.

Leaving either unspecified would risk protocol drift, inconsistent state representations, premature AI privilege, or implementation milestones being mistaken for production completion.

## Decision

JARVIS SHALL adopt the following additional implementation references:

- `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md` — normative cross-boundary protocol/schema contract;
- `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` — authoritative implementation sequencing and phase exit criteria derived from the v1.0 contract suite.

The protocol/schema contract is normative. Cross-process, tool, provider, event, module, approval, task, mission, and persistence-facing structures SHALL use versioned runtime validation consistent with it.

The implementation plan is an execution plan rather than a product-policy contract; teams MAY decompose work differently, but SHALL preserve its dependency logic and SHALL satisfy the same phase exit criteria before relying on later layers.

The first implementation slice SHALL prove the trust/control plane before introducing broad AI autonomy:

```text
Tauri/React
  ↓
Rust Native Host
  ↓
authenticated local IPC
  ↓
Node Core
  ↓
transactional SQLite/event state
  ↓
session lock/security boundary
```

Only after that foundation is verified should Codex/provider execution and worker autonomy be layered on top.

## Consequences

- IPC and domain contracts are no longer prose-only concepts.
- Task/mission/approval/provider/tool structures have stable canonical shapes.
- Protocol compatibility and breaking-change rules are explicit.
- Implementers have an ordered path from empty repository to Production Complete.
- AI autonomy cannot become the accidental foundation of the application before the deterministic control plane exists.
- Production qualification remains the final completion gate, not an early milestone.

## Governing Principle

> **Build the control plane first, then give intelligence access to it. Cross every boundary with a versioned, validated contract.**
