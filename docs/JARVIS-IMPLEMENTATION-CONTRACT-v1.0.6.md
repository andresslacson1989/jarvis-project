# JARVIS
## Implementation, Security, Operations & Production Contract

**Contract Suite Version:** 1.0.6  
**Status:** Canonical Implementation-Locked Baseline  
**Date:** August 12, 2026  
**V1 Production Platform:** Microsoft Windows 11  
**Future Full-Host Target:** Linux  
**Canonical consolidation:** ADR-069  
**UI identity:** ADR-070  
**Production-hardening closure:** ADR-071  
**Platform/runtime-role architecture:** ADR-072  
**Pre-implementation security closure:** ADR-073  
**Repository-governance capability closure:** ADR-074

---

# 1. PURPOSE

This contract defines how JARVIS SHALL be implemented as a production-grade Windows-first AI operating companion rather than a prototype, chat wrapper, or loosely connected collection of scripts.

V1 is a Windows product. The architecture SHALL nevertheless preserve an explicit future Linux `FULL_HOST` path without weakening Windows security or requiring Linux implementation before V1. A future Android application is treated as a `COMPANION` interaction surface, not as a required full-host runtime.

A compliant implementation SHALL remain controlled, truthful, recoverable, observable, visually coherent, and architecturally portable at the defined platform boundaries under provider failure, user interruption, crash/restart, network loss, invalid AI output, stale external state, resource pressure, update/migration failure, and adversarial input.

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

The current production contract consists of this file plus the exact documents and component revisions listed in `docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md`.

The active suite includes:

- `docs/JARVIS-V1-RELEASE-PROFILE.md`;
- `docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md`;
- `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`;
- `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`;
- `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`;
- `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`;
- `docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md`;
- `docs/implementation/JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`;
- `docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`;
- `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`;
- `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`;
- `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`;
- `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`;
- `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` as authoritative dependency sequencing and exit criteria.

The suite version identifies the current combined product contract. Individual appendix revisions MAY remain unchanged when their normative content did not change; the manifest records the exact current revision set.

ADRs preserve rationale/history. They are not an override layer. A future architecture, security, release, product-identity, cryptographic-format, trust-root, policy-admission, platform-role, or repository-governance change is incomplete until every affected current normative file and the contract manifest are updated synchronously.

Earlier contracts and obsolete audits are non-current provenance.

---

# 3. CONTRACT LANGUAGE

`MUST`, `MUST NOT`, `SHALL`, and `SHALL NOT` are mandatory.

`SHOULD` and `SHOULD NOT` are strong defaults requiring a documented engineering reason to deviate.

`MAY` is optional.

Unknown/ambiguous security-critical interpretation SHALL fail closed rather than choose a permissive meaning.

---

# 4. PRODUCT DEFINITION

JARVIS is a persistent, local-first AI operating companion with a Windows V1 full host and an architecture explicitly preserving future Linux full-host support.

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

JARVIS SHALL NOT be implemented as a single LLM session with broad shell access, as a custom foundation-model project, as unrelated screens that merely share a name, or as Windows-specific domain logic coupled directly to native APIs when a platform capability boundary is appropriate.

---

# 5. REQUIRED FULL-HOST PROCESS TOPOLOGY

The logical full-host topology is:

```text
React/WebView UI — unprivileged presentation/control surface
       ↓ typed Tauri boundary
Rust Native Platform Host — OS trust/capability implementation
       ↓ authenticated local privileged transport
Node/TypeScript Core — authoritative orchestration/state/policy runtime
       ↓
scoped Providers / Tools / Workers / Integrations / Managed Modules
```

Node Core is authoritative for mutable application/domain state and policy decisions. The Rust platform host is authoritative for qualified native operating-system mechanisms. External systems are authoritative for their live external state.

The React/WebView layer SHALL NOT hold long-lived credentials, authorize tools, spawn arbitrary native processes, connect directly to privileged provider CLIs, or mutate authoritative mission/task/approval state.

## 5.1 Platform and runtime roles

Platform identity and runtime responsibility are separate concepts.

```text
RuntimeRole = FULL_HOST | COMPANION
```

Product direction:

```text
Windows → FULL_HOST → V1 production target
Linux   → FULL_HOST → future production target
Android → COMPANION → future non-V1 client
```

`FULL_HOST` owns Core, authoritative state, providers, workers, tools, integrations, credentials, automation, permissions, approvals, budgets, and recovery.

`COMPANION` is non-authoritative and may later present host state/conversation/notifications/approvals/selected controls through a separately qualified remote-access boundary.

## 5.2 Platform capability boundary

Shared domain/policy/protocol/UI code SHALL depend on semantic platform capabilities rather than direct Windows/Linux implementation APIs where practical.

Native responsibilities SHALL be isolated behind typed capabilities/composition boundaries equivalent to secure storage, local IPC, process supervision, session observation, window control, notifications, platform paths/identity, audio/device integration, updates, and privilege mediation.

Operating-system selection belongs in platform composition/adapter code, not scattered through mission, permission, memory, integration, or general feature logic.

## 5.3 No lowest-common-denominator portability

Windows SHALL retain the strongest qualified Windows mechanisms. Portability does not authorize weakening Job Object containment, secure storage, IPC security, path canonicalization, or other invariants merely because a future platform differs.

A future platform incapable of satisfying a required invariant leaves the affected capability unsupported until it can meet the contract.

The detailed rules are normative in `JARVIS-PLATFORM-PORTABILITY-CONTRACT.md`.

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

The same JARVIS identity and core component semantics SHALL remain reusable for a future Linux full-host UI and future companion UI; native platform affordances may differ without creating unrelated product identities.

---

# 7. APPLICATION-OWNED CORE RUNTIME

Production JARVIS SHALL ship the Node.js runtime and prebuilt Core application as one release-owned, version-pinned unit for the active platform artifact.

The platform host SHALL launch the exact verified application-owned runtime path. Production SHALL NOT silently fall back to `node`/`node.exe` found through PATH, developer tooling, or another machine-local installation.

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
- event/automation/notification policy;
- project-policy trust/enrollment records and immutable attempt policy snapshots where applicable;
- update/catalog trusted metadata logical state, while native activation remains a platform-host responsibility.

The Rust platform host owns native capabilities such as:

- single-instance/native lifecycle;
- primary JARVIS window presentation and safe placement;
- OS session-lock/sign-out observation where available/qualified;
- platform secure storage;
- local privileged IPC bootstrap/security;
- native process-tree containment/supervision;
- signed updater activation;
- narrowly defined native privilege mediation where an explicitly qualified setup/repair path requires it.

For Windows V1 these responsibilities are implemented by the exact Windows mechanisms in the Runtime/Security/Data contracts, including Windows secure storage, named pipes, Job Objects, Windows session APIs, and bounded UAC where required.

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

On Windows V1, JARVIS locks on startup, explicit lock, Windows session lock/sign-out, and configured idle policy. Future full-host platforms SHALL map qualified local session-lock/logout semantics into the same JARVIS trust states.

V1 SHALL NOT claim hard isolation from arbitrary malicious code already executing with an equivalent same-user Windows security context, Administrator/kernel compromise, or physical control of an already-unlocked session.

Session-password recovery SHALL NOT use a weak OS-login-only bypass. A verified JARVIS portable recovery factor may establish an explicit password-reset/recovery workflow. Without an applicable recovery factor, the verifier is not reversible. Clean-machine portable restore establishes a new session password after successful state recovery.

The general KDF floor above does not weaken the stronger optional portable-backup passphrase profile defined by `JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md`.

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

Workers receive task/mission identity, execution scope, authority envelope, bounded context/artifacts, acceptance criteria, role, provider assignment, tools, data policy, resource/budget ceilings, checkpoint policy, and the exact trusted project-policy snapshot applicable to the attempt when one exists.

Shell-capable software engineering workers operate under the V1 `WORKSPACE_ENGINEERING` delegated profile:

- JARVIS assigns the exact project/worktree;
- writes are limited to the assigned writable workspace by the qualified provider/OS sandbox where supported;
- provider/native read access outside the workspace is **not** claimed to be impossible unless conformance proves it;
- delegated network access is denied by default and may be enabled only by an explicit qualified policy;
- unrelated secrets/credentials are not placed in the worker environment/context;
- external consequential actions such as GitHub push, deploy, Proxmox change, email/send, or cloud mutation are not delegated merely because a shell/client binary exists;
- those operations return through registered JARVIS tools/integrations and PermissionEngine.

Windows V1 uses Job Objects for lifecycle/resource containment. Job Objects are not filesystem/network security isolation and are not the universal shared abstraction; the shared concept is managed process-tree supervision.

A repository file such as `AGENTS.md` is untrusted content until explicitly enrolled under the Project Policy Trust Contract. Worker access to the repository does not promote policy-looking text to trusted instruction. Changing an enrolled trusted project-policy file is contextually HIGH and the resulting content does not auto-trust itself.

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

A Codex profile is `SUPPORTED` only when setup readiness, compatibility, health/auth, required capability, and platform-specific conformance requirements all pass.

Windows Codex support does not imply Linux Codex support. Future Linux provider qualification is independent where native behavior differs.

---

# 13. AUTHORITY ENVELOPE AND DETERMINISTIC PERMISSION ENGINE

Every consequential execution is constrained by an immutable authority envelope derived from authenticated user instruction and standing policy.

PermissionEngine SHALL apply this decision precedence:

1. mandatory system safety/security invariant;
2. explicit applicable `DENY`;
3. session/automation eligibility;
4. authority-envelope scope/action containment;
5. required capability/target/account/environment checks;
6. data locality, budget, resource, precondition, platform-capability, setup, integrity, trusted project-policy state, and applicable supply-chain trust checks;
7. authority established by the current explicit instruction;
8. matching standing permission;
9. risk/approval rule: a recoverable HIGH action requires a new approval unless the exact resolved action/target/scope is directly and unambiguously authorized by the current authenticated instruction or an explicit matching standing permission under policy; CRITICAL/destructive/materially unrecoverable always requires fresh final confirmation;
10. `ALLOW` only if every prior gate permits it.

Mandatory safety invariants and explicit DENY dominate grants.

Historical precedent may help interpret LOW/MODERATE reversible subordinate work or suggest a standing permission. It SHALL NOT independently authorize HIGH/CRITICAL actions, expand environment/account scope, or waive approval/final confirmation. AI confidence SHALL NOT be an authorization input.

---

# 14. TOOL EXECUTION AND TARGET RACES

AI-generated tool requests are untrusted proposals.

Consequential execution SHALL pass tool/version lookup, schema validation, scope/target resolution, canonicalization, preconditions, authority/permission, locality/budget/resource/platform-capability gates, registered adapter execution, output validation, postconditions, and audit recording.

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

No model or future companion client may waive this boundary.

---

# 16. MISSIONS, TASKS, PAUSE, AND RECOVERY

Complex work is represented as immutable-versioned DAGs. Workers may request replanning but cannot mutate the active graph directly.

Task state includes durable `RESUMING`. A paused task must enter `RESUMING`, revalidate live state, scope, provider/locality, platform capabilities, budget, leases, project-policy trust snapshots where applicable, and preconditions, then transition to RUNNING/QUEUED/BLOCKED/RECOVERING/FAILED/CANCELLED as appropriate.

Accepted work, queue state, checkpoints, graph versions, approvals, and recovery state are durable.

Provider session-resume handles are optional continuity optimizations. JARVIS-owned checkpoints/artifacts/state are the durability source of truth.

Ambiguous destructive/high-risk side effects are never blindly retried after crash/timeout.

---

# 17. PROVIDERS

Provider roles are capability-based, not vendor/model hardcoded.

`SUPPORTED` requires exact executable/runtime identity, provider setup readiness when applicable, version compatibility policy, release-time conformance evidence, current health/authentication, required capability availability, and platform-specific qualification where native behavior matters.

Installed/launchable does not mean supported.

Codex CLI is the initial required AI provider family for Windows V1. JARVIS SHALL use a qualified stable structured/non-interactive surface rather than parsing transient TUI presentation when a structured surface exists.

Provider fallback may never weaken locality, capability, permission, budget, setup, platform support, or security requirements.

---

# 18. PROCESS CONTAINMENT

Every JARVIS-managed executable child tree SHALL be owned by the active full-host platform's qualified `PlatformProcessSupervisor` semantics.

For supported Windows 11 V1 this SHALL use an explicitly owned Windows Job Object containment hierarchy unless a narrow documented/verified incompatibility has an approved equivalent lifecycle mechanism.

Kill-on-close semantics are mandatory for Windows subtrees that must terminate with JARVIS. Ordinary breakaway is prohibited. Handle inheritance defaults to none/explicit allowlist.

Failure to establish required containment blocks consequential child execution rather than silently launching uncontained.

A future Linux full host must separately qualify equivalent required lifecycle, cancellation, orphan cleanup, and resource-control properties. Windows requirements are not weakened for Linux portability.

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

Production SHALL use WAL on a qualified local filesystem unless an explicit qualified alternative is adopted. The exact embedded SQLite/SQLCipher build SHALL be identified and proven to contain the required upstream WAL-reset corruption fix; SQLite `3.51.3` is the first known fixed upstream point for that defect, but numeric version comparison alone does not establish production qualification. WAL activation, foreign keys, connection initialization, bounded busy handling, checkpoint health, and authoritative `synchronous=FULL` policy are verified rather than assumed.

Authoritative state transitions and their causative durable events are transactional. External side effects use attempt/uncertain/recovery semantics rather than pretending SQLite and remote services share one transaction.

Logical persistence schemas SHOULD remain platform-neutral. Platform-specific native metadata is typed/namespaced and SHALL NOT become shared domain identity without a concrete need.

---

# 21. BACKUP AND PORTABLE RECOVERY

The live database uses a random local `DB_DEK` protected by the active full host's qualified local secure-storage backend. Windows V1 uses the Windows secure-storage design in the Security/Data contracts.

The production portable-backup format is `JARVIS_BACKUP_V1` and is governed exactly by `JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md`.

Every backup package uses an independent random 256-bit `BackupDEK`, a fresh backup-specific `SnapshotDBKey`, and the versioned authenticated encryption/chunk/key-slot format defined by that contract. The snapshot key record exists only inside the authenticated encrypted backup payload.

Backup classes are at least:

```text
LOCAL_RECOVERY
PORTABLE_STATE
```

For Windows V1, `BackupDEK` may be protected by a local current-user DPAPI/PlatformSecureStorage slot.

Every production backup labeled `PORTABLE_STATE VERIFIED` SHALL additionally contain a JARVIS-generated 256-bit `GENERATED_RECOVERY_V1` recovery slot. A user-selected Argon2id passphrase slot MAY be offered as an additional convenience recovery method but SHALL NOT be the sole production portability anchor.

Clean-profile Windows V1 restore is:

```text
generated portable recovery factor (or an additional qualified slot)
→ authenticate/unlock BackupDEK
→ authenticate/decrypt complete bounded JARVIS_BACKUP_V1 package
→ obtain SnapshotDBKey transiently
→ open/integrity-check SQLCipher snapshot
→ restore
→ generate fresh local DB_DEK
→ re-key restored database
→ protect new DB_DEK with new Windows profile secure storage
```

Ordinary backups exclude raw long-lived integration credentials. Restored integrations without credentials become `REAUTH_REQUIRED`.

Portable recovery is not considered configured/verified until its generated portable key slot and a clean-profile restore path have been qualified with the exact production backup format.

Cross-platform Windows↔Linux restore is not a current V1 guarantee and requires future migration/compatibility qualification, but the portable backup cryptographic envelope SHALL NOT require the historical Windows DPAPI secret.

---

# 22. MODULES AND SUPPLY-CHAIN TRUST

Every module is exactly one execution class:

```text
DATA_ONLY
BUILT_IN_TRUSTED
EXTERNAL_MANAGED
```

There is no untrusted in-process execution class.

Separately installable executable modules SHALL NOT execute inside authoritative Core. `EXTERNAL_MANAGED` runs as a supervised capability-scoped process using typed/versioned IPC and the active platform's qualified process-supervision boundary.

Signed package provenance does not itself make external code safe enough for Core.

V1 does not require an open arbitrary executable-module marketplace. Only modules listed/qualified by the active Release Profile/catalog for the current platform may be presented as supported.

Application-update and supported module-catalog trust SHALL follow `JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`. Windows production application updates require current TUF authorization plus the required Tauri updater signature, Windows code-signing, compatibility, and rollback gates. An old historically valid signature does not override current revocation, release-sequence, or security-epoch policy.

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

# 24. EVENT GATEWAY, NETWORK EXPOSURE, AND FUTURE COMPANIONS

External/local events enter the Event Gateway, are authenticated/validated where supported, normalized, deduplicated/replay-protected, and remain subject to normal permissions/locality/budget/resource policy.

V1 SHALL NOT expose the privileged Core through a public/LAN HTTP control plane.

Direct public inbound Internet webhooks are not a V1 requirement. If future push delivery requires public ingress, it uses a separately threat-modeled relay/gateway or separately approved boundary rather than exposing the privileged desktop runtime directly.

A future companion client SHALL likewise use a separately designed and qualified Remote Access Gateway. It SHALL NOT connect directly to an unrestricted privileged Core API. Before enabling companion remote control, the normative suite must define host/device enrollment and identity, authenticated encryption, replay resistance, revocation/lost-device behavior, per-device authority, rate limiting, remote provenance, approval semantics, privacy, and audit.

Companion-originated consequential work remains subject to the same PermissionEngine, Authority Envelope, approval, budget, DataPolicy, and verification requirements as local work plus any remote-device restrictions.

---

# 25. VOICE

Voice is a V1 product requirement and remains local-first where practical.

The architecture provides push-to-talk, local STT, VAD, AEC-capable full duplex, semantic/physical turn detection, barge-in, deterministic stop/mute/cancel, interruptible TTS with persistent JARVIS voice identity, and safe half-duplex fallback.

Typed input remains available when voice providers fail. `LOCAL_ONLY` applies to speech providers exactly as to AI providers.

Voice presence, listening/speaking/degraded states, and voice-to-visual continuity SHALL use the same JARVIS UI identity and Mission Control context rather than a separate voice-only visual product.

Voice semantics are shared; audio/device/provider implementations may be platform-specific and require independent qualification.

The Implementation Plan includes an early real-hardware voice feasibility spike after the Phase-3 persistence/recovery proof. This does not reduce the later full voice implementation/qualification requirement; it prevents the rest of the product from depending on untested latency/AEC/provider/licensing assumptions.

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

`Production Complete` for V1 requires the exact signed Windows artifacts for one source commit to pass every mandatory qualification gate in every active normative contract, including:

- clean install and supported Windows qualification;
- platform-boundary architecture/import checks proving shared Core/domain does not depend directly on Windows-native implementation modules;
- Mission Control UI identity/adaptive layout/accessibility/window-state qualification;
- provider setup/repair, compatibility, sandbox, and failure conformance;
- exact GitHub and Proxmox capability matrices;
- IPC/WebView security;
- Argon2id KDF-profile and migration/upgrade tests;
- destructive-action binding;
- `JARVIS_BACKUP_V1` cryptographic vectors, tamper/order/truncation tests, generated-recovery factor, and clean-profile disaster restore;
- project-policy candidate/enrollment/hash-change/nesting/revocation/worker-mutation trust tests;
- TUF bootstrap/root-threshold/rotation/revocation/expiration/rollback/freeze/delegation tests plus cumulative Tauri/Windows signing gates;
- crash/recovery;
- SQLite/WAL safety on the exact qualified embedded build;
- process containment;
- update rollback;
- resource pressure;
- voice, including evidence from the early feasibility spike and final production qualification;
- soak;
- SBOM, licensing, provenance, and signed artifacts.

Linux runtime qualification is not a V1 gate unless a future Release Profile explicitly promotes Linux.

Documentation/implementation-lock status alone is never Production Complete.

---

# 28. REPOSITORY GOVERNANCE BEFORE IMPLEMENTATION

`master` is the sole authoritative/latest branch. Temporary branches may be used for review/work but do not become alternate contract sources.

Before Phase 0 is complete, the authoritative repository governance mode SHALL be determined from verified hosting/account capability.

When the hosting provider/account exposes enforceable server-side branch protection or repository rulesets for the authoritative repository, `master` SHALL use that capability and the effective policy SHALL at minimum:

- prevent deletion;
- block force pushes;
- require designated mandatory CI checks once those checks exist;
- keep bypass narrowly controlled and auditable.

When the hosting provider/account does not expose server-side branch protection/rulesets for the authoritative repository because of a plan or platform capability limitation, absence of that unavailable paid/host-gated feature SHALL NOT by itself block Phase 0 or `Production Complete`. The limitation SHALL be verified and recorded, and normal implementation integration SHALL instead use compensating governance that at minimum:

- performs implementation work on temporary branches rather than routine direct implementation writes to `master`;
- requires the designated mandatory CI context to pass for the exact candidate commit before authoritative integration;
- re-fetches and validates the live `master` tip immediately before integration and rejects/reconciles stale-base or unexpected concurrent movement;
- uses non-force integration/ref updates only;
- verifies the resulting authoritative tip, intended diff, and relevant CI/audit evidence after integration;
- records that server-side protection is unavailable and SHALL NOT represent `master` as protected when it is not;
- re-enables the server-enforced mode when the hosting capability later becomes available, without requiring a product-architecture change.

The compensating mode does not claim hard server-side prevention of an out-of-band repository administrator force push or deletion. That residual hosting limitation is explicit and accepted by this contract only while the required server-side capability is unavailable. The exception SHALL NOT be used to disable an available protection feature, waive mandatory CI, permit force-push implementation workflow, create a broad bypass, or misrepresent repository state.

A pull-request requirement is strongly preferred for implementation changes. Repository governance SHALL NOT require maintaining a second long-lived authoritative branch.

Phase 0 SHALL also establish machine-readable canonical definitions/checks for repeated security/profile constants and capability matrices where practical, with CI detecting divergence from current normative values rather than relying indefinitely on manual duplication discipline.

---

# 29. FUTURE ARCHITECTURE AMENDMENTS

A future material decision uses a new unique ADR and updates every affected active normative file plus the current contract manifest synchronously before implementation depends on it.

Material changes to product scope, runtime roles/platform intent, trust boundaries, release gates, authentication/recovery, backup cryptographic format, project-policy admission, supply-chain trust root, required capabilities, UI identity, or repository-governance qualification SHALL advance the contract-suite semantic version rather than silently changing the meaning of an existing suite version.

No ordinary “later ADR silently supersedes this contract until someone eventually reconciles it” workflow is allowed.

If current normative documents conflict, the contract is defective and implementation SHALL stop at that ambiguity until the documents are reconciled.

---

# 30. DEFERRED / NON-GOALS FOR V1

V1 does not require:

- Linux production artifacts or Linux runtime qualification;
- Android/other companion application implementation;
- remote companion networking/gateway implementation;
- cross-platform Windows↔Linux state migration/restore qualification;
- integrated browser automation;
- mobile/remote web clients;
- LAN AI nodes;
- unrestricted computer-control agents;
- mandatory local large-LLM inference;
- custom foundation-model training/inference infrastructure;
- privileged Windows service architecture solely to claim same-user-malware isolation;
- an open arbitrary executable plugin marketplace;
- direct public Internet ingress to privileged Core;
- light theme, multiple visual themes, a 3D avatar, or a separate visual identity per integration/platform;
- GitHub repository/secrets/branch-protection administration as a JARVIS product capability;
- generic Proxmox storage/network administration;
- direct Proxmox Backup Server administration.

The absence of Linux/companion delivery from V1 SHALL NOT be used to justify violating the Platform Portability Contract during Windows implementation.

---

# 31. GOVERNING PRINCIPLES

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

> **Escalate product judgment. Resolve engineering judgment.**

> **One system. One identity. Any screen.**

> **Abstract the capability, not the security away.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**

> **One authoritative host. Multiple interaction surfaces may come later.**

> **A repository file is data until an authenticated user enrolls its exact policy identity.**

> **A valid historical signature is not perpetual authorization to activate.**

> **Build the control plane first, prove recoverability early, then give intelligence access to it.**

> **Version the current truth; do not make implementers infer it from history.**

> **A capable assistant on the good day, a controlled system on the dangerous day, and a recoverable system on the bad day.**

---

**END — JARVIS IMPLEMENTATION, SECURITY, OPERATIONS & PRODUCTION CONTRACT SUITE v1.0.6**
