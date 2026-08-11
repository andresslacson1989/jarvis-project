# ADR-051 — Production Implementation Contract Suite

**Status:** Accepted  
**Date:** 2026-08-11

## Context

The original `docs/JARVIS-TECHNICAL-CONTRACT.md` established a strong architectural baseline and subsequent ADRs refined voice, permissions, memory, missions, workers, providers, modules, integrations, recovery, auditability, automation, budgeting, authentication, autonomy, graph execution, graph revision, preemption, and provider routing.

However, the accumulated architecture still left implementation-critical behavior unspecified in areas such as process ownership, local IPC, authoritative state transitions, durable persistence, recovery, prompt-injection boundaries, database protection, backup/restore, update rollback, worker containment, release qualification, and production acceptance.

The project owner delegated non-critical engineering decisions to the architecture process through ADR-049 and requested a top-to-bottom implementation contract that results in a hardened, effectively working product rather than a starter application.

## Decision

JARVIS SHALL adopt the following contract suite as the canonical production implementation baseline:

- `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.md`
- `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
- `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
- `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
- `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`

The suite is normative as a whole.

The original `docs/JARVIS-TECHNICAL-CONTRACT.md` remains preserved as the architectural/historical baseline, but where the v1.0 suite is more specific, the v1.0 suite governs implementation.

Accepted prior ADRs remain the decision history and remain binding unless explicitly superseded by a later accepted ADR or a more specific v1.0 contract rule.

The production implementation SHALL use separated trust/failure domains:

```text
React/WebView UI
    ↓
Tauri/Rust native host and supervisor
    ↓
authenticated local IPC
    ↓
Node.js JARVIS Core
    ↓
scoped providers / tools / workers
```

The v1.0 suite additionally makes production readiness dependent on verified failure, recovery, security, update, backup/restore, resource-pressure, and release-qualification behavior rather than happy-path feature demonstrations.

## Key Consequences

- The React/WebView UI is explicitly unprivileged.
- The Rust host owns native lifecycle, secure storage, process containment, Windows lock integration, and Core bootstrap.
- Node Core is the authoritative orchestration runtime.
- Mission/task/attempt/approval states have explicit legal semantics.
- Mission graphs are immutable by version and dynamically revised through validated new versions.
- Worker loops are bounded and cannot self-authorize broader scope.
- External content and AI output are untrusted inputs to deterministic policy.
- Destructive/unrecoverable actions always require a bound final confirmation.
- SQLite state is transactional, migratable, backed up, recoverable, and protected at rest for production.
- Credentials remain in Windows-protected secure storage rather than normal database/prompt/log channels.
- A provider/module/integration becomes `SUPPORTED` only after conformance qualification.
- A feature is not complete until failure and recovery behavior is implemented.
- A release cannot be called Production Complete until the normative qualification suite passes.

## Implementation Governance

Engineering MAY proceed incrementally, but milestone completion SHALL NOT be confused with production completion.

When an implementation detail is not explicitly specified, it SHALL be chosen to preserve the contract invariants and existing accepted principles. Material new architecture choices SHALL be recorded through the normal ADR process.

User escalation remains governed by ADR-049.

## Governing Principle

> **Build JARVIS so the finished system is useful on the good day, controlled on the dangerous day, and recoverable on the bad day.**
