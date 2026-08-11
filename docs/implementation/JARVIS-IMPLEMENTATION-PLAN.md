# JARVIS Production Implementation Plan

**Status:** Authoritative dependency/sequencing plan for v1.0.2  
**Version:** 1.0.2  
**Date:** August 11, 2026  
**Release target:** `docs/JARVIS-V1-RELEASE-PROFILE.md`

This is not a simplified MVP plan. Intermediate phases are proof checkpoints; final completion means the active Release Profile and verification contract pass for exact signed artifacts.

---

# 1. DELIVERY ORDER

```text
repository/coding standards
→ Tauri/native trust boundary + application-owned Core
→ named-pipe + WebView security
→ SQLite/SQLCipher/WAL + portable-backup proof
→ authoritative state machines/events
→ session/security/PermissionEngine/approval
→ projects/context/memory/execution scopes
→ Codex/provider compatibility + real sandbox proof
→ controlled local tools
→ bounded workers/graphs
→ resources/budgets/recovery
→ credentials + mandatory GitHub/Proxmox integrations
→ voice
→ event/automation
→ updater/operations
→ complete production qualification
```

A later privileged subsystem SHALL NOT be used as a shortcut around an earlier unproven boundary.

---

# 2. PHASE 0 — REPOSITORY / TOOLCHAIN

## Deliverables

- monorepo package boundaries from Coding Standards;
- pinned Node/Rust/TypeScript/Tauri/package manager toolchains;
- strict TypeScript;
- Rust fmt/clippy;
- schema generation/validation strategy;
- test layer directories;
- architecture import checks;
- CI format/type/build/unit/property/schema baseline;
- secret/dependency scan;
- root `AGENTS.md`.

## Exit

Clean checkout builds reproducibly; UI/Core compile separately; schemas/tests run; architecture imports are enforceable; no business logic is vendor-bound.

---

# 3. PHASE 1 — TAURI HOST, WEBVIEW, APPLICATION-OWNED CORE

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
- locked startup UI.

## Exit

- application runs on clean Windows target with no system Node;
- privileged remote-origin Tauri capability tests fail closed;
- CSP/navigation/untrusted-render tests pass;
- selected Tauri/runtime includes required security fixes;
- missing/corrupt bundled Core/runtime enters repair/recovery rather than PATH fallback.

---

# 4. PHASE 2 — SECURE LOCAL IPC / PROCESS BROKER

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
- clean/forced shutdown handling.

## Exit

Intended Core can connect; unauthorized user/session/remote/wrong secret cannot; renderer cannot open Core channel; managed child/grandchild containment and orphan cleanup pass.

---

# 5. PHASE 3 — PERSISTENCE / ENCRYPTION / PORTABLE-RESTORE PROOF

This proof occurs before broad stateful feature development.

## Deliverables

- selected production Node SQLite/SQLCipher binding;
- exact embedded SQLite build/fix evidence;
- WAL activation, FULL synchronous, foreign keys, busy handling;
- WAL/checkpoint diagnostics;
- random local `DB_DEK` through Rust secure storage;
- SQLite-safe backup snapshot;
- fresh `SnapshotDBKey` re-key/export path;
- fresh per-backup `BackupDEK`;
- authenticated package container;
- local DPAPI key slot;
- portable Argon2id key slot;
- clean-profile restore + fresh local DB_DEK re-key;
- corruption/integrity handling;
- production-style packaged execution.

## Required proof

```text
packaged Core
+ encrypted DB create/open
+ WAL/foreign keys/transactions
+ WAL-reset fixed embedded core
+ online backup with WAL data
+ fresh snapshot key
+ fresh outer backup key
+ local restore
+ wrong portable factor failure
+ clean-profile portable restore without old DPAPI/DB_DEK
+ re-key under fresh new local DB_DEK
+ corruption detection
```

If chosen binding/package fails a mandatory property, replace it; do not weaken encryption/recovery/WAL rules.

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
- provider qualification state;
- exact money/usage/reservation primitives;
- backup/update/recovery metadata.

## Exit

Illegal state changes fail; state+causative event atomicity works; stale version cannot overwrite; non-project scopes need no fake workspace; protocol/persistence representations agree.

---

# 7. PHASE 5 — SESSION SECURITY / PERMISSIONENGINE / APPROVAL

## Deliverables

- Argon2id session password;
- cooldown/rate limits;
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

Hard invariant/deny precedence, HIGH authority rules, precedent limits, CRITICAL final confirmation, digest invalidation, same-user threat wording, recovery password semantics, and locality tests all pass.

---

# 8. PHASE 6 — PROJECTS / SCOPES / CONTEXT / MEMORY

## Deliverables

- project aliases/environments/workspaces/worktrees;
- integration/system/global scopes;
- canonical Windows paths;
- Context Manager;
- memory confidence/revisions/data policy;
- conversation/history separation;
- live-state-over-memory behavior.

## Exit

Project aliases resolve; project writes require exact `PROJECT_WORKSPACE`; integration-only work has no fake filesystem authority; memory respects scope/policy; local-only derived context remains local-only.

---

# 9. PHASE 7 — CODEX PROVIDER + SANDBOX QUALIFICATION

## Deliverables

- Provider Registry/Router/Supervisor;
- compatibility vs health states;
- exact Codex executable/version policy;
- stable structured/non-interactive adapter;
- orchestrator profile;
- `WORKSPACE_ENGINEERING` profile;
- controlled env/working directory;
- provider sandbox mode configuration;
- cancellation/timeouts/circuit breaker;
- provider quota/usage provenance;
- optional resume reference handling.

## Mandatory Windows sandbox proof

Measure/verify actual selected Codex behavior:

- writes confined as required;
- network denied by default profile;
- read-access boundary documented truthfully, with no workspace-only claim unless enforced;
- no unrelated credentials in env/context;
- Job Object descendant containment;
- shell/client availability cannot bypass JARVIS typed external-action authorization.

## Exit

Qualified Codex version runs orchestrator/engineering flows; unsupported version excluded; invalid output fails; provider crash contained; privacy/locality respected; fresh-session recovery works if provider resume unavailable.

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
- pause/cancel primitives.

## Exit

Engineering worker can inspect/edit/build/test bounded workspace; cannot widen scope/authority; parallel writers are isolated; provider-private history not required for recovery; no-progress loops terminate/replan.

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
- artifact reuse/invalidation.

## Exit

Independent work can run concurrently within deterministic scheduling; cycles rejected; revisions are historical/versioned; invalid outputs cannot feed current graph; mission cannot complete with required unknown/blocked work.

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
- startup transient-state scan.

## Exit

Priority can preempt safely; unnecessary preemption avoided; resume validates state/provider/locality/leases; concurrent hard-budget race is safe; ambiguous external effect never blindly retries; outstanding reservations survive recovery.

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

## Deliverables

- production Local filesystem/Git integration;
- scoped GitHub credential/account/capability model;
- repository/ref identity;
- required GitHub read/write operations for engineering workflow;
- expected-ref/conditional-write protections;
- rate limit/auth expiry/retry/uncertainty behavior;
- conformance suite.

## Exit

Both mandatory families are `SUPPORTED`, credential-safe, scope-safe, race-safe, recoverable, auditable, and pass Release Profile conformance.

---

# 16. PHASE 14 — PROXMOX VE V1

## Deliverables

- connection wizard/registry;
- scoped API-token credential flow;
- TLS trust/pin;
- cluster/node/QEMU/LXC discovery;
- read-only onboarding;
- typed power/snapshot/backup/config/create/migrate/destroy operations for the V1 supported capability matrix;
- node/VMID/pool scope;
- asynchronous task tracking;
- postcondition/live verification;
- destructive final confirmation;
- no raw API/shell fallback;
- guest-shell separation.

## Exit

ADR-059 semantics are fully represented by current contract implementation; Proxmox conformance suite passes; V1 cannot be Production Complete without it.

---

# 17. PHASE 15 — VOICE FOUNDATION

## Deliverables

- audio device manager;
- push-to-talk;
- local STT;
- VAD;
- selected TTS provider/persistent voice;
- typed transcript/voice state;
- local latency instrumentation.

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
- no required direct public privileged-Core ingress.

## Exit

Duplicate event cannot duplicate consequence; automation obeys normal permission/locality/budget; locked private content not spoken; trigger storms bounded.

---

# 20. PHASE 18 — BACKUP UX / DIAGNOSTICS / UPDATE

The cryptographic backup proof exists from Phase 3; this phase productizes operations.

## Deliverables

- scheduled/local backup retention;
- portable backup creation/verification UX;
- recovery-factor setup/rotation UX;
- restore maintenance mode;
- corruption recovery;
- WAL/provider/security diagnostics dashboard;
- diagnostic export/redaction;
- signed updater/staged activation;
- binary/schema/runtime/backup rollback pairing;
- release manifest generation.

## Exit

Full local + portable restore drills pass; bad migration/startup recovers known-good pair; tampered update rejected; diagnostics identify common subsystem failures.

---

# 21. PHASE 19 — PRODUCTION QUALIFICATION

Run the full v1.0.2 Verification Contract on exact signed Release Candidate artifacts:

- static/strict/architecture;
- protocol/canonicalization;
- Tauri/WebView;
- named-pipe/Job Objects;
- PermissionEngine/destructive boundaries;
- Codex compatibility/sandbox;
- tools/races;
- SQLite/SQLCipher/WAL;
- backup/portable restore;
- crash/recovery;
- exact budget;
- Local Git/GitHub/Proxmox;
- modules/update;
- voice;
- event automation;
- resource/performance;
- clean install/upgrade/rollback;
- soak;
- signed packaging/SBOM/provenance.

## Exit

Zero P0/P1; no release-blocking security failure; all V1 journeys pass; rollback/recovery verified; Production Complete evidence references exact artifacts/source/profile.

---

# 22. FIRST IMPLEMENTATION SLICE

The first code slice intentionally stops before AI autonomy:

```text
Tauri/React bundled local UI
→ Rust Host
→ Tauri capability/CSP boundary
→ ACL-restricted authenticated named pipe
→ application-owned Node Core
→ transactional state/event skeleton
→ locked session + harmless get_system_status
```

Then immediately execute the Phase-3 SQLite/SQLCipher/WAL/portable-restore proof.

Only after trust, persistence, and recovery foundations pass should Codex autonomy be introduced.

Do not start by giving Codex a shell and letting working behavior become the architecture.

---

# 23. ENGINEERING WORKFLOW

Significant work uses isolated branches/worktrees.

Re-fetch live branch before writes when concurrent work is possible and preserve valid changes.

Contract/schema change includes compatibility/migration impact. Security/recovery change includes negative/failure tests.

A material implementation-vs-contract conflict is corrected or goes through the synchronous ADR + canonical contract amendment process. Code never silently becomes the new architecture because it was easier.

---

# 24. RELEASE CHECKPOINTS

```text
Repository Standards Ready
Desktop Trust Boundary Ready
Persistence/Portable Recovery Proven
Core State Ready
Security/Permission Boundary Ready
Codex Provider/Sandbox Ready
Tool Runtime Ready
Worker Runtime Ready
Mission Runtime Ready
GitHub Integration Ready
Proxmox Integration Ready
Voice Runtime Ready
Operations/Update Ready
Release Candidate
Production Complete
```

Only final checkpoint is Production Complete.

---

# 25. GOVERNING PRINCIPLE

> **Build the control plane first, prove recoverability early, then give intelligence access to it. Harden and test each boundary before depending on it.**

---

**END — JARVIS PRODUCTION IMPLEMENTATION PLAN v1.0.2**
