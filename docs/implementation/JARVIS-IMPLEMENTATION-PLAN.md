# JARVIS Production Implementation Plan

**Status:** Authoritative dependency/sequencing plan for v1.0.3  
**Version:** 1.0.3  
**Date:** August 12, 2026  
**Release target:** `docs/JARVIS-V1-RELEASE-PROFILE.md`

This is not a simplified MVP plan. Intermediate phases are proof checkpoints; final completion means the active Release Profile and Verification Contract pass for exact signed artifacts.

No application implementation begins merely because this plan exists. This document defines the sequence to use when implementation is explicitly started.

---

# 1. DELIVERY ORDER

```text
repository protection / coding standards / CI
→ Tauri native trust boundary + Mission Control shell + application-owned Core
→ named-pipe + WebView security
→ SQLite/SQLCipher/WAL + portable-backup/KDF proof
→ authoritative state machines/events
→ session security / PermissionEngine / approval
→ projects/context/memory/execution scopes
→ Codex provider setup/repair + compatibility + real sandbox proof
→ controlled local tools
→ bounded workers/graphs
→ resources/budgets/recovery
→ credentials + mandatory GitHub/Proxmox integrations
→ voice
→ event/automation
→ full UI/operations productization + updater
→ complete production qualification
```

The UI identity/accessibility system is cross-cutting: Phase 1 establishes it, every later user-facing phase uses it, and final qualification proves the complete product. A later privileged subsystem SHALL NOT be used as a shortcut around an earlier unproven boundary.

---

# 2. PHASE 0 — REPOSITORY / TOOLCHAIN / GOVERNANCE

## Deliverables

- monorepo package boundaries from Coding Standards;
- pinned Node/Rust/TypeScript/Tauri/package manager toolchains;
- strict TypeScript;
- Rust fmt/clippy;
- schema generation/validation strategy;
- test layer directories including UI/accessibility/provider-setup layers;
- architecture import checks;
- CI format/type/build/unit/property/schema baseline;
- secret/dependency/license scan;
- root `AGENTS.md`;
- current contract manifest validation in CI;
- GitHub ruleset/branch protection for authoritative `master`.

## Required repository protection

Before exit:

- `master` deletion is blocked;
- force push is blocked;
- mandatory CI checks are required once defined;
- bypass permissions are narrowly controlled/auditable;
- pull-request review is strongly preferred for implementation changes;
- no second long-lived authoritative branch exists.

## Exit

Clean checkout builds reproducibly; UI/Core compile separately; schemas/tests run; architecture imports are enforceable; contract manifest is current; repository history protection is active; no business logic is vendor-bound.

---

# 3. PHASE 1 — TAURI HOST, MISSION CONTROL FOUNDATION, APPLICATION-OWNED CORE

## Deliverables

- Tauri 2 + bundled React UI;
- production local-only authoritative WebView content;
- explicit Tauri capabilities;
- restrictive CSP/navigation/external-link/devtools policy;
- Rust native host;
- single instance;
- packaged release-owned Node runtime + prebuilt Core;
- controlled Core environment/path;
- initial Job Object hierarchy;
- locked startup UI;
- canonical brand assets from `assets/brand/` wired into application packaging;
- local/offline Inter font packaging and license/provenance record;
- centralized design tokens/components foundation;
- Mission Control shell with navigation/status/primary/context regions;
- deterministic native window presentation model for hidden/windowed/maximized/fullscreen/focused-context;
- responsive layout infrastructure, keyboard focus primitives, semantic accessibility baseline, reduced-motion and forced-colors/high-contrast token strategy.

## Exit

- application runs on clean Windows target with no system Node;
- privileged remote-origin Tauri capability tests fail closed;
- CSP/navigation/untrusted-render tests pass;
- selected Tauri/runtime includes required security fixes;
- missing/corrupt bundled Core/runtime enters repair/recovery rather than PATH fallback;
- canonical mark/lockup/app-icon sources render from one design system;
- Mission Control can show/hide/fullscreen/restore context without making renderer authoritative;
- keyboard focus and accessibility primitives are available before feature screens proliferate.

---

# 4. PHASE 2 — SECURE LOCAL IPC / PROCESS / ELEVATION BROKER

## Deliverables

- unpredictable named-pipe endpoint;
- explicit restrictive DACL/logon-session identity;
- local-only/remote rejection;
- bootstrap secret over non-command-line channel;
- protocol-major 1 framing + explicit response union;
- bounded frame/schema validation;
- Rust Process Broker;
- Job Object kill-on-close + creation-time/suspended assignment;
- handle allowlist;
- clean/forced shutdown handling;
- narrow typed elevation mediation capable of invoking only explicitly qualified setup/repair operations later; no generic elevated shell/path API.

## Exit

Intended Core can connect; unauthorized user/session/remote/wrong secret cannot; renderer cannot open Core channel; managed child/grandchild containment and orphan cleanup pass; elevation broker cannot execute arbitrary command supplied by Core/AI.

---

# 5. PHASE 3 — PERSISTENCE / ENCRYPTION / KDF / PORTABLE-RESTORE PROOF

This proof occurs before broad stateful feature development.

## Deliverables

- selected production Node SQLite/SQLCipher binding;
- exact embedded SQLite build/fix evidence;
- WAL activation, FULL synchronous, foreign keys, busy handling;
- WAL/checkpoint diagnostics;
- random local `DB_DEK` through Rust secure storage;
- versioned Argon2id profile schema/persistence;
- production KDF floor enforcement: v0x13, >=64 MiB, >=3 passes, 4 lanes, >=16-byte random salt, >=32-byte output;
- distinct session-password and portable-recovery profiles;
- SQLite-safe backup snapshot;
- fresh `SnapshotDBKey` re-key/export path;
- fresh per-backup `BackupDEK`;
- authenticated package container;
- local DPAPI key slot;
- portable Argon2id key slot recording exact KDF profile;
- clean-profile restore + fresh local DB_DEK re-key;
- corruption/integrity handling;
- production-style packaged execution.

## Required proof

```text
packaged Core
+ encrypted DB create/open
+ WAL/foreign keys/transactions
+ WAL-reset fixed embedded core
+ production KDF floor reject/accept fixtures
+ verifier/key-slot parameter round-trip
+ online backup with WAL data
+ fresh snapshot key
+ fresh outer backup key
+ local restore
+ wrong portable factor failure
+ clean-profile portable restore without old DPAPI/DB_DEK
+ re-key under fresh new local DB_DEK
+ corruption detection
```

If chosen binding/crypto library/package fails a mandatory property, replace it; do not weaken encryption/recovery/WAL/KDF rules.

---

# 6. PHASE 4 — AUTHORITATIVE STATE / EVENTS

## Deliverables

- schema/migrations;
- mission/task/attempt states including durable `RESUMING`;
- discriminated ExecutionScope;
- immutable graph/acceptance structures;
- approvals/canonical descriptor storage;
- transactional events;
- optimistic versioning;
- DataSensitivity/DataLocality;
- artifacts/checkpoints/leases;
- KDF profile/verifier metadata;
- provider setup/qualification state;
- exact money/usage/reservation primitives;
- backup/update/recovery metadata.

## Exit

Illegal state changes fail; state+causative event atomicity works; stale version cannot overwrite; non-project scopes need no fake workspace; provider setup is distinct from compatibility/health; protocol/persistence representations agree.

---

# 7. PHASE 5 — SESSION SECURITY / PERMISSIONENGINE / APPROVAL

## Deliverables

- Argon2id session password using production profile floor;
- cooldown/rate limits;
- profile-version rehash/upgrade path;
- Windows lock/sign-out;
- explicit recovery-factor/password-reset path;
- Credential Broker;
- authority envelopes;
- exact PermissionEngine precedence;
- LOW/MODERATE/HIGH/CRITICAL behavior;
- standing permission + precedent restrictions;
- `CanonicalActionDescriptorV1` builder;
- RFC8785/SHA256/base64url Rust+TS vectors;
- expiry/single-use transactional approval consumption;
- locked data suppression.

## Exit

Hard invariant/deny precedence, HIGH authority rules, precedent limits, CRITICAL final confirmation, digest invalidation, KDF floor/versioning, same-user threat wording, recovery password semantics, and locality tests all pass.

---

# 8. PHASE 6 — PROJECTS / SCOPES / CONTEXT / MEMORY

## Deliverables

- project aliases/environments/workspaces/worktrees;
- integration/system/global scopes;
- canonical Windows paths;
- Context Manager;
- memory confidence/revisions/data policy;
- scoped ranked retrieval;
- conversation/history separation;
- live-state-over-memory behavior.

## Exit

Project aliases resolve; project writes require exact `PROJECT_WORKSPACE`; integration-only work has no fake filesystem authority; memory respects scope/policy; local-only derived context remains local-only.

---

# 9. PHASE 7 — CODEX PROVIDER SETUP + SANDBOX QUALIFICATION

## Deliverables

- Provider Registry/Router/Supervisor/SetupCoordinator;
- setup vs compatibility vs health states;
- exact Codex distribution/executable/helper/version policy;
- stable structured/non-interactive adapter;
- orchestrator profile;
- `WORKSPACE_ENGINEERING` profile;
- controlled env/working directory;
- provider sandbox mode configuration;
- explicit setup/repair UI/state flow;
- qualified setup-helper identity validation;
- UAC through narrow Rust setup operation only;
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
- read-access boundary documented truthfully, with no workspace-only claim unless enforced;
- no unrelated credentials in env/context;
- Job Object descendant containment;
- shell/client availability cannot bypass JARVIS typed external-action authorization.

## Exit

Qualified Codex version/setup runs orchestrator/engineering flows; unsupported/unready version excluded; invalid output fails; provider crash contained; privacy/locality respected; fresh-session recovery works if provider resume unavailable; no unsafe sandbox downgrade exists.

---

# 10. PHASE 8 — TOOL REGISTRY / SAFE LOCAL CAPABILITIES

Required first tools include project/system status, Git status/branch/diff/log, open app/project/file, approved project test/build execution, and narrow filesystem read/write.

## Deliverables

- manifests/input/output schemas;
- ToolExecutor;
- canonical target resolution;
- PermissionEngine integration;
- pre/postconditions;
- idempotency/uncertainty;
- conditional mutation expected-state mechanisms where supported;
- audit.

## Exit

Path/reparse tests pass; scope mismatch blocks; changed target/version fails precondition; stale approval cannot retarget; `UNCERTAIN` works; semantic success requires postcondition evidence.

---

# 11. PHASE 9 — BOUNDED WORKERS

## Deliverables

- worker roles/attempts;
- journals/checkpoints/artifacts;
- iteration/time/resource/budget ceilings;
- no-progress detection;
- structured results/replan/block;
- isolated engineering worktrees;
- pause/cancel primitives;
- Mission Control work/queue/activity components using canonical design system.

## Exit

Engineering worker can inspect/edit/build/test bounded workspace; cannot widen scope/authority; parallel writers are isolated; provider-private history not required for recovery; no-progress loops terminate/replan; dashboard truth derives from authoritative state.

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
- CPU/RAM/GPU/provider concurrency;
- provider quota snapshots;
- exact MoneyAmount budgets;
- atomic reservations/settlement;
- recovery policy/reconciliation;
- startup transient-state scan;
- transparent queue/block/recovery UI states.

## Exit

Priority can preempt safely; unnecessary preemption avoided; resume validates state/provider setup/locality/leases; concurrent hard-budget race is safe; ambiguous external effect never blindly retries; outstanding reservations survive recovery.

---

# 14. PHASE 12 — CREDENTIALS / MODULE FOUNDATION

## Deliverables

- integration account registry;
- secure-store credential handles;
- authenticated module catalog/provenance;
- DATA_ONLY/BUILT_IN_TRUSTED/EXTERNAL_MANAGED execution classes;
- typed module IPC/health/lifecycle;
- module staging/rollback;
- dashboard state distinctions.

## Exit

No raw credentials in normal DB/log/prompts/backups; external executable cannot run in Core; unsupported module not labeled supported; crash/update rollback works; Job Object containment works for external module.

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

- production Local filesystem/Git integration;
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

Both mandatory families and every mandatory GitHub capability are `SUPPORTED`, credential-safe, scope-safe, race-safe, recoverable, auditable, and pass Release Profile conformance. Optional capability presence does not change base-V1 completion.

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
- typed mandatory power/snapshot/backup/guest-config/create/migrate/destroy operations;
- strict narrower semantics preventing guest operations from becoming generic storage/network/PBS administration;
- node/VMID/pool scope;
- asynchronous task tracking;
- postcondition/live verification;
- destructive final confirmation;
- no raw API/shell fallback;
- guest-shell separation;
- Mission Control Proxmox capability/health/approval UI.

## Exit

All mandatory Proxmox capabilities pass conformance; optional storage/network-write capabilities are either absent/disabled or separately fully qualified and listed; V1 cannot be Production Complete without the mandatory matrix.

---

# 17. PHASE 15 — VOICE FOUNDATION

## Deliverables

- audio device manager;
- push-to-talk;
- local STT;
- VAD;
- selected TTS provider/persistent voice;
- typed transcript/voice state;
- local latency instrumentation;
- Mission Control voice-state components using canonical identity.

## Exit

Voice input reliable; text fallback always usable; device reconnect works; locked privacy/DataLocality enforced; TTS identity/provider/licensing frozen for RC.

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

Barge-in and stop latency pass target on real devices; AEC double-talk qualifies; stale transcript cannot submit; AEC failure safely degrades.

---

# 19. PHASE 17 — EVENT / AUTOMATION / NOTIFICATION

## Deliverables

- normalized Event Gateway;
- source auth/signature validation;
- durable dedup/replay protection;
- scheduled/poll/local triggers;
- automation authority envelopes/scopes;
- notification grouping/focus/defer;
- no required direct public privileged-Core ingress;
- Mission Control notification/focus UX.

## Exit

Duplicate event cannot duplicate consequence; automation obeys normal permission/locality/budget; locked private content not spoken; trigger storms bounded.

---

# 20. PHASE 18 — UI / OPERATIONS / BACKUP / DIAGNOSTICS / UPDATE PRODUCTIZATION

The cryptographic backup proof exists from Phase 3 and the UI identity foundation from Phase 1; this phase completes all operational surfaces and qualification fixtures before RC.

## Deliverables

- completed Mission Control navigation/status/primary/context shell across every V1 subsystem;
- dedicated window show/hide/windowed/maximized/fullscreen/focused-context flows;
- adaptive compact/medium/wide/ultrawide behavior;
- 100/125/150/200% scaling fixtures;
- 200% text-size and 320 CSS px/400%-equivalent reflow fixtures;
- keyboard/semantic accessibility;
- Windows High Contrast/forced-colors support where applicable;
- reduced-motion behavior;
- canonical brand asset generation pipeline for PNG/ICO/installer artifacts;
- font/icon/visual asset license/provenance notices;
- scheduled/local backup retention;
- portable backup creation/verification UX;
- recovery-factor setup/rotation UX;
- restore maintenance mode;
- corruption recovery;
- WAL/provider/setup/security diagnostics dashboard;
- diagnostic export/redaction;
- signed updater/staged activation;
- binary/schema/runtime/backup rollback pairing;
- release manifest generation.

## Exit

Full local + portable restore drills pass; bad migration/startup recovers known-good pair; tampered update rejected; diagnostics identify common subsystem failures; all UI Identity Contract completion criteria pass on RC candidate builds; no required visual/accessibility behavior remains a future-polish item.

---

# 21. PHASE 19 — PRODUCTION QUALIFICATION

Run the full v1.0.3 Verification Contract on exact signed Release Candidate artifacts:

- contract manifest / Release Profile;
- repository/CI protection evidence;
- static/strict/architecture;
- protocol/canonicalization;
- Mission Control UI identity/adaptive/accessibility;
- Tauri/WebView;
- named-pipe/Job Objects;
- KDF/session/recovery profiles;
- PermissionEngine/destructive boundaries;
- Codex setup/compatibility/sandbox;
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

## Exit

Zero P0/P1; Critical/High vulnerability policy passes; all V1 journeys pass; rollback/recovery verified; Production Complete evidence references exact artifacts/source/profile/contract manifest.

---

# 22. FIRST IMPLEMENTATION SLICE

The first code slice intentionally stops before AI autonomy:

```text
Tauri/React bundled local Mission Control shell
→ canonical brand/tokens/accessibility foundation
→ Rust Host
→ native window-presentation ownership
→ Tauri capability/CSP boundary
→ ACL-restricted authenticated named pipe
→ application-owned Node Core
→ transactional state/event skeleton
→ locked session + harmless get_system_status
```

Then immediately execute the Phase-3 SQLite/SQLCipher/WAL/KDF/portable-restore proof.

Only after trust, persistence, recovery, and session foundations pass should Codex setup/autonomy be introduced.

Do not start by giving Codex a shell and letting working behavior become the architecture.

---

# 23. ENGINEERING WORKFLOW

Significant work uses temporary isolated branches/worktrees created from live protected `master`.

Re-fetch live `master` before writes when concurrent work is possible and preserve valid changes.

Contract/schema change includes compatibility/migration impact. Security/recovery change includes negative/failure tests. UI identity/accessibility change includes qualification impact.

A material implementation-vs-contract conflict is corrected or goes through the synchronous ADR + canonical contract + manifest amendment process. Code never silently becomes the new architecture because it was easier.

Accepted temporary branches are merged/rebased through protected workflow and deleted; `master` remains the sole authoritative line.

---

# 24. RELEASE CHECKPOINTS

```text
Repository Governance Ready
Desktop Trust + Mission Control Foundation Ready
Persistence/KDF/Portable Recovery Proven
Core State Ready
Security/Permission Boundary Ready
Codex Setup/Provider/Sandbox Ready
Tool Runtime Ready
Worker Runtime Ready
Mission Runtime Ready
GitHub Capability Matrix Ready
Proxmox Capability Matrix Ready
Voice Runtime Ready
Operations/UI/Update Ready
Release Candidate
Production Complete
```

Only final checkpoint is Production Complete.

---

# 25. GOVERNING PRINCIPLE

> **Build the control plane first, prove recoverability early, then give intelligence access to it. Harden and test each boundary before depending on it.**

> **Build the product identity into the shell before feature screens multiply.**

---

**END — JARVIS PRODUCTION IMPLEMENTATION PLAN v1.0.3**
