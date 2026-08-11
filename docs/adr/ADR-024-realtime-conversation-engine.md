# ADR-024 — Realtime Conversation Engine

**Status:** Approved  
**Date:** 2026-08-11  
**Decision Type:** Production Architecture

## Context

JARVIS voice interaction must feel natural and responsive. A simple fixed silence timeout is insufficient because users naturally pause mid-sentence, resume speaking, and interrupt the assistant while it is talking.

The desired interaction quality is similar in behavior to modern realtime voice assistants: speech-start detection is quick, end-of-turn detection is context-aware, the microphone can remain active while the assistant is speaking, and user speech can interrupt output immediately.

## Decision

JARVIS SHALL implement a full-duplex **Realtime Conversation Engine** rather than relying on VAD alone as the complete turn-management solution.

The engine SHALL combine:

- local speech activity detection;
- streaming or incremental speech-to-text where supported;
- semantic or linguistic turn-completeness signals;
- adaptive end-of-turn timing;
- voice session management;
- full-duplex microphone operation;
- barge-in/interruption handling;
- streaming or low-latency TTS output where supported.

The microphone SHALL remain capable of detecting user speech while JARVIS is speaking.

User speech detected during JARVIS output SHOULD immediately interrupt or duck the current TTS response and begin capture of a new user turn.

End-of-turn detection MUST NOT depend solely on a single fixed silence timeout.

Remote AI orchestration MUST NOT be required merely to determine whether the user has started or stopped speaking. Core turn-boundary processing SHOULD remain local and latency-sensitive.

## Initial Architecture

```text
                     MICROPHONE
                          │
                          ▼
                   Audio Manager
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
          Wake Word      VAD      Streaming STT
             │            │            │
             └────────────┼────────────┘
                          │
                          ▼
                   TURN DETECTOR
                  physical + semantic
                          │
                          ▼
                   SESSION MANAGER
                          │
                          ▼
                     JARVIS CORE
                          │
                          ▼
                  AI ORCHESTRATOR
                          │
                          ▼
                   TTS PROVIDER
                          │
                          ▼
                       SPEAKER
                          │
                          ▼
                    BARGE-IN ENGINE
```

## Provider Modularity

The Realtime Conversation Engine SHALL depend on capability interfaces rather than specific implementations.

Initial likely providers include:

- VAD: Silero VAD via ONNX Runtime;
- STT: whisper.cpp;
- TTS: modular provider selected separately;
- wake word: provider to be selected;
- semantic turn detection: implementation to be benchmarked and selected.

Future native realtime speech-to-speech or multimodal providers MAY be integrated without redesigning JARVIS Core.

## Production Principle

**JARVIS SHALL treat natural turn-taking, interruption, and low-latency conversational flow as core product behavior rather than optional voice enhancements.**

## Supersedes

This ADR supersedes any simpler proposal that would use only VAD plus a fixed/adaptive silence timeout as the complete end-of-turn strategy.
