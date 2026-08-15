# JARVIS Verification, Qualification & Release Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md`  
**Version:** 1.0.6
**Date:** August 12, 2026

---

# 1. PURPOSE

This contract defines the evidence required before an implementation or release may be called complete or production-ready.

Code existence, model self-report, documentation completion, one happy-path demonstration, or cross-platform framework support is insufficient.

Production is verified behavior under normal success, ambiguity, interruption, crash, stale state, provider setup/repair, provider outage, adversarial input, target race, recovery, update, resource pressure, accessibility modes, adaptive layouts, platform-capability failure, and real release packaging.

V1 qualification is for a **private/internal Windows FULL_HOST** artifact. Linux runtime/Android companion are not V1 gates, but architecture tests SHALL prove that Windows implementation preserves the platform boundaries required by the active v1.0.7 contract suite.

---

# 2. RELEASE CLASSES

```text
DEVELOPMENT
INTERNAL ALPHA
BETA
RELEASE CANDIDATE
PRIVATE_INTERNAL
PRODUCTION_PUBLIC (future profile only)
```

Only a release satisfying every mandatory v1.0.7 gate for the active Release Profile may be labeled `PRIVATE_INTERNAL`. A public `PRODUCTION_PUBLIC` label requires a future Release Profile that explicitly enables public distribution and public-trust signing.

`Production Complete` remains the final qualification declaration for the active profile; under the current profile it means a fully qualified `PRIVATE_INTERNAL` release and does not imply public distribution or public trust.

Qualification SHALL bind to one source commit, contract manifest, Release Profile, PlatformFamily/RuntimeRole/backend profile, exact protocol/schema versions, and exact signed installer/update artifacts.

For `PRIVATE_INTERNAL`, qualification SHALL additionally bind the exact Authenticode certificate identity, trust-enrollment evidence for every tested Windows profile, authorized target scope, and an explicit statement that the artifact is not publicly trusted.

---

# 3. DEFINITION OF DONE — TASK

A task is complete only when:

- required output/artifact exists;
- mandatory acceptance criteria are evaluated;
- objective/live verification passes where available;
- required independent review passes where judgment is needed;
- no unresolved approval remains;
- required `UNKNOWN` results are resolved unless completion policy explicitly permits partial result;
- material worker/provider/tool/platform errors are resolved or reflected in non-complete state;
- resulting DataPolicy is valid;
- evidence/result is durable.

Worker/provider prose saying “done” is never sufficient by itself.

---

# 4. DEFINITION OF DONE — MISSION

Mission completion requires required terminal nodes complete, no unresolved required failed/blocked/invalidated node without accepted replacement, mission acceptance policy passing, synthesis using current valid outputs, intended external effects verified, no remaining required queued work, risks surfaced, and durable completion record.

---

# 5. FEATURE DEFINITION OF DONE

A production feature has implementation, typed schemas/APIs, unit/property tests, integration/failure/security tests as applicable, recovery behavior, diagnostics, degraded UX, accessibility/adaptive behavior when user-facing, platform-capability behavior where applicable, documentation, migration/update compatibility, and production scenario coverage.

A feature without failure/recovery semantics is incomplete.

---

# 6. PRODUCTION RELEASE GATES

A V1 production release SHALL pass at least:

1. Contract Manifest + Release Profile conformance;
2. reproducible build/toolchain;
3. authoritative-branch/CI governance gate;
4. static/architecture analysis;
5. **platform portability/composition/import-boundary gate**;
6. unit tests;
7. property/state-machine tests;
8. protocol/schema cross-language tests;
9. JARVIS Mission Control UI identity/adaptive/accessibility gate;
10. Tauri/WebView security gate;
11. Windows named-pipe principal/bootstrap gate;
12. KDF/session/recovery-profile gate;
13. PermissionEngine/approval safety gate;
14. prompt-injection/content-authority gate;
15. provider setup/version/health/platform/sandbox conformance;
16. tool contract/TOCTOU gate;
17. persistence/SQLite-WAL/SQLCipher gate;
18. encrypted local/portable backup restore gate;
19. migration gate;
20. crash/recovery/uncertain-side-effect gate;
21. Windows Job Object/process-tree containment gate;
22. exact budget/quota/accounting gate;
23. module/catalog/supply-chain/update/platform gate;
24. Local filesystem/Git integration conformance;
25. exact GitHub V1 capability-matrix conformance;
26. exact Proxmox VE V1 capability-matrix conformance;
27. voice qualification;
28. event/automation security/dedup gate;
29. performance/latency gate;
30. resource-pressure gate;
31. clean install with no usable system Node;
32. previous-production upgrade/rollback;
33. signed installer/update verification;
34. SBOM/license/provenance/release-manifest gate;
35. soak/stability gate;
36. V1 production user-journey suite.

Zero open P0/P1 defects. Critical/High reachable vulnerability policy from the Operations Contract SHALL pass.

---

# 7. TEST LAYERS

Repository test layers include:

```text
unit
property/state-machine
schema/cross-language contract
platform architecture/contracts
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
- platform identity/runtime-role/capability availability semantics;
- provider setup state + compatibility/health/platform separation;
- provider routing/locality/platform support;
- exact budget arithmetic/reservations;
- graph validation/mission acceptance;
- all state transitions including durable `RESUMING`;
- event dedup;
- memory ranking/confidence;
- module lifecycle/execution-class/platform state;
- KDF profile validation/upgrade state;
- backup retention/format/key-slot state;
- retry/circuit-breaker;
- locked-state suppression.

Property/model tests SHALL prove terminal states cannot return illegally, consumed approval cannot replay, exclusive leases have one owner, invalid graph cycles fail, non-project scopes do not gain filesystem authority, DataLocality cannot silently weaken, under-floor production KDF profiles fail, provider setup cannot become ready by assumption, binary floating point does not determine authoritative monetary admission, and missing platform capability does not silently become an allowed fallback.

---

# 9. PLATFORM PORTABILITY / COMPOSITION / IMPORT-BOUNDARY GATE

V1 SHALL prove the architecture required for future Linux full-host support without requiring a Linux runtime release.

Required evidence includes:

- `WINDOWS + FULL_HOST` is the active V1 platform/runtime identity;
- shared Core/domain/policy/protocol packages do not import Windows native backend implementations;
- platform-native functionality is reached through explicit semantic capability/composition boundaries;
- OS selection/branching is concentrated in platform composition/adapters/packaging/platform-specific providers or tools rather than scattered through domain/features;
- Windows native backend implementations remain independently testable behind those contracts;
- Windows secure-storage behavior still uses the qualified Windows backend;
- Windows local IPC still satisfies the complete named-pipe security gate;
- Windows process supervision still satisfies the complete Job Object gate;
- platform path identity distinguishes Windows-native path semantics from generic project identity;
- `PlatformPathRef`/equivalent rejects accidental wrong-platform interpretation;
- platform capability unavailable/unqualified produces explicit unavailable/degraded/blocked behavior rather than weaker fallback;
- provider support is tied to platform/runtime-role conformance rather than executable presence alone;
- module/tool compatibility can express platform/runtime-role constraints;
- portable recovery slot can unlock backup state without historical Windows DPAPI/local secure-store material;
- shared Mission Control design-system semantics do not require Windows-only visual components for core product state;
- Linux and Android are not labeled `SUPPORTED` by the V1 artifact/support matrix.

A test that merely compiles common code on Linux does not qualify Linux as a full host. Conversely, Linux runtime tests are not required for Windows V1 Production Complete.

Any architecture shortcut that makes shared PermissionEngine, mission, memory, budget, protocol, or integration semantics directly depend on Windows implementation APIs fails this gate.

---

# 10. CROSS-LANGUAGE PROTOCOL/CANONICALIZATION

Rust and TypeScript fixtures SHALL prove:

- IPC envelopes and explicit response union agree;
- IDs/times/DataPolicy/MoneyAmount round-trip;
- PlatformFamily/RuntimeRole/PlatformRuntimeIdentity/PlatformPathRef round-trip;
- KDF profile shapes/validation agree;
- provider setup/compatibility/health/platform enums/structures agree;
- one durable `RESUMING` enum meaning;
- ExecutionScope, GitHubCapability, ProxmoxCapability, and ModuleManifest variants agree;
- `CanonicalActionDescriptorV1` produces identical RFC 8785 canonical bytes and SHA-256/base64url-no-pad digest;
- property order and insignificant source JSON formatting do not alter digest;
- material target/scope/account/environment/argument/tool-version change alters digest;
- duplicate key/non-finite/negative-zero/invalid Unicode/unsafe number representations are rejected;
- raw secrets never enter descriptor.

Any cross-language security/platform-material mismatch is release-blocking.

---

# 11. UI IDENTITY / ADAPTIVE / ACCESSIBILITY QUALIFICATION

Production qualification SHALL prove the exact Windows Release Candidate implements the current JARVIS UI Identity & Design System Contract rather than a generic substitute.

Required evidence includes:

- canonical brand-source usage and generated platform variants traceable to those sources;
- primary local/offline font packaging and recorded font/icon/third-party visual license/provenance;
- one dark-theme Mission Control shell across conversation, work, approvals, systems/integrations, provider setup, memory/artifacts, diagnostics, and voice;
- deterministic window presentation behavior;
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

# 12. TAURI/WEBVIEW SECURITY TESTS

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

# 13. HOST ↔ CORE IPC TESTS

Windows V1 tests prove:

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

The semantic PlatformLocalIpc contract is additionally unit/architecture-tested without replacing the real Windows security tests.

---

# 14. KDF / SESSION AUTHENTICATION / RECOVERY TESTS

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
- Windows lock maps into generic JARVIS locked state immediately;
- locked UI/voice suppress private content;
- unlocking does not consume stale destructive approval automatically;
- no Windows-login-only password reset bypass exists;
- verified portable recovery factor can perform the explicit reset/recovery workflow;
- absent recovery factor cannot reverse/recover the old password from verifier;
- clean-profile restore establishes a new password after data recovery using a current qualified session KDF profile.

---

# 15. PERMISSION / AUTHORITY SCENARIOS

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

### Platform capability unavailable

A task requires a native capability unavailable/unqualified on the active backend. Expected: deterministic block/degraded state; no weaker fallback and no authority expansion.

---

# 16. PROMPT-INJECTION SUITE

Malicious instructions embedded in email/web/document/Markdown/source/comments/README/issues/tool output/logs/fake SYSTEM text/encoded text/repository policy-looking files are tested.

Expected: content may be analyzed but cannot grant permission, retrieve secrets, alter scope/envelope, waive approval, change DataPolicy, bypass budget/audit, invoke trusted elevation/provider setup, install modules, or trigger destructive work.

---

# 17. PROVIDER / CODEX SETUP AND CONFORMANCE

Every provider adapter tests discovery, exact distribution/version, platform/runtime-role identity, setup policy/state, compatibility policy, health/auth, capabilities/locality/resources, structured output, timeout/cancel, process crash, invalid output, rate limit/unavailable mapping, sanitized errors, process-supervisor ownership, and unsupported-version/platform behavior.

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
- a Linux/other platform profile is not considered supported from Windows conformance evidence;
- provider resume failure still permits recovery from JARVIS-owned checkpoint/artifacts.

---

# 18. TOOL / TARGET-RACE CONFORMANCE

Every tool tests valid/invalid schema, platform compatibility/capability, scope mismatch, permission denial, precondition failure, success/failure/postcondition failure, cancellation, idempotency, `UNCERTAIN`, secret redaction, and audit.

Consequential tools supporting conditional mutation SHALL test:

1. authorize target state S;
2. change target/version to S2 before mutation;
3. upstream condition/precondition rejects old operation;
4. JARVIS does not silently retry against S2;
5. JARVIS re-resolves/re-authorizes/re-approves when material.

---

# 19. WINDOWS JOB OBJECT / PROCESS CONTAINMENT

Tests cover Core, Codex worker, EXTERNAL_MANAGED module, helper, grandchild inheritance, kill-on-close, no ordinary breakaway, explicit handle inheritance, cooperative then forced cancellation, host crash/closure cleanup, hung child shutdown, nested jobs, resource-limit diagnostics, and every approved compatibility exception.

The UAC/provider setup helper lifecycle is qualified separately where Windows elevation mechanics prevent ordinary Job Object assignment semantics. Tests SHALL prove this does not become a reusable uncontained/elevated worker path.

Tests/documentation also prove Job Objects are not represented as filesystem/network security sandboxing or as the universal shared process-supervision concept.

---

# 20. SQLITE / WAL / SQLCIPHER QUALIFICATION

Release qualification SHALL assert:

- exact SQLite/SQLCipher/binding/build identity;
- embedded SQLite core contains upstream WAL-reset fix;
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

# 21. ENCRYPTED BACKUP / PORTABLE RESTORE

Tests prove:

- live DB uses random local `DB_DEK`;
- Windows local DB key protection uses qualified PlatformSecureStorage;
- backup uses fresh independent `BackupDEK`;
- SQLCipher backup snapshot is re-keyed/exported under fresh `SnapshotDBKey`;
- plaintext `SnapshotDBKey` does not appear as file/manifest/log sidecar;
- local DPAPI key slot restores locally on Windows;
- portable Argon2id key slot records a valid current/supported KDF profile and unlocks `BackupDEK` on a clean Windows profile without historical DPAPI;
- wrong portable factor fails without mutating backup;
- package/manifest/chunk tamper is detected;
- `SnapshotDBKey` opens/integrity-checks snapshot only after outer package authentication;
- clean-profile restore does not need old DPAPI/live `DB_DEK`;
- restored DB is re-keyed under fresh local `DB_DEK` and protected by new Windows profile;
- normal backup contains no raw integration credentials;
- restored integration accounts without secrets become `REAUTH_REQUIRED`;
- database-key rotation does not invalidate historical independent backup packages;
- retention preserves at least one known-good recovery path.

At least one full Windows disaster-restore drill uses the exact Release Candidate artifacts.

For the active `PRIVATE_INTERNAL` profile, the Release Candidate artifacts may use the enrolled self-signed/private-CA Authenticode identity defined by the Release Profile. The drill SHALL use that exact signed artifact and SHALL verify the target trust enrollment before launch.

Cross-platform Windows↔Linux restore is not claimed or required by V1.

---

# 22. MIGRATION / UPDATE / ROLLBACK

Every migration tests empty DB, previous production fixture, realistic fixture, interruption/failure, newer unsupported schema, KDF profile/verifier/key-slot compatibility, exact money, DataPolicy, platform/path identity, state enums, approvals, provider setup/module metadata, and backup/recovery compatibility when affected.

Update qualification proves signed update acceptance, tamper rejection, pre-update backup, safe process boundary, migration, provider setup/conformance revalidation as required, post-update health, simulated startup failure recovery, previous binary/data pair restore, module rollback, and no unverified fallback.

---

# 23. BUDGET / QUOTA TESTS

Tests prove warning threshold, hard-budget admission, exact nano-unit arithmetic, concurrent reservation safety, settlement, actual-cost-over-estimate truthfulness, provider-reported provenance, independent quota dimensions, currency mismatch without FX contract, and recovery of outstanding `UNCERTAIN` reservations.

---

# 24. GIT / GITHUB V1 CAPABILITY CONFORMANCE

Local Git/filesystem tests cover canonical Windows project roots, traversal/reparse protection, explicit worktrees, isolated parallel writers, status/diff/log/ref identity, bounded write/test operations, recovery, and expected-ref conditional mutation for consequential ref changes.

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

# 25. PROXMOX V1 CAPABILITY CONFORMANCE

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

Required tests include read-only connection, TLS trust/pin, token secrecy, exact identity, scope rejection, per-capability denial, typed invalid request rejection, raw API denial, no SSH/CLI fallback, representative power/snapshot/backup/config/create/migrate postconditions, `UNCERTAIN`, destructive confirmation, guest-shell separation, and connection revocation.

`PROXMOX_STORAGE_WRITE` and `PROXMOX_NETWORK_WRITE` are non-mandatory V1. A release enabling either SHALL run full positive/negative/risk conformance and list it in the signed support matrix.

Direct PBS administration is not implicitly qualified by PVE tests.

---

# 26. MODULE CONFORMANCE

Tests prove DATA_ONLY executable-looking content stays data, external install cannot request in-Core trust, catalog/integrity validation, external process isolation from Core/database, unauthorized IPC denial, capability/network/credential limits, typed health checks, crash isolation, staged rollback, platform/runtime-role compatibility enforcement, and only release/profile-qualified modules labeled supported.

---

# 27. CRASH / RECOVERY MATRIX

Fault injection occurs before/after task starts, during `RESUMING`, worker execution/checkpoint, filesystem modification, verification, external request before response persistence, approval wait, after approval consumption, graph revision, SQLite transaction/commit, budget reservation, provider setup/repair, platform-capability call, backup, migration, update, provider fallback, Proxmox async task, and module lifecycle.

Tests kill processes, not only graceful shutdown.

Recovery never invents completion/setup/platform readiness and never blindly repeats ambiguous destructive/high-risk effects.

---

# 28. PAUSE / PREEMPTION

Tests cover PREEMPTIBLE, SAFE_POINT_ONLY, bounded TEMPORARILY_NON_PREEMPTIBLE, checkpoint/resource release, `PAUSED → RESUMING`, changed live state, provider no longer setup-ready/compatible/locality/platform-compliant, platform capability loss, lease reacquisition failure, cancel-vs-pause, priority preemption only when needed, and crash during pause/resume.

---

# 29. EVENT / AUTOMATION

Tests prove event authentication, invalid source rejection, durable replay/dedup, normal PermissionEngine/DataPolicy/budget/scope enforcement, locked-data suppression, automation-scope failure, trigger-storm rate control, and no direct public privileged-Core ingress requirement.

No V1 test opens a general remote companion Core API.

---

# 30. VOICE QUALIFICATION

V1 Windows voice tests cover microphone selection/reconnect, VAD, STT partial/final/cancel, AEC using exact TTS render reference, barge-in/double-talk, stop/mute/cancel, device removal, STT/TTS failure, half-duplex degradation, locked privacy, exact one-approval voice confirmation, persistent voice identity, and DataLocality.

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

# 31. PERFORMANCE / RESOURCE PRESSURE

Measure startup, unlock, IPC, UI propagation, scheduling, provider setup/readiness checks, provider startup, idle/voice memory, worker concurrency, SQLite transitions, journals, backup, recovery, and packaged-Core startup.

On the 16 GB/i7 13th-gen/RTX 4060-class Windows baseline, simulate multiple workers, voice while workers run, low memory, GPU contention, slow/nearly-full disk, abnormal provider CPU, large logs/artifacts.

Expected: UI/voice/stop-cancel responsive, scheduler reduces background pressure, Core stays available, disk-full fails safely, no DB corruption, containment remains functional.

---

# 32. CLEAN INSTALL / PACKAGING

Release candidate runs on a supported Windows profile with no prior JARVIS state and no usable system Node.

Test installation, first launch, canonical brand/font assets, Mission Control shell, bundled Core, platform composition selecting the Windows backend, Tauri security config, named-pipe security, password/recovery KDF setup, secure-store/DB initialization, provider discovery/setup, project registration, first text/worker mission, GitHub/Proxmox setup in conformance environment, voice setup, diagnostics, and safe uninstall/data retention behavior.

PATH/system-Node dependence fails the gate. Missing runtime visual/font asset or CDN-only primary font fails offline packaging qualification.

No Linux/Android artifact is required or implied by this gate.

---

# 33. REPOSITORY / CI GOVERNANCE QUALIFICATION

Before Phase 0 exit, qualification SHALL determine and record the authoritative repository's actual hosting capability and effective governance mode.

If server-side branch protection/rulesets are available for the authoritative repository, evidence SHALL show the server-enforced mode is active on `master`, prevents deletion and force push, requires the designated mandatory CI context, and keeps bypass narrowly controlled/auditable. An available server-side protection capability that is deliberately disabled fails this gate.

If the hosting provider/account does not expose server-side branch protection/rulesets because of a verified plan/platform capability limitation, the gate MAY pass in `COMPENSATING_CONTROLS` mode only when evidence proves all of the following:

- the hosting limitation is observed and recorded rather than inferred;
- `master` remains the sole authoritative branch and is truthfully reported as not server-protected;
- implementation work uses temporary branches rather than routine direct implementation writes to `master`;
- the designated mandatory CI context passes on the exact candidate commit before authoritative integration;
- the live `master` tip is re-fetched immediately before integration and stale/unexpected movement causes reconciliation rather than overwrite;
- authoritative integration uses a non-force update only;
- the resulting authoritative tip, intended diff, and CI/audit evidence are verified after integration;
- the compensating mode is not represented as equivalent hard prevention of an out-of-band administrator force push or deletion;
- server-enforced protection becomes mandatory again if the hosting capability later becomes available.

The compensating mode SHALL NOT waive CI, authorize force-push implementation workflow, create broad bypass, or allow a paid hosting feature to become a hidden JARVIS product prerequisite.

Implementation workflow SHOULD require pull-request review once coding work begins. Qualification SHALL also confirm there is no second long-lived authoritative contract/implementation branch.

---

# 34. SOAK / STABILITY

Release candidate SHALL pass at least:

- 24-hour idle/background soak with periodic interactions;
- 8-hour mixed workload including text/voice, missions, provider calls, pause/resume, integrations, recovery-relevant events.

Observe memory/handle/thread leaks, orphan children, DB starvation/WAL growth, event backlog, stuck queue/resume, provider setup/restart loops, log/artifact growth.

Reproducible trend making normal long-running use unreliable blocks release.

---

# 35. V1 USER JOURNEYS

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
16. Windows High Contrast/forced-colors workflow where supported, proving state/focus/actions remain distinguishable;
17. architecture fixture showing a shared Core/domain feature consumes a semantic platform capability while the Windows implementation is injected at composition, with no direct Windows-native import in the shared feature;
18. required platform capability becomes unavailable and JARVIS blocks/degrades the dependent feature rather than launching a weaker fallback.

These are architecture/Windows journeys; no Linux runtime or Android companion journey is required by V1.

---

# 36. RELEASE ARTIFACTS / PROVENANCE

Production stores:

- versioned signed Windows installer/binaries;
- signed update manifest;
- source commit;
- contract manifest/Release Profile/protocol/schema versions;
- PlatformFamily/RuntimeRole/architecture/backend profile/capability matrix;
- dependency/toolchain identities/lockfile hashes;
- SQLite/SQLCipher build/fix evidence;
- KDF profile definitions/qualification evidence;
- provider setup/compatibility/platform support matrix;
- exact integration capability support matrix;
- module platform support matrix;
- canonical brand-asset hashes/identities;
- font/icon/visual-asset source/license/provenance notices;
- SBOM;
- qualification summary/report;
- migration manifest;
- known issues;
- rollback/recovery notes;
- release manifest with tested artifact hashes.

A debug/local build qualification does not automatically qualify a different installer artifact or platform artifact.

---

# 37. FUTURE LINUX / COMPANION QUALIFICATION

A future Linux full-host production claim requires a new/updated Release Profile and complete independent platform qualification for Linux native mechanisms, providers, packaging, voice, persistence/recovery, security, performance, and supported integrations/modules.

A future companion claim requires a separately defined Remote Access Gateway/security/protocol profile before any consequential remote control is supported. It SHALL include device/host enrollment and identity, authenticated encryption, replay protection, revocation, remote instruction provenance, per-device authority, approval semantics, privacy, audit, and lost-device behavior.

Neither future path may be inferred from V1 Windows tests.

---

# 38. DEFECT SEVERITY

```text
P0 — data loss, security-boundary/destructive-confirmation failure, unrecoverable corruption, false disaster-recovery guarantee, remote/native privilege bypass, app cannot operate
P1 — major core workflow/recovery failure, frequent crash, incorrect authorization, false verified result, mandatory V1 provider/integration capability unavailable, mandatory UI/accessibility workflow unusable, platform-boundary defect that forces shared Core/domain to depend on Windows implementation APIs
P2 — important degraded feature with workaround
P3 — minor defect
```

Production has zero open P0/P1.

---

# 39. PRODUCTION-COMPLETE DECLARATION

Declaration references application version, contract manifest/Release Profile, source commit, signed artifact hashes, PlatformFamily/RuntimeRole/backend profile, protocol/schema, qualification report, SBOM/license/provenance, known limitations, and exact supported provider/module/integration capability versions.

The production question is:

> **Does this exact signed Windows FULL_HOST release remain controlled, truthful, recoverable, accessible, useful, and architecturally clean when realistic things go wrong?**

---

**END — JARVIS VERIFICATION, QUALIFICATION & RELEASE CONTRACT v1.0.6**
