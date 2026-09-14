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
