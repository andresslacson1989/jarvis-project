# ADR-026 — Provider Supervisor and Failure Isolation

**Status:** Approved  
**Date:** August 11, 2026

## Decision

JARVIS SHALL use a centralized Provider Supervisor responsible for provider discovery, health, lifecycle, capability detection, failure isolation, restart policy, and approved fallback routing.

A provider failure MUST NOT crash JARVIS Core.

Provider-specific process management MUST remain inside the provider/supervisor layer.

JARVIS MUST clearly distinguish provider states including:

- READY
- STARTING
- DEGRADED
- UNAVAILABLE
- FAILED

Automatic fallback MAY occur only when it preserves user privacy, capability requirements, and configured policy.

## Scope

The Provider Supervisor applies to at least:

- AI providers;
- STT providers;
- TTS providers;
- VAD providers;
- wake-word providers;
- future local AI runtimes;
- future remote/LAN AI nodes.

Each managed provider SHOULD expose or be adapted to a normalized lifecycle covering:

- discover/install status;
- start;
- health;
- readiness;
- execute;
- cancel;
- restart;
- stop.

Providers SHOULD also advertise capabilities such as streaming, persistent sessions, interruption support, GPU usage, local/offline operation, and other provider-specific features.

## Rationale

JARVIS is intended to be production-ready and modular. Individual providers may crash, hang, update, become unavailable, or change behavior. Those failures must remain isolated from JARVIS Core.

The practical rule is:

> One broken AI or voice engine must never take JARVIS down with it.
