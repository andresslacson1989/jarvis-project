# ADR-031 — Scoped, Ranked Memory Retrieval

**Status:** Approved  
**Date:** August 11, 2026

## Context

JARVIS will accumulate project knowledge, user preferences, mission history, verified results, decisions, and conversation-derived context over time. The production risk is not merely storing memory; it is retrieving the wrong memory, overloading the orchestrator with excessive historical context, or treating stale information as current truth.

## Decision

JARVIS SHALL use scoped, ranked, metadata-rich memory retrieval rather than unrestricted conversation-history retrieval or raw semantic similarity alone.

Memory retrieval SHOULD consider:

- project scope;
- mission scope;
- session/task scope;
- recency;
- semantic relevance;
- importance;
- memory type;
- confidence/provenance.

Memory records SHOULD carry structured metadata such as scope, project identifier, type, importance, confidence, timestamp, and source/provenance.

Representative memory types MAY include:

- confirmed decision;
- verified fact/result;
- known blocker;
- project fact;
- user preference;
- mission result;
- user correction;
- inference;
- temporary observation.

Confirmed decisions and verified facts SHOULD rank above weak inference.

Memory SHALL be used to recover context and intent, but live system state MUST be revalidated when the requested answer or action depends on current truth.

The orchestrator SHOULD receive only the smallest relevant memory set required for the current interaction.

## Authority Rule

For current-state questions or actions:

1. live verified system/tool state;
2. persisted confirmed/verified memory;
3. AI inference.

Live verified state takes precedence over stored memory.

## Practical Behavior

Questions such as “What did we decide?” MAY be answered from approved project memory.

Questions such as “Is that already implemented?” SHOULD trigger live verification of the repository or system state rather than relying on memory alone.

## Consequences

This reduces stale-context errors, cross-project contamination, prompt bloat, and irrelevant recall while preserving useful continuity over long-running work.