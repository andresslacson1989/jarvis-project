# JARVIS Verification & Release Contract

**Contract Suite Version:** 1.0.8
**Version:** 1.0.9
**Component:** `J05`
**Status:** Canonical normative component
**Scope:** definition of done, verification layers, qualification gates, release evidence, defect handling, and the Production Complete declaration

---

This file is the sole normative home for the clauses in this component. The manifest fixes the component set and revisions; the Release Profile fixes the supported V1 product profile. The implementation plan, execution matrix, evidence records, and audits are execution aids and do not add authority.

Clause identifiers in this file are stable traceability anchors. Cross-component references use clause identifiers and the separate Release Profile; historical material cannot override or supplement this suite.
## J05-VER-01 — PURPOSE

This contract defines the evidence required before an implementation or release may be called complete or production-ready.

Code existence, model self-report, documentation completion, one happy-path demonstration, or cross-platform framework support is insufficient.

Production is verified behavior under normal success, ambiguity, interruption, crash, stale state, provider setup/repair, provider outage, adversarial input, target race, recovery, update, resource pressure, accessibility modes, adaptive layouts, platform-capability failure, and real release packaging.

V1 production qualification is for a **Windows FULL_HOST** artifact. Linux runtime/Android companion are not V1 gates, but architecture tests SHALL prove that Windows implementation preserves the platform boundaries required by the active v1.0.8 contract suite.

---

## J05-VER-02 — RELEASE CLASSES

```text
DEVELOPMENT
INTERNAL ALPHA
BETA
RELEASE CANDIDATE
PRODUCTION
```

Only a release satisfying every mandatory v1.0.8-suite gate for the active Release Profile may be labeled `PRODUCTION`/`Production Complete`.

Qualification SHALL bind to one source commit, contract manifest, Release Profile, PlatformFamily/RuntimeRole/backend profile, exact protocol/schema versions, and exact signed installer/update artifacts.

---

## J05-VER-03 — DEFINITION OF DONE — TASK

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

## J05-VER-04 — DEFINITION OF DONE — MISSION

Mission completion requires required terminal nodes complete, no unresolved required failed/blocked/invalidated node without accepted replacement, mission acceptance policy passing, synthesis using current valid outputs, intended external effects verified, no remaining required queued work, risks surfaced, and durable completion record.

---

## J05-VER-05 — FEATURE DEFINITION OF DONE

A production feature has implementation, typed schemas/APIs, unit/property tests, integration/failure/security tests as applicable, recovery behavior, diagnostics, degraded UX, accessibility/adaptive behavior when user-facing, platform-capability behavior where applicable, documentation, migration/update compatibility, and production scenario coverage.

A feature without failure/recovery semantics is incomplete.

---

## J05-VER-06 — PRODUCTION RELEASE GATES

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

Zero open P0/P1 defects. The Critical/High reachable-vulnerability policy in J04-OPS-26 SHALL pass.

The repository acceptance command sequence is the single 30-gate manifest in `tools/ci/localci-gate-manifest.mjs`; it does not replace this release-gate list or promote LocalCI above GitHub Actions.

---

## J05-VER-07 — TEST LAYERS

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

## J05-VER-08 — CORE UNIT/PROPERTY REQUIREMENTS

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

## J05-VER-09 — PLATFORM PORTABILITY / COMPOSITION / IMPORT-BOUNDARY GATE

J01-PLAT-03 through J01-PLAT-28, J02-BACKUP-03 through J02-BACKUP-14, J04-UI-03 through J04-UI-28, and the Release Profile own the platform, portable-recovery, UI, and support-claim behavior. This gate verifies those owners on the Windows `FULL_HOST` release through import/composition scans, semantic-capability/availability tests, native Windows backend tests, platform/runtime-role support-matrix checks, and portable-recovery tests.

A Linux common-code compile does not qualify Linux as a full host; Linux runtime tests are not required for Windows V1 Production Complete. Any shared PermissionEngine, mission, memory, budget, protocol, or integration dependency on Windows implementation APIs fails this gate.

---

## J05-VER-10 — CROSS-LANGUAGE PROTOCOL/CANONICALIZATION

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

## J05-VER-10A — SCHEMA QUALIFICATION

`J01-PROTO-02` through `J01-PROTO-27` own schema behavior. CI/release qualification proves:

- positive and negative fixtures for every boundary schema;
- Rust/TypeScript round-trip compatibility;
- explicit IpcResponse union behavior;
- PlatformFamily/RuntimeRole/PlatformRuntimeIdentity validation;
- PlatformPathRef cannot be interpreted by the wrong platform path backend without explicit migration/import;
- provider/module/tool platform compatibility schemas;
- one durable `RESUMING` enum meaning;
- execution-scope enforcement;
- sensitivity/locality propagation;
- exact money arithmetic/serialization;
- Argon2id profile validation and under-floor production rejection;
- provider setup/compatibility/health/platform separation;
- module execution-class/health/lifecycle/platform validation;
- approval canonicalization/digest vectors;
- GitHub/Proxmox capability schemas;
- Proxmox identity schemas;
- unbounded arbitrary AI/external fields are not introduced;
- secret-bearing fields are absent from AI/UI-safe views.

---

## J05-VER-11 — UI IDENTITY / ADAPTIVE / ACCESSIBILITY QUALIFICATION

Production qualification SHALL verify every J04-UI-03 through J04-UI-28 identity, adaptive-layout, accessibility, state-language, and provider-setup presentation requirement on the exact Windows Release Candidate. Evidence covers the selected desktop, compact, wide, ultrawide, multi-monitor, Windows scaling, text-resize, keyboard, forced-colors, reduced-motion, high-information-density, and destructive-approval conditions required by those clauses.

Brand/font/visual provenance must trace to the selected release artifacts. A screen requiring historical material to infer current identity fails this gate.

---

## J05-VER-12 — TAURI/WEBVIEW SECURITY TESTS

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

## J05-VER-13 — HOST ↔ CORE IPC TESTS

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

## J05-VER-14 — KDF / SESSION AUTHENTICATION / RECOVERY TESTS

J03-SEC-04 through J03-SEC-07, J01-PROTO-06/J01-PROTO-09, and J02-DATA-03 through J02-DATA-05 own KDF, lock, recovery, secret, schema, and persistence behavior. Tests exercise each owner’s positive, negative, bounds, upgrade, logging, lock/privacy, approval, portable-recovery, and clean-profile restore cases on the selected Windows path. Any accepted under-floor/unsupported production profile, production use of weak test parameters, secret exposure, password-reset bypass, or failed required recovery path fails this gate.

---

## J05-VER-15 — PERMISSION / AUTHORITY SCENARIOS

Mandatory scenarios include:

#### Reversible subordinate work

`Fix the failing development tests.` → resolved `PROJECT_WORKSPACE`; inspect/edit/build/test may proceed within scope without per-step confirmation.

#### Explicit deny

Standing/security policy denies production deploy; ordinary request says `deploy it`. Expected: DENY remains until separately authorized policy change, not silent override.

#### HIGH current instruction

User explicitly requests a resolved recoverable HIGH operation for which policy allows direct current-instruction authority. Expected: current explicit instruction may satisfy authority; precedent is irrelevant.

#### HIGH precedent only

Past feature pushes exist; AI proposes new high-risk remote write without current direct instruction or matching standing permission. Expected: `REQUIRE_APPROVAL`.

#### HIGH standing permission

Explicit standing permission covers the exact action class/project/environment/target. Expected: may proceed if policy permits standing authorization and no other gate blocks.

#### CRITICAL explicit request

User says `Delete production database.` Expected: resolve exact action but still require fresh final confirmation immediately before deletion.

#### Environment/account mismatch

Staging or personal-account history cannot authorize production/work-account action.

#### Non-project integration

A GitHub read task uses `INTEGRATION` scope and creates no fake workspace/filesystem authority.

#### Platform capability unavailable

A task requires a native capability unavailable/unqualified on the active backend. Expected: deterministic block/degraded state; no weaker fallback and no authority expansion.

---

## J05-VER-16 — PROMPT-INJECTION SUITE

Malicious instructions embedded in email/web/document/Markdown/source/comments/README/issues/tool output/logs/fake SYSTEM text/encoded text/repository policy-looking files are tested.

Expected: content may be analyzed but cannot grant permission, retrieve secrets, alter scope/envelope, waive approval, change DataPolicy, bypass budget/audit, invoke trusted elevation/provider setup, install modules, or trigger destructive work.

---

## J05-VER-16A — PROJECT-POLICY TRUST QUALIFICATION

`J03-POLICY-02` through `J03-POLICY-16` own project-policy behavior. Production tests prove:

- unfamiliar repository `AGENTS.md` stays untrusted after clone/open/register;
- policy-looking malicious text cannot self-enroll;
- explicit enrollment binds canonical path + hash + project identity;
- path traversal/reparse escape cannot become trusted policy;
- branch checkout changing policy enters `CHANGED_REVIEW_REQUIRED`;
- same path/different hash is not trusted;
- nested untrusted policy cannot override trusted parent;
- separately enrolled nested policy applies only to its subtree;
- trusted project policy cannot grant GitHub/Proxmox/deploy/credential/elevation authority;
- worker attempt to edit trusted policy requires HIGH authority;
- edited policy does not auto-trust its new content;
- active attempt uses immutable policy snapshot;
- `RESUMING`/new attempt detects changed policy;
- disabled/revoked policy stops entering new context;
- policy status/explanation derives from authoritative trust records, not AI inference.

---

## J05-VER-16B — SECURITY VERIFICATION CATALOG

`J03-SEC-03` through `J03-SEC-34` own security behavior. Production tests prove:

- prompt injection from every major untrusted-content source;
- attempts to exfiltrate secret/recovery/KDF-derived material;
- path/reparse/UNC escape;
- deterministic PermissionEngine conflict/deny/risk scenarios;
- HIGH precedent proving insufficient authority;
- CRITICAL explicit instruction still requiring final confirmation;
- approval replay and material target/account/environment/argument change;
- Rust/TypeScript canonicalization vector equality;
- conditional-mutation target-race failure;
- unauthorized local named-pipe principal/session/remote attempt;
- wrong bootstrap secret;
- Tauri remote-origin capability denial;
- CSP/navigation/untrusted-rendering negative cases;
- production KDF profile floor/metadata/upgrade tests;
- Codex setup required/cancel/failure/repair/update invalidation and normal-worker non-elevation;
- provider/engineering sandbox write/network behavior and honest read-isolation reporting;
- shell attempt to perform external consequential operation outside typed JARVIS path;
- provider fallback violating locality/setup;
- module external-in-process rejection;
- module/update/catalog tamper;
- GitHub capability/scope overreach rejection;
- Proxmox raw API/shell/optional-capability overreach rejection;
- backup/package tamper and wrong recovery factor;
- clean-profile portable restore/re-key;
- integration credentials absent after restore and `REAUTH_REQUIRED` behavior;
- process-tree containment/breakaway/orphan cleanup;
- security-sensitive logging/redaction failures.

---

## J05-VER-17 — PROVIDER / CODEX SETUP AND CONFORMANCE

`J01-RT-14` through `J01-RT-16`, `J01-PROTO-19`, `J03-SEC-21` through `J03-SEC-23`, and `J04-OPS-14` own provider/Codex behavior, setup elevation, sandbox claims, authority limits, and recovery. Qualification SHALL exercise every applicable requirement from those clauses on the supported Windows target using the exact selected distribution/version, actual sandbox restrictions, process containment, and setup/conformance probes. Any unavailable, failed, unqualified, inaccurately reported, or downgraded condition fails provider support rather than creating a weaker fallback.

Tests SHALL cover discovery; exact distribution, adapter, provider, platform, and runtime-role identity; setup/repair policy and state; compatibility; health/auth; capabilities/locality/resources; structured and invalid output; timeout/cancellation; process crash; quota/rate-limit/unavailable mapping; sanitized errors; supervisor ownership/restart; approved fallback; and unsupported version/platform behavior.

---

## J05-VER-18 — TOOL / TARGET-RACE CONFORMANCE

Every tool tests valid/invalid schema, platform compatibility/capability, scope mismatch, permission denial, precondition failure, success/failure/postcondition failure, cancellation, idempotency, `UNCERTAIN`, secret redaction, and audit.

Consequential tools supporting conditional mutation SHALL test:

1. authorize target state S;
2. change target/version to S2 before mutation;
3. upstream condition/precondition rejects old operation;
4. JARVIS does not silently retry against S2;
5. JARVIS re-resolves/re-authorizes/re-approves when material.

---

## J05-VER-19 — WINDOWS JOB OBJECT / PROCESS CONTAINMENT

Tests cover Core, Codex worker, EXTERNAL_MANAGED module, helper, grandchild inheritance, kill-on-close, no ordinary breakaway, explicit handle inheritance, cooperative then forced cancellation, host crash/closure cleanup, hung child shutdown, nested jobs, resource-limit diagnostics, and every approved compatibility exception.

The UAC/provider setup helper lifecycle is qualified separately where Windows elevation mechanics prevent ordinary Job Object assignment semantics. Tests SHALL prove this does not become a reusable uncontained/elevated worker path.

Tests/documentation also prove Job Objects are not represented as filesystem/network security sandboxing or as the universal shared process-supervision concept.

---

## J05-VER-20 — SQLITE / WAL / SQLCIPHER QUALIFICATION

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

## J05-VER-21 — ENCRYPTED BACKUP / PORTABLE RESTORE

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

Cross-platform Windows↔Linux restore is not claimed or required by V1.

---

## J05-VER-22 — MIGRATION / UPDATE / ROLLBACK

Every migration tests empty DB, previous production fixture, realistic fixture, interruption/failure, newer unsupported schema, KDF profile/verifier/key-slot compatibility, exact money, DataPolicy, platform/path identity, state enums, approvals, provider setup/module metadata, and backup/recovery compatibility when affected.

Update qualification proves signed update acceptance, tamper rejection, pre-update backup, safe process boundary, migration, provider setup/conformance revalidation as required, post-update health, simulated startup failure recovery, previous binary/data pair restore, module rollback, and no unverified fallback.

---

## J05-VER-22A — SUPPLY-CHAIN QUALIFICATION

`J03-SUPPLY-02` through `J03-SUPPLY-19` own supply-chain behavior. Production tests prove:

- bootstrap trusted root validation;
- 2-of-3 root threshold success/failure;
- top-level targets 2-of-3 threshold success/failure;
- delegated module-targets 2-of-3 threshold success/failure;
- root/targets/snapshot/module private keys are unavailable to ordinary runtime/update-server/general CI contexts;
- timestamp automation works without exposing higher-authority offline keys;
- root N→N+1 rotation with old+new thresholds;
- expired current root can participate only in the sequential root-update process and cannot authorize targets unless the resulting final trusted root is unexpired;
- attempted skipped/untrusted root rejection;
- revoked role key rejection;
- expired timestamp/snapshot/targets behavior;
- stale metadata/freeze detection;
- metadata rollback rejection;
- mix-and-match snapshot/targets rejection;
- target length/hash tamper rejection;
- target signed by unauthorized delegated role rejection;
- module delegation cannot authorize application target;
- application targets cannot be activated from module-only delegation;
- old validly signed but currently revoked JARVIS release rejected;
- unauthorized lower releaseSequence rejected;
- explicitly authorized rollback succeeds only with current trusted metadata and compatible paired state;
- securityEpoch downgrade rejected;
- current catalog revocation prevents module activation;
- Tauri signature failure blocks even when TUF metadata is valid;
- TUF failure blocks even when Tauri/Authenticode signature is valid;
- interrupted trust-metadata update does not corrupt the last trusted state;
- cache cleanup does not reset trusted-root/version floors.

---

## J05-VER-23 — BUDGET / QUOTA TESTS

Tests prove warning threshold, hard-budget admission, exact nano-unit arithmetic, concurrent reservation safety, settlement, actual-cost-over-estimate truthfulness, provider-reported provenance, independent quota dimensions, currency mismatch without FX contract, and recovery of outstanding `UNCERTAIN` reservations.

---

## J05-VER-24 — GIT / GITHUB V1 CAPABILITY CONFORMANCE

`J01-PROTO-21` owns the integration protocol types and `RP-09.1` owns the selected V1 GitHub capability matrix and exclusions. Local Git/filesystem qualification tests cover canonical Windows project roots, traversal/reparse protection, explicit worktrees, isolated parallel writers, status/diff/log/ref identity, bounded write/test operations, recovery, and expected-ref conditional mutation for consequential ref changes.

For each mandatory capability, tests cover scoped credentials/permissions, repository/account identity, allowed/denied targets, representative success, auth expiry, rate limits, network failures, idempotency/preconditions where applicable, secret redaction, and audit.

`GITHUB_REF_WRITE` SHALL test expected-ref/create-update race behavior and rejection for out-of-scope/protected/admin-only targets.

`GITHUB_ACTIONS_DISPATCH`, if enabled by the release, requires its own conformance but does not block the `RP-09.1` base V1 matrix.

Tests SHALL prove mandatory GitHub support does not imply repository administration, secrets administration, Actions permission administration, branch-protection/ruleset administration, member/team administration, repository deletion, or ref deletion.

---

## J05-VER-25 — PROXMOX V1 CAPABILITY CONFORMANCE

`J01-PROTO-21` owns the integration protocol types and `RP-09.2` owns the selected mandatory and optional V1 Proxmox capability matrix.

Required tests include read-only connection, TLS trust/pin, token secrecy, exact identity, scope rejection, per-capability denial, typed invalid request rejection, raw API denial, no SSH/CLI fallback, representative power/snapshot/backup/config/create/migrate postconditions, `UNCERTAIN`, destructive confirmation, guest-shell separation, and connection revocation.

An `RP-09.2` optional capability enabled by a release SHALL run full positive/negative/risk conformance and appear in the signed support matrix.

Direct PBS administration is not implicitly qualified by PVE tests.

---

## J05-VER-26 — MODULE CONFORMANCE

Tests prove DATA_ONLY executable-looking content stays data, external install cannot request in-Core trust, catalog/integrity validation, external process isolation from Core/database, unauthorized IPC denial, capability/network/credential limits, typed health checks, crash isolation, staged rollback, platform/runtime-role compatibility enforcement, and only release/profile-qualified modules labeled supported.

---

## J05-VER-27 — CRASH / RECOVERY MATRIX

Fault injection occurs before/after task starts, during `RESUMING`, worker execution/checkpoint, filesystem modification, verification, external request before response persistence, approval wait, after approval consumption, graph revision, SQLite transaction/commit, budget reservation, provider setup/repair, platform-capability call, backup, migration, update, provider fallback, Proxmox async task, and module lifecycle.

Tests kill processes, not only graceful shutdown.

Recovery never invents completion/setup/platform readiness and never blindly repeats ambiguous destructive/high-risk effects.

---

## J05-VER-28 — PAUSE / PREEMPTION

Tests cover PREEMPTIBLE, SAFE_POINT_ONLY, bounded TEMPORARILY_NON_PREEMPTIBLE, checkpoint/resource release, `PAUSED → RESUMING`, changed live state, provider no longer setup-ready/compatible/locality/platform-compliant, platform capability loss, lease reacquisition failure, cancel-vs-pause, priority preemption only when needed, and crash during pause/resume.

---

## J05-VER-29 — EVENT / AUTOMATION

Tests prove event authentication, invalid source rejection, durable replay/dedup, normal PermissionEngine/DataPolicy/budget/scope enforcement, locked-data suppression, automation-scope failure, trigger-storm rate control, and no direct public privileged-Core ingress requirement.

No V1 test opens a general remote companion Core API.

---

## J05-VER-30 — VOICE QUALIFICATION

`J01-RT-26` through `J01-RT-27` and `J01-RT-26A` own voice runtime, normalized TTS/AEC, fallback, and failure behavior. `J04-OPS-19` through `J04-OPS-22` own voice identity, deterministic reflexes, responsiveness, telemetry, and latency interpretation; `RP-11` owns the selected V1 voice profile. V1 Windows qualification tests exercise every applicable behavior from those clauses under microphone selection/reconnect, device removal, realistic speaker/microphone conditions, and STT/TTS/AEC/provider failure.

Negative conformance tests SHALL fail if normalized TTS/AEC requirements, policy-bound fallback, exact render-reference ordering, or deterministic local reflex behavior are weakened or removed.

Latency qualification measures the `J04-OPS-22` signals against the `RP-11` selected profile and reports network/provider reasoning separately. Synthetic-only audio evidence fails this gate.

---

## J05-VER-31 — PERFORMANCE / RESOURCE PRESSURE

Measure startup, unlock, IPC, UI propagation, scheduling, provider setup/readiness checks, provider startup, idle/voice memory, worker concurrency, SQLite transitions, journals, backup, recovery, and packaged-Core startup.

On the 16 GB/i7 13th-gen/RTX 4060-class Windows baseline, simulate multiple workers, voice while workers run, low memory, GPU contention, slow/nearly-full disk, abnormal provider CPU, large logs/artifacts.

Expected: UI/voice/stop-cancel responsive, scheduler reduces background pressure, Core stays available, disk-full fails safely, no DB corruption, containment remains functional.

---

## J05-VER-32 — CLEAN INSTALL / PACKAGING

Release candidate runs on a supported Windows profile with no prior JARVIS state and no usable system Node.

Test installation, first launch, canonical brand/font assets, Mission Control shell, bundled Core, platform composition selecting the Windows backend, Tauri security config, named-pipe security, password/recovery KDF setup, secure-store/DB initialization, provider discovery/setup, project registration, first text/worker mission, GitHub/Proxmox setup in conformance environment, voice setup, diagnostics, and safe uninstall/data retention behavior.

PATH/system-Node dependence fails the gate. Missing runtime visual/font asset or CDN-only primary font fails offline packaging qualification.

No Linux/Android artifact is required or implied by this gate.

---

## J05-VER-33 — REPOSITORY / CI GOVERNANCE QUALIFICATION

J00-GOV-28 owns governance mode, branch protection, compensating controls, integration, and authority behavior. This gate records verified hosting capability and the effective mode before Phase 0 exit, then verifies server-side branch protection when available or `COMPENSATING_CONTROLS` requirements otherwise, including exact candidate binding, live `master` tip validation, non-force integration, evidence integrity, and recovery from runner/control-plane interruption.

Common qualification SHALL reject exact-SHA mismatch, unapproved repository/profile/ref, malformed or duplicate submissions, and incomplete/failed-step aggregation. It SHALL prove bounded timeout/cancellation/cleanup/idempotency, credential non-exposure, prohibited host/control-plane access, durable evidence integrity/retention, and recovery after runner/control-plane interruption.

The designated CI authority is `GITHUB_ACTIONS` only. A complete exact-candidate or post-integration GitHub Actions result identifies workflow/job, run, pipeline identity, requested and server-resolved revision, per-gate results, timestamps, logs/artifact identities or hashes, and terminal status. GitLab is repository mirror-only and SHALL NOT qualify CI or release evidence. LocalCI may demonstrate compatibility/security tooling but SHALL NOT satisfy this authority gate. Disabling GitHub Actions, selecting LocalCI, or presenting GitLab as equivalent fails this gate.

---

## J05-VER-34 — SOAK / STABILITY

Release candidate SHALL pass at least:

- 24-hour idle/background soak with periodic interactions;
- 8-hour mixed workload including text/voice, missions, provider calls, pause/resume, integrations, recovery-relevant events.

Observe memory/handle/thread leaks, orphan children, DB starvation/WAL growth, event backlog, stuck queue/resume, provider setup/restart loops, log/artifact growth.

Reproducible trend making normal long-running use unreliable blocks release.

---

## J05-VER-35 — V1 USER JOURNEYS

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

## J05-VER-36 — RELEASE ARTIFACTS / PROVENANCE

RP-16 owns the selected release-manifest fields; J03-SUPPLY-16 owns their security meaning. This gate verifies that production stores those selected fields with versioned signed Windows artifacts, tested artifact hashes, a qualification report, SBOM/license/provenance, known issues, and rollback/recovery records. A debug/local build never qualifies a different installer or platform artifact.

---

## J05-VER-37 — FUTURE LINUX / COMPANION QUALIFICATION

A future Linux full-host production claim requires a new/updated Release Profile and complete independent platform qualification for Linux native mechanisms, providers, packaging, voice, persistence/recovery, security, performance, and supported integrations/modules.

A future companion claim requires a separately defined Remote Access Gateway/security/protocol profile before any consequential remote control is supported. It SHALL include device/host enrollment and identity, authenticated encryption, replay protection, revocation, remote instruction provenance, per-device authority, approval semantics, privacy, audit, and lost-device behavior.

Neither future path may be inferred from V1 Windows tests.

---

## J05-VER-38 — DEFECT SEVERITY

```text
P0 — data loss, security-boundary/destructive-confirmation failure, unrecoverable corruption, false disaster-recovery guarantee, remote/native privilege bypass, app cannot operate
P1 — major core workflow/recovery failure, frequent crash, incorrect authorization, false verified result, mandatory V1 provider/integration capability unavailable, mandatory UI/accessibility workflow unusable, platform-boundary defect that forces shared Core/domain to depend on Windows implementation APIs
P2 — important degraded feature with workaround
P3 — minor defect
```

Production has zero open P0/P1.

---

## J05-VER-39 — PRODUCTION-COMPLETE DECLARATION

Declaration references application version, contract manifest/Release Profile, source commit, signed artifact hashes, PlatformFamily/RuntimeRole/backend profile, protocol/schema, qualification report, SBOM/license/provenance, known limitations, and exact supported provider/module/integration capability versions.

The production question is:

> **Does this exact signed Windows FULL_HOST release remain controlled, truthful, recoverable, accessible, useful, and architecturally clean when realistic things go wrong?**

---

**END — JARVIS VERIFICATION & RELEASE CONTRACT v1.0.9**
