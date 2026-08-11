# ADR-050 — Capability-Based Worker Role and Provider Routing

**Status:** Accepted  
**Date:** 2026-08-11

## Context

Mission graphs may contain heterogeneous tasks such as research, software implementation, verification, synthesis, data analysis, and general reasoning. Binding graph nodes directly to vendor/model names would make JARVIS brittle, expensive to change, and incompatible with future local or LAN AI providers.

JARVIS already separates logical roles from providers and requires provider fallback, budget enforcement, privacy modes, failure isolation, and resource-aware scheduling.

## Decision

Mission planning SHALL assign each AI task a logical worker role and required capabilities rather than a concrete provider or model.

The runtime Provider Router SHALL select the actual provider/model for a task at execution time using deterministic policy plus current runtime state.

Selection SHALL consider at least:

- required task capabilities;
- user privacy/data-locality policy;
- configured provider preferences;
- provider health and availability;
- model/provider cost and remaining budget;
- latency requirements;
- current resource/load constraints;
- required tool-use or structured-output capability;
- project/environment policy;
- task continuity and checkpoint compatibility.

Initial logical worker roles SHOULD include:

- `SOFTWARE_ENGINEER`
- `RESEARCHER`
- `VERIFIER`
- `SYNTHESIZER`
- `DATA_ANALYST`
- `GENERALIST`

The role registry SHALL remain extensible. Roles describe expected behavior and capability requirements; they do not hard-code a vendor.

Provider/model profiles SHALL advertise normalized capabilities and operational metadata sufficient for routing. Examples include coding aptitude, research/tool-use support, structured-output support, vision support, context capacity, local/cloud location, expected latency, estimated cost class, and health state.

The router SHOULD prefer the least costly compliant provider that still satisfies the task's quality, privacy, latency, and capability requirements. Lower cost SHALL NOT override required correctness, privacy, or explicit user preference.

A running worker SHOULD normally retain provider/session affinity for the duration of its active bounded loop to preserve continuity. Provider changes SHOULD occur only at safe task boundaries or after checkpointing when failure, budget, health, policy, or capability constraints require rerouting.

When rerouting an interrupted task, the replacement worker SHALL reconstruct its working context from the authoritative task definition, structured inputs, durable checkpoint, artifacts, and relevant scoped memory rather than depending on inaccessible hidden conversational state from the previous provider.

Verification SHOULD prefer deterministic or live-state checks first. When AI review is required, the verifier SHOULD be independent from the producing worker where practical and SHALL receive only the context needed to judge the result.

If no provider satisfies the task's mandatory capability, privacy, permission, or budget constraints, JARVIS SHALL mark the task blocked or unavailable rather than silently weakening those constraints.

Provider selection and fallback events SHALL be observable and auditable, including the selected role, provider/model, material routing reason, fallback reason where applicable, and relevant budget/privacy policy state without exposing secrets.

## Consequences

- Mission graphs remain stable even when providers or models change.
- JARVIS can add local AI, LAN nodes, or new CLI/cloud providers without rewriting mission logic.
- Cost optimization becomes a runtime concern rather than a planning-time vendor dependency.
- Provider failures can be recovered at checkpoint boundaries without corrupting graph state.
- Workers can be specialized while preserving a unified orchestration model.

## Governing Principle

> **The planner chooses what kind of worker is needed. The runtime chooses which compliant provider should perform the work.**
