# ADR-037 — Durable Recovery and Safe Resume

**Status:** Approved
**Date:** 2026-08-11

## Context

JARVIS can run long-lived missions, queued tasks, active workers, and pending approvals. Application crashes, provider failures, operating-system restarts, or unexpected power loss must not erase accepted work or cause JARVIS to blindly repeat or continue consequential actions.

## Decision

JARVIS SHALL persist sufficient mission, task, queue, approval, execution, and worker-checkpoint state to recover safely after interruption.

Recovery SHALL verify live state before assuming that an interrupted external action succeeded or failed.

Each meaningful task SHALL have an explicit recovery policy. Supported policies include:

- `SAFE_TO_RETRY`
- `VERIFY_THEN_RESUME`
- `REQUIRES_USER`
- `DO_NOT_AUTO_RESUME`

High-risk and critical destructive actions MUST NOT automatically continue after an ambiguous interruption.

Queued work and pending work SHALL survive restart where technically possible and remain visible to the user. Pending approvals MAY survive restart, but consequential actions MUST be revalidated immediately before execution and stale approval MUST NOT be treated as permanent authorization.

Important worker activity SHOULD checkpoint enough durable metadata to support safe continuation, including task identity, mission identity, project, worker/provider, branch or worktree when relevant, last verified checkpoint, significant changed targets where known, and latest worker result.

Persistent state transitions SHALL use transactional storage so task, approval, execution, and result records cannot easily become partially committed or contradictory.

After recovery, JARVIS SHALL inform the user about materially interrupted, resumed, queued, blocked, uncertain, or user-action-required work.

## Recovery Principle

Memory of a task is not proof of external state. Recovery uses persisted intent and checkpoints to find the work, then live verification to determine what is true now.

## Examples

- Reading Git status: usually `SAFE_TO_RETRY`.
- Running a test suite: usually `SAFE_TO_RETRY`.
- Long code-editing work: `VERIFY_THEN_RESUME`.
- Production deployment: `VERIFY_THEN_RESUME` and potentially `REQUIRES_USER`.
- Destructive production-data deletion: `DO_NOT_AUTO_RESUME` after ambiguous interruption.

## Rationale

This preserves accepted work across crashes and reboots while preventing JARVIS from blindly replaying dangerous operations. It also complements queue transparency, context authority, validated tool execution, and the permission engine.
