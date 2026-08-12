# JARVIS Implementation Execution Matrix — Live Control Board

**Document role:** Non-normative live execution/status control board for the JARVIS v1.0.6 implementation.

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
| Active section | `SECTION 1 — Desktop Host Foundation` |
| Active subsection | `1.1` — Create Tauri + React desktop workspace with bundled-local authoritative WebView |
| Next eligible subsection | `1.1` |
| Contract suite | JARVIS v1.0.6 |
| Authoritative implementation sequence | `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` |
| Reference plan | `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md` |
| Production Complete | **NO** |

## Live implementation matrix

### Completed section summary

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 0 — Repository / Platform Contracts / Toolchain / Governance** | **VERIFIED** | — | `Phase 0`; checkpoint: Repository Governance + Platform Boundary + Contract-Drift Protection Ready | 10 CA / 8 scoped | None | `0.1–0.13` and `0.CP` verified; authoritative Phase 0 closure integrated non-force to `master` at `c631f40d678c1f65008dcda4a619cbd37899d599`; post-integration master run `31640702429` PASS |

### SECTION 1 — Desktop Host Foundation

| Section / Subsection | Status | Depends On | Governing Contract / Traceability | Score | Current Gap | Evidence / Result |
|---|---|---|---|---:|---|---|
| **SECTION 1 — Desktop Host Foundation** | **IN PROGRESS** | SECTION 0 | `Phase 1`; checkpoint: Bundled Desktop Host Security Boundary Ready | — | `1.1` is active | — |
| ↳ **1.1** Create Tauri + React desktop workspace with bundled-local authoritative WebView | **IN PROGRESS** | 0.2, 0.8, 0.13 | PLAN §3; RT §§2–5; RP §3; UI §8 | — | Subsection implementation/evidence not yet complete | Contract packet being established from the current v1.0.6 suite |
| ↳ **1.2** Enforce bundled/local-only production content and initial CSP/navigation policy | **NOT STARTED** | 1.1 | IC §26; RT §§2,6; SEC §§8–9; VR §6 | — | — | — |
| ↳ **1.3** Add devtools disablement policy and dev/test-only enablement boundary | **NOT STARTED** | 1.1 | RT §2; SEC §§8,28; VR §6 | — | — | — |
| ↳ **1.4** Bootstrap logging/crash hooks without raw payloads or secrets | **NOT STARTED** | 1.1 | RT §§4,26; SEC §§23,28; DS §18 | — | — | — |
| ↳ **1.5** Add single-instance skeleton and recovery/crash UI shell | **NOT STARTED** | 1.1 | RT §12; DS §20; OX §§3,5; UI §8 | — | — | — |
| ↳ **1.6** Introduce tray/minimize-to-tray shell without changing quit semantics | **NOT STARTED** | 1.5 | RT §3; IC §§7,19; OX §5 | — | — | — |
| ↳ **1.7** Add Windows startup registration bootstrap defaulting OFF | **NOT STARTED** | 1.1 | RT §4; IC §27; RP §4 | — | — | — |
| ↳ **1.8** Render shared JARVIS design-system chrome without embedding business authority in UI | **NOT STARTED** | 1.1 | IC §26; UI §§1–18 | — | — | — |
| ↳ **1.CP** SECTION CHECKPOINT — bundled-content desktop host, devtools boundary, startup/tray/crash shell, design-system chrome | **NOT STARTED** | 1.1–1.8 | PLAN §3 Exit; PLAN §26 checkpoint; RT §§2–6,12; UI §§8–18; VR §§6,14 | — | — | — |

## Future-section status summary

Sections 2–19 remain `NOT STARTED` except contract-permitted optional rows already marked `DEFERRED` in the reference plan. Their complete subsection definitions, dependencies, traceability, and final release-gate ownership remain in `JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md` until each parent section becomes active and is promoted into this live board.

## Maintenance invariants

- Routine progress updates modify this live file only.
- Do not use the reference snapshot's historical status fields to roll back live status.
- Structural/dependency/traceability corrections to the reference plan require an explicit matrix-maintenance change and must remain contract-consistent.
- A parent section becomes `VERIFIED` only after all required child rows and its `*.CP` checkpoint pass.
- `Production Complete` remains available only at `19.27` / `19.CP` after exact signed Windows V1 qualification.
