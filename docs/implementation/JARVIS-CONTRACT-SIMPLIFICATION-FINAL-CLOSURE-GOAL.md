# JARVIS Contract Simplification Final Closure Goal

## 1. Objective

Close every verified gap in the 2026-09-16 second independent review and every additional contract-maintenance gap discovered during execution, while preserving without weakening or broadening every active feature, security control, state, schema, threshold, failure path, verification gate, CI-authority boundary, and release condition.

This is pure contract simplification, optimization, consolidation, and contract-maintenance validation. It authorizes only the smallest necessary changes to the active manifest, J00–J05, Release Profile, contributor guidance, preservation findings/ledger, contract-derived validation metadata, and existing contract/governance/acceptance validators and their tests.

It does **not** authorize application implementation or refactoring, new product behavior, implementation-plan sequencing changes, implementation-matrix progression, application evidence advancement, publication, push, integration, release qualification, Production Complete, or auditor handoff.

**Owner-authorized evidence-hygiene exception (2026-09-18):** the owner explicitly authorizes a documentation-only correction to `docs/implementation/evidence/1.4-single-instance-ownership.md`. The exception is limited to labeling six retired v1.0.7 paths as historical/non-authoritative, listing the current v1.0.8 authority and non-normative implementation routing, and replacing one transient repository-external worktree-store path with truthful approved `G:\` repository-boundary wording. It does not authorize changing any application behavior, evidence result/status, test count, candidate/tree SHA, run/job/artifact identity, digest, matrix status, implementation claim, or lifecycle decision. An existing contract-drift test SHALL freeze the behavior section and evidence identity/result values and SHALL fail on a mutation of any protected value.

ADRs and separate decision records are prohibited. Do not create, retain, consult, cite, or use them as current or historical authority. Resolve every authorized contract correction directly and synchronously in the active suite.

## 2. Governing agreement

The final result must satisfy all of these together:

1. Simplify duplicated or overengineered contract wording and acceptance maintenance.
2. Preserve every feature, security control, threshold, exact construction, state transition, failure behavior, verification gate, and release boundary.
3. Give each normative requirement one complete owner; references may state only the caller's distinct obligation.
4. Consolidate acceptance definitions wherever technically safe without reducing CI, security, evidence, platform, or failure-closed behavior.
5. Keep GitHub Actions as mandatory CI authority, GitLab mirror-only, and LocalCI non-authoritative.
6. Keep Windows `FULL_HOST` mandatory for V1 and Linux/companion support future-scoped and truthful.
7. Preserve the fixed `JARVIS_BACKUP_V1` format, PermissionEngine, DataPolicy, provider setup isolation, project-policy trust, TUF/update trust, process/IPC/WebView protections, recovery, and final destructive confirmation.
8. Make no application implementation, matrix, publication, integration, release, or audit-handoff change.
9. Report uncertainty or a blocker as `NEXT PASS`; never convert missing proof into completion language.

## 3. Mandatory preparation before any remediation edit

1. Re-read this goal, the active manifest, all J00–J05 components, Release Profile, root and applicable nested `AGENTS.md`, the persistent findings, and the preservation ledger from first line through last line.
2. Revalidate branch, `HEAD`, live local `origin/master`, merge base, tracked changes, untracked paths, and concurrent work without pulling, resetting, deleting, overwriting, or cleaning anything.
3. Record a new baseline containing:
   - exact file hashes and line counts for the active suite;
   - clause IDs and all direct references;
   - every canonical enum/state/capability catalog and every file where it appears;
   - all 30 acceptance-gate definitions and every LocalCI, Phase 0, and GitHub consumer form;
   - protected application, matrix, plan, and evidence-file hashes;
   - current targeted and full local validation status.
4. Mark every G-01 through G-07 ledger entry `OPEN` before editing affected text.
5. For each prospective normative edit, add a ledger row containing the exact source clause and sentence/value, change class, complete destination owner, retained distinct source obligation, all dependent references, validator/test proof, semantic result, and status.
6. Resolve MAN-08 version authority before relying on its edited no-bump exception. Do not let the disputed rule authorize itself.

## 4. Required remediation backlog

### 4.1 G-01 — Complete canonical state/type ownership

Review every active enum, state list, capability catalog, and state-family table—not only the examples below. At minimum reconcile:

- J01-PROTO-13 with J02-DATA-09 through J02-DATA-11;
- J01-PROTO-11 with J02-DATA-12;
- J01-PROTO-18 with J02-DATA-14;
- J01-PROTO-19 with J02-DATA-22;
- J01-PROTO-22 with J02-DATA-24;
- J02-DATA-25 with J04-OPS-15;
- J01-PROTO-24 with J04-OPS-10;
- any voice, notification, UI-state, provider, module, integration, budget, approval, mission, task, attempt, or recovery catalog found by the fresh audit.

For each group:

1. Select one complete owner for the vocabulary.
2. Keep legal transitions, persistence invariants, operational behavior, and UI mapping in their proper components by exact owner reference.
3. Do not remove transition edges, terminal-state rules, recovery conditions, persistence fields, presentation requirements, or negative cases merely because the enum list moves.
4. Do not turn exact references into generic "see J01–J05" citations.
5. Extend existing validators so adding a second standalone canonical catalog, removing an owner value, or making a dependent reference stale fails.
6. Correct the existing provider-state single-owner test so it checks the entire active suite, including J02-DATA-22 and any other normative copy.

### 4.2 G-02 — Restore the normative local preflight requirement

1. Compare the prior RP-17 preflight text with current J00-GOV-28, J05-VER-33, RP-17, and `AGENTS.md`.
2. Place the ordered local fail-fast preflight requirement in one active normative owner, preferably J00-GOV-28 for repository workflow or J05-VER-33 for qualification evidence, without changing GitHub Actions authority.
3. Require relevant targeted checks, normal local profile, and applicable contract, schema/generated-output, governance, security, provenance, architecture, format, type, build, and platform checks before authorized candidate publication.
4. State that local preflight is supplementary and cannot qualify CI or release.
5. Make RP-17 and contributor guidance reference the exact owner and retain only their distinct selection/routing obligations.
6. Add a negative drift test proving deletion of the normative preflight owner fails.

### 4.3 G-03 — Make acceptance consolidation genuinely controlled and fail-closed

#### Phase 0

1. Define one canonical ordered Phase 0 gate-ID subset independently of mutable profile input.
2. Make validation reject a missing, extra, duplicate, reordered, unknown, or command-drift gate ID in `phase0-checkpoint-profile.json`.
3. Add direct mutation tests for every rejection class, including deleting an ID from the profile itself.
4. Preserve all existing Phase 0 topology, Windows-job, evidence-order, and fail-closed checks.

#### LocalCI

1. Replace or harden process-substitution sourcing so renderer failure, empty output, malformed output, partial output, or shell-evaluation failure stops before any gate/evidence claim.
2. Use a deterministic bounded intermediate artifact or another proven mechanism that exposes the renderer exit status; clean it safely and preserve exit code 78 semantics.
3. Validate executable structure, not substring presence. A commented, quoted, duplicated, reordered, or unreachable renderer invocation must fail validation.
4. Prove the complete 30-gate sequence executes exactly once and before terminal evidence.
5. Add focused tests for generator failure, zero output, truncated output, malformed line, unknown gate, duplicate gate, reordered gate, disabled/commented invocation, execution before/after evidence, and non-authoritative exit behavior.
6. Do not add a second hand-maintained 30-command list.

#### GitHub Actions and shared metadata

1. Treat each gate definition as a semantic gate, not falsely as one shell's exact command when consumer syntax differs.
2. Model reviewed consumer-specific command/working-directory/output variants where technically necessary, or derive the workflow form from the shared definition when safe.
3. Record the precise shell, runner, working-directory, evidence-output, and topology reason for every non-derived GitHub form in controlled metadata or validator logic, not only prose in the ledger.
4. Add parity tests proving every one of the 30 semantic gates has the required LocalCI/GitHub representation and that the Phase 0 subset resolves to the same semantic definitions.
5. Preserve Windows/general job separation, exact checkout, immutable action pins, least privilege, evidence upload, cancellation, timeout, aggregation, and failure ordering.
6. Rename ambiguous metadata such as `authority` if necessary so it cannot imply that a LocalCI execution result is authoritative. The value must continue to express that only GitHub Actions can satisfy mandatory CI.

### 4.4 G-04 — Rebuild preservation evidence to the required granularity

1. Replace broad clause-range closure claims with one row per changed normative sentence or inseparable requirement group.
2. Include the exact old obligation/value, exact final owner, retained source obligation, dependent references, validator/test, and semantic comparison.
3. Re-open every row whose proof is generic, circular, stale, or contradicted by G-01 through G-03.
4. Separate measured metrics explicitly:
   - total separator lines;
   - redundant separator patterns;
   - exact duplicate blocks;
   - semantic duplicate catalogs.
5. Recompute each metric with a documented reproducible method. Do not retain the unsupported 697-to-358 statement if the measured final value differs.
6. Update findings and ledger only from the final working tree. Remove every unsupported word such as "complete," "closed," or "single owner."

### 4.5 G-05 — Resolve MAN-08 without self-authorization

Choose one of these lawful outcomes before further normative closure:

- **Restore:** restore the prior rule that component revisions advance when normative content changes, then determine and apply the required component/manifest revision consequences synchronously; or
- **Authorized amendment:** obtain explicit owner/governance authorization for the meaning-based no-bump exception, record the exact authorization scope in the active amendment itself, advance the suite/component version if MAN-08/J00-GOV-29 requires it, and update all affected version references and generated artifacts synchronously.

Do not infer authorization from the prior ledger statement. Do not hide this governance change inside a simplification diff. If neither outcome is authorized, record an exact blocker and stop as `NEXT PASS`.

### 4.6 G-06 — Resolve protected-test scope truthfully

1. Classify `tests/layers/unit/desktop-production-tauri-build.test.mjs` by its actual role and assertions.
2. If it is a validator-consumer adaptation allowed by the goal, state that exact exception in the goal/ledger and prove its application behavior assertions and negative cases are unchanged.
3. Otherwise restore it byte-for-byte and provide the derived metadata compatibility boundary outside the application behavior test.
4. Audit every changed test file. Only contract, governance, acceptance-metadata, or read-only validator-consumer changes are permitted.
5. Do not report application behavior tests as byte-for-byte unchanged when any such file differs.

### 4.7 G-07 — Deliver the required closure report

Create a persistent final report only after the last audit loop. It must include:

- branch, base SHA, HEAD/candidate or uncommitted state, and preserved untracked paths;
- exact changed files and file-by-file purpose;
- every ownership transfer and retained distinct obligation;
- every gap discovered in all audit iterations and its final status;
- exact ledger state and all blockers;
- reproducible before/after duplicate metrics;
- targeted and full validation commands/results;
- protected matrix, plan, application source, behavior-test, evidence, publication, integration, and release state;
- tracked ADR/decision-record/path/reference result;
- GitHub Actions evidence state;
- explicit statement that contract completion is not application completion, release qualification, or Production Complete.

The report itself is non-normative and must not claim an exact-candidate GitHub result that does not exist.

## 5. Independent discovery and remediation loop

This loop is mandatory and is not satisfied by the 2026-09-16 findings.

### Loop A — fresh hostile review

1. Re-read this goal, findings, ledger, manifest, all active components, Release Profile, and every affected consumer from first line through last line.
2. Treat all prior `closed`, `pass`, and `complete` statements as hypotheses.
3. Search for:
   - duplicate normative catalogs, values, matrices, state lists, gate commands, release definitions, and invariant summaries;
   - lost requirements hidden behind references whose alleged owner does not contain them;
   - circular, generic, broken, or stale references;
   - weakened `SHALL`/`MUST`, negative cases, thresholds, exact constructions, failure behavior, or release vetoes;
   - validator self-comparison, mutable-source circularity, substring-only checks, dead-code/comment bypasses, and tests that cannot fail when the claimed invariant is broken;
   - false ledger metrics, unmapped deletions, stale candidate facts, and unsupported completion language;
   - protected-scope changes.
4. Add every discovered gap to both the findings and ledger as `OPEN` before fixing it.

### Loop B — bounded lossless correction

For each open gap:

1. Identify the exact owner and every value, state, transition, threshold, negative case, failure path, and veto involved.
2. Make the smallest contract-maintenance edit that closes only that gap.
3. Update all exact references, generated artifacts, validators, and existing validator tests in the same bounded change.
4. Run focused negative and positive checks immediately.
5. Mark the item closed only after comparing the final owner/source text and proving the negative test detects regression.

### Loop C — repeat-until-terminal closure

After each bounded batch, repeat Loop A against the entire final tree. Continue until exactly one state applies:

- **COMPLETE:** zero open/unknown/contradicted items; every agreement and goal criterion is proven; all applicable checks pass; ledger/findings/report match the final tree; no protected-scope change remains; or
- **NEXT PASS:** a material semantic decision, version authority, missing evidence, unsupported environment, or prohibited application work prevents safe closure. Record the exact blocker and stop without claiming completion.

Do not stop because checks are green, text is shorter, an iteration count was reached, or the previous agent already declared completion.

## 6. Required validation

Run focused tests after each affected consumer. Before the closure decision, run the repository-required local sequence in order:

1. targeted contract/reference/state-catalog/acceptance-consumer tests;
2. normal local test profile;
3. contract generation, manifest, and drift checks;
4. schema and generated-output checks;
5. governance and forbidden historical-path/reference checks;
6. security, secret, dependency, license, and provenance checks;
7. architecture and platform-boundary checks;
8. formatting and strict type checks;
9. applicable builds;
10. LocalCI compatibility/failure-closed tests supported by the current environment.

Additionally prove:

- all active files are present and uniquely listed;
- all clause IDs are unique and every direct reference resolves;
- every canonical enum/state/capability catalog has one owner and no unapproved normative copy;
- all exact cryptographic values, thresholds, capability selections, negative cases, and release vetoes remain;
- all 30 semantic gates and the Phase 0 subset have complete, tested consumer mappings;
- no tracked ADR, decision-record, or historical-overlay path/reference acts as authority;
- implementation matrix, implementation plan, and application source are byte-for-byte unchanged; application evidence is byte-for-byte unchanged except for the exact owner-authorized documentation-only evidence-hygiene exception above, whose protected behavior and evidence-result values remain frozen by a negative scope test;
- every changed test is within the explicitly allowed validator scope and retains or strengthens its prior assertions;
- no publication, push, integration, release qualification, or auditor handoff occurred;
- GitHub Actions remains authoritative and no local result is represented as exact-candidate CI evidence.

If a supported Bash runtime is unavailable, do not claim runtime proof of the LocalCI loading mechanism. Either validate it in an available equivalent supported environment or stop with the exact `NEXT PASS` limitation.

## 7. Hard acceptance criteria

Completion requires every statement below to be true:

1. G-01 through G-07 are closed with final-tree evidence.
2. The last full Loop A finds no new gap.
3. Every changed normative sentence or inseparable requirement group has an exact ledger mapping.
4. No requirement, security property, state, transition, threshold, negative case, failure behavior, evidence gate, or release condition is lost, weakened, broadened, or made ambiguous.
5. Acceptance definitions are single-source where safe and every exception is precise, controlled, and tested.
6. Phase 0 and LocalCI fail closed when definitions, renderer execution, ordering, or evidence sequencing drift.
7. MAN-08/version treatment has explicit valid authority and is not circular.
8. Findings, ledger, goal, and final report contain no unsupported completion claim or stale metric.
9. No prohibited implementation, matrix, plan, evidence advancement, publication, integration, release, or audit-handoff action occurred; the exact owner-authorized documentation-only evidence-hygiene exception changed no protected behavior or evidence-result value.
10. Every applicable local validation passes, and every unavailable external gate is reported exactly.

Any failed, unknown, unproven, contradictory, or blocked criterion requires `NEXT PASS`.

## 8. Required final response

Lead with `COMPLETE` or `NEXT PASS`. Provide evidence, not confidence language. Include the persistent report path, exact validation results, protected-scope result, ADR result, GitHub evidence limitation, and the statement:

> Contract simplification completion is not application implementation, release qualification, or Production Complete.

Do not publish, push, integrate, advance the matrix, request an audit, or claim Production Complete under this goal.
