# ADR-029 — Persistent Human Voice and Instant Acknowledgement

**Status:** Approved  
**Date:** August 11, 2026

## Context

JARVIS must always sound like the same human-quality voice. Responsiveness must not be achieved by swapping to a perceptually different or lower-quality voice for short replies.

The user also approved using a small bank of pre-recorded responses rendered in the approved JARVIS voice for extremely common acknowledgements such as “Yes” and “Checking”.

## Decision

JARVIS SHALL maintain one persistent, human-quality voice identity across all spoken interactions.

The underlying TTS implementation remains modular and replaceable, but any provider used for normal JARVIS speech MUST meet the configured voice-identity and naturalness threshold closely enough that the user still perceives it as the same JARVIS voice.

Latency MUST NOT be reduced by switching to a lower-quality or perceptually different voice.

Immediate responsiveness MAY be provided through:

- a subtle local acknowledgement tone or earcon;
- immediate visual state changes;
- pre-recorded common acknowledgement phrases using the exact approved JARVIS voice;
- pre-generated fixed phrases using the same approved voice;
- keeping the selected TTS provider warm during an active voice session;
- streaming speech output as soon as the first synthesis segment is available.

A small acknowledgement phrase bank MAY initially include phrases such as:

- “Yes.”
- “Checking.”
- “I’m listening.”
- “One moment.”
- “Done.”

The phrase bank SHALL remain intentionally small and SHALL only contain phrases whose meaning is deterministic and safe in context.

A local acknowledgement tone or acknowledgement phrase means only that JARVIS heard the user or started processing. It MUST NOT imply task completion or success unless completion has been authoritatively verified.

If no available TTS provider can preserve the approved JARVIS voice identity adequately, JARVIS SHOULD degrade to text/UI output rather than silently substitute a substantially different voice.

## Voice Identity Separation

The logical JARVIS voice profile SHALL remain separate from the TTS provider and may include characteristics such as:

- timbre;
- accent;
- speaking rate;
- warmth;
- confidence;
- expressiveness;
- pause and cadence style.

Conceptually:

```text
JARVIS Voice Identity
        │
        ▼
TTS Provider Interface
        │
        ├── Provider A
        ├── Provider B
        └── Future Provider
```

Providers are replaceable. The JARVIS voice identity is not.

## Consequences

- JARVIS retains a stable identity even when TTS technology changes.
- Perceived responsiveness can remain near-instant through local cues and cached exact-voice phrases.
- TTS fallback becomes quality-gated rather than automatic.
- Common acknowledgements can avoid live synthesis latency entirely while still sounding exactly like JARVIS.
