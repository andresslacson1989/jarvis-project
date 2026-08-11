# ADR-032A — Mandatory Queue Transparency

**Status:** Approved  
**Date:** August 11, 2026  
**Parent Decision:** ADR-032 — Mission Planning and Worker Allocation

## Context

JARVIS may intentionally queue work when the AI planner proposes more parallel tasks than the runtime is allowed to execute concurrently, when a provider is busy or unavailable, when resource limits would make immediate execution unsafe, or when repository/worktree isolation prevents another write-capable worker from starting.

A production-ready assistant must never make queued work invisible. If JARVIS accepts a user request but does not begin part of that work immediately, the user must know that the work is waiting rather than assume it has started.

## Decision

Whenever JARVIS places accepted work into a queue, JARVIS MUST immediately inform the user that the work has been queued.

The notification MUST identify the queued work clearly enough for the user to understand what is waiting. Where useful, it SHOULD also state the reason for queuing, such as worker capacity, provider availability, resource limits, dependency ordering, or repository isolation.

Queued work MUST remain visibly represented in the JARVIS desktop UI until it starts, is cancelled, fails, or is otherwise resolved.

The user MUST be able to distinguish at minimum between:

- queued;
- running;
- waiting for approval;
- blocked;
- completed;
- failed;
- cancelled.

JARVIS MUST NOT say or imply that queued work is already running.

When a queued task begins execution, its status MUST transition to running and the UI MUST reflect that transition. A spoken notification MAY be used when appropriate, but voice notifications SHOULD avoid unnecessary chatter.

If queue order changes materially, or if a queued task becomes blocked or cannot start, JARVIS MUST surface that state rather than silently leaving it pending.

## Example

User request:

> “Have Codex continue LocalCI and also investigate the IBMA booking issue.”

If only one engineering worker can run immediately, JARVIS should respond with the equivalent of:

> “LocalCI is starting now. I’ve queued the IBMA booking investigation and I’ll start it as soon as a worker is available.”

The UI should show:

```text
LocalCI packaging fix       RUNNING
IBMA booking investigation QUEUED
```

## Architectural Principle

**Accepted work must never disappear into an invisible queue.**

AI may propose parallelism, and software may reduce actual concurrency, but any resulting queueing MUST be transparent to the user.
