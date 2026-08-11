# ADR-047 — Dynamic Mission Graph Revision

- **Status:** Accepted
- **Date:** 2026-08-11
- **Decision:** JARVIS supports controlled, versioned revision of active mission graphs when new information makes the current plan incomplete, inefficient, blocked, or invalid.

## Context

JARVIS missions are executed as explicit task graphs, while individual AI workers operate bounded loops inside assigned tasks. During execution, workers may discover that the original graph is incomplete or based on invalid assumptions. Production execution therefore requires the mission plan to adapt without allowing workers or models to rewrite authoritative workflow state directly or silently expand user intent.

## Decision

### 1. Controlled graph mutation

AI workers MAY report discoveries and request re-planning, but SHALL NOT directly mutate the authoritative mission graph.

The Mission Planner MAY propose changes including:

- adding tasks;
- splitting tasks;
- replacing tasks;
- cancelling obsolete tasks;
- changing priorities;
- adding or removing real dependencies;
- re-planning remaining work.

JARVIS Core SHALL validate proposed graph revisions before activation.

### 2. Core validation boundary

Before applying a graph revision, JARVIS Core SHALL validate at least:

- current Authority Envelope;
- permissions and risk policy;
- project and workspace boundaries;
- environment scope;
- task state and dependency integrity;
- resource and concurrency availability;
- provider constraints;
- configured budget and usage policy.

The AI proposes the change. Deterministic software decides whether the change may become authoritative.

### 3. Versioned mission graphs

Mission graph revisions SHALL be versioned and auditable rather than silently overwriting the prior plan.

A revision record SHOULD identify:

- previous and new graph version;
- reason for the change;
- tasks or dependencies added, removed, replaced, or reprioritized;
- worker finding, event, or verification result that caused the revision;
- planner or component that proposed it;
- authorization outcome where relevant.

### 4. Preserve valid completed work

Completed outputs that remain valid SHOULD be preserved and reused across graph revisions.

If new evidence invalidates earlier work, JARVIS SHALL explicitly mark the affected result as invalidated, including the reason, instead of silently replacing history or pretending it remains valid.

### 5. Routine vs material revisions

Routine, recoverable graph revisions that remain inside the existing Authority Envelope MAY be applied autonomously.

Examples include:

- splitting an investigation into smaller tasks;
- adding diagnostics;
- adding verification;
- removing a fake dependency;
- parallelizing genuinely independent read-only work;
- retrying through another already-approved compatible provider.

Material revisions that expand consequential authority SHALL require additional authorization according to existing policy.

Examples include:

- expanding into another project;
- changing production architecture;
- adding a major infrastructure dependency;
- changing deployment environment or target;
- materially increasing financial exposure;
- performing destructive or materially unrecoverable actions;
- changing the user's stated goal rather than merely improving the plan for achieving it.

### 6. Structured re-plan requests

A worker SHALL be able to pause or terminate its bounded loop with a structured `REPLAN_REQUESTED` state when:

- assumptions have become invalid;
- the task is blocked by newly discovered dependencies;
- required work falls outside the task's authority or scope;
- meaningful progress has stalled;
- the worker discovers a materially better task decomposition.

A re-plan request SHOULD include the reason, supporting evidence, current task state, and suggested next work when known.

### 7. Lack-of-progress handling

Lack-of-progress detection SHALL be able to escalate from local worker reconsideration to mission-level re-planning rather than allowing an agent loop to consume resources indefinitely.

### 8. Queue transparency

Tasks introduced or delayed by graph revision SHALL remain subject to mandatory queue transparency. JARVIS SHALL NOT imply newly created work is running when it is queued, blocked, or waiting for authorization.

### 9. Budget-aware graph expansion

Graph revisions that would exceed configured mission, project, provider, or global usage limits SHALL be stopped or rerouted according to the Budget and Usage Policy Engine. Material budget expansion SHALL require whatever explicit override or policy change is applicable.

### 10. Recovery and auditability

Graph revision state SHALL participate in durable recovery. After restart or interruption, JARVIS SHALL be able to determine which graph version was authoritative, which tasks were valid, which were invalidated, and which revisions were pending approval.

## Consequences

This allows JARVIS to adapt intelligently to discoveries made during real work while retaining deterministic control over authority, budget, execution state, recovery, and auditability. It avoids both rigid plans that cannot learn and uncontrolled agentic plans that silently expand scope.

## Governing Principle

> **The plan may change. The goal, authority, and audit trail do not change silently.**
