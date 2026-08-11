# ADR-023 — Dual-Path Responsiveness Architecture

**Status:** Approved  
**Date:** 2026-08-11  
**Applies To:** Voice interaction, orchestration, session control, provider runtime behavior

## Context

JARVIS must feel immediately responsive even when the configured AI orchestrator is remote or slower than local control logic. A production-ready design must avoid making all user interaction dependent on round-trip AI latency while also avoiding a brittle hardcoded voice-command system.

## Decision

JARVIS SHALL use a dual-path responsiveness architecture consisting of:

1. a deterministic local reflex path for time-critical, unambiguous controls and state transitions; and
2. an AI reasoning path for natural-language understanding, contextual interpretation, and substantive responses.

The local path is not a second AI brain.

## Local Reflex Path

The local reflex path MUST be able to operate without contacting the AI orchestrator.

It MAY handle only actions whose meaning and effect are sufficiently deterministic, including:

- wake-word acknowledgement;
- session open/close state transitions;
- listening-state feedback;
- stop speaking;
- cancel current action where locally cancellable;
- mute/unmute JARVIS;
- sleep;
- push-to-talk state;
- acknowledgement tones or fixed acknowledgement phrases;
- immediate interruption of TTS.

The local fast path MUST NOT manufacture substantive answers, infer uncertain intent, invent task results, or claim success before a deterministic tool or subsystem has verified success.

## AI Reasoning Path

Requests requiring interpretation, context, project resolution, reasoning, memory, delegation, or uncertain intent SHALL be sent to the configured AI orchestrator provider.

Examples include:

- “Let’s work on IBMA.”
- “Open the project we used yesterday.”
- “Check why LocalCI is failing.”
- “Have Codex fix it.”
- “What were we doing before?”

## Acknowledgement Behavior

JARVIS MAY provide an immediate neutral acknowledgement when a request is expected to take noticeably longer than a direct local action.

Acknowledgements MUST mean only that the request has been received and processing has started.

They MUST NOT imply completion or success.

Examples:

- “Checking.”
- “I’m on it.”
- a short acknowledgement sound;
- immediate UI state change.

JARVIS SHOULD avoid unnecessary spoken acknowledgements for actions that complete quickly.

## Provider Runtime Requirement

The orchestrator abstraction MUST NOT architecturally require launching a completely new provider process for every utterance.

Provider implementations SHOULD support warm, persistent, resumable, or session-oriented execution where the provider permits it.

The architecture MUST be able to accommodate:

- one-shot Codex CLI execution;
- persistent Codex sessions;
- Codex App Server or equivalent long-lived interfaces;
- other AI CLIs;
- local model servers;
- LAN/remote JARVIS AI nodes.

## Responsiveness Requirement

The user interface, voice session manager, and local reflex path MUST remain responsive while AI providers or workers are busy.

Time-critical controls such as wake acknowledgement, stop, cancel, mute, sleep, listening-state transitions, and TTS interruption MUST NOT wait for a remote AI round trip.

## Production Principle

JARVIS SHALL behave as though it has local reflexes and remote or provider-based reasoning:

- reflexes react immediately;
- reasoning may take longer;
- the user must always receive prompt, truthful feedback about system state.

## Future Extension

A future local AI provider MAY accelerate common natural-language intents, but V1 SHALL NOT require a second local AI model solely to implement the fast path.

If local AI is later added, it MUST remain behind the provider abstraction and MUST NOT blur the deterministic safety boundary of the reflex path.
