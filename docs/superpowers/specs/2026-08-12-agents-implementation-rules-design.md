# AGENTS Implementation Execution Protocol Design

## Purpose

Add contributor-facing execution rules to `AGENTS.md` so any human or AI implementation agent uses the locked contract as master authority and executes implementation through a traceable section/subsection matrix.

## Design

The protocol is governance-only. It does not introduce product requirements or change the v1.0.5 architecture. It operationalizes existing contract requirements by requiring one active subsection at a time, a repeat-until-verified implementation loop, hard contract/evidence gates, section integration checkpoints, and truthful status tracking.

Every subsection receives contract-derived acceptance criteria plus mandatory cross-cutting evaluation for Contract Accuracy, production readiness, production practices, enterprise hardening, atomicity where applicable, idempotency/retry safety where applicable, failure/recovery, security, verification quality, and architecture integrity. Contract Accuracy must be exactly 10/10; ordinary applicable criteria must be at least 8/10. Scores never override failed objective gates.

Mutating work must explicitly determine its atomicity and retry model. Local authoritative state uses transactional expected-state/event invariants where applicable; external effects use attempts, conditional mutation/preconditions, postconditions, `UNCERTAIN`, and reconciliation rather than false cross-system atomicity or blind retry.

A subsection reaches VERIFIED only after its hard criteria and evidence pass. A section reaches VERIFIED only after all required subsections are verified and the section-level integration checkpoint passes. `BLOCKED` is reserved for genuine external dependencies; ordinary implementation/test/build failures stay IN PROGRESS and are worked through.

Checkpoint summaries record: original goal, completed/found, key decisions, and remaining work, and become the next continuation baseline.

## Non-goals

- no product architecture change;
- no locked contract amendment;
- no new V1 scope;
- no implementation code;
- no relaxation of existing security, recovery, release, or verification gates.
