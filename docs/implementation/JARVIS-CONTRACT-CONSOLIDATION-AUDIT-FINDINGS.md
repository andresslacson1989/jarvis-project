# JARVIS Contract Consolidation Audit Findings

**Status:** non-normative audit aid; it is not a contract, authority, approval, implementation plan, matrix, or release qualification record.

**Audit date:** 2026-09-15

**Audited candidate:** `8d587ae6ac8f34d40bc03a0b205ea3e4dc647281`

**Audited branch:** `codex/contract-consolidation`

**Base / authoritative master at audit start:** `bb59c13d99c8b472de0dbe08b8f5ce59cf50e705`

**Repository boundary:** `G:\Jarvis Project` only. No JARVIS files were read from or written to another drive for this audit.

## Purpose and limits

This file records the independent audit requested before another optimization pass. It exists so a later consolidation pass can resume from evidence instead of repeating assumptions. It must remain non-normative. The active manifest, J00–J05, Release Profile, and applicable `AGENTS.md` instructions remain authoritative.

This audit concerns contract organization, contract wording, acceptance design, governance/evidence truth, and the validators that enforce those documents. It does not authorize application implementation, runtime behavior changes, UI feature work, provider integration work, matrix advancement, publication, merge, or release approval.

The audit distinguishes:

- **Verified:** directly measured or read from the current tree, Git history, or authenticated live repository response.
- **Reported:** stated by the developer or an earlier report but not independently reproduced in this pass.
- **Required correction:** a concrete change needed before the consolidation goal can be considered complete.

## Audit method

The following were read and compared manually against the current active suite, the manifest, `AGENTS.md`, the Release Profile, the implementation aids, the current candidate diff, and the live GitHub governance response:

1. `AGENTS.md` in full.
2. `README.md` in full.
3. `docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md` in full.
4. `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` in full.
5. `docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md` in full.
6. `docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md` in full.
7. `docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md` in full.
8. `docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md` in full.
9. `docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md` in full.
10. `docs/JARVIS-V1-RELEASE-PROFILE.md` in full.
11. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`, `JARVIS-IMPLEMENTATION-MATRIX.md`, and `JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md` as execution aids.
12. Current governance profile, `MASTER-PROTECTION.md`, the historical LocalCI exception, Phase 0 profile/checker, current evidence records, generated contract outputs, and the contract/CI validation tooling that enforces them.
13. The current candidate diff against `origin/master`, including the retired contract, decision, lineage, and history inventory.

The deleted historical source inventory is recorded below so it cannot silently become a second authority. Deleted material is not restored or consulted as current authority by this audit.

## Initial audit decision — historical baseline

**The candidate is not approved as a finished contract-consolidation result.**

The reason is not a demonstrated loss of application security or feature behavior. The blocking issue is contract/evidence truth: the live GitHub repository is public and has active `master` branch protection, while the checked-in current governance profile and current `MASTER-PROTECTION.md` still describe a private repository with unavailable server protection and `COMPENSATING_CONTROLS`. A second issue is that the file count and gate count were reduced, but the active normative text became longer than the directly comparable prior contract set and still repeats substantial requirements across J00–J05, the Release Profile, `AGENTS.md`, the manifest, and J05 acceptance clauses. The next pass must simplify that repetition without deleting security controls.

## Measured simplification versus remaining complexity

### Verified simplification

| Measure | Before (`origin/master`) | Current candidate | Result |
|---|---:|---:|---|
| Manifest rows / listed authority entries | 15 | 7 | 8 fewer rows; 53.3% fewer listed entries |
| Active component model | one large implementation contract plus 14 additional manifest entries | six J00–J05 components plus one Release Profile | clearer ownership, subject to cross-reference cleanup |
| Canonical LocalCI acceptance commands | 32 | 30 | 2 command definitions removed; 6.25% reduction |
| LocalCI script gate invocations excluding terminal evidence | 32 | 30 | sequence is now derived from the 30-command manifest |
| Deleted tracked ADR/decision/history/legacy-contract paths | none in the current candidate tree | 92 paths deleted in the candidate diff | prohibited source material no longer appears in the tracked candidate tree |
| Current active contract files, counting manifest, six components, and Release Profile | 16 listed authority files in the old manifest model | 8 current authority files | fewer authority surfaces, not proof by itself of semantic simplification |

The last row is a structural count. It must not be used as a substitute for proving requirement preservation.

### Verified evidence that simplification is incomplete

The directly comparable old contract/profile files total **9,195 lines** at `origin/master`. The current manifest, six components, and Release Profile total **9,870 lines**. The current suite therefore contains **675 more lines, approximately 7.34% more**, even though it has fewer authority entries. Line count alone does not prove that a requirement is unnecessary, but it disproves any claim that the consolidation has already simplified the normative prose by volume.

The current suite still contains the following overlapping ownership patterns:

- governance and CI authority are stated in the manifest, J00, J05, the Release Profile, `AGENTS.md`, README summaries, the governance profile, and `MASTER-PROTECTION.md`;
- platform/runtime capability rules appear in J00, J01, J04, J05, and the Release Profile;
- DataPolicy, KDF floors, state machines, approval canonicalization, provider setup states, and capability boundaries are repeated across J01, J02, J03, J04, J05, and the Release Profile;
- J05 contains 39 verification subsections and a broad production gate set while J04 and the Release Profile restate many of the same qualification subjects;
- `AGENTS.md`, the manifest, the goal, tests, and validators each repeat parts of the no-historical-source and CI-authority rules;
- acceptance tooling is more coherent than before, but its 30-gate sequence still contains many build, audit, evidence, and platform checks whose ownership and evidence reuse must be explicitly documented rather than assumed to be unique.

No exact percentage of semantic duplication is claimed. Semantic duplication must be resolved by a clause-to-clause ownership map, not by counting matching words.

### Security-preservation conclusion

The audit found no evidence that the current consolidation removed the fixed backup format, key separation, KDF floor, project-policy trust, TUF/update trust, PermissionEngine, IPC, process containment, least-privilege, fail-closed, exact identity, recovery, or Windows qualification requirements. Those controls are still present in the active suite. However, their continued presence is not enough: the next pass must prove that each control has one authoritative owner, complete cross-references, and a retained verification proof. A shorter document is unacceptable if it drops a condition or makes enforcement ambiguous.

## Blocking and non-blocking findings

### P0 — current governance facts are stale and contradict live GitHub

**Files:**

- `docs/implementation/governance/repository-governance-profile.json`
- `docs/implementation/governance/MASTER-PROTECTION.md`
- current governance/evidence references that present the old mode as current

**Verified live facts from authenticated GitHub API:**

- repository visibility: `public`;
- default branch: `master`;
- required status check: `static-ci` with strict checks;
- required approving reviews: `1`;
- administrator enforcement: enabled;
- force pushes: disallowed;
- branch deletion: disallowed;
- required conversation resolution: enabled.

**Contradictory checked-in current claims:**

- governance mode `COMPENSATING_CONTROLS`;
- server-side protection unavailable and inactive;
- private repository under a plan limitation;
- residual risk that administrator force-push or deletion is not server-blocked.

**Required correction:** update current governance records to the live `SERVER_ENFORCED` state, preserve the prior compensating result only as clearly labeled historical transition evidence, and ensure the validator checks the current profile’s internal consistency. Do not erase factual historical evidence; do not let it remain the current authority.

**Why it matters:** J00-GOV-28, J05-VER-33, and RP-17 require server enforcement when it is available. A green local governance check is not sufficient when the checked-in profile itself contains stale facts.

### P1 — normative ownership is not yet sufficiently centralized

**Affected files:** J00, J01, J02, J03, J04, J05, Release Profile, manifest, `AGENTS.md`, README, and governance aids.

**Finding:** the new six-component structure is clearer, but common requirements are restated with independent normative wording in several components. The most sensitive examples are governance/CI authority, platform support, DataPolicy, KDF floors, approval digest/canonicalization, provider setup, state semantics, capability matrices, and release qualification.

**Required correction:** create a requirement ownership map inside the consolidation work product, then make one file the canonical normative owner for each shared rule. Other files may retain short profile-specific constraints and traceability references, but must not introduce a second conflicting definition. Preserve all exact values and conditions.

### P1 — acceptance simplification is not yet proven at the requirement level

**Affected files:** J05, Release Profile, `.github/workflows/static-ci.yml`, `.localci/ci.sh`, `tools/ci/localci-gate-manifest.mjs`, evidence generators, and related tests.

**Finding:** the command manifest is now canonical and has 30 gates, which is a real improvement. The current change does not yet prove, for every gate, a one-to-one requirement, unique evidence purpose, retained trust boundary, and reuse policy. J05, the Release Profile, and CI tooling still describe overlapping acceptance obligations.

**Required correction:** produce a compact gate catalog with gate ID, owning contract clause, canonical command, output/evidence, authority class, retained rationale, and whether another gate is only a prerequisite or an independent control. Remove only demonstrably redundant wrappers or duplicate proofs. Retain security-negative, adversarial, failure, recovery, exact-identity, platform-native, provenance, and release gates.

### P1 — source-of-truth list does not yet point to the persistent findings record

**File:** `AGENTS.md`.

**Required correction:** add `docs/implementation/JARVIS-CONTRACT-CONSOLIDATION-AUDIT-FINDINGS.md` to the first source list immediately after `README.md`, explicitly labeled as a non-normative audit aid. It must not be promoted to contract authority.

### P2 — validator scope must explicitly handle this non-authoritative audit file

**Files:** `tools/contract/manifest.mjs`, `tests/layers/unit/contract-drift.test.mjs`.

**Finding:** this findings record must inventory prohibited retired source names and paths so the audit is reproducible. The tracked-content rejection rule would otherwise treat the audit inventory as an active forbidden reference. That is a tooling-scope issue, not permission to weaken enforcement.

**Required correction:** add this exact non-authoritative findings path to a narrowly documented exemption, and add a regression asserting that the exemption applies only to this audit aid while ordinary tracked files remain rejected. Do not broaden the exemption to a directory, wildcard, or application source.

### P2 — historical evidence and current operational truth need clearer separation

**Files:** `docs/implementation/evidence/0.13-master-protection-blocker.md`, `docs/implementation/evidence/0.CP-phase0-checkpoint.md`, `docs/implementation/governance/LOCALCI-CT107-QUALIFICATION-EXCEPTION-2026-09-04.md`, and related evidence.

**Finding:** the cited records are labeled historical or non-authoritative in places, but their old governance language can be mistaken for current mode when read beside the stale current governance profile.

**Required correction:** retain factual historical records, add an unmistakable historical/non-current banner where needed, and make current profile and current operational aid reference the live state. Do not rewrite old evidence to make it appear that the old run occurred under today’s governance.

## File-by-file findings and required edits

The following list is the review record for every current normative contract file and every contract-control file in scope. “Required edit” means the next consolidation pass must either make the edit or document a technically justified no-change decision in its final report.

### Authority and entry-point files

#### `AGENTS.md`

- **Reviewed:** yes, full file.
- **Role:** repository instruction and contract entry point; not a product component.
- **What is simplified:** the authority list now points to the consolidated v1.0.8 suite and states GitHub Actions authority, GitLab mirror-only, and LocalCI non-authority.
- **Remaining issue:** the source list omits this persistent audit record. Conditional governance wording is valid, but current truth must be taken from the live profile rather than stale evidence.
- **Required edit:** add the findings file as item 2, labeled non-normative; keep the active manifest/J00–J05/Release Profile hierarchy; avoid duplicating detailed normative rules already owned by J00/J05.

#### `README.md`

- **Reviewed:** yes, full file.
- **Role:** orientation and authority summary.
- **What is simplified:** it directs readers toward the v1.0.8 suite and does not claim to be the contract.
- **Remaining issue:** summary text can drift from J00/J05 and the live governance profile.
- **Required edit:** keep only concise navigation and non-conflicting summary language; reference the active manifest and current governance aid rather than restating detailed conditional rules. No application behavior edit.

#### `docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md`

- **Reviewed:** yes, full file.
- **Role:** canonical component index and manifest authority.
- **What is simplified:** 15 old manifest rows became 7 active component rows; the suite is explicitly v1.0.8.
- **Remaining issue:** MAN-04 and MAN-07 repeat governance and historical-source prohibitions that are also normative in J00/J03/J05. The repetition is useful as an index, but the wording must not diverge.
- **Required edit:** retain the seven-row index and exact revisions; reduce detailed normative restatement to concise pointers to the owning clauses; keep manifest drift and fail-closed identity checks.

#### `docs/JARVIS-V1-RELEASE-PROFILE.md`

- **Reviewed:** yes, full file.
- **Role:** V1 support scope and release qualification authority.
- **What is simplified:** the profile is a single explicit V1 target instead of relying on several older profile/contract overlays.
- **Remaining issue:** it repeats platform, security, integration, UI, voice, governance, and acceptance requirements owned by J01–J05. RP-17’s conditional fallback is correct, but current governance evidence under it is stale.
- **Required edit:** retain profile-specific V1 scope, thresholds, exclusions, and release gates; replace duplicated general rules with exact J01–J05 references; update current governance facts and preserve the fallback only as a conditional rule.

### Active normative components

#### `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md`

- **Reviewed:** yes, full 1,030-line file.
- **Role:** scope, governance, coding, repository, package, and cross-cutting engineering rules.
- **What is simplified:** coding/package/platform boundaries formerly spread across multiple files have one named home.
- **Remaining issue:** J00 repeats backup, KDF, provider, UI, platform, and CI details that are more precise in J01–J05. J00-GOV-28 and J00-CODE-28 also overlap internally.
- **Required edit:** make J00 canonical for repository governance, package boundaries, coding invariants, and cross-cutting engineering rules; move or reference detailed runtime, backup, security, operations, and release semantics instead of repeating them. Preserve the exact GitHub Actions-only authority, GitLab mirror-only rule, LocalCI limitation, branch protection condition, and no-history-source rule.

#### `docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md`

- **Reviewed:** yes, full 2,691-line file.
- **Role:** platform roles, runtime composition, IPC, protocol types, capability boundaries, and runtime state semantics.
- **What is simplified:** runtime/platform/protocol requirements formerly split among several contracts now have one principal component.
- **Remaining issue:** DataPolicy, KDF, approval canonicalization, provider states, capability lists, and some security/release summaries are duplicated in J02, J03, J05, and the Release Profile.
- **Required edit:** keep J01 canonical for runtime/platform/protocol definitions and exact shared protocol values; replace repeated release-test descriptions with J05 references; do not weaken Windows FULL_HOST, capability boundaries, Job Object limitations, IPC, or degraded-mode truthfulness.

#### `docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md`

- **Reviewed:** yes, full 1,344-line file.
- **Role:** authoritative data/state/transaction/backup and recovery contract.
- **What is simplified:** the data and backup material is grouped into one component rather than separate active authority files.
- **Remaining issue:** state enums, DataPolicy, KDF profile language, approvals, provider state, and recovery evidence are repeated in J01/J03/J05/RP.
- **Required edit:** make J02 canonical for SQLite/SQLCipher state, transaction/atomicity, migration, backup classes, fixed `JARVIS_BACKUP_V1`, key separation, recovery slots, restore, rotation, and corruption behavior. Other files must reference J02 rather than restating cryptographic parameters. Do not change AEAD, nonce, tag, framing, AAD, key hierarchy, recovery-factor, or DPAPI requirements.

#### `docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md`

- **Reviewed:** yes, full 1,492-line file.
- **Role:** security, trust, project-policy, supply-chain, permission, secret, IPC, and update trust authority.
- **What is simplified:** threat, policy, and supply-chain rules are presented in one security/trust component rather than many active overlays.
- **Remaining issue:** security summaries and exact values recur in J00/J01/J02/J05/RP. The wording is security-heavy by design; shortening it without a traceability map would be unsafe.
- **Required edit:** make J03 canonical for threat controls, project-policy enrollment/trust, PermissionEngine/security boundaries, secret handling, TUF/update trust, and security invariants. Remove only duplicate summaries and add references from other files. Preserve every fail-closed, least-privilege, anti-rollback, revocation, approval, TOCTOU, and secret-boundary condition.

#### `docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md`

- **Reviewed:** yes, full 1,683-line file; 31 OPS and 29 UI subsections.
- **Role:** operational truth, integrations, lifecycle, voice, notifications, and canonical UI/UX identity/accessibility authority.
- **What is simplified:** operations, integrations, and UX are grouped in one component.
- **Remaining issue:** J05 and the Release Profile repeat many operations, integration, UI, voice, accessibility, and qualification lists.
- **Required edit:** make J04 canonical for user-visible behavior, operational state semantics, integration behavior, UI identity, design tokens, accessibility, and UX non-goals. Keep only profile-specific V1 scope in RP and test/evidence obligations in J05, linked to J04. Do not remove degraded-state, destructive-confirmation, privacy, accessibility, or recovery behavior.

#### `docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md`

- **Reviewed:** yes, full 824-line file; 39 VER subsections.
- **Role:** verification, evidence, qualification, release, defect handling, and Production Complete authority.
- **What is simplified:** verification is one named component and the canonical command manifest now has 30 commands instead of 32.
- **Remaining issue:** J05 restates many J04/RP behavioral requirements and has a broad acceptance surface whose unique evidence purpose is not yet cataloged.
- **Required edit:** make J05 canonical for what must be tested, what evidence qualifies, release/production gates, and evidence hierarchy. Reference J00–J04 for behavior and exact protocol/security requirements. Build the gate catalog before removing any command. Preserve all negative, adversarial, failure, recovery, cancellation, stale-state, exact-identity, platform, provenance, signing, and release gates.

### Current governance and evidence aids

#### `docs/implementation/governance/repository-governance-profile.json`

- **Reviewed:** yes, full file.
- **Role:** machine-readable current governance/evidence profile.
- **Finding:** stale and blocking. It says `COMPENSATING_CONTROLS`, server protection unavailable, private-repository plan limitation, and old residual risk, while authenticated GitHub reports active server protection.
- **Required edit:** record live `SERVER_ENFORCED` facts, protection settings, required `static-ci`, current repository visibility/default branch, observation timestamp, and exact evidence identity. Preserve old values only under an explicitly historical transition field that cannot be consumed as current state.

#### `docs/implementation/governance/MASTER-PROTECTION.md`

- **Reviewed:** yes, full file.
- **Finding:** current section is stale for the same reason; the historical run details are not a substitute for current governance facts.
- **Required edit:** update current effective mode and live settings; retain the old compensating-control narrative only in a clearly labeled historical transition section; make the current operational instructions derive from the machine-readable profile.

#### `docs/implementation/governance/LOCALCI-CT107-QUALIFICATION-EXCEPTION-2026-09-04.md`

- **Reviewed:** yes, full file.
- **Finding:** explicitly historical and non-authoritative. It records a bounded operational exception and does not make LocalCI CI authority.
- **Required edit:** no deletion is required by this audit. Keep it outside current authority, ensure current docs do not use it as present qualification, and preserve secret/path redaction.

#### `docs/implementation/evidence/0.13-master-protection-blocker.md`

- **Reviewed:** yes, full file.
- **Finding:** historical v1.0.6 evidence. Its old compensating-control result is factually useful but cannot remain ambiguous beside a current profile.
- **Required edit:** preserve as historical evidence; strengthen its non-current label if needed; do not change its factual result into present-day server enforcement.

#### `docs/implementation/evidence/0.CP-phase0-checkpoint.md`

- **Reviewed:** yes, full file.
- **Finding:** historical checkpoint contains old governance mode and old qualification facts.
- **Required edit:** preserve historical evidence and clearly separate it from current governance; do not use it to satisfy a current candidate gate.

#### `tools/checkpoints/phase0-checkpoint-profile.json`

- **Reviewed:** yes, full file.
- **Finding:** contains legacy path names as negative/validation data and historical reference expectations. It is not itself a current contract component, but its purpose must remain unmistakable.
- **Required edit:** retain only if required by current Phase 0 validation; label legacy paths as rejection fixtures or migrate them to a bounded test fixture. Do not turn them into current source references.

#### `docs/implementation/evidence/0.1-implementation-admission.md`, `0.2-monorepo-boundaries.md`, `0.3-platform-runtime-identity.md`, `0.4-platform-capability-contracts.md`, `0.5-platform-composition-root.md`, `0.6-protocol-schema-foundation.md`, `0.7-canonical-contract-values.md`, `0.8-pinned-toolchain-baseline.md`, `0.9-test-layer-architecture.md`, `0.10-architecture-enforcement.md`, `0.11-static-ci-baseline.md`, `0.12-contract-reproducibility-and-drift.md`, `1.1-rustsec-informational-warning-review.md`, `1.1-tauri-react-desktop-foundation.md`, and `1.3-windows-platform-host-composition.md`

- **Reviewed:** current evidence inventory and applicable files.
- **Finding:** these are evidence records, not normative contract authority. Some are historical or implementation-subsection records and must not be used to advance this contract-only task.
- **Required edit:** update only stale contract names, authority claims, or links caused by the consolidation; do not rewrite scores/status or add application evidence. Every current claim must distinguish local, GitHub Actions, live platform, and independent evidence.

### Execution aids and reports

#### `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`

- **Reviewed:** yes, full execution aid.
- **Finding:** it remains a sequencing aid, not normative authority. It contains implementation phases and release checkpoints that must not be pulled into contract consolidation as app work.
- **Required edit:** only update stale active-contract names/links and clearly preserve the no-implementation boundary.

#### `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`

- **Reviewed:** yes, full matrix.
- **Finding:** it is the application execution plan and must not advance for this task.
- **Required edit:** none to status, pointer, score, evidence, or subsection ordering. Only repair a strictly stale contract link if necessary.

#### `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md`

- **Reviewed:** yes, full reference.
- **Finding:** it is a non-authoritative reference and must identify the v1.0.8 active suite without becoming a second matrix or contract.
- **Required edit:** keep links and suite identity synchronized; do not add application progress or normative requirements.

#### `docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md`

- **Reviewed:** yes, current 351-line goal.
- **Finding:** it correctly limits the task to contract/verification-system work, but it needs to be regenerated from this findings record. Its file-by-file instructions currently mix preservation requirements with a large acceptance surface without a measured ownership map.
- **Required edit:** replace it with the detailed contract-only goal below, including the P0 governance correction, requirement ownership map, gate catalog, findings-file reread requirement, local-first sequence, and ship-only-with-no-issues rule. Do not authorize application behavior or matrix work.

### Contract enforcement, generated outputs, and tests

#### `tools/contract/manifest.mjs`

- **Reviewed:** yes, full file.
- **Finding:** deterministic tracked-path and forbidden-source validation is valuable and fail-closed, but this new audit record must be a narrowly documented non-authoritative exemption because it inventories retired source names.
- **Required edit:** add only the exact findings path to the exemption set and explain why; add regression coverage. Keep all ordinary tracked-file path, filename, and reference rejection unchanged.

#### `tools/contract/check-drift.mjs` and `tools/contract/lib.mjs`

- **Reviewed:** yes, applicable implementation.
- **Finding:** generated values and manifest drift are appropriately centralized. No application behavior is involved.
- **Required edit:** keep source-of-truth and generated-output checks deterministic; simplify only duplicate error/reporting layers if the same failure remains fail-closed and attributable.

#### `tools/ci/localci-gate-manifest.mjs`

- **Reviewed:** yes, full file.
- **What is simplified:** one frozen 30-command array supplies LocalCI and acceptance membership/order.
- **Remaining issue:** command membership is canonical, but requirement ownership/evidence reuse is not encoded.
- **Required edit:** preserve exact order, command arguments, terminal evidence, mutation rejection, and exit-78 non-authority behavior. Add only the minimal metadata or companion catalog needed to explain unique purpose; do not add a second command list.

#### `tools/ci/check-repository-governance.mjs` and `tools/ci/generate-evidence.mjs`

- **Reviewed:** yes, applicable files.
- **Finding:** they validate the checked-in profile and evidence shape, but the current governance check did not detect the live GitHub mismatch.
- **Required edit:** make the current profile internally truthful and, where contractually required, make live observation fields explicit and non-stale. Do not make ordinary local execution an authority substitute for GitHub Actions.

#### `tools/checkpoints/phase0-checkpoint.mjs`

- **Reviewed:** yes, applicable checker.
- **Finding:** it correctly protects status/authority/evidence consistency, but historical profile values can pass when represented as current checked-in governance data.
- **Required edit:** distinguish current live governance from historical evidence and fail closed on stale current profile facts. Do not advance matrix status.

#### `.github/workflows/static-ci.yml` and `.localci/ci.sh`

- **Reviewed:** yes, relevant workflow/script sections.
- **Finding:** the current candidate has exact-candidate GitHub evidence and the LocalCI sequence is derived from the canonical list. GitHub Actions remains the only CI authority.
- **Required edit:** retain local-first preflight semantics, exact candidate identity, pinned inputs, evidence identity, and LocalCI non-authority. Remove only wrappers proven to duplicate another canonical gate. No GitLab authority and no LocalCI qualification claim.

#### `tests/layers/unit/contract-drift.test.mjs`, `localci-compatibility.test.mjs`, governance/Phase 0/static-CI tests, and related test harness files

- **Reviewed:** yes, applicable tests.
- **Finding:** adversarial path, command mutation, duplicate, omission, and drift coverage was strengthened. Some tests necessarily contain prohibited path terms as rejection fixtures.
- **Required edit:** add the exact findings-file exemption regression and live-governance profile consistency coverage. Retain all negative/adversarial tests. Do not create a new testing framework or count one test as multiple independent proofs without rationale.

## Retired source inventory and migration obligation

The candidate diff records 92 deleted paths, including 11 under `docs/adr`, 48 under `docs/decisions`, 10 under `docs/history`, and 23 other legacy contract/manifest/lineage/readiness paths. The retired contract-like files from `origin/master` include:

- `docs/JARVIS-CONTRACT-LINEAGE.md`;
- `docs/JARVIS-CONTRACT-MANIFEST-v1.0.3.md`;
- `docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md`;
- `docs/JARVIS-CONTRACT-MANIFEST-v1.0.7.md`;
- `docs/JARVIS-CONTRACT-v1.0.3-READINESS-AUDIT.md`;
- `docs/JARVIS-CONTRACT-v1.0.4-READINESS-AUDIT.md`;
- `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`;
- `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md`;
- `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.7.md`;
- `docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md`;
- `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`;
- `docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md`;
- `docs/implementation/JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`;
- `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`;
- `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`;
- `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`;
- `docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`;
- `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`;
- `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md` before its rename to J05;
- `docs/decisions/ADR-051-production-implementation-contract-suite.md`;
- `docs/decisions/ADR-052-protocol-schema-and-production-implementation-plan.md`;
- `docs/decisions/ADR-054-contract-consistency-and-schema-normalization.md`;
- `docs/decisions/ADR-067-v1-integration-release-boundary-and-next-update-requirements.md`;
- `docs/decisions/ADR-069-contract-v1.0.2-canonical-consolidation.md`;
- `docs/decisions/ADR-071-contract-v1.0.3-production-hardening-and-release-closure.md`;
- `docs/decisions/ADR-073-contract-v1.0.5-security-closure-and-release-sequencing.md`;
- `docs/decisions/ADR-074-hosting-capability-aware-repository-governance.md`;
- `docs/decisions/ADR-075-repository-governance-contract-coherence.md`;
- `docs/decisions/ADR-076-qualified-ci-authority-equivalence.md`;
- all remaining files under the retired `docs/adr`, `docs/decisions`, and `docs/history` directories shown by `git diff --name-status origin/master...HEAD`.

The next consolidation pass must maintain a requirement crosswalk for every retired contract/decision/history source category. A filename count is not enough. If a still-valid rule is not represented in an active component, the pass must stop and correct the active suite before claiming completion. No retired file may be restored or cited as current or historical source authority.

## Required requirement-ownership model

The next pass must assign each shared requirement to exactly one primary normative owner:

| Requirement family | Primary owner | Other files may contain |
|---|---|---|
| scope, repository, package, coding, branch, CI authority | J00 | short manifest/entry-point pointers and operational evidence |
| runtime/platform roles, protocol types, capability boundaries, IPC/runtime semantics | J01 | V1 scope narrowing in Release Profile and verification references in J05 |
| authoritative data/state, transactions, migrations, backup/recovery format | J02 | security references and release-test references |
| security, PermissionEngine, project policy, secrets, TUF/update trust | J03 | exact V1 scope references and verification references |
| operations, integrations, lifecycle, voice, UI identity/accessibility | J04 | V1 inclusion/exclusion and verification references |
| tests, evidence, qualification, release and Production Complete | J05 | profile-specific release gate selection only |
| exact Windows V1 support scope and release artifact boundary | Release Profile | references to J00–J05, not duplicate general rules |
| active component identity and revision | manifest | no duplicate component authority |

This table is a review requirement, not a replacement for the active contract.

## Acceptance-preservation requirements

The optimization pass may remove a gate only if its owner proves all of the following in the final report:

1. the removed gate tests exactly the same requirement as a retained gate;
2. the retained gate runs the same or stronger validation;
3. the trust boundary and execution authority are unchanged;
4. negative, adversarial, failure, recovery, cancellation, stale-state, exact-identity, provenance, platform, and release evidence remain covered;
5. the retained evidence is durable, attributable, and not merely a local or synthetic result;
6. no command wrapper or report transformation was hiding a distinct failure condition;
7. the removal lowers execution or maintenance cost without weakening diagnosis.

The following may not be removed merely because they look repetitive: fixed backup cryptography, KDF floors, key separation, project-policy enrollment, TUF thresholds/expiry/anti-rollback, PermissionEngine deny precedence, exact repository/ref/SHA binding, fail-closed status handling, Windows-native qualification, signed/provenance evidence, crash/recovery/uncertain-state tests, and destructive-action confirmation.

## Initial next-pass completion criteria — correction checklist

The initial audit marked the consolidation **NOT READY TO SHIP** until the following correction criteria were satisfied. They are retained here as the audit checklist; the current correction-pass result is recorded below.

- current governance profile and operational aid match live GitHub truth;
- this record is linked from the first `AGENTS.md` source list and remains non-normative;
- every active contract has a documented ownership result and required edit/no-change decision;
- every retired source category has a requirement-preservation crosswalk;
- duplicate wording is reduced by canonical references without losing conditions;
- every retained acceptance gate has a unique purpose and evidence type;
- local preflight passes before any GitHub Actions run;
- exact-candidate GitHub Actions is used only after local preflight and only when publication is authorized;
- generated artifacts and drift checks pass;
- the matrix and application sources remain untouched for this contract-only task;
- the final audit checks the result against this goal, the active contract, and `AGENTS.md`, fixes every issue found, and ships only when no issue remains.

## Correction-pass record — 2026-09-15

This section records the bounded correction pass after the audit baseline above. It is still a non-normative audit aid. The active manifest, J00–J05, Release Profile, and `AGENTS.md` remain the only normative authority.

### Current governance truth

The authenticated live GitHub observations used for this pass are:

| Fact | Observed value |
|---|---|
| repository | `andresslacson1989/jarvis-project` |
| repository visibility | public |
| default/authoritative branch | `master` |
| server protection | available and active |
| required status check | strict `static-ci` (`app_id=15368`) |
| approving reviews | 1 |
| administrator enforcement | enabled |
| force pushes | disallowed |
| branch deletion | disallowed |
| conversation resolution | enabled |
| observation source | authenticated GitHub API |
| observation timestamp | `2026-09-15T01:49:15Z` |
| evidence identity | `github-api:repo-1330469646:refs/heads/master:protection:static-ci:app-15368` |

`docs/implementation/governance/repository-governance-profile.json` now records `SERVER_ENFORCED` with those current facts. The former `COMPENSATING_CONTROLS` values remain only beneath `historicalTransition.notCurrent=true`. `MASTER-PROTECTION.md` has the same current/history boundary. The historical evidence records retain their original results and now carry explicit historical-only banners; no historical run is treated as current v1.0.8 candidate qualification.

### Requirement ownership map

The following map is the reviewable primary-owner result. A requirement family has one normative owner; other files may contain only the stated scope, verification, evidence, or navigation reference.

| Requirement family | Primary normative owner | Allowed references / proof surfaces |
|---|---|---|
| scope, repository, package, coding, branch, CI authority | J00 | manifest index, README/AGENTS entry points, governance aid, J05 evidence references |
| runtime/platform roles, protocol types, capability boundaries, IPC/runtime semantics | J01 | Release Profile V1 narrowing, J05 verification evidence |
| authoritative data/state, transactions, migrations, fixed backup format, recovery | J02 | J03 secret-boundary references, Release Profile selection, J05 verification evidence |
| security, PermissionEngine, project-policy trust, secrets, TUF/update trust | J03 | J00/J01/J02/J04 implementation-boundary references, J05 verification evidence |
| operations, integrations, lifecycle, voice, UI identity, design tokens, accessibility | J04 | Release Profile V1 inclusion/exclusion, J05 behavior/evidence references |
| tests, evidence, qualification, release gates, Production Complete | J05 | Release Profile applicability and the non-normative gate catalog |
| exact Windows V1 support scope and signed release-artifact boundary | Release Profile | references to J00–J05; no duplicate general rule definition |
| active component identity and revision | manifest | no duplicate component authority |

### Active-file edit/no-change decisions

| Active file | Decision | Result and preservation rationale |
|---|---|---|
| `docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md` | EDITED | MAN-04 now points to J02/J03/J00/J05 owners while retaining the seven-row active suite, revision identity, and no-overlay boundary. |
| `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` | EDITED | Cross-cutting implementation restatements now point to J01–J05/RP owners; repository/CI authority and fail-closed limits remain explicit. |
| `docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md` | EDITED | J01-PLAT-28 delegates verification criteria to J05 while retaining the canonical runtime/platform/protocol clauses, including normalized TTS/AEC and provider-supervisor behavior at J01-RT-26A. |
| `docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md` | NO CHANGE | Exact authoritative data, transaction, KDF persistence, fixed backup format, key separation, recovery, restore, and corruption clauses remain canonical and were not shortened. |
| `docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md` | NO CHANGE | Exact security, PermissionEngine, project-policy, secret, TUF, approval, TOCTOU, and fail-closed clauses remain canonical; shortening them without a stronger proof would be unsafe. |
| `docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md` | NO CHANGE | Exact operations, integration, lifecycle, voice, UI identity, accessibility, privacy, degraded-state, and destructive-confirmation semantics remain canonical. |
| `docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md` | EDITED | J05 now names the single 30-gate command manifest and its traceability catalog while retaining the full release-gate list and evidence hierarchy. |
| `docs/JARVIS-V1-RELEASE-PROFILE.md` | EDITED | General platform/security/runtime/mission/governance/release repetitions now reference the canonical owners; exact Windows V1 scope, thresholds, capability matrices, voice selection, exclusions, and artifact boundary remain in the profile. |
| `AGENTS.md` | PRESERVED | The source-of-truth order, findings-file non-normative label, authority hierarchy, local-first rule, no-implementation boundary, and GitHub/GitLab/LocalCI roles remain explicit. |
| `README.md` | EDITED | Detailed governance and no-overlay repetition now points to J00/J05 and the current governance aid; navigation and current guarantees remain. |
| `docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md` | PRESERVED | The owner-provided goal remains verbatim and was not optimized or replaced. |

### Retired-source requirement-preservation crosswalk

| Retired source category | Current owner/crosswalk | Current enforcement or evidence |
|---|---|---|
| older manifests and monolithic implementation contracts | manifest identity plus J00–J05 and Release Profile; valid requirements are mapped by family in the owner table above | `pnpm contract:check`, generated-value drift, manifest row/revision checks |
| standalone backup/data/recovery sources | J02 data/backup clauses, with J03 secret-boundary references and RP V1 selection | schema, backup/restore, recovery, KDF, and J05 release qualification tests |
| standalone runtime/platform/protocol sources | J01 runtime/platform/protocol clauses | schema/cross-language, architecture/import, platform-boundary, IPC, and native qualification gates |
| standalone security/policy/supply-chain sources | J03 security, policy, and supply-chain clauses | secret, PermissionEngine, policy-trust, TUF, update, approval, and adversarial tests |
| standalone operations/integration/voice/UI sources | J04 operations/integration/voice/UI clauses, with RP scope and J05 evidence references | provider/integration, voice, UI/accessibility, degraded/recovery, and release evidence gates |
| standalone verification/release sources | J05 verification/release clauses and RP applicability | test-layer, qualification, signed-artifact, provenance, and Production Complete gates |
| retired decision, archive, lineage, and history material | no current owner; valid requirements must enter the active owner above, while source paths remain prohibited | manifest tracked-path/filename/reference rejection, Phase 0 rejection fixtures, and this non-authoritative inventory only |
| historical governance and LocalCI records | current profile/MASTER-PROTECTION for present facts; historical evidence remains labeled non-current | governance profile/document validators, Phase 0 integration, and explicit authority-class catalog entries |
| implementation plans, matrices, and evidence reports | execution/evidence aids only; no product authority and no matrix advancement in this task | current suite links, no-application-change check, and status-preservation review |

No retired source was restored or consulted as current authority. The inventory names retired paths only in this non-authoritative findings record and bounded rejection fixtures covered by the exact validator exemptions.

### Acceptance-gate catalog and duplicate disposition

The executable acceptance sequence remains the one 30-entry `ACCEPTANCE_GATE_COMMANDS` array in `tools/ci/localci-gate-manifest.mjs`. `ACCEPTANCE_GATE_CATALOG` adds only owner-clause, evidence, authority-class, purpose, and distinctness metadata derived from that array; `docs/implementation/CONTRACT-ACCEPTANCE-GATE-CATALOG.md` is the reviewable human-readable companion. No second executor command list was introduced.

| Measure | Before baseline | After correction pass | Result |
|---|---:|---:|---|
| active normative authority files | 16 | 8 | 8 fewer files: one manifest, six components, one Release Profile |
| manifest authority rows | 15 | 7 | 8 fewer rows; active identity remains manifest-derived |
| canonical acceptance commands | 32 | 30 | 2 duplicate command definitions removed by the consolidation; 0 additional commands removed in this pass |
| security/qualification checks removed | reported 0 | 0 | no security, recovery, platform-native, provenance, signed-artifact, or release proof was removed |
| repeated normative restatement blocks replaced by owner references | not separately measured | 25 explicit blocks | J00 10; J01 1; manifest 5; Release Profile 7; README 2 |
| terminal evidence commands | 1 | 1 | `ci:evidence` remains the single final evidence command and is outside the 30 acceptance gates |

### Direct active-suite line-count measurement

| Measure | Before baseline | After correction pass | Result |
|---|---:|---:|---|
| directly comparable active manifest/components/profile text | **9,195 reported** by the initial audit | **9,585 verified** in the corrected tree; the prior audited candidate was **9,870 reported** | line count is reported transparently and is not used as the sole proof of simplification |

The two removed acceptance definitions are the previously audited 32→30 reduction; this pass only added traceability metadata and did not delete a retained gate. Similar-looking gates remain where they protect different trust boundaries, such as scanner installation/version/result/report, host versus Windows-target compilation, static governance versus Phase 0 aggregation, and local preflight versus authoritative GitHub execution.

### Required tests and evidence retained

- J05-VER-07 retains all **15 named test-layer categories**: unit; property/state-machine; schema/cross-language contract; platform architecture/contracts; provider setup/contract/sandbox; tool contract; integration/module conformance; integration/e2e; UI/accessibility/adaptive; safety/adversarial; recovery/chaos; persistence/backup/migration; performance/resource; voice/audio; and packaging/update/release.
- The latest correction-specific targeted run covers **84 passing subtests** across contract drift, LocalCI catalog/sequence behavior, governance profile/documentation, and Phase 0 current-governance integration.
- The existing LocalCI negative suite still covers omission, duplication, unknown insertion, reorder, command mutation, terminal-evidence order, non-authoritative exit 78, and Windows/WSL attestation guards.
- The retained evidence classes are **10**: deterministic automated checks; local preflight; authoritative GitHub Actions; authenticated live GitHub observation; native Windows platform/build evidence; integration/conformance evidence; security-negative/adversarial evidence; failure/recovery/uncertain-state evidence; signed/provenance/license artifact evidence; and independent review where required.

### Correction-pass completion boundary

Current governance profile/documentation, owner mapping, retired-source crosswalk, gate catalog, Phase 0 integration, targeted tests, the 30-gate local acceptance sequence, and the normal 22-file test profile now satisfy the identified audit corrections. The corrected tree is complete for this contract-consolidation scope only. Publication, GitHub Actions candidate qualification, GitLab mirroring, merge, integration, matrix advancement, and application implementation remain outside this contract-only pass unless separately authorized.
