# JARVIS Contract Simplification Remediation Goal

## 1. Objective

Close every verified gap left by the prior contract-simplification pass while preserving, without weakening or broadening, every active product, security, reliability, platform, accessibility, verification, and release requirement.

This is a contract-maintenance goal. It authorizes only active-contract, contributor-guidance, validation, generated-artifact, and acceptance-command maintenance required to make the contract system genuinely single-owner, lossless, and maintainable. It does not authorize application implementation, application refactoring, implementation-matrix progression, application evidence advancement, publication, integration, release qualification, or auditor handoff.

The active manifest, J00 through J05, Release Profile, and applicable repository instructions remain the only normative authority. The prior goal, findings, preservation ledger, reports, branches, and historical material are non-normative execution aids only.

ADRs and separate decision records are prohibited. Do not create, retain, consult, cite, or treat them as authority. Resolve every authorized change directly and synchronously in the active suite.

## 2. Required result

The final tree must demonstrate all of the following:

- every applicable requirement has one complete normative owner;
- other clauses retain only their distinct obligation and an exact owner reference where lossless;
- no duplicate behavioral catalog, state enumeration, capability matrix, gate list, or release condition remains merely because it is convenient to copy;
- all exact values, schemas, state names, cryptographic constructions, negative cases, thresholds, and release vetoes remain present at their owner;
- LocalCI and Phase 0 derive overlapping gate selection and commands from one controlled definition wherever technically safe, with any non-derived consumer explicitly justified and parity-tested;
- the preservation ledger describes the final text accurately, including unresolved items and precise blockers;
- the findings and this goal distinguish verified completion from a hypothesis, local validation from authoritative CI, and contract completion from application or release completion.

Documentation becoming shorter is not completion. A gap is closed only when the final text, ownership map, preservation record, and applicable validation all prove it.

## 3. Non-negotiable preservation boundaries

Preserve exactly:

1. Windows `FULL_HOST` as the mandatory V1 target; Linux full-host and companion claims remain future-scoped and truthful.
2. Platform-capability composition and qualified Windows security mechanisms, including IPC, Job Objects, WebView, secure storage, elevation mediation, and fail-closed unavailable capability behavior.
3. PermissionEngine precedence, bound authorization, DataPolicy, final destructive confirmation, audit/state coupling, recovery, and `UNCERTAIN` behavior.
4. The fixed `JARVIS_BACKUP_V1` format, AES-256-GCM requirement, key hierarchy, slots, nonce/tag/chunk/AAD behavior, restore behavior, and qualification vectors.
5. Project-policy enrollment/trust, TUF and update trust, revocation, rollback, freeze/mix-and-match, module boundaries, and security epochs.
6. Provider setup, privilege separation, sandbox claims, compatibility, supervision, fallback, and platform qualification.
7. GitHub and Proxmox V1 capability matrices and exclusions.
8. Voice, normalized TTS fields/events, AEC capability/supervisor behavior, latency, readiness, interruption, and fallback requirements.
9. Mission Control identity, adaptive UI, accessibility thresholds, and all required positive, negative, recovery, adversarial, platform, package, provenance, performance, soak, and live-evidence gates.
10. GitHub Actions as mandatory CI authority, GitLab as mirror-only, LocalCI as non-authoritative, exact-candidate evidence, and signed-artifact release qualification.

If simplification cannot be proven lossless, retain the source wording and record the reason. Do not replace a precise requirement with a generic reference.

## 4. Mandatory preparation

Before writes:

1. Revalidate the current worktree, branch, `HEAD`, `origin/master`, merge base, tracked changes, and preserved untracked paths without pulling, resetting, or overwriting anything.
2. Read the active manifest, all J00–J05 components, Release Profile, root and applicable nested `AGENTS.md`, the findings, the preservation ledger, this goal, and each affected validator/consumer.
3. Confirm that no other task is editing the same files. Preserve all pre-existing tracked and untracked work.
4. Record a baseline for line counts, clause IDs, cross-references, duplicate requirement groups, gate IDs/commands, and validation status.
5. Update the ledger before deleting or rewriting a normative sentence. Each changed clause needs source clause, exact requirement/value, change class, complete destination owner, updated references, tests/validators, semantic result, and final review status.
6. Resolve version treatment under MAN-08 before normative edits. A material meaning change requires the active amendment process and explicit authorization; it is not permitted to be disguised as simplification.

## 5. Verified remediation backlog

The following are known failures from the independent final-tree review. They must be resolved or truthfully retained as blocked with a precise preservation reason. A ledger claim alone does not resolve them.

### 5.1 J01 platform and provider-state duplication

In `JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md`:

1. Merge duplicate platform-role/future-platform material across J01-PLAT-01 through J01-PLAT-03 and J01-PLAT-29 through J01-PLAT-32.
2. Retain one complete owner for Windows V1 `FULL_HOST`, Linux future full host, and future companion truthfulness. Other clauses may retain distinct scope, non-goal, or promotion obligations only.
3. Define provider setup, compatibility, and health state vocabularies once. J01-RT-14 may retain runtime behavior and J01-PROTO-19 may retain types, but copied enum lists must become exact references to the single canonical definition.
4. Preserve every provider state, transition implication, compatibility condition, and release qualification condition.
5. Update every dependent reference and ledger row. The existing claim that this repetition was merged must not remain unless final text proves it.

### 5.2 J00 implementation-summary duplication

In `JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md`:

1. Rework J00-CODE-09, CODE-15, CODE-17, CODE-18, and CODE-20 through CODE-26 so they retain only J00-specific coding/repository obligations.
2. Replace copied security, provider, platform, tool, integration, module, UI, backup, and recovery behavior with exact references to their complete J01–J04 owners.
3. Keep CODE-27’s distinct test-code rules, but make J05 the complete owner of test layers, evidence catalog, and qualification procedure.
4. Reduce CODE-31 and CODE-32 to a concise owner/invariant map. Do not discard unique review or architecture-enforcement obligations; move only duplicated detail to its complete owner.
5. Do not use a generic citation such as “see J01–J05.” Each reference must identify the relevant owner clauses.

### 5.3 Release Profile repetition

In `JARVIS-V1-RELEASE-PROFILE.md`:

1. Preserve the Release Profile as the exact V1 selection source: selected platform, runtime role, provider, integration capabilities, voice profile, hardware baseline, artifact fields, post-V1 commitments, and Production Complete boundary.
2. Replace repeated component behavior in RP-03, RP-04, RP-05, RP-15, RP-17, and RP-18 with exact J01–J05 owner references where a complete owner already exists.
3. Keep RP-specific selections and release gates that have no other complete owner. Do not turn the Release Profile into an empty index.
4. Preserve the signed Windows artifact and exact-source requirements for Production Complete.
5. Eliminate duplicate “documentation completion alone” wording while retaining the rule once in the appropriate owner and references elsewhere.

### 5.4 Acceptance-command single source

In `tools/ci/localci-gate-manifest.mjs`, `.localci/ci.sh`, `tools/checkpoints/phase0-checkpoint-profile.json`, `tools/checkpoints/phase0-checkpoint.mjs`, and `.github/workflows/static-ci.yml`:

1. Retain one controlled metadata definition with gate ID, command, execution class, authority, and evidence purpose for all 30 canonical gates.
2. Keep Phase 0’s ordered subset derived by gate ID, rejecting missing, duplicate, reordered, unknown, and command-drift entries.
3. Make LocalCI consume generated or derived gate commands rather than hand-maintaining a second 30-command list, if the Bash runtime can safely consume a generated artifact or a deterministic export of the metadata.
4. If direct consumption is technically unsafe, document the specific portability, shell, bootstrap, or trust constraint in the metadata/validator and generate the LocalCI command view from the shared model. Parity validation alone is insufficient unless generation is technically impossible and the reason is tested.
5. Preserve explicit GitHub Actions workflow topology when runner/platform isolation requires it. Remove duplicated commands only where safe; do not collapse Windows/general jobs, exact checkout, pinned toolchain, artifacts, cancellation, or failure behavior.
6. Preserve LocalCI exit code 78 and non-authoritative status. Do not promote LocalCI or GitLab to CI authority.
7. Extend existing tests for generated/derived command parity, duplicate/missing/unknown/reordered gates, authority classification, slash/backslash forbidden historical paths, and failure-closed LocalCI behavior.

### 5.5 Findings, ledger, and goal truthfulness

1. Correct any ledger row that says “completed,” “merged,” or “reference-only deduplication” when final text still contains the claimed duplicate behavior.
2. Each outstanding row must be marked `OPEN`, with source clauses, exact reason, owner, next action, and verification needed. Each closed row must identify final clauses and passing evidence.
3. Update the findings only for measured current-tree evidence. Do not preserve stale candidate narratives or use history as authority.
4. Update this remediation goal if discovery finds a new gap; include the exact evidence and affected owner. Do not silently expand scope into application implementation.

## 6. Independent discovery and remediation loop

Perform the following loop after the known backlog has been addressed. This loop is mandatory and must be performed by the implementing agent as a fresh review, not satisfied by prior conclusions.

### Loop A — independent final-tree audit

1. Re-read this goal, the findings, the ledger, the manifest, every active component, the Release Profile, and affected command consumers from first line through last line.
2. Compare the final text to every requirement in Sections 2–5 of this goal.
3. Search for duplicate normative behavior, state/type enumerations, capability matrices, verification catalogs, gate commands, repeated release definitions, circular references, generic references, orphaned clause IDs, unresolved references, and stale completion claims.
4. Check every ledger row against the actual final source and destination clauses. A row is closed only if the owner is complete and the source no longer repeats behavior beyond its distinct obligation.
5. Compare the changed tree with the protected paths. Confirm no application source, application behavior test, implementation-plan sequencing, or matrix state changed except an authorized validator read-only dependency.
6. Inspect all touched validator logic for false confidence: the test must fail when its claimed invariant is removed, duplicated, or made stale.
7. Write each newly discovered gap into the ledger and findings before any remediation edit.

### Loop B — bounded remediation

For each open item:

1. Identify the complete owner and every exact value, state, negative case, threshold, behavior, or veto being transferred.
2. Make the smallest lossless edit that removes only the duplicated material.
3. Update all dependent references, generated artifacts, validators, and existing tests in the same change set.
4. Run focused checks immediately. If any check fails, repair the cause or revert only the current attempted change without disturbing unrelated user work.
5. Mark the ledger row closed only after final-text comparison and passing focused evidence.

### Loop C — closure decision

Repeat Loop A after each batch of related changes until one of these terminal states is reached:

- **COMPLETE:** zero open gaps, every goal requirement is proven, all applicable checks pass, and the final self-audit finds no unsupported completion claim; or
- **NEXT PASS:** one or more gaps cannot be safely resolved without a material semantic change, missing authority, unavailable evidence, or prohibited application work. Record each exact blocker and stop. Do not call the goal complete.

Do not use an arbitrary iteration count or line-count target as a stopping rule. Do not continue indefinitely after a genuine authorization blocker; report it precisely.

## 7. Required validation

After each affected file or consumer, run focused checks. Before a closure decision, run the applicable local fail-fast sequence in repository-required order:

1. targeted validator, generator, reference, and command-consumer tests;
2. normal local test profile;
3. contract manifest, generated-artifact, and drift checks;
4. schema and generated-output checks;
5. governance and forbidden historical-path checks;
6. security, secret, dependency, license, and provenance checks;
7. architecture and platform-boundary checks;
8. formatting and strict type checks;
9. applicable build checks;
10. LocalCI compatibility/security checks where supported.

Additionally prove:

- active component files are present and uniquely listed;
- no ADR, decision-record, or historical-overlay path/reference is tracked as authority;
- no clause ID is duplicated or orphaned and all internal references resolve;
- every exact enum, schema field, threshold, cryptographic value, capability row, and gate remains at its complete owner;
- the ledger has no unmapped deletion, false closed row, or unexplained open row;
- the matrix is byte-for-byte unchanged;
- application source and application behavior tests are unchanged;
- GitHub Actions remains authoritative while GitLab and LocalCI remain non-authoritative.

Local results are supplementary only. Do not publish, seek an exact GitHub Actions run, integrate, or claim release qualification without a separate explicit authorization.

## 8. Hard acceptance criteria

This remediation goal is complete only when all statements are true:

1. Every known gap in Section 5 is closed. Any blocked gap must be recorded under the `NEXT PASS` rule and prevents completion.
2. The independent audit loop found no unrecorded duplication, incorrect ownership, false completion claim, or prohibited-scope change.
3. Every changed normative sentence has a complete preservation-ledger mapping.
4. Each requirement has one complete owner and all dependent references resolve.
5. No feature, security control, exact construction, threshold, failure behavior, evidence gate, or release condition is weakened.
6. The fixed backup format and all platform, authorization, trust, update, provider, voice, UI, accessibility, CI, and release boundaries remain unchanged.
7. Acceptance commands use one controlled source where safe, with tested derivation/generation or a tested, precise technical exception.
8. Findings, ledger, and goal accurately reflect final-tree evidence.
9. No application code, application behavior test, implementation-matrix state, publication, integration, or auditor handoff occurred.
10. All applicable local validation passes and every unavailable gate is reported accurately.

Any failed, unknown, unproven, or contradicted criterion requires `NEXT PASS`, not completion.

## 9. Required final report

Report:

- branch, base SHA, candidate SHA or uncommitted state, and preserved untracked items;
- exact changed files and a file-by-file account of the resolved gaps;
- the final owner for each transferred requirement;
- every independent-audit discovery, including gaps found and how each was resolved or blocked;
- the final ledger state with no unsupported closed rows;
- before/after duplicate counts where measured, without treating counts as proof by themselves;
- targeted and full validation results, with failed/unavailable gates stated exactly;
- confirmation that the matrix and application source/behavior tests were unchanged;
- confirmation that no ADR or decision-record artifact was created, retained, consulted, cited, or used as authority;
- authoritative GitHub evidence state and an explicit statement that contract completion is not application completion, release qualification, or Production Complete.

Do not publish, integrate, advance the matrix, request an audit, or claim Production Complete as part of this goal.
