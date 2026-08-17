# JARVIS Production Implementation Plan

**Status:** Authoritative dependency/sequencing plan for v1.0.8
**Version:** 1.0.8
**Date:** August 17, 2026  
**Release target:** `docs/JARVIS-V1-RELEASE-PROFILE.md`

This is not a simplified MVP plan. Intermediate phases are proof checkpoints; final completion means the active Release Profile and every active normative verification requirement pass for exact signed artifacts.

No application implementation begins merely because this plan exists. This document defines the sequence to use when implementation is explicitly started.

V1 implements a Windows `FULL_HOST`. The plan SHALL preserve the platform capability boundaries required for a future Linux `FULL_HOST`, but SHALL NOT expand V1 into Linux or Android implementation work.

---

# 1. DELIVERY ORDER

```text
repository governance / platform contracts / coding standards / CI / contract-profile drift checks
→ shared Core/domain + Windows Tauri platform host + Mission Control foundation
→ PlatformLocalIpc + PlatformProcessSupervisor Windows backends
→ SQLite/SQLCipher/WAL + PlatformSecureStorage + JARVIS_BACKUP_V1/KDF/portable-restore proof
→ EARLY VOICE FEASIBILITY SPIKE on representative qualification hardware
→ authoritative state machines/events
→ session security / PermissionEngine / approval
→ projects/context/memory/platform-aware execution scopes + project-policy trust enrollment
→ Codex Windows provider setup/repair + compatibility + real sandbox proof
→ controlled local tools through platform boundaries
→ bounded workers/graphs
→ resources/budgets/recovery
→ credentials + TUF-backed module foundation + mandatory GitHub/Proxmox integrations
→ full voice product through platform audio/device boundary
→ event/automation
→ full UI/operations productization + TUF-authorized signed updater
→ complete Windows production qualification
```

The platform boundary is cross-cutting: Phase 0 defines it, Phase 1 composes the Windows backend through it, every later native feature respects it, and final qualification proves no Windows implementation details leaked into shared Core/domain/policy where a semantic capability belongs.

The UI identity/accessibility system is also cross-cutting: Phase 1 establishes it, every later user-facing phase uses it, and final qualification proves the complete product.

The v1.0.5 security closures remain cross-cutting: backup-format cryptography is frozen before persistence depends on it; project-policy trust is explicit before engineering workers consume repository policy; supply-chain trust is established before module/update activation; and voice feasibility is measured early before late product integration. The v1.0.6 repository-governance closure additionally prevents an unavailable paid hosting feature from becoming a hidden implementation prerequisite while preserving stronger server enforcement whenever the hosting capability exists. ADR-075 changes only the distribution scope to `PRIVATE_INTERNAL`; it does not remove artifact signing, TUF, updater, rollback, or recovery gates.

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
- pinned Node/Rust/TypeScript/Tauri/package-manager toolchains;
- strict TypeScript;
- Rust fmt/clippy;
- schema generation/validation strategy;
- test layer directories including platform/UI/accessibility/provider-setup/backup-crypto/project-policy/supply-chain layers;
- CI format/type/build/unit/property/schema/platform-architecture baseline;
- secret/dependency/license scan;
- root `AGENTS.md`;
- current contract manifest validation in CI;
- authoritative-`master` governance profile: server-side GitHub ruleset/branch protection when the hosting capability exists, otherwise the v1.0.6 verified compensating-control mode;
- machine-readable canonical definitions or generated equivalents for repeated contract values including KDF profiles, backup format profile identifiers/limits, platform/runtime enums, GitHub/Proxmox capability matrices, provider setup states, and security/release constants where practical;
- CI checks that compare generated/machine-readable definitions against the normative profile and fail on semantic drift.

## Required platform architecture proof

Before exit:

- shared Core/domain/policy code has no direct Win32/DPAPI/named-pipe/Job-Object/HWND/SID/UAC dependency;
- OS selection occurs only in composition/platform-adapter/explicit platform-specific code;
- platform capability absence has a typed fail/degrade path;
- Windows-only dependencies are permitted inside the Windows backend when justified;
- no weak generic mechanism replaces a stronger Windows requirement merely for portability;
- Linux remains unimplemented/unqualified and cannot appear supported.

## Required contract-profile drift proof

Before exit:

- one canonical machine-readable source exists for every repeated value selected for generation/checking;
- human-contract checks fail when a generated/canonical value differs from the active Release Profile/manifest expectations;
- generated artifacts are reproducible and stale generated output fails CI;
- machine-readable representation never silently becomes authority for a value absent from the current normative suite.

## Required repository governance

Before exit, determine the authoritative repository's verified hosting capability and select exactly one effective governance mode.

If server-side branch protection/rulesets are available for the authoritative repository:

- `master` deletion is blocked;
- force push is blocked;
- mandatory CI checks are required once defined;
- bypass permissions are narrowly controlled/auditable;
- an available protection capability may not be deliberately disabled to select the fallback mode.

If server-side protection/rulesets are unavailable because of a verified hosting plan/platform limitation:

- record the exact unavailable capability and truthfully record that `master` is not server-protected;
- implementation work occurs on temporary branches rather than routine direct implementation writes to `master`;
- the designated mandatory CI context passes on the exact candidate commit before authoritative integration;
- live `master` is re-fetched immediately before integration and stale/unexpected movement is reconciled rather than overwritten;
- integration/ref movement is non-force only;
- the resulting authoritative tip, intended diff, and CI/audit evidence are verified after integration;
- the residual inability to hard-block an out-of-band administrator force push/deletion remains visible rather than being represented as equivalent protection;
- server-side protection becomes mandatory again if the hosting capability later becomes available.

In either mode:

- pull-request review is strongly preferred for implementation changes;
- no second long-lived authoritative branch exists;
- mandatory CI is never waived as a substitute for hosting limitations.

## Exit

Clean checkout builds reproducibly; UI/Core compile separately; schemas/tests run; platform/import architecture is enforceable; contract manifest is current; repeated contract values have drift protection where selected; repository governance is verified for the actual hosting capability; server-side protection is active when available or the explicit compensating mode is evidenced when unavailable; no business logic is vendor- or Windows-backend-bound.

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

# 5. PHASE 3 — PERSISTENCE / PLATFORM SECURE STORAGE / KDF / JARVIS_BACKUP_V1 PROOF

This proof occurs before broad stateful feature development.

## Deliverables

- selected production Node SQLite/SQLCipher binding;
- exact embedded SQLite/SQLCipher build/fix evidence; numeric version comparison alone is not accepted as WAL-fix proof;
- WAL activation, FULL synchronous, foreign keys, busy handling;
- WAL/checkpoint diagnostics;
- PlatformSecureStorage semantic boundary;
- random local `DB_DEK` protected by Windows secure-storage backend;
- versioned Argon2id profile schema/persistence;
- production session/general KDF floor enforcement: v0x13, >=64 MiB, >=3 passes, 4 lanes, >=16-byte random salt, >=32-byte output;
- exact `JARVIS_BACKUP_V1` implementation from the Backup Cryptography Contract;
- exact release-qualified SQLCipher-safe snapshot/re-key/export mechanism proven on the selected binding;
- fresh 256-bit `SnapshotDBKey` per backup;
- fresh 256-bit `BackupDEK` per backup;
- AES-256-GCM 4 MiB chunk framing, nonce construction, JCS descriptor/AAD, 128-bit tags, strict count/order/truncation/append validation, and package bounds;
- Windows local DPAPI/secure-store key slot;
- mandatory `GENERATED_RECOVERY_V1` slot using a 256-bit OS-CSPRNG recovery secret for production portable-state verification;
- optional `PASSPHRASE_ARGON2ID_V1` slot using >=256 MiB, >=3 passes, 4 lanes, >=16-byte salt, >=32-byte output and the Backup Cryptography Contract's passphrase admission rules;
- clean-profile Windows restore + fresh local DB_DEK re-key;
- corruption/integrity handling;
- production-style packaged execution.

## Required proof

```text
packaged Windows Core
+ encrypted DB create/open
+ WAL/foreign keys/transactions
+ exact WAL-reset fix evidence
+ production KDF floor reject/accept fixtures
+ exact SQLCipher snapshot/re-key/export mechanism
+ JARVIS_BACKUP_V1 golden crypto vectors
+ chunk reorder/delete/duplicate/truncate/append rejection
+ malicious length/count/KDF-bound rejection
+ fresh SnapshotDBKey + BackupDEK
+ Windows local restore
+ wrong generated recovery factor failure
+ wrong optional passphrase failure
+ clean-profile portable restore without old DPAPI/DB_DEK
+ separately preserved generated recovery factor
+ re-key under fresh new local DB_DEK
+ corruption detection
+ no plaintext key/recovery material in package metadata/logs/diagnostics
```

Cross-platform restore is not required. The portable cryptographic envelope must nevertheless avoid dependence on historical Windows-local key material.

If chosen binding/crypto library/package fails a mandatory property, replace it; do not weaken encryption/recovery/WAL/KDF/platform rules.

---

# 5A. PHASE 3A — EARLY VOICE FEASIBILITY SPIKE

This is a feasibility gate, not the final voice product implementation.

## Goal

Prove before broad feature work that at least one production-credible local-first Windows voice stack can meet the intended V1 privacy, packaging, device, AEC/barge-in, identity, and latency direction on representative qualification hardware.

## Candidate scope

Exercise at least one realistic candidate combination covering:

- local STT;
- VAD;
- local TTS with a stable JARVIS voice identity candidate;
- AEC using the exact TTS render reference;
- double-talk/barge-in;
- deterministic stop/mute/cancel path;
- microphone/speaker selection and reconnect;
- representative built-in speakers/microphone and wired/USB headset paths;
- Bluetooth audio where supported/representative, with limitations recorded truthfully;
- CPU/GPU acceleration and fallback behavior;
- RAM/VRAM/CPU contention on the 16 GB/i7 13th-gen/RTX 4060-class baseline;
- model/runtime packaging size and offline behavior;
- redistribution/licensing/provenance feasibility.

## Measurements

Measure at least listening-state feedback, VAD start/close, STT partial/final, TTS first audio, stop/cancel, AEC behavior under playback, and end-to-end local pipeline latency separately from remote AI reasoning.

## Deliverable

Produce a versioned feasibility report recording candidate versions, hardware/devices, measured results, quality limitations, packaging/licensing status, and whether at least one candidate stack is viable for later Phase 15/16 qualification.

## Exit

At least one candidate stack is technically/licensing/package feasible without changing mandatory privacy/security assumptions, or the project raises the concrete product/provider/hardware constraint immediately through the normal contract decision process. A pass does not qualify final voice support and does not freeze every implementation detail prematurely.

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
- backup format/recovery-slot metadata without raw recovery factors;
- provider setup/qualification/platform state;
- exact money/usage/reservation primitives;
- update/TUF trusted-metadata state hooks;
- project-policy trust/snapshot state hooks;
- backup/update/recovery metadata.

## Exit

Illegal state changes fail; state+causative event atomicity works; stale version cannot overwrite; non-project scopes need no fake workspace; provider setup is distinct from compatibility/health/platform support; protocol/persistence representations agree; shared durable state does not persist native Windows handles as domain identity; recovery-factor secrets are absent from normal DB state.

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
- trusted-project-policy state gate where applicable;
- LOW/MODERATE/HIGH/CRITICAL behavior;
- standing permission + precedent restrictions;
- `CanonicalActionDescriptorV1` builder;
- RFC8785/SHA256/base64url Rust+TS vectors;
- expiry/single-use transactional approval consumption;
- locked data suppression.

## Exit

Hard invariant/deny precedence, HIGH authority rules, precedent limits, CRITICAL final confirmation, digest invalidation, KDF floor/versioning, same-user threat wording, recovery password semantics, locality, and platform-capability fail-closed tests all pass.

---

# 8. PHASE 6 — PROJECTS / SCOPES / CONTEXT / MEMORY / PROJECT-POLICY TRUST

## Deliverables

- project aliases/environments/workspaces/worktrees;
- integration/system/global scopes;
- PlatformPathRef/equivalent canonical path identity;
- Windows path canonicalization backend;
- Context Manager;
- memory confidence/revisions/data policy;
- scoped ranked retrieval;
- conversation/history separation;
- live-state-over-memory behavior;
- `AGENTS.md` project-policy candidate discovery without automatic trust;
- canonical project/path/scope/content-hash policy identity;
- explicit authenticated review/trust/disable/revoke workflow;
- durable project-policy trust records and revision state;
- immutable applicable policy snapshot per attempt;
- branch/worktree/content/path change detection → `CHANGED_REVIEW_REQUIRED`;
- separately enrolled nested-policy scope and precedence;
- context labeling that distinguishes trusted project policy from untrusted repository content;
- contextually HIGH path for mutating an enrolled trusted policy; new content is not auto-trusted.

## Exit

Project aliases resolve; project writes require exact `PROJECT_WORKSPACE`; integration-only work has no fake filesystem authority; Windows reparse/UNC/drive/path checks pass; platform-tagged path cannot be accidentally interpreted under wrong platform semantics; memory respects scope/policy; local-only derived context remains local-only; unfamiliar repository `AGENTS.md` remains untrusted until explicit enrollment; policy changes/revocation affect new/resuming work deterministically; trusted project policy cannot widen JARVIS authority.

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
- optional resume reference handling;
- immutable trusted project-policy snapshot injection as scoped context, never direct raw candidate trust.

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
- network enabled by default for delegated Codex CLI workers, with bounded live availability proof;
- read-access boundary documented truthfully;
- no unrelated credentials in env/context;
- Job Object descendant containment;
- shell/client availability cannot bypass JARVIS typed external-action authorization;
- untrusted repository policy-looking files do not become trusted worker instructions;
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
- immutable applicable project-policy snapshot on worker attempts;
- Mission Control work/queue/activity components using canonical design system.

## Exit

Engineering worker can inspect/edit/build/test bounded Windows workspace; cannot widen scope/authority; parallel writers are isolated; provider-private history not required for recovery; no-progress loops terminate/replan; dashboard truth derives from authoritative state; worker cannot silently replace/enroll the trusted policy that constrains it.

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
- policy-snapshot revalidation on resume;
- transparent queue/block/recovery/platform/policy-unavailable UI states.

## Exit

Priority can preempt safely; unnecessary preemption avoided; resume validates state/provider setup/locality/platform capabilities/leases/policy trust; concurrent hard-budget race is safe; ambiguous external effect never blindly retries; outstanding reservations survive recovery.

---

# 14. PHASE 12 — CREDENTIALS / MODULE / SUPPLY-CHAIN TRUST FOUNDATION

## Deliverables

- integration account registry;
- PlatformSecureStorage credential handles;
- DATA_ONLY/BUILT_IN_TRUSTED/EXTERNAL_MANAGED execution classes;
- platform/runtime-role compatibility in module manifests;
- typed module IPC/health/lifecycle;
- module staging/rollback;
- dashboard state distinctions;
- audited TUF 1.0.35 implementation/library integration;
- embedded/authenticated initial TUF root metadata;
- Ed25519 role keys and 2-of-3 offline root-threshold policy represented by deployment/release tooling without placing root private keys in ordinary CI/runtime;
- targets/snapshot/timestamp role separation, expiration/version checks, and consistent snapshots;
- dedicated `modules` delegated targets role scoped away from application release targets;
- durable trusted-metadata state that survives cache cleanup;
- module target length/hash/catalog authorization/revocation/anti-rollback checks.

## Exit

No raw credentials in normal DB/log/prompts/backups; external executable cannot run in Core; wrong-platform/unsupported/revoked module not labeled supported; crash/update rollback works; Windows process containment works for external module; TUF role/delegation/expiry/rollback/freeze/mix-and-match negative tests pass; module publisher signature alone cannot confer support.

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
- exact expected-old-ref/conditional-write protections for `GITHUB_REF_WRITE`;
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

Phase 3A feasibility evidence is input, not a substitute for this production implementation.

## Deliverables

- PlatformAudioBackend contract integration;
- Windows audio device manager;
- push-to-talk;
- selected production local STT;
- selected production VAD;
- selected TTS provider/persistent voice;
- typed transcript/voice state;
- local latency instrumentation;
- Mission Control voice-state components using canonical identity;
- packaged/offline/licensing/provenance closure for selected components.

## Exit

Voice input reliable on Windows; text fallback always usable; device reconnect works; locked privacy/DataLocality enforced; TTS identity/provider/licensing frozen for RC; Phase 3A assumptions have been revalidated against the production implementation.

---

# 18. PHASE 16 — FULL-DUPLEX VOICE

## Deliverables

- selected AEC provider + exact TTS render reference;
- realtime conversation engine;
- physical/semantic turn detection;
- barge-in/double-talk;
- interruptible speech;
- deterministic stop/mute/cancel;
- half-duplex fallback;
- optional wake-word interface.

## Exit

Barge-in and stop latency pass target on real Windows devices; AEC double-talk qualifies; stale transcript cannot submit; AEC failure safely degrades; production behavior does not rely only on the earlier feasibility spike.

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

The cryptographic backup proof exists from Phase 3, voice feasibility evidence exists from Phase 3A, and the UI/platform identity foundation exists from Phase 1. This phase completes all operational surfaces and qualification fixtures before RC.

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
- `JARVIS_BACKUP_V1` portable backup creation/verification UX;
- generated recovery-factor export/verification/rotation UX;
- optional passphrase-slot UX;
- restore maintenance mode;
- corruption recovery;
- WAL/provider/setup/security/platform/project-policy/TUF trust diagnostics dashboard;
- diagnostic export/redaction;
- PlatformUpdateBackend with TUF-authorized staged Windows updater;
- TUF trusted root/targets/snapshot/timestamp state, rotation/revocation/expiry behavior;
- signed monotonic `releaseSequence` and `securityEpoch` admission;
- Tauri updater signature verification;
- Windows private/internal code-signing/Authenticode validation policy with explicit certificate enrollment;
- binary/schema/runtime/backup rollback pairing;
- rollback permitted only when current trusted metadata explicitly authorizes the exact non-revoked compatible target;
- release manifest generation including platform/runtime/backend/support identity and TUF/signing/security-epoch metadata.

## Exit

Full Windows local + portable restore drills pass; generated recovery secret alone can restore a clean profile; bad migration/startup recovers a known-good authorized pair; revoked/old unauthorized validly signed updates are rejected; TUF/Tauri/Windows signing gates are cumulative; diagnostics identify common subsystem/platform/policy/trust failures; all UI Identity Contract completion criteria pass; shared UI components remain free of unnecessary Windows-only semantic coupling.

---

# 21. PHASE 19 — WINDOWS V1 PRODUCTION QUALIFICATION

Run the full v1.0.8 active contract suite on exact signed Windows FULL_HOST `PRIVATE_INTERNAL` Release Candidate artifacts:

- contract manifest / Release Profile;
- authoritative repository/CI governance evidence for the verified hosting capability;
- static/strict/architecture + machine-readable contract-profile drift checks;
- platform composition/import boundary;
- protocol/canonicalization/platform schemas;
- Mission Control UI identity/adaptive/accessibility;
- Tauri/WebView;
- Windows named-pipe/Job Objects;
- KDF/session/recovery profiles;
- PermissionEngine/destructive boundaries;
- project-policy enrollment/hash-change/nesting/revocation/worker-mutation;
- Codex Windows setup/compatibility/sandbox;
- tools/races;
- exact SQLite/SQLCipher/WAL/snapshot-rekey path;
- `JARVIS_BACKUP_V1` crypto/tamper/order/truncation/portable disaster restore;
- crash/recovery;
- exact budget;
- Local Git + exact GitHub capability matrix;
- exact Proxmox capability matrix;
- modules/TUF catalog delegation/revocation;
- TUF app update root threshold/rotation/expiry/rollback/freeze/mix-and-match + Tauri/Windows signing;
- voice, including comparison against early feasibility evidence;
- event automation;
- resource/performance;
- clean install/upgrade/authorized rollback;
- soak;
- privately enrolled signed packaging/SBOM/license/provenance;
- exact private/internal certificate identity, target trust enrollment, and no-public-distribution statement.

Linux runtime and Android companion tests are explicitly outside this V1 qualification.

## Exit

Zero P0/P1; Critical/High vulnerability policy passes; all V1 journeys and all active v1.0.8 specialized security/governance-contract gates pass; rollback/recovery verified; Production Complete evidence references exact private/internal Windows artifacts/source/profile/contract/platform/trust identity.

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

Then immediately execute the Phase-3 SQLite/SQLCipher/PlatformSecureStorage/KDF/`JARVIS_BACKUP_V1`/portable-restore proof.

Immediately after Phase 3, execute the Phase-3A voice feasibility spike before broad feature development.

Only after trust, persistence, recovery, session, platform boundaries, and the early voice feasibility risk are understood should Codex autonomy and broad product capabilities expand.

Do not start by giving Codex a shell and letting working behavior become the architecture. Do not implement Linux merely to prove the abstraction; prove the abstraction through boundaries/tests and build the Windows backend completely.

---

# 23. ENGINEERING WORKFLOW

Significant work uses temporary isolated branches/worktrees created from live authoritative `master`.

Re-fetch live `master` before writes when concurrent work is possible and preserve valid changes.

Contract/schema change includes compatibility/migration impact. Security/recovery change includes negative/failure tests. UI identity/accessibility change includes qualification impact. Platform-native change includes capability-contract and platform-support impact. Backup crypto, project-policy trust, supply-chain trust, and repository-governance changes require their specialized contract/versioning implications.

A material implementation-vs-contract conflict is corrected or goes through the synchronous ADR + canonical contract + manifest amendment process. Code never silently becomes the new architecture because it was easier.

Windows-only dependencies belong in the Windows backend unless the shared layer genuinely requires them. Shared code SHALL not gain OS conditionals as a shortcut around platform composition.

Accepted temporary branches are integrated through the verified repository-governance mode and deleted; `master` remains the sole authoritative line. When server-side protection is unavailable, integration still requires exact candidate CI, live-tip revalidation, non-force update, and post-integration verification.

---

# 24. FUTURE LINUX / COMPANION WORK

Future Linux full-host implementation begins only after an explicit future contract/Release Profile defines concrete supported Linux distributions, native backends, packaging/update, provider/voice behavior, and qualification.

Future companion work begins only after an explicit Remote Access Gateway/security/protocol contract defines device enrollment, cryptographic identity, authenticated encryption, replay resistance, revocation, per-device authority, remote instruction provenance, approvals, privacy, rate limiting, and audit.

Neither is part of the Windows V1 implementation plan.

---

# 25. POST-V1 INTEGRATION DELIVERY

SSH, Google Workspace, Microsoft 365, and Cloudflare remain binding product roadmap targets after V1.

They are independent production integration deliverables and MAY ship in separate feature releases as each reaches `SUPPORTED` and full qualification. No one integration blocks release of another already-complete integration solely to preserve an artificial four-integration bundle.

Any decision to remove one from the binding roadmap requires a deliberate future product-contract amendment.

---

# 26. RELEASE CHECKPOINTS

```text
Repository Governance + Platform Boundary + Contract-Drift Protection Ready
Windows Desktop Trust + Mission Control Foundation Ready
Persistence/KDF/JARVIS_BACKUP_V1 Portable Recovery Proven
Early Voice Feasibility Proven
Core State Ready
Security/Permission Boundary Ready
Project Policy Trust Boundary Ready
Codex Windows Setup/Provider/Sandbox Ready
Tool Runtime Ready
Worker Runtime Ready
Mission Runtime Ready
Supply-Chain/Module Trust Foundation Ready
GitHub Capability Matrix Ready
Proxmox Capability Matrix Ready
Voice Runtime Ready
Operations/UI/TUF Update Ready
Windows Release Candidate
Production Complete
```

Only final checkpoint is Production Complete.

---

# 27. GOVERNING PRINCIPLES

> **Build the control plane first, prove recoverability early, then give intelligence access to it. Harden and test each boundary before depending on it.**

> **Prove mandatory hardware/provider feasibility before the rest of the product becomes dependent on it.**

> **Build the product identity into the shell before feature screens multiply.**

> **Abstract the capability, not the security away.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**

> **A repository file is data until an authenticated user enrolls its exact policy identity.**

> **A valid historical signature is not perpetual authorization to activate.**

---

**END — JARVIS PRODUCTION IMPLEMENTATION PLAN v1.0.8**
