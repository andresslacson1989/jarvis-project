# JARVIS
## Implementation, Security, Operations & Production Contract

**Contract Version:** 1.0.2  
**Status:** Canonical Implementation-Locked Baseline  
**Date:** August 11, 2026  
**Primary Platform:** Microsoft Windows 11  
**Adopted by:** ADR-069

---

# 1. PURPOSE

This contract defines how JARVIS SHALL be implemented as a production-grade Windows AI operating companion rather than a prototype, chat wrapper, or loosely connected collection of scripts.

A compliant implementation SHALL remain controlled, truthful, recoverable, and observable under provider failure, user interruption, crash/restart, network loss, invalid AI output, stale external state, resource pressure, update/migration failure, and adversarial input.

The governing chain is:

```text
USER INTENT
    ↓
AI ORCHESTRATOR
    ↓
PROPOSED ACTION / MISSION PLAN
    ↓
DETERMINISTIC JARVIS CORE
    ↓
VALIDATE → RESOLVE → AUTHORIZE → SCHEDULE → EXECUTE → VERIFY
    ↓
PROVIDER / TOOL / WORKER / INTEGRATION
    ↓
OBSERVED RESULT
    ↓
VERIFIED STATE
    ↓
USER
```

> **AI decides. Software authorizes. Software verifies.**

---

# 2. ONE CURRENT NORMATIVE SUITE

The current production contract consists of this file plus:

- `docs/JARVIS-V1-RELEASE-PROFILE.md`;
- `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`;
- `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`;
- `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`;
- `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`;
- `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`;
- `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`;
- `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` as authoritative dependency sequencing and exit criteria.

These documents SHALL use the same v1.0.2 semantics and vocabulary.

ADRs preserve rationale/history. They are not a normal override layer. A future architecture change is incomplete until all affected current normative files are updated synchronously.

Earlier contracts under `docs/history/` are non-normative.

---

# 3. CONTRACT LANGUAGE

`MUST`, `MUST NOT`, `SHALL`, and `SHALL NOT` are mandatory.

`SHOULD` and `SHOULD NOT` are strong defaults requiring a documented engineering reason to deviate.

`MAY` is optional.

Unknown/ambiguous security-critical interpretation SHALL fail closed rather than choose a permissive meaning.

---

# 4. PRODUCT DEFINITION

JARVIS is a persistent, local-first Windows AI operating companion.

V1 SHALL provide:

- natural text interaction;
- production voice interaction through replaceable local-first providers;
- AI orchestration for flexible language understanding;
- deterministic authorization and typed tool/integration execution;
- durable project, memory, mission, task, approval, budget, event, and recovery state;
- bounded AI workers and graph-based missions;
- dynamic graph revision through validated immutable graph versions;
- queueing, priority, pause/resume/cancel/recovery;
- provider supervision, compatibility qualification, and capability-based routing;
- secure credentials and integration boundaries;
- worker journals/work dashboard without private chain-of-thought;
- exact budget/usage accounting;
- event-triggered automation under normal authorization;
- encrypted backup/restore and staged reversible updates;
- production diagnostics and qualification evidence.

JARVIS SHALL NOT be implemented as a single LLM session with broad shell access or as a custom foundation-model project.

---

# 5. REQUIRED PROCESS TOPOLOGY

```text
React/WebView UI — unprivileged presentation/control surface
       ↓ typed Tauri boundary
Rust Native Host — OS trust, secure store, process broker, IPC bootstrap, updater
       ↓ ACL-restricted + authenticated local IPC
Node/TypeScript Core — authoritative orchestration/state/policy runtime
       ↓
scoped Providers / Tools / Workers / Integrations / Managed Modules
```

The Rust host is authoritative for native Windows lifecycle/security primitives. Node Core is authoritative for mutable application/domain state and policy decisions. External systems are authoritative for their live external state.

The React/WebView layer SHALL NOT hold long-lived credentials, authorize tools, spawn arbitrary native processes, connect directly to privileged provider CLIs, or mutate authoritative mission/task/approval state.

---

# 6. TAURI/WEBVIEW SECURITY BOUNDARY

The authoritative production JARVIS WebView SHALL load bundled/local JARVIS UI content rather than arbitrary remote application pages.

Production SHALL require:

- explicit Tauri capability allowlists for each privileged window/WebView;
- no privileged native capability granted to remote origins;
- restrictive CSP enabled and maintained;
- no remote executable JavaScript/CDN dependency in the privileged WebView by default;
- unexpected navigation blocked;
- ordinary external links opened outside the privileged JARVIS WebView;
- untrusted HTML/Markdown rendered as sanitized inert content;
- production devtools disabled unless a separately gated developer/diagnostic build policy enables them;
- Tauri/runtime versions qualified for relevant upstream security fixes.

Renderer compromise SHALL not directly expose secure-store, process-broker, arbitrary filesystem, or Core authorization primitives.

---

# 7. APPLICATION-OWNED CORE RUNTIME

Production JARVIS SHALL ship the Node.js runtime and prebuilt Core application as one release-owned, version-pinned unit.

Rust SHALL launch the exact verified application-owned runtime path. Production SHALL NOT silently fall back to `node.exe` found through PATH, developer tooling, or another machine-local installation.

The Core launch environment SHALL be explicitly constructed and shall neutralize user-controlled Node execution modifiers such as `NODE_OPTIONS`/`NODE_PATH` unless intentionally supplied by JARVIS.

Missing/corrupt/incompatible packaged runtime enters repair/recovery; it does not trigger an unqualified runtime fallback.

---

# 8. AUTHORITATIVE OWNERSHIP

Node Core owns:

- session application state after native authentication result;
- projects/workspaces/environments/execution scopes;
- memories/conversations;
- missions/graph versions/tasks/attempts;
- authority envelopes, PermissionEngine decisions, approvals;
- queues, priorities, budgets, usage/reservations;
- provider routing logical state;
- module/integration logical state;
- event/automation/notification policy.

Rust host owns:

- single-instance/native lifecycle;
- Windows lock observation;
- Windows secure storage;
- named-pipe security/bootstrap;
- native process/job containment;
- signed updater activation.

Authority ordering is:

```text
verified live state
> verified persisted fact
> confirmed user decision/memory
> inferred memory
> AI assumption
```

---

# 9. SESSION TRUST

JARVIS starts locked. Session password verification uses Argon2id or an equivalently strong memory-hard verifier and is independent of database/integration keys.

Unlock proves who may issue authoritative local commands; it does not grant blanket action authority.

JARVIS locks on startup, explicit lock, Windows session lock/sign-out, and configured idle policy.

V1 SHALL NOT claim hard isolation from arbitrary malicious code already executing with an equivalent same-user Windows security context, Administrator/kernel compromise, or physical control of an already-unlocked session.

Session-password recovery SHALL NOT use a weak Windows-only bypass. A verified JARVIS portable recovery factor may establish an explicit password-reset/recovery workflow. Without an applicable recovery factor, the verifier is not reversible. Clean-machine portable restore establishes a new session password after successful state recovery.

---

# 10. EXECUTION SCOPES

Every executable task carries exactly one discriminated scope:

```text
PROJECT_WORKSPACE
INTEGRATION
SYSTEM
GLOBAL
```

`PROJECT_WORKSPACE` is required for repository/filesystem project mutation.

`INTEGRATION` binds explicit integration/account/capability identities and does not invent filesystem authority.

`SYSTEM` contains only registered local-system capabilities.

`GLOBAL` grants no filesystem/integration/system capability by itself.

A provider's native OS capability never broadens the JARVIS scope.

---

# 11. WORKERS AND DELEGATED ENGINEERING EXECUTION

A worker is a scoped executor, not a second JARVIS authority.

Workers receive task/mission identity, execution scope, authority envelope, bounded context/artifacts, acceptance criteria, role, provider assignment, tools, data policy, resource/budget ceilings, and checkpoint policy.

Shell-capable software engineering workers operate under the V1 `WORKSPACE_ENGINEERING` delegated profile:

- JARVIS assigns the exact project/worktree;
- writes are limited to the assigned writable workspace by the qualified provider/OS sandbox where supported;
- provider/native read access outside the workspace is **not** claimed to be impossible unless conformance proves it;
- delegated network access is denied by default and may be enabled only by an explicit qualified policy;
- unrelated secrets/credentials are not placed in the worker environment/context;
- external consequential actions such as GitHub push, deploy, Proxmox change, email/send, or cloud mutation are not delegated merely because a shell/client binary exists;
- those operations return through registered JARVIS tools/integrations and PermissionEngine.

Windows Job Objects provide lifecycle/resource containment, not filesystem/network security isolation.

---

# 12. AUTHORITY ENVELOPE AND DETERMINISTIC PERMISSION ENGINE

Every consequential execution is constrained by an immutable authority envelope derived from authenticated user instruction and standing policy.

PermissionEngine SHALL apply this decision precedence:

1. mandatory system safety/security invariant;
2. explicit applicable `DENY`;
3. session/automation eligibility;
4. authority-envelope scope/action containment;
5. required capability/target/account/environment checks;
6. data locality, budget, resource, precondition, and integrity checks;
7. authority established by the current explicit instruction;
8. matching standing permission;
9. required HIGH/CRITICAL approval/final-confirmation rule;
10. `ALLOW` only if every prior gate permits it.

Mandatory safety invariants and explicit DENY dominate grants.

Historical precedent may help interpret LOW/MODERATE reversible subordinate work or suggest a standing permission. It SHALL NOT independently authorize HIGH/CRITICAL actions, expand environment/account scope, or waive approval/final confirmation. AI confidence SHALL NOT be an authorization input.

---

# 13. TOOL EXECUTION AND TARGET RACES

AI-generated tool requests are untrusted proposals.

Consequential execution SHALL pass tool/version lookup, schema validation, scope/target resolution, canonicalization, preconditions, authority/permission, locality/budget/resource gates, registered adapter execution, output validation, postconditions, and audit recording.

Process exit code alone does not prove semantic success unless the tool contract explicitly establishes that equivalence.

Unknown outcome becomes `UNCERTAIN`.

Immediately before consequential execution JARVIS SHALL re-resolve mutable target state. Where the external system supports conditional mutation, adapters SHALL use expected-version, ETag/If-Match, expected ref/hash/generation, or equivalent compare-and-set semantics. A precondition mismatch triggers re-resolution/re-authorization/re-approval as applicable rather than mutating changed state or blindly retrying.

---

# 14. APPROVALS AND DESTRUCTIVE CONFIRMATION

Destructive, irreversible, or materially unrecoverable actions always require final explicit confirmation immediately before execution, even if the original user instruction requested the destructive action.

Approval binds to one `CanonicalActionDescriptorV1` using:

```text
schema validation
→ RFC 8785 JCS canonical JSON
→ UTF-8
→ SHA-256
→ base64url without padding
```

The descriptor includes all material tool/action/scope/target/account/environment/argument/policy identity and excludes raw secrets and incidental UI/runtime metadata.

Material change invalidates the approval. Approval is short-lived and single-use. Consumption is transactionally protected against replay/double-use.

No model may waive this boundary.

---

# 15. MISSIONS, TASKS, PAUSE, AND RECOVERY

Complex work is represented as immutable-versioned DAGs. Workers may request replanning but cannot mutate the active graph directly.

Task state includes durable `RESUMING`. A paused task must enter `RESUMING`, revalidate live state, scope, provider/locality, budget, leases, and preconditions, then transition to RUNNING/QUEUED/BLOCKED/RECOVERING/FAILED/CANCELLED as appropriate.

Accepted work, queue state, checkpoints, graph versions, approvals, and recovery state are durable.

Provider session-resume handles are optional continuity optimizations. JARVIS-owned checkpoints/artifacts/state are the durability source of truth.

Ambiguous destructive/high-risk side effects are never blindly retried after crash/timeout.

---

# 16. PROVIDERS

Provider roles are capability-based, not vendor/model hardcoded.

`SUPPORTED` requires exact executable/runtime identity, version compatibility policy, release-time conformance evidence, current health/authentication, and required capability availability.

Installed/launchable does not mean supported.

Codex CLI is the initial required AI provider family. JARVIS SHALL use a qualified stable structured/non-interactive surface rather than parsing transient TUI presentation when a structured surface exists.

Provider fallback may never weaken locality, capability, permission, budget, or security requirements.

---

# 17. PROCESS CONTAINMENT

Every JARVIS-managed executable child tree SHALL be assigned to an explicitly owned Windows Job Object containment hierarchy on supported Windows 11 unless a narrow documented/verified incompatibility has an approved equivalent lifecycle mechanism.

Kill-on-close semantics are mandatory for subtrees that must terminate with JARVIS. Ordinary breakaway is prohibited. Handle inheritance defaults to none/explicit allowlist.

Failure to establish required containment blocks consequential child execution rather than silently launching uncontained.

---

# 18. DATA POLICY AND EXACT MONEY

Canonical data policy is:

```text
DataSensitivity: PUBLIC | PRIVATE | SENSITIVE | SECRET
DataLocality:    LOCAL_ONLY | ANY_APPROVED_PROVIDER
```

`SECRET` is reserved for credentials/key material and normally remains in secure storage or transient trusted adapter memory.

Derived content inherits the strictest applicable policy unless deterministic audited declassification/export explicitly changes it.

Authoritative monetary state uses `MoneyAmount { currency, nanoUnits }`, where `nanoUnits` is a canonical signed base-10 integer string representing major currency units × 1,000,000,000. Binary floating point is forbidden for authoritative budget limits, reservations, settlement, and remaining-budget decisions.

Provider-reported quota/cost facts and JARVIS local budget policy remain distinct with provenance.

---

# 19. SQLITE/SQLCIPHER PERSISTENCE

SQLite/SQLCipher is the V1 authoritative durable state store.

Production SHALL use WAL on a qualified local filesystem unless an explicit qualified alternative is adopted. The embedded SQLite core SHALL include the upstream WAL-reset corruption fix. WAL activation, foreign keys, connection initialization, bounded busy handling, checkpoint health, and authoritative `synchronous=FULL` policy are verified rather than assumed.

Authoritative state transitions and their causative durable events are transactional. External side effects use attempt/uncertain/recovery semantics rather than pretending SQLite and remote services share one transaction.

---

# 20. BACKUP AND PORTABLE RECOVERY

The live database uses a random local `DB_DEK` protected by Windows secure storage.

Every backup package uses an independent random 256-bit backup DEK and authenticated encryption. Backup classes are at least:

```text
LOCAL_RECOVERY
PORTABLE_STATE
```

A database backup snapshot SHALL be encrypted under a backup-specific snapshot database key rather than requiring the historical live `DB_DEK` on a clean machine. The snapshot key record exists only inside the authenticated encrypted backup payload.

The backup DEK is protected by key slots:

- local current-user DPAPI slot for local recovery;
- Argon2id/passphrase portable slot for `PORTABLE_STATE` (and optionally both slots).

Clean-machine restore is:

```text
portable recovery factor
→ unwrap backup DEK
→ authenticate/decrypt package
→ obtain snapshot database key transiently
→ open/integrity-check SQLCipher snapshot
→ restore
→ generate fresh local DB_DEK
→ re-key restored database
→ protect new DB_DEK with new Windows profile secure storage
```

Ordinary backups exclude raw long-lived integration credentials. Restored integrations without credentials become `REAUTH_REQUIRED`.

Portable recovery is not considered configured/verified until its portable key slot and clean-profile restore path have been qualified.

---

# 21. MODULES

Every module is exactly one execution class:

```text
DATA_ONLY
BUILT_IN_TRUSTED
EXTERNAL_MANAGED
```

There is no untrusted in-process execution class.

Separately installable executable modules SHALL NOT execute inside authoritative Core. `EXTERNAL_MANAGED` runs as a supervised capability-scoped process using typed/versioned IPC and Job Object containment.

Signed package provenance does not itself make external code safe enough for Core.

V1 does not require an open arbitrary executable-module marketplace. Only modules listed/qualified by the active Release Profile/catalog may be presented as supported.

---

# 22. INTEGRATIONS AND PROXMOX

Connecting an account/service grants no blanket action authority. Credentials remain behind Credential Broker; capabilities and action authorization are distinct.

V1 mandatory integration families are defined by the Release Profile and include Local filesystem/Git, GitHub, Codex/OpenAI, and Proxmox VE.

Proxmox VE is a first-class typed HTTPS API integration. Normal V1 control-plane access SHALL NOT use SSH, `qm`, `pct`, `pvesh`, direct `/etc/pve` editing, raw arbitrary API paths, or root shell as a silent fallback.

Proxmox credentials use a dedicated scoped API identity/token where practical. Guest OS shell authority is separate from Proxmox control-plane authority. Destructive infrastructure operations use the normal canonical approval/final-confirmation path and live-state/conditional-operation checks where available.

Direct Proxmox Backup Server administration is a separate future connection boundary.

---

# 23. EVENT GATEWAY AND NETWORK EXPOSURE

External/local events enter the Event Gateway, are authenticated/validated where supported, normalized, deduplicated/replay-protected, and remain subject to normal permissions/locality/budget/resource policy.

V1 SHALL NOT expose the privileged Core through a public/LAN HTTP control plane.

Direct public inbound Internet webhooks are not a V1 requirement. If future push delivery requires public ingress, it uses a separately threat-modeled relay/gateway or separately approved boundary rather than exposing the privileged desktop runtime directly.

---

# 24. VOICE

Voice is a V1 product requirement and remains local-first where practical.

The architecture provides push-to-talk, local STT, VAD, AEC-capable full duplex, semantic/physical turn detection, barge-in, deterministic stop/mute/cancel, interruptible TTS with persistent JARVIS voice identity, and safe half-duplex fallback.

Typed input remains available when voice providers fail. `LOCAL_ONLY` applies to speech providers exactly as to AI providers.

---

# 25. VERIFICATION AND PRODUCTION COMPLETE

A worker/model statement that work is complete is not sufficient evidence.

Verification preference is deterministic checks, verified live state, independent specialist review when judgment is necessary, then producer self-check only as supporting evidence.

The active Release Profile determines the exact platform/provider/integration/voice support matrix.

`Production Complete` requires the exact signed release artifacts for one source commit to pass every mandatory qualification gate including clean install, provider/module/integration conformance, IPC/WebView security, destructive-action binding, encrypted portable restore, crash/recovery, SQLite/WAL safety, process containment, update rollback, resource pressure, voice, soak, SBOM, and provenance.

Documentation/implementation-lock status alone is never Production Complete.

---

# 26. FUTURE ARCHITECTURE AMENDMENTS

A future material decision uses a new unique ADR and updates every affected active normative file synchronously before implementation depends on it.

No ordinary “later ADR silently supersedes this contract until someone eventually reconciles it” workflow is allowed.

If current normative documents conflict, the contract is defective and implementation SHALL stop at that ambiguity until the documents are reconciled.

---

# 27. DEFERRED / NON-GOALS FOR V1

V1 does not require:

- integrated browser automation;
- mobile/remote web clients;
- LAN AI nodes;
- unrestricted computer-control agents;
- mandatory local large-LLM inference;
- custom foundation-model training/inference infrastructure;
- privileged Windows service architecture solely to claim same-user-malware isolation;
- an open arbitrary executable plugin marketplace;
- direct public Internet ingress to privileged Core.

---

# 28. GOVERNING PRINCIPLES

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **Build the control plane first, prove recoverability early, then give intelligence access to it.**

> **History explains the contract. The current contract defines the product.**

> **A capable assistant on the good day, a controlled system on the dangerous day, and a recoverable system on the bad day.**

---

**END — JARVIS IMPLEMENTATION, SECURITY, OPERATIONS & PRODUCTION CONTRACT v1.0.2**
