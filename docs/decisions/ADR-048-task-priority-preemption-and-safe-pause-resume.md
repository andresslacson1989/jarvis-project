# ADR-048 — Task Priority, Preemption, and Safe Pause/Resume

- **Status:** Accepted
- **Date:** 2026-08-11
- **Decision type:** Binding architecture decision

## Context

JARVIS may execute multiple missions and workers concurrently. A newly received task can be more urgent than existing work, and an authenticated user may explicitly reprioritize, pause, cancel, or replace ongoing work. The runtime therefore requires deterministic rules for priority, safe interruption, resource reallocation, checkpointing, and resumption.

Immediate process termination is not always safe. Some operations can be interrupted freely, some must reach a safe point first, and a small number may be temporarily non-preemptible because interruption would create a greater risk of corruption or inconsistent state.

This decision extends the existing task manager, worker journals, durable recovery, resource-aware scheduling, queue transparency, authority-envelope, and graph-orchestration decisions.

## Decision

JARVIS SHALL support explicit task and mission priorities together with safe preemption, pause, resume, cancellation, and resource reallocation.

### Priority classes

The runtime SHOULD support at least the following priority classes:

- `CRITICAL`
- `HIGH`
- `NORMAL`
- `LOW`
- `BACKGROUND`

Priority SHALL influence scheduling and preemption, but priority alone SHALL NOT imply that lower-priority work must be interrupted when sufficient resources exist to execute both safely.

### Safe preemption

When a higher-priority task cannot start safely because lower-priority work consumes required resources, JARVIS SHOULD preempt the lowest-value compatible work at the earliest safe interruption point.

Preemption SHOULD follow this sequence where practical:

1. request pause;
2. reach a safe interruption point;
3. persist a durable checkpoint;
4. persist current task and worker state;
5. release unnecessary provider, compute, workspace, or other resources;
6. transition the task to `PAUSED`;
7. expose the change to the user through the dashboard and audit stream.

A task SHOULD NOT be killed blindly when doing so risks corruption, data loss, or ambiguous external state.

### Interruptibility classes

Operations SHALL be able to declare an interruption policy such as:

- `PREEMPTIBLE` — may be interrupted immediately;
- `SAFE_POINT_ONLY` — must first reach a defined consistent state;
- `NON_PREEMPTIBLE` — interruption is temporarily unsafe and execution must reach a safe boundary first.

`NON_PREEMPTIBLE` SHALL be rare, narrowly scoped, and SHALL NOT be used to prevent legitimate user cancellation indefinitely.

### Task states

The task runtime SHALL support pause/resume lifecycle states sufficient to represent at least:

- `RUNNING`
- `PAUSING`
- `PAUSED`
- `RESUMING`

Existing task states such as queued, blocked, waiting for approval, completed, failed, and cancelled remain authoritative where applicable.

### Pause versus cancel

`PAUSE` SHALL preserve mission intent and sufficient durable state for later continuation.

`CANCEL` SHALL terminate the task or mission and prevent automatic continuation unless the authenticated user explicitly restarts or recreates it.

Natural-language commands such as "pause", "cancel", "stop this mission", or "work on this first" SHALL be interpreted by the AI layer, while deterministic Core state transitions SHALL perform the actual operation.

Voice reflex commands such as "stop speaking" SHALL remain distinct from task cancellation.

### Durable checkpoints

A proper pause SHOULD preserve enough state to resume without depending on the original worker process remaining alive. This SHOULD include, as applicable:

- task goal;
- current graph node;
- latest worker checkpoint;
- produced artifacts;
- workspace, branch, or worktree state;
- verification state;
- current blockers;
- next intended action;
- relevant resource locks;
- assumptions about external or live state.

Paused workers MAY release memory, provider sessions, GPU resources, or other runtime resources after durable checkpointing.

### Resume verification

Resuming paused work SHALL verify relevant live state before continuing. JARVIS SHALL NOT assume that repositories, files, services, provider state, infrastructure, external APIs, or other mutable environments are unchanged merely because a durable checkpoint exists.

If the previous assumptions are no longer valid, the task SHOULD request re-planning under the dynamic mission graph rules.

### Scheduling and resource reallocation

A newly received high-priority or critical task SHOULD run concurrently with existing work when capacity permits and doing so does not compromise voice responsiveness, task integrity, workspace isolation, budget policy, or provider limits.

If preemption is required, the scheduler SHOULD consider more than nominal priority, including:

- explicit authenticated user instruction;
- urgency;
- interruption safety;
- resource contention;
- checkpoint readiness;
- task progress;
- project/environment sensitivity;
- budget and provider constraints.

The AI MAY help assess semantic urgency and user intent, but deterministic runtime policy SHALL decide actual concurrency, preemption, and state transition validity.

### User priority instructions

Explicit authenticated user instructions to reprioritize, pause, cancel, or focus work SHALL receive strong precedence over AI-generated priority decisions.

If immediate interruption would itself create unacceptable risk, JARVIS SHALL reach the earliest safe interruption point and SHOULD clearly surface that state rather than pretending the work stopped instantly.

### Queue and dashboard transparency

Priority changes, preemption, pause, resume, cancellation, and delayed-start state SHALL remain visible in the work dashboard and task queue.

JARVIS SHALL NOT silently make work disappear or imply paused work is still running.

New priority decisions SHALL continue to obey the mandatory queue-transparency contract.

### Auditability

The audit layer SHALL record meaningful scheduling transitions, including where applicable:

- task or mission;
- old priority/state;
- new priority/state;
- reason;
- triggering authenticated instruction or policy event;
- checkpoint reference;
- relevant safe-point or interruption result.

## Relationship to prior decisions

This ADR complements rather than replaces:

- ADR-032 Mission Planning and Worker Allocation;
- ADR-032A Mandatory Queue Transparency;
- ADR-037 Durable Recovery and Safe Resume;
- ADR-038 Work Dashboard, Worker Journals, and Auditability;
- ADR-043 Budget and Usage Policy Engine;
- ADR-045 Authority Envelope and Precedent-Aware Autonomy;
- ADR-046 Graph-Orchestrated Missions and Bounded Worker Loops;
- ADR-047 Dynamic Mission Graph Revision.

## Governing principle

> **Interrupt the work, not the integrity of the work.**
