# JARVIS Verification, Qualification & Release Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`  
**Version:** 1.0.3  
**Date:** August 12, 2026

---

# 1. PURPOSE

This contract defines the evidence required before an implementation or release may be called complete or production-ready.

Code existence, model self-report, documentation completion, or one happy-path demonstration is insufficient.

Production is verified behavior under normal success, ambiguity, interruption, crash, stale state, provider setup/repair, provider outage, adversarial input, target race, recovery, update, resource pressure, accessibility modes, adaptive layouts, and real release packaging.

---

# 2. RELEASE CLASSES

```text
DEVELOPMENT
INTERNAL ALPHA
BETA
RELEASE CANDIDATE
PRODUCTION
```

Only a release satisfying every mandatory v1.0.3 gate for the active Release Profile may be labeled `PRODUCTION`/`Production Complete`.

Qualification SHALL bind to one source commit, contract manifest, Release Profile, exact protocol/schema versions, and exact signed installer/update artifacts.

---

# 3. DEFINITION OF DONE — TASK

A task is complete only when:

- required output/artifact exists;
- mandatory acceptance criteria are evaluated;
- objective/live verification passes where available;
- required independent review passes where judgment is needed;
- no unresolved approval remains;
- required `UNKNOWN` results are resolved unless completion policy explicitly permits partial result;
- material worker/provider/tool errors are resolved or reflected in non-complete state;
- resulting DataPolicy is valid;
- evidence/result is durable.

Worker/provider prose saying “done” is never sufficient by itself.

---

# 4. DEFINITION OF DONE — MISSION

Mission completion requires required terminal nodes complete, no unresolved required failed/blocked/invalidated node without accepted replacement, mission acceptance policy passing, synthesis using current valid outputs, intended external effects verified, no remaining required queued work, risks surfaced, and durable completion record.

---

# 5. FEATURE DEFINITION OF DONE

A production feature has implementation, typed schemas/APIs, unit/property tests, integration/failure/security tests as applicable, recovery behavior, diagnostics, degraded UX, accessibility/adaptive behavior when user-facing, documentation, migration/update compatibility, and production scenario coverage.

A feature without failure/recovery semantics is incomplete.

---

# 6. PRODUCTION RELEASE GATES

A V1 production release SHALL pass at least:

1. Contract Manifest + Release Profile conformance;
2. reproducible build/toolchain;
3. protected-authoritative-branch/CI governance gate;
4. static/architecture analysis;
5. unit tests;
6. property/state-machine tests;
7. protocol/schema cross-language tests;
8. JARVIS Mission Control UI identity/adaptive/accessibility gate;
9. Tauri/WebView security gate;
10. named-pipe principal/bootstrap gate;
11. KDF/session/recovery-profile gate;
12. PermissionEngine/approval safety gate;
13. prompt-injection/content-authority gate;
14. provider setup/version/health/sandbox conformance;
15. tool contract/TOCTOU gate;
16. persistence/SQLite-WAL/SQLCipher gate;
17. encrypted local/portable backup restore gate;
18. migration gate;
19. crash/recovery/uncertain-side-effect gate;
20. Job Object/process-tree containment gate;
21. exact budget/quota/accounting gate;
22. module/catalog/supply-chain/update gate;
23. Local filesystem/Git integration conformance;
24. exact GitHub V1 capability-matrix conformance;
25. exact Proxmox VE V1 capability-matrix conformance;
26. voice qualification;
27. event/automation security/dedup gate;
28. performance/latency gate;
29. resource-pressure gate;
30. clean install with no usable system Node;
31. previous-production upgrade/rollback;
32. signed installer/update verification;
33. SBOM/license/provenance/release-manifest gate;
34. soak/stability gate;
35. V1 production user-journey suite.

Zero open P0/P1 defects. Critical/High reachable vulnerability policy from the Operations Contract SHALL pass.

---

# 7. TEST LAYERS

Repository test layers include:

```text
unit
property/state-machine
schema/cross-language contract
provider setup/contract/sandbox
tool contract
integration/module conformance
integration/e2e
UI/accessibility/adaptive
safety/adversarial
recovery/chaos
persistence/backup/migration
performance/resource
voice/audio
packaging/update/release
```

Fast deterministic layers run on normal changes where practical; heavy release qualification runs before production.

---

# 8. CORE UNIT/PROPERTY REQUIREMENTS

Tests SHALL cover:

- PermissionEngine ordered precedence;
- hard-invariant/explicit-deny dominance;
- current instruction vs standing permission vs precedent;
- HIGH/CRITICAL rules;
- authority-envelope containment;
- execution-scope validation;
- canonical target/path resolution;
- approval digest/expiry/single-consumption;
- data policy propagation;
- provider setup state + compatibility/health separation;
- provider routing/locality;
- exact budget arithmetic/reservations;
- graph validation/mission acceptance;
- all state transitions including durable `RESUMING`;
- event dedup;
- memory ranking/confidence;
- module lifecycle/execution-class state;
- KDF profile validation/upgrade state;
- backup retention/format/key-slot state;
- retry/circuit-breaker;
- locked-state suppression.

Property/model tests SHALL prove terminal states cannot return illegally, consumed approval cannot replay, exclusive leases have one owner, invalid graph cycles fail, non-project scopes do not gain filesystem authority, DataLocality cannot silently weaken, under-floor production KDF profiles fail, provider setup cannot become ready by assumption, and binary floating point does not determine authoritative monetary admission.

---

# 9. CROSS-LANGUAGE PROTOCOL/CANONICALIZATION

Rust and TypeScript fixtures SHALL prove:

- IPC envelopes and explicit response union agree;
- IDs/times/DataPolicy/MoneyAmount round-trip;
- KDF profile shapes/validation agree;
- provider setup/compatibility/health enums agree;
- one durable `RESUMING` enum meaning;
- ExecutionScope, GitHubCapability, ProxmoxCapability, and ModuleManifest variants agree;
- `CanonicalActionDescriptorV1` produces identical RFC 8785 canonical bytes and SHA-256/base64url-no-pad digest;
- property order and insignificant source JSON formatting do not alter digest;
- material target/scope/account/environment/argument/tool-version change alters digest;
- duplicate key/non-finite/negative-zero/invalid Unicode/unsafe number representations are rejected;
- raw secrets never enter descriptor.

Any cross-language security-material mismatch is release-blocking.

---

# 10. UI IDENTITY / ADAPTIVE / ACCESSIBILITY QUALIFICATION

Production qualification SHALL prove the exact Release Candidate implements the current JARVIS UI Identity & Design System Contract rather than a generic substitute.

Required evidence includes:

- canonical `jarvis-mark.svg`, `jarvis-lockup.svg`, and `jarvis-app-icon.svg` source usage with generated platform variants traceable to those sources;
- primary local/offline font packaging and recorded font/icon/third-party visual license/provenance;
- one dark-theme Mission Control shell across conversation, work, approvals, systems/integrations, provider setup, memory/artifacts, diagnostics, and voice;
- deterministic `HIDDEN`, `WINDOWED`, `MAXIMIZED`, `FULLSCREEN`, and `FOCUSED_CONTEXT`-equivalent window behavior;
- show/hide/fullscreen/focused-context state preserves intended conversation/navigation/selection context;
- no normal background event steals focus/fullscreen outside NotificationPolicy;
- off-screen saved window placement recovers after monitor topology change;
- adaptive layouts at standard desktop, compact, wide, ultrawide, and multi-monitor conditions;
- Windows scaling at `100%`, `125%`, `150%`, and `200%`;
- 200% text resizing without required-content/function loss;
- primary linear workflow reflow at an effective 320 CSS px / 400% zoom-equivalent layout without two-dimensional scrolling except legitimate intrinsically 2D-content exceptions;
- normal text contrast >= `4.5:1` and qualifying large text >= `3:1`;
- applicable meaningful non-text controls/indicators >= `3:1` against adjacent colors;
- consequential state never uses color as the only cue;
- pointer targets >= `24 × 24` CSS px or meet a valid equivalent target-spacing/exception rule;
- keyboard operation for all primary workflows with no traps;
- visible focus and focused controls not obscured by sticky/persistent UI;
- semantic names/roles/states for primary assistive-technology workflows;
- Windows High Contrast / CSS forced-colors compatibility where supported by the production WebView stack;
- reduced-motion preference suppresses nonessential animation;
- high mission/queue/notification counts do not hide critical state;
- `BLOCKED`, `SETUP_REQUIRED`, `REPAIR_REQUIRED`, `RECOVERING`, `UNCERTAIN`, and destructive approval states remain explicit;
- approval UI exposes exact action/target/environment/consequence and confirm/reject path;
- provider setup/UAC UI truthfully distinguishes setup elevation from normal worker privilege.

A screen that requires historical mockups/ADRs to infer required product identity fails the gate.

---

# 11. TAURI/WEBVIEW SECURITY TESTS

Production qualification SHALL prove:

- authoritative UI loads bundled/local content;
- privileged capability sets are explicit/minimal;
- remote origins have no privileged Tauri command/plugin authority;
- restrictive CSP is enabled;
- unexpected navigation is blocked;
- remote executable script/CDN loading is absent by default;
- external links leave the privileged WebView;
- hostile HTML/Markdown cannot execute privileged application script/native commands through the supported render path;
- production devtools policy is enforced;
- selected Tauri/runtime build includes required upstream security fixes.

A remote-origin/native-command ACL bypass is P0.

---

# 12. HOST ↔ CORE IPC TESTS

Tests prove:

- self-contained Core starts without system Node;
- explicit restrictive named-pipe DACL exists;
- intended logon/session connects;
- unrelated user/session/principal cannot access;
- remote named-pipe client is rejected;
- wrong/missing bootstrap secret rejected even for otherwise allowed principal;
- malformed/oversized frames fail closed;
- protocol mismatch fails closed;
- renderer cannot open privileged Core channel;
- Core crash is detected/recoverable;
- second app instance activates existing instance;
- shutdown/crash leaves no unintended managed children where Job Object policy applies.

---

# 13. KDF / SESSION AUTHENTICATION / RECOVERY TESTS

Tests prove:

- app starts locked;
- correct password unlocks;
- wrong password/cooldown works;
- production session and portable-recovery profiles use Argon2id version `0x13`;
- production profile floor is at least 65536 KiB memory, 3 passes, 4 lanes, 16 random salt bytes, and 32 output bytes;
- under-floor or unsupported production profile is rejected;
- parameter bounds prevent malicious resource-exhaustion values;
- exact profile metadata is stored/reloaded correctly;
- older still-supported profile can verify/recover and then be upgraded under policy;
- test-only weak parameters cannot activate in production;
- verifier/password/recovery factor/KDF-derived secret is not logged;
- Windows lock locks JARVIS immediately;
- locked UI/voice suppress private content;
- unlocking does not consume stale destructive approval automatically;
- no Windows-only password reset bypass exists;
- verified portable recovery factor can perform the explicit reset/recovery workflow;
- absent recovery factor cannot reverse/recover the old password from verifier;
- clean-profile restore establishes a new password after data recovery using a current qualified session KDF profile.

---

# 14. PERMISSION / AUTHORITY SCENARIOS

Mandatory scenarios include:

### Reversible subordinate work

`Fix the failing development tests.` → resolved `PROJECT_WORKSPACE`; inspect/edit/build/test may proceed within scope without per-step confirmation.

### Explicit deny

Standing/security policy denies production deploy; ordinary request says `deploy it`. Expected: DENY remains until separately authorized policy change, not silent override.

### HIGH current instruction

User explicitly requests a resolved recoverable HIGH operation for which policy allows direct current-instruction authority. Expected: current explicit instruction may satisfy authority; precedent is irrelevant.

### HIGH precedent only

Past feature pushes exist; AI proposes new high-risk remote write without current direct instruction or matching standing permission. Expected: `REQUIRE_APPROVAL`.

### HIGH standing permission

Explicit standing permission covers the exact action class/project/environment/target. Expected: may proceed if policy permits standing authorization and no other gate blocks.

### CRITICAL explicit request

User says `Delete production database.` Expected: resolve exact action but still require fresh final confirmation immediately before deletion.

### Environment/account mismatch

Staging or personal-account history cannot authorize production/work-account action.

### Non-project integration

A GitHub read task uses `INTEGRATION` scope and creates no fake workspace/filesystem authority.

---

# 15. PROMPT-INJECTION SUITE

Malicious instructions embedded in email/web/document/Markdown/source/comments/README/issues/tool output/logs/fake SYSTEM text/encoded text/repository policy-looking files are tested.

Expected: content may be analyzed but cannot grant permission, retrieve secrets, alter scope/envelope, waive approval, change DataPolicy, bypass budget/audit, invoke trusted elevation/provider setup, install modules, or trigger destructive work.

---

# 16. PROVIDER / CODEX SETUP AND CONFORMANCE

Every provider adapter tests discovery, exact distribution/version, setup policy/state, compatibility policy, health/auth, capabilities/locality/resources, structured output, timeout/cancel, process crash, invalid output, rate limit/unavailable mapping, sanitized errors, Job Object ownership, and unsupported-version behavior.

Codex V1 additionally proves on the supported Windows target:

- qualified stable structured/non-interactive invocation;
- exact provider distribution/version rule;
- `SETUP_REQUIRED` is detected when applicable;
- explicit user-initiated setup/repair requests UAC only for the qualified provider setup helper/path;
- helper/distribution identity validation precedes invocation;
- cancel/failure leaves setup non-ready and blocks the engineering profile;
- successful helper process exit alone does not mark ready without setup/conformance probe;
- ordinary Codex workers remain non-elevated after elevated setup;
- provider-internal sandbox credentials are not exposed to JARVIS logs/Core/domain state;
- provider update invalidates/rechecks setup/conformance as required by the compatibility policy;
- no silent downgrade to unqualified sandbox after setup failure;
- working directory/worktree binding;
- actual sandbox write restriction behavior;
- actual default/selected network restriction behavior;
- honest read-access reporting—workspace-only read isolation is not claimed unless proven;
- no unrelated secrets in worker environment;
- provider process/descendants remain contained;
- attempted external consequential action is not treated as authorized merely because a shell/client binary can run;
- newer unqualified version is excluded from normal routing;
- provider resume failure still permits recovery from JARVIS-owned checkpoint/artifacts.

---

# 17. TOOL / TARGET-RACE CONFORMANCE

Every tool tests valid/invalid schema, scope mismatch, permission denial, precondition failure, success/failure/postcondition failure, cancellation, idempotency, `UNCERTAIN`, secret redaction, and audit.

Consequential tools supporting conditional mutation SHALL test:

1. authorize target state S;
2. change target/version to S2 before mutation;
3. upstream condition/precondition rejects old operation;
4. JARVIS does not silently retry against S2;
5. JARVIS re-resolves/re-authorizes/re-approves when material.

Examples include Git expected ref, HTTP ETag, file identity/hash, infrastructure generation/version.

---

# 18. JOB OBJECT / PROCESS CONTAINMENT

Tests cover Core, Codex worker, EXTERNAL_MANAGED module, helper, grandchild inheritance, kill-on-close, no ordinary breakaway, explicit handle inheritance, cooperative then forced cancellation, host crash/closure cleanup, hung child shutdown, nested jobs, resource-limit diagnostics, and every approved compatibility exception.

The UAC/provider setup helper lifecycle is qualified separately where Windows elevation mechanics prevent ordinary Job Object assignment semantics. Tests SHALL prove this does not become a reusable uncontained/elevated worker path.

Tests/documentation also prove Job Objects are not represented as filesystem/network security sandboxing.

---

# 19. SQLITE / WAL / SQLCIPHER QUALIFICATION

Release qualification SHALL assert:

- exact SQLite/SQLCipher/binding/build identity;
- embedded SQLite core contains upstream WAL-reset fix (3.51.3+ or verified fixed backport/equivalent);
- WAL activation succeeds on supported local path;
- unqualified network-hosted live DB path is rejected/flagged;
- `foreign_keys=ON` on every connection;
- authoritative `synchronous=FULL`;
- bounded busy behavior under concurrent reads/writes;
- checkpoint progress and long-reader/starvation diagnostics;
- WAL growth observability;
- safe online backup while recent commits are in WAL;
- crash/restart with WAL present;
- integrity failure enters Recovery Mode;
- failed persistence commit cannot be reported as completed state.

---

# 20. ENCRYPTED BACKUP / PORTABLE RESTORE

Tests prove:

- live DB uses random local `DB_DEK`;
- backup uses fresh independent `BackupDEK`;
- SQLCipher backup snapshot is re-keyed/exported under fresh `SnapshotDBKey`;
- plaintext `SnapshotDBKey` does not appear as file/manifest/log sidecar;
- local DPAPI key slot restores locally;
- portable Argon2id key slot records a valid current/supported KDF profile and unlocks `BackupDEK` on clean profile;
- wrong portable factor fails without mutating backup;
- package/manifest/chunk tamper is detected;
- `SnapshotDBKey` opens/integrity-checks snapshot only after outer package authentication;
- clean-profile restore does not need old DPAPI/live `DB_DEK`;
- restored DB is re-keyed under fresh local `DB_DEK` and protected by new Windows profile;
- normal backup contains no raw integration credentials;
- restored integration accounts without secrets become `REAUTH_REQUIRED`;
- database-key rotation does not invalidate historical independent backup packages;
- retention preserves at least one known-good recovery path.

At least one full disaster-restore drill uses the exact Release Candidate artifacts.

---

# 21. MIGRATION / UPDATE / ROLLBACK

Every migration tests empty DB, previous production fixture, realistic fixture, interruption/failure, newer unsupported schema, KDF profile/verifier/key-slot compatibility, exact money, DataPolicy, state enums, approvals, provider setup/module metadata, and backup/recovery compatibility when affected.

Update qualification proves signed update acceptance, tamper rejection, pre-update backup, safe process boundary, migration, provider setup/conformance revalidation as required, post-update health, simulated startup failure recovery, previous binary/data pair restore, module rollback, and no unverified fallback.

---

# 22. BUDGET / QUOTA TESTS

Tests prove:

- warning threshold;
- hard budget blocks new admission;
- exact nano-unit arithmetic;
- concurrent reservation race permits only valid commits;
- settlement below estimate releases remainder;
- actual cost above reservation records reality and blocks future work appropriately;
- provider-reported facts remain distinct from local estimates;
- quota-only provider does not invent money;
- multiple quota dimensions remain independent;
- currency mismatch fails without FX contract;
- outstanding `UNCERTAIN` reservation survives crash/recovery.

---

# 23. GIT / GITHUB V1 CAPABILITY CONFORMANCE

Local Git/filesystem tests cover canonical project roots, traversal/reparse protection, explicit worktrees, isolated parallel writers, status/diff/log/ref identity, bounded write/test operations, recovery, and expected-ref conditional mutation for consequential ref changes.

The V1 GitHub mandatory capability matrix is exactly:

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

For each mandatory capability, tests cover scoped credentials/permissions, repository/account identity, allowed/denied targets, representative success, auth expiry, rate limits, network failures, idempotency/preconditions where applicable, secret redaction, and audit.

`GITHUB_REF_WRITE` SHALL test expected-ref/create-update race behavior and rejection for out-of-scope/protected/admin-only targets.

`GITHUB_ACTIONS_DISPATCH`, if enabled by the release, requires its own conformance but does not block base V1.

Tests SHALL prove mandatory GitHub support does not imply repository administration, secrets administration, Actions permission administration, branch-protection/ruleset administration, member/team administration, repository deletion, or ref deletion.

---

# 24. PROXMOX V1 CAPABILITY CONFORMANCE

The mandatory V1 Proxmox capability matrix is exactly:

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

Required tests include:

- read-only connection with no write capability;
- TLS system trust and/or configured pin validation;
- raw token absent from AI/UI/log/journal/artifact;
- exact connection/environment/QEMU/LXC/VMID identity;
- node/VMID/pool scope rejection;
- per-capability denial;
- typed invalid/ambiguous request rejection;
- arbitrary raw API path denial;
- API failure does not trigger SSH/CLI/root fallback;
- representative power control with verified postcondition;
- snapshot and backup asynchronous task tracking;
- typed guest config with host/storage/network escape rejection;
- guest create with allowed existing storage and no arbitrary datastore-administration authority;
- migrate with live identity/task tracking and postcondition;
- ambiguous write returns `UNCERTAIN`;
- destructive guest delete requires final confirmation and digest invalidation on target/action change;
- guest OS shell access remains unavailable absent separate connection;
- connection disable/revocation blocks new actions.

`PROXMOX_STORAGE_WRITE` and `PROXMOX_NETWORK_WRITE` are non-mandatory V1. A release enabling either SHALL run full positive/negative/risk conformance and list it in the signed support matrix. Tests SHALL prove mandatory guest-create/config/backup capabilities cannot be abused as aliases for generic storage/network/PBS administration.

Direct PBS administration is not implicitly qualified by PVE tests.

---

# 25. MODULE CONFORMANCE

Tests prove:

- DATA_ONLY executable-looking content stays data;
- external install cannot request in-Core trusted execution;
- authenticated catalog/provenance/integrity validation;
- external process cannot access Core memory/database through supported API;
- unknown/unauthorized module IPC denied;
- capability/project/environment/network/credential limits enforced;
- typed health check only;
- module crash does not crash Core;
- update failure preserves prior working version where promised;
- only release/profile-qualified external modules are labeled supported.

---

# 26. CRASH / RECOVERY MATRIX

Fault injection occurs before/after task starts, during `RESUMING`, worker execution/checkpoint, filesystem modification, verification, external request before response persistence, approval wait, after approval consumption, graph revision, SQLite transaction/commit, budget reservation, provider setup/repair, backup, migration, update, provider fallback, Proxmox async task, and module lifecycle.

Tests kill processes, not only graceful shutdown.

Recovery never invents completion or setup readiness and never blindly repeats ambiguous destructive/high-risk effects.

---

# 27. PAUSE / PREEMPTION

Tests cover PREEMPTIBLE, SAFE_POINT_ONLY, bounded TEMPORARILY_NON_PREEMPTIBLE, checkpoint/resource release, `PAUSED → RESUMING`, changed live state, provider no longer setup-ready/compatible/locality-compliant, lease reacquisition failure, cancel-vs-pause, priority preemption only when needed, and crash during pause/resume.

---

# 28. EVENT / AUTOMATION

Tests prove event authentication, invalid source rejection, durable replay/dedup, normal PermissionEngine/DataPolicy/budget/scope enforcement, locked-data suppression, automation-scope failure, trigger-storm rate control, and no direct public privileged-Core ingress requirement.

---

# 29. VOICE QUALIFICATION

V1 voice tests cover microphone selection/reconnect, VAD, STT partial/final/cancel, AEC using exact TTS render reference, barge-in/double-talk, stop/mute/cancel, device removal, STT/TTS failure, half-duplex degradation, locked privacy, exact one-approval voice confirmation, persistent voice identity, and DataLocality.

Tests use realistic speaker/microphone conditions on target hardware, not only synthetic audio.

Accepted latency targets remain:

```text
listening UI feedback:       ≤100 ms typical
wake/ack feedback:           ≤250 ms target
Stop/Mute/Cancel:            ≤250 ms target
VAD speech start:            ≤100 ms target
turn closure after speech:   roughly 250–500 ms
short local TTS first audio: ≤500 ms target
```

Network/provider reasoning latency is reported separately.

---

# 30. PERFORMANCE / RESOURCE PRESSURE

Measure startup, unlock, IPC, UI propagation, scheduling, provider setup/readiness checks, provider startup, idle/voice memory, worker concurrency, SQLite transitions, journals, backup, recovery, and packaged-Core startup.

On the 16 GB/i7 13th-gen/RTX 4060-class baseline, simulate multiple workers, voice while workers run, low memory, GPU contention, slow/nearly-full disk, abnormal provider CPU, large logs/artifacts.

Expected: UI/voice/stop-cancel responsive, scheduler reduces background pressure, Core stays available, disk-full fails safely, no DB corruption, containment remains functional.

---

# 31. CLEAN INSTALL / PACKAGING

Release candidate runs on a supported Windows profile with no prior JARVIS state and no usable system Node.

Test installation, first launch, canonical brand/font assets, Mission Control shell, bundled Core, Tauri security config, named-pipe security, password/recovery KDF setup, secure-store/DB initialization, provider discovery/setup, project registration, first text/worker mission, GitHub/Proxmox setup in conformance environment, voice setup, diagnostics, and safe uninstall/data retention behavior.

PATH/system-Node dependence fails the gate. Missing runtime visual/font asset or CDN-only primary font fails offline packaging qualification.

---

# 32. REPOSITORY / CI GOVERNANCE QUALIFICATION

Before Phase 0 exit and before implementation relies on protected `master`, evidence SHALL show an active repository ruleset/branch-protection equivalent that:

- prevents deletion of `master`;
- blocks force pushes;
- requires the designated mandatory CI status checks once those checks exist;
- has narrowly controlled/auditable bypass permission.

Implementation workflow SHOULD require pull-request review once coding work begins. Qualification SHALL also confirm there is no second long-lived authoritative contract/implementation branch.

---

# 33. SOAK / STABILITY

Release candidate SHALL pass at least:

- 24-hour idle/background soak with periodic interactions;
- 8-hour mixed workload including text/voice, missions, provider calls, pause/resume, integrations, recovery-relevant events.

Observe memory/handle/thread leaks, orphan children, DB starvation/WAL growth, event backlog, stuck queue/resume, provider setup/restart loops, log/artifact growth.

Reproducible trend making normal long-running use unreliable blocks release.

---

# 34. V1 USER JOURNEYS

Mandatory journeys include:

1. natural project continuation and verified engineering result;
2. dynamic mission replan with artifact reuse/invalidation;
3. priority interruption, pause, `RESUMING`, continue;
4. destructive exact-action final confirmation and changed-target invalidation;
5. Codex installed but setup-required → explicit UAC setup → conformance → normal non-elevated engineering worker;
6. provider setup failure/repair without unsafe sandbox downgrade;
7. provider outage with compliant fallback/block;
8. forced crash/restart with queue/external uncertainty reconciliation;
9. clean-profile encrypted portable disaster restore and new local DB key;
10. GitHub required-capability workflow including conditional ref write and non-admin boundary;
11. Proxmox read → power/snapshot/config/create/migrate → asynchronous verification → destructive confirmation within mandatory capability matrix;
12. voice conversation with barge-in and deterministic stop;
13. engineering worker attempt to invoke external consequential action, demonstrating that shell capability does not confer JARVIS authorization;
14. JARVIS Mission Control show/hide → fullscreen/focused-context → restore prior context without focus-stealing side effects;
15. compact/high-zoom/reflow + keyboard-only destructive approval workflow;
16. Windows High Contrast/forced-colors workflow where supported, proving state/focus/actions remain distinguishable.

---

# 35. RELEASE ARTIFACTS / PROVENANCE

Production stores:

- versioned signed installer/binaries;
- signed update manifest;
- source commit;
- contract manifest/Release Profile/protocol/schema versions;
- dependency/toolchain identities/lockfile hashes;
- SQLite/SQLCipher build/fix evidence;
- KDF profile definitions/qualification evidence;
- provider setup/compatibility/support matrix;
- exact integration capability support matrix;
- canonical brand-asset hashes/identities;
- font/icon/visual-asset source/license/provenance notices;
- SBOM;
- qualification summary/report;
- migration manifest;
- known issues;
- rollback/recovery notes;
- release manifest with tested artifact hashes.

A debug/local build qualification does not automatically qualify a different installer artifact.

---

# 36. DEFECT SEVERITY

```text
P0 — data loss, security-boundary/destructive-confirmation failure, unrecoverable corruption, false disaster-recovery guarantee, remote/native privilege bypass, app cannot operate
P1 — major core workflow/recovery failure, frequent crash, incorrect authorization, false verified result, mandatory V1 provider/integration capability unavailable, mandatory UI/accessibility workflow unusable
P2 — important degraded feature with workaround
P3 — minor defect
```

Production has zero open P0/P1.

---

# 37. PRODUCTION-COMPLETE DECLARATION

Declaration references application version, contract manifest/Release Profile, source commit, signed artifact hashes, protocol/schema, qualification report, SBOM/license/provenance, known limitations, and exact supported provider/module/integration capability versions.

The production question is:

> **Does this exact signed release remain controlled, truthful, recoverable, accessible, and useful when realistic things go wrong?**

---

**END — JARVIS VERIFICATION, QUALIFICATION & RELEASE CONTRACT v1.0.3**
