# ADR-046 — Graph-Orchestrated Missions and Bounded Worker Loops

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision scope:** AI worker workflow, mission orchestration, verification, checkpoints, parallel execution

## Context

JARVIS requires an AI-worker workflow that is autonomous enough to complete meaningful work without constant user supervision, while remaining observable, bounded, recoverable, permission-aware, and verifiable.

Useful workflow patterns include autonomous agents, iterative loops, dependency graphs, fan-out/fan-in execution, structured node outputs, independent verification, and checkpoints. These patterns are valuable, but JARVIS must adapt them to its existing architecture rather than copy them blindly.

The key architectural separation is:

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

## Decision

### 1. Mission-level work SHALL use explicit task graphs

JARVIS SHALL represent complex missions as explicit graphs composed of task nodes and real dependencies.

Each task node SHOULD define, where applicable:

- task goal;
- project/workspace binding;
- input artifacts;
- required capabilities;
- output contract;
- completion criteria;
- authority envelope;
- execution policy;
- recovery policy;
- verification requirements;
- resource/budget limits.

JARVIS Core SHALL own graph topology, dependency resolution, execution state, queueing, retries, persistence, recovery, approvals, and final mission state.

### 2. Mission planning SHOULD eliminate fake dependencies

When the Mission Planner proposes an edge between two tasks, it SHOULD determine whether the downstream task actually consumes or depends on the upstream task's output.

Dependencies that exist only because of an arbitrary human ordering SHOULD be removed so independent work can be executed concurrently.

This preserves the existing rule:

> **AI determines logical parallelism. Software determines actual concurrency.**

The Resource Manager and Worker Pool remain authoritative for actual execution concurrency.

### 3. AI workers SHALL operate through bounded autonomous loops

Within an assigned task, an AI worker MAY use an iterative loop such as:

1. understand the current task and state;
2. plan the next useful step;
3. execute through authorized tools;
4. observe the result;
5. verify progress;
6. record meaningful state and findings;
7. continue, re-plan, escalate, or terminate.

Worker autonomy SHALL remain constrained by the task's project/workspace, authority envelope, permissions, available tools, provider policy, budget, and resource policy.

### 4. Worker loops SHALL have hard termination conditions

A worker loop SHALL terminate or yield control when any applicable condition occurs:

- completion criteria are verified;
- required authorization or confirmation is reached;
- the worker becomes blocked;
- no meaningful progress is being made;
- configured iteration, time, cost, or resource limits are reached;
- the task is cancelled;
- the provider fails or becomes unavailable;
- a recovery boundary requires JARVIS Core intervention.

Unbounded autonomous loops are prohibited.

### 5. Structured task outputs SHOULD be preferred for machine-to-machine handoff

Task nodes whose outputs feed downstream nodes SHOULD use explicit structured output contracts rather than relying only on arbitrary prose or full conversation transcripts.

Examples include investigation results, implementation results, review findings, test results, deployment evidence, and verification reports.

A downstream node SHOULD receive the smallest reliable artifact set needed to perform its work.

### 6. Meaningful intermediate results SHALL be durable

Workers SHALL checkpoint enough task state to support observability, recovery, downstream handoff, and continuation without replaying the entire conversational history.

Checkpointed state SHOULD include, where relevant:

- task goal;
- completed work;
- current activity;
- decisions and findings;
- changed artifacts;
- verification state;
- blockers;
- next intended step.

These checkpoints SHALL integrate with the existing Worker Journal and durable recovery architecture.

### 7. Verification SHALL determine completion

A worker's statement that work is finished SHALL NOT by itself make a task complete.

Important tasks SHOULD use explicit verification nodes or equivalent deterministic verification gates.

Verification priority SHOULD generally be:

1. deterministic verification;
2. verified live state;
3. independent specialist review;
4. multi-agent consensus;
5. worker self-assessment.

Examples:

- compilation is verified by the compiler;
- tests are verified by the test runner;
- deployment is verified by deployment and health state;
- architecture quality may require independent AI review.

The producing worker SHOULD still self-check its work, but important acceptance decisions SHALL NOT rely solely on that self-check.

### 8. Independent verification SHOULD use fresh context where practical

When a separate AI verifier is used, it SHOULD receive the task goal, acceptance criteria, produced artifact, and necessary evidence, but SHOULD NOT automatically receive the producing worker's full reasoning transcript.

This reduces anchoring and duplicated reasoning errors.

### 9. Fan-out / reduce / verify / synthesize SHALL be a standard supported pattern

JARVIS SHALL support a standard graph pattern in which independent tasks fan out to multiple workers, results converge through deterministic or structured reduction where practical, are independently verified, and are then synthesized.

This pattern is particularly suitable for:

- research;
- code review;
- architecture review;
- diagnostics;
- comparison of alternatives;
- independent investigations.

Parallel branches remain subject to resource, budget, provider, project-isolation, and workspace-conflict rules.

### 10. Destructive actions SHALL remain outside uncontrolled worker loops

Destructive, irreversible, or materially unrecoverable operations SHALL NOT be buried inside an autonomous worker iteration.

Such actions SHALL be isolated behind explicit authorization boundaries and MUST follow the mandatory confirmation rules defined by the Permission Engine and Authority Envelope architecture.

### 11. Ambiguity handling SHALL follow JARVIS policy, not a universal “never ask” rule

Workers MAY make reasonable assumptions for low-consequence ambiguity where doing so remains within the user's authority envelope.

Consequential ambiguity, material workflow changes, destructive actions, or actions with insufficient authority confidence SHALL follow existing clarification and authorization rules.

The system SHALL NOT adopt a universal rule that workers must never ask questions.

## Standard worker lifecycle

A typical worker task therefore follows this conceptual sequence:

```text
TASK ASSIGNED
     ↓
UNDERSTAND
     ↓
PLAN NEXT STEP
     ↓
EXECUTE
     ↓
OBSERVE
     ↓
CHECK / VERIFY
     ↓
DONE?
 ├── YES → emit structured result + evidence
 └── NO
      ↓
meaningful progress?
 ├── YES → checkpoint + next iteration
 └── NO  → re-plan / block / escalate
```

## Standard mission pattern

```text
                      MISSION
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
      Worker A        Worker B       Worker C
          │              │              │
          └──────────────┼──────────────┘
                         ↓
                       REDUCE
                         ↓
                       VERIFY
                         ↓
                     SYNTHESIZE
                         ↓
                  VERIFIED COMPLETE
```

## Consequences

This architecture gives JARVIS autonomous workers without allowing autonomous workers to become the orchestration system themselves.

It supports:

- parallel execution where dependencies permit;
- reliable worker-to-worker handoff;
- bounded cost and runtime;
- durable recovery;
- meaningful dashboard visibility;
- independent verification;
- explicit approval boundaries;
- modular AI providers;
- deterministic completion where objective checks exist.

## Governing principles

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **The AI controls exploration. JARVIS controls the workflow.**

This decision extends and must remain consistent with the existing JARVIS principles:

> **AI decides. Software authorizes. Software verifies.**
