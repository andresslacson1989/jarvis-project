# JARVIS Production Implementation Plan

**Status:** Execution plan derived from the v1.0 contract suite  
**Date:** August 11, 2026

This plan defines the order in which JARVIS should be implemented so that each stage produces a stable foundation for the next one. It is not a simplified MVP roadmap. Intermediate milestones are development checkpoints; the final target is the production-complete system defined by the contract suite.

---

# 1. DELIVERY STRATEGY

Implementation SHALL follow vertical, testable foundations rather than building every UI screen first or wiring unrestricted AI access early.

The order is intentionally:

```text
trust boundary
→ protocol
→ persistence
→ state machines
→ security/permissions
→ provider runtime
→ tools/projects
→ workers/graphs
→ recovery
→ credentials/modules/integrations
→ voice
→ automation/notifications
→ update/backup
→ hardening/qualification
```

Security and recovery are built into each stage rather than added at the end.

---

# 2. PHASE 0 — REPOSITORY AND TOOLCHAIN FOUNDATION

## Deliverables

- monorepo/workspace structure;
- desktop app package;
- Core service package;
- protocol/schemas packages;
- shared deterministic policy package;
- test directories;
- pinned package manager/toolchain configuration;
- TypeScript strict mode;
- Rust formatting/lint/build configuration;
- CI skeleton;
- dependency/secret scanning;
- logging bootstrap.

## Required repository shape

```text
apps/desktop
services/core
packages/protocol
packages/schemas
packages/policy
packages/shared
providers/ai
providers/speech
providers/integrations
tools
modules
tests
docs
```

## Exit criteria

- clean checkout installs/builds reproducibly;
- UI and Core compile independently;
- schema package tests run;
- CI blocks lint/type/build/test failures;
- no application logic depends on a provider vendor yet.

---

# 3. PHASE 1 — NATIVE HOST, PROCESS SUPERVISION, AND SECURE IPC

## Deliverables

- Tauri 2 shell;
- React renderer;
- Rust native host services;
- single-instance behavior;
- Node Core sidecar launch;
- unpredictable Windows named-pipe endpoint;
- bootstrap-secret handshake;
- length-framed protocol v1;
- Core heartbeat/process detection;
- Windows Job Object process containment for spawned child trees where practical;
- clean shutdown;
- forced Core-crash detection;
- locked startup screen.

## Exit criteria

- renderer cannot directly open privileged Core control channel;
- wrong handshake secret rejected;
- second instance activates existing app;
- Core crash produces degraded/recovery UI rather than desktop crash;
- app shutdown leaves no supervised child process behind;
- IPC contract tests pass.

---

# 4. PHASE 2 — PERSISTENCE, EVENTING, AND STATE MACHINES

## Deliverables

- SQLite persistence service;
- encrypted-at-rest production path design implemented early enough to avoid data migration debt;
- schema migrations;
- mission/task/attempt states;
- approval states;
- durable domain event store;
- optimistic row/version concurrency;
- artifact metadata store;
- resource/workspace lease tables;
- backup metadata;
- recovery scan framework.

## Exit criteria

- every state transition is validated;
- illegal transitions fail deterministically;
- state + causative event persist transactionally;
- forced process termination after commit does not lose authoritative state;
- schema-newer-than-binary fails closed;
- migration tests run against previous-version fixture.

---

# 5. PHASE 3 — SESSION AUTHENTICATION AND SECURITY CORE

## Deliverables

- JARVIS password setup;
- Argon2id verifier storage;
- unlock cooldown/rate limiting;
- Windows lock/sign-out integration;
- secure-store broker using Windows-protected storage;
- database encryption key management;
- privacy classifications;
- authority-envelope service;
- Permission Engine;
- approval digest/expiry/consumption;
- standing permission model;
- precedent records/matcher;
- locked-state content suppression.

## Exit criteria

- app always starts locked;
- Windows lock locks JARVIS immediately;
- password never enters logs/database as plaintext;
- locked state cannot retrieve private conversation through normal UI commands;
- destructive approval cannot be replayed or applied to changed target;
- development precedent cannot authorize production;
- security unit/property tests pass.

---

# 6. PHASE 4 — PROJECT REGISTRY, CONTEXT, AND MEMORY

## Deliverables

- project CRUD/aliases;
- environment model;
- workspace model;
- active conversational project hint;
- scoped memory service;
- memory confidence/revision model;
- Context Manager;
- live-state-over-memory authority behavior;
- conversation/message storage;
- retention controls.

## Exit criteria

- natural project aliases resolve correctly;
- consequential execution binds explicit project/workspace/environment IDs;
- active-project hint alone cannot authorize another target;
- memory retrieval respects scope/confidence;
- corrected/stale memory does not overwrite verified live state.

---

# 7. PHASE 5 — CODEX PROVIDER AND AI RUNTIME MANAGER

## Deliverables

- `AIProvider` adapter contract;
- Provider Registry/Supervisor/Router;
- Codex CLI discovery/version/auth checks;
- orchestrator profile;
- engineering worker profile;
- provider health states;
- streamed normalized events;
- structured-output validation;
- cancellation;
- timeout/retry/circuit breaker;
- provider usage accounting;
- role/capability routing.

## Exit criteria

- Core can converse through restricted orchestrator profile;
- orchestrator cannot directly get general shell;
- invalid structured output is rejected;
- Codex crash does not crash Core;
- auth-expired/model-unavailable maps to typed states;
- provider conformance suite passes;
- router can return `no compliant provider` cleanly.

---

# 8. PHASE 6 — TOOL REGISTRY AND SAFE LOCAL CAPABILITIES

## Initial tools

- project status;
- Git status/diff/log/current branch;
- open application;
- open project/folder/file;
- system status;
- run approved project tests through engineering context;
- narrow filesystem read/write operations where required.

## Deliverables

- Tool Registry;
- manifests;
- Tool Executor;
- schema validation;
- canonical target resolution;
- Permission Engine integration;
- pre/postconditions;
- idempotency semantics;
- audit events.

## Exit criteria

- every tool has schema/risk/permission/preemption metadata;
- path traversal tests pass;
- ambiguous destructive target cannot execute;
- `tool.uncertain` state works;
- tool contract suite passes.

---

# 9. PHASE 7 — TASKS, WORKERS, AND BOUNDED LOOPS

## Deliverables

- Task Manager;
- worker role registry;
- task attempts;
- worker journals;
- checkpoints;
- artifact references;
- loop iteration limits;
- no-progress detection;
- worker structured results;
- engineering worktree isolation;
- safe pause/cancel primitives.

## Exit criteria

- engineering task can inspect/edit/test a project in a bounded worker;
- worker history is visible without chain-of-thought;
- worker crash preserves prior checkpoint/artifacts;
- no-progress limit terminates/replans;
- worker cannot broaden its own authority;
- parallel writable workers never share one worktree.

---

# 10. PHASE 8 — MISSION GRAPH ENGINE

## Deliverables

- Mission Manager;
- Graph Planner;
- immutable graph versions;
- dependency types;
- fake-edge removal logic/guidance;
- fan-out/reduce/verify/synthesize pattern;
- Scheduler;
- queue transparency;
- dynamic replan requests;
- graph-revision validator;
- task result reuse/invalidation;
- mission-level verification.

## Exit criteria

- independent nodes run concurrently when resources permit;
- graph cycles rejected;
- graph revision creates versioned history;
- invalidated output cannot feed current downstream node;
- queued tasks are visibly queued;
- mission cannot complete while required node is blocked/unknown;
- end-to-end LocalCI-style engineering mission passes.

---

# 11. PHASE 9 — PRIORITY, RESOURCES, BUDGETS, AND RECOVERY

## Deliverables

- CRITICAL/HIGH/NORMAL/LOW/BACKGROUND scheduler;
- resource metadata/reservations;
- provider concurrency limits;
- preemption policies;
- PAUSING/PAUSED/RESUMING behavior;
- resource/workspace leases;
- budget thresholds/hard limits;
- usage reservations;
- recovery policies;
- startup reconciliation;
- uncertain external-action recovery.

## Exit criteria

- high-priority mission can preempt safely when needed;
- unnecessary preemption avoided when resources suffice;
- pause persists checkpoint and releases resources;
- resume verifies live state;
- hard budget prevents new metered work;
- crash/restart preserves queue;
- ambiguous destructive side effect never blindly retries.

---

# 12. PHASE 10 — CREDENTIAL BROKER, MODULES, AND CORE INTEGRATIONS

## Deliverables

- Windows secure-store credential handles;
- integration account registry;
- module manifest/install/enable/authorize/prefer/health state;
- module staging/update/rollback;
- supported catalog UI;
- provider/integration conformance harness.

## Initial production-supported integration targets

The framework SHALL support the accepted catalog families, while each adapter becomes `SUPPORTED` only when its conformance suite passes.

Practical implementation order SHOULD be:

1. local filesystem/Git;
2. GitHub;
3. Google Workspace service modules;
4. Cloudflare;
5. Microsoft 365 service modules;
6. SSH;
7. Proxmox;
8. additional supported services.

Google/Microsoft SHALL expose service capabilities independently rather than one all-powerful account switch.

## Exit criteria

- raw refresh/API tokens absent from normal DB/logs/prompts;
- integration scope revocation blocks dependent operations;
- module update rollback works;
- unsupported/unqualified module does not appear as standard supported;
- at least the release-target integration set passes full conformance.

---

# 13. PHASE 11 — VOICE FOUNDATION

## Deliverables

- audio device manager;
- microphone selection;
- push-to-talk;
- whisper.cpp STT adapter;
- Silero VAD/ONNX-compatible adapter or selected equivalent;
- TTS provider abstraction;
- persistent JARVIS voice identity;
- pre-generated exact-voice acknowledgements;
- voice state events;
- typed transcript flow.

## Exit criteria

- voice input produces final transcript reliably;
- typed input remains usable if STT fails;
- TTS failure degrades to text;
- lock prevents private voice output;
- device reconnect handled;
- local voice latency targets substantially met.

---

# 14. PHASE 12 — FULL-DUPLEX CONVERSATION

## Deliverables

- AEC provider with exact TTS render reference;
- Realtime Conversation Engine;
- semantic/physical Turn Detector;
- barge-in;
- speech interruption;
- deterministic reflex controls;
- half-duplex fallback;
- optional wake-word module interface;
- conversation session lifecycle.

## Exit criteria

- user can interrupt JARVIS while it speaks;
- stop/mute/cancel meets latency target;
- AEC double-talk qualification passes;
- stale/cancelled transcript cannot be submitted later;
- AEC failure degrades safely rather than breaking all voice.

---

# 15. PHASE 13 — EVENT GATEWAY, AUTOMATION, NOTIFICATIONS

## Deliverables

- normalized external event gateway;
- signature/auth validation adapters;
- dedup/replay protection;
- event-triggered task/mission creation;
- automation authority envelope;
- notification policy engine;
- focus modes;
- grouping/defer/silent behavior.

## Exit criteria

- duplicate event cannot duplicate consequential action;
- automation respects normal permissions/budget;
- locked session does not speak sensitive notification;
- routine worker events remain dashboard-only unless policy says otherwise.

---

# 16. PHASE 14 — BACKUP, RESTORE, DIAGNOSTICS, UPDATE

## Deliverables

- safe online database backup;
- retention policy;
- pre-migration/pre-update backup;
- restore maintenance mode;
- corruption recovery flow;
- diagnostics dashboard;
- diagnostic export/redaction;
- signed updater;
- staged activation;
- binary/schema rollback pairing;
- module update health/rollback.

## Exit criteria

- full backup/restore drill passes;
- corrupted DB enters recovery mode;
- update tamper rejected;
- simulated bad migration/startup can restore last known-good pair;
- diagnostics identify common provider/auth/database/voice failures.

---

# 17. PHASE 15 — HARDENING AND PRODUCTION QUALIFICATION

This phase is not optional polish.

Run the full `JARVIS-VERIFICATION-RELEASE-CONTRACT.md` suite:

- unit/property coverage;
- provider/tool/integration conformance;
- prompt injection;
- security/adversarial tests;
- crash/recovery matrix;
- migration/backup/restore;
- update rollback;
- provider outage;
- graph/replan;
- pause/preemption;
- budget;
- event automation;
- voice qualification;
- resource pressure;
- 24-hour idle and 8-hour mixed-workload soak;
- clean install;
- upgrade from previous production;
- release artifact signing/SBOM/provenance.

## Exit criteria

- zero open P0/P1 defects;
- no unmitigated release-blocking security failure;
- all production journeys pass;
- rollback path verified;
- Production Complete declaration generated with evidence.

---

# 18. FIRST IMPLEMENTATION SLICE

The first code slice SHOULD intentionally stop before AI autonomy.

Build and verify:

```text
Tauri/React UI
  ↓
Rust Host
  ↓
authenticated named-pipe IPC
  ↓
Node Core
  ↓
SQLite event/state engine
```

Then add locked/unlocked session state and one harmless deterministic command such as `get_system_status`.

This proves the trust boundary, protocol, persistence, events, UI projection, and shutdown/recovery model before introducing Codex.

Do not start by giving Codex a shell and building architecture around whatever happens to work.

---

# 19. ENGINEERING WORKFLOW

Significant features SHOULD use isolated branches/worktrees.

Before merge, changes SHALL include tests for modified contract behavior.

Schema/protocol changes SHALL include version/migration implications.

Security-sensitive changes SHALL include an explicit threat/failure test.

Implementation changes that contradict a contract MUST either be corrected or accompanied by an approved contract/ADR amendment. The codebase SHALL NOT silently become the new architecture merely because it was easier to implement.

---

# 20. RELEASE CHECKPOINTS

Useful internal checkpoints are:

```text
Foundation Ready
Core State Ready
Security Boundary Ready
AI Runtime Ready
Worker Runtime Ready
Mission Runtime Ready
Integration Runtime Ready
Voice Runtime Ready
Recovery/Update Ready
Release Candidate
Production Complete
```

Only the final checkpoint represents the product standard requested by the contract.

---

# 21. GOVERNING PRINCIPLE

> **Build the control plane first, then give intelligence access to it. Harden each boundary before depending on it.**

---

**END — JARVIS PRODUCTION IMPLEMENTATION PLAN**
