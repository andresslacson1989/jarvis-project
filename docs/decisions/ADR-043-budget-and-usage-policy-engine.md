# ADR-043 — Budget and Usage Policy Engine

**Status:** Accepted
**Date:** 2026-08-11

## Context

JARVIS may use multiple chargeable AI providers, paid APIs, and concurrent workers. Without deterministic usage controls, autonomous orchestration could unintentionally exceed expected spend, quota, or provider limits.

## Decision

JARVIS SHALL maintain centralized provider usage, quota, and budget controls for chargeable services.

Usage SHOULD be attributable to provider, model, project, mission, and worker where practical.

Users SHALL be able to configure warning thresholds and hard spending or usage limits at appropriate scopes, including global, provider, project, mission, and worker/concurrency policy where applicable.

AI orchestration SHALL NOT bypass configured budget or quota policy.

When configured limits reduce available concurrency, affected work SHALL be queued or rerouted according to approved provider fallback policy. If work is queued, JARVIS SHALL follow the existing mandatory queue-transparency requirement and inform the user that the work is queued and why.

Reaching a hard limit SHALL prevent new chargeable work unless the user explicitly authorizes an override or changes the governing policy.

JARVIS SHOULD prefer an approved lower-cost or local provider when doing so preserves the required capabilities, privacy constraints, permissions, and quality requirements.

Where reliable pre-execution cost estimates are unavailable, JARVIS SHALL still enforce runtime ceilings and SHALL stop launching additional chargeable work when a configured hard limit is reached.

The dashboard SHALL expose understandable current usage, quota state, warning thresholds, hard limits, and relevant attribution by project/provider where practical.

## Threshold Behavior

JARVIS SHALL support at least the following usage states:

- **NORMAL** — work continues within policy.
- **WARNING** — work may continue, while the user is notified and the dashboard surfaces the approaching limit.
- **HARD LIMIT** — new chargeable work is blocked until policy is changed or an explicit authorized override is granted.

## Architectural Principle

AI may determine that additional workers or higher-capability providers would be useful, but deterministic software controls the actual paid concurrency and spend.

This extends the existing rule:

> AI determines logical parallelism. Software determines actual concurrency.

with the additional constraint:

> Software also enforces cost and quota boundaries.

## Consequences

- Autonomous operation cannot silently exceed configured spending or usage limits.
- Provider and project costs become observable and attributable.
- Resource and cost policy can reduce concurrency without changing mission logic.
- Local or lower-cost fallback remains possible only when capability, privacy, and quality requirements remain satisfied.
- Budget enforcement integrates with queue transparency, provider fallback, the worker dashboard, and the audit/event system.
