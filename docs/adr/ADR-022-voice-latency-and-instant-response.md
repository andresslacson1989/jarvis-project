# ADR-022: Voice Latency and Instant-Response Requirements

**Status:** Accepted  
**Date:** August 11, 2026  
**Applies to:** JARVIS voice subsystem, orchestrator integration, TTS/STT/VAD/wake-word providers, session manager

## Context

The JARVIS voice experience must feel immediate. A technically correct voice pipeline that waits multiple seconds before acknowledging the user will feel sluggish and will fail the intended JARVIS interaction model.

The accepted canonical voice flow is:

```text
MICROPHONE
    ↓
Audio Input Manager
    ↓
Wake Word Provider
    ↓
Voice Session Manager
    ↓
VAD Provider
    ↓
STT Provider
    ↓
JARVIS Core
    ↓
AI Orchestrator
    ↓
Response Builder
    ↓
TTS Provider
    ↓
SPEAKER
```

This ADR makes latency a first-class architectural requirement.

## Decision

JARVIS MUST optimize for perceived immediacy. Voice interaction MUST NOT be designed as a sequence of cold-start, batch-style operations.

The following principles are binding:

### 1. Local real-time path

Wake-word detection, audio buffering, VAD, priority command detection, and session-state transitions SHOULD execute locally and continuously while JARVIS is running.

These components SHOULD remain warm and ready rather than being initialized after each utterance.

### 2. Immediate acknowledgement

After the wake word is accepted, JARVIS SHOULD provide an immediate acknowledgement using a local sound cue, visual state change, or very short local TTS response.

The acknowledgement MUST NOT falsely imply task completion.

Examples:

- a short earcon;
- visual transition to LISTENING;
- a brief response such as “Yes?” where appropriate.

### 3. Latency targets

The following are design targets, not guarantees under every hardware/network condition:

- wake-word acceptance feedback: target <= 250 ms after confirmed detection;
- UI listening-state transition: target <= 100 ms after wake-word acceptance;
- priority commands such as Stop/Mute/Cancel: target <= 250 ms from reliable local recognition to action;
- VAD speech-start reaction: target <= 100 ms;
- VAD end-of-utterance decision: tuned for natural speech, with a target of roughly 250-500 ms after true speech end;
- STT should begin processing as early as practical and SHOULD support streaming/partial transcription when the selected provider permits it;
- local deterministic tool commands, once intent is known and authorization is satisfied: target perceived response <= 500 ms where the underlying OS/tool permits it;
- first TTS audio for short responses: target <= 500 ms from finalized response text where the selected provider permits it;
- AI-backed orchestration response: minimize round-trip latency, but do not block immediate local acknowledgement while waiting for the provider.

These budgets SHOULD be benchmarked on the actual development hardware and revised using measured data.

### 4. Streaming over batch processing

Where providers support it, JARVIS SHOULD prefer streaming behavior for:

- microphone capture;
- STT partial results;
- AI response events;
- TTS generation/playback.

JARVIS SHOULD begin useful downstream work before an entire upstream result is complete when doing so is safe and semantically valid.

### 5. Warm provider support

Provider contracts MUST NOT assume that every interaction is implemented by launching a fresh process.

Provider abstractions SHOULD support long-lived or warm sessions where available.

An orchestrator provider contract SHOULD be capable of expressing operations such as:

```text
startSession()
submitTurn()
streamEvents()
continueSession()
cancel()
health()
```

The initial Codex CLI adapter MAY use one-shot executions, but JARVIS Core MUST remain compatible with persistent providers, app servers, local model servers, or future long-lived AI runtimes.

### 6. Priority-command fast path

Emergency and interaction-control commands such as:

```text
stop
cancel
mute
sleep
```

SHOULD use a local fast path and MUST NOT depend on a full cloud AI round trip when they can be recognized safely and unambiguously.

### 7. TTS playback must be interruptible

TTS playback MUST support immediate cancellation.

The voice session manager MUST be able to stop speech output without waiting for the AI orchestrator.

### 8. Session continuity

After JARVIS responds, the voice session MAY remain active for a configurable short conversational window.

During that window, the user SHOULD be able to speak again without repeating the wake word.

If no further speech occurs, the session transitions back to IDLE.

### 9. Slow operations must expose progress

When an AI provider, Codex worker, network service, or external tool cannot respond instantly, JARVIS MUST remain visibly responsive.

It SHOULD:

- acknowledge the request immediately;
- transition to THINKING or WORKING;
- stream meaningful progress events where available;
- avoid repetitive verbal status chatter;
- speak only useful milestones.

### 10. Performance observability

JARVIS MUST record latency telemetry locally in developer/diagnostic mode for at least:

```text
wake_word_latency
vad_start_latency
vad_end_latency
stt_first_partial_latency
stt_final_latency
orchestrator_first_event_latency
orchestrator_completion_latency
tts_first_audio_latency
end_to_end_first_response_latency
```

Sensitive speech content MUST NOT be required for latency metrics.

## Rationale

The intended JARVIS experience depends more on responsiveness than on maximizing model sophistication for every turn. A slightly less natural voice or lower-cost model that responds immediately may provide a better experience than a higher-quality model with long pauses.

Therefore, latency is treated as an architectural property alongside modularity, security, and provider independence.

## Consequences

- Voice providers must expose cancellation and streaming capabilities where practical.
- Provider selection may consider latency in addition to quality and cost.
- Cold-start-heavy providers may be unsuitable as the default conversational provider.
- JARVIS Core must remain asynchronous and event-driven.
- Benchmarking on the target PC becomes part of voice-provider selection.
- Future local AI hardware can be adopted without changing the voice/session architecture.

## Relationship to existing decisions

This ADR complements the existing voice architecture and the modular TTS-provider decision. It does not change the provider-agnostic architecture.

It establishes one additional governing principle:

> **JARVIS must feel immediately responsive even when the underlying intelligence or worker task is not instantaneous.**
