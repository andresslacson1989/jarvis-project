# JARVIS Production Implementation Plan

**Status:** Authoritative dependency/sequencing plan for v1.0.4  
**Version:** 1.0.4  
**Date:** August 12, 2026  
**Release target:** `docs/JARVIS-V1-RELEASE-PROFILE.md`

This is not a simplified MVP plan. Intermediate phases are proof checkpoints; final completion means the active Release Profile and Verification Contract pass for exact signed artifacts.

No application implementation begins merely because this plan exists. This document defines the sequence to use when implementation is explicitly started.

V1 implements a Windows `FULL_HOST`. The plan SHALL preserve the platform capability boundaries required for a future Linux `FULL_HOST`, but SHALL NOT expand V1 into Linux or Android implementation work.

---

# 1. DELIVERY ORDER

```text
repository protection / platform contracts / coding standards / CI
→ shared Core/domain + Windows Tauri platform host + Mission Control foundation
→ PlatformLocalIpc + PlatformProcessSupervisor Windows backends
→ SQLite/SQLCipher/WAL + PlatformSecureStorage Windows backend + portable-backup/KDF proof
→ authoritative state machines/events
→ session security / PermissionEngine / approval
→ projects/context/memory/platform-aware execution scopes
→ Codex Windows provider setup/repair + compatibility + real sandbox proof
→ controlled local tools through platform boundaries
→ bounded workers/graphs
→ resources/budgets/recovery
→ credentials + mandatory GitHub/Proxmox integrations
→ voice through platform audio/device boundary
→ event/automation
→ full UI/operations productization + updater
→ complete Windows production qualification
```

The platform boundary is cross-cutting: Phase 0 defines it, Phase 1 composes the Windows backend through it, every later native feature respects it, and final qualification proves no Windows implementation details leaked into shared Core/domain/policy where a semantic capability belongs.

The UI identity/accessibility system is also cross-cutting: Phase 1 establishes it, every later user-facing phase uses it, and final qualification proves the complete product.

---

# 2. PHASE 0 — REPOSITORY / PLATFORM CONTRACTS / TOOLCHAIN / GOVERNANCE

## Deliverables

- monorepo package boundaries from Coding Standards;
- `packages/platform-contracts/` or equivalent semantic native-capability contracts;
- `platform/windows/` or equivalent Windows backend boundary;
- future `platform/linux/` namespace reserved/documented without implementing a Linux runtime;
- explicit `PlatformFamily`, `RuntimeRole`, `PlatformRuntimeIdentity`, and platform compatibility schemas;
- semantic capability responsibilities for secure storage, local IPC, process supervision, session observation, window control, notifications, paths/identity, audio, updater, privilege mediation, and system info;
- narrow OS composition/factory boundary;
- forbidden-import/architecture rules preventing Windows backend imports in shared Core/domain/policy/protocol code;
- pinned Node/Rust/TypeScript/Tauri/package manager toolchains;
- strict TypeScript;
- Rust fmt/clippy;
- schema generation/validation strategy;
- test layer directories including platform/UI/accessibility/provider-setup layers;
- CI format/type/build/unit/property/schema/platform-architecture baseline;
- secret/dependency/license scan;
- root `AGENTS.md`;
- current contract manifest validation in CI;
- GitHub ruleset/branch protection for authoritative `master`.

## Required platform architecture proof

Before exit:

- shared Core/domain/policy code has no direct Win32/DPAPI/named-pipe/Job-Object/HWND/SID/UAC dependency;
- OS selection occurs only in composition/platform-adapter/explicit platform-specific code;
- platform capability absence has a typed fail/degrade path;
- Windows-only dependencies are permitted inside the Windows backend when justified;
- no weak generic mechanism replaces a stronger Windows requirement merely for portability;
- Linux remains unimplemented/unqualified and cannot appear supported.

## Required repository protection

Before exit:

- `master` deletion is blocked;
- force push is blocked;
- mandatory CI checks are required once defined;
- bypass permissions are narrowly controlled/auditable;
- pull-request review is strongly preferred for implementation changes;
- no second long-lived authoritative branch exists.

## Exit

Clean checkout builds reproducibly; UI/Core compile separately; schemas/tests run; platform/import architecture is enforceable; contract manifest is current; repository history protection is active; no business logic is vendor- or Windows-backend-bound.

---

# 3. PHASE 1 — WINDOWS TAURI HOST, MISSION CONTROL FOUNDATION, SHARED APPLICATION-OWNED CORE

## Deliverables

- Tauri 2 + bundled React UI;
- production local-only authoritative WebView content;
- explicit Tauri capabilities;
- restrictive CSP/navigation/external-link/devtools policy;
- Rust Windows platform host/composition root;
- shared platform-contract interfaces consumed by native-dependent features;
- Windows implementations for initial window/session/system/platform-path responsibilities;
- single instance;
- packaged release-owned Node runtime + prebuilt Core;
- controlled Core environment/path;
- initial Windows Job Object implementation behind PlatformProcessSupervisor;
- locked startup UI;
- canonical brand assets from `assets/brand/` wired into application packaging;
- local/offline Inter font packaging and license/provenance record;
- centralized design tokens/components foundation;
- Mission Control shell with navigation/status/primary/context regions;
- deterministic native window presentation through PlatformWindowController;
- responsive layout infrastructure, keyboard focus primitives, semantic accessibility baseline, reduced-motion and forced-colors/high-contrast token strategy.

## Exit

- application runs on clean Windows target with no system Node;
- platform composition selects the Windows backend deterministically;
- shared Core/domain does not import Windows backend implementation;
- privileged remote-origin Tauri capability tests fail closed;
- CSP/navigation/untrusted-render tests pass;
- selected Tauri/runtime includes required security fixes;
- missing/corrupt bundled Core/runtime enters repair/recovery rather than PATH fallback;
- canonical mark/lockup/app-icon sources render from one design system;
- Mission Control can show/hide/fullscreen/restore context without making renderer authoritative;
- keyboard focus/accessibility primitives exist before feature screens proliferate.

---

# 4. PHASE 2 — PLATFORM LOCAL IPC / PROCESS / PRIVILEGE BOUNDARIES

## Deliverables

Semantic contracts first:

```text
PlatformLocalIpc
PlatformProcessSupervisor
PlatformPrivilegeMediator
```

Windows V1 implementations:

- unpredictable named-pipe endpoint;
- explicit restrictive DACL/logon-session identity;
- local-only/remote rejection;
- bootstrap secret over non-command-line channel;
- protocol-major 1 framing + explicit response union;
- bounded frame/schema validation;
- Rust Windows Process Supervisor;
- Job Object kill-on-close + creation-time/suspended assignment;
- handle allowlist;
- clean/forced shutdown handling;
- narrow typed UAC/elevation mediation capable of invoking only explicitly qualified setup/repair operations later; no generic elevated shell/path API.

## Exit

Intended Core can connect; unauthorized user/session/remote/wrong secret cannot; renderer cannot open Core channel; managed child/grandchild containment/orphan cleanup pass; elevation broker cannot execute arbitrary Core/AI command; shared Core sees semantic interfaces/errors rather than named-pipe/Job-Object/UAC implementation objects.

---

# 5. PHASE 3 — PERSISTENCE / PLATFORM SECURE STORAGE / KDF / PORTABLE-RESTORE PROOF

This proof occurs before broad stateful feature development.

## Deliverables

- selected production Node SQLite/SQLCipher binding;
- exact embedded SQLite build/fix evidence;
- WAL activation, FULL synchronous, foreign keys, busy handling;
- WAL/checkpoint diagnostics;
- PlatformSecureStorage semantic boundary;
- random local `DB_DEK` protected by Windows secure-storage backend;
- versioned Argon2id profile schema/persistence;
- production KDF floor enforcement: v0x13, >=64 MiB, >=3 passes, 4 lanes, >=16-byte random salt, >=32-byte output;
- distinct session-password and portable-recovery profiles;
- SQLite-safe backup snapshot;
- fresh `SnapshotDBKey` re-key/export path;
- fresh per-backup `BackupDEK`;
- authenticated package container;
- Windows local DPAPI/secure-store key slot;
- portable Argon2id key slot recording exact KDF profile and independent of historical DPAPI;
- clean-profile Windows restore + fresh local DB_DEK re-key;
- corruption/integrity handling;
- production-style packaged execution.

## Required proof

```text
packaged Windows Core
+ encrypted DB create/open
+ WAL/foreign keys/transactions
+ WAL-reset fixed embedded core
+ production KDF floor reject/accept fixtures
+ verifier/key-slot parameter round-trip
+ online backup with WAL data
+ fresh snapshot key
+ fresh outer backup key
+ Windows local restore
+ wrong portable factor failure
+ clean-profile portable restore without old DPAPI/DB_DEK
+ re-key under fresh new local DB_DEK
+ corruption detection
```

Cross-platform restore is not required. The portable cryptographic envelope must nevertheless avoid dependence on historical Windows-local key material.

If chosen binding/crypto library/package fails a mandatory property, replace it; do not weaken encryption/recovery/WAL/KDF/platform rules.

---

# 6. PHASE 4 — AUTHORITATIVE STATE / EVENTS

## Deliverables

- schema/migrations;
- PlatformFamily/RuntimeRole/backend identity/support records where required;
- platform-tagged path representation;
- mission/task/attempt states including durable `RESUMING`;
- discriminated ExecutionScope;
- immutable graph/acceptance structures;
- approvals/canonical descriptor storage;
- transactional events;
- optimistic versioning;
- DataSensitivity/DataLocality;
- artifacts/checkpoints/leases;
- KDF profile/verifier metadata;
- provider setup/qualification/platform state;
- exact money/usage/reservation primitives;
- backup/update/recovery metadata.

## Exit

Illegal state changes fail; state+causative event atomicity works; stale version cannot overwrite; non-project scopes need no fake workspace; provider setup is distinct from compatibility/health/platform support; protocol/persistence representations agree; shared durable state does not persist native Windows handles as domain identity.

---

# 7. PHASE 5 — SESSION SECURITY / PERMISSIONENGINE / APPROVAL

## Deliverables

- Argon2id session password using production profile floor;
- cooldown/rate limits;
- profile-version rehash/upgrade path;
- PlatformSessionObserver boundary with Windows lock/sign-out implementation;
- explicit recovery-factor/password-reset path;
- Credential Broker over PlatformSecureStorage;
- authority envelopes;
- exact PermissionEngine precedence;
- platform-capability gate before ALLOW;
- LOW/MODERATE/HIGH/CRITICAL behavior;
- standing permission + precedent restrictions;
- `CanonicalActionDescriptorV1` builder;
- RFC8785/SHA256/base64url Rust+TS vectors;
- expiry/single-use transactional approval consumption;
- locked data suppression.

## Exit

Hard invariant/deny precedence, HIGH authority rules, precedent limits, CRITICAL final confirmation, digest invalidation, KDF floor/versioning, same-user threat wording, recovery password semantics, locality, and platform-capability fail-closed tests all pass.

---

# 8. PHASE 6 — PROJECTS / SCOPES / CONTEXT / MEMORY

## Deliverables

- project aliases/environments/workspaces/worktrees;
- integration/system/global scopes;
- PlatformPathRef/equivalent canonical path identity;
- Windows path canonicalization backend;
- Context Manager;
- memory confidence/revisions/data policy;
- scoped ranked retrieval;
- conversation/history separation;
- live-state-over-memory behavior.

## Exit

Project aliases resolve; project writes require exact `PROJECT_WORKSPACE`; integration-only work has no fake filesystem authority; Windows reparse/UNC/drive/path checks pass; platform-tagged path cannot be accidentally interpreted under wrong platform semantics; memory respects scope/policy; local-only derived context remains local-only.

---

# 9. PHASE 7 — CODEX WINDOWS PROVIDER SETUP + SANDBOX QUALIFICATION

## Deliverables

- Provider Registry/Router/Supervisor/SetupCoordinator;
- setup vs compatibility vs health vs platform support states;
- exact Codex Windows distribution/executable/helper/version policy;
- stable structured/non-interactive adapter;
- orchestrator profile;
- `WORKSPACE_ENGINEERING` profile;
- controlled env/working directory;
- provider sandbox mode configuration;
- explicit setup/repair UI/state flow;
- qualified setup-helper identity validation;
- UAC through PlatformPrivilegeMediator Windows operation only;
- PlatformProcessSupervisor integration;
- cancellation/timeouts/circuit breaker;
- provider quota/usage provenance;
- optional resume reference handling.

## Mandatory Windows setup/sandbox proof

Measure/verify actual selected Codex behavior:

- setup-required detection works;
- UAC runs only the qualified setup helper/path and cannot become generic elevated command execution;
- cancel/failure leaves setup non-ready;
- helper exit alone does not imply ready;
- provider setup readiness is re-probed and conformance tested;
- provider update invalidates/rechecks readiness where required;
- ordinary workers remain non-elevated after setup;
- provider-internal sandbox credentials do not enter JARVIS logs/Core state;
- writes confined as required;
- network denied by default profile;
- read-access boundary documented truthfully;
- no unrelated credentials in env/context;
- Job Object descendant containment;
- shell/client availability cannot bypass JARVIS typed external-action authorization;
- qualification record binds to `WINDOWS + FULL_HOST`.

## Exit

Qualified Windows Codex version/setup runs orchestrator/engineering flows; unsupported/unready or wrong-platform profile excluded; invalid output fails; provider crash contained; privacy/locality respected; fresh-session recovery works if provider resume unavailable; no unsafe sandbox downgrade exists.

No Linux Codex runtime is implemented or claimed here.

---

# 10. PHASE 8 — TOOL REGISTRY / SAFE LOCAL CAPABILITIES

Required first tools include project/system status, Git status/branch/diff/log, open app/project/file, approved project test/build execution, and narrow filesystem read/write.

## Deliverables

- manifests/input/output schemas;
- required semantic platform capabilities/platform compatibility declarations;
- ToolExecutor;
- canonical target resolution;
- PermissionEngine integration;
- pre/postconditions;
- idempotency/uncertainty;
- conditional mutation expected-state mechanisms where supported;
- audit.

## Exit

Path/reparse tests pass; platform capability mismatch blocks; scope mismatch blocks; changed target/version fails precondition; stale approval cannot retarget; `UNCERTAIN` works; semantic success requires postcondition evidence.

---

# 11. PHASE 9 — BOUNDED WORKERS

## Deliverables

- worker roles/attempts;
- platform identity on attempts/qualification evidence;
- journals/checkpoints/artifacts;
- iteration/time/resource/budget ceilings;
- no-progress detection;
- structured results/replan/block;
- isolated engineering worktrees;
- pause/cancel primitives;
- Mission Control work/queue/activity components using canonical design system.

## Exit

Engineering worker can inspect/edit/build/test bounded Windows workspace; cannot widen scope/authority; parallel writers are isolated; provider-private history not required for recovery; no-progress loops terminate/replan; dashboard truth derives from authoritative state.

---

# 12. PHASE 10 — MISSION GRAPH

## Deliverables

- Mission Manager / Graph Planner;
- immutable graph versions;
- real dependency types;
- mission acceptance policy;
- fan-out/reduce/verify/synthesize;
- scheduler/queue transparency;
- dynamic replan validator;
- artifact reuse/invalidation;
- Mission Control mission/graph/verification UX.

## Exit

Independent work can run concurrently within deterministic scheduling; cycles rejected; revisions are historical/versioned; invalid outputs cannot feed current graph; mission cannot complete with required unknown/blocked work; UI does not fabricate progress percentages/ETA.

---

# 13. PHASE 11 — RESOURCES / BUDGETS / RECOVERY

## Deliverables

- priorities/preemption;
- durable `RESUMING`;
- leases;
- CPU/RAM/GPU/provider/platform resource observation;
- provider quota snapshots;
- exact MoneyAmount budgets;
- atomic reservations/settlement;
- recovery policy/reconciliation;
- startup transient-state scan;
- transparent queue/block/recovery/platform-unavailable UI states.

## Exit

Priority can preempt safely; unnecessary preemption avoided; resume validates state/provider setup/locality/platform capabilities/leases; concurrent hard-budget race is safe; ambiguous external effect never blindly retries; outstanding reservations survive recovery.

---

# 14. PHASE 12 — CREDENTIALS / MODULE FOUNDATION

## Deliverables

- integration account registry;
- PlatformSecureStorage credential handles;
- authenticated module catalog/provenance;
- DATA_ONLY/BUILT_IN_TRUSTED/EXTERNAL_MANAGED execution classes;
- platform/runtime-role compatibility in module manifests;
- typed module IPC/health/lifecycle;
- module staging/rollback;
- dashboard state distinctions.

## Exit

No raw credentials in normal DB/log/prompts/backups; external executable cannot run in Core; wrong-platform/unsupported module not labeled supported; crash/update rollback works; Windows process containment works for external module.

---

# 15. PHASE 13 — LOCAL GIT / GITHUB PRODUCTION INTEGRATION

## Mandatory GitHub V1 capabilities

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

`GITHUB_ACTIONS_DISPATCH` is optional for base V1. Repository/secrets/branch-protection/member administration, repository deletion, and ref deletion are not mandatory V1 capabilities.

## Deliverables

- production Windows Local filesystem/Git integration through platform path/process boundaries;
- scoped GitHub credential/account/capability model;
- exact capability enum/support matrix;
- repository/ref identity;
- typed mandatory GitHub read/write operations;
- expected-ref/conditional-write protections for `GITHUB_REF_WRITE`;
- rate limit/auth expiry/retry/uncertainty behavior;
- explicit rejection of admin/secrets/protection/delete overreach;
- Mission Control integration/support/capability state UI;
- conformance suite.

## Exit

Both mandatory families and every mandatory GitHub capability are `SUPPORTED` on the Windows V1 profile, credential-safe, scope-safe, race-safe, recoverable, auditable, and pass Release Profile conformance. Optional capability presence does not change base-V1 completion.

---

# 16. PHASE 14 — PROXMOX VE V1

## Mandatory Proxmox V1 capabilities

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

`PROXMOX_STORAGE_WRITE` and `PROXMOX_NETWORK_WRITE` are optional/non-blocking for base V1 and require full qualification if enabled.

## Deliverables

- connection wizard/registry;
- scoped API-token credential flow;
- TLS trust/pin;
- cluster/node/QEMU/LXC discovery;
- read-only onboarding;
- typed mandatory operations;
- strict narrower semantics preventing guest operations from becoming generic storage/network/PBS administration;
- node/VMID/pool scope;
- asynchronous task tracking;
- postcondition/live verification;
- destructive final confirmation;
- no raw API/shell fallback;
- guest-shell separation;
- Mission Control Proxmox capability/health/approval UI.

## Exit

All mandatory Proxmox capabilities pass Windows V1 conformance; optional storage/network-write capabilities are absent/disabled or separately fully qualified/listed.

---

# 17. PHASE 15 — VOICE FOUNDATION

## Deliverables

- PlatformAudioBackend contract integration;
- Windows audio device manager;
- push-to-talk;
- local STT;
- VAD;
- selected TTS provider/persistent voice;
- typed transcript/voice state;
- local latency instrumentation;
- Mission Control voice-state components using canonical identity.

## Exit

Voice input reliable on Windows; text fallback always usable; device reconnect works; locked privacy/DataLocality enforced; TTS identity/provider/licensing frozen for RC.

---

# 18. PHASE 16 — FULL-DUPLEX VOICE

## Deliverables

- AEC provider + exact TTS render reference;
- realtime conversation engine;
- physical/semantic turn detection;
- barge-in/double-talk;
- interruptible speech;
- deterministic stop/mute/cancel;
- half-duplex fallback;
- optional wake-word interface.

## Exit

Barge-in and stop latency pass target on real Windows devices; AEC double-talk qualifies; stale transcript cannot submit; AEC failure safely degrades.

---

# 19. PHASE 17 — EVENT / AUTOMATION / NOTIFICATION

## Deliverables

- normalized Event Gateway;
- source auth/signature validation;
- durable dedup/replay protection;
- scheduled/poll/local triggers;
- automation authority envelopes/scopes;
- notification grouping/focus/defer;
- PlatformNotificationBackend where native delivery is used;
- no required direct public privileged-Core ingress;
- Mission Control notification/focus UX.

## Exit

Duplicate event cannot duplicate consequence; automation obeys normal permission/locality/budget; locked private content not spoken; trigger storms bounded; no remote companion gateway is invented as a shortcut.

---

# 20. PHASE 18 — UI / OPERATIONS / BACKUP / DIAGNOSTICS / UPDATE PRODUCTIZATION

The cryptographic backup proof exists from Phase 3 and the UI/platform identity foundation from Phase 1; this phase completes all operational surfaces and qualification fixtures before RC.

## Deliverables

- completed Mission Control shell across every V1 subsystem;
- dedicated Windows window flows through PlatformWindowController;
- adaptive compact/medium/wide/ultrawide behavior;
- 100/125/150/200% Windows scaling fixtures;
- 200% text-size and 320 CSS px/400%-equivalent reflow fixtures;
- keyboard/semantic accessibility;
- Windows High Contrast/forced-colors support where applicable;
- reduced-motion behavior;
- canonical brand asset generation pipeline for Windows PNG/ICO/installer artifacts while retaining platform-neutral source assets;
- font/icon/visual asset license/provenance notices;
- scheduled/local backup retention;
- portable backup creation/verification UX;
- recovery-factor setup/rotation UX;
- restore maintenance mode;
- corruption recovery;
- WAL/provider/setup/security/platform diagnostics dashboard;
- diagnostic export/redaction;
- PlatformUpdateBackend with signed Windows updater/staged activation;
- binary/schema/runtime/backup rollback pairing;
- release manifest generation including platform/runtime/backend support identity.

## Exit

Full Windows local + portable restore drills pass; bad migration/startup recovers known-good pair; tampered update rejected; diagnostics identify common subsystem/platform failures; all UI Identity Contract completion criteria pass; shared UI components remain free of unnecessary Windows-only semantic coupling.

---

# 21. PHASE 19 — WINDOWS V1 PRODUCTION QUALIFICATION

Run the full v1.0.4 Verification Contract on exact signed Windows FULL_HOST Release Candidate artifacts:

- contract manifest / Release Profile;
- repository/CI protection evidence;
- static/strict/architecture;
- platform composition/import boundary;
- protocol/canonicalization/platform schemas;
- Mission Control UI identity/adaptive/accessibility;
- Tauri/WebView;
- Windows named-pipe/Job Objects;
- KDF/session/recovery profiles;
- PermissionEngine/destructive boundaries;
- Codex Windows setup/compatibility/sandbox;
- tools/races;
- SQLite/SQLCipher/WAL;
- backup/portable restore;
- crash/recovery;
- exact budget;
- Local Git + exact GitHub capability matrix;
- exact Proxmox capability matrix;
- modules/update;
- voice;
- event automation;
- resource/performance;
- clean install/upgrade/rollback;
- soak;
- signed packaging/SBOM/license/provenance.

Linux runtime and Android companion tests are explicitly outside this V1 qualification.

## Exit

Zero P0/P1; Critical/High vulnerability policy passes; all V1 journeys pass; rollback/recovery verified; Production Complete evidence references exact Windows artifacts/source/profile/contract/platform identity.

---

# 22. FIRST IMPLEMENTATION SLICE

The first code slice intentionally stops before AI autonomy:

```text
platform capability contracts + composition root
→ Windows platform backend skeleton
→ Tauri/React bundled local Mission Control shell
→ canonical brand/tokens/accessibility foundation
→ shared Node Core
→ PlatformWindowController Windows implementation
→ Tauri capability/CSP boundary
→ PlatformLocalIpc Windows named-pipe implementation
→ PlatformProcessSupervisor Windows Job Object implementation
→ transactional state/event skeleton
→ locked session + harmless get_system_status
```

Then immediately execute the Phase-3 SQLite/SQLCipher/PlatformSecureStorage/KDF/portable-restore proof.

Only after trust, persistence, recovery, session, and platform boundaries pass should Codex setup/autonomy be introduced.

Do not start by giving Codex a shell and letting working behavior become the architecture. Do not implement Linux merely to prove the abstraction; prove the abstraction through boundaries/tests and build the Windows backend completely.

---

# 23. ENGINEERING WORKFLOW

Significant work uses temporary isolated branches/worktrees created from live protected `master`.

Re-fetch live `master` before writes when concurrent work is possible and preserve valid changes.

Contract/schema change includes compatibility/migration impact. Security/recovery change includes negative/failure tests. UI identity/accessibility change includes qualification impact. Platform-native change includes capability-contract and platform-support impact.

A material implementation-vs-contract conflict is corrected or goes through the synchronous ADR + canonical contract + manifest amendment process. Code never silently becomes the new architecture because it was easier.

Windows-only dependencies belong in the Windows backend unless the shared layer genuinely requires them. Shared code SHALL not gain OS conditionals as a shortcut around platform composition.

Accepted temporary branches are merged/rebased through protected workflow and deleted; `master` remains the sole authoritative line.

---

# 24. FUTURE LINUX / COMPANION WORK

Future Linux full-host implementation begins only after an explicit future contract/Release Profile defines concrete supported Linux distributions, native backends, packaging/update, provider/voice behavior, and qualification.

Future companion work begins only after an explicit Remote Access Gateway/security/protocol contract defines device enrollment, cryptographic identity, authenticated encryption, replay resistance, revocation, per-device authority, remote instruction provenance, approvals, privacy, rate limiting, and audit.

Neither is part of the Windows V1 implementation plan.

---

# 25. RELEASE CHECKPOINTS

```text
Repository Governance + Platform Boundary Ready
Windows Desktop Trust + Mission Control Foundation Ready
Persistence/KDF/Portable Recovery Proven
Core State Ready
Security/Permission Boundary Ready
Codex Windows Setup/Provider/Sandbox Ready
Tool Runtime Ready
Worker Runtime Ready
Mission Runtime Ready
GitHub Capability Matrix Ready
Proxmox Capability Matrix Ready
Voice Runtime Ready
Operations/UI/Update Ready
Windows Release Candidate
Production Complete
```

Only final checkpoint is Production Complete.

---

# 26. GOVERNING PRINCIPLES

> **Build the control plane first, prove recoverability early, then give intelligence access to it. Harden and test each boundary before depending on it.**

> **Build the product identity into the shell before feature screens multiply.**

> **Abstract the capability, not the security away.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**

---

**END — JARVIS PRODUCTION IMPLEMENTATION PLAN v1.0.4**
