# AGENTS Implementation Rules Plan

**Goal:** Add contract-governed implementation execution rules to `AGENTS.md` so any AI agent follows the same section/subsection matrix, one-subsection-at-a-time loop, hard scoring gates, and production-readiness standards.

**Scope:** Governance documentation only. Do not change product architecture, security semantics, release scope, or any locked normative contract.

## Constraints

- `master` remains the sole authoritative branch.
- Re-fetch live `master` before repository writes.
- Preserve the existing `AGENTS.md` source-of-truth order and non-negotiable principles.
- Contract Accuracy is an absolute `10/10` gate.
- Ordinary quality criteria require `>= 8/10` where applicable.
- Objective contract/test/security/recovery evidence overrides subjective scores.
- Atomicity and idempotency/retry safety are mandatory applicability checks for mutating operations.
- Work one subsection at a time until verified before advancing.
- A section is not verified until all subsections and its section-level integration checkpoint pass.
- `BLOCKED` is reserved for genuine external blockers, not ordinary test/build/implementation failures.

## Change

Modify only `AGENTS.md` to add a dedicated implementation execution protocol covering:

1. contract-as-master-authority rule;
2. implementation matrix and status vocabulary;
3. one-active-subsection execution rule;
4. DRAFT → SCORE → GAPS → CALL loop;
5. mandatory scoring baseline and Contract Accuracy veto;
6. production readiness / production practices / enterprise hardening requirements;
7. atomicity and idempotency/retry-safety rules;
8. objective evidence hierarchy and no-soft-pass rule;
9. section-level checkpoint semantics;
10. checkpoint summary format;
11. blocker semantics;
12. contract-conflict handling and no implementation-driven contract weakening.

## Verification

- Re-fetch `AGENTS.md` after the write.
- Confirm all pre-existing governance sections remain present.
- Confirm the new execution protocol does not contradict the v1.0.5 manifest, Implementation Plan, Release Profile, Coding Standards, Data/State, Runtime, Security, or Verification contracts.
- Confirm no application implementation files were modified.
