# ADR-038 — Work Dashboard, Worker Journals, and Auditability

- Status: Approved
- Date: 2026-08-11
- Decision type: Binding architecture amendment
- Related bottleneck: #16

## Context

JARVIS will execute concurrent missions and tasks through modular workers and providers. The user needs a clear, trustworthy way to see what work is active, queued, blocked, waiting for approval, or completed, and to understand what each worker is actually doing and what it has already done.

A simple task-status list is insufficient. JARVIS needs a normalized, durable record of worker activity and outcomes so the dashboard and conversational interface can answer questions such as “What is that worker doing?” and “What did it do?” from recorded facts rather than from model reconstruction.

## Decision

JARVIS SHALL provide a live work dashboard showing all active, queued, blocked, approval-waiting, and recently completed work.

Every active worker SHALL expose a concise current-activity status so the user can determine what that worker is presently doing.

Workers SHALL maintain a durable structured work journal recording meaningful actions, findings, changes, verification results, blockers, and final outcomes.

Worker journals SHALL record observable work and results. They SHALL NOT require, capture, or expose private model reasoning or hidden chain-of-thought.

Worker/provider implementations SHALL publish normalized lifecycle and activity events through a common Worker Event Protocol. The protocol SHOULD include events such as WORK_STARTED, ACTIVITY_CHANGED, FINDING_RECORDED, ARTIFACT_CHANGED, VERIFICATION_STARTED, VERIFICATION_RESULT, BLOCKED, WAITING_FOR_APPROVAL, COMPLETED, and FAILED.

Queued tasks SHALL display their queued state and, where known, the reason they cannot yet start. This requirement extends ADR-032A Mandatory Queue Transparency.

Completed worker histories SHALL remain accessible and MAY feed JARVIS scoped project/task memory as authoritative task history.

JARVIS SHALL answer questions such as “What is that worker doing?” and “What did it do?” primarily from recorded task and worker events rather than from AI reconstruction.

## Dashboard expectations

For each task or worker session, the dashboard SHOULD expose, where applicable:

- task and mission identity;
- project and role;
- assigned worker/provider;
- current activity;
- lifecycle state;
- progress through meaningful checkpoints;
- queue reason and queue position when available;
- blockers or pending approval;
- work history;
- findings and verification results;
- changed files/resources or other concrete artifacts;
- start time, last activity, and completion result;
- pause/cancel controls where policy permits.

The default view SHOULD remain concise. Deeper task history and diagnostic detail SHOULD be available on demand.

## Auditability

JARVIS SHALL maintain structured system events covering missions, tasks, queue transitions, provider selection, permissions, tool execution, recovery, failures, and significant state changes.

Explanations of past system behavior SHOULD be grounded in recorded events and decisions rather than reconstructed solely by an AI model.

Sensitive values such as credentials, tokens, secrets, and protected authentication material MUST be redacted from logs and worker journals.

Logging SHALL be bounded by configurable retention and rotation policies.

## Product principle

At any time, the user should be able to see who is working, what they are doing, what they already did, what they are waiting for, and what happened afterward.
