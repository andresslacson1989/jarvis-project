# ADR-021 — Modular Text-to-Speech Provider Architecture

**Status:** Accepted  
**Date:** August 11, 2026  
**Applies To:** JARVIS Technical Architecture & Development Contract v0.1  
**Decision Type:** Binding architecture amendment

## Context

JARVIS voice output must remain adaptable as local speech synthesis technology improves. The project must not couple JARVIS Core, the desktop UI, the AI orchestrator, missions, or conversation logic to a single TTS engine such as Piper, Kokoro, Fish Audio, F5-TTS, Windows speech, or any future provider.

This follows the same architectural principle already established for AI agents and AI providers: capabilities belong to JARVIS; concrete providers are replaceable implementations.

## Decision

Text-to-speech providers SHALL be modular and replaceable.

JARVIS Core MUST interact with speech synthesis only through a normalized TTS provider contract.

No TTS implementation SHALL become architecturally synonymous with JARVIS voice output.

The initial or default TTS provider MAY change over time without requiring changes to JARVIS Core, the desktop UI, orchestration logic, mission management, conversation state, or permission systems.

## Required Provider Abstraction

A provider contract SHOULD expose capabilities conceptually equivalent to:

```typescript
interface TTSProvider {
  id: string;

  health(): Promise<TTSProviderHealth>;

  capabilities(): Promise<TTSCapabilities>;

  voices(): Promise<TTSVoice[]>;

  synthesize(
    request: TTSRequest
  ): AsyncIterable<TTSAudioEvent>;

  stop(executionId: string): Promise<void>;
}
```

The exact TypeScript API may evolve, but the architectural boundary MUST remain.

## Normalized TTS Request

A TTS request SHOULD be provider-independent and capable of carrying fields such as:

```text
text
voice profile
language
speaking rate
style / expression hints
streaming preference
latency preference
quality preference
conversation / turn identifier
```

Provider-specific options MUST remain inside provider adapters or optional provider metadata rather than leaking throughout JARVIS Core.

## Normalized TTS Events

Streaming providers SHOULD emit normalized events such as:

```text
tts.started
tts.audio_chunk
tts.completed
tts.stopped
tts.error
```

This permits the desktop UI, audio output layer, interruption logic, and conversation lifecycle to work independently of the selected TTS engine.

## Provider Candidates

Possible providers include, but are not limited to:

- Kokoro;
- Fish Audio / Fish Speech;
- F5-TTS;
- Piper;
- Windows speech technologies;
- future local neural TTS engines;
- future GPU/NPU-native speech engines;
- optional cloud TTS providers.

Listing a provider here does not make it mandatory or preferred permanently.

## Provider Selection

JARVIS MAY eventually select TTS providers dynamically according to capabilities and preferences such as:

```text
naturalness
latency
time-to-first-audio
streaming support
interruptibility
voice-cloning support
VRAM / RAM usage
CPU usage
language support
privacy
local/offline availability
licensing
```

A future Voice Runtime Manager MAY choose the provider automatically.

Example:

```text
JARVIS Core
     │
     ▼
Voice Runtime / TTS Manager
     │
     ├── Kokoro
     ├── Fish Audio
     ├── F5-TTS
     ├── Windows TTS
     └── Future Provider
```

## Voice Identity Is Separate From Provider

The logical JARVIS voice identity SHOULD be separated from the TTS engine.

A voice profile may describe:

```text
voice identity
language
accent
speaking rate
pitch preference
tone
style
expressiveness
```

The provider adapter shall map this logical profile to the closest supported provider-specific configuration.

This allows JARVIS to retain a consistent voice identity even when the underlying synthesis engine changes.

## Local-First Policy

The existing contract rule remains in effect: local speech synthesis SHOULD be preferred where practical to avoid recurring audio API cost and improve privacy.

Cloud TTS MAY be supported as an optional provider but SHALL NOT be required for normal JARVIS operation.

## Streaming and Interruption

Providers intended for conversational use SHOULD support streaming where practical.

The voice runtime MUST be capable of stopping active playback independently of the TTS provider so that commands such as `Stop` or user barge-in can terminate speech immediately.

Provider selection SHOULD favor low time-to-first-audio as well as naturalness; realism alone is not sufficient for a responsive assistant.

## Failure and Fallback

TTS provider failure MUST NOT crash JARVIS Core.

The runtime MAY fall back to another configured TTS provider if permitted by user privacy and provider-selection policy.

Example:

```text
Preferred local TTS unavailable
        ↓
Fallback local TTS available
        ↓
Use fallback
```

Cloud fallback MUST NOT occur when the current policy requires local-only speech processing.

## Architectural Consequence

The voice subsystem SHALL follow the same core philosophy as the AI subsystem:

> JARVIS owns the capability. Providers are replaceable implementations.

This decision supersedes any interpretation of Contract v0.1 Section 39 that would imply Piper, Windows speech, or any other individual TTS engine is permanently preferred or coupled to JARVIS.

## Contract Register

This document constitutes **Decision 021** for the JARVIS architecture:

**Decision 021 — Text-to-speech engines are modular providers behind a normalized JARVIS voice interface. Voice identity and conversation logic must remain independent of the selected TTS implementation.**
