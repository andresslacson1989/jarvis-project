# JARVIS V1 Production Release Profile

**Profile Version:** 1.0.2  
**Status:** Canonical production-support target  
**Date:** August 11, 2026  
**Governing contract:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`

---

# 1. PURPOSE

The architecture describes what JARVIS may support over time. This Release Profile defines what a concrete V1 production release must actually ship, qualify, and support.

A capability that exists only in an ADR, experimental code, or an unqualified module is not part of the V1 production guarantee unless this profile requires it or the signed release manifest explicitly promotes it after qualification.

---

# 2. SUPPORTED PLATFORM

Initial production target:

```text
Operating system: Windows 11
Minimum normal release baseline: 25H2
CPU architecture: x86-64 (x64)
User model: single interactive Windows user
Normal privilege: standard non-Administrator user
```

Each production release SHALL qualify every Windows release/build family it claims to support. Windows 26H1 or later MAY be added when explicitly qualified; no architecture change is required merely to add another supported Windows 11 release.

Windows ARM64 is not part of the initial V1 guarantee and requires full native/provider/voice/SQLite/installer/update conformance before promotion.

---

# 3. DESKTOP AND RUNTIME BASELINE

```text
Tauri 2 / Rust Native Host
        ↓
React + TypeScript bundled-local WebView UI
        ↓
ACL-restricted + authenticated Windows named pipe
        ↓
application-owned Node.js + TypeScript JARVIS Core
```

Required properties:

- renderer is unprivileged;
- authoritative WebView loads local bundled application content;
- explicit Tauri capabilities and restrictive production CSP;
- no privileged remote-origin Tauri capability;
- selected Tauri/runtime build includes upstream fixes equivalent to or newer than the security corrections shipped in Tauri 2.11.1 for remote-origin custom-command ACL enforcement and Windows local-origin classification;
- installer does not require system Node;
- exact release-owned Node/Core pair is pinned and verified;
- named pipe uses restrictive explicit DACL, local-only behavior, unpredictable endpoint, and bootstrap authentication;
- no privileged localhost/LAN HTTP control plane;
- Windows Job Object containment is mandatory for managed executable child trees except narrowly qualified exceptions;
- signed installer/update artifacts;
- protocol major `1` using v1.0.2 schemas.

Exact Rust/Node/TypeScript/Tauri/package-manager versions are release-manifest facts and SHALL be pinned/qualified per release.

---

# 4. PERSISTENCE BASELINE

V1 SHALL use:

- SQLite/SQLCipher-compatible authoritative database;
- local-filesystem WAL mode unless an explicitly qualified alternative is adopted;
- embedded SQLite core proven to include the upstream WAL-reset corruption fix (SQLite 3.51.3+ or a verified fixed backport/equivalent embedded source);
- `synchronous=FULL` for authoritative state by default;
- foreign keys on every connection;
- bounded busy handling and WAL/checkpoint diagnostics;
- random local `DB_DEK` protected by Windows secure storage;
- SQLite-safe online backup/snapshot;
- independent per-backup DEK;
- backup-specific SQLCipher snapshot key inside authenticated encrypted backup payload;
- `LOCAL_RECOVERY` and `PORTABLE_STATE` backup classes;
- DPAPI current-user local key slot;
- Argon2id portable passphrase slot for portable backups;
- clean-profile restore followed by fresh local `DB_DEK` generation/re-key;
- forward migrations and paired binary/database rollback.

A specific Node SQLite/SQLCipher binding becomes `SUPPORTED` only after the persistence/packaging proof passes on the exact packaged application.

---

# 5. REQUIRED AI PROVIDER SUPPORT

V1 SHALL production-qualify **Codex/OpenAI** as the initial AI provider family for at least:

- GENERALIST/orchestrator behavior;
- SOFTWARE_ENGINEER worker behavior;
- verifier/synthesis behavior when the selected model/profile satisfies requirements.

The supported Codex adapter SHALL:

- resolve exact executable identity/version;
- enforce the release compatibility policy;
- use a stable structured/non-interactive interface when available;
- validate structured output;
- support bounded timeout/cancellation;
- run under mandatory process-tree containment;
- conformance-test provider-native Windows sandbox behavior, including actual write and network restrictions;
- never claim workspace-only read isolation unless the qualified provider implementation actually enforces it;
- treat provider session resume as optional optimization only;
- expose provider quota/usage provenance where available.

Newer/unqualified Codex versions are not automatically `SUPPORTED` merely because they launch.

No local LLM is required for V1.

---

# 6. REQUIRED LOCAL PROJECT/ENGINEERING CAPABILITIES

V1 SHALL include production-qualified:

- project registration, aliases, environments, workspaces/worktrees;
- project/system status;
- Git status/current branch/diff/log;
- controlled project/folder/file open;
- narrow filesystem read/write required by approved engineering work;
- project test/build execution through the engineering boundary;
- bounded `WORKSPACE_ENGINEERING` delegated worker profile;
- isolated writable worktrees for parallel writers;
- task/mission pause/resume/cancel/priority;
- backup/restore/recovery maintenance actions;
- provider/module/integration diagnostics.

The orchestrator never gets a generic unrestricted shell.

---

# 7. REQUIRED MISSION/WORKER RUNTIME

V1 SHALL ship and qualify:

- durable mission/task/attempt state;
- immutable graph versions and validated dynamic replan;
- discriminated execution scopes;
- bounded worker loops and no-progress detection;
- worker journals/checkpoints without private chain-of-thought;
- queue transparency;
- durable `RESUMING` state and live-state revalidation;
- resource/provider/budget-aware scheduler;
- exact budget reservations/settlement;
- provider fallback that preserves policy;
- crash recovery and uncertain-side-effect reconciliation;
- deterministic/live verification before completion.

---

# 8. REQUIRED SECURITY/AUTHORIZATION RUNTIME

V1 SHALL ship and qualify:

- start-locked session;
- Argon2id session-password verifier;
- Windows lock/sign-out integration;
- explicit portable recovery-factor workflow for session/data recovery;
- Windows secure-store Credential Broker;
- explicit named-pipe DACL/local-only/bootstrap authentication;
- authoritative local-only WebView/Tauri capability/CSP/navigation boundary;
- authority envelopes;
- deterministic PermissionEngine precedence with mandatory safety/deny dominance;
- standing permission and limited precedent semantics;
- `CanonicalActionDescriptorV1` JCS/SHA-256/base64url approval binding;
- mandatory final destructive confirmation;
- independent `DataSensitivity` + `DataLocality`;
- prompt-injection/content-authority boundary;
- canonical path/resource resolution;
- conditional external mutation when supported;
- secret-minimizing logs/journals/diagnostics;
- explicit same-user-malware limitation.

---

# 9. REQUIRED V1 INTEGRATION SET

JARVIS V1 SHALL NOT be declared Production Complete until these integration families are implemented and production-qualified:

1. **Local filesystem + Git**
2. **GitHub**
3. **Codex/OpenAI provider integration**
4. **Proxmox VE**

Every required integration must pass credential, capability, schema, permission, failure/recovery, retry/idempotency, secret, version/compatibility, and negative conformance tests.

### Proxmox VE V1 requirements

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

---

# 10. MODULE PROFILE

V1 SHALL implement the module registry and execution classes:

```text
DATA_ONLY
BUILT_IN_TRUSTED
EXTERNAL_MANAGED
```

Separately installed executable code cannot run inside Core.

An open arbitrary third-party executable-module marketplace is **not** a V1 Production Complete requirement. An `EXTERNAL_MANAGED` module is supported only when explicitly present in the signed release/catalog support matrix and fully qualified.

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

Wake word may remain disabled/unqualified and is not required for V1.

---

# 12. HARDWARE QUALIFICATION BASELINE

Initial qualification baseline:

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

# 13. POST-V1 REQUIRED INTEGRATIONS

The following remain binding product requirements but do not block V1 Production Complete:

- SSH;
- Google Workspace;
- Microsoft 365;
- Cloudflare.

The first feature-bearing release after V1 SHALL NOT be feature-complete until all four are `SUPPORTED` and qualified. Security/maintenance patch releases may ship before that gate without being used to evade it.

Direct public inbound Internet listeners remain outside the required V1/post-V1 integration gate unless separately hardened/approved.

---

# 14. RELEASE MANIFEST

Every production release SHALL record at least:

```text
jarvis_version
contract_version
release_profile_version
source_commit_sha
windows_support_matrix
installer/signing identity metadata
Tauri/Rust/Node/TypeScript/package-manager versions
Core packaging/runtime identity
protocol/schema version
database/SQLCipher/SQLite identity and WAL-fix evidence
migration set
supported provider versions/ranges
supported integration/module versions/ranges
voice provider versions/ranges
module catalog trust key ids
SBOM reference/hash
qualification report reference/hash
known limitations
rollback pairing information
```

No raw credentials/private user data appear in the manifest.

---

# 15. PRODUCTION-COMPLETE GATE

For this profile, Production Complete requires the same source commit and signed release artifacts to pass:

- all required functionality and current mandatory contract rules;
- platform/clean-install qualification;
- Tauri/WebView and named-pipe security gates;
- self-contained Core/runtime package gate;
- SQLite/SQLCipher/WAL fix and persistence gates;
- portable clean-profile encrypted restore;
- Codex provider/version/sandbox conformance;
- Local Git/GitHub/Proxmox integration conformance;
- destructive-action/PermissionEngine safety gates;
- process containment/orphan cleanup;
- module/catalog/update integrity;
- crash/recovery/uncertain-side-effect tests;
- budget/resource/performance/voice tests;
- upgrade/rollback;
- soak/stability;
- signed installer/update, SBOM, and provenance;
- zero open P0/P1 defects.

Documentation completion alone never satisfies this gate.

---

# 16. GOVERNING DISTINCTION

> **The contract defines the architecture. The Release Profile defines what V1 guarantees. The qualification report proves that exact signed release.**

---

**END — JARVIS V1 PRODUCTION RELEASE PROFILE v1.0.2**
