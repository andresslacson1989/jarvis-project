# JARVIS
## Implementation, Security, Operations & Production Contract

**Contract Suite Version:** 1.0.3  
**Status:** Canonical Implementation-Locked Baseline  
**Date:** August 12, 2026  
**Primary Platform:** Microsoft Windows 11  
**Canonical consolidation:** ADR-069  
**UI identity:** ADR-070  
**Production-hardening closure:** ADR-071

---

# 1. PURPOSE

This contract defines how JARVIS SHALL be implemented as a production-grade Windows AI operating companion rather than a prototype, chat wrapper, or loosely connected collection of scripts.

A compliant implementation SHALL remain controlled, truthful, recoverable, observable, and visually coherent under provider failure, user interruption, crash/restart, network loss, invalid AI output, stale external state, resource pressure, update/migration failure, and adversarial input.

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

The current production contract consists of this file plus the exact documents listed in `docs/JARVIS-CONTRACT-MANIFEST-v1.0.3.md`.

The active suite includes:

- `docs/JARVIS-V1-RELEASE-PROFILE.md`;
- `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`;
- `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`;
- `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`;
- `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`;
- `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`;
- `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`;
- `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`;
- `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`;
- `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` as authoritative dependency sequencing and exit criteria.

The suite version identifies the current combined product contract. Individual appendix document revisions MAY remain unchanged when their normative content did not change, but the manifest SHALL make that explicit. No unlisted historical file is required to implement v1.0.3.

ADRs preserve rationale/history. They are not an override layer. A future architecture, security, release, or product-identity change is incomplete until every affected current normative file and the contract manifest are updated synchronously.

Earlier contracts and obsolete audits under `docs/history/` are non-normative.

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
- a unified dark-theme **JARVIS Mission Control** interface with one approved brand/design system across conversation, missions, approvals, systems, integrations, memory, artifacts, diagnostics, and voice state;
- a dedicated primary desktop dashboard/window that can be hidden, shown, windowed, maximized, full-screen, or focused-context presented under deterministic native/application policy;
- adaptive layout across qualified window sizes, screen classes, multi-monitor/DPI conditions, WebView zoom/reflow, accessibility modes, and user text scaling without inventing separate visual products;
- AI orchestration for flexible language understanding;
- deterministic authorization and typed tool/integration execution;
- durable project, memory, mission, task, approval, budget, event, and recovery state;
- bounded AI workers and graph-based missions;
- dynamic graph revision through validated immutable graph versions;
- queueing, priority, pause/resume/cancel/recovery;
- provider supervision, setup/repair state, compatibility qualification, and capability-based routing;
- secure credentials and integration boundaries;
- worker journals/work dashboard without private chain-of-thought;
- exact budget/usage accounting;
- event-triggered automation under normal authorization;
- encrypted backup/restore and staged reversible updates;
- production diagnostics, provenance, and qualification evidence.

JARVIS SHALL NOT be implemented as a single LLM session with broad shell access, as a custom foundation-model project, or as unrelated screens that merely share a name.

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

# 6. TAURI/WEBVIEW AND UI IDENTITY BOUNDARY

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

Mission Control, the approved JARVIS brand, dedicated-window behavior, adaptive layout, accessibility, operational state language, and design-token/component rules are mandatory V1 product behavior—not optional visual polish. Central production qualification SHALL include the UI Identity & Design System Contract's full matrix.

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
- provider routing/setup/qualification logical state;
- module/integration logical state;
- event/automation/notification policy.

Rust host owns:

- single-instance/native lifecycle;
- primary JARVIS window show/hide/focus/windowed/maximized/full-screen native lifecycle and safe monitor placement;
- Windows lock observation;
- Windows secure storage;
- named-pipe security/bootstrap;
- native process/job containment;
- signed updater activation;
- narrowly defined native elevation mediation where an explicitly qualified provider setup/repair path requires UAC.

AI may request a UI presentation transition, but it does not own the native window primitive or bypass focus/privacy/NotificationPolicy rules.

Authority ordering is:

```text
verified live state
> verified persisted fact
> confirmed user decision/memory
> inferred memory
> AI assumption
```

---

# 9. SESSION TRUST AND KDF FLOOR

JARVIS starts locked. Session password verification is independent of database/integration keys.

V1 JARVIS-managed password/recovery KDF profiles SHALL use Argon2id version `0x13` with a production floor of:

```text
memory >= 65536 KiB
passes >= 3
lanes = 4
salt >= 16 random bytes
output >= 32 bytes
```

Session-password and portable-recovery KDF profiles are separate, versioned records. Release calibration MAY raise memory/time cost but SHALL NOT silently reduce below the reviewed floor. Exact parameters are persisted with the verifier/key slot needed to verify older values and allow controlled strengthening over time.

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

# 12. CODEX WINDOWS SETUP / REPAIR BOUNDARY

Provider setup state is separate from compatibility and health.

For a qualified Codex version whose Windows sandbox requires elevated first-class setup, JARVIS SHALL model states equivalent to:

```text
NOT_REQUIRED
SETUP_REQUIRED
SETUP_IN_PROGRESS
SETUP_READY
REPAIR_REQUIRED
SETUP_FAILED
```

The provider setup/repair path SHALL:

- be explicit and user-visible;
- validate the qualified provider distribution/helper identity before native invocation;
- request UAC only for the provider-owned setup/repair action that requires it;
- never run normal Codex workers elevated merely because setup required elevation;
- leave provider-internal sandbox-user credentials under provider ownership rather than importing them into JARVIS;
- wait for/setup-probe asynchronous provider configuration before marking `SETUP_READY`;
- fail closed when setup/repair is incomplete or failed;
- never silently downgrade to a less restrictive/unqualified sandbox;
- re-evaluate setup/conformance after material provider version/update changes.

A Codex profile is `SUPPORTED` only when setup readiness, compatibility, health/auth, required capability, and conformance requirements all pass.

---

# 13. AUTHORITY ENVELOPE AND DETERMINISTIC PERMISSION ENGINE

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
9. risk/approval rule: a recoverable HIGH action requires a new approval unless the exact resolved action/target/scope is directly and unambiguously authorized by the current authenticated instruction or an explicit matching standing permission under policy; CRITICAL/destructive/materially unrecoverable always requires fresh final confirmation;
10. `ALLOW` only if every prior gate permits it.

Mandatory safety invariants and explicit DENY dominate grants.

Historical precedent may help interpret LOW/MODERATE reversible subordinate work or suggest a standing permission. It SHALL NOT independently authorize HIGH/CRITICAL actions, expand environment/account scope, or waive approval/final confirmation. AI confidence SHALL NOT be an authorization input.

---

# 14. TOOL EXECUTION AND TARGET RACES

AI-generated tool requests are untrusted proposals.

Consequential execution SHALL pass tool/version lookup, schema validation, scope/target resolution, canonicalization, preconditions, authority/permission, locality/budget/resource gates, registered adapter execution, output validation, postconditions, and audit recording.

Process exit code alone does not prove semantic success unless the tool contract explicitly establishes that equivalence.

Unknown outcome becomes `UNCERTAIN`.

Immediately before consequential execution JARVIS SHALL re-resolve mutable target state. Where the external system supports conditional mutation, adapters SHALL use expected-version, ETag/If-Match, expected ref/hash/generation, or equivalent compare-and-set semantics. A precondition mismatch triggers re-resolution/re-authorization/re-approval as applicable rather than mutating changed state or blindly retrying.

---

# 15. APPROVALS AND DESTRUCTIVE CONFIRMATION

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

# 16. MISSIONS, TASKS, PAUSE, AND RECOVERY

Complex work is represented as immutable-versioned DAGs. Workers may request replanning but cannot mutate the active graph directly.

Task state includes durable `RESUMING`. A paused task must enter `RESUMING`, revalidate live state, scope, provider/locality, budget, leases, and preconditions, then transition to RUNNING/QUEUED/BLOCKED/RECOVERING/FAILED/CANCELLED as appropriate.

Accepted work, queue state, checkpoints, graph versions, approvals, and recovery state are durable.

Provider session-resume handles are optional continuity optimizations. JARVIS-owned checkpoints/artifacts/state are the durability source of truth.

Ambiguous destructive/high-risk side effects are never blindly retried after crash/timeout.

---

# 17. PROVIDERS

Provider roles are capability-based, not vendor/model hardcoded.

`SUPPORTED` requires exact executable/runtime identity, provider setup readiness when applicable, version compatibility policy, release-time conformance evidence, current health/authentication, and required capability availability.

Installed/launchable does not mean supported.

Codex CLI is the initial required AI provider family. JARVIS SHALL use a qualified stable structured/non-interactive surface rather than parsing transient TUI presentation when a structured surface exists.

Provider fallback may never weaken locality, capability, permission, budget, setup, or security requirements.

---

# 18. PROCESS CONTAINMENT

Every JARVIS-managed executable child tree SHALL be assigned to an explicitly owned Windows Job Object containment hierarchy on supported Windows 11 unless a narrow documented/verified incompatibility has an approved equivalent lifecycle mechanism.

Kill-on-close semantics are mandatory for subtrees that must terminate with JARVIS. Ordinary breakaway is prohibited. Handle inheritance defaults to none/explicit allowlist.

Failure to establish required containment blocks consequential child execution rather than silently launching uncontained.

---

# 19. DATA POLICY AND EXACT MONEY

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

# 20. SQLITE/SQLCIPHER PERSISTENCE

SQLite/SQLCipher is the V1 authoritative durable state store.

Production SHALL use WAL on a qualified local filesystem unless an explicit qualified alternative is adopted. The embedded SQLite core SHALL include the upstream WAL-reset corruption fix. WAL activation, foreign keys, connection initialization, bounded busy handling, checkpoint health, and authoritative `synchronous=FULL` policy are verified rather than assumed.

Authoritative state transitions and their causative durable events are transactional. External side effects use attempt/uncertain/recovery semantics rather than pretending SQLite and remote services share one transaction.

---

# 21. BACKUP AND PORTABLE RECOVERY

The live database uses a random local `DB_DEK` protected by Windows secure storage.

Every backup package uses an independent random 256-bit backup DEK and authenticated encryption. Backup classes are at least:

```text
LOCAL_RECOVERY
PORTABLE_STATE
```

A database backup snapshot SHALL be encrypted under a backup-specific snapshot database key rather than requiring the historical live `DB_DEK` on a clean machine. The snapshot key record exists only inside the authenticated encrypted backup payload.

The backup DEK is protected by key slots:

- local current-user DPAPI slot for local recovery;
- versioned Argon2id portable-recovery KDF slot for `PORTABLE_STATE` (and optionally both slots).

The portable slot records its KDF profile/parameters and SHALL meet the current production Argon2id floor. It may use a higher calibrated cost than the interactive session-password profile.

Clean-machine restore is:

```text
portable recovery factor
→ derive/unlock backup DEK using recorded qualified KDF profile
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

# 22. MODULES

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

# 23. V1 INTEGRATIONS AND EXACT CAPABILITY MATRICES

Connecting an account/service grants no blanket action authority. Credentials remain behind Credential Broker; capabilities and action authorization are distinct.

V1 mandatory integration families are Local filesystem/Git, GitHub, Codex/OpenAI, and Proxmox VE.

The Release Profile defines the exact capability matrix. At minimum V1 GitHub production support SHALL qualify:

```text
GITHUB_REPOSITORY_READ
GITHUB_REF_READ
GITHUB_REF_WRITE
GITHUB_PULL_REQUEST_READ
GITHUB_PULL_REQUEST_WRITE
GITHUB_ISSUE_READ
GITHUB_COMMENT_WRITE
GITHUB_CHECKS_READ
GITHUB_ACTIONS_READ
```

`GITHUB_ACTIONS_DISPATCH` is optional for V1 Production Complete. Repository administration, secrets administration, branch-protection administration, membership administration, repository deletion, and ref deletion are outside mandatory V1 GitHub support.

At minimum V1 Proxmox production support SHALL qualify:

```text
PROXMOX_READ
PROXMOX_POWER_CONTROL
PROXMOX_SNAPSHOT
PROXMOX_BACKUP
PROXMOX_GUEST_CONFIG
PROXMOX_GUEST_CREATE
PROXMOX_MIGRATE
PROXMOX_DESTROY
```

`PROXMOX_STORAGE_WRITE` and `PROXMOX_NETWORK_WRITE` may exist as modeled future/optional capabilities but do not gate V1 Production Complete unless the release explicitly enables them, in which case that release must fully qualify them.

Proxmox VE is a first-class typed HTTPS API integration. Normal V1 control-plane access SHALL NOT use SSH, `qm`, `pct`, `pvesh`, direct `/etc/pve` editing, raw arbitrary API paths, or root shell as a silent fallback.

Guest create may allocate guest disks on allowed existing storage but does not grant arbitrary datastore administration. Guest config modifies typed guest-level configuration only. Guest backup runs/tracks guest backup operations against allowed configured targets and does not imply direct PBS administration.

Proxmox credentials use a dedicated scoped API identity/token where practical. Guest OS shell authority is separate from Proxmox control-plane authority. Destructive infrastructure operations use the normal canonical approval/final-confirmation path and live-state/conditional-operation checks where available.

---

# 24. EVENT GATEWAY AND NETWORK EXPOSURE

External/local events enter the Event Gateway, are authenticated/validated where supported, normalized, deduplicated/replay-protected, and remain subject to normal permissions/locality/budget/resource policy.

V1 SHALL NOT expose the privileged Core through a public/LAN HTTP control plane.

Direct public inbound Internet webhooks are not a V1 requirement. If future push delivery requires public ingress, it uses a separately threat-modeled relay/gateway or separately approved boundary rather than exposing the privileged desktop runtime directly.

---

# 25. VOICE

Voice is a V1 product requirement and remains local-first where practical.

The architecture provides push-to-talk, local STT, VAD, AEC-capable full duplex, semantic/physical turn detection, barge-in, deterministic stop/mute/cancel, interruptible TTS with persistent JARVIS voice identity, and safe half-duplex fallback.

Typed input remains available when voice providers fail. `LOCAL_ONLY` applies to speech providers exactly as to AI providers.

Voice presence, listening/speaking/degraded states, and voice-to-visual continuity SHALL use the same JARVIS UI identity and Mission Control context rather than a separate voice-only visual product.

---

# 26. BRAND / ASSET PROVENANCE

Canonical JARVIS brand sources are release-controlled under `assets/brand/` and include the mark, lockup, application-icon master, and asset-governance README.

Raster/platform variants SHALL derive from canonical vector sources rather than independent redraws.

The primary Inter typeface SHALL be packaged/offline-safe for production use or an explicitly qualified equivalent approved by a synchronous design-contract change. Fonts, icon libraries, and other third-party visual dependencies SHALL have source/license/provenance recorded and required notices included in production release artifacts.

---

# 27. VERIFICATION AND PRODUCTION COMPLETE

A worker/model statement that work is complete is not sufficient evidence.

Verification preference is deterministic checks, verified live state, independent specialist review when judgment is necessary, then producer self-check only as supporting evidence.

The active Release Profile determines the exact platform/provider/integration/voice support matrix.

`Production Complete` requires the exact signed release artifacts for one source commit to pass every mandatory qualification gate including:

- clean install and supported Windows qualification;
- Mission Control UI identity/adaptive layout/accessibility/window-state qualification;
- provider setup/repair, compatibility, sandbox, and failure conformance;
- exact GitHub and Proxmox capability matrices;
- IPC/WebView security;
- Argon2id KDF-profile and migration/upgrade tests;
- destructive-action binding;
- encrypted portable restore;
- crash/recovery;
- SQLite/WAL safety;
- process containment;
- update rollback;
- resource pressure;
- voice;
- soak;
- SBOM, licensing, provenance, and signed artifacts.

Documentation/implementation-lock status alone is never Production Complete.

---

# 28. REPOSITORY GOVERNANCE BEFORE IMPLEMENTATION

`master` is the sole authoritative/latest branch. Temporary branches may be used for review/work but do not become alternate contract sources.

Before Phase 0 is complete, `master` SHALL be protected by a GitHub ruleset/branch-protection equivalent that at minimum:

- prevents deletion;
- blocks force pushes;
- requires mandatory CI checks once those checks exist;
- keeps bypass narrowly controlled/auditable.

A pull-request requirement is strongly preferred for implementation changes. Repository governance SHALL NOT require maintaining a second long-lived authoritative branch.

---

# 29. FUTURE ARCHITECTURE AMENDMENTS

A future material decision uses a new unique ADR and updates every affected active normative file plus the current contract manifest synchronously before implementation depends on it.

Material changes to product scope, trust boundaries, release gates, authentication/recovery, required capabilities, or UI identity SHALL advance the contract-suite semantic version rather than silently changing the meaning of an existing suite version.

No ordinary “later ADR silently supersedes this contract until someone eventually reconciles it” workflow is allowed.

If current normative documents conflict, the contract is defective and implementation SHALL stop at that ambiguity until the documents are reconciled.

---

# 30. DEFERRED / NON-GOALS FOR V1

V1 does not require:

- integrated browser automation;
- mobile/remote web clients;
- LAN AI nodes;
- unrestricted computer-control agents;
- mandatory local large-LLM inference;
- custom foundation-model training/inference infrastructure;
- privileged Windows service architecture solely to claim same-user-malware isolation;
- an open arbitrary executable plugin marketplace;
- direct public Internet ingress to privileged Core;
- light theme, multiple visual themes, a 3D avatar, or a separate visual identity per integration;
- GitHub repository/secrets/branch-protection administration;
- generic Proxmox storage/network administration;
- direct Proxmox Backup Server administration.

---

# 31. GOVERNING PRINCIPLES

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

> **Escalate product judgment. Resolve engineering judgment.**

> **One system. One identity. Any screen.**

> **Build the control plane first, prove recoverability early, then give intelligence access to it.**

> **Version the current truth; do not make implementers infer it from history.**

> **A capable assistant on the good day, a controlled system on the dangerous day, and a recoverable system on the bad day.**

---

**END — JARVIS IMPLEMENTATION, SECURITY, OPERATIONS & PRODUCTION CONTRACT SUITE v1.0.3**
