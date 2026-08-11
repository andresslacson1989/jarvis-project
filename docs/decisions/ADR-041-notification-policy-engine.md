# ADR-041 — Notification Policy Engine

Status: Accepted
Date: 2026-08-11

## Context

JARVIS can receive and generate events from connected integrations, workers, deployments, calendar systems, local system state, and other modules. Without a central notification policy, the assistant could become noisy, repetitive, and disruptive.

## Decision

JARVIS SHALL use a centralized Notification Policy Engine to determine whether events are spoken, surfaced visually, grouped, deferred, or recorded silently.

Notification decisions SHOULD consider severity, source, project scope, user-configured preferences, current interaction state, actionability, duplication, and grouping.

Voice notifications SHALL be reserved for events important enough to justify interrupting the user.

Related repetitive events SHOULD be aggregated into one meaningful notification where practical.

Users SHALL be able to configure notification policies globally and per integration/project.

Critical safety or security events MAY override normal quiet policies where explicitly defined.

Routine worker activity SHALL remain available in the dashboard and worker journal without generating unnecessary interruptions.

## Recommended Priority Model

- Critical: immediate interruption; voice, UI, and system notification where appropriate.
- Important: prompt notification; UI and optional voice according to policy.
- Normal: dashboard/activity feed by default.
- Low value: recorded silently unless requested.

## Focus Modes

JARVIS SHOULD support user-selectable modes such as Normal, Work Focus, Do Not Disturb, and Critical Only. These modes adjust notification delivery without altering the underlying event and audit records.

## Principle

JARVIS should know the difference between something the user needs to hear now and something that can simply be reviewed later.
