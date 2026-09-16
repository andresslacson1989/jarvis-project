# JARVIS V1 Production Release Profile

**Profile Version:** 1.0.9
**Status:** Canonical production-support target  
**Date:** August 18, 2026  
**Governing suite:** `docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md` plus consolidated clauses `J00`–`J05`

---

# RP-01 — PURPOSE

The architecture describes what JARVIS may support over time. This Release Profile defines what a concrete V1 production release must actually ship, qualify, and support.

A capability that exists only in experimental code, historical material, or an unqualified module/platform is not part of the V1 production guarantee unless this profile requires it or the signed release manifest explicitly promotes it after full qualification.

V1 is intentionally **Windows-only as a production FULL_HOST release**. The v1.0.8 contract suite preserves Linux as a future FULL_HOST target and Android as a future COMPANION direction without adding either to the V1 release burden.

---

# RP-02 — SUPPORTED PLATFORM AND RUNTIME ROLE

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

V1 implementation SHALL preserve the platform-boundary architecture/import requirements in `J01` even though Linux runtime tests are not part of V1 Production Complete.

---

# RP-03 — DESKTOP, UI, RUNTIME, AND PLATFORM BACKEND BASELINE

V1 selects this Windows `FULL_HOST` topology:

```text
Tauri 2 / Rust Windows Platform Host
        ↓
React + TypeScript bundled-local WebView UI
        ↓
restrictive authenticated Windows named pipe
        ↓
application-owned Node.js + TypeScript JARVIS Core
```

J01-PLAT-04 through J01-PLAT-09 and J01-RT-03 through J01-RT-09 own platform, runtime, IPC, process, WebView, and package behavior. J03-SEC-19 through J03-SEC-20 own IPC/WebView security. J04-UI-03 through J04-UI-28 own Mission Control behavior and accessibility; J05-VER-09 through J05-VER-13 own qualification. V1 selects their qualified Windows implementations; future Linux UI reuse remains architectural only. Exact toolchain versions are release-manifest facts under RP-16.

---

# RP-04 — PERSISTENCE AND CRYPTOGRAPHIC BASELINE

V1 selects an authoritative Windows SQLite/SQLCipher-compatible database, local-filesystem WAL operation, Windows secure storage, `JARVIS_BACKUP_V1`, and the `LOCAL_RECOVERY` and `PORTABLE_STATE` backup classes. J02-DATA-02 through J02-DATA-37 and J02-BACKUP-02 through J02-BACKUP-15 own persistence, KDF application, fixed-format, restore, migration, and rollback behavior; J03-SEC-04 and J03-SEC-06 through J03-SEC-07 own the security meaning. J05-VER-14, J05-VER-20 through J05-VER-22 own qualification. Windows↔Linux restore is not a V1 guarantee.

---

# RP-05 — REQUIRED AI PROVIDER SUPPORT

V1 selects **Codex/OpenAI on Windows** as the initial production-qualified AI provider family for:

- GENERALIST/orchestrator behavior;
- SOFTWARE_ENGINEER worker behavior;
- verifier/synthesis behavior when the selected model/profile satisfies requirements.

J01-RT-13 through J01-RT-16, J01-PROTO-19/J01-PROTO-22, J03-SEC-21 through J03-SEC-24, J04-OPS-14, and J05-VER-17 own provider behavior, isolation, support, and proof. This selection does not qualify a Linux adapter or require a local LLM for V1.

---

# RP-06 — REQUIRED LOCAL PROJECT/ENGINEERING CAPABILITIES

V1 SHALL include production-qualified:

- project registration, aliases, environments, workspaces/worktrees;
- explicit project-policy candidate detection, user enrollment/disable/revocation, immutable attempt policy snapshots, content-hash change detection, and nested-policy scope under `J03` policy clauses;
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

Project registration/opening SHALL NOT silently trust repository `AGENTS.md` or other policy-looking files. Trusted policy requires the explicit enrolled canonical project/path/scope/content identity defined by `J03` policy clauses.

---

# RP-07 — REQUIRED MISSION/WORKER RUNTIME

V1 SHALL ship and qualify the mission/task/attempt, graph, execution-scope, worker-loop, journal/checkpoint, queue, resume, scheduler, budget, provider-fallback, crash/recovery, uncertain-side-effect, and completion-verification behavior specified by J01-RT-17 through J01-RT-23, J02-DATA-07 through J02-DATA-19, J04-OPS-02 through J04-OPS-07, and J05-VER-03 through J05-VER-08. This profile selects those capabilities for V1; the referenced contracts own their detailed semantics.

---

# RP-08 — REQUIRED SECURITY/AUTHORIZATION RUNTIME

V1 SHALL ship and qualify the exact security, authorization, trust, recovery, platform, IPC, process, update, and failure behavior specified by J01-RT-05 through J01-RT-09, J01-PROTO-17 through J01-PROTO-21, J02-DATA-03 through J02-BACKUP-15, J03-SEC-04 through J03-SEC-34, J03-POLICY-02 through J03-POLICY-16, J03-SUPPLY-02 through J03-SUPPLY-19, and J05-VER-12 through J05-VER-16. The profile selects the Windows implementations and V1 scope; those contracts own the detailed security semantics.

---

# RP-09 — REQUIRED V1 INTEGRATION SET

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

# RP-10 — MODULE PROFILE

V1 SHALL implement the module registry and execution classes:

```text
DATA_ONLY
BUILT_IN_TRUSTED
EXTERNAL_MANAGED
```

Separately installed executable code cannot run inside Core.

Module support SHALL be platform/runtime-role qualified when native execution or dependencies differ. A module supported on Windows is not automatically supported on Linux.

An open arbitrary third-party executable-module marketplace is **not** a V1 Production Complete requirement. An `EXTERNAL_MANAGED` module is supported only when explicitly present in the current TUF-authorized signed release/catalog support matrix and fully qualified.

Production module catalog authorization SHALL use the dedicated TUF delegated role/profile from `J03` supply-chain clauses; publisher signature alone does not confer `SUPPORTED` status.

---

# RP-11 — REQUIRED VOICE PROFILE

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

Before broad feature implementation proceeds beyond the early platform/persistence foundation, the v1.0.8 Implementation Plan SHALL run an early real-hardware feasibility spike for candidate STT/VAD/TTS/AEC/barge-in/device/resource/licensing behavior. Passing that spike is evidence of stack feasibility, not final Voice Production Complete.

---

# RP-12 — UI IDENTITY / ACCESSIBILITY QUALIFICATION PROFILE

V1 Production Complete requires the exact Windows Release Candidate to satisfy `J04-UI-03` through `J04-UI-25`. `J05-VER-11` owns the complete qualification method, target environments, evidence, and failure conditions.

Shared design-system components SHALL avoid unnecessary Windows-only semantics so a future Linux full-host/companion presentation can reuse the JARVIS identity. This remains an architecture requirement, not a V1 Linux UI runtime claim.

---

# RP-13 — HARDWARE QUALIFICATION BASELINE

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

# RP-14 — POST-V1 REQUIRED INTEGRATIONS

The following remain binding product roadmap requirements but do not block V1 Production Complete:

- SSH;
- Google Workspace;
- Microsoft 365;
- Cloudflare.

They MAY ship independently in production-qualified post-V1 feature releases as each integration becomes complete. No release is required to delay an otherwise complete one of these integrations merely because another is not ready. Removing any of the four from the binding roadmap still requires a deliberate product-contract amendment.

Security/maintenance patch releases remain independent of this roadmap.

Direct public inbound Internet listeners remain outside the required V1/post-V1 integration roadmap unless separately hardened/approved.

---

# RP-15 — FUTURE PLATFORM TARGETS

Linux `FULL_HOST` and Android or other `COMPANION` clients are binding future product targets, not V1 support claims. J01-PLAT-10 through J01-PLAT-25 define the required future platform, companion, and Remote Access Gateway behavior; J01-PLAT-29 defines Linux promotion content; J05-VER-37 defines future qualification. No V1 artifact may claim this support.

---

# RP-16 — RELEASE MANIFEST

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

`J03-SUPPLY-16` owns the security meaning and validation of TUF/signing provenance fields. `J05-VER-36` owns production evidence and artifact-provenance qualification for this selected V1 manifest.

---

# RP-17 — REPOSITORY GOVERNANCE GATE

J00-GOV-28 owns the ordered local pre-publication preflight, effective governance mode, server-protection/fallback semantics, and exact-candidate integration controls; J05-VER-33 owns their qualification evidence. They require server-side branch protection when available; otherwise `COMPENSATING_CONTROLS` retains exact candidate CI, live `master` tip validation, and non-force integration. The qualified `GITHUB_ACTIONS` authority is mandatory for the `static-ci` pipeline. GitLab is repository mirror-only. LocalCI may run compatibility/security tooling but cannot satisfy this gate.

---

# RP-18 — PRODUCTION-COMPLETE GATE

Production Complete requires the same source commit and signed **Windows `FULL_HOST`** release artifacts to satisfy every applicable J05-VER-03 through J05-VER-39 gate and every selected RP-02 through RP-16 requirement. Linux runtime tests and companion networking are outside V1 qualification and cannot waive J01 platform-boundary rules. Documentation completion alone never satisfies this gate.

---

# RP-19 — GOVERNING DISTINCTION

> **The contract defines the architecture. The Release Profile defines what V1 guarantees. The qualification report proves that exact signed release.**

> **Windows is the V1 product; Linux is a preserved future full-host path, not a pretend current capability.**

---

**END — JARVIS V1 PRODUCTION RELEASE PROFILE v1.0.9**
