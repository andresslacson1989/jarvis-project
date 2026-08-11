# JARVIS Contract v1.0.2 Preservation & Reconciliation Audit

**Review date:** August 12, 2026  
**Reviewed branch:** `codex/contract-v1.0.2-consolidation`  
**Historical semantic baseline:** `docs/history/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.md` plus its former normative appendices and accepted ADR lineage  
**Current canonical contract:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md` and its listed appendices  
**Document role:** audit/traceability evidence only; this report is not an implementation overlay.

---

# 1. PURPOSE

This audit exists to answer a stricter question than ordinary internal consistency:

> **Did v1.0.2 preserve every still-valid implementation/product instruction from the old contract and accepted ADR lineage, while intentionally replacing only rules that were corrected, superseded, or merely non-binding defaults?**

The required outcome is that an implementer can build from the current v1.0.2 normative suite without reading old contracts or ADRs to recover missing behavior.

ADRs/history remain rationale/provenance only.

---

# 2. CURRENT NORMATIVE SUITE

The current implementation source of truth is:

1. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`
2. `docs/JARVIS-V1-RELEASE-PROFILE.md`
3. `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
4. `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`
5. `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
6. `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
7. `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`
8. `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`
9. `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`
10. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`

`README.md` and `AGENTS.md` point contributors to the same suite.

This report is deliberately outside that normative list.

---

# 3. CLASSIFICATION RULE

Every historical instruction examined in this preservation pass is classified as one of:

- **PRESERVED** — same requirement exists in current normative text;
- **STRENGTHENED / SUPERSEDED** — old behavior remains satisfied by a more precise/safer current rule and the obsolete wording must not be restored;
- **NON-NORMATIVE DEFAULT** — old value/example was recommendation/tuning guidance rather than a required architectural/product invariant;
- **RESTORED IN v1.0.2 OPERATIONS CONTRACT** — a valid requirement had been compressed out of the first consolidation and is now explicitly current again.

Anything that cannot fit one of those categories is a preservation defect and must be corrected before implementation-lock can be claimed.

---

# 4. OLD TOP-LEVEL v1.0 DOMAIN TRACEABILITY

| Historical domain | Current result | Current normative destination |
|---|---|---|
| Windows desktop, Tauri/Rust host, Node Core separation | PRESERVED/STRENGTHENED | Top-level, Runtime, Coding |
| React unprivileged / no credentials / no authority | STRENGTHENED | Top-level, Security, Coding |
| text conversation | PRESERVED | Top-level, Release Profile |
| production local-first voice | PRESERVED/STRENGTHENED | Top-level, Release Profile, Runtime, Operations, Verification |
| persistent voice identity | RESTORED/EXPLICIT | Operations §§19–20 + Release Profile |
| no silent generic voice fallback | RESTORED | Operations §19 |
| deterministic reflex/stop/mute/cancel | PRESERVED/EXPANDED | Runtime + Operations §§20–22 |
| immediate truthful acknowledgement / slow-work responsiveness | RESTORED | Operations §§20–21 |
| bounded conversation continuation window | RESTORED | Operations §20 |
| voice latency telemetry | RESTORED | Operations §22 + Verification |
| provider abstraction/supervision/failure isolation | PRESERVED/STRENGTHENED | Runtime, Protocol, Verification, Operations §14 |
| warm/persistent/streaming provider architecture | RESTORED/EXPLICIT | Operations §14 |
| resource-aware provider warm/unload behavior | RESTORED | Operations §14 |
| capability-based provider/worker routing | PRESERVED | Runtime, Protocol |
| orchestrator has no unrestricted shell | STRENGTHENED | Top-level, Runtime, Security |
| bounded worker loops | PRESERVED | Runtime, Data, Verification |
| logical parallelism vs actual concurrency | PRESERVED/EXPLICIT | Operations §5 + Runtime |
| trivial deterministic work should not become unnecessary missions | RESTORED | Operations §5 |
| mission DAGs / immutable graph versions | PRESERVED | Top-level, Protocol, Data |
| dynamic replanning with reuse/invalidation | PRESERVED | Protocol, Data, Verification |
| authority envelope | PRESERVED/STRENGTHENED | Top-level, Protocol, Security |
| autonomy inside intent; clarify material expansion | PRESERVED/EXPLICIT | README, Operations §29 |
| contextual PermissionEngine | STRENGTHENED | Top-level, Security |
| standing permissions scoped/revocable/non-transitive | RESTORED/EXPLICIT | Operations §8 |
| precedent is evidence, not blank check | STRENGTHENED | Security |
| destructive final confirmation | STRENGTHENED | Top-level, Security, Protocol |
| human-readable destructive target/consequence UX | RESTORED/EXPLICIT | Operations §23 |
| UI confirmation remains available | RESTORED | Operations §23 |
| typed/validated tool boundary | STRENGTHENED | Top-level, Protocol, Security, Coding |
| postcondition verification / `UNCERTAIN` | STRENGTHENED | Runtime, Protocol, Verification |
| queue transparency | RESTORED/EXPLICIT | Operations §3 |
| priority/preemption/pause/resume | PRESERVED/STRENGTHENED | Runtime + Operations §6 |
| delayed safe-point interruption visible | RESTORED | Operations §6 |
| user priority control over AI priority | RESTORED | Operations §6 |
| scheduling transitions auditable | RESTORED | Operations §6 |
| crash/recovery durability | STRENGTHENED | Runtime, Data, Verification |
| recovery user visibility | RESTORED | Operations §7 |
| scoped memory / live state beats memory | PRESERVED | Data, Top-level |
| scoped ranked memory retrieval | RESTORED | Operations §13 |
| work dashboard | RESTORED/EXPLICIT | Operations §3 |
| worker journals / no chain-of-thought | PRESERVED/EXPANDED | Operations §4 + Data/Security |
| budget/quota/hard limits | STRENGTHENED | Protocol, Runtime, Data |
| budget queue/user visibility | RESTORED | Operations §18 |
| Credential Broker / no raw secrets | STRENGTHENED | Security, Protocol, Coding |
| integration catalog / independent capabilities | RESTORED/EXPLICIT | Operations §17 + Release Profile |
| auth revocation blocks dependent operations only | RESTORED | Operations §§8,17 |
| module registry/dashboard | RESTORED/EXPLICIT | Operations §15 |
| module install != enable/authorize/prefer | RESTORED | Operations §15 |
| staged versioned module update/rollback | PRESERVED + EXPLICIT | Protocol, Coding, Operations §16 |
| immutable module install units / activation pointer rollback | RESTORED | Operations §16 |
| event gateway / event does not bypass authority | PRESERVED/STRENGTHENED | Top-level, Security, Operations §9 |
| per-event disposition controls | RESTORED | Operations §9 |
| NotificationPolicy / grouping / focus modes | RESTORED | Operations §10 |
| project/workspace isolation | PRESERVED where applicable | ExecutionScope + Runtime/Operations |
| diagnostics/degraded states | PRESERVED/EXPANDED | Runtime, Operations §24 |
| diagnostic export privacy/default exclusion | RESTORED | Operations §24 |
| audit retention sufficient to explain consequential actions | RESTORED | Operations §25 |
| audit tamper-evidence claim | STRENGTHENED/normalized | Operations §25; no false same-user guarantee |
| backup/restore/migration/update | STRENGTHENED substantially | Data, Security, Verification |
| invalid configuration preserves prior valid config | RESTORED | Operations §11 |
| import conflict/merge safety | RESTORED | Operations §12 |
| update preserves durable compatible state | RESTORED/EXPLICIT | Operations §27 |
| uninstall does not silently delete durable user data | RESTORED | Operations §27 |
| production vulnerability scanning | PRESERVED/EXPANDED | Security/Coding + Operations §26 |
| reachable High vulnerability waiver requirements | RESTORED | Operations §26 |
| Critical reachable vulnerability release block | PRESERVED/STRENGTHENED | Verification + Operations §26 |
| architecture decision escalation | RESTORED | Operations §28 |
| concise report of significant autonomously resolved architecture decisions | RESTORED | Operations §28 |
| production completion evidence, not documentation | PRESERVED/STRENGTHENED | Verification, Release Profile |

---

# 5. HISTORICAL APPENDIX TRACEABILITY

## Runtime v1.0

Preserved or strengthened:

- single instance/data directory;
- Rust host/Core ownership split;
- authenticated local IPC;
- provider supervisor;
- bounded workers;
- mission scheduler;
- preemption/recovery;
- shutdown/process ownership;
- degraded modes;
- no detached unmanaged authoritative children.

Strengthened replacements include restrictive named-pipe DACL/locality, application-owned Node runtime, mandatory Job Objects, explicit delegated-engineering shell limits, exact provider compatibility, and durable `RESUMING`.

Operational behaviors compressed during the original v1.0.2 rewrite—queue/dashboard visibility, safe-point pause visibility, persistent voice fallback, immediate acknowledgement, warm/streaming provider capability—are current in Operations.

## Data/State v1.0

Preserved or strengthened:

- SQLite authority/state transactions/events;
- state machines and graph versions;
- approvals/checkpoints/artifacts/leases;
- budgets/usage;
- credential handles only;
- integration/module state;
- migrations/backup/restore/corruption response/retention.

Restored details include last-known-valid configuration activation, import merge/conflict safety, ranked memory retrieval, immutable module install units/activation-pointer rollback, and security audit evidence retention.

The old fixed backup-retention counts remain recommendations rather than mandatory architecture; the current safety invariant protects verified recovery paths without freezing arbitrary retention numbers.

## Security v1.0

Preserved or strengthened:

- deterministic security policy;
- session lock/password;
- secure storage;
- DB encryption;
- prompt-injection boundary;
- structured AI-output validation;
- path security;
- tool manifests;
- final confirmation;
- precedent constraints;
- process/shell/credential boundaries;
- OAuth/event/module/update/dependency/log/crash/audit/network protections.

Strengthened corrections include separate sensitivity/locality, accurate same-user threat claims, WebView/Tauri security, canonical approval material, conditional target mutation, external-module process isolation, provider qualification, and Proxmox typed API boundary.

Restored operational security details include diagnostic-export privacy, scoped/revocable standing permissions, destructive approval UX, reachable-High vulnerability risk acceptance, and audit-evidence retention.

## Protocol/Schema v1.0

Preserved or strengthened:

- bounded versioned IPC;
- canonical IDs/timestamps/errors;
- session/authority/mission/task/attempt/graph/tool/provider/module/integration/event types;
- runtime validation and compatibility rules.

Strengthened replacements include discriminated ExecutionScope, exact MoneyAmount, explicit response union, machine-readable tool checks, canonical approval descriptor/JCS digest, provider compatibility/health separation, module execution class/lifecycle, Proxmox identity, and exact quota/reservation semantics.

The old atomic last-valid configuration rule is current in Operations rather than requiring historical Protocol reading.

## Verification v1.0

Every still-valid release family remains required, with additional v1.0.2 gates for Tauri/WebView, named-pipe principal security, exact provider sandbox/version behavior, Job Objects, WAL fixed build, portable restore, exact budgets, GitHub/Proxmox, signed package identity, and soak/provenance.

Old user-visible qualification that had been compressed—queue reasons, notification grouping/focus behavior, safe-point pause visibility, diagnostic-export defaults, upgrade-state preservation, High vulnerability waiver, uninstall data preservation—is explicitly required by Operations §30 and blocks Production Complete when applicable.

---

# 6. ACCEPTED ADR TRACEABILITY

The accepted ADR corpus remains history/rationale only. Its effective rules are represented as follows:

| ADR | Effective decision | Current status/destination |
|---|---|---|
| 021 | modular TTS / voice identity separated from provider | Runtime, Release Profile, Operations §§19–20 |
| 022 | voice latency / instant truthful response | Verification, Operations §§20–22 |
| 023 | dual deterministic reflex + AI reasoning paths | Runtime, Operations §§20–21 |
| 024 | realtime conversation engine | Runtime, Release Profile, Verification |
| 025 | context authority / scoped memory | Top-level, Data, Operations §13 |
| 026 | provider supervisor / failure isolation | Runtime, Protocol, Verification |
| 027 | modular AEC / full duplex | Runtime, Release Profile, Verification |
| 028 | resource-aware runtime scheduling | Runtime, Operations §§5,14,18 |
| 029 | persistent human voice / same-voice acknowledgement | Operations §§19–20 |
| 030 | context-aware PermissionEngine | Security, Top-level, Operations §8 |
| 031 | scoped ranked memory retrieval | Operations §13 |
| 032 | mission planning / worker allocation | Runtime, Data, Operations §5 |
| 033 | provider fallback / continuity | Runtime, Security, Verification |
| 034 | supported module registry/dashboard | Protocol + Operations §15 |
| 035 | versioned staged module update/rollback | Protocol, Coding, Operations §16 |
| 036 | validated tool execution boundary | Top-level, Protocol, Security, Coding |
| 037 | durable recovery / safe resume | Runtime, Data, Operations §7 |
| 038 | work dashboard / journals / auditability | Operations §§3–4,24–25 |
| 039 | supported integration catalog / credential boundaries | Release Profile, Security, Operations §17 |
| 040 | Event Gateway / automation | Security, Top-level, Operations §9 |
| 041 | NotificationPolicy / focus modes | Protocol + Operations §10 |
| 042 | project registry/workspace isolation | Runtime/ExecutionScope; project-specific semantics preserved, universal fake-project requirement superseded |
| 043 | budget/usage policy | Protocol, Runtime, Data, Operations §18 |
| 044 | session-password trust boundary | Top-level, Security, Operations §23 where approval UX intersects |
| 045 | authority envelope / precedent-aware autonomy | Security, Top-level, Operations §§8,29 |
| 046 | graph missions / bounded worker loops | Runtime, Data, Verification, Operations §5 |
| 047 | dynamic graph revision | Protocol, Data, Runtime, Verification |
| 048 | priority/preemption/safe pause-resume | Runtime + Operations §6 |
| 049 | architecture decision escalation | Operations §28 + AGENTS/README principles |
| 050 | capability-based worker/provider routing | Runtime, Protocol |
| 051 | production implementation contract suite | current v1.0.2 suite governance |
| 052 | protocol schema + implementation plan | Protocol + Implementation Plan remain current |
| 053 | JARVIS is platform, not custom LLM | Top-level non-goals/product definition |
| 054 | contract/schema normalization | current canonical schemas/vocabulary |
| 055 | Windows Core IPC access control | Security/Runtime/Verification |
| 056 | same-user compromise boundary | Security/Top-level |
| 057 | module execution isolation | Top-level/Protocol/Security/Coding |
| 058 | deterministic approval action digests | Top-level/Protocol/Security/Verification |
| 059 | Proxmox VE integration boundary | Release Profile/Protocol/Runtime/Security/Verification |
| 060 | provider-authoritative usage / exact budgets | Protocol/Runtime/Data/Verification |
| 061 | application-owned Core runtime | Top-level/Runtime/Release Profile/Verification |
| 062 | backup/recovery key semantics | Data/Security/Verification |
| 063 | mandatory Windows Job Object containment | Top-level/Runtime/Security/Coding/Verification |
| 064 | explicit IPC response/error union | Protocol/Verification |
| 065 | provider version qualification / Codex compatibility | Protocol/Runtime/Verification/Release Profile |
| 066 | provider resume is optimization, not durability | Protocol/Runtime/Data/Verification |
| 067 | V1 integration release boundary / immediate post-V1 requirements | Release Profile/Top-level/Operations §17 |
| 068 | SQLite WAL safety / operational diagnostics | Data/Coding/Verification/Release Profile |
| 069 | v1.0.2 canonical consolidation / no overlay | Top-level/README/AGENTS/Lineage |

No accepted ADR in this lineage is required as an implementation patch layer after this preservation pass.

---

# 7. INTENTIONAL SUPERSESSIONS — DO NOT RESTORE

The following historical instructions/representations were deliberately replaced because restoring them would make the contract worse or contradictory:

1. **Universal project/workspace binding for every task** → replaced by discriminated `PROJECT_WORKSPACE | INTEGRATION | SYSTEM | GLOBAL` ExecutionScope. Project mutation still requires project scope; integration/system work does not invent fake project authority.
2. **Sensitivity enum containing `LOCAL_ONLY`** → replaced by independent DataSensitivity and DataLocality.
3. **JavaScript floating-point authoritative cost fields** → replaced by exact `MoneyAmount.nanoUnits`.
4. **System/PATH Node dependency** → replaced by application-owned pinned runtime.
5. **Optional/vague Job Object containment** → strengthened to mandatory ordinary managed-child containment with narrow verified exceptions.
6. **Provider session resume as durability** → replaced by JARVIS-owned checkpoints/artifacts/state.
7. **Same-user-malware hard-isolation implication** → replaced by accurate defense-in-depth boundary.
8. **Untrusted separately installed executable module in authoritative Core** → prohibited; external executable modules are managed out-of-Core.
9. **Arbitrary/raw Proxmox API or SSH/CLI fallback** → prohibited; typed HTTPS API path only for normal V1 control plane.
10. **Direct public privileged-Core ingress as ordinary event mechanism** → not required; separately hardened ingress boundary needed.
11. **Unrestricted orchestrator shell** → prohibited.
12. **Non-canonical/vague approval hashing** → replaced by one cross-language canonical descriptor/JCS/SHA-256 pipeline.
13. **Precedent independently authorizing HIGH actions** → explicitly prohibited.
14. **Single fixed-silence voice-turn strategy** → replaced by physical/semantic realtime turn engine and qualification.
15. **Specific retention counts/tuning numbers as architecture requirements** → remain configurable/recommended unless a current Release Profile explicitly fixes them; safety/recovery invariants remain mandatory.

---

# 8. REQUIREMENTS PRESERVATION RESULT

After the fresh preservation loops, the current normative suite contains explicit implementation instructions for the still-valid old requirements that were initially under-specified after consolidation, including:

- queue/dashboard/worker truth;
- safe pause/preemption/user priority behavior;
- recovery visibility;
- standing-permission governance;
- event disposition and notification/focus behavior;
- known-good configuration activation;
- import conflict safety;
- ranked memory retrieval;
- provider warm/persistent/streaming/resource lifecycle capability;
- module registry/update/rollback UX and state separation;
- integration capability/revocation UX;
- budget/quota visibility;
- persistent voice identity/fallback/acknowledgement/slow-work behavior;
- destructive approval UX;
- diagnostic export privacy;
- audit retention/integrity claim boundaries;
- reachable High/Critical vulnerability release policy;
- upgrade/uninstall state preservation;
- architecture escalation and concise autonomous-decision reporting.

Those requirements no longer require ADR/history overlay interpretation.

---

# 9. GOVERNANCE CHECK

A future accepted ADR is not implementation-ready by itself when it changes current behavior.

The same reviewed change must update every affected active normative document, applicable Release Profile support scope, schema/migration/compatibility rules, and verification gates.

If an ADR exposes a valid requirement absent from current normative text, the current contract is incomplete and must be corrected before implementation relies on that requirement.

---

# 10. PRODUCT STATUS DISTINCTION

This preservation audit concerns architecture/contract completeness only.

It does not prove the software is Production Complete.

Production Complete still requires implemented code and exact signed release artifacts to pass the complete current normative qualification suite, including the mandatory tests in `JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md` and `JARVIS-VERIFICATION-RELEASE-CONTRACT.md` for the active Release Profile.

---

# 11. GOVERNING RULE

> **Nothing still valid should require historical archaeology. If a behavior matters to implementation, it belongs in the current normative suite.**

> **History explains the contract. The current contract defines the product.**
