# JARVIS
## Implementation, Security, Operations & Production Contract

**Contract Version:** 1.0  
**Status:** Canonical Implementation Baseline  
**Date:** August 11, 2026  
**Primary Platform:** Microsoft Windows 11  
**Supersedes for implementation:** `docs/JARVIS-TECHNICAL-CONTRACT.md` v0.1 where this document or its normative appendices are more specific.  
**Preserves:** all accepted ADRs unless explicitly superseded by a later accepted ADR or this contract.

---

# 1. PURPOSE

This contract defines how JARVIS SHALL be implemented as a production-grade Windows AI assistant rather than a prototype, chat wrapper, or loosely connected collection of scripts.

A compliant implementation SHALL be complete enough that the remaining engineering work is ordinary implementation detail, not invention of foundational behavior.

JARVIS SHALL be designed to remain useful under real conditions including provider failure, user interruption, application restart, network loss, invalid AI output, stale external state, partially completed work, software updates, module failure, and long-running missions.

The finished system SHALL be hardened, recoverable, auditable, observable, resource-aware, modular, and explicit about uncertainty.

The governing chain is:

```text
USER INTENT
    ↓
JARVIS AI ORCHESTRATOR
    ↓
PROPOSED ACTION / MISSION PLAN
    ↓
JARVIS DETERMINISTIC CORE
    ↓
VALIDATE → AUTHORIZE → SCHEDULE → EXECUTE → VERIFY
    ↓
PROVIDER / TOOL / WORKER
    ↓
OBSERVED RESULT
    ↓
VERIFIED STATE
    ↓
USER
```

The central rule remains:

> **AI decides. Software authorizes. Software verifies.**

---

# 2. NORMATIVE DOCUMENT SET

This document is the canonical top-level implementation contract.

The following appendices are normative and are part of the same contract:

- `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
- `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
- `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
- `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`

Accepted ADRs in `docs/decisions/` and `docs/adr/` remain the decision history and SHALL be used to explain why the contract has its current shape.

If documents conflict, precedence SHALL be:

1. later accepted ADR explicitly superseding a rule;
2. this v1.0 contract and its normative appendices;
3. earlier accepted ADRs;
4. the v0.1 technical baseline.

No implementation MAY silently choose a conflicting interpretation.

---

# 3. CONTRACT LANGUAGE

`MUST`, `MUST NOT`, `SHALL`, and `SHALL NOT` are mandatory.

`SHOULD` and `SHOULD NOT` are strong defaults that require a documented engineering reason to violate.

`MAY` is optional.

A production release violating a mandatory requirement is non-compliant even if the feature appears to work during a happy-path demonstration.

---

# 4. PRODUCT DEFINITION

JARVIS is a persistent, local-first Windows AI operating companion.

JARVIS SHALL NOT be implemented as a single model session with broad shell access.

The system SHALL provide:

- natural text interaction;
- production-ready voice interaction through a replaceable local voice pipeline;
- an AI orchestrator for flexible language understanding;
- deterministic authorization and tool execution;
- durable project, task, mission, memory, and configuration state;
- bounded AI workers operating inside explicit authority envelopes;
- graph-based mission orchestration;
- task queueing, priorities, pause/resume, cancellation, recovery, and dynamic re-planning;
- provider supervision and capability-based routing;
- a supported module/integration catalog;
- secure credential handling;
- a work dashboard showing current and historical worker activity;
- local diagnostics and auditability;
- budget and usage controls;
- event-triggered automation under the same authorization rules as interactive work;
- staged, reversible updates;
- backup, restore, and migration behavior;
- explicit production acceptance gates.

The finished application SHALL be useful even when one optional subsystem is unavailable. Failure of voice, one AI provider, one integration, or one module MUST NOT crash the Core or corrupt authoritative state.

---

# 5. V1 PRODUCTION PROFILE

The V1 production profile is single-user and Windows-first.

It SHALL include:

- Tauri 2 desktop shell;
- React + TypeScript UI;
- Rust native host/supervisor;
- separate Node.js + TypeScript JARVIS Core process;
- SQLite-based durable persistence with protected-at-rest sensitive state as defined in the data/security contracts;
- Codex CLI as the initial supported AI provider;
- separate orchestrator and software-engineering worker roles;
- capability-based provider routing;
- text conversation;
- push-to-talk voice input;
- local STT;
- VAD;
- AEC-capable full-duplex conversation architecture;
- interruptible TTS using a persistent JARVIS voice identity;
- task/mission graph execution;
- worker journals and checkpoints;
- project registry and scoped memory;
- permission, authority-envelope, and approval engines;
- credential broker;
- module registry and dashboard;
- event gateway and notification policy engine;
- resource, queue, priority, and budget controls;
- backup/restore and update rollback;
- diagnostics and production verification suites.

Wake word MAY remain disabled by default until it passes the same reliability and privacy requirements as push-to-talk. The architecture SHALL support it as a local module without changing the Core contract.

Integrated browser automation, mobile clients, remote web clients, LAN AI nodes, unrestricted computer-control agents, and large mandatory local LLM inference remain deferred capabilities and SHALL NOT be required to call the V1 production profile complete.

---

# 6. REQUIRED PROCESS TOPOLOGY

JARVIS SHALL use separated trust and failure domains.

```text
┌────────────────────────────────────────────┐
│ React / WebView UI                         │
│ Unprivileged presentation layer            │
└──────────────────────┬─────────────────────┘
                       │ Tauri command/event boundary
                       ▼
┌────────────────────────────────────────────┐
│ Tauri / Rust Native Host                   │
│ single-instance guard                      │
│ OS lifecycle                               │
│ secure-store broker                        │
│ native process broker                      │
│ Windows lock integration                   │
│ Core process supervision                   │
└──────────────────────┬─────────────────────┘
                       │ authenticated local IPC
                       ▼
┌────────────────────────────────────────────┐
│ JARVIS Core — Node.js / TypeScript         │
│ authoritative orchestration runtime        │
│ missions / tasks / permissions / memory    │
│ providers / tools / scheduler / events     │
└──────────────┬──────────────┬──────────────┘
               │              │
               ▼              ▼
       AI/Voice Providers   Workers/Tools
       supervised adapters  scoped processes
```

The React/WebView layer MUST NOT:

- hold integration credentials;
- authorize tools;
- directly spawn arbitrary operating-system processes;
- directly connect to provider CLIs;
- directly mutate authoritative mission/task state;
- possess unrestricted filesystem or shell privileges.

The Rust host SHALL own native Windows trust-boundary functions and SHALL supervise the Core.

The Node Core SHALL own orchestration authority and application state transitions.

AI providers, workers, and tools SHALL remain subordinate execution components.

---

# 7. REPOSITORY AND PACKAGE BOUNDARIES

The implementation SHOULD use a monorepo with package boundaries equivalent to:

```text
apps/
  desktop/                 React UI + Tauri host
services/
  core/                    JARVIS Core
packages/
  protocol/                IPC/event contracts
  schemas/                 JSON/schema validation
  policy/                  deterministic policy primitives
  shared/                  narrow shared utilities
providers/
  ai/
  speech/
  integrations/
tools/
  windows/
  git/
  filesystem/
  projects/
modules/
tests/
  unit/
  integration/
  e2e/
  safety/
  recovery/
  performance/
docs/
```

Dependencies SHALL point inward through stable interfaces rather than importing implementation internals across package boundaries.

Provider-specific types SHALL NOT leak into mission/task/domain models.

The repository SHALL pin toolchain and dependency versions through lockfiles and checked-in configuration. Production builds SHALL be reproducible from a clean checkout plus documented external build prerequisites.

---

# 8. AUTHORITATIVE OWNERSHIP

JARVIS SHALL have one authoritative owner for every mutable domain.

The Node Core is authoritative for:

- conversations and session context after unlock;
- projects;
- memories;
- missions and graph versions;
- tasks and dependencies;
- authority envelopes;
- permission decisions;
- approvals;
- queues and priorities;
- budgets and usage accounting;
- provider routing decisions;
- module/integration logical state;
- event and automation state;
- notification policy decisions.

The Rust host is authoritative for:

- application single-instance ownership;
- Windows session lock observation;
- OS secure storage;
- native child-process containment primitives;
- desktop process lifecycle;
- bootstrap IPC establishment;
- signed updater activation at the native application boundary.

External systems are authoritative for their own live state. Persisted JARVIS state MUST NOT override verified current state when the question is whether an external fact remains true.

The authority hierarchy remains:

```text
verified live state
    > verified persisted fact
    > confirmed user memory/decision
    > inferred memory
    > AI assumption
```

---

# 9. LOCAL IPC RULE

V1 SHALL NOT expose JARVIS Core through an unauthenticated TCP/HTTP listener.

The Rust host SHALL start the Core and establish a per-launch authenticated local IPC channel using a Windows named pipe or equivalently local, non-network transport.

The endpoint SHALL use an unpredictable per-launch identifier and a bootstrap secret transferred without placing the secret in command-line arguments or normal logs.

The wire protocol SHALL be versioned, length-framed, and schema validated.

Large artifacts SHALL be referenced by bounded local artifact identifiers rather than embedded in arbitrarily large IPC messages.

A protocol-version mismatch SHALL fail closed with a clear diagnostic rather than attempting unsafe compatibility guessing.

Future remote clients SHALL require a separate authenticated remote-gateway design and SHALL NOT reuse the V1 trusted local IPC boundary unchanged.

---

# 10. SINGLE-USER SESSION TRUST

JARVIS V1 SHALL start locked.

A JARVIS session password establishes that the person issuing subsequent local text or voice commands is the authoritative user for that unlocked session.

Authentication SHALL NOT create blanket execution authority.

The unlocked user still only authorizes work through:

- the current explicit instruction;
- a previously approved standing permission;
- an explicitly configured automation;
- an already-authorized mission authority envelope.

JARVIS SHALL lock when:

- the application starts;
- the user explicitly locks JARVIS;
- the associated Windows session locks;
- Windows signs out or the user session terminates;
- an optional configured idle-lock policy triggers.

While locked, JARVIS MUST NOT disclose private conversation, memory, integration content, or sensitive worker output and MUST NOT begin new consequential work on the basis of unauthenticated voice input.

Already-authorized background work MAY continue according to its task policy, but its output SHALL remain protected until unlock.

---

# 11. AI ORCHESTRATOR CONTRACT

The orchestrator SHALL be AI-powered and SHALL interpret flexible natural language.

It SHALL receive compact, scoped context rather than unrestricted database contents or full conversation history.

The orchestrator MAY:

- respond;
- clarify;
- propose a tool call;
- propose a task;
- propose a mission;
- request approval;
- request project/context lookup;
- request safe read-only investigation;
- propose graph revision;
- propose cancellation or reprioritization.

It MUST NOT directly:

- grant permissions;
- bypass budget policy;
- create credentials;
- execute unrestricted shell commands;
- mutate mission/task state without Core validation;
- declare external work successful without verification;
- override user privacy or provider restrictions.

Structured AI decisions SHALL be parsed against strict schemas. Invalid structured output SHALL be treated as invalid input from an untrusted proposer, not as executable intent.

---

# 12. WORKER MODEL

A worker is a scoped executor, not a second JARVIS authority.

Each worker SHALL receive:

- stable task identifier;
- mission identifier if applicable;
- project/workspace identifier;
- role;
- goal;
- bounded inputs/artifacts;
- acceptance criteria;
- authority envelope;
- approved tools;
- privacy classification;
- provider/model assignment;
- iteration/time/resource/budget limits;
- checkpoint policy.

Workers SHALL operate through bounded loops.

The default logical loop is:

```text
UNDERSTAND
  ↓
PLAN NEXT USEFUL STEP
  ↓
EXECUTE
  ↓
OBSERVE
  ↓
CHECK / VERIFY
  ↓
PROGRESS?
  ├── yes → checkpoint when meaningful → continue
  └── no  → reconsider → replan request / block / fail
```

A worker SHALL stop when:

- its completion criteria are verified;
- authorization is required;
- a hard budget/resource/time/iteration limit is reached;
- no meaningful progress can be established;
- required capability becomes unavailable;
- the task is cancelled;
- the worker is paused at a safe point;
- it requests mission re-planning.

Workers SHALL NOT run unbounded autonomous loops.

---

# 13. GRAPH-ORCHESTRATED MISSIONS

Complex work SHALL be represented as a versioned directed acyclic task graph.

Graph nodes SHALL represent small jobs with explicit input, output, completion, and execution policies.

Edges SHALL represent real data/control dependencies only.

The planner SHOULD apply the fake-edge test: if Task B does not require Task A's output or completion, the dependency SHOULD NOT exist.

Independent nodes MAY execute concurrently subject to runtime resource limits.

The standard fan-out pattern SHALL be supported:

```text
           mission
              │
      ┌───────┼───────┐
      ↓       ↓       ↓
   worker   worker   worker
      └───────┼───────┘
              ↓
            reduce
              ↓
            verify
              ↓
          synthesize
```

Workers own the loop. JARVIS owns the graph. Verification decides done.

---

# 14. DYNAMIC GRAPH REVISION

Workers MAY report discoveries and emit `REPLAN_REQUESTED`, but SHALL NOT directly mutate the authoritative mission graph.

The Mission Planner MAY propose:

- adding a task;
- splitting a task;
- replacing a task;
- cancelling a not-yet-needed task;
- changing priority;
- adding/removing dependencies;
- introducing additional verification;
- rerouting remaining work.

JARVIS Core SHALL validate the proposed revision against:

- the user's goal;
- authority envelope;
- project/workspace scope;
- permissions;
- budget;
- resource availability;
- dependency integrity;
- completed artifacts;
- environment boundaries.

Each accepted revision SHALL create a new immutable graph version with recorded reason and causation.

Valid completed outputs SHALL be reused. Invalidated outputs SHALL remain in history and be explicitly marked invalidated rather than silently deleted.

The plan may change. The goal, authority, and audit trail do not change silently.

---

# 15. AUTHORITY ENVELOPE AND AUTONOMY

Every consequential task or mission SHALL have an authority envelope derived from the authenticated user's instruction and applicable standing policy.

The envelope SHALL constrain at least:

- project(s);
- workspace(s);
- target environment(s);
- allowed action classes;
- external systems involved;
- privacy/data-locality policy;
- maximum budget where metered execution is possible;
- material scope boundaries.

JARVIS MAY autonomously perform reasonable, recoverable, non-destructive subordinate actions inside that envelope.

JARVIS SHOULD use relevant prior approvals and user history as supporting evidence when deciding whether a recoverable action is likely intended.

Historical precedent is evidence, not a blank check.

Precedent SHALL be matched by relevant target, environment, action class, reversibility, and consequence. A development approval SHALL NOT silently become a production approval.

---

# 16. MANDATORY DESTRUCTIVE CONFIRMATION

Destructive, irreversible, or materially unrecoverable actions SHALL always require an explicit confirmation immediately before execution.

This rule applies even if the user's original instruction explicitly requested the destructive action.

The final confirmation SHALL identify the resolved target and consequence.

Confirmation SHALL be bound to the exact action/target materially being executed and SHALL expire rather than becoming a reusable permission token.

No AI model MAY waive this requirement.

Examples include permanent deletion, destructive production data changes without verified recovery, destructive repository operations, broad credential revocation, irreversible infrastructure changes, and equivalent actions.

---

# 17. PERMISSION ENGINE

The deterministic Permission Engine SHALL evaluate every consequential tool execution.

Risk SHALL be contextual, considering:

- action;
- target;
- environment;
- reversibility;
- breadth;
- authority envelope;
- user policy;
- historical precedent;
- external side effects;
- current system state.

Risk classes SHALL include LOW, MODERATE, HIGH, and CRITICAL.

LOW actions MAY execute automatically.

MODERATE actions MAY execute automatically when inside the authority envelope and policy permits.

HIGH actions SHALL receive stronger policy evaluation and MAY require confirmation depending on target, environment, precedent, and user policy.

CRITICAL or destructive/unrecoverable actions SHALL require the mandatory final confirmation defined above.

Credential possession SHALL never be treated as action authorization.

---

# 18. TOOL EXECUTION BOUNDARY

AI-produced tool calls and arguments SHALL be treated as untrusted proposals.

Every tool call SHALL pass:

1. tool lookup;
2. input schema validation;
3. target/context resolution;
4. precondition checks;
5. authority-envelope validation;
6. Permission Engine evaluation;
7. budget/resource validation where applicable;
8. execution through the registered adapter;
9. output schema validation;
10. postcondition verification where materially important;
11. audit/event recording.

Abstract references such as `it`, `there`, or `production` SHALL be resolved to explicit identifiers before consequential authorization.

The orchestrator SHALL NOT receive a general-purpose unrestricted `shell(command)` capability.

Shell-capable execution SHALL be confined to specialized engineering/administrative worker contexts with explicit workspace, process, permission, and secret boundaries.

---

# 19. PROVIDER ROUTING

Mission planning SHALL request a role and required capabilities, not a vendor/model.

Initial roles SHALL include at least:

- `GENERALIST`
- `SOFTWARE_ENGINEER`
- `RESEARCHER`
- `VERIFIER`
- `SYNTHESIZER`
- `DATA_ANALYST`

The runtime Provider Router SHALL choose a compliant provider/model based on:

- required capabilities;
- privacy/data locality;
- user preference;
- provider health;
- cost/budget;
- latency;
- resource availability;
- required context size;
- structured-output/tool support;
- task continuity.

A running worker SHOULD retain provider/session affinity until a safe task boundary or checkpoint.

No fallback MAY weaken a mandatory privacy, capability, budget, or permission constraint.

If no compliant provider is available, the task SHALL be blocked/unavailable rather than silently degraded to an unacceptable provider.

---

# 20. PROVIDER SUPERVISION

All AI, STT, TTS, VAD, AEC, wake-word, and future provider processes SHALL be registered with the Provider Supervisor.

Provider health states SHALL include at least:

- STARTING;
- READY;
- DEGRADED;
- UNAVAILABLE;
- FAILED.

Provider failure MUST NOT crash JARVIS Core.

The supervisor SHALL implement bounded startup timeouts, cancellation, crash detection, retry/backoff, and circuit-breaking behavior appropriate to the provider class.

Retries SHALL respect idempotency and MUST NOT blindly repeat consequential external operations whose result is uncertain.

---

# 21. RESOURCE-AWARE SCHEDULING

The runtime SHALL protect interactive responsiveness before background throughput.

Warm levels are:

**Always warm**
- Core;
- local IPC;
- audio input manager while voice is enabled;
- VAD/AEC/session reflex components as configured.

**Warm while voice interaction is active**
- STT;
- default TTS.

**On demand**
- large/premium TTS engines;
- optional local LLMs;
- vision providers;
- specialized workers.

The scheduler SHALL account for CPU, RAM, GPU/VRAM where known, provider concurrency limits, workspace locks, and metered-cost limits.

The production profile SHALL remain functional on the established 16 GB RAM / RTX 4060 development hardware without requiring a permanently loaded large local LLM.

---

# 22. PRIORITY, PREEMPTION, PAUSE, RESUME

Priority classes SHALL include CRITICAL, HIGH, NORMAL, LOW, and BACKGROUND.

A higher-priority task SHALL NOT automatically terminate lower-priority work if both can continue safely.

When preemption is required, lower-priority work SHALL reach the earliest safe interruption point, create a durable checkpoint, and release unnecessary resources.

Operations SHALL declare preemption behavior equivalent to:

- PREEMPTIBLE;
- SAFE_POINT_ONLY;
- temporarily NON_PREEMPTIBLE.

Non-preemptible regions SHALL be narrow and justified by integrity risk.

Pause preserves resumability. Cancel terminates planned continuation.

Resume SHALL verify relevant live state before relying on pre-pause assumptions.

Queue, pause, resume, priority change, and cancellation state SHALL remain visible to the user.

---

# 23. MANDATORY QUEUE TRANSPARENCY

If accepted work cannot start immediately, JARVIS SHALL tell the user that it is queued and display the queue state.

JARVIS SHALL never represent queued work as running.

If dynamic re-planning adds tasks that cannot start immediately, those tasks SHALL also appear as queued.

Queue ordering changes, resource blocks, approval waits, and provider waits SHALL be observable.

---

# 24. DURABILITY AND RECOVERY

Mission, task, queue, approval, graph, checkpoint, and execution state SHALL be durable.

A crash/reboot SHALL NOT cause JARVIS to forget accepted work or invent success/failure.

Recovery policies SHALL include equivalents of:

- SAFE_TO_RETRY;
- VERIFY_THEN_RESUME;
- REQUIRES_USER;
- DO_NOT_AUTO_RESUME.

On startup after interruption, transient work SHALL enter recovery, verify relevant live state, and then resume, retry, block, or request user action according to policy.

Destructive/high-risk work SHALL never be blindly retried after ambiguous interruption.

---

# 25. MEMORY AND CONTEXT

Memory SHALL be structured and scoped.

Scopes SHALL include:

- global/user;
- project;
- mission;
- session;
- task.

Memory types MAY include decisions, preferences, blockers, verified results, project facts, mission results, corrections, and standing rules.

Confidence states SHALL distinguish confirmed, verified, inferred, and stale information.

Conversation history SHALL NOT automatically become long-term memory.

For questions about past decisions, persisted memory is appropriate.

For questions about current external truth, live verification takes precedence.

The Context Manager SHALL build the smallest useful context package needed for each AI execution.

---

# 26. WORKER JOURNALS AND AUDITABILITY

Each worker SHALL maintain a structured Worker Journal containing observable work, not private chain-of-thought.

Events SHALL include equivalents of:

- WORK_STARTED;
- ACTIVITY_CHANGED;
- FINDING_RECORDED;
- ARTIFACT_CHANGED;
- VERIFICATION_STARTED;
- VERIFICATION_RESULT;
- BLOCKED;
- WAITING_FOR_APPROVAL;
- CHECKPOINT_CREATED;
- COMPLETED;
- FAILED.

The dashboard SHALL answer from recorded state/events:

- what is running now;
- what each worker is doing;
- what is queued;
- what is blocked;
- what requires approval;
- what a completed worker actually did.

JARVIS SHALL NOT fabricate worker history from AI reconstruction when authoritative events exist.

---

# 27. VERIFICATION AND DEFINITION OF DONE

A worker saying `done` SHALL NOT make a task complete.

Completion is a runtime decision backed by acceptance evidence.

Verification order SHOULD be:

1. deterministic checks;
2. verified live state;
3. independent specialist/AI review where judgment is required;
4. multi-agent consensus only when useful;
5. producing worker self-assessment as supporting evidence only.

Objective failing evidence overrides AI consensus.

Verification nodes SHOULD use fresh, minimal judging context rather than the producing worker's entire conversation.

A task SHALL be marked completed only when its required completion criteria pass or an explicitly defined policy allows a partial/accepted result state.

A mission SHALL be completed only when all required terminal nodes are complete, no unresolved mandatory approval/blocker remains, and mission-level acceptance criteria pass.

---

# 28. BUDGET AND USAGE POLICY

JARVIS SHALL account for metered provider usage by provider and, where practical, by project, mission, task, and worker.

The system SHALL support warning thresholds and hard limits.

A hard limit SHALL prevent new chargeable work unless the user explicitly overrides or changes policy.

The scheduler/router MAY choose a lower-cost or local compliant provider when capability, quality, privacy, and user policy are preserved.

Budget constraints SHALL NOT be silently bypassed because the planner believes more workers would be useful.

If budget/resource constraints reduce concurrency, affected tasks SHALL queue transparently.

---

# 29. CREDENTIALS AND INTEGRATIONS

JARVIS SHALL use a central Credential Broker backed by Windows-protected secure storage.

AI prompts, Worker Journals, normal logs, SQLite tables, and configuration files SHALL NOT contain raw long-lived credentials.

AI/workers SHOULD receive opaque capability/context rather than raw secrets.

Where a trusted integration/tool adapter must use a token, access SHALL be scoped to that adapter and operation as narrowly as practical.

Revocation SHALL be centralized.

Supported integrations SHALL be implemented as modules with independent service capabilities.

The official supported catalog includes the previously accepted integration families such as Google Workspace, GitHub, Cloudflare, Microsoft 365, local filesystem/Git, SSH, Proxmox, and AI providers.

A catalog entry SHALL NOT be marked `SUPPORTED` merely because an API exists. It becomes supported only after the module passes the integration conformance, security, failure, and upgrade tests defined by the release contract.

`SUPPORTED`, `INSTALLED`, `ENABLED`, `AUTHORIZED`, `PREFERRED`, and `HEALTHY` SHALL remain separate states.

---

# 30. MODULE SYSTEM

Only supported/tested modules SHALL appear as standard install/connect options by default.

Module manifests SHALL declare at least:

- stable module id;
- version;
- publisher/source;
- compatibility range;
- capabilities;
- platform requirements;
- resource requirements;
- permissions requested;
- privacy/network behavior;
- health check;
- upgrade/rollback metadata.

Installation SHALL verify trusted source, version, integrity/signature policy, compatibility, dependencies, and post-install health.

Installing a module SHALL NOT grant action authority or integration permissions automatically.

Module updates SHALL be staged, health-checked, activated at a safe lifecycle boundary, and rolled back if activation fails.

Working versions SHOULD be retained long enough for rollback.

---

# 31. EVENT GATEWAY AND AUTOMATION

External/local events SHALL enter through a central Event Gateway.

Push/webhook/subscription mechanisms SHOULD be preferred where reliable and authenticated; polling MAY be used with rate-limit-aware scheduling and backoff.

Incoming events SHALL be authenticated/validated where the source supports it, normalized, deduplicated, and made replay-safe.

An event does not bypass permissions.

An event requiring work SHALL normally create or update a tracked task/mission and SHALL pass the same authority, privacy, budget, resource, and execution controls as interactive work.

Automations SHALL have explicit trigger, scope, allowed action classes, integration/account context, and notification policy.

---

# 32. NOTIFICATION POLICY

The Notification Policy Engine SHALL decide whether an event is spoken, visually surfaced, grouped, deferred, or silent.

Severity classes SHALL include equivalents of CRITICAL, IMPORTANT, NORMAL, and LOW VALUE.

Voice SHALL be reserved for events important enough to interrupt the user.

Routine worker events SHALL remain visible in the dashboard/journal without producing repetitive spoken interruptions.

Focus modes SHALL include at least Normal, Work Focus, Do Not Disturb, and Critical Only.

---

# 33. PROJECT AND WORKSPACE ISOLATION

Every consequential task/worker SHALL bind to an explicit project/workspace and environment before execution.

Conversational `active_project` assists intent resolution but does not itself authorize execution.

Workers SHALL receive a bounded workspace envelope including project, working tree/worktree, branch, environment, task, and allowed tools.

Development, staging, and production SHALL be modeled as distinct environments.

Parallel write-capable workers SHALL NOT share one writable Git working tree. Parallel writers require isolated branches/worktrees or another explicitly safe isolation mechanism.

Read-only workers MAY share project inputs when no write race is possible.

---

# 34. VOICE CONTRACT

The canonical full-duplex voice path is:

```text
Microphone
  ↓
Audio Input Manager
  ↓
AEC Provider ← exact TTS/speaker render reference
  ↓
cleaned microphone
  ↓
VAD / Wake / Streaming STT
  ↓
Turn Detector
  ↓
Realtime Conversation Engine
  ↓
JARVIS Core / Orchestrator
  ↓
response
  ↓
TTS Provider using persistent JARVIS voice
  ↓
Speaker

Microphone remains available for barge-in while speaking.
```

Voice identity SHALL remain perceptually consistent. JARVIS SHALL NOT silently fall back to a clearly different generic voice merely to preserve speech output.

When no acceptable voice provider is available, JARVIS SHALL degrade to text/UI and explicit status rather than impersonating the configured voice poorly.

Exact-voice pre-generated acknowledgements and subtle earcons MAY provide immediate feedback but SHALL NOT falsely indicate task success.

Voice reflex operations such as stop speaking, mute, cancel, and listening indicators SHALL use the deterministic low-latency reflex path rather than waiting for full AI reasoning.

---

# 35. PERFORMANCE PRINCIPLES

Interactive responsiveness is a product requirement.

The implementation SHALL preserve the accepted voice latency targets, including near-immediate UI/listening feedback and rapid stop/mute/cancel behavior.

Routine deterministic controls SHALL NOT invoke AI unnecessarily after intent is established.

Background workers SHALL yield resources when needed to preserve conversation, UI, and safety-control responsiveness.

Performance budgets and acceptance tests are defined in the verification/release contract.

---

# 36. OBSERVABILITY AND DIAGNOSTICS

JARVIS SHALL maintain structured local diagnostics covering:

- application startup/shutdown;
- provider health;
- routing/fallback;
- mission/task transitions;
- worker lifecycle;
- tool execution;
- approvals;
- graph revisions;
- budget events;
- integration/module health;
- backup/migration/update operations;
- performance measurements;
- voice subsystem state.

Secrets and sensitive content SHALL be redacted or omitted by design, not merely by convention.

The diagnostics UI SHALL distinguish healthy, degraded, unavailable, and blocked states and SHALL identify actionable causes where possible.

---

# 37. BACKUP, RESTORE, MIGRATION, UPDATE

Production JARVIS SHALL have a tested backup/restore path before significant persistent user data is considered safe.

Automatic backups SHALL occur before database/schema migration and before app updates that can change persistent state.

Routine scheduled backups SHALL protect authoritative local state according to the data contract.

Backup integrity SHALL be verified.

Updates SHALL be versioned, signed/verified, staged, and reversible when practical.

A failed update SHALL NOT destroy the last known-working data or binary state when rollback is technically possible.

Database schema compatibility SHALL be checked before normal startup.

A binary SHALL refuse to run against a newer unsupported schema rather than guessing.

---

# 38. SECURITY MODEL

The production threat model explicitly includes:

- malicious or misleading content from web/email/files/repositories;
- prompt injection inside retrieved content;
- invalid or adversarial model output;
- compromised/unavailable external providers;
- accidental destructive user language;
- stale persisted state;
- module/update tampering;
- leaked logs;
- local process failure;
- runaway worker resource use;
- confused-deputy use of credentials.

All retrieved external content SHALL be treated as untrusted data unless a specific policy designates a narrower trusted instruction source.

Content SHALL NOT gain authority merely because an AI model read it.

Repository instruction files such as `AGENTS.md` MAY provide project-scoped engineering rules but SHALL NOT override global permission, credential, privacy, budget, or destructive-confirmation policy.

The V1 threat model does not claim protection from a fully compromised Windows administrator/kernel or from a person with physical access to an already-unlocked JARVIS/Windows session. Those are outside the V1 application trust boundary.

---

# 39. FAIL-SAFE AND DEGRADED OPERATION

JARVIS SHALL prefer explicit degraded state over fabricated continuity.

Examples:

- AI provider unavailable → deterministic controls and UI remain usable;
- STT unavailable → typed input remains usable;
- TTS unavailable → text response remains usable;
- integration auth expired → integration actions block and request re-authentication;
- database integrity problem → normal execution stops and recovery mode begins;
- verification cannot establish external success → task becomes uncertain/blocked, not completed;
- privacy-compliant provider unavailable → task blocks, not silently sent elsewhere.

JARVIS MUST NOT PRETEND.

---

# 40. IMPLEMENTATION MILESTONES VS PRODUCTION COMPLETION

Development MAY proceed incrementally, but milestone completion SHALL NOT be confused with production readiness.

A suggested implementation order is:

1. repository/toolchain/protocol foundation;
2. Rust host + secure local IPC + single-instance lifecycle;
3. Core persistence/state/event engine;
4. session unlock + permission/tool boundary;
5. text orchestrator + Codex provider;
6. project registry + memory/context;
7. task/mission graph + bounded workers;
8. worker journals/checkpoints/recovery;
9. priority/resource/budget/provider routing;
10. credential broker + module/integration framework;
11. voice pipeline and realtime interaction;
12. event gateway/automation/notifications;
13. backup/update/rollback/diagnostics;
14. security, recovery, performance, and release qualification.

No milestone by itself is the final product.

The system becomes `Production Complete` only after the release gates in the verification/release contract pass.

---

# 41. ARCHITECTURE DECISION GOVERNANCE

Non-critical engineering choices SHALL be resolved by the architecture/implementation process using this contract and recorded where material.

The user SHALL be asked only when a decision materially requires user preference/consent concerning security/trust, privacy, destructive or irreversible behavior, significant recurring cost, major product scope, or a core user-experience choice without a clearly superior engineering resolution.

The principle is:

> **Escalate product judgment. Resolve engineering judgment.**

---

# 42. PRODUCTION COMPLETION PRINCIPLE

The target is not a demo in which the happy path works once.

A production-complete JARVIS SHALL demonstrate that it can:

- start and lock safely;
- unlock and accept natural text/voice commands;
- understand project context;
- create and execute missions;
- run bounded workers;
- make useful progress without constant babysitting;
- re-plan when discoveries invalidate the original plan;
- queue transparently;
- pause/resume safely;
- recover after interruption;
- survive provider/module failure;
- protect credentials and private data;
- enforce destructive confirmation;
- respect privacy and budget limits;
- verify work before reporting completion;
- explain what workers are doing and what they did;
- update and migrate without silently losing data;
- restore from a verified backup;
- pass automated safety, recovery, security, and performance qualification.

The final standard is:

> **A capable assistant under normal conditions, a controlled system under dangerous conditions, and a recoverable system under failure.**

---

**END — JARVIS IMPLEMENTATION, SECURITY, OPERATIONS & PRODUCTION CONTRACT v1.0**
