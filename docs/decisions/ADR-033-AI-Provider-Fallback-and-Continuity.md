# ADR-033 — AI Provider Fallback and Continuity

**Status:** Approved
**Date:** 2026-08-11

## Decision

JARVIS SHALL route AI work by role and capability rather than by hard-coded provider name.

Each AI role MAY define an ordered list of approved providers. The currently preferred provider may fail, become unavailable, hit rate limits, lose authentication, or temporarily lose a required model without making the entire JARVIS system unavailable.

Automatic fallback SHALL occur only when the substitute provider satisfies all required capabilities and does not violate configured privacy, permission, security, local/cloud, or data-handling policies.

JARVIS MUST NOT silently violate `Local Only`, privacy, security, or other explicit user restrictions in order to continue a task.

Provider outages, authentication failures, rate limits, unavailable models, and similar failures SHALL be represented as explicit provider/runtime states rather than generic unclassified errors.

Local reflex controls and deterministic tools SHOULD continue to operate even when all AI providers are unavailable, where those operations do not themselves require AI reasoning.

Repeated provider failures SHALL use controlled retry/backoff behavior rather than aggressive retry loops.

## Role- and Capability-Based Routing

Provider selection SHALL be based on the capabilities required by the assigned role and task. A provider that is suitable for orchestration is not automatically suitable for software engineering, research, or another specialist role.

Example role policy:

```text
software_engineer
  1. preferred Codex provider
  2. approved alternate engineering provider
  3. approved capable local engineering provider
```

A lightweight conversational model or provider that cannot safely satisfy the requested engineering capabilities MUST NOT be treated as an equivalent substitute merely because it is available.

## Failure Handling

When a preferred provider is unavailable, JARVIS SHALL evaluate approved fallbacks against:

- required task capabilities;
- privacy and data-handling policy;
- permission policy;
- configured Local Only / Local Preferred / Cloud Preferred / Cloud Only behavior;
- resource availability;
- current provider health and authentication state.

If no approved provider can satisfy the request, JARVIS SHALL explicitly inform the user of the limitation rather than silently changing policy or pretending that an inadequate provider is equivalent.

## Continuity Principle

AI-provider failure SHALL degrade only the portions of JARVIS that require the failed intelligence capability. It SHALL NOT, by itself, bring down JARVIS Core, the realtime voice/control path, provider supervision, task tracking, or deterministic local controls.

## Rationale

JARVIS is a platform whose capabilities are owned by JARVIS, not by any single AI vendor or executable. Provider failure is therefore an expected operational state that must be isolated and handled through policy-driven fallback.

The governing principle remains:

> **AI decides. Software authorizes.**

and, for provider continuity:

> **If one approved brain is unavailable, JARVIS may use another approved brain when appropriate, but it never changes the user's rules just to keep working.**
