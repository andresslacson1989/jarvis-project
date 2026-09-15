# Goal: Consolidate and simplify the JARVIS contract without weakening security

Important Rules:&#x20;

- Don't overcomplicate simple tasks&#x20;
- don't make assumptions when something isn't clear&#x20;
- don't make random changes that the goal did not ask&#x20;
- double check the work before shipping or saying it is finished.



Complete a repository-wide contract-consolidation and acceptance-simplification pass for JARVIS.

The objective is to produce a clear, organized, maintainable contract system while reducing duplicate wording, redundant validators, repeated evidence, unnecessary setup, and avoidable acceptance cost. No security control, feature, coverage, failure handling, recovery behavior, enterprise requirement, or mandatory qualification requirement may be removed or weakened.

This task is contract and verification-system work only. Do not implement application features, runtime behavior, UI behavior, provider integrations, or later implementation-matrix subsections.

## Authority

Before every work pass:

1. Re-read `G:\Jarvis Project\AGENTS.md`.
2. Re-read the active contract manifest.
3. Re-read all active normative contract components.
4. Re-read the Release Profile.
5. Re-read the implementation plan and matrix to confirm that application implementation is not being started.

The following remain authoritative:

- `AGENTS.md`
- the active contract manifest
- the six active normative contract components
- `docs/JARVIS-V1-RELEASE-PROFILE.md`
- applicable schemas and generated contract values

The developer goal, implementation matrix, plans, checklists, scores, and reports are execution aids only. They must never weaken or reinterpret the active contracts.

If any contract requirement is unclear or contradictory, stop and report the ambiguity. Do not guess.

## ADR and historical-material prohibition

ADRs, decision records, historical contract overlays, and archived decision material are prohibited as current or historical source authority.

The implementation must:

- migrate every still-valid requirement from old contract, ADR, decision, lineage, archive, and history material into the active contract suite;
- remove obsolete ADR, decision, lineage, and historical contract files from the current tracked repository;
- remove active references that require those materials to determine current behavior;
- ensure no old document remains a hidden authority or implementation dependency;
- allow the terms `ADR`, `decision record`, or equivalent only where required to enforce the prohibition or test rejection of forbidden material;
- never retain an ADR or decision document as source material merely for historical reference.

Do not rewrite Git history unless separately authorized. Historical Git objects are not current authority, but no current tracked file may depend on them.

## Contract consolidation

Consolidate the active contract into a clear organized structure:

- one active manifest;
- six active normative components:
  - J00 governance/coding;
  - J01 runtime/platform/protocol;
  - J02 data/state/backup;
  - J03 security/trust;
  - J04 operations/integrations/UX;
  - J05 verification/release;
- one Release Profile;
- generated contract/schema outputs derived from the manifest.

Remove duplicated or conflicting contract sources. Preserve every still-valid requirement, including:

- platform boundaries;
- Windows V1 qualification;
- data and backup cryptographic rules;
- project-policy trust;
- supply-chain/update trust;
- IPC and process security;
- authorization and PermissionEngine rules;
- provider and integration boundaries;
- UI identity/accessibility requirements;
- atomicity and idempotency;
- failure, cancellation, recovery, and uncertain-state behavior;
- governance, CI, release, provenance, and qualification rules.

Do not shorten requirements by deleting important conditions. Simplify wording only when the same normative meaning remains exact and enforceable.

## Acceptance simplification

Simplify acceptance without weakening security.

The developer must audit the existing acceptance system and remove every unjustified duplicate or redundant layer.

For each retained gate, identify:

- the contract requirement it proves;
- the single canonical command or test that proves it;
- the evidence it produces;
- whether it is local preflight, authoritative CI, live platform evidence, or independent review;
- why it must remain if another gate appears similar.

Acceptance must be simplified by:

- using one canonical check for each requirement where possible;
- removing duplicate checks that prove the same fact;
- reusing verified evidence instead of regenerating equivalent evidence;
- separating mandatory gates from optional diagnostics;
- eliminating redundant wrapper layers that add no validation;
- making every pass/fail condition explicit;
- avoiding subjective scores as substitutes for required evidence;
- preventing the same test from being counted as multiple independent proofs without justification.

Do not simplify by removing:

- security-negative tests;
- adversarial tests;
- failure and recovery tests;
- exact SHA, repository, ref, and artifact identity checks;
- fail-closed behavior;
- authorization and least-privilege checks;
- secret-handling controls;
- platform-native qualification;
- release, provenance, or signed-artifact gates;
- cancellation, timeout, crash, restart, or uncertain-state coverage.

If a seemingly duplicate check protects a different trust boundary, retain it and document the distinction rather than deleting it.

The final report must include before-and-after counts for:

- active contract files;
- retired legacy/ADR/history files;
- acceptance gates;
- duplicate or overlapping checks removed;
- required tests retained;
- evidence types retained.

## Audit-derived correction baseline

Before changing any file, read `AGENTS.md`, this goal, and `docs/implementation/JARVIS-CONTRACT-CONSOLIDATION-AUDIT-FINDINGS.md`. The findings file is a non-normative audit aid. It records the manual review of every active normative component and the contract-control files, measured simplification, residual overlap, and required corrections. It must never be treated as a product or security authority.

The previous consolidation candidate is not automatically approved. The next pass must begin from the findings rather than assuming that fewer filenames or a green local test profile proves simplification. The audited baseline is:

- candidate `8d587ae6ac8f34d40bc03a0b205ea3e4dc647281`;
- base/authoritative `master` at `bb59c13d99c8b472de0dbe08b8f5ce59cf50e705`;
- manifest rows reduced from 15 to 7;
- canonical acceptance commands reduced from 32 to 30;
- directly comparable contract/profile text measured at 9,195 lines before and 9,870 lines after;
- live GitHub `master` is currently server-protected, while the checked-in current governance profile still records the old `COMPENSATING_CONTROLS` state.

The stale current governance profile is a required correction, not an optional documentation cleanup. Do not declare the consolidation complete while current governance facts contradict the authenticated repository state.

## Explicit task boundary

This goal authorizes only contract-document, contract-manifest, contract-derived-output, contract-validation, acceptance-definition, and truthful governance/evidence-record maintenance required by the findings. It does not authorize:

- application runtime, UI, Core, provider, integration, voice, storage, backup, IPC, process, or platform implementation;
- application behavior changes or contract-behavior implementation;
- implementation-matrix status, pointer, score, evidence, or section advancement;
- Section 1.3, Section 1.4, or any later implementation work;
- new implementation branches/worktrees, publication, merge, rebase, or integration;
- an auditor-thread report or handoff;
- treating local tests, LocalCI, GitLab, documentation, or a producer statement as release authority.

All work and generated files for this task must remain inside `G:\Jarvis Project`. Preserve unrelated user work, `.codex-worktrees\`, generated Tauri artifacts, and untracked files. Do not delete outside `G:`.

## Ordered execution checkpoints

### Checkpoint 0 — Freeze and revalidate

1. Read `AGENTS.md`, the findings file, this goal, the active manifest, J00, J01, J02, J03, J04, J05, the Release Profile, the Implementation Plan, and the Matrix.
2. Record branch, exact `HEAD`, live `origin/master`, merge base, tracked/untracked state, and changed-file scope.
3. Confirm that the only active task is contract consolidation and that the matrix will not advance.
4. Do not pull, publish, merge, rebase, delete user files, or edit application source.

### Checkpoint 1 — Establish the requirement ownership map

Create or maintain a reviewable mapping from every current and migrated requirement to one primary normative owner:

- J00 owns scope, repository, package, coding, branch, and CI-authority rules.
- J01 owns runtime/platform roles, protocol types, capability boundaries, IPC, and runtime semantics.
- J02 owns authoritative data/state, transactions, migrations, fixed backup format, and recovery.
- J03 owns security, PermissionEngine, project-policy trust, secrets, TUF/update trust, and security invariants.
- J04 owns operations, integrations, lifecycle, voice, UI identity, design tokens, and accessibility.
- J05 owns tests, evidence, qualification, release gates, and Production Complete.
- The Release Profile owns V1 support scope, artifact boundary, and V1-specific inclusion/exclusion.
- The manifest owns active component identity and revision only.

For every duplicated clause, classify it as canonical, profile-specific, verification-specific, a concise pointer, or unjustified duplication. Do not remove a clause until its complete conditions and proof are mapped to the retained owner.

### Checkpoint 2 — Correct current governance truth

Update only current operational governance records, not historical facts:

- `docs/implementation/governance/repository-governance-profile.json`: record the authenticated live GitHub repository visibility, default branch, server-enforced protection, required `static-ci`, review, force-push, deletion, administrator, and conversation-resolution settings. Separate current evidence from historical capability baselines.
- `docs/implementation/governance/MASTER-PROTECTION.md`: make the current section agree with the machine-readable profile and live GitHub facts. Keep old compensating-control observations only under an unmistakable historical transition heading.
- `docs/implementation/evidence/0.13-master-protection-blocker.md` and `0.CP-phase0-checkpoint.md`: preserve factual historical results, but ensure they cannot be read as current qualification.
- `tools/ci/check-repository-governance.mjs` and related tests: fail closed on stale or internally contradictory current profile fields without treating ordinary local execution as GitHub authority.

Do not invent a live fact. Record the observation source and timestamp. Do not claim current candidate qualification merely because an older run passed.

### Checkpoint 3 — Consolidate active contract wording

Review every line of these files against the findings record:

- `G:\Jarvis Project\docs\JARVIS-CONTRACT-MANIFEST-v1.0.8.md`
- `G:\Jarvis Project\docs\implementation\JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md`
- `G:\Jarvis Project\docs\implementation\JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md`
- `G:\Jarvis Project\docs\implementation\JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md`
- `G:\Jarvis Project\docs\implementation\JARVIS-03-SECURITY-TRUST-CONTRACT.md`
- `G:\Jarvis Project\docs\implementation\JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md`
- `G:\Jarvis Project\docs\implementation\JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md`
- `G:\Jarvis Project\docs\JARVIS-V1-RELEASE-PROFILE.md`

For each file, report an explicit edit or no-change decision. Use cross-references to eliminate duplicate normative definitions, not to hide requirements. Preserve exact values, thresholds, state transitions, security boundaries, failure behavior, recovery behavior, and qualification conditions.

### Checkpoint 4 — Retired-source migration and complete prohibition

1. Compare the active suite with every retired contract, manifest, lineage, decision, archive, and history category listed in the findings file.
2. Maintain a requirement-preservation crosswalk. A deleted filename is not evidence that its valid requirements were migrated.
3. No prohibited historical source may remain in the tracked tree or be required to understand current behavior.
4. The findings file and rejection-test fixtures may name prohibited paths only because they are explicitly non-authoritative enforcement/audit material and are covered by the narrow validator exemption.
5. Do not create, retain, consult, or cite a prohibited historical source as current or historical authority.

### Checkpoint 5 — Simplify acceptance by unique purpose

Review J05, the Release Profile, `.github/workflows/static-ci.yml`, `.localci/ci.sh`, `tools/ci/localci-gate-manifest.mjs`, evidence generation, and related tests.

For each retained gate, record:

- the single contract clause it proves;
- the canonical command/test;
- the output/evidence identity;
- whether it is local preflight, authoritative GitHub Actions, live platform, integration, security/adversarial, recovery/fault, static, or independent evidence;
- whether a similar-looking gate protects a different trust boundary;
- why it remains after simplification.

Remove a gate or wrapper only when the same or stronger proof remains, the trust boundary is unchanged, evidence remains attributable, and execution/maintenance cost is actually reduced. Retain all security-negative, adversarial, failure, recovery, cancellation, timeout, stale-state, exact repository/ref/SHA, platform-native, provenance, signing, and release gates.

Do not add a second command manifest. Keep the one canonical 30-command sequence and improve its traceability with the smallest understandable metadata or catalog needed.

### Checkpoint 6 — Align validators, tests, and generated outputs

File-by-file scope:

- `tools/contract/manifest.mjs`: keep tracked path/name/reference rejection fail-closed; exempt only the exact non-authoritative findings path and test that ordinary tracked files still fail.
- `tools/contract/check-drift.mjs` and `tools/contract/lib.mjs`: preserve deterministic manifest/derived-value checks; remove no security or schema condition.
- `tools/ci/localci-gate-manifest.mjs`: retain exact order, membership, arguments, terminal evidence, command-mutation rejection, and non-authoritative exit behavior.
- `tools/ci/generate-evidence.mjs`: preserve strict identity, timestamp, repository/ref/SHA, runner, artifact, and direct-array validation.
- `tools/checkpoints/phase0-checkpoint.mjs` and profile: keep status/authority/evidence consistency and distinguish current from historical governance.
- `tests/layers/unit/contract-drift.test.mjs`, `localci-compatibility.test.mjs`, governance, Phase 0, static-CI, provenance, security, and architecture tests: extend existing tests only where a changed rule needs proof; do not create a redundant framework.
- generated contract/schema/config outputs: regenerate from canonical sources; never hand-edit generated files.

### Checkpoint 7 — Local-first verification

Run relevant targeted checks first, then the normal local profile, then applicable contract, schema, generated-output, governance, security, provenance, architecture, format, typecheck, build, and platform checks. Fix every failure and rerun until clean. Distinguish local evidence from authoritative evidence.

Do not consume GitHub Actions resources before the local preflight is clean. GitHub Actions may be used only after local success and only when publication is separately authorized. GitLab remains mirror-only; LocalCI remains non-authoritative.

### Checkpoint 8 — Final independent self-check before reporting

Before reporting completion, compare the resulting tree against all of the following:

- this goal;
- the full active manifest and all six active contract components;
- the Release Profile;
- `AGENTS.md`;
- the persistent findings file;
- the requirement-ownership map;
- the gate catalog;
- the no-application-implementation boundary;
- the exact changed-file list and repository state.

Fix every issue found. Do not classify an unresolved issue as complete merely because tests pass. Ship only when no issue remains. If an issue remains, report `NOT COMPLETE` with the exact file, clause, evidence gap, and next correction.

## Required final report

Report to the main thread only. Include:

- exact candidate SHA, branch, base/master SHA, and repository state;
- every changed, deleted, and renamed file;
- findings-file and `AGENTS.md` updates;
- active contract structure before/after;
- line-count, manifest-row, gate-count, and duplicate-check measurements, clearly marked verified or reported;
- the requirement-ownership and retired-source preservation result;
- current governance facts and historical-evidence separation;
- security, feature, failure, recovery, and enterprise-control preservation results;
- local-first commands/results and exact order;
- GitHub Actions evidence only if publication was separately authorized, and exact candidate identity if so;
- GitLab mirror result only if the same GitHub publication was authorized and completed;
- generated-artifact and drift results;
- explicit confirmation that application sources and matrix progression were not touched;
- untracked user work and generated artifacts preserved;
- every remaining limitation;
- final `COMPLETE` only when the acceptance rule is satisfied with no unresolved issue.

Do not claim simplification based only on fewer filenames. The acceptance workflow itself must become clearer and cheaper to execute.

## Local-first verification workflow

Use local tests and builds as a fail-fast preflight before consuming GitHub Actions resources.

The required sequence is:

1. Make the bounded changes on the authorized work branch.
2. Run the relevant targeted local checks.
3. Run the normal local profile.
4. Run applicable contract, schema, generated-output, governance, security, provenance, architecture, format, typecheck, and build checks.
5. Fix all local failures and repeat until the local preflight is clean.
6. Only then publish the exact candidate to GitHub and run GitHub Actions.
7. Treat GitHub Actions as the authoritative CI result.
8. Publish to GitLab only after the corresponding GitHub publication, and retain GitLab as mirror-only.
9. Do not treat LocalCI or ordinary local tests as authoritative CI.

The local and GitHub workflows should reuse the same canonical scripts and gate definitions wherever practical so they do not drift or duplicate work.

The exact candidate SHA, branch, repository, ref, workflow run, jobs, artifacts, and evidence must match. A successful parent or different commit does not qualify the candidate.

## Branch, workspace, and preservation rules

- `master` remains the sole authoritative branch.
- Use only one authorized temporary work branch for this task.
- Do not create additional persistent branches or worktrees.
- Do not directly rewrite or replace `master`.
- Work only inside `G:\Jarvis Project`.
- Never create or delete JARVIS files on `F:`, `C:`, or another drive.
- Do not delete untracked user work, preserved worktrees, or generated artifacts without explicit authorization.
- Preserve unrelated application code and generated Tauri artifacts.
- Do not modify later implementation sections or application behavior.

## File-by-file instructions

### `G:\Jarvis Project\AGENTS.md`

- Preserve the authority hierarchy.
- Ensure it accurately states the consolidated contract structure.
- Ensure ADRs and historical overlays cannot become authority.
- Ensure GitHub Actions is the CI authority and GitLab is mirror-only.
- Ensure LocalCI is not treated as authority.
- Ensure the local-first preflight sequence is clear.
- Do not weaken any existing repository, security, platform, or release rule.

### `G:\Jarvis Project\docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md`

- Keep one canonical active manifest.
- List only the active contract components and Release Profile.
- Preserve exact component revisions and generated-output relationships.
- Remove references that require deleted historical or ADR material.
- Ensure manifest drift fails closed.

### Active J00–J05 contracts

Review and consolidate:

- `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md`
- `docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md`
- `docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md`
- `docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md`
- `docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md`
- `docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md`

For each file:

- preserve all mandatory security and product requirements;
- merge duplicate clauses;
- remove conflicting or obsolete wording;
- keep requirements specific and testable;
- retain failure, recovery, atomicity, idempotency, and qualification requirements;
- do not move normative authority into plans, matrices, evidence notes, or tests.

### `G:\Jarvis Project\docs/JARVIS-V1-RELEASE-PROFILE.md`

- Preserve all release and production-completion gates.
- Keep exact artifact, signing, provenance, platform, security, recovery, integration, and qualification requirements.
- Clarify the distinction between local preflight and authoritative GitHub evidence.
- Do not convert documentation or local tests into release approval.

### Legacy contract, ADR, decision, lineage, and history paths

Inspect all prior material, migrate valid requirements, then remove it from the current tracked source, including applicable paths such as:

- `docs/adr/`
- `docs/decisions/`
- `docs/history/`
- obsolete contract manifests;
- obsolete contract suites;
- contract lineage and historical overlays;
- obsolete implementation contract files.

Do not leave a document that future contributors must consult to understand current behavior.

### `docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md`

Record this complete goal, including:

- consolidation;
- ADR prohibition;
- security-preserving simplification;
- local-first verification;
- GitHub Actions authority;
- GitLab mirror-only status;
- no application implementation;
- no matrix advancement;
- exact reporting requirements;
- the final acceptance rule:

> Check the changes against this goal, the active contract, and `AGENTS.md` before shipping. Fix all issues found. Do not use shortcuts merely to satisfy the goal. Ship only when no issues remain.

### `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`

- Do not advance the execution pointer.
- Do not mark any application subsection verified.
- Do not add implementation evidence for this task.
- Do not begin later sections.
- Only correct stale contract names or links if strictly required by the consolidation.

### Implementation plan, matrix reference, evidence, and governance documents

- Update only references made stale by the contract consolidation.
- Do not fabricate evidence.
- Do not change implementation status, scores, progress, or checkpoints.
- Do not represent local verification as GitHub Actions authority.
- Do not add auditor-thread handoffs for this task.

### Generated contract and schema outputs

Regenerate, do not manually edit:

- `generated/contract/*`
- `packages/protocol/src/config.ts`
- `packages/schemas/src/canonical/*`
- other manifest-derived outputs required by the repository.

Run drift checks to prove that generated values match the active manifest.

### Contract and CI tooling

Review only the tooling needed to enforce the consolidated contract and simplified acceptance:

- `tools/contract/manifest.mjs`
- `tools/contract/check-drift.mjs`
- `tools/contract/lib.mjs`
- `tools/ci/localci-gate-manifest.mjs`
- `tools/ci/check-repository-governance.mjs`
- `tools/ci/generate-evidence.mjs`
- `tools/checkpoints/phase0-checkpoint.mjs`
- applicable package scripts;
- `.github/workflows/static-ci.yml`.

Do not add broad parsers, speculative infrastructure, or unrelated hardening. Keep validators deterministic, bounded, fail-closed, and understandable.

### Tests

Extend existing tests rather than creating redundant frameworks.

Required coverage includes:

- positive contract-manifest validation;
- missing, duplicate, stale, and unknown contract components;
- generated-output drift;
- forbidden ADR/decision/history paths and references;
- Windows and POSIX path forms where relevant;
- tracked versus untracked behavior;
- LocalCI command membership, order, duplication, omission, mutation, and fail-closed behavior;
- local-first versus authoritative GitHub workflow identity;
- security, negative, adversarial, failure, recovery, cancellation, and stale-state behavior where affected.

## Final acceptance gates

Do not report completion until all applicable conditions are true:

- all valid requirements from retired material are represented in the active suite;
- no forbidden ADR/decision/history material remains in the current tracked repository;
- no current behavior depends on historical documents;
- contract security, feature coverage, detail, recovery, and enterprise controls are preserved;
- unjustified duplicate wording and acceptance gates are removed;
- retained gates each have a clear unique purpose;
- local preflight passes first;
- generated artifacts and manifest drift checks pass;
- targeted and normal tests pass;
- typecheck, build, formatting, architecture, governance, security, provenance, and applicable platform checks pass;
- GitHub Actions is used only after local preflight succeeds;
- GitHub Actions qualifies the exact candidate when publication is authorized;
- GitLab remains mirror-only;
- LocalCI is not claimed as authoritative;
- application code and matrix progression remain untouched;
- no prohibited external-drive files were created or deleted;
- no unresolved issue remains.

## Required completion report

Report to the main thread only. Do not send an auditor-thread handoff.

The report must include:

- exact candidate SHA;
- branch and base/master SHA;
- exact changed, deleted, and renamed files;
- active contract structure before and after;
- ADR/history migration results;
- before-and-after acceptance-gate and duplicate-check counts;
- security and coverage preservation results;
- local preflight commands and results;
- GitHub Actions result, if published;
- GitLab mirror result, if applicable;
- generated-artifact and drift results;
- matrix/application-preservation checks;
- untracked files preserved;
- remaining limitations;
- any issue that prevents completion.

Do not call the work complete merely because tests pass. Complete it only when the contract is consolidated, the acceptance process is demonstrably simpler, all security requirements remain intact, and the final review finds no unresolved issue.
