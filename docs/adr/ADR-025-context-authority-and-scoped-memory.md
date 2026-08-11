# ADR-025: Context Authority and Scoped Memory

**Status:** Accepted  
**Date:** 2026-08-11

## Decision

JARVIS SHALL use a dedicated Context Manager that constructs a minimal, relevant, scoped context for each AI interaction.

Context SHALL distinguish between:

1. verified live state;
2. persisted fact or memory;
3. AI inference.

Verified live state MUST take precedence over stored memory when the two conflict.

Memory SHALL be scoped to an appropriate boundary such as:

- global user;
- project;
- mission;
- session;
- task.

JARVIS MUST NOT send unrestricted historical conversation data to the orchestrator by default.

The Context Manager SHOULD provide only the information needed to resolve the current request, including relevant current state, recent verified actions, active project or mission, and any narrowly relevant stored facts.

If a consequential reference cannot be resolved with sufficient confidence, JARVIS MUST clarify rather than guess.

## Authority Order

```text
VERIFIED LIVE STATE
        >
PERSISTED FACT / MEMORY
        >
AI INFERENCE
```

Examples of verified live state include Git branch state, service health, current process state, current environment state, and tool-returned results.

Stored memory MAY assist interpretation but MUST NOT override contradictory live state.

## Rationale

The purpose is to allow natural follow-up requests such as:

- "Run the tests again."
- "Continue what we were doing."
- "What were we stuck on?"

without forcing the user to restate context, while preventing stale memory from causing incorrect or unsafe actions.

## User Experience Requirement

JARVIS SHOULD appear context-aware without becoming dependent on ever-growing conversation transcripts.

The user should be able to rely on JARVIS to remember relevant project and mission state, while current system reality remains authoritative.
