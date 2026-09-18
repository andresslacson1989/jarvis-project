# JARVIS Contract Simplification and Consolidation Execution Goal

## 1. Objective

Simplify, optimize, and consolidate the active JARVIS contract system without weakening, removing, broadening, or making ambiguous any product feature, security control, reliability guarantee, platform boundary, accessibility requirement, verification gate, or release condition.

Use `docs/implementation/JARVIS-CONTRACT-CONSOLIDATION-AUDIT-FINDINGS.md` as the persistent non-normative findings baseline. The active manifest, six active contract components, Release Profile, and repository instructions remain authoritative.

This goal authorizes contract-document, contributor-guidance, validator, generated-artifact, and acceptance-command maintenance only. It does not authorize application implementation, business-logic changes, implementation-matrix progression, evidence advancement for application features, publication, integration, release qualification, or an auditor handoff.

ADRs are completely prohibited. Do not create, retain, consult, or cite separate architecture decision records or historical overlays. Resolve all authorized contract changes directly and synchronously in the active suite.

## 2. Required result

Deliver a smaller and clearer contract system in which:

- each normative requirement has one complete authoritative owner;
- cross-component references replace repeated behavioral prose without hiding obligations;
- exact schemas, thresholds, state values, security constructions, matrices, and release gates remain intact;
- `AGENTS.md` is a concise repository instruction entry point rather than a duplicate contract manual;
- task-specific reading replaces an unconditional 11,000-line reading burden while preserving applicability;
- repeated acceptance commands derive from a controlled shared definition where technically safe;
- no prohibited decision-record terminology or authority is introduced;
- every removed or rewritten requirement is traceably preserved;
- all affected validators, tests, generated artifacts, and references agree with the result.

Line-count reduction is evidence of simplification, not the governing objective. Lossless semantics and enforceability are mandatory.

## 3. Absolute scope boundaries

### Authorized

- Edit `AGENTS.md`, `README.md`, the active manifest, J00–J05, and the Release Profile for the stated simplification.
- Update the Implementation Plan only where a current reference must follow an authorized clause or file change; do not alter application sequencing or status.
- Update this goal and the persistent findings file to remain truthful.
- Update contract validators, schemas, generated contract artifacts, acceptance-command metadata, and tests only as required by the document consolidation.
- Add preservation-focused tests for changed validator or generated behavior.

### Prohibited

- No application implementation or refactoring.
- No changes to runtime, desktop, provider, integration, database, security, backup, UI, or release application behavior.
- No implementation-matrix status, score, evidence, pointer, or progress changes.
- No claim that documentation completion is application completion or `Production Complete`.
- No removal or weakening of mandatory tests, evidence, platform-specific jobs, security checks, negative cases, or release vetoes.
- No creation, restoration, consultation, or citation of architecture decision records, retired contracts, or historical overlays as authority.
- No publication, push, merge, integration, release, or auditor handoff unless separately and explicitly authorized after this goal is complete.
- No history rewriting and no deletion of preserved untracked user material.

## 4. Mandatory preservation invariants

The completed change must preserve, at minimum:

1. Windows `FULL_HOST` as the mandatory V1 target; Linux and companion status remain truthful and future-scoped.
2. Strong platform capability boundaries and qualified Windows mechanisms.
3. Tauri, IPC, WebView, process ownership, Job Objects, elevation, setup-helper, credential, and secret protections.
4. PermissionEngine, authority envelopes, risk policy, bound targets, approvals, and final destructive confirmation.
5. DataPolicy and sensitivity enforcement.
6. Canonical state machines, atomic commits, post-commit publication, idempotency, retry safety, stale-precondition rejection, `UNCERTAIN`, reconciliation, recovery, and diagnostics.
7. Exact `JARVIS_BACKUP_V1` algorithms, format, key hierarchy, generated recovery slot, nonce/tag/chunk/AAD rules, restore behavior, and vectors.
8. Project-policy enrollment, identity binding, trust invalidation, and prohibited authority expansion.
9. TUF root/role thresholds, expiry, version, revocation, delegation, rollback/freeze/mix-and-match, security epochs, update signatures, and module boundaries.
10. Provider setup, least privilege, lifecycle, isolation claims, fallback, and platform qualification.
11. Exact GitHub and Proxmox capability matrices and restrictions.
12. Voice, TTS, AEC, interruption, normalized fields/events, latency, readiness, restart, and fallback requirements.
13. Canonical JARVIS visual identity, Mission Control hierarchy, adaptive layouts, and every accessibility value and test.
14. All mandatory unit, property, schema, integration, security, adversarial, crash/recovery, backup, platform, package, provenance, performance, soak, and live-evidence gates.
15. GitHub Actions authority, GitLab mirror-only status, LocalCI non-authority, exact-candidate verification, and signed-artifact release qualification.

If a proposed simplification conflicts with any invariant, preserve the invariant and leave that text unsimplified until a safe formulation is proven.

## 5. Required preparation before edits

1. Fetch current remote refs without pulling or changing the working tree.
2. Record branch, HEAD, `origin/master`, merge base, tracked status, and preserved untracked paths.
3. Re-read root and applicable nested `AGENTS.md` files.
4. Read the current manifest, all six active components, Release Profile, findings file, this goal, and relevant validator/acceptance definitions.
5. Confirm no other active task owns the same files.
6. Create a temporary `codex/` feature branch or worktree from current live `origin/master`, preserving valid concurrent work.
7. Record baseline line counts, file hashes, clause IDs, normative keywords, cross-references, gate IDs/commands, and validator results.
8. Build the preservation ledger described below before deleting or merging normative text.

Do not begin rewriting if the branch base, authority set, or concurrent ownership is uncertain.

## 6. Preservation ledger

Create a machine-readable or reviewable ledger covering every changed normative clause with these fields:

```text
source file
source clause ID
requirement summary
exact values/types/states affected
change class
destination owner clause
references updated
tests/validators affected
semantic result: unchanged or material change
review status
```

Allowed change classes are:

- exact-text preservation;
- reference-only deduplication;
- merged equivalent wording;
- non-normative example or boilerplate removal;
- formatting-only cleanup;
- material semantic change requiring explicit governance authorization.

Every deleted normative sentence must map to a complete surviving owner. A reference to a partial summary is not preservation. Unmapped requirements are a hard failure.

## 7. Canonical ownership model

Use this ownership model unless the active text proves a more precise existing owner:

| Component | Owner responsibility |
| --- | --- |
| Manifest | Active suite identity, revisions, authority, amendment, and version policy |
| J00 | Scope, repository governance, coding, package, and dependency rules |
| J01 | Platform, runtime, IPC, process, protocol, schema, and state vocabulary |
| J02 | Persistence, transitions, transactions, recovery, backup, and restore |
| J03 | Authorization, secrets, project-policy trust, supply-chain trust, and TUF |
| J04 | Operations, integrations, provider/voice UX, UI, and accessibility behavior |
| J05 | Tests, evidence, CI, qualification, and release decisions |
| Release Profile | Exact V1 support and capability selections |

Cross-references must point to exact clauses where practical. Avoid circular ownership and generic “see elsewhere” language.

## 8. File-by-file instructions

### 8.1 `AGENTS.md`

1. Reduce it from 463 lines to a concise instruction entry point, targeting 100 lines or fewer unless preservation evidence proves a small excess necessary.
2. Retain unique highest-level contract protection, branch/publication authority, source-of-truth routing, destructive-action safety, no historical decision-record rule, platform/backup/project-policy/supply-chain boundaries, and the prohibition on unauthorized application implementation.
3. Replace the embedded implementation protocol with references to the owning active contract, Implementation Plan, and matrix only for separately authorized application implementation.
4. Replace the unconditional source list with task-applicable routing:
   - manifest first for contract-affecting work;
   - applicable normative components for the task;
   - J05 and Release Profile for verification/release work;
   - Implementation Plan and matrix only for application implementation;
   - persistent findings only for contract-maintenance work.
5. Preserve the rule that an implementer must inspect every governing requirement; routing must not waive unread applicable requirements.
6. Remove duplicated subjective scoring and iteration prose where objective contract gates already determine completion.
7. Preserve the required acknowledgement sentence if governance still requires it.
8. Validate every removed instruction against the preservation ledger.

### 8.2 `README.md`

1. Keep repository purpose, orientation, authority links, minimum setup, and basic validation commands.
2. Remove repeated normative platform, branch, guarantee, and principle prose when the active owner is linked clearly.
3. Do not turn the README into a competing authority or hide essential contributor entry points.

### 8.3 `docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md`

1. Preserve active component identities, revisions, authority order, amendment rules, semantic-version rules, and Release Profile relationship.
2. Replace behavioral restatements in MAN-04 through MAN-06 with a concise component ownership and dependency map.
3. Keep the no-historical-overlay and no-separate-decision-record policy explicit.
4. Resolve version and component-revision treatment under MAN-08 before changing normative files. Record the determination; do not silently retain or advance versions.
5. Update hashes/generated metadata only through the repository’s controlled mechanism.

### 8.4 `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md`

1. Keep product scope, repository governance, coding, packaging, dependency, provenance, and contribution rules complete.
2. Consolidate SCOPE-04 overlap with the Release Profile and J01/J04 into exact references while retaining J00-specific scope boundaries.
3. Consolidate CODE-04 overlap with J01 platform capabilities.
4. Replace CODE-09, CODE-15, CODE-17, CODE-18, and CODE-20 through CODE-26 domain summaries with references to their complete J01–J04 owners, retaining only distinct coding/repository obligations.
5. Move or reference test-list material in CODE-27 to J05 without dropping required coverage.
6. Merge GOV-28 and CODE-28 only if their GitHub authority, server protection, compensating controls, exact-candidate, and fallback semantics remain complete.
7. Consolidate suite-wide summaries in CODE-31 and CODE-32 into a short owner map.

### 8.5 `docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md`

1. Preserve all platform capability interfaces, runtime ownership, IPC schemas, process supervision, protocol types, canonical state vocabulary, provider interfaces, voice, TTS, and AEC requirements.
2. Merge duplicate platform-role material across PLAT-01 through PLAT-03 and PLAT-29 through PLAT-32 without losing future-platform truthfulness or Windows-strength requirements.
3. Define each state/type once and replace repeated enumerations such as RT-14 versus PROTO-19 with exact references.
4. Keep DataPolicy data structures here where they are protocol types; reference J03 for policy/security interpretation.
5. Replace duplicated KDF policy in PROTO-06 with an exact J03 owner reference while preserving the protocol field/validation obligation.
6. Move qualification-method ownership from PROTO-25 and PROTO-27 to J05 where appropriate, retaining protocol-defining vectors and compatibility semantics.

### 8.6 `docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md`

1. Preserve authoritative persistence, legal transitions, transaction boundaries, event/audit coupling, recovery, backup, and restore behavior.
2. Make BACKUP-02 through BACKUP-15 the sole complete owner of `JARVIS_BACKUP_V1`.
3. Replace DATA-27 through DATA-33 summaries with precise BACKUP references where they duplicate the detailed rules.
4. Remove the “or equally reviewed qualified construction” ambiguity from the V1 path by preserving the fixed AES-256-GCM requirement exactly; do not substitute any algorithm or format.
5. Reference J03 for KDF security policy instead of repeating its floor in DATA-05, while retaining every J02 application and storage rule.
6. Reference J01 for state vocabulary and keep J02 ownership of legal transitions and persisted semantics.
7. Consolidate DATA-30/BACKUP-14/J05-VER-21 verification overlap so J05 owns evidence while J02 retains exact backup vectors and acceptance behavior.

### 8.7 `docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md`

1. Preserve the threat model, PermissionEngine, authority, secrets, project-policy trust, provider trust, TUF, module, update, revocation, rollback, and security-epoch rules.
2. Replace duplicated test catalogs in SEC-33, POLICY-15, and SUPPLY-17 with exact J05 verification references after confirming every positive and negative case remains listed in J05.
3. Keep behavior and pass/fail security properties in J03; place test procedure and evidence ownership in J05.
4. Reconcile SUPPLY-16 with Release Profile RP-16 and J05-VER-36: J03 owns security validation, the Release Profile owns selected V1 fields, and J05 owns proof.

### 8.8 `docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md`

1. Preserve operational lifecycle, integrations, provider setup, GitHub/Proxmox restrictions, voice behavior, UI behavior, brand identity, and every accessibility threshold.
2. Replace OPS-30’s duplicated qualification catalog with J05 references while preserving each operational behavior and required evidence.
3. Consolidate UI-26 and UI-28 test/checklist overlap with J05; J04 remains owner of UI and accessibility behavior and exact values.
4. Reconcile OPS-26 release vulnerability policy with J05 without weakening either runtime handling or release vetoes.
5. Remove or clearly mark optional examples as non-normative when they add no unique requirement.
6. Rename the heading “Architecture Decision Escalation” to “Architecture Change Escalation,” retaining clause ID J04-OPS-28 and its full meaning.
7. Do not remove normalized TTS fields/events, provider interface behavior, AEC capability fields, supervisor lifecycle/restart/fallback, voice latency, readiness, or interruption requirements.

### 8.9 `docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md`

1. Keep all verification, evidence, CI authority, exact-candidate, platform, negative/adversarial, recovery, performance, soak, signing, and release-decision gates.
2. Rewrite behavioral restatements as owner-clause references while retaining the exact verification method and pass/fail condition.
3. Reconcile VER-09, VER-11, VER-14, VER-17, VER-24, VER-25, VER-30, VER-33, and VER-36 with their J01–J04 or Release Profile owners.
4. Do not remove duplicated values until an automated reference/preservation check proves the owner value and J05 test still agree.
5. Preserve Contract Accuracy vetoes and the full `Production Complete` boundary if those remain part of current governance.

### 8.10 `docs/JARVIS-V1-RELEASE-PROFILE.md`

1. Keep exact V1 support, platform, capability, provider, integration, voice, hardware, artifact, and post-V1 selections.
2. Keep capability matrices here as the selected V1 support source.
3. Replace repeated implementation behavior in RP-03 through RP-05, RP-12, RP-15, RP-17, and RP-18 with exact component references where lossless.
4. Keep RP-16 as the V1 release-manifest field selection and reference J03 for security meaning and J05 for evidence.
5. Preserve the signed-artifact and exact-source `Production Complete` definition.

### 8.11 `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`

1. Do not alter implementation order, scope, statuses, or application acceptance meaning.
2. Change only references broken by authorized contract consolidation.
3. Keep it non-normative and subordinate to the active suite.

### 8.12 `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`

Do not edit this file during contract simplification. No status, score, evidence, execution pointer, or progress advancement is authorized.

### 8.13 Persistent findings and developer goal

1. Keep `JARVIS-CONTRACT-CONSOLIDATION-AUDIT-FINDINGS.md` concise, current, non-normative, and free of stale candidate narratives.
2. Update findings only when measured evidence changes; do not use historical text as authority.
3. Keep this goal truthful about completed and remaining work.
4. Do not mark the goal complete merely because documentation was shortened.

### 8.14 Acceptance-command and validator files

Review at minimum:

- `tools/ci/localci-gate-manifest.mjs`;
- `.localci/ci.sh`;
- `tools/checkpoints/phase0-checkpoint-profile.json`;
- `.github/workflows/static-ci.yml`;
- `tools/contract/manifest.mjs`;
- contract drift, manifest, governance, and generated-output tests.

Instructions:

1. Establish one controlled gate metadata model with gate ID, command, execution class, authority, and evidence purpose.
2. Make LocalCI and Phase 0 consume or derive their overlapping command lists from it where safe.
3. Keep GitHub Actions job topology explicit when runner/platform isolation requires it; remove only command duplication that can be safely generated or shared.
4. Preserve all 30 canonical gates and all Phase 0 obligations unless the active contract explicitly proves a gate obsolete.
5. Preserve LocalCI’s non-authoritative role and exit code 78 semantics.
6. Preserve separate Windows and general verification, exact checkout, pinned toolchains, artifact/evidence upload, and failure behavior.
7. Extend existing tests for metadata generation, command parity, forbidden historical-path matching on slash and backslash forms, duplicate IDs, missing commands, and authority classification.
8. Do not modify application tests or behavior.

## 9. Ordered execution passes

### Pass 1 — Inventory and lossless map

- Create the clause-level preservation ledger.
- Record all cross-references and acceptance-command duplicates.
- Identify exact owner for every duplicated rule.
- Decide version treatment under the manifest before normative edits.
- Call `NEXT PASS` if any rule lacks a complete owner.

### Pass 2 — Instruction and orientation simplification

- Simplify `AGENTS.md` and `README.md`.
- Verify unique repository protections and contributor routing remain complete.
- Run targeted instruction/reference checks.

### Pass 3 — Manifest and ownership normalization

- Simplify the manifest to suite identity/governance plus ownership map.
- Apply the authorized version/revision treatment.
- Update generated metadata and manifest tests.

### Pass 4 — Component consolidation

- Process J00 through J04 in ownership order.
- After each file, update the preservation ledger and run targeted contract/reference checks.
- Never delete source wording before its complete destination is present and verified.

### Pass 5 — Verification and Release Profile consolidation

- Make J05 the verification/evidence owner.
- Make the Release Profile the V1 selection owner.
- Reconcile every moved test, exact value, capability matrix, and release field.

### Pass 6 — Acceptance-command deduplication

- Implement the shared gate metadata model.
- Update LocalCI, Phase 0, and GitHub consumers without changing authority or gate coverage.
- Add negative and parity tests.

### Pass 7 — Mechanical cleanup

- Remove redundant separators and repeated boilerplate.
- Normalize headings and references.
- Preserve clause IDs or publish a complete old-to-new mapping.

### Pass 8 — Full self-audit

- Re-read the goal and persistent findings from the first line to the last.
- Compare the final tree to every requirement in this goal.
- Prove every preservation-ledger row is resolved.
- Re-run all required validation.
- Report any unknown or unsupported claim as incomplete.

## 10. Verification requirements

Run the repository’s applicable local fail-fast sequence in its required order, including:

1. targeted tests for each changed validator, generator, or gate consumer;
2. normal local test profile;
3. contract manifest and drift checks;
4. schema and generated-output checks;
5. governance and forbidden historical-path checks;
6. security, secret, dependency, license, and provenance checks;
7. architecture and platform-boundary checks;
8. formatting and strict type checks;
9. applicable build checks;
10. LocalCI compatibility/security checks where the environment supports them.

Also verify:

- all active component files remain present and uniquely listed;
- no separate decision-record or historical-overlay path/reference is tracked as authority;
- no clause ID is duplicated or orphaned;
- every internal reference resolves;
- every exact enum, schema field, threshold, cryptographic value, capability row, and gate remains present at its owner;
- the preservation ledger has no unmapped deletion;
- the matrix is byte-for-byte unchanged;
- application source and application behavior tests are unchanged except where a contract validator necessarily reads them without modifying them;
- GitHub Actions remains authoritative and LocalCI/GitLab remain non-authoritative.

Local green results are supplementary only. Do not claim release qualification without an exact-candidate authoritative GitHub Actions run, and do not seek that run without separate publication authorization.

## 11. Hard acceptance criteria

The goal is complete only when all are true:

1. Every instruction in this goal has been checked explicitly.
2. The persistent findings are addressed or truthfully marked with a precise remaining reason.
3. No feature, security control, effectiveness guarantee, threshold, failure behavior, or evidence gate is weakened.
4. Every changed normative sentence is represented in the preservation ledger.
5. Each requirement has one complete owner and all dependent references resolve.
6. The `JARVIS_BACKUP_V1` fixed format is unambiguous and unchanged.
7. Platform, authorization, trust, update, provider, voice, UI, accessibility, and release boundaries are unchanged.
8. `AGENTS.md` is concise and reference-driven without losing unique instructions.
9. Duplicated acceptance commands have one controlled source where safe, with parity tests.
10. No application code or implementation-matrix progress changed.
11. No prohibited decision-record artifact or authority exists.
12. All applicable local verification passes.
13. The working tree contains only the intended scoped changes and preserved pre-existing untracked material.
14. The final report distinguishes contract-document completion from application/release completion.

Any failed, unknown, or unproven criterion requires `NEXT PASS`, not completion.

## 12. Required final report

Report:

- branch, base SHA, final candidate SHA or uncommitted state;
- exact files changed;
- before/after line counts and acceptance-command duplication counts;
- clause preservation ledger location and summary;
- every owner transfer and notable consolidation;
- exact version/revision decision and authority for it;
- targeted and full local verification results;
- confirmation that the matrix and application code did not change;
- confirmation that no decision-record artifacts were created or used;
- preserved untracked items;
- authoritative GitHub evidence state;
- all remaining limitations or unresolved findings.

Do not publish, integrate, request an audit, advance the matrix, or claim `Production Complete` as part of this goal.
