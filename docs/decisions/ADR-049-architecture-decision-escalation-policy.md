# ADR-049 — Architecture Decision Escalation Policy

**Status:** Accepted  
**Date:** 2026-08-11

## Context

JARVIS has reached sufficient architectural maturity that requiring explicit user approval for every production design detail creates unnecessary decision fatigue and slows convergence. Many remaining decisions are engineering choices that can be resolved from the existing technical contract, established principles, and production-readiness requirements.

The user has explicitly delegated non-critical architecture decisions to the architecture process and requested escalation only when a decision genuinely requires user judgment.

## Decision

JARVIS architecture work SHALL use delegated decision authority for non-critical engineering choices.

The architecture process SHALL independently select and document the most practical, production-ready option when the decision can be resolved consistently from existing requirements, ADRs, security principles, resource constraints, and product direction.

A decision SHALL be escalated to the user only when it materially requires user preference or consent, including cases that materially affect one or more of the following:

- security or trust boundaries;
- privacy or data exposure;
- destructive or materially irreversible behavior;
- recurring or potentially significant financial cost;
- core user experience or interaction model;
- product scope or capabilities the user would reasonably perceive as a major product choice;
- permanent external commitments, account actions, or policy choices;
- materially conflicting requirements where no clearly superior engineering resolution exists.

Implementation details, internal component boundaries, retry policies, routing algorithms, schemas, worker roles, provider selection mechanics, state-machine details, observability mechanisms, and similar engineering decisions SHOULD normally be resolved without user approval when they preserve the accepted product behavior and safety model.

The architecture process SHALL prefer existing accepted principles over creating new user-facing questions. In particular:

- **AI decides. Software authorizes. Software verifies.**
- **Workers own the loop. JARVIS owns the graph. Verification decides done.**
- **Be autonomous inside the user's intent. Ask before materially expanding it.**
- **Past approval is evidence, not a blank check.**
- **Interrupt the work, not the integrity of the work.**

Non-critical decisions that materially affect the architecture SHALL still be recorded as ADRs or incorporated into an appropriate consolidated architecture document so they remain auditable and reversible.

The user SHOULD receive concise summaries of significant decisions made autonomously rather than being asked to approve each one individually.

## Consequences

- Architecture work can progress in coherent batches instead of one bottleneck at a time.
- User attention is reserved for decisions where human judgment is genuinely required.
- Production engineering remains documented and auditable despite delegated decision authority.
- Existing security, permission, budget, privacy, and destructive-action confirmation requirements are unchanged.

## Governing Principle

> **Escalate product judgment. Resolve engineering judgment.**
