# JARVIS Matrix Contract-Traceability Reconciliation Ledger

> **Current-state reconciliation (2026-09-17):** The baseline identities, hashes, and “uncommitted/unpublished” classifications below are retained as historical execution evidence. The separately authorized reconciliation was committed as `d2cc90be`; it must not be attributed to the consolidation-only delta or to the preserved Section 1.4 implementation/evidence. The published combined pre-remediation candidate is `983e25cac90028449876b4f0c8678449bd18b49b`, with passing exact GitHub Actions run `35163261745` and a 25-file normal local profile. Section 1.4 remains `VERIFYING`, and the present correction has no new exact-candidate evidence yet.

**Status:** Non-normative execution evidence. This ledger does not change contract authority, implementation status, sequencing, evidence, or release state.

## Repository and file baseline

- Branch: `codex/contract-consolidation`
- HEAD: `e07d0326dde59c0157d70669d97c3eba165b13d8`
- `origin/master` and merge base: `bb59c13d99c8b472de0dbe08b8f5ce59cf50e705`
- Reconciliation input: uncommitted contract-simplification worktree; no candidate SHA exists.
- Suite: JARVIS v1.0.8.
- Component revisions: J00–J05 and Release Profile 1.0.9.
- Preserved untracked paths include `.codex-worktrees/`, `apps/desktop/src-tauri/gen/`, and `reports/`.

| Protected source | Baseline SHA-256 |
| --- | --- |
| Live matrix | `dd42d0e023521877c8a743471bbd5667836b8f235e90cb1e9772a0a9ade84b55` |
| Matrix Reference | `cd92e47d1c343cec6648cd0244bd833dc03c51ca36f5b8640cae8b69a52d2c80` |
| Implementation Plan | `e3ad5051d338516cf5e2e70954eccff28a8345da3fa3fa00843b1e00c588ccb2` |
| Manifest | `080acb6c60cac64d02c9bfa2600a4a91dcd67dfcc486d23eb99ecaa4345c0a89` |
| Release Profile | `305190d67f90261c745fa85f9f8f696d84f4754d4bb23c19d2e62f7d31b17c68` |
| J00 | `3056762a41c929c7cd958ba75dc4710ec53897af11542aaebff0d3aea7843b9b` |
| J01 | `3a27a2d2473a9ab3e6d8453a4023b30349494d624584eea8d08c01ad059cf220` |
| J02 | `e5041032a904292dcdda6ca75a3ff7b52734fb6b29358ab587879789d0df2fba` |
| J03 | `d2689ce49a15761462ea49f374ab61553813a9216aaa554e2f03bcc2f1724535` |
| J04 | `a691dea1cd923727e22433f4d227272ac213a4c0d037a57c96517e8d7b1775d3` |
| J05 | `efa3ff95c537e094cef109afad2428f9996058f8fae03ad688fecf00d4ad137a` |

## Immutable structural projections

- Live matrix: 19 section/row records; protected-field projection SHA-256 `44fe3533bc192ea97725398375f5db34a645b18a4ba896f8a40ca72477900123`.
- Matrix Reference: 336 section/row records; protected-field projection SHA-256 `c1c1e700449b422a787b52e1477e2d9b3b0d29fcb7a5e9f7f099143f45e845d9`.
- Implementation Plan: 49 phase/checkpoint/order headings; projection SHA-256 `4132a72b045e12f82f8b8df2964680db7310a88427d2ffe2e74c61b41a8f53a1`.
- Historical full SHAs and 11-digit run/job identities: 51 unique values; sorted-set SHA-256 `693811f11eebdbd3dac16e52fc2860584d32a80fc9b58fed9e5fae1a0c09afdb`.
- Sixteen evidence files cited by the live matrix: combined path/hash-list SHA-256 `c46dcdfaaaccf5680625c1b58f35fbd2956894d080b1cc18f04de3559ef00ca7`.
- Protected tracked application/package files excluding canonical contract schemas: 58 files; combined path/hash-list SHA-256 `5ebc5edf26a6597f2806560946b4b383c256bc448b712cfb53da8a7e2fc1e062`.
- Active manifest, Release Profile, and J00–J05: 8 files; combined path/hash-list SHA-256 `fc4001468a8ac29590012613386a31bb800403ebd10fccf3bb53d234d71922aa`.

## Findings and closure

| ID | Evidence | Required correction | Status |
| --- | --- | --- | --- |
| MTR-01 | The three aids identify suite v1.0.8 but do not record the J00–J05/Profile 1.0.9 revision set. The Matrix Reference still names an old reviewed baseline SHA. | Added the revision set to all three aids and truthfully identified the reconciliation input as an uncommitted worktree at HEAD `e07d0326dde59c0157d70669d97c3eba165b13d8`; the original design-review baseline remains separately identified. | CLOSED |
| MTR-02 | Matrix Reference row 4.10 cites obsolete `MAN-04.2`, which is not an active clause. | Removed only `MAN-04.2`; retained J03-POLICY-02, J03-POLICY-04, and J03-POLICY-07 as the complete active owners. | CLOSED |
| MTR-03 | Fourteen live/reference rows repeat the same clause within one traceability cell. | Removed only exact duplicate citations from live row 1.2 and reference rows 1.2, 1.5, 1.7, 3.5, 5.1, 5.8, 5.9, 5.10, 6.3, 7.12, 9.2, 17.1, and 19.27. Every distinct owner and qualifier remains. | CLOSED |
| MTR-04 | Existing manifest validation checks matrix suite/path/role identity but not plan metadata, direct clause resolution, row uniqueness, coverage families, or central-gate count. | Extended the existing manifest validator and focused unit test with fail-closed revision, clause/range, PLAN-section, row-identity, coverage-family, duplicate-reference, 36-gate, protected-field, plan-order, and historical-identity checks. Focused suite passes 33/33. | CLOSED |
| MTR-05 | A fresh hostile review found three detail rows (`3A.6`, `8.6`, `10.5`) and eight checkpoints (`3A.CP`, `6.CP`, `8.CP`, `12.CP`, `15.CP`, `16.CP`, `17.CP`, `19.CP`) that relied only on non-normative PLAN/checkpoint inheritance. | Added the direct active owners for feasibility, scope/path/memory/policy trust, tools, orchestration, supply-chain trust, voice, event deduplication/security, and Production Complete. All 315 detailed rows now contain at least one direct active-contract owner. | CLOSED |
| MTR-06 | Direct-reference resolution did not prove that the eleven newly identified rows retained their complete reviewed owner sets. | Added minimum reviewed-owner sets for all eleven rows and a negative mutation proving omission of the `17.CP` persistence owner fails closed. | CLOSED |
| MTR-07 | Coverage validation checked ordered family labels and non-empty ownership text but could accept a wrong non-empty ownership range. | Bound the complete 15-row coverage-index source/ownership mapping to its reviewed deterministic SHA-256 and added a non-empty ownership-drift mutation. | CLOSED |
| MTR-08 | Release-gate validation formerly checked only ordered numbers. | Bound all 36 central gate numbers, names, and final owners plus all six specialized gate names and owners to reviewed mappings; negative owner mutations fail closed. | CLOSED |

## Row-group reconciliation coverage

Every row belongs to exactly one group below. A group closes only after all of its row citations resolve and its protected-field projection is unchanged.

| Group | Scope | Baseline result | Final result | Status |
| --- | --- | --- | --- | --- |
| LIVE-IDENTITY | Live matrix identity, pointer, and maintenance invariants | Suite present; component revisions absent | Suite v1.0.8 and revision set 1.0.9 present; pointer and invariants unchanged | CLOSED |
| LIVE-0 | Live Section 0 and 0.1–0.CP | All direct clause endpoints resolve | All endpoints resolve; protected projection unchanged | CLOSED |
| LIVE-1 | Live Section 1 and 1.1–1.3 | One duplicate J01-RT-05 citation | Exact duplicate removed; distinct owners retained; protected projection unchanged | CLOSED |
| REF-IDENTITY | Reference identity, legend, progressive map, archived pointer | Old reviewed baseline; component revisions absent | Current uncommitted input and 1.0.9 revisions stated; historical baseline and archived pointer preserved | CLOSED |
| REF-0 | Reference Section 0 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-1 | Reference Section 1 | Three duplicate citations | Exact duplicates removed; all distinct owners retained | CLOSED |
| REF-2 | Reference Section 2 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-3 | Reference Sections 3 and 3A | One duplicate citation | Exact duplicate removed; all distinct owners retained | CLOSED |
| REF-4 | Reference Section 4 | Obsolete MAN-04.2 plus one duplicate citation | Obsolete subsection and exact duplicate removed; active owners retained | CLOSED |
| REF-5 | Reference Section 5 | Three duplicate citations | Exact duplicates removed; all distinct owners retained | CLOSED |
| REF-6 | Reference Section 6 | One duplicate citation | Exact duplicate removed; all distinct owners retained | CLOSED |
| REF-7 | Reference Section 7 | One duplicate citation | Exact duplicate removed; all distinct owners retained | CLOSED |
| REF-8 | Reference Section 8 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-9 | Reference Section 9 | One duplicate citation | Exact duplicate removed; all distinct owners retained | CLOSED |
| REF-10 | Reference Section 10 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-11 | Reference Section 11 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-12 | Reference Section 12 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-13 | Reference Section 13 | RP-09.1 subsection references resolve semantically | RP subsection reference retained and verified | CLOSED |
| REF-14 | Reference Section 14 | RP-09.2 subsection references resolve semantically | RP subsection reference retained and verified | CLOSED |
| REF-15 | Reference Section 15 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-16 | Reference Section 16 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-17 | Reference Section 17 | One duplicate citation | Exact duplicate removed; all distinct owners retained | CLOSED |
| REF-18 | Reference Section 18 | All direct clause endpoints resolve | All endpoints resolve; structure unchanged | CLOSED |
| REF-19 | Reference Section 19 | One duplicate citation | Exact duplicate removed; Production Complete endpoint retained | CLOSED |
| REF-COVERAGE | Coverage index, 36 central gates, specialized gates, non-goals, maintenance | All 14 active source families and 36 central gates represented | Complete 15-row index (14 active source families plus PLAN role), exact gates 1–36, and six specialized mappings are locked and validated | CLOSED |
| PLAN-0-5A | Plan identity and Phases 0–3A | Suite present; component revisions absent; order retained | Revision set added; phase/checkpoint order and obligations unchanged | CLOSED |
| PLAN-6-14 | Plan Phases 4–12 | No direct clause IDs; implementation obligations retained | PLAN-section references resolve; obligations and order unchanged | CLOSED |
| PLAN-15-21 | Plan Phases 13–19 | Capability/release obligations retained | Capability/release obligations and order unchanged | CLOSED |
| PLAN-22-27 | Workflow, future/post-V1, checkpoints, governing principles | Phase/checkpoint order retained | All 49 protected phase/checkpoint/order headings retained exactly | CLOSED |

## Evidence classification

All live-matrix evidence remains historical implementation evidence or still-relevant behavioral evidence under its recorded source/run identity. No current exact-candidate revision-1.0.9 evidence exists because the reconciliation input is uncommitted and unpublished. No evidence file may change under this goal.

## Closure rule

No row or finding may be marked closed until final-tree validation proves direct-reference resolution, metadata consistency, protected-field equality, historical-identity equality, coverage completeness, and the absence of prohibited file changes.
