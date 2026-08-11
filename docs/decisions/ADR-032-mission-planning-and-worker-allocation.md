# ADR-032 — Mission Planning and Worker Allocation

**Status:** Approved  
**Date:** August 11, 2026  
**Decision Type:** Production Architecture

## Context

A single natural-language request may contain multiple independent, sequential, conditional, or dependent pieces of work. JARVIS must be able to decompose such requests without losing track of execution state or allowing the AI orchestrator to spawn uncontrolled workers.

## Decision

JARVIS SHALL use the AI Orchestrator as a Mission Planner that proposes a structured decomposition of compound user requests into actions, tasks, workstreams, and missions.

The planner SHALL identify whether proposed work is:

- parallel;
- sequential;
- conditional;
- dependent.

The AI Orchestrator MAY propose the logical number of workers that would best execute the plan.

JARVIS Core SHALL validate the proposed execution graph before work begins.

JARVIS Core, the Task Manager, Resource Manager, Permission Engine, and Worker Pool SHALL determine the actual number of workers that may run concurrently.

The governing rule is:

> **AI determines logical parallelism. Software determines actual concurrency.**

Worker allocation SHALL consider:

- system RAM and CPU pressure;
- GPU/VRAM pressure where applicable;
- provider availability and limits;
- repository and working-tree conflicts;
- current task priorities;
- configured maximum worker counts;
- privacy and permission policy;
- active voice-session responsiveness requirements.

If the planner proposes more workers than current capacity permits, excess tasks SHALL be queued rather than rejected or allowed to overload the system.

JARVIS SHOULD allow only one write-capable worker per repository working tree at a time unless explicit isolation is provided through separate branches, Git worktrees, or another approved mechanism.

The planner MUST NOT decompose trivial operations into unnecessary missions or workers. Small deterministic operations SHOULD remain actions/tools.

Consequential ambiguity in decomposition MUST result in clarification rather than guessing.

## Example

User request:

> “Have Codex continue fixing LocalCI, and while that runs check the IBMA booking issue, then tell me when both are done.”

The Orchestrator may propose:

```text
Mission
├── Task A — Continue LocalCI fix
│   └── software engineering worker
├── Task B — Investigate IBMA booking issue
│   └── software engineering worker
└── Task C — Final summary
    └── depends on A + B
```

The Orchestrator may recommend two workers because Tasks A and B are independent.

JARVIS Core may still choose to run only one worker at a time if resource, provider, policy, or repository constraints require it.

## Rationale

This preserves natural-language flexibility while preventing uncontrolled agent spawning, machine overload, repository conflicts, and loss of deterministic execution control.

It is consistent with the project-wide principle:

> **AI decides. Software authorizes.**
