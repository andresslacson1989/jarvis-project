# JARVIS V1 Production Release Profile

**Profile Version:** 1.0.7
**Status:** Canonical production-support target  
**Date:** August 18, 2026  
**Governing contract:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.7.md`

---

# 1. PURPOSE

The architecture describes what JARVIS may support over time. This Release Profile defines what a concrete V1 production release must actually ship, qualify, and support.

A capability that exists only in an ADR, experimental code, historical contract, or unqualified module/platform is not part of the V1 production guarantee unless this profile requires it or the signed release manifest explicitly promotes it after full qualification.

V1 is intentionally **Windows-only as a production FULL_HOST release**. The v1.0.7 contract suite preserves Linux as a future FULL_HOST target and Android as a future COMPANION direction without adding either to the V1 release burden.

---

# 2. SUPPORTED PLATFORM AND RUNTIME ROLE

Initial production target:

```text
PlatformFamily: WINDOWS
RuntimeRole:    FULL_HOST
Operating system: Windows 11
Minimum normal release baseline: 25H2
CPU architecture: x86-64 (x64)
User model: single interactive Windows user
Normal privilege: standard non-Administrator user
```

Each production release SHALL qualify every Windows release/build family it claims to support. Windows 26H1 or later MAY be added when explicitly qualified; no architecture change is required merely to add another supported Windows 11 release.

Windows ARM64 is not part of the initial V1 guarantee and requires full native/provider/voice/SQLite/installer/update/UI conformance before promotion.

Future platform intent is:

```text
LINUX   + FULL_HOST  → explicit future target, not V1-supported
ANDROID + COMPANION  → future non-authoritative client, not V1-supported
```

A Linux build, Tauri launch, Node launch, or provider executable presence SHALL NOT be represented as production support. Linux requires a future Release Profile that selects and qualifies its native secure-storage, IPC, process-supervision, filesystem/path, session, packaging/update, provider, voice, persistence, recovery, and UI runtime behavior.

V1 implementation SHALL preserve the Platform Portability Contract's architecture/import boundaries even though Linux runtime tests are not part of V1 Production Complete.

---

# 3. DESKTOP, UI, RUNTIME, AND PLATFORM BACKEND BASELINE

V1 Windows topology:

```text
Tauri 2 / Rust Windows Platform Host
        ↓
React + TypeScript bundled-local WebView UI
        ↓
restrictive authenticated Windows named pipe
        ↓
application-owned Node.js + TypeScript JARVIS Core
```

Required runtime properties:

- renderer is unprivileged;
- authoritative WebView loads local bundled application content;
- explicit Tauri capabilities and restrictive production CSP;
- no privileged remote-origin Tauri capability;
- selected Tauri/runtime build includes relevant upstream security fixes and is explicitly qualified;
- installer does not require system Node;
- exact release-owned Node/Core pair is pinned and verified;
- Windows local Core transport uses restrictive explicit DACL, local-only behavior, unpredictable endpoint, and bootstrap authentication;
- no privileged localhost/LAN HTTP control plane;
- Windows Job Object containment is mandatory for managed executable child trees except narrowly qualified exceptions;
- signed installer/update artifacts;
- protocol major `1` using the current manifest's protocol/domain schemas.

The implementation SHALL expose native responsibilities through explicit semantic platform-capability/composition boundaries equivalent to:

```text
PlatformSecureStorage
PlatformLocalIpc
PlatformProcessSupervisor
PlatformSessionObserver
PlatformWindowController
PlatformNotificationBackend
PlatformPathsAndIdentity
PlatformAudioBackend
PlatformUpdateBackend
PlatformPrivilegeMediator
PlatformSystemInfo
```

Exact interface names may differ. Shared Core/domain/policy code SHALL NOT directly depend on Win32, DPAPI, Windows named-pipe, Job Object, HWND, SID, registry, or UAC implementation APIs.

This abstraction requirement SHALL NOT weaken the Windows backend. V1 Windows still uses the strongest qualified Windows mechanisms required by the Runtime, Security, Data, and Platform Portability contracts.

Required V1 UI identity properties:

- one unified dark-theme **JARVIS Mission Control** shell;
- canonical brand colors `#2D7BFF`, `#FFFFFF`, and `#0B0F14`;
- canonical mark, lockup, and application-icon master assets from `assets/brand/`;
- dedicated primary dashboard window with deterministic `HIDDEN`, `WINDOWED`, `MAXIMIZED`, `FULLSCREEN`, and `FOCUSED_CONTEXT`-equivalent presentation modes;
- adaptive layout across standard desktop, compact resizable window, ultrawide, high-DPI, text scaling, and multi-monitor conditions;
- no unrelated per-integration or per-platform visual shell;
- accessibility and state-language qualification under the UI Identity & Design System Contract;
- release-owned/offline-safe primary font and recorded license/provenance for packaged fonts/icons/third-party visual assets.

Mission Control design tokens/component semantics SHALL be reusable by a future Linux full-host UI. Only Windows UI/runtime qualification is required by V1.

Exact Rust/Node/TypeScript/Tauri/package-manager versions are release-manifest facts and SHALL be pinned/qualified per release.

---

# 4. PERSISTENCE AND CRYPTOGRAPHIC BASELINE

V1 SHALL use:

- SQLite/SQLCipher-compatible authoritative database;
- local-filesystem WAL mode unless an explicitly qualified alternative is adopted;
- an exact embedded SQLite/SQLCipher build proven to contain the upstream WAL-reset corruption fix; SQLite `3.51.3` is the first known fixed upstream point for that defect, but numeric `>= 3.51.3` comparison alone SHALL NOT establish qualification;
- `synchronous=FULL` for authoritative state by default;
- foreign keys on every connection;
- bounded busy handling and WAL/checkpoint diagnostics;
- random local `DB_DEK` protected by the Windows PlatformSecureStorage backend;
- a release-qualified SQLCipher-safe online snapshot/export/re-key path proven on the exact packaged binding;
- independent per-backup 256-bit `SnapshotDBKey` and 256-bit `BackupDEK`;
- production backup format `JARVIS_BACKUP_V1` exactly as defined by `JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md`;
- `LOCAL_RECOVERY` and `PORTABLE_STATE` backup classes;
- DPAPI/current-user Windows local key slot for Windows-local recovery;
- mandatory `GENERATED_RECOVERY_V1` 256-bit recovery slot for every production `PORTABLE_STATE VERIFIED` backup;
- optional additional `PASSPHRASE_ARGON2ID_V1` slot using the stronger portable-backup KDF profile;
- clean-profile Windows restore followed by fresh local `DB_DEK` generation/re-key;
- forward migrations and paired binary/database rollback.

JARVIS-managed session-password and general portable-recovery KDF profiles SHALL use Argon2id version `0x13` and SHALL NOT fall below:

```text
memory:      65536 KiB
passes:      3
parallelism: 4
salt:        16 random bytes
output:      32 bytes
```

The optional V1 portable-backup passphrase slot SHALL use at least:

```text
memory:      262144 KiB
passes:      3
parallelism: 4
salt:        16 random bytes
output:      32 bytes
```

Release calibration MAY strengthen these parameters. The exact versioned profile used for each verifier/key slot SHALL be persisted and included in migration/upgrade qualification.

The `PORTABLE_STATE` cryptographic envelope SHALL NOT require the historical Windows DPAPI key. Cross-platform Windows↔Linux state restoration is **not** a V1 guarantee and must later qualify platform-specific path/provider/setup/artifact migration semantics.

A specific Node SQLite/SQLCipher binding becomes `SUPPORTED` only after the persistence/packaging/snapshot/re-key proof passes on the exact packaged Windows application.

---

# 5. REQUIRED AI PROVIDER SUPPORT

V1 SHALL production-qualify **Codex/OpenAI on Windows** as the initial AI provider family for at least:

- GENERALIST/orchestrator behavior;
- SOFTWARE_ENGINEER worker behavior;
- verifier/synthesis behavior when the selected model/profile satisfies requirements.

The supported Windows Codex adapter SHALL:

- resolve exact executable/distribution identity/version;
- enforce the release compatibility policy;
- bind support evidence to `WINDOWS + FULL_HOST`;
- use a stable structured/non-interactive interface when available;
- validate structured output;
- support bounded timeout/cancellation;
- run ordinary workers non-elevated under mandatory Windows process-tree containment;
- model provider setup/repair independently from compatibility/health;
- support explicit first-class elevated Windows sandbox setup/repair when required by the qualified Codex version;
- verify setup readiness before declaring the engineering profile supported;
- never silently downgrade to an unqualified or less-restrictive sandbox after setup/repair failure;
- conformance-test provider-native Windows sandbox behavior, including actual write and network restrictions;
- never claim workspace-only read isolation unless the qualified provider implementation actually enforces it;
- treat provider session resume as optional optimization only;
- expose provider quota/usage provenance where available.

Required setup-state semantics are equivalent to:

```text
NOT_REQUIRED
SETUP_REQUIRED
SETUP_IN_PROGRESS
SETUP_READY
REPAIR_REQUIRED
SETUP_FAILED
```

If setup needs UAC, elevation is confined to the qualified provider setup/repair helper. Ordinary Codex worker execution SHALL NOT inherit elevation. Provider-internal sandbox-account passwords remain provider-owned and are not imported into JARVIS credential state.

Newer/unqualified Codex versions are not automatically `SUPPORTED` merely because they launch.

Windows Codex qualification does not qualify a future Linux Codex adapter. Linux must independently prove setup, process containment, filesystem behavior, network behavior, environment/credential exposure, cancellation, and provider-specific security limitations.

No local LLM is required for V1.

---

# 6. REQUIRED LOCAL PROJECT/ENGINEERING CAPABILITIES

V1 SHALL include production-qualified:

- project registration, aliases, environments, workspaces/worktrees;
- explicit project-policy candidate detection, user enrollment/disable/revocation, immutable attempt policy snapshots, content-hash change detection, and nested-policy scope under `JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`;
- project/system status;
- Git status/current branch/diff/log;
- controlled project/folder/file open;
- narrow filesystem read/write required by approved engineering work;
- project test/build execution through the engineering boundary;
- bounded `WORKSPACE_ENGINEERING` delegated worker profile;
- isolated writable worktrees for parallel writers;
- task/mission pause/resume/cancel/priority;
- backup/restore/recovery maintenance actions;
- provider/module/integration/platform diagnostics.

The orchestrator never gets a generic unrestricted shell.

Filesystem/path handling SHALL go through platform-aware canonical path/resource abstractions. Windows-specific traversal/reparse/UNC/drive behavior remains mandatory for V1 without becoming the universal shared path model.

Project registration/opening SHALL NOT silently trust repository `AGENTS.md` or other policy-looking files. Trusted policy requires the explicit enrolled canonical project/path/scope/content identity defined by the Project Policy Trust Contract.

---

# 7. REQUIRED MISSION/WORKER RUNTIME

V1 SHALL ship and qualify:

- durable mission/task/attempt state;
- immutable graph versions and validated dynamic replan;
- discriminated execution scopes;
- bounded worker loops and no-progress detection;
- worker journals/checkpoints without private chain-of-thought;
- queue transparency;
- durable `RESUMING` state and live-state/policy revalidation;
- resource/provider/budget/platform-capability-aware scheduler;
- exact budget reservations/settlement;
- provider fallback that preserves policy/platform support;
- crash recovery and uncertain-side-effect reconciliation;
- deterministic/live verification before completion.

---

# 8. REQUIRED SECURITY/AUTHORIZATION RUNTIME

V1 SHALL ship and qualify:

- start-locked session;
- versioned Argon2id session-password verifier meeting the production KDF floor;
- Windows lock/sign-out integration through the platform session observer;
- explicit portable recovery-factor workflow for session/data recovery;
- mandatory generated 256-bit portable backup recovery factor for production portable-state verification;
- Windows PlatformSecureStorage/Credential Broker backend;
- explicit Windows named-pipe DACL/local-only/bootstrap authentication backend;
- authoritative local-only WebView/Tauri capability/CSP/navigation boundary;
- Windows PlatformProcessSupervisor using Job Objects as required;
- authority envelopes;
- deterministic PermissionEngine precedence with mandatory safety/deny dominance;
- standing permission and limited precedent semantics;
- explicit project-policy trust enrollment; untrusted repository text cannot self-promote to policy;
- `CanonicalActionDescriptorV1` JCS/SHA-256/base64url approval binding;
- mandatory final destructive confirmation;
- independent `DataSensitivity` + `DataLocality`;
- prompt-injection/content-authority boundary;
- canonical platform-aware path/resource resolution;
- conditional external mutation when supported;
- TUF 1.0.35-based update/module trust lifecycle with current revocation/anti-rollback policy;
- secret-minimizing logs/journals/diagnostics;
- explicit same-user-malware limitation;
- platform-capability failure that blocks/degrades dependent behavior rather than unsafe fallback.

---

# 9. REQUIRED V1 INTEGRATION SET

JARVIS V1 SHALL NOT be declared Production Complete until these integration families are implemented and production-qualified on the Windows FULL_HOST release:

1. **Local filesystem + Git**
2. **GitHub**
3. **Codex/OpenAI provider integration**
4. **Proxmox VE**

Every required integration must pass credential, capability, schema, permission, failure/recovery, retry/idempotency, secret, version/compatibility, platform-support, and negative conformance tests.

## 9.1 GitHub V1 capability matrix

The following capability families are mandatory for V1 Production Complete:

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

`GITHUB_ACTIONS_DISPATCH` MAY be supported and qualified but does not block V1 Production Complete.

The mandatory matrix does **not** include:

- repository administration;
- repository deletion;
- repository/Actions secret administration;
- Actions permission administration;
- branch-protection/ruleset administration;
- organization/member/team administration;
- ref deletion.

`GITHUB_REF_WRITE` means typed creation/update of permitted non-protected refs with exact expected-old-ref/conditional semantics. Later ref deletion requires a separately defined risk/action contract.

## 9.2 Proxmox VE V1 capability matrix

The following capabilities are mandatory for V1 Production Complete:

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

The following remain modeled but do not block V1 Production Complete:

```text
PROXMOX_STORAGE_WRITE
PROXMOX_NETWORK_WRITE
```

If a release enables either optional capability, that exact release SHALL fully qualify and list it in the signed support matrix.

Proxmox V1 requirements:

- REST/HTTPS API first-class control path;
- scoped API identity/token; no routine root password requirement;
- TLS verification/system CA or explicit pin policy;
- stable `connectionId` + `environmentId` + resource identity;
- read-only onboarding possible;
- typed capabilities/tools; no raw arbitrary API path;
- no automatic SSH/CLI fallback;
- asynchronous task tracking and live postcondition verification;
- destructive exact-action confirmation;
- guest OS shell authority remains separate;
- direct PBS administration remains separate.

`PROXMOX_GUEST_CREATE` may allocate guest disks on allowed existing storage but is not arbitrary datastore administration. `PROXMOX_GUEST_CONFIG` is typed guest-level configuration, not host/network/storage administration. `PROXMOX_BACKUP` starts/tracks guest backup against allowed configured targets and does not imply direct PBS administration.

---

# 10. MODULE PROFILE

V1 SHALL implement the module registry and execution classes:

```text
DATA_ONLY
BUILT_IN_TRUSTED
EXTERNAL_MANAGED
```

Separately installed executable code cannot run inside Core.

Module support SHALL be platform/runtime-role qualified when native execution or dependencies differ. A module supported on Windows is not automatically supported on Linux.

An open arbitrary third-party executable-module marketplace is **not** a V1 Production Complete requirement. An `EXTERNAL_MANAGED` module is supported only when explicitly present in the current TUF-authorized signed release/catalog support matrix and fully qualified.

Production module catalog authorization SHALL use the dedicated TUF delegated role/profile from `JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`; publisher signature alone does not confer `SUPPORTED` status.

---

# 11. REQUIRED VOICE PROFILE

Voice is mandatory for V1 Production Complete and SHALL include:

- push-to-talk;
- local microphone capture;
- local STT;
- VAD;
- AEC-capable full duplex;
- physical/semantic turn detection;
- barge-in;
- deterministic stop/mute/cancel reflexes;
- interruptible TTS;
- persistent JARVIS voice identity;
- half-duplex fallback;
- typed-input fallback.

Provider direction:

```text
STT: whisper.cpp-compatible qualified adapter or accepted equivalent
VAD: Silero/ONNX-compatible qualified adapter or accepted equivalent
AEC: WebRTC APM AEC3-compatible qualified adapter or accepted equivalent
TTS: one local production-qualified provider meeting identity/latency/interruption/privacy/licensing requirements
```

These are Windows V1 qualification requirements. Future Linux voice support must independently qualify actual Linux device lifecycle, AEC, acceleration/runtime, privacy, latency, and packaging behavior while preserving the same voice/product semantics.

Wake word may remain disabled/unqualified and is not required for V1.

Before broad feature implementation proceeds beyond the early platform/persistence foundation, the v1.0.7 Implementation Plan SHALL run an early real-hardware feasibility spike for candidate STT/VAD/TTS/AEC/barge-in/device/resource/licensing behavior. Passing that spike is evidence of stack feasibility, not final Voice Production Complete.

---

# 12. UI IDENTITY / ACCESSIBILITY QUALIFICATION PROFILE

V1 Production Complete requires the UI Identity & Design System Contract to pass on the exact Windows Release Candidate.

Qualification SHALL cover at minimum:

- standard 1920×1080 desktop;
- 2560×1440 and representative 4K class display;
- ultrawide layout;
- compact resizable window;
- multi-monitor with monitor removal/reconnect;
- Windows scaling at 100%, 125%, 150%, and 200%;
- keyboard-only primary workflows;
- assistive-technology semantic names/roles/states for primary workflows;
- Windows High Contrast / CSS forced-colors behavior where supported by the WebView stack;
- reduced-motion preference;
- text resizing to 200% without loss of required functionality;
- reflow equivalent to a 320 CSS-pixel viewport / 400% zoom for primary linear workflows, excluding content whose meaning intrinsically requires two-dimensional layout;
- normal text contrast >= 4.5:1 and qualifying large text >= 3:1;
- meaningful non-text controls/indicators contrast >= 3:1 against adjacent colors where required;
- pointer target size >= 24×24 CSS px or a WCAG 2.2-equivalent spacing/exception condition;
- visible focus and focused controls not obscured by sticky UI;
- no consequential state communicated by color alone;
- high mission/queue/notification counts;
- blocked/waiting/uncertain/recovery states;
- exact destructive approval presentation;
- voice idle/listening/processing/speaking/degraded states;
- canonical mark/lockup/icon usage and design-token consistency.

Shared design-system components SHALL avoid unnecessary Windows-only semantics so a future Linux full-host/companion presentation can reuse the JARVIS identity. This is an architecture check, not a V1 Linux UI runtime test.

---

# 13. HARDWARE QUALIFICATION BASELINE

Initial Windows qualification baseline:

```text
CPU: Intel Core i7 13th-generation class
GPU: NVIDIA RTX 4060 class
RAM: 16 GB
Storage: NVMe-class local storage
Network: normal broadband/LAN for approved remote providers/integrations
```

32 GB RAM may be recommended but is not a production minimum.

The release SHALL remain usable without a permanently loaded large local LLM and shall protect UI/voice/stop-cancel responsiveness under worker pressure.

---

# 14. POST-V1 REQUIRED INTEGRATIONS

The following remain binding product roadmap requirements but do not block V1 Production Complete:

- SSH;
- Google Workspace;
- Microsoft 365;
- Cloudflare.

They MAY ship independently in production-qualified post-V1 feature releases as each integration becomes complete. No release is required to delay an otherwise complete one of these integrations merely because another is not ready. Removing any of the four from the binding roadmap still requires a deliberate product-contract amendment.

Security/maintenance patch releases remain independent of this roadmap.

Direct public inbound Internet listeners remain outside the required V1/post-V1 integration roadmap unless separately hardened/approved.

---

# 15. FUTURE PLATFORM TARGETS

## 15.1 Linux FULL_HOST

Linux is an explicit future full-host product target but is **not** a V1 support claim.

Promotion requires a future synchronous contract/Release Profile that defines and qualifies at minimum:

- supported distributions/releases and CPU architectures;
- supported desktop/session environments where applicable;
- secure-storage backend;
- local IPC/peer-identity backend;
- process-tree containment/resource-control backend;
- filesystem/path identity and escape protections;
- installer/package/update model;
- Tauri/WebView runtime;
- provider support/setup/sandbox matrices;
- voice/device/audio behavior;
- SQLite/SQLCipher/native dependency packaging;
- tool/module/integration platform differences;
- clean install, update, rollback, backup/restore, recovery, performance, security, and soak.

## 15.2 Future COMPANION

A future Android or other companion is non-authoritative. It may later provide dashboard/read state, conversation/prompting, notifications, approvals, mission monitoring, and selected policy-permitted controls.

It does not own the authoritative mission database, host credentials, engineering workers, general providers/tools, or infrastructure adapters.

Companion networking is not a V1 requirement. It requires a future separately qualified Remote Access Gateway; direct unrestricted privileged Core exposure is prohibited.

---

# 16. RELEASE MANIFEST

Every production release SHALL record at least:

```text
jarvis_version
contract_suite_version
contract_component_revisions
release_profile_version
source_commit_sha
platform_family
runtime_role
cpu_architecture
platform_backend_profile
platform_capability_matrix
windows_support_matrix
installer/signing identity metadata
Tauri/Rust/Node/TypeScript/package-manager versions
Core packaging/runtime identity
protocol/schema version
database/SQLCipher/SQLite identity + exact WAL-fix evidence + qualified snapshot mechanism
migration set
session_password_kdf_profile
portable_recovery_kdf_profiles
backup_format_id/version/cipher/chunk profile
generated_recovery_slot_profile
project_policy_trust_profile_version
supported provider versions/ranges/setup-state requirements + platform binding
supported integration capability matrix
supported module versions/ranges + platform binding
voice provider versions/ranges + platform binding
brand asset/source identities
font/icon/visual-asset license/provenance references
TUF spec version/trusted root version/root key IDs+threshold/role key IDs+thresholds/module delegation
release_sequence
security_epoch
Tauri updater signing key identity
Windows code-signing identity/timestamp metadata
SBOM reference/hash
qualification report reference/hash
known limitations
rollback pairing information
```

No raw credentials/private user data/private signing keys/recovery factors appear in the manifest.

---

# 17. REPOSITORY GOVERNANCE GATE

Before Phase 0 may be declared complete, the effective repository-governance mode SHALL be determined from verified hosting provider/account capability.

When server-side branch protection or repository rulesets are available for the authoritative repository, authoritative `master` SHALL use an active server-enforced equivalent that:

- prevents branch deletion;
- blocks force pushes;
- requires the mandatory CI status check/context once that check exists;
- uses narrowly controlled and auditable bypass permissions.

If server-side protection/rulesets are unavailable because of a verified hosting plan/platform capability limitation, the `COMPENSATING_CONTROLS` mode MAY satisfy this gate only when all of the following hold:

- normal implementation work occurs on temporary implementation branches rather than routine direct writes to `master`;
- mandatory CI passes for the exact candidate commit before integration;
- the live `master` tip is revalidated immediately before integration, and unexpected movement is reconciled rather than overwritten;
- integration is non-force;
- post-integration verification proves the resulting authoritative tip, intended diff/ancestry, required CI, and audit/evidence state;
- repository status states truthfully that `master` is not server-protected and preserves the residual risk of an out-of-band administrator force push/deletion.

`COMPENSATING_CONTROLS` SHALL NOT be selected when effective server-side protection is available. If the hosting provider/account later exposes the required protection/ruleset capability, server-enforced mode becomes mandatory.

A pull-request requirement is strongly preferred once implementation changes begin. No second long-lived branch becomes an alternate source of truth.

Phase 0 SHALL also create machine-readable canonical profile/capability definitions and CI drift checks for repeated normative constants/matrices where practical.

The mandatory `static-ci` pipeline result MAY come from either a qualified `GITHUB_ACTIONS` authority or a qualified `LOCALCI` authority. The two authority types are equal alternatives; one complete exact-candidate result is sufficient, but partial results cannot be combined. Qualification SHALL prove the common exact-SHA, complete-pipeline, pinned-input, least-privilege, isolation, timeout/cancellation, idempotency, durable-evidence, and audit requirements in Implementation Contract §28 plus the selected authority's specific requirements. GitHub Actions need not remain enabled while qualified LocalCI is selected. An unqualified, demo, stale, or materially changed LocalCI instance does not satisfy this gate.

---

# 18. PRODUCTION-COMPLETE GATE

For this profile, Production Complete requires the same source commit and signed **Windows FULL_HOST** release artifacts to pass:

- all required functionality and every current mandatory active-contract rule;
- platform/clean-install qualification;
- platform-capability/composition/import-boundary architecture checks;
- Mission Control UI identity/adaptive/accessibility/window-state qualification;
- Tauri/WebView and named-pipe security gates;
- self-contained Core/runtime package gate;
- exact SQLite/SQLCipher/WAL fix, snapshot/re-key, and persistence gates;
- KDF-profile floor/migration tests;
- `JARVIS_BACKUP_V1` cryptographic/tamper/order/truncation vectors and generated-recovery clean-profile disaster restore;
- project-policy trust enrollment/change/nested-policy/worker-mutation conformance;
- Codex setup/repair + provider/version/sandbox conformance;
- Local Git + exact GitHub capability-matrix conformance;
- exact Proxmox capability-matrix conformance;
- destructive-action/PermissionEngine safety gates;
- Windows Job Object process containment/orphan cleanup;
- TUF bootstrap/threshold/root rotation/revocation/expiration/delegation/rollback/freeze/mix-and-match plus Tauri updater and Windows signing gates;
- module/catalog/update integrity;
- crash/recovery/uncertain-side-effect tests;
- budget/resource/performance/voice tests;
- early voice-feasibility evidence plus final voice production qualification;
- event/automation tests;
- upgrade/rollback;
- soak/stability;
- signed installer/update, SBOM, licensing, and provenance;
- zero open P0/P1 defects;
- Critical/High vulnerability policy from the Operations Contract satisfied.

Linux runtime tests and Android/companion networking are not V1 release gates. Their absence SHALL NOT permit violations of the platform-boundary architecture rules.

Documentation completion alone never satisfies this gate.

---

# 19. GOVERNING DISTINCTION

> **The contract defines the architecture. The Release Profile defines what V1 guarantees. The qualification report proves that exact signed release.**

> **Windows is the V1 product; Linux is a preserved future full-host path, not a pretend current capability.**

---

**END — JARVIS V1 PRODUCTION RELEASE PROFILE v1.0.7**
