# ADR-027 — Modular Acoustic Echo Cancellation and Full-Duplex Audio

**Status:** Approved  
**Date:** 2026-08-11

## Context

JARVIS is intended to support full-duplex voice interaction: it should be able to listen while speaking and allow the user to interrupt naturally. This creates a production requirement to distinguish user speech from JARVIS's own TTS audio leaking from the speakers back into the microphone.

A hard dependency on one acoustic echo cancellation implementation would make the voice stack fragile and would conflict with the project's provider-modular architecture.

## Decision

JARVIS SHALL implement acoustic echo cancellation through a replaceable audio-processing provider abstraction.

The initial recommended provider SHALL be **WebRTC Audio Processing Module (APM) using AEC3**, running locally on CPU and supplied with JARVIS speaker playback as the reference/render signal.

JARVIS Core and the Realtime Conversation Engine MUST NOT depend directly on WebRTC-specific APIs or data structures.

The normalized audio-processing contract shall conceptually accept:

```text
raw microphone audio
+
speaker reference audio
        ↓
Audio Processing / AEC Provider
        ↓
clean microphone audio
```

The provider abstraction SHOULD expose capabilities and health information including, where applicable:

- acoustic echo cancellation;
- double-talk handling;
- noise suppression;
- gain control;
- supported sample rates;
- latency characteristics;
- CPU requirements;
- readiness and health state.

The Provider Supervisor SHALL manage the lifecycle, health, restart, and approved fallback behavior of the active AEC/audio-processing provider.

## Full-Duplex Requirement

The preferred operating mode SHALL be full duplex.

While JARVIS is speaking, the microphone may remain active. The audio-processing layer SHALL use speaker-reference-aware echo cancellation before downstream VAD, barge-in detection, and streaming STT treat detected speech as user input.

Natural user speech during TTS SHOULD trigger immediate barge-in once the cleaned input indicates genuine user speech rather than speaker leakage.

Local priority commands such as `Stop` and `Cancel` SHALL remain available and SHOULD bypass remote AI reasoning wherever practical.

## Safe Fallback

JARVIS SHALL support a safe half-duplex fallback if full-duplex operation is unreliable on a particular audio configuration.

A failure or degradation of the active AEC provider MUST NOT crash JARVIS Core.

## Audio Processing Policy

JARVIS SHOULD use the minimum audio processing required for reliable full-duplex speech.

AEC3 is enabled as the initial echo-cancellation mechanism. Noise suppression and automatic gain control MAY be enabled conservatively and independently after benchmarking, because excessive processing can reduce microphone quality.

## Architectural Principle

**JARVIS owns the audio-processing capability; individual AEC/DSP engines are replaceable implementations.**

Possible future providers MAY include Windows-native audio processing or other mature AEC implementations without requiring changes to JARVIS Core.
