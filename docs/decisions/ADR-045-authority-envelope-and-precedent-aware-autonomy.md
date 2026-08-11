# ADR-045 — Authority Envelope and Precedent-Aware Autonomy

**Status:** Accepted
**Date:** 2026-08-11
**Decision Type:** Binding Architecture Decision

## Context

JARVIS must be autonomous enough to complete useful work without repeatedly asking for permission for every recoverable subordinate step, while still preventing destructive, irreversible, materially unrecoverable, or scope-expanding actions from being performed without appropriate confirmation.

The authenticated session establishes that user voice/text input is authoritative, but it does not create generalized execution authority. JARVIS must infer the practical authority granted by the current instruction and relevant standing policy, while deterministic software continues to enforce hard safety boundaries.

## Decision

JARVIS SHALL operate within an **Authority Envelope** derived from the authenticated user's explicit instruction, existing standing permissions, project/task context, and approved automation policy.

Within that envelope, JARVIS MAY autonomously perform reasonable, recoverable, non-destructive subordinate actions necessary to accomplish the requested goal.

Destructive, irreversible, or materially unrecoverable actions MUST require explicit confirmation immediately before execution, even when the user's original instruction explicitly requested that destructive action.

For consequential but recoverable actions, the AI Orchestrator SHOULD determine whether additional confirmation is warranted based on:

- reversibility;
- scope;
- impact on future workflow or behavior;
- ambiguity;
- project and environment sensitivity;
- confidence that the action remains within the user's intent;
- relevant standing permissions;
- relevant prior approvals and user behavior.

JARVIS SHOULD use prior user approvals, standing permissions, corrections, and relevant historical behavior as evidence when determining whether a non-destructive action is likely authorized.

Historical precedent SHALL be matched by relevant scope, target, environment, action type, and consequence. Prior approval SHALL NOT silently create broad or unrelated authority.

Historical evidence MAY increase confidence but SHALL NOT override mandatory safety rules.

When JARVIS cannot establish sufficiently high confidence that a consequential action falls within the user's intended authority, it SHALL ask before proceeding.

## Mandatory Confirmation Boundary

The AI may judge whether a recoverable action probably requires clarification or confirmation, but deterministic software SHALL enforce mandatory confirmation for destructive, irreversible, or materially unrecoverable actions.

The AI cannot override this requirement.

## Precedent Matching

Past behavior is evidence, not a blank check.

For example, repeated approval to push feature branches may increase confidence for another feature-branch push in a similar project context, but it is weak or irrelevant precedent for pushing directly to a protected main branch or force-pushing a production branch.

Relevant historical matching SHOULD consider:

- project;
- environment;
- target;
- action type;
- consequence;
- reversibility;
- recency;
- whether the prior decision was an explicit approval, standing permission, correction, or inferred preference.

## Authority Envelope Example

A request such as "Fix the booking system" may reasonably authorize subordinate actions such as inspection, diagnosis, development-file edits, test execution, retries, and reasonable recoverable refactoring.

It does not automatically authorize unrelated project changes, production architecture replacement, destructive data operations, billing changes, or other materially scope-expanding actions.

## Governing Principles

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

> **Past approval is evidence, not a blank check.**

This decision complements the existing principles:

> **AI decides. Software authorizes. Software verifies.**
