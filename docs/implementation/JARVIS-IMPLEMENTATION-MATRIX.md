# JARVIS Implementation Execution Matrix — Live Control Board

**Document role:** Non-normative live execution/status control board for the JARVIS v1.0.5 implementation.

## Matrix split

The implementation matrix is intentionally split to keep frequent status/evidence writes small and auditable:

- `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md` — **live control board**. This file owns the current execution pointer, current subsection status, scores, gaps, evidence, and the detailed rows for the currently active section.
- `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md` — **stable reference plan**. This file preserves the complete pre-split matrix dependency graph, subsection definitions, contract traceability, coverage indexes, release-gate mapping, and design assurance.

The two files together are one non-normative implementation matrix. They are not competing sources of truth. The active normative contract suite remains the implementation authority.

**Precedence rule:** for status, score, gap, evidence, and execution-pointer fields, this live file is authoritative. Status-like values in the reference snapshot are frozen historical values from the split baseline and MUST NOT override this file.

**Future-agent workflow:** read `AGENTS.md`, then this live file, then the reference file for the active/next subsection's full definition and dependencies. When a new parent section becomes active, promote that section's rows from the reference file into this live file verbatim before implementation, preserve the section/subsection hierarchy, and keep completed-section summaries auditable. Do not rewrite the large reference file for routine progress updates.

## Current execution pointer

| Field | Current value |
|---|---|
| Active section | `SECTION 0 — Repository / Platform Contracts / Toolchain / Governance` |
| Active subsection | None — `0.5` verified; `0.6` not started |
| Next eligible subsection | `0.6` |
| Contract suite | JARVIS v1.0.5 |
| Authoritative implementation sequence | `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` |
| Reference plan | `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md` |
| Production Complete | **NO** |

## Live implementation matrix

### SECTION 0 — Repository / Platform Contracts / Toolchain / Governance

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 0 — Repository / Platform Contracts / Toolchain / Governance** | **IN PROGRESS** | — | `Phase 0`; checkpoint: Repository Governance + Platform Boundary + Contract-Drift Protection Ready | — | `0.6` is next | `0.1–0.5` verified; section checkpoint remains pending |
| ↳ **0.1** Implementation admission, authoritative-suite pinning, and repository baseline | **VERIFIED** | — | PLAN §2; IC §§2–3,28–29; RP §17; AGENTS Source of truth/Branch authority | 10 CA / 9 scoped | None within `0.1` scope | `ded8f9e5c0e056ff69fa27668dfb0bd4fca7a0f7`; `docs/implementation/evidence/0.1-implementation-admission.md`; live `master` `bb32c530...`; diff verification changed only the evidence file |
| ↳ **0.2** Monorepo responsibility boundaries and dependency-direction skeleton | **VERIFIED** | 0.1 | PLAN §2; CS §§2–4,32; IC §§5,8 | 10 CA / 9 scoped | None within `0.2` scope | `67fa540caab982dccb2330070df62c6d71603099`; `docs/implementation/architecture/REPOSITORY-BOUNDARIES.md`; `docs/implementation/evidence/0.2-monorepo-boundaries.md`; diff added only 22 Markdown boundary/evidence files; no package/toolchain/runtime/native implementation; Linux negative-support wording verified |
| ↳ **0.3** Platform/runtime identity and compatibility protocol foundation | **VERIFIED** | 0.2 | PLAN §2; PP §§2–7,11; PS §§2–3,27; RP §§2–3 | 10 CA / 9 scoped | None within `0.3` scope | `229954d1e34c52bb11c50570308e9f66c2a21034`; `669fec6bad6cdec53a1a44fc94be3573e120997f`; `docs/implementation/evidence/0.3-platform-runtime-identity.md`; exact 6-file implementation; 5/5 schema self-validation; 20/20 positive/negative/adversarial cases; strict TypeScript auxiliary check PASS; no later-phase implementation leakage |
| ↳ **0.4** Semantic platform-capability contracts, availability, and stable platform errors | **VERIFIED** | 0.3 | PLAN §2; PP §§6,26–28; CS §4; RP §3 | 10 CA / 9 scoped | None within `0.4` scope | `b5bcd1b05128e65123b2bac95aa7b59d308d458a`; `a4dcf8593137779fc7a1ce4be63ff6d70acf3aef`; `docs/implementation/evidence/0.4-platform-capability-contracts.md`; exact 3-file implementation; strict TypeScript PASS; 8/8 behavioral/negative tests; 2/2 negative compile-time checks; no native-backend/toolchain/CI leakage |
| ↳ **0.5** Composition root, Windows backend registration, and future-Linux namespace reservation | **VERIFIED** | 0.4 | PLAN §2; PP §§7–10; CS §§2–4,32 | 10 CA / 9 scoped | None within `0.5` scope | `384be644b63f82da7397769066a595a9afa5a358`; `186dd001ff481c836a3e5074f59181e8b3152c8d`; `docs/implementation/evidence/0.5-platform-composition-root.md`; exact 4-file implementation; strict TypeScript PASS; 9/9 behavioral/negative checks; forbidden native/OS-branch scan PASS; Linux namespace contains no V1 executable runtime registration |
| ↳ **0.6** Protocol/schema infrastructure and common boundary primitives | **NOT STARTED** | 0.3 | PLAN §2; PS §§1–9,25–27; CS §§5–7,11 | — | — | — |
| ↳ **0.7** Typed bootstrap/configuration schemas and machine-readable canonical contract values | **NOT STARTED** | 0.6 | PLAN §2; MAN §§4–6; PS §24; CS §30; IC §28 | — | — | — |
| ↳ **0.8** Pinned toolchains, package manager, strict TypeScript, Rust baseline, lockfiles | **NOT STARTED** | 0.2 | PLAN §2; CS §§5–6,28–29; RP §3 | — | — | — |
| ↳ **0.9** Production test-layer and fixture architecture | **NOT STARTED** | 0.6, 0.8 | PLAN §2; CS §27; VR §§6–8 | — | — | — |
| ↳ **0.10** Architecture/forbidden-import/package-cycle/unsafe-Rust-containment/platform-capability-failure enforcement | **NOT STARTED** | 0.4, 0.5, 0.9 | PLAN §2; PP §28; CS §§3,28,32; VR §9 | — | — | — |
| ↳ **0.11** Static CI baseline: format/type/build/schema/security/dependency/license/secret/provenance | **NOT STARTED** | 0.8, 0.9 | PLAN §2; CS §§28–29; SEC §§27–28; VR §6 | — | — | — |
| ↳ **0.12** Generated-artifact reproducibility, manifest validation, and contract/profile drift checks | **NOT STARTED** | 0.7, 0.11 | PLAN §2; MAN §6; IC §28; RP §17 | — | — | — |
| ↳ **0.13** Authoritative master protection, required checks, and auditable bypass governance | **NOT STARTED** | 0.11, 0.12 | PLAN §2; IC §28; RP §17; VR §33 | — | — | — |
| ↳ **0.CP** SECTION CHECKPOINT — Phase 0 clean-checkout, governance, platform-boundary, and drift proof | **NOT STARTED** | 0.1–0.13 | PLAN §2 Exit; PLAN §26 checkpoint; VR §§6,9,33 | — | — | — |

## Future-section status summary

Sections 1–19 remain `NOT STARTED` except contract-permitted optional rows already marked `DEFERRED` in the reference plan. Their complete subsection definitions, dependencies, traceability, and final release-gate ownership remain in `JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md` until each parent section becomes active and is promoted into this live board.

## Maintenance invariants

- Routine progress updates modify this live file only.
- Do not use the reference snapshot's historical status fields to roll back live status.
- Structural/dependency/traceability corrections to the reference plan require an explicit matrix-maintenance change and must remain contract-consistent.
- A parent section becomes `VERIFIED` only after all required child rows and its `*.CP` checkpoint pass.
- `Production Complete` remains available only at `19.27` / `19.CP` after exact signed Windows V1 qualification.
