# JARVIS Runtime Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.md`  
**Version:** 1.0  
**Date:** August 11, 2026

---

# 1. PURPOSE

This document defines the executable runtime architecture of JARVIS: process ownership, startup/shutdown, IPC, worker/provider supervision, mission execution, scheduling, cancellation, and degraded behavior.

The purpose is to prevent the implementation from inventing these semantics ad hoc.

---

# 2. PROCESS TREE

The production process tree SHALL be equivalent to:

```text
jarvis-desktop.exe (Tauri/Rust host)
├── WebView2/React renderer
├── jarvis-core (Node.js sidecar/service process)
│   ├── provider execution requests
│   ├── task/mission runtime
│   └── integration/tool orchestration
└── native Process Broker children
    ├── Codex CLI workers
    ├── voice sidecars/providers
    ├── optional integration helpers
    └── future provider processes
```

The Rust host SHALL be the root native supervisor.

The Core SHALL NOT independently create detached process trees that cannot be terminated by the host.

Where practical, native child processes SHALL be assigned to Windows Job Objects so app shutdown/crash cleanup can terminate descendant processes reliably.

Child processes SHALL run without elevation unless a separately defined administrative capability explicitly requires elevation and passes the Permission Engine.

The normal JARVIS application SHALL NOT require Administrator privileges.

---

# 3. SINGLE INSTANCE

Only one authoritative desktop/Core pair SHALL operate against the production data directory at a time.

The Rust host SHALL obtain a single-instance lock before opening the production database/Core channel.

A second launch SHALL activate/focus the existing instance rather than starting another authoritative Core.

Recovery/maintenance tooling MAY open the data directory only under an explicit exclusive maintenance lock.

---

# 4. FILESYSTEM LOCATIONS

Mutable application state SHALL live beneath a stable per-user directory equivalent to:

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

The installed application binaries SHALL NOT rely on writing mutable state into the installation directory.

Temporary worker files SHOULD use task-scoped temporary directories and SHALL be cleaned after successful terminal completion unless retained as an artifact.

Paths stored in the database SHALL use canonical absolute Windows paths where path identity matters.

---

# 5. BOOTSTRAP SEQUENCE

Startup SHALL occur in this order:

1. acquire single-instance lock;
2. initialize crash-safe native logging;
3. establish initial JARVIS state as `LOCKED`;
4. load non-secret bootstrap settings;
5. open Windows secure-store broker;
6. verify required application files and compatible runtime prerequisites;
7. create an unpredictable per-launch Core IPC endpoint;
8. create a bootstrap authentication secret using a cryptographically secure RNG;
9. launch the Core under process supervision;
10. transfer the bootstrap secret through an inherited/anonymous secure bootstrap channel, not a command-line argument;
11. complete protocol handshake;
12. Core opens persistence and performs schema/version validation;
13. Core performs recovery scan for interrupted work;
14. start always-warm providers/services according to policy;
15. publish diagnostics/provider states;
16. render UI as operational but locked;
17. after successful session unlock, expose private state and permit authenticated commands.

If any mandatory bootstrap step fails, the UI SHALL enter an explicit recovery/diagnostics mode rather than presenting a normal ready state.

---

# 6. CORE IPC

The V1 Core transport SHALL be a Windows named pipe or equivalent non-network local IPC transport.

It SHALL NOT bind a normal localhost TCP port for its privileged control plane.

The endpoint name SHALL include a cryptographically random nonce and SHALL NOT be predictable solely from username/PID.

The host and Core SHALL authenticate during bootstrap before accepting normal messages.

The channel SHALL use framed messages:

```text
uint32_le payload_length
UTF-8 JSON payload
```

Maximum normal frame size SHALL be bounded; the default limit SHOULD be 1 MiB.

Payloads larger than the limit SHALL use an artifact/blob reference instead of increasing the control-channel limit.

Every envelope SHALL include at least:

```json
{
  "protocolVersion": 1,
  "kind": "request|response|event",
  "id": "uuidv7-or-null",
  "name": "method.or.event.name",
  "correlationId": "uuidv7",
  "payload": {}
}
```

Unknown protocol versions SHALL fail closed.

Unknown mandatory message types SHALL be rejected with a typed protocol error.

Messages SHALL be schema-validated on both sides of a trust boundary.

---

# 7. UI COMMUNICATION

React SHALL communicate with the Rust host using typed Tauri commands/events.

React SHALL NOT open the Core named pipe directly.

The Rust host SHALL proxy authorized UI requests to the Core and SHALL relay Core events to the UI.

The UI MAY maintain a read-model/cache for rendering, but authoritative mission/task/approval state remains in Core.

Optimistic UI updates SHALL NOT represent consequential operations as complete before Core confirmation.

---

# 8. NATIVE BROKER

The Rust host SHALL provide a narrow Native Broker to Core for OS-bound functions that should not be spread through Node packages.

The broker SHALL include capabilities equivalent to:

- secure secret get/put/delete by opaque handle;
- process spawn/terminate/status under supervision;
- Windows session lock state events;
- app activation/single-instance routing;
- signed updater staging/activation;
- optional native audio/device enumeration helpers;
- future privileged Windows operations exposed only as typed capabilities.

The broker SHALL NOT expose a generic `execute_any_command` operation to the orchestrator.

---

# 9. SESSION LOCK RUNTIME

Core SHALL track session trust state:

```text
LOCKED
UNLOCKING
UNLOCKED
LOCKING
```

Only the Rust host may assert Windows lock/unlock OS events.

A JARVIS password unlock request SHALL pass through the Rust host/native authentication component.

Core receives only an authenticated session-state result/token, not the stored password verifier.

On transition to `LOCKED`:

- new private conversation retrieval SHALL stop;
- new consequential tasks SHALL not start from unauthenticated input;
- sensitive notifications SHALL be suppressed/redacted;
- active background tasks MAY continue if already authorized;
- spoken output containing private data SHALL stop;
- voice reflex controls MAY remain available.

---

# 10. CORE SERVICE MODULES

Core SHALL be composed into explicit services with narrow interfaces, including at minimum:

- `ConversationService`;
- `ContextManager`;
- `MemoryService`;
- `ProjectRegistry`;
- `MissionManager`;
- `TaskManager`;
- `GraphPlanner`;
- `Scheduler`;
- `PermissionEngine`;
- `ApprovalService`;
- `AuthorityEnvelopeService`;
- `ToolRegistry`;
- `ProviderRegistry`;
- `ProviderRouter`;
- `ProviderSupervisor`;
- `WorkerManager`;
- `EventBus` / durable event publisher;
- `CredentialBrokerClient`;
- `ModuleRegistry`;
- `IntegrationRegistry`;
- `BudgetService`;
- `NotificationPolicyEngine`;
- `AutomationService`;
- `BackupCoordinator`;
- `DiagnosticsService`.

Direct imports SHALL NOT be used to bypass policy services for convenience.

---

# 11. COMMAND HANDLING PIPELINE

Authenticated text/voice input SHALL flow through:

```text
Input
  ↓
Conversation/session binding
  ↓
Context construction
  ↓
AI orchestrator or deterministic reflex path
  ↓
Structured decision validation
  ↓
Action/task/mission proposal
  ↓
Authority + permission + budget validation
  ↓
Scheduler / Tool Executor
  ↓
Observed result
  ↓
Verification
  ↓
Persisted state/event
  ↓
User response
```

No step MAY skip authorization merely because the AI response was confident.

---

# 12. REFLEX PATH

The deterministic reflex path SHALL handle low-latency controls whose semantics are already established, including at least:

- stop speaking;
- mute/unmute JARVIS audio;
- cancel current voice generation;
- push-to-talk state;
- wake/sleep/listening indicators;
- explicit task cancel/pause commands after unambiguous target resolution;
- app/session lock command.

The reflex path SHALL NOT generate substantive factual answers or infer broad user intent.

---

# 13. MISSION EXECUTION

A mission SHALL reference one active immutable graph version.

Only the Mission Manager may activate a new graph version.

Runnable tasks are nodes whose mandatory dependencies are satisfied and whose policy/precondition checks pass.

The Scheduler SHALL select runnable tasks according to:

- priority;
- dependency readiness;
- project/workspace locks;
- provider availability;
- CPU/RAM/GPU constraints;
- provider concurrency limits;
- user focus/foreground mission preference;
- budget;
- fairness/starvation prevention.

A task SHALL never start merely because an AI worker says it is ready.

---

# 14. TASK EXECUTION ATTEMPTS

Each provider/worker invocation SHALL create a `task_attempt` record.

A task MAY have multiple attempts due to retries, fallback, interruption, or verification failure.

Attempts SHALL be individually auditable.

Attempt identity SHALL NOT be reused.

A retry SHALL create a new attempt linked to the prior attempt and reason.

---

# 15. WORKER LOOP

Each AI worker SHALL implement a bounded control loop at the adapter/runtime level.

A logical iteration SHALL produce observable state equivalent to:

```text
PLAN/DECIDE NEXT STEP
ACTION REQUEST(S)
OBSERVATION(S)
PROGRESS ASSESSMENT
CHECKPOINT OR COMPLETION PROPOSAL
```

The implementation SHALL NOT require storage or exposure of private model chain-of-thought.

The worker adapter SHALL record only useful, user-auditable summaries, tool requests/results, findings, changed artifacts, and verification evidence.

Role defaults SHALL be configurable.

Recommended initial defaults:

```text
GENERALIST       max 12 iterations
RESEARCHER       max 16 iterations
SOFTWARE_ENGINEER max 20 iterations
VERIFIER         max 8 iterations
SYNTHESIZER      max 6 iterations
DATA_ANALYST     max 12 iterations
```

These are safety/resource ceilings, not targets.

A worker SHOULD finish earlier when acceptance criteria pass.

Three consecutive iterations without material progress SHOULD trigger local reconsideration and then `REPLAN_REQUESTED` or `BLOCKED` rather than continuing blindly.

---

# 16. STRUCTURED WORKER OUTPUT

Every task SHALL define an output schema when downstream automation consumes the result.

Core schemas SHOULD include reusable result types equivalent to:

```text
InvestigationResult
ImplementationResult
VerificationResult
ResearchResult
AnalysisResult
SynthesisResult
ReplanRequest
BlockedResult
```

An implementation result SHALL identify changed artifacts and verification performed.

A research result SHALL retain source/evidence references where applicable.

A verifier result SHALL identify each acceptance criterion and pass/fail/unknown evidence.

Invalid output SHALL not be silently accepted as task completion.

---

# 17. PROVIDER PROCESS SUPERVISION

Provider adapters SHALL define:

- discovery/installation check;
- version check;
- authentication check where possible;
- startup timeout;
- execution timeout policy;
- cancel semantics;
- health probe;
- capability advertisement;
- resource metadata;
- sanitized error mapping.

Provider execution SHALL be cancellable where the underlying provider permits.

If cancellation cannot be confirmed, the task state SHALL reflect uncertainty until the process is verified terminated or isolated.

The host SHALL be able to terminate the provider process tree during app shutdown.

---

# 18. RETRY AND CIRCUIT BREAKING

Retries SHALL distinguish infrastructure/transient failure from semantic/task failure.

Automatic retry MAY occur for transient failures such as startup race, temporary provider unavailability, or explicitly retryable network errors.

Consequential external tool calls SHALL not be automatically replayed unless their idempotency semantics are known.

Recommended provider circuit-breaker baseline:

- 3 consecutive infrastructure failures within a short rolling window → provider `DEGRADED`/circuit open;
- cooldown before probe;
- successful probe closes the circuit;
- repeated failure increases backoff up to a bounded maximum.

Exact time constants MAY be tuned by provider adapter, but retries MUST be bounded and observable.

---

# 19. TOOL EXECUTOR

Tools SHALL execute through a central Tool Executor.

Tool execution SHALL have an immutable `tool_execution_id` and idempotency key where supported.

The executor SHALL emit:

```text
tool.requested
tool.validated
tool.approval_required (if any)
tool.started
tool.completed | tool.failed | tool.uncertain
```

The executor SHALL distinguish:

- validation failure;
- permission denial;
- precondition failure;
- provider/tool unavailable;
- execution failure;
- postcondition failure;
- uncertain outcome.

Uncertain outcome SHALL NOT be reported as success.

---

# 20. PROCESS AND WORKSPACE CONTAINMENT

Engineering workers SHALL operate inside an explicitly resolved project workspace.

For Git repositories:

- one writable worker per working tree;
- parallel writers require isolated worktrees/branches;
- worktree creation/deletion SHALL be managed by JARVIS and journaled;
- a worker SHALL not silently change to another repository;
- repository root SHALL be canonicalized before execution.

Worker environment variables SHALL be constructed from an allowlist.

Long-lived secrets SHALL NOT be injected wholesale into worker environments.

Workers SHALL run without Administrator elevation.

Provider-native sandbox features SHOULD be enabled where compatible with the task.

The contract does not pretend that a normal user-mode CLI process is a perfect security sandbox; therefore secret minimization, workspace scoping, permission gates, process containment, and postcondition verification are mandatory defense layers.

---

# 21. PREEMPTION

A running task SHALL expose one of:

```text
PREEMPTIBLE
SAFE_POINT_ONLY
TEMPORARILY_NON_PREEMPTIBLE
```

When pause is requested:

- PREEMPTIBLE → checkpoint and pause promptly;
- SAFE_POINT_ONLY → finish/rollback current atomic unit, then checkpoint;
- TEMPORARILY_NON_PREEMPTIBLE → complete the narrow integrity-sensitive section, then checkpoint.

The user SHALL be informed when pause is delayed for integrity.

A temporarily non-preemptible region SHALL never become an excuse for indefinite execution.

---

# 22. SHUTDOWN

Normal app shutdown SHALL:

1. stop accepting new missions/tool requests;
2. stop/finish speech safely;
3. request task pause/cancel according to shutdown policy;
4. checkpoint resumable workers;
5. flush durable state/events;
6. stop provider processes;
7. terminate remaining supervised process trees after bounded grace period;
8. close database cleanly;
9. close IPC;
10. release single-instance lock.

Forced OS termination may prevent the full sequence; therefore persistence/recovery SHALL assume crashes can happen between any two steps.

---

# 23. CRASH RECOVERY

On startup, Core SHALL identify records left in transient states.

They SHALL enter `RECOVERING` before any retry/resume.

Recovery SHALL inspect:

- last durable checkpoint;
- last tool/provider event;
- external/live state if side effects may have occurred;
- workspace state;
- resource leases;
- pending approval validity;
- provider/session resumability.

Stale leases SHALL be reclaimed only after their owning process/instance is proven dead.

Tasks with ambiguous destructive/high-risk side effects SHALL move to `REQUIRES_USER`/blocked recovery rather than auto-retry.

---

# 24. DEGRADED MODES

The runtime SHALL support explicit degraded modes:

```text
CORE_READY
VOICE_DEGRADED
AI_DEGRADED
INTEGRATION_DEGRADED
RECOVERY_MODE
OFFLINE_CAPABLE_LIMITED
```

A degraded subsystem SHALL not mark unrelated healthy subsystems failed.

The UI SHALL show which capabilities remain available.

---

# 25. VOICE RUNTIME

Voice components SHALL communicate through provider abstractions and typed audio/session events.

The audio path SHALL preserve an exact speaker/TTS render reference for AEC.

The microphone SHALL remain available for barge-in during active TTS when full-duplex mode is healthy.

If AEC becomes unreliable, the voice engine MAY degrade to a safer half-duplex mode while preserving deterministic stop/mute/cancel controls.

STT/TTS provider failure SHALL not prevent typed interaction.

The voice session manager SHALL prevent stale partial transcripts from being submitted after cancel/lock/session reset.

---

# 26. PROVIDER ROUTING BOUNDARY

The planner requests capabilities. The router assigns providers.

A provider assignment SHALL be recorded at attempt start with a routing reason summary.

Fallback SHALL normally occur only after a checkpoint/safe boundary.

Replacement workers SHALL reconstruct context from authoritative task input, artifacts, checkpoints, and scoped memory—not hidden state from a prior model session.

---

# 27. RUNTIME INVARIANTS

The implementation SHALL preserve these invariants:

1. UI state cannot directly authorize execution.
2. AI output cannot directly authorize execution.
3. A queued task is not a running task.
4. A task is not completed without acceptance evidence.
5. A mission graph version is immutable after activation.
6. A worker cannot broaden its own authority envelope.
7. A provider fallback cannot weaken privacy/permission policy.
8. A destructive action cannot bypass final confirmation.
9. An uncertain external result cannot be reported as success.
10. A crash cannot silently erase accepted queued/running mission state.
11. A provider crash cannot crash Core by design.
12. A worker must be killable or isolatable by the native supervisor.
13. Secrets are not normal AI context.
14. Live verified state outranks stale persisted assumptions.

---

**END — JARVIS RUNTIME CONTRACT v1.0**
