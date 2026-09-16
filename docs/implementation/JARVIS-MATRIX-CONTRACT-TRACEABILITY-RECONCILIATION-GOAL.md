# JARVIS Matrix and Plan Contract-Traceability Reconciliation Goal

## 1. Objective

Synchronize the non-normative Implementation Matrix, Matrix Reference, and Implementation Plan with the final consolidated active contract structure without changing implementation progress, historical evidence, product behavior, contract meaning, or release state.

The governing contract suite remains JARVIS v1.0.8. The current component revision set is:

```text
J00  1.0.9
J01  1.0.9
J02  1.0.9
J03  1.0.9
J04  1.0.9
J05  1.0.9
Release Profile  1.0.9
```

This task is a documentation and traceability reconciliation only. It SHALL make each matrix row, coverage index, plan phase, checkpoint, and release-gate mapping accurately point to the final active owners after consolidation.

It does **not** authorize:

- application implementation, refactoring, tests for new application behavior, or package changes;
- normative contract, manifest, Release Profile, canonical schema, or generated-contract changes;
- status, score, current-gap, execution-pointer, dependency-order, or section-progression changes;
- rewriting, upgrading, invalidating, or replacing historical implementation evidence;
- evidence advancement, release qualification, publication, push, integration, audit handoff, or `Production Complete`;
- ADRs, decision records, historical overlays, or a new source of authority.

## 2. Governing agreement

The completed reconciliation must satisfy all of these requirements together:

1. The manifest, J00–J05, and Release Profile remain the only normative product authority.
2. The live matrix remains the sole non-normative status/control board; the Matrix Reference remains a non-current structural/dependency/traceability reference; the Implementation Plan remains a non-normative sequencing aid.
3. Every matrix and plan contract citation resolves to an active clause and accurately covers the row or phase it governs.
4. Consolidated owner references replace stale or redundant references without narrowing the implementation obligation.
5. Historical evidence remains immutable historical evidence. Its SHA, run identity, result, scope, and original contract context must not be altered.
6. Evidence generated under an earlier component revision must not be represented as exact-candidate proof of the revision-1.0.9 contract documents.
7. Contract-only reconciliation must not change `VERIFIED`, `IN PROGRESS`, `NOT STARTED`, `DEFERRED`, score, gap, or completion values.
8. GitHub Actions remains mandatory CI authority; GitLab remains mirror-only; LocalCI remains non-authoritative compatibility/security tooling.
9. Windows remains the mandatory V1 `FULL_HOST`; Linux/full-host and companion support remain future and truthful.
10. No feature, security requirement, failure path, threshold, verification gate, release veto, or roadmap obligation may disappear from matrix/plan traceability.

## 3. Files in scope

### Primary files permitted to change

- `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`
- `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md`
- `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`

### Permitted validation changes

Only if required to enforce this reconciliation:

- existing matrix/plan reference validators;
- existing contract-drift or Phase 0 validators that already validate matrix identity or references;
- focused unit tests for those validators;
- one non-normative reconciliation ledger and one final report.

Do not add a new validation framework when an existing validator can be extended.

### Read-only authority and evidence inputs

- `AGENTS.md` and applicable nested instructions;
- `docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md`;
- `docs/JARVIS-V1-RELEASE-PROFILE.md`;
- all six active J00–J05 components;
- canonical contract values and generated contract outputs;
- the contract simplification findings, preservation ledger, and final closure report;
- evidence files referenced by affected matrix rows;
- current repository governance and CI configuration when needed to verify wording.

### Protected files

All application source, packages except an explicitly authorized existing read-only validator test, schemas, generated contract artifacts, contract authority files, evidence records, workflow behavior, and release artifacts are protected from modification.

## 4. Mandatory preparation

Before editing:

1. Read this goal, root `AGENTS.md`, the active manifest, Release Profile, J00–J05, all three primary files, the preservation ledger, and final closure report completely.
2. Revalidate branch, HEAD, `origin/master`, merge base, tracked modifications, and preserved untracked paths without pulling, resetting, cleaning, deleting, or overwriting anything.
3. Confirm that the contract simplification working tree is the intended input. If contract text is still changing concurrently, stop as `NEXT PASS` rather than reconciling against an unstable target.
4. Record hashes for:
   - all three primary files;
   - active manifest, J00–J05, and Release Profile;
   - every evidence file cited by a row whose wording may change;
   - application source and protected normative artifacts.
5. Capture an immutable baseline of every live-matrix field that is not authorized to change:
   - section/subsection identifier and title;
   - status;
   - dependencies;
   - score;
   - current gap;
   - evidence/result text;
   - active execution pointer;
   - Production Complete value.
6. Capture the Matrix Reference row IDs, dependencies, archived status values, and release-gate ownership before editing.
7. Enumerate every direct `MAN-*`, `RP-*`, `J00-*` through `J05-*`, `PLAN §*`, phase, subsection, and checkpoint citation in all three files.
8. Create a persistent reconciliation ledger with one row per matrix/plan row or inseparable row group. Record old citations, required behavior, final owner citations, evidence classification, validation result, and status.

## 5. Required reconciliation work

### 5.1 Document identity and revision metadata

1. Retain contract suite identity `JARVIS v1.0.8` everywhere it correctly identifies the product-rule suite.
2. Add or update a clear component-revision statement showing J00–J05 and Release Profile revision 1.0.9 where matrix/plan review identity is recorded.
3. Update the Matrix Reference's reviewed-contract baseline to the actual reconciliation candidate identity or explicitly state `UNCOMMITTED WORKTREE` until a commit exists. Never invent a SHA.
4. Distinguish suite version from component revisions. Do not rename the suite to v1.0.9.
5. Preserve historical references to v1.0.7 or earlier when they accurately describe old evidence; label them historical and non-qualifying for the current contract candidate.

### 5.2 Live Implementation Matrix

For every live row, including Section 0, Section 1, checkpoints, and the future-section summary:

1. Verify that each governing clause exists in the final active suite.
2. Verify that the cited clauses collectively cover the row title, implementation boundary, security behavior, platform scope, and checkpoint obligation.
3. Replace stale pre-consolidation ownership with the final canonical owner and retain any distinct dependent owner needed for persistence, security, operations, or verification.
4. Remove accidental duplicate citations, such as repeated identical clause references, without removing distinct owners.
5. Do not change status, dependency, score, gap, evidence, title, or execution pointer merely because a citation changes.
6. Do not claim the contract-simplification candidate reverified an implementation row.
7. Preserve the statement that historical Phase 0 evidence does not automatically qualify the current consolidated contract candidate.
8. If a row's current status or evidence statement is factually contradicted by the active contract and cannot be corrected without changing a protected field, record a blocker in the ledger and stop as `NEXT PASS`.

### 5.3 Matrix Reference

Review every row in Sections 0–19, all checkpoints, the contract coverage index, the 36 central release-gate mappings, design-assurance sections, and maintenance instructions.

For each row:

1. Confirm its subsection definition still expresses all implementation obligations selected by the active contract.
2. Confirm every direct clause reference resolves and points to the complete final owner.
3. Add missing final owners where consolidation exposed an incomplete mapping.
4. Remove only citations that are exact duplicates or demonstrably superseded by a complete owner reference.
5. Preserve dependencies, archived status cells, subsection order, optional/deferred behavior, and checkpoint topology byte-for-byte unless formatting around citations makes that impossible.
6. Do not treat archived reference statuses as current status.
7. Reconcile the coverage index so every active clause family has implementation and/or qualification ownership and no family is silently omitted.
8. Reconcile the release-gate map with the final J05 owners without changing the number, mandatory nature, or cumulative meaning of the gates.
9. Preserve `19.27`/`19.CP` as the only `Production Complete` endpoint.

### 5.4 Implementation Plan

For every phase, exit criterion, checkpoint, definition-of-done section, and final qualification section:

1. Verify direct contract references against the final active owners.
2. Update only stale citations, contract-component revision metadata, and explanatory ownership language.
3. Preserve Phase 0→19 macro-order, subsection intent, dependencies, exit criteria, and final qualification requirements.
4. Do not redesign sequencing or add/remove implementation work under this goal.
5. Do not change a phase because its implementation has or has not progressed; status belongs to the live matrix.
6. Preserve exact V1 scope, Windows support, future-platform boundaries, backup/security/trust requirements, and Production Complete criteria.
7. If consolidation reveals a true sequencing or dependency defect, record it as a separate finding and stop as `NEXT PASS`; do not silently repair architecture or execution order.

### 5.5 Historical evidence classification

For every live row with evidence:

1. Preserve all candidate SHAs, run IDs, artifact identities, dates, and pass/fail outcomes exactly.
2. Classify evidence as one of:
   - historical implementation evidence under its original contract context;
   - still-relevant behavioral evidence for an unchanged requirement;
   - current exact-candidate contract evidence, only if an exact matching authoritative run actually exists.
3. Do not downgrade a historical implementation result merely because traceability was consolidated.
4. Do not upgrade historical evidence into current revision-1.0.9 or exact-candidate qualification.
5. Add minimal clarification only when the present wording could falsely imply current-candidate proof.
6. Never edit the underlying evidence file during this goal.

### 5.6 Traceability validation

Extend existing validation, if necessary, to prove:

1. every direct clause citation resolves to an active unique clause;
2. no matrix or plan citation points to a prohibited/retired contract path;
3. suite `1.0.8` and component/Profile revision `1.0.9` are not conflated;
4. all live matrix row IDs are unique;
5. all Matrix Reference subsection IDs are unique;
6. every live detailed row has a matching structural row in the Matrix Reference where applicable;
7. status, dependency, score, gap, evidence, execution pointer, and Production Complete values match the immutable baseline;
8. the coverage index includes every active contract family;
9. all central and specialized release-gate owners remain represented;
10. no ADR, decision record, or historical overlay is introduced as authority.

Prefer parsed structural validation over substring-only checks. Add negative mutations proving stale clauses, missing coverage families, duplicate rows, suite/revision confusion, and protected-field changes fail.

## 6. Independent review and correction loop

Repeat this loop until it reaches a truthful terminal state.

### Loop A — hostile traceability review

1. Re-read the final versions of all three primary files and the active contract suite.
2. Treat every existing citation and prior `reconciled` claim as untrusted until verified.
3. Search for unresolved, obsolete, circular, generic, duplicated, or incomplete citations.
4. Search for requirements with no matrix owner, matrix rows with no complete contract owner, and release gates with no final execution owner.
5. Compare protected live fields and Matrix Reference structure with the immutable baseline.
6. Check historical evidence wording for false current-candidate implications.
7. Add every discovered issue to the reconciliation ledger as `OPEN` before correcting it.

### Loop B — bounded correction

For each open traceability issue:

1. Identify the exact active owner clause and distinct dependent obligations.
2. Change only the smallest citation, metadata, or explanatory text needed.
3. Keep all protected fields and evidence identities unchanged.
4. Run the focused resolver/coverage/protected-field test.
5. Mark the ledger row closed only after the final citation resolves and semantically covers the row.

### Loop C — repeat-until-terminal decision

Continue until one state applies:

- **COMPLETE:** no unresolved, stale, duplicate, incomplete, or misleading traceability remains; no protected field changed; every applicable check passes; or
- **NEXT PASS:** a normative ambiguity, sequencing defect, status/evidence contradiction, unstable contract input, or need for application/governance authority prevents safe reconciliation.

Do not reinterpret a blocked semantic issue as documentation cleanup.

## 7. Required verification

Run, at minimum:

1. focused matrix/plan citation-resolution and protected-field tests;
2. clause-ID uniqueness and direct-reference resolution;
3. matrix row-ID and subsection-ID uniqueness;
4. coverage-index and release-gate ownership validation;
5. contract generation, manifest, and drift checks;
6. schema checks when existing matrix validators consume canonical values;
7. governance and prohibited ADR/decision/history-path checks;
8. normal local test profile;
9. format check;
10. `git diff --check`;
11. a final changed-file audit proving no application, evidence, normative contract, workflow, generated-contract, schema, or release-artifact file changed.

The final audit must explicitly compare the following before/after values:

- all live statuses;
- all live scores;
- all live current-gap fields;
- all live evidence/result fields except explicitly approved minimal classification wording, listed individually;
- current execution pointer;
- all dependencies and subsection order;
- all historical SHAs and run IDs;
- Production Complete value;
- Matrix Reference archived statuses;
- Implementation Plan phase/checkpoint order.

Local results are supplementary. Do not claim exact-candidate GitHub Actions evidence unless a published exact SHA and matching successful authoritative run exist.

## 8. Hard acceptance criteria

The goal is complete only when all of these are proven:

1. All three primary files identify suite v1.0.8 and the current component/Profile revision set accurately where applicable.
2. Every direct active-contract citation resolves and semantically covers its row, phase, or gate.
3. Every active contract family and release gate has complete matrix/plan ownership.
4. No status, score, gap, dependency, execution pointer, phase order, checkpoint order, evidence identity, archived status, or Production Complete value changed without authorization.
5. Historical evidence remains truthful and is not represented as exact current-contract-candidate qualification.
6. No application, contract, evidence, schema, generated-contract, workflow, release, or product behavior change occurred.
7. No ADR or decision record was created, cited, retained, or used as authority.
8. The final hostile pass finds no open reconciliation item.
9. All applicable local checks pass.
10. The persistent ledger and final report describe the final tree exactly.

Any failed, unknown, contradictory, or unproven criterion requires `NEXT PASS`.

## 9. Required final report

Create `docs/implementation/JARVIS-MATRIX-CONTRACT-TRACEABILITY-RECONCILIATION-REPORT.md` only after the final hostile pass. It must include:

- branch, baseline HEAD, base/merge-base identity, and final uncommitted/candidate state;
- exact changed files and file-by-file purpose;
- suite and component revision identities;
- every corrected matrix/plan citation grouped by row or phase;
- every discovered gap and final status;
- before/after proof for protected fields;
- evidence classifications and confirmation that all SHAs/run IDs remain unchanged;
- clause, row, coverage, and release-gate validation counts;
- complete local validation results;
- ADR/decision-record result;
- protected-path result;
- exact GitHub Actions evidence limitation;
- explicit statement that matrix reconciliation is not implementation progress, release qualification, or `Production Complete`.

Do not commit, push, publish, integrate, advance the implementation pointer, request an audit, or begin application implementation under this goal.
