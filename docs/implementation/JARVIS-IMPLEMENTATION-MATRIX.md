# JARVIS Implementation Execution Matrix

**Document role:** Non-normative execution/status control board derived from the locked active contract suite.  
**Contract suite:** JARVIS v1.0.5  
**Authoritative implementation sequence:** `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`  
**Contract baseline reviewed before this matrix:** `master` at `5766978576a48165a7ec8013ed6a106b0b0ddd17`  
**Initial implementation state:** application implementation has not started; all mandatory implementation rows begin `NOT STARTED`.  
**Next eligible subsection after explicit implementation authorization:** `0.1`.

> **The contract is the implementation authority. This matrix is only the execution order, dependency map, status board, and evidence index.**

An omission or stale statement in this file never weakens a current normative requirement. Before implementing a subsection, the agent SHALL re-fetch live `master`, reread `AGENTS.md`, revalidate the current manifest, and read the subsection's governing current contract text. If the current contract changed, this matrix must be reconciled before implementation proceeds.

## Master implementation goal

Implement the complete contract-defined **Windows 11 x64 `FULL_HOST` JARVIS V1 production release**, not an MVP, prototype, partial demo, or documentation-only result. Completion requires one exact source commit and its exact signed Windows artifacts to satisfy every mandatory active-contract rule and every cumulative release-qualification gate.

## Execution invariants

1. Preserve the Implementation Plan's Phase 0 → 19 macro-order. This matrix refines that order; it does not replace it.
2. Exactly one subsection is the primary active implementation target at a time.
3. Every child subsection inherits its parent section's dependency. The child's `Depends On` cell lists additional prerequisites beyond that section-entry gate.
4. Within a section, execute mandatory rows in listed order by default. Do not skip an earlier mandatory `NOT STARTED` row merely because a later row's technical dependencies are already satisfied; row order is the intended smooth implementation path unless the matrix itself is formally repaired.
5. A subsection may start only when every active mandatory dependency listed for it is `VERIFIED`, except explicitly documented bootstrap dependencies that are part of that same subsection.
6. Dependency ranges such as `1.2–1.13` are inclusive. A contract-permitted row currently marked `DEFERRED` is an inactive optional branch and does not block a range, downstream subsection, or checkpoint unless the concrete release enables it. When enabled, that row immediately becomes a normal mandatory predecessor and must pass its full implementation/verification loop before downstream completion.
7. No subsection may depend on a later full feature. Cross-cutting systems are staged as foundation/proof → full implementation → productization → final qualification.
8. If implementation discovers a missing prerequisite, do not jump ahead and partially implement an arbitrary later subsection. Treat it as a matrix defect: identify the true prerequisite, confirm its contract basis, repair the matrix/dependency order, then resume. If the issue is a normative ambiguity/contradiction, use the contract amendment rule instead of guessing.
9. Feature completion includes applicable failure/recovery, diagnostics, security, atomicity/idempotency, migration/update compatibility, platform behavior, negative tests, and user-facing accessibility at the point the feature becomes a production dependency.
10. `IMPLEMENTED` is not `VERIFIED`. Scores never override a failed hard gate.
11. Contract Accuracy must be exactly `10/10`; every other applicable baseline criterion must meet the `AGENTS.md` threshold.
12. A parent section becomes `VERIFIED` only after all required child rows pass and its `*.CP` integration checkpoint passes.
13. Do not advance support claims from `modeled`/`installed`/`launchable` to `SUPPORTED` without the exact required conformance evidence.
14. `Production Complete` is available only at `19.27`/`19.CP`; no earlier row or checkpoint is production completion.

## Status model

`NOT STARTED` → `IN PROGRESS` → `IMPLEMENTED` → `VERIFYING` → `VERIFIED`.

`BLOCKED` is reserved for a genuine external prerequisite that prevents further reasonable repository-side progress. `DEFERRED`/`NOT APPLICABLE` require explicit contract permission and a recorded reason.

## Contract reference legend

| Abbrev. | Normative source |
|---|---|
| `MAN` | `docs/JARVIS-CONTRACT-MANIFEST-v1.0.5.md` |
| `IC` | `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.5.md` |
| `RP` | `docs/JARVIS-V1-RELEASE-PROFILE.md` |
| `PP` | `docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md` |
| `RT` | `docs/implementation/JARVIS-RUNTIME-CONTRACT.md` |
| `PS` | `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md` |
| `DS` | `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md` |
| `SEC` | `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md` |
| `BKC` | `docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md` |
| `PPT` | `docs/implementation/JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md` |
| `SCT` | `docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md` |
| `CS` | `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md` |
| `OPS` | `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md` |
| `UI` | `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md` |
| `VR` | `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md` |
| `PLAN` | `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` |

## Progressive ownership map

This table is a guard against backward dependencies and premature implementation.

| Cross-cutting system | Foundation / proof | Full implementation / primary owner | Productization | Final qualification |
|---|---|---|---|---|
| Platform/runtime capability boundary | 0 | 1–2, then feature-specific Windows backends | 18 | 19.2, 19.6 |
| Protocol/schema/error primitives | 0.3–0.7 | Extended by owning feature sections 4–17 | 18.19 release manifest | 19.3 |
| Diagnostics/observability | 0.4, 1.14, 2.8, 3.2 | Every owning feature adds typed diagnostics | 18.11–18.13 | 19 all applicable gates |
| Process supervision | 0.4 contract | 1.7 Core bootstrap, 2.4–2.5 full Windows backend | Consumed by providers/workers/modules/update | 19.6 |
| Persistence | 3 proof | 4 authoritative state; later sections extend owned schema | 18 migration/update/recovery UX | 19.11 |
| Backup/recovery cryptography | 0.7 constants; 3 exact proof | 4/5 state + recovery hooks; 11 recovery orchestration | 18.8–18.10 | 19.12 |
| Session/authorization | 1 locked shell; 3 KDF/secure storage | 5 | Feature-specific consumers 6–17 | 19.7–19.10 |
| Project-policy trust | 4.10 state hooks | 6 | Consumed by 7, 9, 11; surfaced in 18 | 19.8 |
| Supply-chain/TUF trust | 0.7 constants; 4.11 state hooks | 12 module/catalog trust | 18.14–18.18 application updater | 19.15 |
| Mission Control/UI identity | 1 foundation | Owning feature sections add their own truthful UI | 18.1–18.5 | 19.4 |
| Voice | 0.4 audio contract | 3A feasibility → 15 foundation → 16 full duplex | Cross-shell/ops integration in 18 | 19.18 |
| Exact money/budgets | 0.6 type; 4.7 persistence | 11 | 18 operational presentation | 19.14 |
| Credentials/integrations | 3.4 secure store; 5.4 broker | 12 registry, 13 GitHub, 14 Proxmox | 18 support/diagnostics | 19.16–19.17 |
| Domain events/automation | 4.12 authoritative event foundation | 17 external Event Gateway/automation | 18 operational integration | 19.19 |
| Recovery | 3 persistence/backup; 4 state; 5 session | Each feature owns failure semantics; 11 central recovery/resume | 18 recovery UX/update rollback | 19.12–19.14, 19.21 |
| Release identity/provenance | 0 toolchain/profile/drift facts | Each feature records its support/qualification identity | 18.19–18.21 | 19.1, 19.25–19.27 |

## Current execution pointer

| Field | Current value |
|---|---|
| Active section | `SECTION 0 — Repository / Platform Contracts / Toolchain / Governance` |
| Active subsection | None — `0.3` verified; `0.4` not started |
| Next eligible subsection | `0.4` |
| Last matrix review baseline | JARVIS v1.0.5 contract suite at `5766978576a48165a7ec8013ed6a106b0b0ddd17` |
| Production Complete | **NO** |

## Implementation matrix

### SECTION 0 — Repository / Platform Contracts / Toolchain / Governance

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 0 — Repository / Platform Contracts / Toolchain / Governance** | **IN PROGRESS** | — | `Phase 0`; checkpoint: Repository Governance + Platform Boundary + Contract-Drift Protection Ready | — | `0.4` is next | `0.1–0.3` verified; section checkpoint remains pending |
| ↳ **0.1** Implementation admission, authoritative-suite pinning, and repository baseline | **VERIFIED** | — | PLAN §2; IC §§2–3,28–29; RP §17; AGENTS Source of truth/Branch authority | 10 CA / 9 scoped | None within `0.1` scope | `ded8f9e5c0e056ff69fa27668dfb0bd4fca7a0f7`; `docs/implementation/evidence/0.1-implementation-admission.md`; live `master` `bb32c530...`; diff verification changed only the evidence file |
| ↳ **0.2** Monorepo responsibility boundaries and dependency-direction skeleton | **VERIFIED** | 0.1 | PLAN §2; CS §§2–4,32; IC §§5,8 | 10 CA / 9 scoped | None within `0.2` scope | `67fa540caab982dccb2330070df62c6d71603099`; `docs/implementation/architecture/REPOSITORY-BOUNDARIES.md`; `docs/implementation/evidence/0.2-monorepo-boundaries.md`; diff added only 22 Markdown boundary/evidence files; no package/toolchain/runtime/native implementation; Linux negative-support wording verified |
| ↳ **0.3** Platform/runtime identity and compatibility protocol foundation | **VERIFIED** | 0.2 | PLAN §2; PP §§2–7,11; PS §§2–3,27; RP §§2–3 | 10 CA / 9 scoped | None within `0.3` scope | `229954d1e34c52bb11c50570308e9f66c2a21034`; `669fec6bad6cdec53a1a44fc94be3573e120997f`; `docs/implementation/evidence/0.3-platform-runtime-identity.md`; exact 6-file implementation; 5/5 schema self-validation; 20/20 positive/negative/adversarial cases; strict TypeScript auxiliary check PASS; no later-phase implementation leakage |
| ↳ **0.4** Semantic platform-capability contracts, availability, and stable platform errors | **NOT STARTED** | 0.3 | PLAN §2; PP §§6,26–28; CS §4; RP §3 | — | — | — |
| ↳ **0.5** Composition root, Windows backend registration, and future-Linux namespace reservation | **NOT STARTED** | 0.4 | PLAN §2; PP §§7–10; CS §§2–4,32 | — | — | — |
| ↳ **0.6** Protocol/schema infrastructure and common boundary primitives | **NOT STARTED** | 0.3 | PLAN §2; PS §§1–9,25–27; CS §§5–7,11 | — | — | — |
| ↳ **0.7** Typed bootstrap/configuration schemas and machine-readable canonical contract values | **NOT STARTED** | 0.6 | PLAN §2; MAN §§4–6; PS §24; CS §30; IC §28 | — | — | — |
| ↳ **0.8** Pinned toolchains, package manager, strict TypeScript, Rust baseline, lockfiles | **NOT STARTED** | 0.2 | PLAN §2; CS §§5–6,28–29; RP §3 | — | — | — |
| ↳ **0.9** Production test-layer and fixture architecture | **NOT STARTED** | 0.6, 0.8 | PLAN §2; CS §27; VR §§6–8 | — | — | — |
| ↳ **0.10** Architecture/forbidden-import/package-cycle/unsafe-Rust-containment/platform-capability-failure enforcement | **NOT STARTED** | 0.4, 0.5, 0.9 | PLAN §2; PP §28; CS §§3,28,32; VR §9 | — | — | — |
| ↳ **0.11** Static CI baseline: format/type/build/schema/security/dependency/license/secret/provenance | **NOT STARTED** | 0.8, 0.9 | PLAN §2; CS §§28–29; SEC §§27–28; VR §6 | — | — | — |
| ↳ **0.12** Generated-artifact reproducibility, manifest validation, and contract/profile drift checks | **NOT STARTED** | 0.7, 0.11 | PLAN §2; MAN §6; IC §28; RP §17 | — | — | — |
| ↳ **0.13** Authoritative master protection, required checks, and auditable bypass governance | **NOT STARTED** | 0.11, 0.12 | PLAN §2; IC §28; RP §17; VR §33 | — | — | — |
| ↳ **0.CP** SECTION CHECKPOINT — Phase 0 clean-checkout, governance, platform-boundary, and drift proof | **NOT STARTED** | 0.1–0.13 | PLAN §2 Exit; PLAN §26 checkpoint; VR §§6,9,33 | — | — | — |

### SECTION 1 — Windows Tauri Host / Mission Control Foundation / Application-Owned Core

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 1 — Windows Tauri Host / Mission Control Foundation / Application-Owned Core** | **NOT STARTED** | 0.CP | `Phase 1`; checkpoint: Windows Desktop Trust + Mission Control Foundation Ready | — | — | — |
| ↳ **1.1** Tauri 2 + React desktop workspace with bundled-local authoritative WebView | **NOT STARTED** | 0.CP | PLAN §3; RT §§2–5; RP §3; UI §8 | — | — | — |
| ↳ **1.2** Tauri capabilities, CSP, navigation, external-link, devtools, and inert-content security | **NOT STARTED** | 1.1 | PLAN §3; IC §6; RT §5; SEC §20; CS §25; VR §12 | — | — | — |
| ↳ **1.3** Rust Windows platform host and deterministic Windows composition wiring | **NOT STARTED** | 1.1, 0.5 | PLAN §3; IC §§5,8; PP §§7–9; RP §3 | — | — | — |
| ↳ **1.4** Single-instance ownership, production data-directory layout, and maintenance-lock foundation | **NOT STARTED** | 1.3 | RT §4; UI §9 | — | — | — |
| ↳ **1.5** Application-owned Node/Core packaging, controlled environment, integrity states, and no PATH fallback | **NOT STARTED** | 1.3, 0.8 | PLAN §3; IC §7; RT §§3,6; RP §3; VR §§13,32 | — | — | — |
| ↳ **1.6** Shared Core bootstrap/service shell with typed UI↔Rust/Core boundary stubs | **NOT STARTED** | 1.5, 0.6 | PLAN §§3,22; RT §§10–11; CS §§3,7 | — | — | — |
| ↳ **1.7** Initial PlatformProcessSupervisor Windows Job Object containment for Core startup | **NOT STARTED** | 1.5, 0.4 | PLAN §3; RT §§6,9; IC §18 | — | — | — |
| ↳ **1.8** PlatformWindowController Windows backend, deterministic presentation states, multi-monitor recovery, and conservative no-focus-steal/privacy defaults before the later full NotificationPolicyEngine | **NOT STARTED** | 1.3, 0.4 | PLAN §3; UI §§9,24; PP §18 | — | — | — |
| ↳ **1.9** Initial PlatformSessionObserver and PlatformSystemInfo Windows backends | **NOT STARTED** | 1.3, 0.4 | PLAN §3; PP §§17,26–27; RP §3 | — | — | — |
| ↳ **1.10** Initial PlatformPathsAndIdentity Windows application/data path backend | **NOT STARTED** | 1.3, 0.4 | PLAN §3; PP §13; CS §16 | — | — | — |
| ↳ **1.11** Canonical brand assets, offline Inter packaging, and asset/license provenance foundation | **NOT STARTED** | 1.1 | PLAN §3; IC §26; UI §§3–5; `assets/brand/README.md`; RP §3 | — | — | — |
| ↳ **1.12** Central design tokens, reusable components, keyboard/focus, reduced-motion, and forced-colors foundation | **NOT STARTED** | 1.11 | PLAN §3; UI §§6–7,18,20,22–23; CS §25 | — | — | — |
| ↳ **1.13** Mission Control shell, locked startup surface, and truthful foundational states | **NOT STARTED** | 1.6, 1.8, 1.12 | PLAN §3; IC §§4,6; UI §§8,11,17,25; OPS §§2–3 | — | — | — |
| ↳ **1.14** Clean Windows 11 x64 standard-non-admin desktop foundation proof: packaged Core, window state, repair/degraded paths, no system Node | **NOT STARTED** | 1.2–1.13 | PLAN §3 Exit; VR §§11–13,32 | — | — | — |
| ↳ **1.CP** SECTION CHECKPOINT — Windows desktop trust and Mission Control foundation | **NOT STARTED** | 1.1–1.14 | PLAN §3 Exit; PLAN §26 checkpoint; VR §§9,11–13,32 | — | — | — |

### SECTION 2 — Platform Local IPC / Process / Privilege Boundaries

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 2 — Platform Local IPC / Process / Privilege Boundaries** | **NOT STARTED** | 1.CP | `Phase 2`; checkpoint: Phase 2 IPC / Process / Privilege Boundary Exit | — | — | — |
| ↳ **2.1** Windows PlatformLocalIpc named-pipe endpoint, restrictive DACL, session principal, local-only semantics | **NOT STARTED** | 1.CP, 0.4 | PLAN §4; RT §7; SEC §19; PP §15; VR §13 | — | — | — |
| ↳ **2.2** Bootstrap-secret generation/secure transfer, authenticated handshake, bounded framing, protocol-major negotiation | **NOT STARTED** | 2.1, 0.6 | PLAN §4; RT §§6–7; PS §7; VR §§10,13 | — | — | — |
| ↳ **2.3** IPC adversarial isolation: wrong principal/session/remote/secret, renderer denial, malformed/oversized/protocol mismatch | **NOT STARTED** | 2.2 | PLAN §4 Exit; SEC §§19,33; VR §13 | — | — | — |
| ↳ **2.4** Full PlatformProcessSupervisor Windows process-tree ownership, suspended assignment, handle allowlist, kill-on-close | **NOT STARTED** | 1.7 | PLAN §4; RT §9; PP §16; CS §10; VR §19 | — | — | — |
| ↳ **2.5** Managed-process cancellation escalation, forced shutdown, descendant/orphan cleanup, and truthful containment diagnostics | **NOT STARTED** | 2.4 | PLAN §4; RT §§9,23; PP §§16,27; VR §19 | — | — | — |
| ↳ **2.6** PlatformPrivilegeMediator bounded operation registry and Windows UAC/elevation boundary | **NOT STARTED** | 1.CP, 0.4 | PLAN §4; RT §8; SEC §22; PP §9 | — | — | — |
| ↳ **2.7** Native broker capability surface: typed secure/process/window/session/update/audio operations; no generic command broker | **NOT STARTED** | 2.4, 2.6 | RT §8; IC §8; SEC §§6,22 | — | — | — |
| ↳ **2.8** Pre-persistence bootstrap ordering and fail-closed diagnostics through authenticated Core IPC: implement the Phase-2-available portions of the Runtime bootstrap sequence, register the typed PlatformSecureStorage boundary without claiming the Phase-3 Windows secure-store backend, and leave persistence/recovery/provider startup stages explicitly unqualified until their owning sections | **NOT STARTED** | 2.2, 2.5, 2.7 | PLAN §§4,22; RT §6 sequencing; OPS §§2,7,24; VR §13 | — | — | — |
| ↳ **2.9** Pre-autonomy control-plane slice: deterministic LOCKED Core state, minimal state/event ownership interfaces, and harmless get_system_status round-trip (not the later general ToolExecutor) | **NOT STARTED** | 2.8, 1.13 | PLAN §22 First Implementation Slice; RT §§10–12; PS §§8–9 | — | — | — |
| ↳ **2.CP** SECTION CHECKPOINT — intended Core connects; unauthorized peers fail; process/elevation boundaries cannot be bypassed | **NOT STARTED** | 2.1–2.9 | PLAN §4 Exit; VR §§13,19 | — | — | — |

### SECTION 3 — Persistence / Secure Storage / KDF / JARVIS_BACKUP_V1 Proof

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 3 — Persistence / Secure Storage / KDF / JARVIS_BACKUP_V1 Proof** | **NOT STARTED** | 2.CP | `Phase 3`; checkpoint: Persistence/KDF/JARVIS_BACKUP_V1 Portable Recovery Proven | — | — | — |
| ↳ **3.1** Select/pin production SQLite/SQLCipher binding and prove exact embedded WAL-reset-fix identity | **NOT STARTED** | 2.CP, 0.8 | PLAN §5; IC §20; RP §4; DS §2; VR §20 | — | — | — |
| ↳ **3.2** Owned DB connection factory: qualified local path, WAL, FULL synchronous, foreign keys, bounded busy/checkpoint diagnostics | **NOT STARTED** | 3.1, 1.10 | PLAN §5; DS §§2,26; CS §13; VR §20 | — | — | — |
| ↳ **3.3** Minimal proof schema/migration and transactional state+causative-event skeleton, including only recovery-compatible credential-handle/integration metadata needed by Phase-3 restore semantics | **NOT STARTED** | 3.2, 0.6 | PLAN §§5,22; DS §§5–8,34; CS §§13–14 | — | — | — |
| ↳ **3.4** PlatformSecureStorage Windows backend and random local DB_DEK lifecycle using opaque handles | **NOT STARTED** | 2.7, 3.2 | PLAN §5; PP §14; SEC §§6–7; DS §3; RP §4 | — | — | — |
| ↳ **3.5** Production KDF profile schemas/Argon2id path, parameter bounds, OS-CSPRNG salts, and under-floor rejection | **NOT STARTED** | 3.3, 3.4 | PLAN §5; IC §9; PS §6; DS §5; SEC §4; CS §15; VR §14 | — | — | — |
| ↳ **3.6** Encrypted SQLCipher DB create/open, WAL crash/restart, transaction and corruption/integrity proof | **NOT STARTED** | 3.2–3.5 | PLAN §5 Required proof; DS §§2,26,35; VR §20 | — | — | — |
| ↳ **3.7** Exact SQLCipher-safe snapshot/re-key/export mechanism under fresh SnapshotDBKey | **NOT STARTED** | 3.6 | PLAN §5; BKC §4; RP §4; VR §§20–21 | — | — | — |
| ↳ **3.8** JARVIS_BACKUP_V1 bounded descriptor/parser and RFC8785 descriptor digest | **NOT STARTED** | 3.5, 0.7 | BKC §§2,5; PLAN §5; CS §26 | — | — | — |
| ↳ **3.9** Backup key hierarchy, fresh BackupDEK/SnapshotDBKey generation, authenticated payload manifest, secret exclusion | **NOT STARTED** | 3.7, 3.8 | BKC §§3,11; IC §21; DS §§27,29 | — | — | — |
| ↳ **3.10** AES-256-GCM 4 MiB chunk framing, nonce/AAD, count/order/truncation/duplicate/append authentication | **NOT STARTED** | 3.9 | BKC §6; PLAN §5; VR §21 | — | — | — |
| ↳ **3.11** GENERATED_RECOVERY_V1 256-bit factor representation, HKDF slot KEK, wrap-AEAD, and export/privacy constraints | **NOT STARTED** | 3.10 | BKC §§7–8; IC §21; RP §4 | — | — | — |
| ↳ **3.12** Windows LOCAL_RECOVERY DPAPI/PlatformSecureStorage BackupDEK slot | **NOT STARTED** | 3.9, 3.4 | BKC §10; DS §32; RP §4 | — | — | — |
| ↳ **3.13** Optional PASSPHRASE_ARGON2ID_V1 backup slot — implement only if enabled by product/release configuration | **DEFERRED** | 3.11 | BKC §9; RP §4; PLAN §5 | — | Contract-permitted optional capability; not required for base V1 Production Complete unless enabled | Must be fully qualified before any release exposes it |
| ↳ **3.14** Whole-package verification: bounded parse, slot authentication, manifest/hash, SnapshotDBKey open, SQLite integrity | **NOT STARTED** | 3.10–3.12; +3.13 if enabled | BKC §§11–14; DS §30; VR §21 | — | — | — |
| ↳ **3.15** Clean-profile portable restore: full authentication before activation, fresh DB_DEK re-key, REAUTH_REQUIRED reconciliation | **NOT STARTED** | 3.14, 3.3 | BKC §12; DS §§31,33; IC §21; VR §21 | — | — | — |
| ↳ **3.16** Local restore, wrong-factor/tamper failure atomicity, damaged-state preservation, Recovery Mode entry | **NOT STARTED** | 3.12, 3.14, 3.15 | DS §§32,35; SEC §32; BKC §14 | — | — | — |
| ↳ **3.17** Cross-language backup golden vectors and malicious bounds/KDF/nonce/tag/chunk negative suite | **NOT STARTED** | 3.8–3.12, 3.14–3.16; +3.13 if enabled | BKC §14; PLAN §5 Required proof; VR §21 | — | — | — |
| ↳ **3.18** Packaged Windows persistence/backup proof with secret-free logs/diagnostics and exact binding evidence | **NOT STARTED** | 3.1–3.12, 3.14–3.17; +3.13 if enabled | PLAN §5 Exit; CS §§12–13,27; VR §§20–21,32 | — | — | — |
| ↳ **3.CP** SECTION CHECKPOINT — persistence/KDF/JARVIS_BACKUP_V1 portable recovery proof | **NOT STARTED** | 3.1–3.12, 3.14–3.18; +3.13 if enabled | PLAN §5 Exit; PLAN §26 checkpoint; RP §4; VR §§14,20–22 | — | — | — |

### SECTION 3A — Early Voice Feasibility Spike

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 3A — Early Voice Feasibility Spike** | **NOT STARTED** | 3.CP | `Phase 3A`; checkpoint: Early Voice Feasibility Proven | — | — | — |
| ↳ **3A.1** Candidate STT/VAD/TTS/AEC stack, versions, redistribution/license, packaging, and offline feasibility assessment | **NOT STARTED** | 3.CP, 0.4 | PLAN §5A; RP §11; IC §25 | — | — | — |
| ↳ **3A.2** Representative Windows hardware/device feasibility harness and measurement methodology | **NOT STARTED** | 3A.1 | PLAN §5A Measurements; RP §13; VR §§30–31 | — | — | — |
| ↳ **3A.3** Local STT/VAD/TTS identity, latency, device selection/reconnect, and offline behavior spike | **NOT STARTED** | 3A.2 | PLAN §5A Candidate scope; OPS §§19–22 | — | — | — |
| ↳ **3A.4** AEC exact TTS render reference, double-talk/barge-in, deterministic stop/mute/cancel spike | **NOT STARTED** | 3A.2, 3A.3 | PLAN §5A; RT §26; RP §11; VR §30 | — | — | — |
| ↳ **3A.5** 16 GB/i7-13th/RTX-4060 resource-contention, acceleration, fallback, and Bluetooth limitation measurements | **NOT STARTED** | 3A.3, 3A.4 | PLAN §5A; RP §13; VR §31 | — | — | — |
| ↳ **3A.6** Versioned feasibility report with measured limitations and production-candidate viability decision | **NOT STARTED** | 3A.1–3A.5 | PLAN §5A Deliverable/Exit | — | — | — |
| ↳ **3A.CP** SECTION CHECKPOINT — at least one stack is technically/package/licensing feasible without weakening mandatory privacy/security | **NOT STARTED** | 3A.1–3A.6 | PLAN §5A Exit; PLAN §26 checkpoint | — | — | — |

### SECTION 4 — Authoritative State / Events

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 4 — Authoritative State / Events** | **NOT STARTED** | 3A.CP | `Phase 4`; checkpoint: Core State Ready | — | — | — |
| ↳ **4.1** Expand authoritative schema ownership and monotonic migration framework for full Core state | **NOT STARTED** | 3A.CP, 3.3 | PLAN §6; DS §§6,34; CS §14 | — | — | — |
| ↳ **4.2** Common durable identifiers, platform/runtime/backend/support identity, and platform-tagged path representation | **NOT STARTED** | 4.1, 0.3 | PLAN §6; DS §4; PS §§3,26–27 | — | — | — |
| ↳ **4.3** Mission/task/attempt state machines, owning transition policy, durable RESUMING, terminal invariants | **NOT STARTED** | 4.1, 0.6 | PLAN §6; DS §§9–11; PS §13; CS §8; VR §8 | — | — | — |
| ↳ **4.4** ExecutionScope persistence and authoritative scope invariants | **NOT STARTED** | 4.1, 0.6 | PLAN §6; DS §12; PS §11 | — | — | — |
| ↳ **4.5** Immutable mission graph/acceptance/dependency persistence structures | **NOT STARTED** | 4.3 | PLAN §6; DS §15; PS §14 | — | — | — |
| ↳ **4.6** Authority-envelope, permission-decision, approval/action-descriptor storage structures without implementing authorization policy | **NOT STARTED** | 4.1, 0.6 | PLAN §6; DS §§13–14; PS §§12,17–18 | — | — | — |
| ↳ **4.7** DataPolicy, exact MoneyAmount, provider quota/usage/budget-reservation persistence primitives | **NOT STARTED** | 4.1, 0.6 | PLAN §6; IC §19; DS §§23–24; PS §§4–5,22 | — | — | — |
| ↳ **4.8** Worker checkpoints, artifacts, workspace/resource leases, and provider-resume metadata structures | **NOT STARTED** | 4.1 | PLAN §6; DS §§16–19; PS §15 | — | — | — |
| ↳ **4.9** Provider setup/qualification, module, integration, and Proxmox logical state hooks | **NOT STARTED** | 4.1 | PLAN §6; DS §§22,25; PS §§19–21 | — | — | — |
| ↳ **4.10** Project-policy trust-record/snapshot state hooks | **NOT STARTED** | 4.1 | PLAN §6; PPT §§2,4,7; MAN §4.2 | — | — | — |
| ↳ **4.11** TUF/update trusted-metadata, release-sequence/security-epoch, backup/update/recovery metadata hooks | **NOT STARTED** | 4.1 | PLAN §6; SCT §§10,14–16; DS §6 | — | — | — |
| ↳ **4.12** Versioned append-oriented domain-event model, correlation/causation, post-commit publication, dedup foundation | **NOT STARTED** | 4.1, 3.3 | PLAN §6; DS §§7,18; PS §23 | — | — | — |
| ↳ **4.13** Optimistic concurrency and repository transaction pattern: state + causative event/audit + invariant rows atomically | **NOT STARTED** | 4.3–4.12 | PLAN §6; DS §§7–8; CS §§12–13 | — | — | — |
| ↳ **4.14** Authoritative non-secret configuration service with validated candidate staging and atomic activation | **NOT STARTED** | 4.1, 4.13 | OPS §11; PS §24; CS §30 | — | — | — |
| ↳ **4.15** Conversation/memory storage separation, confidence/revision metadata, and retention anchors | **NOT STARTED** | 4.1 | DS §20; OPS §13 | — | — | — |
| ↳ **4.16** State/property/migration/crash tests proving illegal transitions, stale-write rejection, no raw secrets/native handles | **NOT STARTED** | 4.2–4.15 | PLAN §6 Exit; VR §8; DS §37; CS §§8,14 | — | — | — |
| ↳ **4.CP** SECTION CHECKPOINT — authoritative Core state, events, schema and concurrency invariants | **NOT STARTED** | 4.1–4.16 | PLAN §6 Exit; PLAN §26 checkpoint; VR §§7–10 | — | — | — |

### SECTION 5 — Session Security / PermissionEngine / Approval

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 5 — Session Security / PermissionEngine / Approval** | **NOT STARTED** | 4.CP | `Phase 5`; checkpoint: Security/Permission Boundary Ready | — | — | — |
| ↳ **5.1** Session password creation/unlock/lock state, progressive cooldown, and production KDF verifier | **NOT STARTED** | 4.CP, 3.5 | PLAN §7; IC §9; SEC §§4–5; VR §14 | — | — | — |
| ↳ **5.2** Versioned KDF rehash/upgrade and explicit recovery-factor password-reset/recovery workflow | **NOT STARTED** | 5.1, 3.15 | PLAN §7; SEC §4; DS §33; VR §14 | — | — | — |
| ↳ **5.3** PlatformSessionObserver lock/sign-out/idle integration and locked UI/voice/notification data suppression | **NOT STARTED** | 5.1, 1.9 | PLAN §7; SEC §5; PP §17; VR §14 | — | — | — |
| ↳ **5.4** Credential Broker over PlatformSecureStorage with context-scoped opaque handles, rotate/revoke/delete lifecycle, and secret-exclusion guarantees | **NOT STARTED** | 3.4, 4.CP | PLAN §7; SEC §6; CS §17 | — | — | — |
| ↳ **5.5** DataSensitivity/DataLocality enforcement and deterministic audited declassification boundary | **NOT STARTED** | 4.7 | IC §19; SEC §8; PS §4 | — | — | — |
| ↳ **5.6** Content-authority/prompt-injection source labeling and structured-AI-output validation foundation | **NOT STARTED** | 5.5, 0.6 | SEC §§9–12; VR §16 | — | — | — |
| ↳ **5.7** AuthorityEnvelopeService immutable action/scope/system/data/budget containment semantics | **NOT STARTED** | 4.6, 4.4 | PLAN §7; IC §13; DS §13; PS §12 | — | — | — |
| ↳ **5.8** PermissionEngine exact deterministic precedence, risk classes, standing permissions, and precedent limits | **NOT STARTED** | 5.7, 5.1 | PLAN §7; IC §13; SEC §§13–15; CS §9; VR §15 | — | — | — |
| ↳ **5.9** Pre-ALLOW gates for platform/setup/integrity/project-policy/supply-chain/locality/budget/resource/precondition facts | **NOT STARTED** | 5.8, 0.4 | IC §13 step 6; SEC §13; PLAN §7 | — | — | — |
| ↳ **5.10** CanonicalActionDescriptorV1 single shared builder, RFC8785/SHA-256/base64url Rust+TS golden vectors | **NOT STARTED** | 4.6, 0.6 | PLAN §7; IC §15; PS §§18,25; SEC §17; CS §18; VR §10 | — | — | — |
| ↳ **5.11** ApprovalService issue/decision/expiry/cancel/single-use transactional consumption and replay protection | **NOT STARTED** | 5.8, 5.10, 4.13 | PLAN §7; IC §15; DS §14; VR §§8,15 | — | — | — |
| ↳ **5.12** Fresh material target re-resolution and mandatory destructive final confirmation immediately before execution | **NOT STARTED** | 5.11 | IC §§14–15; SEC §§16–18; OPS §23 | — | — | — |
| ↳ **5.13** Session/approval/permission audit reason codes, adversarial scenarios, and same-user threat-limit wording | **NOT STARTED** | 5.1–5.12 | PLAN §7 Exit; SEC §§31–34; VR §§14–16 | — | — | — |
| ↳ **5.14** Mission Control session and approval UX: exact action/target/environment/consequence, keyboard path, no color-only authority | **NOT STARTED** | 5.3, 5.11 | UI §§14,20–21; OPS §23; VR §11 | — | — | — |
| ↳ **5.CP** SECTION CHECKPOINT — session trust, deterministic authorization, canonical approvals, and destructive boundary | **NOT STARTED** | 5.1–5.14 | PLAN §7 Exit; PLAN §26 checkpoint; VR §§14–16 | — | — | — |

### SECTION 6 — Projects / Scopes / Context / Memory / Project-Policy Trust

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 6 — Projects / Scopes / Context / Memory / Project-Policy Trust** | **NOT STARTED** | 5.CP | `Phase 6`; checkpoint: Project Policy Trust Boundary Ready | — | — | — |
| ↳ **6.1** ProjectRegistry aliases/environments/workspaces/worktrees and canonical project identity | **NOT STARTED** | 5.CP, 4.1 | PLAN §8; RP §6; DS §6 | — | — | — |
| ↳ **6.2** Full Windows canonical path/security backend: traversal, reparse/junction/symlink, UNC/drive/root/case identity | **NOT STARTED** | 6.1, 1.10 | PLAN §8; PP §13; SEC §16; CS §16 | — | — | — |
| ↳ **6.3** Execution-scope resolution/membership: PROJECT_WORKSPACE vs INTEGRATION/SYSTEM/GLOBAL with no fake filesystem authority | **NOT STARTED** | 6.1, 6.2, 4.4 | PLAN §8; IC §10; DS §12; PS §11 | — | — | — |
| ↳ **6.4** Project registration/open workflow, AGENTS.md candidate discovery without automatic trust, and PROJECT_POLICY_DECISION_REQUIRED before consequential mutation when undecided | **NOT STARTED** | 6.1, 6.2 | PPT §§3,5; RP §6 | — | — | — |
| ↳ **6.5** Canonical project-policy identity: project/path/scope/content hash + Git provenance | **NOT STARTED** | 6.4 | PPT §§3–4 | — | — | — |
| ↳ **6.6** Authenticated project-policy review/enroll/disable/revoke workflow and durable trust records | **NOT STARTED** | 6.5, 5.1, 4.10 | PLAN §8; PPT §§4–6,13 | — | — | — |
| ↳ **6.7** Policy hash/path/project/branch/worktree change detection → CHANGED_REVIEW_REQUIRED | **NOT STARTED** | 6.6 | PPT §§7–8,11 | — | — | — |
| ↳ **6.8** Nested policy separate enrollment, subtree applicability, precedence, and conflict-safe blocking | **NOT STARTED** | 6.6, 6.7 | PPT §10 | — | — | — |
| ↳ **6.9** Contextually HIGH trusted-policy mutation; worker/file write cannot auto-trust resulting content | **NOT STARTED** | 6.6, 5.8, 5.12 | PPT §9; SEC §10 | — | — | — |
| ↳ **6.10** Immutable applicable policy snapshots per attempt plus new-attempt/RESUMING/consequential revalidation hooks | **NOT STARTED** | 6.6–6.9, 4.8 | PPT §§7,13; PLAN §8 | — | — | — |
| ↳ **6.11** ContextManager authority/source labeling, minimal context packaging, and untrusted-repository separation | **NOT STARTED** | 5.6, 6.6 | PLAN §8; SEC §11; PPT §12 | — | — | — |
| ↳ **6.12** MemoryService scope/confidence/revisions/DataPolicy/ranked retrieval/live-state dominance | **NOT STARTED** | 4.15, 6.11 | PLAN §8; DS §20; OPS §13 | — | — | — |
| ↳ **6.13** Conversation/history separation, retention semantics, and LOCAL_ONLY inheritance | **NOT STARTED** | 6.12, 4.15 | DS §20; SEC §8 | — | — | — |
| ↳ **6.14** Project/policy/context/memory UI and authoritative policy-path/hash/revision diagnostics | **NOT STARTED** | 6.6–6.13, 1.13 | PPT §14; UI §§8,15,25 | — | — | — |
| ↳ **6.15** Project/path/policy/memory adversarial and conformance suite | **NOT STARTED** | 6.2–6.14 | PLAN §8 Exit; PPT §15; VR §§8,16,24 | — | — | — |
| ↳ **6.CP** SECTION CHECKPOINT — exact scopes, canonical paths, memory/context, and project-policy trust boundary | **NOT STARTED** | 6.1–6.15 | PLAN §8 Exit; PLAN §26 checkpoint | — | — | — |

### SECTION 7 — Codex Windows Provider Setup / Sandbox Qualification

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 7 — Codex Windows Provider Setup / Sandbox Qualification** | **NOT STARTED** | 6.CP | `Phase 7`; checkpoint: Codex Windows Setup/Provider/Sandbox Ready | — | — | — |
| ↳ **7.1** Provider Registry/Router/Supervisor/SetupCoordinator common states plus lifecycle/capability interfaces supporting qualified one-shot, warm, persistent, streaming, resumable and local-server adapters | **NOT STARTED** | 6.CP, 4.9 | PLAN §9; RT §§14–16; PS §19; CS §20 | — | — | — |
| ↳ **7.2** Codex Windows distribution/executable/helper identity discovery and release compatibility policy | **NOT STARTED** | 7.1 | PLAN §9; RP §5; SEC §23 | — | — | — |
| ↳ **7.3** Stable structured/non-interactive Codex adapter, bounded output validation, normalized errors/events | **NOT STARTED** | 7.2, 5.6 | PLAN §9; IC §17; RP §5; CS §20 | — | — | — |
| ↳ **7.4** Provider setup/repair state machine and explicit user-visible SetupCoordinator workflow | **NOT STARTED** | 7.2, 4.9 | PLAN §9; RT §15; DS §22 | — | — | — |
| ↳ **7.5** Qualified setup-helper identity validation and bounded UAC through PlatformPrivilegeMediator | **NOT STARTED** | 7.4, 2.6 | PLAN §9; IC §12; SEC §22; VR §17 | — | — | — |
| ↳ **7.6** Setup readiness/conformance probe, cancel/failure/repair semantics, version-update invalidation | **NOT STARTED** | 7.5 | PLAN §9; RT §15; DS §22; VR §17 | — | — | — |
| ↳ **7.7** Authenticated text ConversationService input→context→orchestrator structured-decision pipeline with bounded repair/reformat and no authority bypass | **NOT STARTED** | 7.3, 6.11, 5.6–5.9 | IC §§4,13,17; RT §11; SEC §12; RP §5 | — | — | — |
| ↳ **7.8** GENERALIST/orchestrator plus verifier/synthesis provider profiles and capability/locality routing | **NOT STARTED** | 7.7 | PLAN §9; RP §5; IC §17 | — | — | — |
| ↳ **7.9** WORKSPACE_ENGINEERING profile: exact worktree, controlled env, no unrelated secrets, network denied by default | **NOT STARTED** | 7.3, 6.3, 6.10 | PLAN §9; RT §13; SEC §21 | — | — | — |
| ↳ **7.10** Real Codex sandbox conformance: writes, network, honest read-access claim, ordinary-worker non-elevation | **NOT STARTED** | 7.6, 7.9 | PLAN §9 Mandatory proof; SEC §§21–23; VR §17 | — | — | — |
| ↳ **7.11** Provider process containment, cancellation/timeouts/circuit breaker/crash/restart behavior | **NOT STARTED** | 7.3, 2.4–2.5 | PLAN §9; RT §§14,23; VR §§17,19 | — | — | — |
| ↳ **7.12** Provider fallback/routing that cannot weaken setup/locality/permission/budget/platform support | **NOT STARTED** | 7.8, 7.11 | IC §17; SEC §23; RT §14 | — | — | — |
| ↳ **7.13** Provider quota/usage provenance and support/qualification evidence references | **NOT STARTED** | 7.8, 4.7 | PLAN §9; DS §23; PS §22 | — | — | — |
| ↳ **7.14** Optional provider resume reference plus fresh-session reconstruction from JARVIS-owned state | **NOT STARTED** | 7.11, 4.8 | RT §16; DS §17 | — | — | — |
| ↳ **7.15** Immutable trusted project-policy snapshot injection as scoped context; raw candidates remain untrusted | **NOT STARTED** | 7.9, 6.10–6.11 | PLAN §9; PPT §§7,12 | — | — | — |
| ↳ **7.16** Provider setup/support/health/capability UI and diagnostics distinctions | **NOT STARTED** | 7.4–7.13, 1.13 | OPS §14; UI §§15,25 | — | — | — |
| ↳ **7.17** Windows Codex support tuple and full provider/setup/sandbox/structured-output negative conformance record | **NOT STARTED** | 7.1–7.16 | PLAN §9 Exit; RP §5; VR §17 | — | — | — |
| ↳ **7.CP** SECTION CHECKPOINT — Codex Windows setup/provider/sandbox production support | **NOT STARTED** | 7.1–7.17 | PLAN §9 Exit; PLAN §26 checkpoint; VR §17 | — | — | — |

### SECTION 8 — Tool Registry / Safe Local Capabilities

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 8 — Tool Registry / Safe Local Capabilities** | **NOT STARTED** | 7.CP | `Phase 8`; checkpoint: Tool Runtime Ready | — | — | — |
| ↳ **8.1** ToolManifest/schema registry and ToolExecutor owned execution pipeline | **NOT STARTED** | 7.CP, 5.CP | PLAN §10; RT §18; PS §16; CS §21 | — | — | — |
| ↳ **8.2** Canonical target resolver and shared precondition/postcondition verification contract | **NOT STARTED** | 8.1, 6.2–6.3 | PLAN §10; IC §14; SEC §§16,18 | — | — | — |
| ↳ **8.3** Permission/authority/locality/budget/resource/platform-capability admission hooks; hard monetary/resource policies activate only when their owning Section-11 services apply | **NOT STARTED** | 8.1, 5.8–5.12 | PLAN §10; RT §18 | — | — | — |
| ↳ **8.4** Idempotency, conditional mutation/CAS, conflict re-resolution, and UNCERTAIN semantics | **NOT STARTED** | 8.2, 8.3 | PLAN §10; IC §14; SEC §18; CS §19 | — | — | — |
| ↳ **8.5** Tool cancellation, stable errors, postcondition truth, audit/domain events, secret-safe diagnostics | **NOT STARTED** | 8.1–8.4, 4.12 | PLAN §10; CS §§10–12,21; VR §18 | — | — | — |
| ↳ **8.6** Typed project/system status tool | **NOT STARTED** | 8.1, 8.3 | PLAN §10 first tools | — | — | — |
| ↳ **8.7** Controlled open application/project/file operations through platform boundaries | **NOT STARTED** | 8.1, 6.2 | PLAN §10 first tools; RP §6 | — | — | — |
| ↳ **8.8** Narrow filesystem read/write tools with canonical path identity and expected-state protection | **NOT STARTED** | 8.2–8.5, 6.2 | PLAN §10; RP §6; CS §16 | — | — | — |
| ↳ **8.9** Approved project test/build execution under PlatformProcessSupervisor and workspace scope | **NOT STARTED** | 8.3–8.5, 2.4 | PLAN §10; RP §6 | — | — | — |
| ↳ **8.10** Local Git status/branch/diff/log read tooling foundation through platform process/path boundaries | **NOT STARTED** | 8.1–8.5, 6.1 | PLAN §10; RP §6 | — | — | — |
| ↳ **8.11** Tool/schema/path/TOCTOU/idempotency/cancellation/postcondition/adversarial conformance suite | **NOT STARTED** | 8.1–8.10 | PLAN §10 Exit; VR §18 | — | — | — |
| ↳ **8.CP** SECTION CHECKPOINT — safe typed local tool runtime | **NOT STARTED** | 8.1–8.11 | PLAN §10 Exit; PLAN §26 checkpoint | — | — | — |

### SECTION 9 — Bounded Workers

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 9 — Bounded Workers** | **NOT STARTED** | 8.CP | `Phase 9`; checkpoint: Worker Runtime Ready | — | — | — |
| ↳ **9.1** Worker roles, attempts, platform identity, and owning WorkerManager lifecycle | **NOT STARTED** | 8.CP, 4.3, 7.CP | PLAN §11; RT §17; PS §13 | — | — | — |
| ↳ **9.2** Worker launch packet: exact scope/authority/DataPolicy/provider/tools/policy/resources/budget/acceptance | **NOT STARTED** | 9.1, 5.7, 6.10 | IC §11; RT §13 | — | — | — |
| ↳ **9.3** Isolated engineering worktrees, workspace leases, and parallel-writer exclusion | **NOT STARTED** | 9.2, 6.1, 4.8 | PLAN §11; RT §19 | — | — | — |
| ↳ **9.4** Bounded iteration/time/resource ceilings plus pre-Phase11 budget-envelope ceilings and no-material-progress detection; no hard-money BudgetService support claim before Section 11 | **NOT STARTED** | 9.1, 7.13 | PLAN §11; RT §17; SEC §30 | — | — | — |
| ↳ **9.5** Worker journals/checkpoints/artifacts/events with no private chain-of-thought | **NOT STARTED** | 9.1, 4.8, 4.12 | PLAN §11; DS §§16–17; OPS §4 | — | — | — |
| ↳ **9.6** Pause/cancel/checkpoint safe-boundary primitives and process termination integration | **NOT STARTED** | 9.3–9.5, 2.5 | PLAN §11; RT §§20,23 | — | — | — |
| ↳ **9.7** Structured completion/replan/block/failure results and acceptance-evidence proposal path | **NOT STARTED** | 9.5 | PLAN §11; PS §15; VR §§3,5 | — | — | — |
| ↳ **9.8** Provider resume as optional optimization; fresh-worker reconstruction from durable checkpoint/artifacts | **NOT STARTED** | 9.5, 7.13 | RT §16; DS §17 | — | — | — |
| ↳ **9.9** Project-policy snapshot enforcement and prevention of worker self-enrollment/trust widening | **NOT STARTED** | 9.2, 6.10 | PLAN §11; PPT §§7,9 | — | — | — |
| ↳ **9.10** Mission Control worker/work/queue/activity surfaces driven only by authoritative state | **NOT STARTED** | 9.5–9.7, 1.13 | PLAN §11; OPS §§3–4; UI §13 | — | — | — |
| ↳ **9.11** Worker crash, containment, no-progress, isolation, authority, checkpoint/recovery negative suite | **NOT STARTED** | 9.1–9.10 | PLAN §11 Exit; VR §§19,27 | — | — | — |
| ↳ **9.CP** SECTION CHECKPOINT — bounded recoverable worker runtime | **NOT STARTED** | 9.1–9.11 | PLAN §11 Exit; PLAN §26 checkpoint; VR §§19,27 | — | — | — |

### SECTION 10 — Mission Graph

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 10 — Mission Graph** | **NOT STARTED** | 9.CP | `Phase 10`; checkpoint: Mission Runtime Ready | — | — | — |
| ↳ **10.1** MissionManager/GraphPlanner ownership and mission lifecycle integration | **NOT STARTED** | 9.CP, 4.3 | PLAN §12; RT §19 | — | — | — |
| ↳ **10.2** Immutable graph versions, real dependency types, acyclicity and scope/data/authority validation | **NOT STARTED** | 10.1, 4.5 | PLAN §12; DS §15; PS §14 | — | — | — |
| ↳ **10.3** Task and mission acceptance policies with deterministic evidence-backed completion | **NOT STARTED** | 10.2, 9.7 | PLAN §12; VR §§3–5 | — | — | — |
| ↳ **10.4** Validated dynamic replan with historical graph revisions and no worker direct mutation | **NOT STARTED** | 10.2–10.3 | PLAN §12; IC §16 | — | — | — |
| ↳ **10.5** Fan-out/reduce/verify/synthesize orchestration with bounded worker ownership | **NOT STARTED** | 10.3, 9.CP | PLAN §12 | — | — | — |
| ↳ **10.6** Artifact reuse/invalidation and prevention of stale/invalid output feeding active graph | **NOT STARTED** | 10.4, 4.8 | PLAN §12; DS §15 | — | — | — |
| ↳ **10.7** Deterministic dependency/lease/provider-readiness scheduler foundation and fair queueing | **NOT STARTED** | 10.2, 9.3, 7.CP | PLAN §12; RT §19 | — | — | — |
| ↳ **10.8** Queue transparency and truthful blocked/unknown/no-fabricated-progress/ETA semantics | **NOT STARTED** | 10.7 | PLAN §12; OPS §§2–5; UI §13 | — | — | — |
| ↳ **10.9** Mission/graph/verification Mission Control UX | **NOT STARTED** | 10.3–10.8, 1.13 | PLAN §12; UI §§8,13 | — | — | — |
| ↳ **10.10** Graph property/concurrency/replan/acceptance/recovery integration tests | **NOT STARTED** | 10.1–10.9 | PLAN §12 Exit; VR §8 | — | — | — |
| ↳ **10.CP** SECTION CHECKPOINT — mission graph/runtime acceptance and scheduling foundation | **NOT STARTED** | 10.1–10.10 | PLAN §12 Exit; PLAN §26 checkpoint; VR §8 | — | — | — |

### SECTION 11 — Resources / Budgets / Recovery

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 11 — Resources / Budgets / Recovery** | **NOT STARTED** | 10.CP | `Phase 11`; checkpoint: Phase 11 Resource / Budget / Recovery Exit | — | — | — |
| ↳ **11.1** Platform/provider CPU/RAM/GPU/resource observation and normalized availability diagnostics | **NOT STARTED** | 10.CP, 0.4 | PLAN §13; RT §19; PP §26 | — | — | — |
| ↳ **11.2** Resource-aware scheduler concurrency/fairness/foreground UI+voice responsiveness policy | **NOT STARTED** | 11.1, 10.7 | PLAN §13; RT §19; OPS §§5,14,21 | — | — | — |
| ↳ **11.3** Priority/preemption policies, bounded temporarily-non-preemptible work, safe-point interruption | **NOT STARTED** | 11.2, 9.6 | PLAN §13; RT §20; OPS §6 | — | — | — |
| ↳ **11.4** Durable workspace/resource leases, heartbeat/ownership proof, safe dead-owner reclaim | **NOT STARTED** | 9.3, 4.8 | PLAN §13; DS §19 | — | — | — |
| ↳ **11.5** Exact BudgetService hard admission, atomic reservations, settlement/release/expiry/UNCERTAIN | **NOT STARTED** | 4.7, 4.13 | PLAN §13; RT §21; DS §24; VR §23 | — | — | — |
| ↳ **11.6** Provider quota snapshots/provenance, unknown truth, currency mismatch/no implicit FX | **NOT STARTED** | 7.13, 11.5 | RT §21; DS §23; PS §22 | — | — | — |
| ↳ **11.7** Durable PAUSED→RESUMING revalidation of live state/scope/target/provider/locality/platform/budget/approval/leases/policy | **NOT STARTED** | 11.3–11.6, 6.10 | PLAN §13; RT §20; DS §10; VR §28 | — | — | — |
| ↳ **11.8** Startup transient-state recovery scan and RECOVERING ownership | **NOT STARTED** | 11.7, 4.3 | PLAN §13; RT §22 | — | — | — |
| ↳ **11.9** External UNCERTAIN reconciliation, live-state verification, and no blind replay of ambiguous effects | **NOT STARTED** | 11.8, 8.4 | PLAN §13; RT §22; SEC §32 | — | — | — |
| ↳ **11.10** Provider failure/fallback/restart recovery with setup/compatibility/locality revalidation | **NOT STARTED** | 11.8, 7.12 | PLAN §13; RT §§14,16,22 | — | — | — |
| ↳ **11.11** Policy/approval/lease/budget/external-precondition revalidation during recovery/resume | **NOT STARTED** | 11.7–11.10 | PLAN §13; RT §22 | — | — | — |
| ↳ **11.12** Queue/block/resuming/recovering/resource/budget/provider/policy-unavailable Mission Control states | **NOT STARTED** | 11.2–11.11, 1.13 | PLAN §13; OPS §§3,6–7,18; UI §§13,17,25 | — | — | — |
| ↳ **11.13** Crash/kill/recovery/preemption/lease/budget-race/resource-pressure fault-injection suite | **NOT STARTED** | 11.1–11.12 | PLAN §13 Exit; VR §§23,27–28,31 | — | — | — |
| ↳ **11.CP** SECTION CHECKPOINT — resource scheduling, exact budgets, safe resume and crash recovery | **NOT STARTED** | 11.1–11.13 | PLAN §13 Exit; VR §§20,23,27–28,31 | — | — | — |

### SECTION 12 — Credentials / Modules / Supply-Chain Trust Foundation

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 12 — Credentials / Modules / Supply-Chain Trust Foundation** | **NOT STARTED** | 11.CP | `Phase 12`; checkpoint: Supply-Chain/Module Trust Foundation Ready | — | — | — |
| ↳ **12.1** Integration account registry, capability metadata, and opaque credential-handle model | **NOT STARTED** | 11.CP, 5.4, 4.9 | PLAN §14; SEC §24; DS §25; PS §21 | — | — | — |
| ↳ **12.2** Module Registry support-state separation, execution classes, manifests, platform/runtime compatibility | **NOT STARTED** | 12.1, 4.9 | PLAN §14; IC §22; RP §10; PS §20 | — | — | — |
| ↳ **12.3** DATA_ONLY non-execution and BUILT_IN_TRUSTED release-owned execution boundaries | **NOT STARTED** | 12.2 | CS §24; SEC §26 | — | — | — |
| ↳ **12.4** EXTERNAL_MANAGED typed IPC/capability envelope/process containment/health/crash isolation | **NOT STARTED** | 12.2, 2.4–2.5 | PLAN §14; IC §22; RT §25; SEC §26 | — | — | — |
| ↳ **12.5** Immutable module versions, verified staging (never execute unverified download path), activation, pinning, retained rollback and failure-safe lifecycle; active tasks are never silently switched underneath outside a qualified safe boundary | **NOT STARTED** | 12.2–12.4 | PLAN §14; OPS §§15–16 | — | — | — |
| ↳ **12.6** Audited TUF 1.0.35 implementation/library integration and authenticated bootstrap root | **NOT STARTED** | 12.2, 4.11 | PLAN §14; SCT §§2–4 | — | — | — |
| ↳ **12.7** Distinct Ed25519 root/targets/snapshot/timestamp/module-role key profiles and custody tooling/records | **NOT STARTED** | 12.6 | SCT §§3–6,16 | — | — | — |
| ↳ **12.8** Threshold enforcement: root 2-of-3, targets 2-of-3, modules 2-of-3; offline install-authorizing key separation from ordinary runtime, developer workstations, update servers, and general CI | **NOT STARTED** | 12.7 | PLAN §14; SCT §§4–6,17 | — | — | — |
| ↳ **12.9** Consistent snapshots, role metadata versions/expiry, freeze/rollback/mix-and-match and clock-rollback diagnostics, plus narrowly scoped timestamp automation using only the online timestamp key | **NOT STARTED** | 12.6, 12.8 | SCT §§2,8–9,17 | — | — | — |
| ↳ **12.10** Sequential root rotation/revocation including expired-root-only sequential-update semantics, and honest full-root-threshold-compromise recovery boundary | **NOT STARTED** | 12.8–12.9 | SCT §7; SEC §32 | — | — | — |
| ↳ **12.11** Dedicated modules delegation path scoping and catalog authorization separate from application targets | **NOT STARTED** | 12.8–12.10 | SCT §6 | — | — | — |
| ↳ **12.12** Target length/hash/platform/profile/catalog-sequence/revocation/module anti-rollback admission; publisher/self-signature alone never confers `SUPPORTED` | **NOT STARTED** | 12.9, 12.11 | SCT §§6,9,11,13 | — | — | — |
| ↳ **12.13** Crash-safe durable trusted-metadata state that survives ordinary cache cleanup | **NOT STARTED** | 12.9, 4.11 | SCT §14 | — | — | — |
| ↳ **12.14** Module/support/trust lifecycle Mission Control states and trust incident diagnostics | **NOT STARTED** | 12.2–12.13, 1.13 | OPS §§15–17; SCT §15; UI §15 | — | — | — |
| ↳ **12.15** TUF/module negative conformance: threshold, expiry, rotation, revocation, delegation, rollback/freeze/mix-match, cache/crash | **NOT STARTED** | 12.6–12.14 | PLAN §14 Exit; SCT §17; VR §26 | — | — | — |
| ↳ **12.CP** SECTION CHECKPOINT — credential/module/TUF catalog trust foundation | **NOT STARTED** | 12.1–12.15 | PLAN §14 Exit; PLAN §26 checkpoint | — | — | — |

### SECTION 13 — Local Git / GitHub Production Integration

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 13 — Local Git / GitHub Production Integration** | **NOT STARTED** | 12.CP | `Phase 13`; checkpoint: GitHub Capability Matrix Ready | — | — | — |
| ↳ **13.1** Production Windows local filesystem/Git adapter through canonical platform path/process boundaries | **NOT STARTED** | 12.CP, 8.CP | PLAN §15; RP §9; VR §24 | — | — | — |
| ↳ **13.2** Repository/ref/worktree identity and local Git consequential-write expected-ref protections | **NOT STARTED** | 13.1, 6.2 | PLAN §15; CS §22; VR §24 | — | — | — |
| ↳ **13.3** GitHub account authentication-flow selection/implementation, least-privilege credential scopes, and exact release capability support matrix; the chosen auth method must be explicitly qualified and must not create privileged Core ingress | **NOT STARTED** | 12.1, 5.4 | PLAN §15; RP §9.1; SEC §24; OPS §17 | — | — | — |
| ↳ **13.4** Typed GitHub transport: canonical repo/account identity, schema/errors, auth expiry, rate limit, retry/UNCERTAIN | **NOT STARTED** | 13.3, 8.4–8.5 | PLAN §15; CS §22 | — | — | — |
| ↳ **13.5** GITHUB_REPOSITORY_READ | **NOT STARTED** | 13.4 | RP §9.1; VR §24 | — | — | — |
| ↳ **13.6** GITHUB_REF_READ | **NOT STARTED** | 13.5 | RP §9.1; VR §24 | — | — | — |
| ↳ **13.7** GITHUB_REF_WRITE with exact expected-old-ref/create-update race protection | **NOT STARTED** | 13.6 | RP §9.1; CS §22; VR §24 | — | — | — |
| ↳ **13.8** GITHUB_PULL_REQUEST_READ | **NOT STARTED** | 13.5 | RP §9.1; VR §24 | — | — | — |
| ↳ **13.9** GITHUB_PULL_REQUEST_WRITE | **NOT STARTED** | 13.8 | RP §9.1; VR §24 | — | — | — |
| ↳ **13.10** GITHUB_ISSUE_READ | **NOT STARTED** | 13.5 | RP §9.1; VR §24 | — | — | — |
| ↳ **13.11** GITHUB_COMMENT_WRITE | **NOT STARTED** | 13.8, 13.10 | RP §9.1; VR §24 | — | — | — |
| ↳ **13.12** GITHUB_CHECKS_READ | **NOT STARTED** | 13.5 | RP §9.1; VR §24 | — | — | — |
| ↳ **13.13** GITHUB_ACTIONS_READ | **NOT STARTED** | 13.5 | RP §9.1; VR §24 | — | — | — |
| ↳ **13.14** Optional GITHUB_ACTIONS_DISPATCH — only if enabled and independently qualified | **DEFERRED** | 13.13 | RP §9.1; VR §24 | — | Contract-permitted optional base-V1 capability | Must not affect base-V1 completion unless release enables it |
| ↳ **13.15** Explicit rejection of repository/admin/secrets/protection/member/delete/ref-delete authority | **NOT STARTED** | 13.3–13.13 | RP §9.1; CS §22; SEC §24; VR §24 | — | — | — |
| ↳ **13.16** GitHub support/capability/account/health/approval Mission Control UX | **NOT STARTED** | 13.3–13.13, 13.15; +13.14 if enabled | PLAN §15; OPS §17; UI §15 | — | — | — |
| ↳ **13.17** Full Git/GitHub success/failure/auth/rate/race/idempotency/recovery/secret/audit conformance | **NOT STARTED** | 13.1–13.13, 13.15–13.16; +13.14 if enabled | PLAN §15 Exit; VR §24 | — | — | — |
| ↳ **13.CP** SECTION CHECKPOINT — every mandatory GitHub capability SUPPORTED on Windows V1 with exact boundaries | **NOT STARTED** | 13.1–13.13, 13.15–13.17; +13.14 if enabled | PLAN §15 Exit; PLAN §26 checkpoint; RP §9.1 | — | — | — |

### SECTION 14 — Proxmox VE V1

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 14 — Proxmox VE V1** | **NOT STARTED** | 13.CP | `Phase 14`; checkpoint: Proxmox Capability Matrix Ready | — | — | — |
| ↳ **14.1** Proxmox connection registry/wizard, read-only onboarding, scoped identity/token workflow | **NOT STARTED** | 13.CP, 12.1 | PLAN §16; RP §9.2; SEC §25 | — | — | — |
| ↳ **14.2** TLS system-CA/pinned-SHA256 trust and stable connection/environment/resource identity | **NOT STARTED** | 14.1 | RP §9.2; PS §21; SEC §25 | — | — | — |
| ↳ **14.3** Cluster/node/QEMU/LXC discovery and node/VMID/pool scope enforcement | **NOT STARTED** | 14.2 | PLAN §16; RP §9.2 | — | — | — |
| ↳ **14.4** Typed HTTPS API transport, request validation, async task tracking, live postconditions, no raw API surface | **NOT STARTED** | 14.3, 8.4–8.5 | PLAN §16; RT §24; CS §23 | — | — | — |
| ↳ **14.5** PROXMOX_READ | **NOT STARTED** | 14.4 | RP §9.2; PLAN §16; VR §25 | — | — | — |
| ↳ **14.6** PROXMOX_POWER_CONTROL | **NOT STARTED** | 14.5 | RP §9.2; PLAN §16; VR §25 | — | — | — |
| ↳ **14.7** PROXMOX_SNAPSHOT | **NOT STARTED** | 14.5 | RP §9.2; PLAN §16; VR §25 | — | — | — |
| ↳ **14.8** PROXMOX_BACKUP with configured-target semantics, not direct PBS administration | **NOT STARTED** | 14.5 | RP §9.2; PLAN §16; VR §25 | — | — | — |
| ↳ **14.9** PROXMOX_GUEST_CONFIG with guest-level-only semantics | **NOT STARTED** | 14.5 | RP §9.2; PLAN §16; VR §25 | — | — | — |
| ↳ **14.10** PROXMOX_GUEST_CREATE with allowed existing-storage allocation semantics | **NOT STARTED** | 14.5 | RP §9.2; PLAN §16; VR §25 | — | — | — |
| ↳ **14.11** PROXMOX_MIGRATE | **NOT STARTED** | 14.5 | RP §9.2; PLAN §16; VR §25 | — | — | — |
| ↳ **14.12** PROXMOX_DESTROY with fresh destructive final confirmation | **NOT STARTED** | 14.5 | RP §9.2; PLAN §16; VR §25 | — | — | — |
| ↳ **14.13** Optional PROXMOX_STORAGE_WRITE — absent/disabled unless separately fully qualified | **DEFERRED** | 14.5 | RP §9.2; VR §25 | — | Optional/non-blocking for base V1 | If enabled, requires full positive/negative/risk qualification and signed support listing |
| ↳ **14.14** Optional PROXMOX_NETWORK_WRITE — absent/disabled unless separately fully qualified | **DEFERRED** | 14.5 | RP §9.2; VR §25 | — | Optional/non-blocking for base V1 | If enabled, requires full positive/negative/risk qualification and signed support listing |
| ↳ **14.15** No SSH/qm/pct/pvesh/root/direct-/etc/pve fallback; guest-shell and PBS authority separation | **NOT STARTED** | 14.4–14.12 | IC §23; SEC §25; CS §23 | — | — | — |
| ↳ **14.16** Proxmox capability/health/scope/approval Mission Control UX | **NOT STARTED** | 14.1–14.12, 14.15; +14.13/14.14 if enabled | PLAN §16; UI §15 | — | — | — |
| ↳ **14.17** Full Proxmox scope/denial/postcondition/UNCERTAIN/destructive/recovery/revocation conformance | **NOT STARTED** | 14.1–14.12, 14.15–14.16; +14.13/14.14 if enabled | PLAN §16 Exit; VR §25 | — | — | — |
| ↳ **14.CP** SECTION CHECKPOINT — all mandatory Proxmox capabilities qualified; optional writes absent or separately qualified | **NOT STARTED** | 14.1–14.12, 14.15–14.17; +14.13/14.14 if enabled | PLAN §16 Exit; PLAN §26 checkpoint; RP §9.2 | — | — | — |

### SECTION 15 — Voice Foundation

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 15 — Voice Foundation** | **NOT STARTED** | 14.CP | `Phase 15`; checkpoint: Voice Foundation Exit | — | — | — |
| ↳ **15.1** Revalidate Phase-3A candidate versions, licensing, packaging, privacy, and production dependency choices | **NOT STARTED** | 14.CP, 3A.CP | PLAN §17; RP §11 | — | — | — |
| ↳ **15.2** PlatformAudioBackend Windows device manager and microphone/speaker lifecycle | **NOT STARTED** | 15.1, 0.4 | PLAN §17; PP §22; RP §11 | — | — | — |
| ↳ **15.3** Push-to-talk and deterministic local reflex controls integrated with locked session | **NOT STARTED** | 15.2, 5.3 | PLAN §17; RT §12; OPS §20 | — | — | — |
| ↳ **15.4** Production local STT adapter with streaming partial/final/cancel and DataLocality | **NOT STARTED** | 15.2, 15.3 | PLAN §17; RP §11; RT §26 | — | — | — |
| ↳ **15.5** Production VAD adapter and typed speech-boundary states | **NOT STARTED** | 15.4 | PLAN §17; RP §11 | — | — | — |
| ↳ **15.6** Production local TTS provider with persistent JARVIS voice identity and interruption support | **NOT STARTED** | 15.2, 15.3 | PLAN §17; RP §11; OPS §19 | — | — | — |
| ↳ **15.7** Typed transcript/voice state and stale/cancelled/locked transcript submission prevention | **NOT STARTED** | 15.4–15.6, 4.3 | PLAN §17; RT §26; UI §16 | — | — | — |
| ↳ **15.8** Local voice latency instrumentation separated from remote reasoning latency | **NOT STARTED** | 15.4–15.7 | PLAN §17; OPS §22; VR §30 | — | — | — |
| ↳ **15.9** Device removal/reconnect, STT/TTS failure, text fallback, privacy and degraded-state behavior | **NOT STARTED** | 15.2–15.8 | PLAN §17 Exit; UI §25; OPS §19 | — | — | — |
| ↳ **15.10** Mission Control voice-state components using canonical identity and continuity with text context | **NOT STARTED** | 15.7–15.9, 1.12 | PLAN §17; UI §16 | — | — | — |
| ↳ **15.11** Packaged/offline speech models/runtime/assets license/provenance closure | **NOT STARTED** | 15.4–15.6 | PLAN §17; CS §29 | — | — | — |
| ↳ **15.12** Real-device production voice-foundation tests and comparison to Phase-3A assumptions | **NOT STARTED** | 15.1–15.11 | PLAN §17 Exit; VR §30 | — | — | — |
| ↳ **15.CP** SECTION CHECKPOINT — production voice foundation ready for full-duplex integration | **NOT STARTED** | 15.1–15.12 | PLAN §17 Exit | — | — | — |

### SECTION 16 — Full-Duplex Voice

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 16 — Full-Duplex Voice** | **NOT STARTED** | 15.CP | `Phase 16`; checkpoint: Voice Runtime Ready | — | — | — |
| ↳ **16.1** Production AEC provider with exact TTS render reference | **NOT STARTED** | 15.CP | PLAN §18; RP §11; RT §26 | — | — | — |
| ↳ **16.2** Realtime Conversation Engine and physical/semantic turn detector | **NOT STARTED** | 16.1, 15.7 | PLAN §18; RT §26 | — | — | — |
| ↳ **16.3** Double-talk/barge-in and interruptible speech behavior | **NOT STARTED** | 16.1–16.2 | PLAN §18; RP §11 | — | — | — |
| ↳ **16.4** Deterministic stop/mute/cancel reflex path and stale-transcript suppression under full duplex | **NOT STARTED** | 16.2–16.3, 15.3 | PLAN §18; RT §§12,26; VR §30 | — | — | — |
| ↳ **16.5** AEC/device failure safe half-duplex degradation without losing stop/privacy controls | **NOT STARTED** | 16.1–16.4 | PLAN §18; RP §11 | — | — | — |
| ↳ **16.6** Voice approval maps to exactly one pending approval in unlocked session; UI confirmation remains available | **NOT STARTED** | 16.2, 5.14 | OPS §23; VR §30 | — | — | — |
| ↳ **16.7** Real-device AEC/barge-in/latency/privacy/resource-pressure qualification | **NOT STARTED** | 16.1–16.6, 11.2 | PLAN §18 Exit; VR §§30–31 | — | — | — |
| ↳ **16.CP** SECTION CHECKPOINT — Voice Runtime Ready | **NOT STARTED** | 16.1–16.7 | PLAN §18 Exit; PLAN §26 checkpoint | — | — | — |

### SECTION 17 — Event / Automation / Notification

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 17 — Event / Automation / Notification** | **NOT STARTED** | 16.CP | `Phase 17`; checkpoint: Phase 17 Event / Automation / Notification Exit | — | — | — |
| ↳ **17.1** Normalized Event Gateway schemas, source authentication/signature validation, and event provenance | **NOT STARTED** | 16.CP, 12.CP, 4.12 | PLAN §19; IC §24; OPS §9 | — | — | — |
| ↳ **17.2** Durable replay/dedup horizon and restart-safe duplicate consequence prevention | **NOT STARTED** | 17.1, 4.12 | PLAN §19; DS §18 | — | — | — |
| ↳ **17.3** Event disposition policy: ignore/record/notify/create-tracked-work/approved-automation | **NOT STARTED** | 17.1–17.2 | OPS §9 | — | — | — |
| ↳ **17.4** Scheduled/poll/local triggers with bounded backoff/quota/rate behavior | **NOT STARTED** | 17.3, 11.6 | PLAN §19; OPS §9 | — | — | — |
| ↳ **17.5** Automation authority envelopes/scopes integrated with PermissionEngine, DataPolicy, budgets and resources | **NOT STARTED** | 17.3–17.4, 5.7–5.9, 11.5 | PLAN §19; SEC §29 | — | — | — |
| ↳ **17.6** Trigger-storm controls, idempotent work creation, recovery and external-event UNCERTAIN semantics | **NOT STARTED** | 17.2–17.5 | PLAN §19; SEC §30; VR §29 | — | — | — |
| ↳ **17.7** NotificationPolicyEngine severity/channels/grouping/defer and locked-session privacy | **NOT STARTED** | 17.3, 5.3 | PLAN §19; OPS §10; PS §24 | — | — | — |
| ↳ **17.8** Focus modes NORMAL/WORK_FOCUS/DO_NOT_DISTURB/CRITICAL_ONLY and deterministic escalation | **NOT STARTED** | 17.7 | OPS §10; UI §9 | — | — | — |
| ↳ **17.9** PlatformNotificationBackend Windows native delivery integration | **NOT STARTED** | 17.7, 0.4 | PLAN §19; PP §26 | — | — | — |
| ↳ **17.10** Mission Control automation/notification/focus UX with authoritative queue states | **NOT STARTED** | 17.3–17.9, 1.13 | PLAN §19; OPS §§3,9–10 | — | — | — |
| ↳ **17.11** No privileged public/LAN Core ingress; event-auth/dedup/scope/privacy/storm negative suite | **NOT STARTED** | 17.1–17.10 | PLAN §19 Exit; IC §24; SEC §29; VR §29 | — | — | — |
| ↳ **17.CP** SECTION CHECKPOINT — secure deduplicated event/automation/notification runtime | **NOT STARTED** | 17.1–17.11 | PLAN §19 Exit | — | — | — |

### SECTION 18 — UI / Operations / Backup / Diagnostics / Update Productization

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 18 — UI / Operations / Backup / Diagnostics / Update Productization** | **NOT STARTED** | 17.CP | `Phase 18`; checkpoint: Operations/UI/TUF Update Ready | — | — | — |
| ↳ **18.1** Complete unified Mission Control across every V1 subsystem with canonical state language, copy/tone and information hierarchy | **NOT STARTED** | 17.CP, 1.13 | PLAN §20; UI §§8,11–17,25; OPS §§2–7 | — | — | — |
| ↳ **18.2** Adaptive compact/medium/wide/ultrawide behavior and high mission/queue/notification count handling | **NOT STARTED** | 18.1 | PLAN §20; UI §§10–13,26 | — | — | — |
| ↳ **18.3** Windows 100/125/150/200% scaling, 200% text, 320 CSS px/400% reflow, multi-monitor recovery | **NOT STARTED** | 18.2, 1.8 | PLAN §20; RP §12; UI §§9–10,20,26 | — | — | — |
| ↳ **18.4** Keyboard/assistive semantics/contrast/targets/focus/forced-colors/reduced-motion production accessibility | **NOT STARTED** | 18.2–18.3 | PLAN §20; RP §12; UI §§18,20,26; VR §11 | — | — | — |
| ↳ **18.5** Canonical Windows PNG/ICO/installer brand-asset generation and font/icon/visual provenance/notices | **NOT STARTED** | 18.3, 1.11 | PLAN §20; UI §§4–5,28; RP §16 | — | — | — |
| ↳ **18.6** Complete startup/shutdown/degraded-mode integration plus cross-subsystem operational truth for queue/recovery/provider/module/integration/budget/policy/trust states | **NOT STARTED** | 18.1, 11.12, 12.14 | PLAN §20; OPS §§2–7,15–18,24 | — | — | — |
| ↳ **18.7** Settings/configuration UX backed by one validated atomic configuration authority; staged import/conflict handling | **NOT STARTED** | 4.14, 18.1 | OPS §§11–12; CS §30 | — | — | — |
| ↳ **18.8** Scheduled/local backup retention and JARVIS_BACKUP_V1 creation/verification operational UX | **NOT STARTED** | 3.CP, 18.1 | PLAN §20; DS §36; BKC §§13–14 | — | — | — |
| ↳ **18.9** Generated recovery-factor copy/export/verification/rotation UX with QR/print where practical; optional passphrase UX only if 3.13 is enabled | **NOT STARTED** | 18.8, 3.11 | PLAN §20; BKC §§7,13 | — | — | — |
| ↳ **18.10** Restore maintenance mode, corruption recovery, known-good backup selection, and state reconciliation UX | **NOT STARTED** | 3.15–3.16, 11.CP, 18.1 | PLAN §20; DS §§31,35; OPS §7 | — | — | — |
| ↳ **18.11** Diagnostics dashboard for WAL/provider/setup/security/platform/policy/TUF/module/integration/voice states | **NOT STARTED** | 18.6, 3.2, 7.16, 12.14 | PLAN §20; OPS §24 | — | — | — |
| ↳ **18.12** Diagnostic/support export category disclosure, privacy defaults, deterministic secret exclusion/redaction | **NOT STARTED** | 18.11 | PLAN §20; OPS §24; SEC §28 | — | — | — |
| ↳ **18.13** Audit/log/artifact/cache retention, bounded-disk behavior, audit-integrity diagnostics, and truthful same-user tamper limitations | **NOT STARTED** | 18.11, 4.12 | OPS §25; SEC §31 | — | — | — |
| ↳ **18.14** PlatformUpdateBackend staged Windows update acquisition/activation boundary | **NOT STARTED** | 12.CP, 0.4 | PLAN §20; PP §20; RT §8 | — | — | — |
| ↳ **18.15** Application TUF metadata processing, root/targets/snapshot/timestamp state, releaseSequence/securityEpoch admission | **NOT STARTED** | 18.14, 12.6–12.13 | PLAN §20; SCT §§8–10,14 | — | — | — |
| ↳ **18.16** Cumulative TUF + Tauri updater signature + Windows Authenticode + compatibility gates, including updater public-key rotation only from trusted bootstrap/TUF-authorized metadata | **NOT STARTED** | 18.15 | PLAN §20; SCT §12; RP §18 | — | — | — |
| ↳ **18.17** Pre-update backup, migration, health verification, binary/schema/runtime/backup rollback pairing | **NOT STARTED** | 18.16, 3.CP, 4.16 | PLAN §20; DS §34; VR §22 | — | — | — |
| ↳ **18.18** Authorized rollback only under current trusted metadata; revoked/old/securityEpoch-incompatible target rejection | **NOT STARTED** | 18.17, 12.10 | PLAN §20; SCT §10; VR §22 | — | — | — |
| ↳ **18.19** Release-manifest generation with complete platform/runtime/toolchain/DB/KDF/backup/policy/provider/integration/module/voice/TUF/signing/SBOM fields | **NOT STARTED** | 18.5, 18.16–18.18 | PLAN §20; RP §16; SCT §16; VR §36 | — | — | — |
| ↳ **18.20** Upgrade/uninstall durable user-state preservation and explicit migration/invalidation/data-retention behavior | **NOT STARTED** | 18.17 | OPS §27; VR §§22,32 | — | — | — |
| ↳ **18.21** Reachable dependency/vulnerability policy, SBOM/license/provenance readiness and RC known-limitations record | **NOT STARTED** | 18.19, 0.11 | OPS §26; SEC §27; VR §36 | — | — | — |
| ↳ **18.CP** SECTION CHECKPOINT — Operations/UI/TUF Update Ready; produce a qualification-ready build candidate and proceed to Section 19 where the exact signed Windows RC artifacts are created/frozen before any final qualification result is accepted | **NOT STARTED** | 18.1–18.21 | PLAN §20 Exit; PLAN §26 checkpoint; UI §28 | — | — | — |

### SECTION 19 — Windows V1 Production Qualification

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 19 — Windows V1 Production Qualification** | **NOT STARTED** | 18.CP | `Phase 19`; checkpoints: Windows Release Candidate → Production Complete | — | — | — |
| ↳ **19.1** WINDOWS RELEASE CANDIDATE CHECKPOINT — build/package/sign and freeze the exact RC identity and qualification bytes/trust metadata: source commit, contract manifest/profile, Windows FULL_HOST backend, protocol/schema, toolchains, signed installer/update artifacts, TUF/update metadata set, and artifact hashes; any later material rebuild/resign/trust-metadata change invalidates affected qualification | **NOT STARTED** | 18.CP | PLAN §§21,26; VR §§1–2,33,36; RP §§16,18 | — | — | — |
| ↳ **19.2** Run the complete normal CI/reproducibility/architecture gate against the frozen RC source/artifact context: format/lint, strict TypeScript, Rust fmt/clippy, unit/property/schema suites, architecture/import/platform-boundary checks, contract drift, dependency/security/license scans, protected-master evidence, and reproducible build verification | **NOT STARTED** | 19.1 | PLAN §21; CS §28; VR §§6,9,33 | — | — | — |
| ↳ **19.3** Cross-language protocol/schema/canonicalization complete qualification | **NOT STARTED** | 19.2 | VR §10; PS §27 | — | — | — |
| ↳ **19.4** Mission Control identity/adaptive/accessibility/window-state qualification on exact RC | **NOT STARTED** | 19.3, 18.4 | VR §11; RP §12; UI §§26,28 | — | — | — |
| ↳ **19.5** Tauri/WebView security qualification on exact RC | **NOT STARTED** | 19.4, 1.2 | VR §12 | — | — | — |
| ↳ **19.6** Windows named-pipe and Job Object/process-tree containment qualification on exact RC | **NOT STARTED** | 19.5, 2.CP | VR §§13,19 | — | — | — |
| ↳ **19.7** KDF/session/recovery-profile qualification and clean-profile new-password recovery semantics | **NOT STARTED** | 19.6, 5.CP | VR §14 | — | — | — |
| ↳ **19.8** Permission/content-authority/project-policy trust/adversarial/destructive-boundary qualification | **NOT STARTED** | 19.7, 5.CP, 6.CP | VR §§15–16; PPT §15 | — | — | — |
| ↳ **19.9** Codex Windows setup/version/health/sandbox/provider qualification | **NOT STARTED** | 19.8, 7.CP | VR §17 | — | — | — |
| ↳ **19.10** Tool contract/TOCTOU/idempotency/UNCERTAIN qualification | **NOT STARTED** | 19.9, 8.CP | VR §18 | — | — | — |
| ↳ **19.11** Exact SQLite/SQLCipher/WAL/migration/snapshot-rekey persistence qualification | **NOT STARTED** | 19.10, 3.CP, 4.CP | VR §§20,22 | — | — | — |
| ↳ **19.12** JARVIS_BACKUP_V1 crypto/tamper/order/truncation and exact signed-RC disaster-restore drill | **NOT STARTED** | 19.11, 3.CP | BKC §14; VR §21 | — | — | — |
| ↳ **19.13** Crash/recovery/UNCERTAIN/pause/preemption fault-injection matrix | **NOT STARTED** | 19.12, 11.CP | VR §§27–28 | — | — | — |
| ↳ **19.14** Exact budget/quota/resource/performance and hardware-pressure qualification | **NOT STARTED** | 19.13, 11.CP | VR §§23,31; RP §13 | — | — | — |
| ↳ **19.15** Module/catalog/TUF root/role/delegation/revocation/update/signing trust qualification | **NOT STARTED** | 19.14, 12.CP, 18.18 | SCT §17; VR §26 | — | — | — |
| ↳ **19.16** Local filesystem/Git and exact GitHub mandatory capability-matrix qualification | **NOT STARTED** | 19.15, 13.CP | VR §24 | — | — | — |
| ↳ **19.17** Exact Proxmox mandatory capability-matrix qualification | **NOT STARTED** | 19.16, 14.CP | VR §25 | — | — | — |
| ↳ **19.18** Final voice qualification on real Windows devices against Phase-3A evidence | **NOT STARTED** | 19.17, 16.CP | VR §30; RP §11 | — | — | — |
| ↳ **19.19** Event/automation/notification security/dedup/privacy qualification | **NOT STARTED** | 19.18, 17.CP | VR §29 | — | — | — |
| ↳ **19.20** Clean install/first launch/first text+worker mission/integration+voice/diagnostics/uninstall on Windows 11 25H2 x64 standard non-admin profile with no usable system Node | **NOT STARTED** | 19.19 | VR §32 | — | — | — |
| ↳ **19.21** Previous-production upgrade, migration, authorized rollback, recovery, and durable-state preservation qualification | **NOT STARTED** | 19.20, 18.20 | VR §22; OPS §27 | — | — | — |
| ↳ **19.22** Complete mandatory V1 production user-journey suite (all 18 journeys) | **NOT STARTED** | 19.21 | VR §35 | — | — | — |
| ↳ **19.23** 24-hour idle/background soak and 8-hour mixed workload soak with leak/backlog/WAL/orphan monitoring | **NOT STARTED** | 19.22 | VR §34 | — | — | — |
| ↳ **19.24** Zero-P0/P1 gate and reachable Critical/High vulnerability policy | **NOT STARTED** | 19.23, 18.21 | VR §38; OPS §26 | — | — | — |
| ↳ **19.25** Finalize SBOM/license/provenance/release-manifest/qualification-report evidence for the already frozen 19.1 artifacts; verify exact tested hashes and that no executable/update/trust-metadata byte or trust identity changed after qualification began. Any material change returns affected gates to non-verified state for requalification | **NOT STARTED** | 19.24 | VR §36; RP §§16,18; VR §2 | — | — | — |
| ↳ **19.26** QUALIFICATION CLOSURE — every mandatory central and specialized active-contract gate is evidenced against the same frozen signed RC source/profile/platform/artifact/trust identity, with no unqualified change since 19.1 | **NOT STARTED** | 19.1–19.25 | PLAN §21; VR §§2,36 | — | — | — |
| ↳ **19.27** PRODUCTION COMPLETE declaration with exact supported provider/module/integration capability versions and known limitations | **NOT STARTED** | 19.26 | IC §27; RP §18; VR §39; PLAN §21 Exit | — | — | — |
| ↳ **19.CP** FINAL SECTION CHECKPOINT — Production Complete | **NOT STARTED** | 19.27 | PLAN §26 final checkpoint; only final checkpoint is Production Complete | — | — | — |

## Contract coverage index

This is a secondary traceability safety net. The subsection's own governing references remain primary. Purpose/governing-principle sections are enforced globally even where they do not create a standalone implementation row.

| Normative source | Matrix ownership / coverage |
|---|---|
| `MAN` §§1–10 | Global matrix authority rules; 0.1, 0.7, 0.12, 18.19, 19.1, 19.27 |
| `IC` §§1–12 | Global guardrails; Sections 0–7 |
| `IC` §§13–19 | Sections 5, 8, 11; consumed by every consequential feature |
| `IC` §§20–21 | Sections 3–5, 18, 19.11–19.12 |
| `IC` §22 | Sections 12, 18.14–18.18, 19.15 |
| `IC` §23 | Sections 13–14, 19.16–19.17 |
| `IC` §24 | Section 17, 19.19 |
| `IC` §25 | 3A, Sections 15–16, 19.18 |
| `IC` §26 | 1.11–1.13, 18.5, 19.4, 19.25 |
| `IC` §§27–31 | Section 19 plus global non-goal/amendment/completion rules |
| `RP` §§1–3 | Global V1 target; Sections 0–2, 18–19 |
| `RP` §4 | Section 3, 4, 5, 18, 19.11–19.12 |
| `RP` §5 | Section 7, 19.9 |
| `RP` §§6–8 | Sections 5–11, 19.7–19.14 |
| `RP` §9 | Sections 13–14, 19.16–19.17 |
| `RP` §10 | Section 12, 19.15 |
| `RP` §§11–13 | 3A, Sections 15–16, 18.1–18.4, 19.4, 19.14, 19.18 |
| `RP` §§14–15 | Explicitly outside base V1 implementation; tracked under Non-goals / Post-V1 |
| `RP` §§16–18 | 0.13, 18.19–18.21, 19.1, 19.25–19.27 |
| `RP` §19 | Global governing distinction |
| `PP` §§1–12 | Sections 0–2, 7, 12, 19.2 |
| `PP` §§13–19 | Sections 1–6, 3 backup proof, 18, 19 |
| `PP` §§20–27 | Sections 12, 15–18; future companion constraints under Non-goals |
| `PP` §§28–32 | 0.10, 19.2 plus global platform invariants/non-goals |
| `RT` §§1–12 | Sections 1–5; Phase-2 bootstrap is intentionally partial until Sections 3/7/11 complete the ordered runtime prerequisites |
| `RT` §§13–18 | Sections 7–9 |
| `RT` §§19–23 | Sections 9–11 |
| `RT` §§24–28 | Sections 12–17 plus 18 operations and final qualification |
| `PS` §§1–10 | 0.3, 0.6, 1–5 |
| `PS` §§11–18 | Sections 4–10 |
| `PS` §§19–22 | Sections 7, 11–14 |
| `PS` §§23–28 | Sections 4, 17, 19.3 plus common schema qualification |
| `DS` §§1–8 | Sections 3–4 |
| `DS` §§9–19 | Sections 4–11 |
| `DS` §§20–25 | Sections 6–14 |
| `DS` §§26–36 | Sections 3, 18, 19.11–19.13, 19.21 |
| `DS` §37 | All state-bearing sections; checkpoints enforce invariants |
| `SEC` §§1–12 | Global security guardrails; Sections 3–7 |
| `SEC` §§13–18 | Sections 5, 8, 13–14 |
| `SEC` §§19–23 | Sections 1–2, 7, 19.5–19.9 |
| `SEC` §§24–27 | Sections 12–14, 18–19 |
| `SEC` §§28–34 | Every feature’s diagnostics/failure tests; 18.11–18.13, 19 |
| `BKC` §§1–17 | Section 3 exact implementation/proof; 18.8–18.10 lifecycle UX; 19.12 exact RC drill |
| `PPT` §§1–16 | 4.10 hooks; Section 6 implementation; consumers 7, 9, 11; 19.8 qualification |
| `SCT` §§1–11 | 4.11 hooks; Section 12 trust foundation |
| `SCT` §§12–16 | 18.14–18.19 application update/signing/release metadata |
| `SCT` §§17–19 | 12.15, 19.15 plus global trust invariants |
| `CS` §§1–7 | Section 0 foundations; applied to all sections |
| `CS` §§8–19 | Sections 3–8, 11; applied to all state/security code |
| `CS` §§20–26 | Sections 7–18 by owning adapter/UI/backup feature |
| `CS` §§27–33 | 0.9–0.13, every subsection DoD, 18.21, Section 19 |
| `OPS` §§1–13 | Sections 4–11 and 17–18 |
| `OPS` §§14–20 | Sections 7, 12–17 |
| `OPS` §§21–30 | Sections 15–19, especially 18 productization and 19 qualification |
| `OPS` §31 | Global operational principles |
| `UI` §§1–9 | Section 1 foundation and all feature UIs |
| `UI` §§10–19 | Owning feature UIs plus 18.1–18.3 |
| `UI` §§20–25 | 1.12, feature UI DoD, 18.4, 18.6–18.13 |
| `UI` §§26–29 | 18.1–18.5 and 19.4 |
| `VR` §§1–10 | All subsection/section DoD; 0, 4–5, 19.1–19.3 |
| `VR` §§11–19 | Sections 1–10 and 19.4–19.10 |
| `VR` §§20–29 | Sections 3, 11–17, 18 updater, 19.11–19.19 |
| `VR` §§30–39 | Sections 15–19, especially final RC/Production Complete |
| `PLAN` §§1–27 | Section numbers 0–19 preserve the authoritative macro-order; every Plan phase exit is represented by a `*.CP` checkpoint |

## Central release-gate mapping

Every one of the Verification Contract's 36 central production gates has an explicit final owner. Specialized active-contract gates are cumulative, not replacements for these central gates.

| # | Central release gate | Matrix final owner |
|---:|---|---|
| 1 | Contract Manifest + Release Profile conformance | 19.1, 19.26 |
| 2 | Reproducible build/toolchain | 19.2 |
| 3 | Protected-authoritative-branch / CI governance | 19.2 |
| 4 | Static / architecture analysis | 19.2 |
| 5 | Platform portability / composition / import boundary | 19.2 |
| 6 | Unit tests | 19.2 complete normal CI plus owning feature qualification rows |
| 7 | Property / state-machine tests | 19.2 plus 4.16, 5.13, 10.10, 19.13 |
| 8 | Protocol/schema cross-language | 19.3 |
| 9 | Mission Control UI identity/adaptive/accessibility | 19.4 |
| 10 | Tauri/WebView security | 19.5 |
| 11 | Windows named-pipe principal/bootstrap | 19.6 |
| 12 | KDF/session/recovery profile | 19.7 |
| 13 | PermissionEngine/approval safety | 19.8 |
| 14 | Prompt-injection/content-authority | 19.8 |
| 15 | Provider setup/version/health/platform/sandbox | 19.9 |
| 16 | Tool contract/TOCTOU | 19.10 |
| 17 | Persistence/SQLite-WAL/SQLCipher | 19.11 |
| 18 | Encrypted local/portable backup restore | 19.12 |
| 19 | Migration | 19.11, 19.21 |
| 20 | Crash/recovery/uncertain-side-effect | 19.13 |
| 21 | Windows Job Object/process-tree containment | 19.6 |
| 22 | Exact budget/quota/accounting | 19.14 |
| 23 | Module/catalog/supply-chain/update/platform | 19.15 |
| 24 | Local filesystem/Git integration | 19.16 |
| 25 | Exact GitHub V1 capability matrix | 19.16 |
| 26 | Exact Proxmox VE V1 capability matrix | 19.17 |
| 27 | Voice qualification | 19.18 |
| 28 | Event/automation security/dedup | 19.19 |
| 29 | Performance/latency | 19.14 |
| 30 | Resource-pressure | 19.14 |
| 31 | Clean install with no usable system Node | 19.20 |
| 32 | Previous-production upgrade/rollback | 19.21 |
| 33 | Signed installer/update verification | 19.1 creation/freeze + 19.25 final identity verification |
| 34 | SBOM/license/provenance/release manifest | 19.25 |
| 35 | Soak/stability | 19.23 |
| 36 | V1 production user journeys | 19.22 |

### Specialized cumulative gates

| Specialized cumulative gate | Final owner |
|---|---|
| `JARVIS_BACKUP_V1` exact crypto/golden/tamper/order/truncation/bounds + signed-RC disaster restore | 19.12 |
| Project-policy candidate/enrollment/hash-change/nested/revoke/worker-mutation trust conformance | 19.8 |
| TUF bootstrap/threshold/root rotation/revocation/expiry/rollback/freeze/mix-and-match/delegation + cumulative signing | 19.15 |
| Exact SQLite embedded-build WAL-fix evidence and snapshot/re-key mechanism | 19.11 |
| Early voice feasibility evidence compared with final production implementation | 19.18 |
| Repository protection and contract/profile drift safeguards | 19.2 |

## Explicit V1 non-goals, optional capabilities, and post-V1 boundaries

The following are **not base-V1 implementation blockers** and SHALL NOT be pulled into an earlier subsection merely to make an abstraction look complete:

- Linux production runtime/artifacts/qualification;
- Windows ARM64 production support before its own complete native/provider/voice/SQLite/installer/update/UI qualification;
- Android or another companion application;
- Remote Access Gateway / companion networking;
- Windows↔Linux cross-platform restore qualification;
- integrated browser automation;
- LAN AI nodes;
- mandatory local large-LLM inference;
- custom model training/inference infrastructure;
- unrestricted computer-control agents;
- open arbitrary executable plugin marketplace;
- public privileged-Core Internet/LAN ingress;
- light theme / theme marketplace / 3D avatar / unrelated platform identities;
- GitHub repository/secrets/branch-protection/member administration, repository deletion, or ref deletion;
- generic Proxmox storage/network administration or direct PBS administration;
- wake word qualification;
- `GITHUB_ACTIONS_DISPATCH`, `PROXMOX_STORAGE_WRITE`, `PROXMOX_NETWORK_WRITE`, and `PASSPHRASE_ARGON2ID_V1` unless the concrete release explicitly enables them and performs their full required qualification.

Binding post-V1 integration targets remain SSH, Google Workspace, Microsoft 365, and Cloudflare, but they do **not** block Windows V1 Production Complete and are not inserted into this V1 execution chain.

## Matrix maintenance rules

- Update status/evidence immediately after each material implementation or verification pass; do not let this file become a retrospective report.
- When a subsection enters `IN PROGRESS`, its execution packet from `AGENTS.md` must be established from the **current** contract text, not copied mechanically from this matrix.
- Evidence should reference concrete commits, test commands/results, qualification artifacts, external/live verification identifiers, or signed release evidence as applicable.
- If a contract change changes ordering, requirements, capability support, or gates, update this matrix synchronously before dependent implementation continues.
- If concurrent repository changes move live `master`, preserve valid concurrent work, re-evaluate affected dependencies, and never overwrite the new source of truth.
- Optional `DEFERRED` rows become mandatory for the concrete release the moment that release exposes/enables the capability; they must then move into the normal implementation/verification loop.
- Never use this file to waive a contract requirement or to claim a future platform/capability as supported.

## Fresh matrix design review

**Review date:** August 12, 2026  
**Contract baseline:** live `master` `5766978576a48165a7ec8013ed6a106b0b0ddd17`, JARVIS contract suite v1.0.5.  
**Draft reviewed:** initial matrix commit `d937c606785c5b21ddff72ab1ed011dd7c931b11` plus the current hardening amendments in this branch.

The review was performed as a fresh contract/dependency audit rather than a self-approval of the original outline. It re-read `AGENTS.md`, the current manifest, top-level Implementation Contract, Release Profile, every active normative component, the Implementation Plan, and the actual repository copy of this matrix.

Material findings corrected before acceptance:

1. **Phase-2 secure-storage forward dependency:** the first draft described Runtime startup steps 1–12 as complete before the Phase-3 Windows secure-store backend existed. Section 2 now implements only the pre-persistence bootstrap ordering/capability shell and explicitly defers production secure-storage qualification to 3.4.
2. **Optional-row dependency ambiguity:** dependency-range semantics now explicitly skip contract-permitted `DEFERRED` branches until enabled, and backup/GitHub/Proxmox downstream rows show their optional conditional dependencies explicitly.
3. **Over-prescriptive GitHub authentication:** the draft named PKCE/loopback behavior not fixed by the active contract. Section 13 now requires a secure qualified auth method without inventing a new normative choice in the matrix.
4. **Signed-RC qualification order:** the draft placed signed installer/update finalization after most qualification. Section 19 now creates/signs/freezes the exact RC artifacts and trust metadata at 19.1 before any final qualification is accepted. Later artifact/trust changes invalidate affected evidence.
5. **Final normal-CI coverage:** 19.2 now explicitly reruns the complete normal CI/unit/property/schema/architecture/drift/reproducibility gate on the frozen RC context instead of relying only on historical per-feature runs.
6. **Release-candidate checkpoint semantics:** Phase 18 now ends with an Operations/UI/TUF-update-ready qualification candidate. The named Windows Release Candidate checkpoint occurs only once exact signed RC bytes/trust identity are frozen at 19.1.
7. **Supply-chain lifecycle precision:** module activation now explicitly prevents silent active-task replacement, offline install-authorizing key custody excludes ordinary developer workstations/update servers/general CI, and publisher signature alone cannot confer support.

Structural review result:

- macro-order remains exactly Phase `0 → 1 → 2 → 3 → 3A → 4 ... → 19`;
- 21 macro sections are represented, including the mandatory Phase 3A feasibility gate;
- 315 subsection/checkpoint rows retain unique IDs;
- mandatory GitHub capability coverage remains exactly 9 base-V1 capabilities;
- mandatory Proxmox capability coverage remains exactly 8 base-V1 capabilities;
- four contract-permitted optional branches remain explicitly `DEFERRED` and non-blocking until enabled;
- every one of the Verification Contract's 36 central release gates has a final owner;
- specialized backup-crypto, project-policy, TUF/supply-chain, exact SQLite/WAL, early-voice and repository/drift gates remain cumulative;
- all child dependencies are backward-looking within the authoritative macro-order; parent-section entry gates are inherited by children;
- no known circular dependency, later-feature prerequisite, orphan mandatory domain, or support-claim shortcut remains after the corrections above.

## Matrix design assurance checklist

Before this matrix is accepted for implementation, a fresh review must establish all of the following:

- [x] Current `master`, `AGENTS.md`, manifest, Release Profile, every active normative component, and Implementation Plan were re-read.
- [x] Every mandatory active-contract domain has at least one implementation owner and one verification owner.
- [x] Every subsection dependency resolves to an earlier subsection/checkpoint; no known forward dependency or cycle remains.
- [x] Cross-cutting systems use deliberate foundation/full-implementation/productization/qualification staging.
- [x] No earlier section requires a later full feature merely to satisfy a prerequisite.
- [x] Optional/non-V1/post-V1 capabilities cannot accidentally block base V1 or appear `SUPPORTED`.
- [x] Phase exits and named release checkpoints remain faithful to the authoritative Implementation Plan.
- [x] Final qualification covers all 36 central release gates plus cumulative specialized-contract gates.
- [x] No parent section can become `VERIFIED` from child statuses alone; its section checkpoint remains mandatory.
- [x] The first executable target is self-contained enough to start without an unimplemented later prerequisite.
- [x] The final `Production Complete` declaration binds to one exact source commit and exact signed Windows FULL_HOST artifacts.
- [x] Fresh review found no known unresolved matrix ordering/coverage/prerequisite defect.

> **Safety statement:** after the fresh review and corrections above, this matrix has no known unresolved planning, authority, ordering, coverage, or prerequisite defect. No planning artifact can guarantee that future implementation code will be bug-free; implementation must still follow the subsection verification loop and exact contract gates. The matrix is accepted only as a safe execution plan against the reviewed v1.0.5 baseline, and it must be revalidated whenever the contract or live repository prerequisites change.
