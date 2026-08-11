# JARVIS Runtime Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`  
**Version:** 1.0.2  
**Date:** August 11, 2026

---

# 1. PURPOSE

This document defines executable runtime ownership: production packaging, Tauri/WebView operation, startup/shutdown, IPC, provider/worker/module process supervision, delegated engineering execution, scheduling, cancellation, recovery, and degraded operation.

---

# 2. PROCESS TREE

Production is equivalent to:

```text
jarvis-desktop.exe (Tauri/Rust host)
├── WebView2 / React bundled-local renderer
├── application-owned Node.js JARVIS Core
└── Rust Native Process Broker managed jobs
    ├── Codex / AI worker processes
    ├── voice/STT/TTS/AEC helpers when separate
    ├── integration helpers
    ├── EXTERNAL_MANAGED modules
    └── typed tool helper processes
```

Rust is the native root supervisor. Node Core owns authoritative application state/policy. Managed children do not become independent authorities.

The normal app runs non-elevated. A narrowly defined capability requiring elevation needs its own contract/PermissionEngine path; ordinary provider/worker execution does not inherit elevation.

---

# 3. APPLICATION-OWNED CORE PACKAGING

Production SHALL package one qualified release unit containing:

```text
Rust/Tauri host
React/WebView application
JARVIS Core application
Node.js runtime
protocol/schema compatibility metadata
required native assets
```

Rust SHALL launch Core from the exact active release-owned path. It SHALL NOT locate `node`, `node.exe`, or an unrelated developer runtime through PATH/registry/shell discovery.

The release declares the exact Node version/architecture. End users do not run `npm install`, `pnpm install`, or similar dependency installation during normal first launch/startup.

The host constructs an explicit Core environment and removes/controls execution modifiers such as `NODE_OPTIONS` and `NODE_PATH` unless JARVIS intentionally supplies them.

Core working directory and immutable runtime/resource paths are explicit. Mutable data lives under the JARVIS user data directory.

Missing/corrupt/incompatible runtime produces typed repair/recovery state such as:

```text
CORE_RUNTIME_MISSING
CORE_RUNTIME_INTEGRITY_FAILED
CORE_RUNTIME_INCOMPATIBLE
CORE_ENTRYPOINT_MISSING
CORE_START_FAILED
CORE_PROTOCOL_INCOMPATIBLE
```

No system-runtime fallback is permitted.

---

# 4. SINGLE INSTANCE AND DATA DIRECTORY

One authoritative desktop/Core pair operates against one production data directory.

Rust obtains the single-instance/native ownership lock before Core opens authoritative state. A second launch activates/focuses the existing instance.

Mutable application state is rooted under a stable per-user location equivalent to:

```text
%LOCALAPPDATA%\JARVIS\
  data\
  backups\
  logs\
  cache\
  artifacts\
  modules\
  updates\
  recovery\
```

Maintenance/recovery access requires an exclusive maintenance lock.

---

# 5. TAURI/WEBVIEW RUNTIME BOUNDARY

The authoritative JARVIS UI SHALL be bundled/local application content, not a privileged browser for arbitrary remote sites.

Production configuration SHALL:

- define explicit Tauri capability allowlists per window/WebView;
- grant no privileged command/plugin capability to remote origins;
- enable restrictive CSP;
- avoid remote executable JavaScript/CDN dependencies by default;
- block unexpected navigation of the privileged WebView;
- open ordinary external links outside that WebView;
- render untrusted HTML/Markdown as sanitized inert content;
- disable production devtools except a separately gated developer/diagnostic build policy;
- use a release-qualified Tauri/runtime version with relevant upstream security fixes.

React communicates only through typed Tauri commands/events. It never opens the Core named pipe directly.

UI caches/read models are non-authoritative. Optimistic UI never represents consequential work as complete before Core confirmation.

---

# 6. BOOTSTRAP SEQUENCE

Startup SHALL occur in this order:

1. acquire single-instance ownership;
2. initialize crash-safe native diagnostics;
3. set application session state `LOCKED`;
4. load/validate non-secret bootstrap configuration and active Release Profile;
5. open native Windows secure-store broker;
6. verify signed release/runtime manifest and packaged Core/runtime integrity;
7. create unpredictable local Core IPC endpoint with restrictive security descriptor;
8. generate cryptographically random per-launch bootstrap secret;
9. create the required Windows Job Object containment for Core;
10. launch Core using the exact application-owned runtime path and controlled environment;
11. transfer bootstrap material through an inherited/anonymous secure channel rather than command-line/log output;
12. complete authenticated protocol handshake;
13. Core opens persistence and validates SQLite/SQLCipher build, WAL/safety settings, schema, and recovery state;
14. Core scans transient task/tool/provider states for recovery;
15. discover/qualify configured providers/integrations/modules;
16. publish diagnostics/degraded states;
17. render operational but locked UI;
18. after native session authentication succeeds, permit authenticated user commands.

Failure of a mandatory step produces explicit recovery/diagnostic state rather than a false ready state.

---

# 7. PRIVILEGED CORE IPC

V1 uses a Windows named pipe or equivalent non-network local transport. It SHALL NOT expose the privileged Core control plane on ordinary localhost TCP/HTTP.

Named-pipe requirements:

- explicit `SECURITY_DESCRIPTOR` / restrictive DACL;
- current intended JARVIS logon/session identity as primary interactive principal;
- only narrowly required OS principals in addition;
- no `Everyone`, anonymous, unrelated session/user, or network-origin access;
- local-only/remote-client rejection;
- unpredictable per-launch endpoint name;
- independent bootstrap authentication;
- framed bounded protocol.

Normal framing:

```text
uint32_le payload_length
UTF-8 JSON payload
```

Default normal frame ceiling SHOULD be 1 MiB; large data uses artifact references.

Every message uses protocol-major 1 and runtime schema validation. Unsupported protocol or security establishment fails closed.

OS object security is defense layer one; bootstrap authentication and schema/protocol validation remain independent layers.

---

# 8. NATIVE PROCESS/CREDENTIAL BROKER

The Rust host exposes narrow typed native capabilities such as:

- secure secret put/get/rotate/delete by opaque handle and scoped requesting context;
- managed process spawn/terminate/status;
- Windows session lock events;
- app activation/single-instance routing;
- signed update staging/activation;
- native audio/device helpers where appropriate;
- future privileged Windows operations only through explicit typed capabilities.

There is no generic `execute_any_command` broker operation for the orchestrator.

Secure-store requests use resolved requesting component/capability context. Raw secret enumeration is not a normal Core/provider API.

---

# 9. MANDATORY WINDOWS JOB OBJECT CONTAINMENT

Every JARVIS-managed executable process tree on supported Windows 11 SHALL be assigned to an explicitly owned Job Object hierarchy unless a narrow separately documented/verified incompatibility meets the approved exception criteria.

Covered processes include Core, AI/provider workers, engineering workers, voice helpers, integration helpers, EXTERNAL_MANAGED modules, and tool helpers.

Requirements:

- `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` or verified equivalent for subtrees that terminate with JARVIS;
- host retains controlling handles;
- creation-time job assignment is preferred; otherwise create suspended, assign before untrusted code executes, then resume;
- ordinary breakaway flags are prohibited;
- handle inheritance defaults to none and uses an explicit allowlist where required;
- containment-establishment failure blocks consequential child start rather than silently launching uncontained;
- cancellation escalates cooperative request → bounded grace → job/subtree termination → termination verification.

Job Objects provide lifecycle/resource containment and accounting. They do **not** prove filesystem, network, credential, or same-user memory isolation.

---

# 10. CORE SERVICES

Core SHALL have explicit owning services equivalent to:

```text
ConversationService
ContextManager
MemoryService
ProjectRegistry
MissionManager
TaskManager
GraphPlanner
Scheduler
PermissionEngine
ApprovalService
AuthorityEnvelopeService
ToolRegistry / ToolExecutor
ProviderRegistry / ProviderRouter / ProviderSupervisor
WorkerManager
EventBus / durable event publisher
CredentialBrokerClient
ModuleRegistry
IntegrationRegistry
BudgetService
NotificationPolicyEngine
AutomationService
BackupCoordinator
DiagnosticsService
```

Direct imports/calls SHALL not bypass owning policy/state services for convenience.

---

# 11. INPUT/COMMAND PIPELINE

Authenticated text/voice work flows through:

```text
input/session binding
→ scoped context construction
→ AI orchestrator or deterministic reflex path
→ structured decision validation
→ task/mission/tool proposal
→ execution-scope + canonical-target resolution
→ authority envelope
→ deterministic PermissionEngine
→ locality/budget/resource/precondition checks
→ scheduler/tool/integration adapter
→ observed outcome
→ postcondition/verification
→ transactional state/event
→ user-visible result
```

No AI confidence or provider capability skips a deterministic gate.

---

# 12. DETERMINISTIC REFLEX PATH

Low-latency reflexes may handle established commands such as:

- stop speaking;
- mute/unmute;
- cancel current voice generation;
- push-to-talk state;
- lock;
- unambiguous task pause/cancel after target resolution.

The reflex path does not generate substantive factual answers, broaden authority, authorize tools, or invent completion.

---

# 13. DELEGATED WORKSPACE ENGINEERING PROFILE

A shell-capable AI engineering provider is a delegated executor, not a collection of JARVIS typed tools.

Before launch Core SHALL resolve:

- `PROJECT_WORKSPACE` scope and exact assigned worktree;
- worker role/attempt identity;
- immutable authority envelope;
- data policy;
- provider/version/profile;
- approved sandbox mode;
- resource/time/iteration limits;
- network policy;
- secret/capability inputs.

V1 `WORKSPACE_ENGINEERING` defaults:

```text
workspace writes:    allowed only inside assigned writable worktree under qualified sandbox
workspace reads:     required
other-user-file read isolation: not claimed unless provider/OS conformance proves it
network:             denied by default
integration secrets: none by default
external side effects: not delegated
admin/elevation:     prohibited by default
```

The provider may run local development commands required to inspect/edit/build/test the assigned project according to the qualified sandbox profile.

The existence of Git/GitHub/SSH/cloud/Proxmox client binaries inside the worker process does not authorize external writes. Push, publish, deploy, email/send, infrastructure mutation, credential administration, and similar consequential remote operations SHALL cross a registered JARVIS tool/integration/PermissionEngine boundary.

Provider-native sandbox behavior is tested as an actual technical boundary. Prompt text such as “stay in the project” is not a sandbox.

---

# 14. PROVIDER DISCOVERY, COMPATIBILITY, AND SUPERVISION

Every provider adapter defines discovery, exact version identity, authentication state, compatibility policy, startup timeout, execution timeout, cancel semantics, health probe, capability/locality/resource metadata, output normalization, sanitized errors, and process containment behavior.

States distinguish compatibility from health:

```text
NOT_DETECTED / VERSION_UNKNOWN / VERSION_UNSUPPORTED /
CONFORMANCE_UNQUALIFIED / COMPATIBLE

STARTING / READY / DEGRADED / UNAVAILABLE / FAILED
```

A provider becomes production `SUPPORTED` only when the selected version/range has release-time conformance evidence and runtime identity/health/auth/capability checks pass.

A newly released provider version outside the qualified policy is not optimistically trusted.

For Codex, the V1 adapter SHALL prefer the qualified stable non-interactive/structured interface rather than scraping an interactive TUI. Its Windows sandbox conformance tests SHALL observe actual write/network restrictions and SHALL not claim workspace-only read isolation unless technically proven.

Provider self-update invalidates cached compatibility until revalidated.

---

# 15. PROVIDER SESSION RESUME

Provider session/conversation resume handles are optional optimizations.

Durable recovery state belongs to JARVIS:

```text
task input + acceptance criteria
authority/scope/data policy
checkpoint summaries
artifacts/worktree state
tool/audit results
verification state
live-state assumptions
remaining work
```

Recovery first loads/reconciles JARVIS-owned state. It may attempt provider resume only after compatibility/auth/privacy/authority checks. Resume failure falls back to a fresh provider session reconstructed from durable JARVIS state.

No completion evidence may exist only inside an inaccessible provider session.

---

# 16. WORKER LOOP AND CHECKPOINTS

Worker loops are bounded and emit observable progress equivalent to:

```text
plan/next step
→ action request(s)
→ observation(s)
→ progress assessment
→ checkpoint/completion proposal/replan/block
```

No private chain-of-thought is required or persisted.

Recommended initial iteration ceilings remain:

```text
GENERALIST        12
RESEARCHER        16
SOFTWARE_ENGINEER 20
VERIFIER           8
SYNTHESIZER        6
DATA_ANALYST      12
```

Three consecutive no-material-progress iterations SHOULD cause reconsideration then `REPLAN_REQUESTED`/`BLOCKED` rather than blind continuation.

---

# 17. TOOL EXECUTION

All JARVIS typed tools execute through ToolExecutor.

Before consequential execution it SHALL:

1. resolve tool/version/schema;
2. validate scope and canonical target/account/environment;
3. evaluate manifest preconditions;
4. apply authority/PermissionEngine/approval/locality/budget/resource rules;
5. build/recompute the canonical action descriptor where approval-bound;
6. re-resolve mutable live target state;
7. use conditional/versioned mutation when supported;
8. execute the registered adapter;
9. validate output;
10. evaluate postconditions;
11. record durable audit/state/events.

Conditional mutation includes mechanisms such as ETag/If-Match, expected Git ref/SHA, filesystem identity/hash, provider version/generation tokens, or equivalent compare-and-set behavior.

A precondition/version mismatch is not silently retried against changed state. It returns to resolution/authorization/approval as required.

Unverifiable consequence is `UNCERTAIN`.

---

# 18. MISSION GRAPH AND SCHEDULER

A mission points to one active immutable graph version. Only owning mission services activate validated graph revisions.

Scheduler considers:

- priority/dependency readiness;
- execution-scope/workspace/resource leases;
- provider compatibility/health/locality/concurrency;
- CPU/RAM/GPU pressure;
- foreground interaction/voice responsiveness;
- exact budget reservations;
- fairness/starvation prevention.

AI determines logical parallelism; deterministic scheduling determines actual concurrency.

Parallel writable engineering tasks never share one worktree.

---

# 19. PAUSE, PREEMPTION, RESUME

Preemption policy is exactly:

```text
PREEMPTIBLE
SAFE_POINT_ONLY
TEMPORARILY_NON_PREEMPTIBLE
```

Temporary non-preemptibility is narrow/bounded and cannot deny cancellation indefinitely.

Task pause uses:

```text
RUNNING → PAUSING → PAUSED
PAUSED → RESUMING
RESUMING → RUNNING | QUEUED | BLOCKED | RECOVERING | FAILED | CANCELLED
```

`RESUMING` verifies live/external state, execution scope, workspace/resource leases, provider capability/version/health/locality, budget, approvals, and relevant preconditions before new execution.

---

# 20. BUDGET ADMISSION

Before new chargeable work subject to a hard monetary budget, BudgetService atomically evaluates:

```text
settled spend
+ outstanding reservations
+ requested reservation
<= applicable hard limit
```

Only after reservation commit may the metered attempt start when a monetary reservation can be determined.

Provider-reported usage/quota facts retain provenance and may differ from local estimates. Unknown values remain unknown rather than fabricated as zero.

If actual cost exceeds reservation, the actual provider-reported/settled cost is recorded; a hard budget is an admission-control guarantee, not a promise that an external invoice can never exceed an estimate.

---

# 21. CRASH RECOVERY

Startup identifies transient mission/task/attempt/tool/provider states and enters `RECOVERING` before retry/resume.

Recovery examines:

- last checkpoint/event;
- process death/Job Object cleanup;
- workspace/resource leases;
- execution scope and authority envelope;
- current provider compatibility/auth/locality;
- approval expiry/digest/current target;
- budget reservations;
- live external state when side effects may have occurred.

Stale leases are reclaimed only after ownership is proven dead or policy permits it.

Ambiguous consequential/destructive side effects are never blindly replayed. They become `UNCERTAIN`/blocked/`REQUIRES_USER` according to recovery policy until live state is reconciled.

---

# 22. SHUTDOWN

Normal shutdown SHALL:

1. stop admitting new consequential work;
2. stop/finish speech safely;
3. request worker/task pause/cancel according to policy;
4. checkpoint resumable work;
5. flush authoritative state/events;
6. request provider/module/helper cooperative shutdown;
7. after bounded grace, terminate remaining managed jobs/subtrees;
8. verify intended child termination;
9. close persistence/IPC;
10. release instance ownership.

Crash semantics assume termination can occur between any two steps.

---

# 23. INTEGRATIONS AND PROXMOX RUNTIME

Integration requests use typed registered adapters and Credential Broker handles; they do not execute arbitrary endpoint strings from AI output.

The V1 Proxmox adapter uses HTTPS REST API as the normal control path. It SHALL:

- verify TLS/system trust or configured SHA-256 pin;
- resolve connection/environment/resource identity before consequential work;
- enforce connection capabilities and node/VMID/pool scopes;
- keep raw token out of AI/UI/journals/logs;
- track asynchronous Proxmox task identifiers through terminal outcome;
- re-resolve live target state before consequential execution;
- use provider-supported conflict/precondition semantics where available;
- return `UNCERTAIN` rather than blind replay after ambiguous writes;
- never silently fall back to SSH/`qm`/`pct`/`pvesh`/root shell/direct `/etc/pve` editing;
- keep guest OS access a separate connection/authority domain.

---

# 24. MODULE RUNTIME

Every module is `DATA_ONLY`, `BUILT_IN_TRUSTED`, or `EXTERNAL_MANAGED`.

`DATA_ONLY` never causes embedded executable content to run.

`BUILT_IN_TRUSTED` is first-party executable code shipped/qualified as part of the signed JARVIS release.

`EXTERNAL_MANAGED` runs out of Core through versioned typed IPC under a capability envelope and its own supervised process/Job Object boundary. It cannot receive Core database handles, blanket secure-store access, or arbitrary direct authoritative-state mutation.

Typed health checks are supervisor mechanisms, not arbitrary manifest commands.

Module crash degrades the module, not Core.

---

# 25. VOICE RUNTIME

Canonical voice path:

```text
Microphone
→ Audio Input Manager
→ AEC Provider ← exact TTS render reference
→ cleaned microphone
→ VAD / optional Wake / streaming STT
→ physical + semantic Turn Detector
→ Realtime Conversation Engine
→ Core / Orchestrator
→ interruptible TTS persistent voice
→ Speaker
```

Full-duplex keeps microphone available for barge-in when AEC is healthy. AEC failure may degrade to half-duplex without losing deterministic stop/mute/cancel.

Stale/cancelled transcripts cannot submit after cancel/lock/session reset.

Speech provider routing obeys the same DataLocality policy as AI providers.

---

# 26. DEGRADED MODES

Runtime exposes explicit states equivalent to:

```text
CORE_READY
VOICE_DEGRADED
AI_DEGRADED
INTEGRATION_DEGRADED
RECOVERY_MODE
OFFLINE_CAPABLE_LIMITED
```

Failure of one optional/degraded subsystem does not fabricate failure/success in another. UI states what remains usable and why capabilities are blocked.

---

# 27. RUNTIME INVARIANTS

1. UI state cannot authorize execution.
2. AI output cannot authorize execution.
3. Provider native capability cannot widen JARVIS scope.
4. A queued task is not running.
5. A task is not completed without acceptance evidence.
6. Activated mission graph versions are immutable.
7. A worker cannot widen its authority/scope.
8. Provider fallback cannot weaken locality/permission/budget/security policy.
9. Destructive execution cannot bypass final confirmation.
10. Uncertain external result is not success.
11. Crash cannot silently erase accepted queued/running mission state.
12. Managed executable trees are OS-contained/owned or blocked.
13. Job Objects are not represented as filesystem/network sandboxing.
14. Production Core does not depend on system Node.
15. Privileged Core IPC is restrictive local-only + authenticated.
16. `PAUSED` work does not resume execution without durable `RESUMING` validation.
17. Non-project tasks do not gain fake project authority.
18. Delegated engineering shell cannot directly gain consequential integration authority.
19. Provider resume metadata is not task durability.
20. External conditional-write conflicts cause reconciliation rather than silent retargeting.

---

**END — JARVIS RUNTIME CONTRACT v1.0.2**
