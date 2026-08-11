# ADR-053 — JARVIS Is an AI Operating Platform, Not an LLM

**Status:** Accepted  
**Date:** 2026-08-11

## Context

The JARVIS implementation contract has grown to include orchestration, workers, memory, permissions, provider routing, security, recovery, integrations, voice, and production hardening. That breadth can create a risk of architectural drift toward rebuilding capabilities already supplied by AI providers, or toward accidentally treating JARVIS as an LLM/inference project.

The product goal is different: JARVIS is the persistent, secure, context-aware operating layer around replaceable AI intelligence providers.

## Decision

JARVIS SHALL NOT be designed or implemented as a custom large-language-model project.

JARVIS SHALL NOT, by default, build or own:

- foundation-model training pipelines;
- model pretraining infrastructure;
- tokenizer/model architecture research;
- custom transformer runtimes;
- general-purpose inference engines;
- model-weight hosting infrastructure that is unnecessary for a selected provider;
- a generic agent framework whose capabilities duplicate the selected AI provider without a concrete JARVIS product requirement.

JARVIS SHALL instead own the product capabilities that make external or local AI intelligence useful as a dependable personal assistant, including:

- user interaction and voice experience;
- persistent project, session, task, and mission context;
- scoped memory and continuity;
- mission graphs and bounded worker execution;
- deterministic authorization and risk enforcement;
- tool and integration boundaries;
- credential protection;
- provider abstraction and routing;
- resource, budget, queue, and lifecycle control;
- verification of real-world outcomes;
- auditability and worker transparency;
- recovery after interruption or failure;
- module/configuration management;
- Windows-native integration;
- production observability, diagnostics, backup, restore, and upgrades.

AI providers SHALL remain responsible for model-level reasoning and generation unless a later product requirement explicitly requires otherwise.

When an AI provider already supplies a robust capability, JARVIS SHOULD reuse that capability through a bounded adapter rather than reimplementing it merely for architectural purity.

JARVIS MAY implement deterministic support logic around an AI capability when needed for safety, reliability, persistence, cost control, portability, observability, or user experience.

Local AI support remains architecturally valid. Running a local model through a replaceable provider adapter does not make JARVIS an LLM project; JARVIS remains responsible for orchestration and product behavior while the local runtime/model remains an intelligence provider.

A proposal to build model-training, inference, or generalized agent infrastructure SHALL require a demonstrated JARVIS product need and a documented ADR showing why an existing provider or narrow adapter is insufficient.

## Practical Boundary

The intended division of responsibility is:

```text
AI PROVIDER
- language understanding
- reasoning
- code/research generation
- exploratory problem solving

JARVIS
- knows the user/project/task context
- decides which capability/role is required
- selects an approved provider
- validates and authorizes requested actions
- schedules and supervises workers
- persists checkpoints and artifacts
- verifies actual outcomes
- remembers durable decisions
- recovers after failures
- communicates clearly with the user
```

JARVIS MUST NOT duplicate intelligence merely because it can. It SHALL build only the control, persistence, security, context, workflow, integration, and user-experience layers required to turn replaceable AI intelligence into the JARVIS product.

## Consequences

- The project stays focused and implementable.
- Provider improvements directly benefit JARVIS without major rewrites.
- Engineering effort is spent on durable product differentiation rather than duplicating model infrastructure.
- Local, cloud, CLI, and future LAN AI providers remain interchangeable intelligence sources.
- The architecture can remain sophisticated without becoming an unnecessary AI research platform.

## Governing Principle

> **Do not rebuild the intelligence provider. Build the system that makes intelligence useful, safe, persistent, and dependable as JARVIS.**
