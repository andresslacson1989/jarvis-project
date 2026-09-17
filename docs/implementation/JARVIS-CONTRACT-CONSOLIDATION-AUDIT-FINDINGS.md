# JARVIS Contract Simplification Findings

## Current independent-audit loop — 2026-09-17

**Audited predecessor:** `d447b89c7506281567f5ee2f8771fba91a8bdf1f` on `codex/contract-consolidation`, based on `origin/master` `bb59c13d99c8b472de0dbe08b8f5ce59cf50e705`.

**Independent decision:** `NOT APPROVED — NEXT PASS`. Exact GitHub Actions run `35184074308` succeeded for `d447...`; rejection concerned stale/current repository records and missing drift enforcement, not a failed exact CI run.

| Current finding | Repository-side disposition in successor | Remaining gate |
| --- | --- | --- |
| Governance profile and `MASTER-PROTECTION.md` said exact candidate evidence was not recorded | Replaced with an explicit latest-completed-predecessor model containing the exact `d447...` run, both jobs, timestamps, artifacts, and digests; successor non-qualification is machine-readable and documented. | Successor requires its own external exact-head run and audit. |
| Closure report/ledger/findings/traceability records were historical-only | Added separate current successor sections; historical bodies and measurements remain unchanged. | Final successor SHA/run are supplied externally because a commit cannot embed its own future identity. |
| Section 1.4 labeled deleted v1.0.7 paths as active/governing | Every retired path is explicitly historical and non-authoritative; a separate current v1.0.8 authority block is present. | None repository-side. |
| No regression rejected retired paths under active labels | Contract drift now scans tracked evidence/governance Markdown and rejects slash, backslash, and disguised active-label forms. | None repository-side. |
| Bootstrap values agreed but were not cross-file enforced | Official schema verification now binds canonical schema/value, bootstrap schema, and TypeScript protocol source to the supported J01-RT-06 tuple. | None repository-side. |
| Section 1.4 exposed a transient absolute `.codex-worktrees` package-store path | Historical result retained; concrete transient path omitted and approved G: repository boundary stated. | Preserved untracked content remains untouched. |
| `AGENTS.md` lost explicit developer-goal routing | Concise developer-goal and contract-final-closure-goal routing restored; both remain non-normative. README links both aids. | None repository-side. |
| MAN-08 ratification lacked a current ledger entry | Added a redacted current owner-authorization record limited to the CI-authority amendment introduced by `5435fc96...`. | No broader amendment is claimed. |
| `d447...` successful Section 1.4 jobs were not classified in current records | Current report classifies them as exact predecessor evidence while preserving Section 1.4 `VERIFYING`, all negative runs, and every integration/checkpoint gate. | Lifecycle approval, integration, authoritative-master verification, and Section 1 checkpoint remain open. |
| Full 207-file stacked scope was insufficiently separated | Current report distinguishes consolidation, `d2cc90be`, `833c8a83`, and the five-file `d447...` delta. | Protected review must assess the complete successor diff. |

**Current disposition:** repository-side remediation is bounded and the ordered pinned local preflight passed on the finalizing successor tree. The successor remains `NEXT PASS` until it is committed, its exact head passes GitHub Actions, and the independent audit approves that exact candidate. No matrix advancement, integration, release qualification, or `Production Complete` claim is authorized.

## Historical findings record — non-current

> **Historical-state reconciliation (2026-09-17):** This file preserves the audit chronology at reviewed HEAD `e07d0326dde59c0157d70669d97c3eba165b13d8`; its no-matrix-diff, 22-file, and no-exact-CI statements apply only to that historical snapshot. The published pre-remediation candidate is `983e25cac90028449876b4f0c8678449bd18b49b`, with passing exact GitHub Actions run `35163261745`, a 25-file normal local profile, 8,112 active-suite lines, 385 unique clause IDs, and 362 J00–J05 separator lines. First remediation candidate `2f587a52cd385e0da9532b509776cb90fcd1ec46` added the explicit J01 bootstrap version-identity invariant, measured 8,114 active-suite lines, and passed exact GitHub Actions run `35171102471` attempt 2. These are fixed historical identities; any later candidate requires its own exact-candidate evidence. Separately authorized matrix/plan reconciliation is identified by commit `d2cc90be`; preserved Section 1.4 implementation/evidence is identified separately and remains `VERIFYING`.

**Status:** Non-normative audit aid and persistent review evidence. This file does not authorize implementation, change contract meaning, supersede the active suite, advance the implementation matrix, or qualify a release.

**Review date:** 2026-09-15

**Repository:** `G:\Jarvis Project`

**Reviewed branch:** `codex/contract-consolidation`

**Reviewed HEAD:** `e07d0326dde59c0157d70669d97c3eba165b13d8`

**Authoritative base:** `origin/master` at `bb59c13d99c8b472de0dbe08b8f5ce59cf50e705`

## Purpose

Record the overengineering, duplication, and avoidable maintenance burden that can be removed from the active contract system without weakening product behavior, security, reliability, accessibility, verification, or release qualification.

This is a contract-document simplification review only. It does not authorize application implementation, matrix progression, publication, integration, or creation or use of architecture decision records.

The retired `docs/decisions/` path is listed only to preserve validator coverage. It must not exist as tracked authority or content.

## Review scope

The review covered:

- `AGENTS.md`;
- `README.md`;
- `docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md`;
- all six active `JARVIS-00` through `JARVIS-05` normative components;
- `docs/JARVIS-V1-RELEASE-PROFILE.md`;
- `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` as a non-normative sequencing aid;
- the current developer execution goal and this findings record;
- contract validation, Phase 0, LocalCI, and GitHub Actions command definitions where duplication affects contract maintenance.

## Measured baseline

- Active normative suite: approximately **9,585 lines**.
- Root `AGENTS.md`: **463 lines**.
- Embedded implementation protocol within `AGENTS.md`: approximately **280 lines**.
- Universal source-reading list excluding `AGENTS.md`: approximately **11,228 lines**.
- Redundant adjacent Markdown separator patterns in the reviewed documentation: **339**.
- Exact long duplicate text groups: **5**, including two boilerplate paragraphs repeated in every active component.
- Canonical LocalCI gate list: **30 commands**.
- Phase 0 profile: **21 commands**, all duplicated from the canonical gate list.
- Equivalent acceptance commands are also manually repeated in LocalCI and GitHub workflow definitions.

These counts are navigation and maintenance indicators, not targets to optimize blindly. Semantic duplication is greater than exact-text matching reveals.

## Non-negotiable preservation boundary

Simplification must preserve every applicable requirement and measurable threshold, including:

- Windows `FULL_HOST` as the mandatory V1 target and truthful future status for Linux and companion clients;
- platform capability boundaries and strongest qualified Windows mechanisms;
- Tauri, IPC, process ownership, Job Object, elevation, WebView, and secret-handling controls;
- PermissionEngine authorization, risk classification, target binding, and final destructive confirmation;
- DataPolicy and sensitivity enforcement;
- authoritative state transitions, atomicity, idempotency, retry safety, `UNCERTAIN`, reconciliation, recovery, and audit evidence;
- the exact `JARVIS_BACKUP_V1` format, cryptography, key hierarchy, nonce, tag, chunk, AAD, recovery-factor, restore, and vector requirements;
- project-policy enrollment and trust invalidation rules;
- TUF, update, module, signature, rollback, freeze, mix-and-match, and security-epoch controls;
- provider setup, privilege separation, lifecycle, fallback, and qualification behavior;
- exact GitHub and Proxmox capability boundaries;
- voice, TTS, AEC, interruption, latency, fallback, and readiness behavior;
- Mission Control, canonical visual identity, adaptive layout, and accessibility thresholds;
- all required positive, negative, adversarial, failure, crash/recovery, platform, package, provenance, performance, and soak evidence;
- GitHub Actions as CI authority, GitLab as mirror-only, and LocalCI as non-authoritative;
- exact-candidate and signed-artifact requirements for `Production Complete`.

No reduction in wording is acceptable if it removes, broadens, makes optional, or obscures any of these controls.

## Recommended authority ownership

Each rule should have one complete normative owner. Other components should reference that owner and state only their distinct obligation.

| File | Primary normative ownership |
| --- | --- |
| Manifest | Suite identity, active revisions, authority, amendment, and version rules |
| J00 | Product scope, repository governance, coding, dependency, and package rules |
| J01 | Platform, runtime, IPC, process, protocol, schema, and state vocabulary |
| J02 | Persistence, legal state transitions, transactions, recovery, backup, and restore |
| J03 | Authorization, secrets, project-policy trust, supply-chain trust, and TUF |
| J04 | Operations, integrations, provider UX, voice UX, UI, and accessibility behavior |
| J05 | Verification methods, evidence, CI, qualification, and release decisions |
| Release Profile | Exact V1 platform, capability, provider, integration, hardware, and release selections |

References must remain auditable and must not create circular ownership or require historical material.

## Findings

### F-01 — `AGENTS.md` is an embedded operating manual

`AGENTS.md` is 463 lines and contains roughly 280 lines of implementation-loop, scoring, atomicity, retry, evidence, and checkpoint guidance. Much of that repeats J00, J02, J05, the Implementation Plan, and the matrix.

**Safe simplification:** reduce it to a concise repository entry point, preferably no more than 100 lines. Retain unique instruction-level protections, source authority, branch/publication rules, destructive-action rules, and the prohibition on unauthorized contract or application changes. Replace copied contract behavior with direct references. Remove subjective scoring prose where objective hard gates already decide completion.

**Required safeguard:** build a source-to-destination map for every removed instruction and prove that each unique rule remains either in `AGENTS.md` or in its authoritative active contract owner.

### F-02 — Universal reading requirements impose excessive context cost

The mandatory source list requires approximately 11,228 lines before implementation or architecture work and includes this non-normative findings file. It applies the same reading burden regardless of task scope.

**Safe simplification:** require the manifest first, then task-applicable normative components. Require J05 and the Release Profile when verification or release scope applies. Require the Implementation Plan and matrix only for authorized application implementation. Require this findings file only for contract-maintenance work.

**Required safeguard:** applicability routing cannot make a mandatory requirement optional or permit implementation to rely on an unread governing component.

### F-03 — The manifest repeats product behavior

Although the manifest says it is not independent product behavior, MAN-04 through MAN-06 restate backup, project-policy, TUF, CI, platform, voice, and roadmap rules.

**Safe simplification:** keep the manifest as the suite identity and governance index: active files/revisions, authority order, amendment/version policy, and a concise ownership map. Move complete behavioral meaning to its owning component and use references from the manifest.

### F-04 — J00 duplicates domain contracts

Examples include scope duplication with the Release Profile and J01/J04; platform capability duplication with J01; project-policy, supply-chain, provider, tool, GitHub, Proxmox, module, UI, backup, and verification summaries that repeat J01 through J05; and overlapping CI-governance clauses.

**Safe simplification:** retain J00 ownership of scope, repository governance, coding, package, and dependency controls. Consolidate cross-domain summaries into a short owner/reference table. Merge overlapping CI-governance clauses without changing authority or fallback controls.

### F-05 — J01 mixes canonical interfaces with repeated policy

The platform-role model is repeated in early and late platform clauses. Runtime state vocabulary is repeated in protocol sections. DataPolicy and KDF details overlap J03. Test-vector and qualification prose overlaps J05.

**Safe simplification:** keep every canonical schema, interface, state enumeration, runtime, IPC, process, provider, voice, TTS, and AEC requirement in J01. Reference J03 for policy/KDF security meaning and J05 for evidence, while retaining any J01-specific conformance vector needed to define the protocol.

### F-06 — J02 contains duplicate and potentially conflicting backup language

DATA-27 through DATA-33 summarize behavior later specified in BACKUP-02 through BACKUP-15. Most importantly, DATA-27 permits AES-256-GCM “or equally reviewed qualified construction,” while BACKUP-02 fixes `JARVIS_BACKUP_V1` to AES-256-GCM. The summary creates avoidable ambiguity around a fixed format.

**Safe simplification:** make the BACKUP clauses the sole complete owner of the fixed format and replace duplicated DATA summaries with precise references. J01 should own state vocabulary; J02 should own persistence and legal transitions. J03 should own KDF security policy; J02 should apply it by reference.

**Required safeguard:** preserve every byte-level, cryptographic, key separation, generated recovery, restore, failure, and test-vector requirement exactly.

### F-07 — J03 repeats verification and release-profile material

Long test lists in SEC-33, POLICY-15, and SUPPLY-17 overlap J05. SUPPLY-16 repeats release-manifest fields also selected by the Release Profile and verified by J05.

**Safe simplification:** retain complete security behavior and threat controls in J03. Let J05 own how those behaviors are tested and evidenced. Let the Release Profile own exact V1 manifest selections. Use explicit references so no security test disappears.

### F-08 — J04 contains multiple qualification checklists

OPS-30 is a broad qualification list overlapping J05. UI-26 repeats accessibility qualification and UI-28 adds another completion checklist. OPS-26 overlaps release vulnerability policy. Optional examples are often interleaved with normative behavior.

**Safe simplification:** keep operational, integration, provider, voice, UI, accessibility, and exact threshold behavior in J04. Move test/evidence ownership to J05. Mark examples as non-normative or remove them when they add no unique constraint. Rename the heading “Architecture Decision Escalation” to “Architecture Change Escalation” while preserving its clause identity and meaning, avoiding prohibited decision-record terminology.

### F-09 — J05 restates behavior instead of testing it

J05 repeats platform roles, accessibility values, KDF values, provider setup behavior, capability matrices, voice details, branch governance, and release-manifest fields.

**Safe simplification:** describe the verification method, required evidence, negative cases, and pass/fail decision in J05, referencing the exact behavioral owner clauses. Keep all release vetoes, exact-candidate rules, CI authority, platform qualification, and signed-artifact gates.

### F-10 — The Release Profile behaves like another implementation contract

Several profile clauses restate platform, integration, accessibility, provider, and qualification behavior from J01 through J05.

**Safe simplification:** retain exact V1 selections: supported platform, enabled capabilities, providers, integrations, voice modes, hardware assumptions, post-V1 commitments, manifest fields, and `Production Complete` boundary. Reference component behavior and J05 verification instead of reproducing them. Capability matrices should remain the selection source here; J01 defines their types and J05 tests the selected values.

### F-11 — Acceptance commands have multiple manually maintained sources

The canonical LocalCI manifest lists 30 commands. Phase 0 repeats 21 of them exactly. LocalCI and GitHub Actions also manually repeat equivalent commands.

**Safe simplification:** define reusable gate metadata once, including gate ID, command, execution class, authority, and evidence purpose. Generate or directly consume the LocalCI and Phase 0 views. GitHub workflow topology may remain distinct where runners or job isolation require it, but commands should derive from the shared definition where safe.

**Required safeguard:** do not collapse required Windows and general jobs, weaken exact-checkout/toolchain rules, change LocalCI exit code 78 semantics, or promote LocalCI or GitLab to CI authority.

### F-12 — Mechanical repetition obscures meaning

The suite contains 339 redundant adjacent separator patterns, copied boilerplate in all six components, and repeated slogans and invariant summaries.

**Safe simplification:** remove redundant separators and repeated boilerplate, standardize headings and reference syntax, and keep one canonical statement for each invariant. Preserve clause IDs, tables, code blocks, exact values, and references required by validators.

### F-13 — This findings file had become historical audit baggage

The previous version was 693 lines and embedded old candidate identities, a large retired-path inventory, and prior correction narratives. It was also in the universal reading list, making stale non-authoritative history part of routine context.

**Safe simplification applied here:** replace it with the current, persistent findings and measurable baseline. Historical versions remain recoverable through Git history but are not a current authority or required overlay.

### F-14 — `README.md` repeats governance and product guarantees

The README repeats branch, platform, guarantees, and principles already owned by active contracts.

**Safe simplification:** keep repository orientation, links to the manifest and contributor instructions, setup essentials, and basic verification commands. Reference authoritative files for normative meaning.

### F-15 — Version treatment must be explicit

The manifest requires suite-version advancement when current meaning changes and component revision advancement when normative content changes. Even a semantics-preserving rewrite changes normative files, while a mistaken “cleanup” could accidentally change behavior.

**Safe simplification:** create a clause-level preservation map and make an explicit governance decision before editing about the suite and component revisions required by MAN-08. If any meaning changes, follow the synchronous amendment rule. Never silently retain or bump versions.

## Simplification method

For every proposed deletion, merge, or rewrite:

1. Identify the exact source clause and every normative statement it contains.
2. Assign one authoritative destination owner.
3. Classify the change as exact preservation, reference-only deduplication, non-normative example removal, or material semantic change.
4. Preserve stable clause IDs where practical; otherwise provide an old-to-new mapping.
5. Search all references, tests, validators, generated files, and evidence before editing.
6. Update all affected current files synchronously.
7. Prove that no required behavior, threshold, negative case, or evidence gate was lost.
8. Stop for explicit governance authorization if a material meaning change is discovered.

## Expected outcome

A successful pass produces a smaller, navigable, single-owner active suite with fewer duplicated commands and less mandatory reading, while retaining identical or stronger enforceable behavior. Line-count reduction is secondary. The decisive result is lossless traceability plus passing contract, governance, security, schema, architecture, formatting, type, and applicable CI validation.

## Second independent review — 2026-09-16

### Decision

**NOT COMPLETE.** The current tree is materially simpler and the local checks pass, but the remediation goal's hard acceptance criteria are not fully proven. The prior completion statement was too strong.

This decision is limited to contract simplification, optimization, consolidation, and their validation. It does not authorize application implementation, implementation-matrix progression, publication, integration, release qualification, or auditor handoff.

### G-01 — Canonical state/type catalogs still have multiple normative owners

The J01 provider-state duplication between J01-RT-14 and J01-PROTO-19 was reduced, but the audit stopped too early. The active suite still repeats canonical vocabularies across components:

- J01-PROTO-13 defines mission, task, and attempt state types while J02-DATA-09 through J02-DATA-11 repeat their canonical state lists;
- J01-PROTO-11 defines `ExecutionScope` while J02-DATA-12 repeats its four values;
- J01-PROTO-18 defines approval states while J02-DATA-14 repeats the list;
- J01-PROTO-19 defines provider setup states while J02-DATA-22 repeats the full list;
- J01-PROTO-22 defines budget-reservation states while J02-DATA-24 repeats the list;
- J02-DATA-25 and J04-OPS-15 repeat the same six module support/installation/authorization/health states;
- J01-PROTO-24 defines notification severity while J04-OPS-10 repeats the severity catalog.

Some repetition may be necessary to state legal transitions or UI behavior, but a second standalone canonical list is not. J01 should own cross-boundary type vocabularies; J02 should own persistence, legal transitions, and atomicity by exact reference; J04 should own presentation and operational behavior by exact reference. The module-state catalog needs one explicitly selected owner before either copy is removed.

The current test named `provider state vocabulary has one J01 protocol owner` checks only J01-RT-14 and J01-PROTO-19. It does not inspect J02-DATA-22 and therefore gives incomplete single-owner assurance.

### G-02 — RP-17 cites a normative preflight owner that no longer contains the requirement

RP-17 says J00-GOV-28 and J05-VER-33 own "preflight." The earlier RP-17 text required an ordered local fail-fast preflight before authorized candidate publication. The current J00-GOV-28 and J05-VER-33 retain exact-candidate and CI-authority rules but do not contain that local preflight sequence. Only non-normative contributor guidance in `AGENTS.md` retains it.

This is an unresolved semantic deletion and a false owner reference. The requirement must be restored once in an active normative owner, with RP-17 referring to that exact clause.

### G-03 — Acceptance-command consolidation is not yet fail-closed end to end

The shared 30-gate metadata is useful, but three enforcement gaps remain:

1. `requiredWorkflowSteps(profile)` derives requirements from whatever IDs the Phase 0 JSON currently contains. Removing a required ID from the profile shrinks the required set instead of failing against a separately controlled canonical Phase 0 ID sequence. Unknown IDs fail, but omission from the profile itself is not independently rejected.
2. `.localci/ci.sh` uses `source <(node tools/ci/render-localci-gates.mjs)`. Process-substitution producer failure is not proven to propagate as a Bash failure before any gates run. No supported local Bash runtime was available for an execution proof during this review. The validator only searches for the source text, so a commented or unreachable occurrence can satisfy that check.
3. The GitHub exception exists only as prose in the ledger. Five manifest commands are not exact text matches in `.github/workflows/static-ci.yml` because of shell, working-directory, or evidence-output differences. The metadata and validators do not model and test those consumer-specific variants or a precise technical exception. Therefore one controlled semantic source across LocalCI, Phase 0, and GitHub is not yet demonstrated.

The LocalCI validator also no longer proves that the rendered 30-gate sequence executes before terminal evidence; it proves only that a matching source line exists and that known gates are not inline.

### G-04 — Preservation evidence is too coarse and contains unsupported closure claims

The remediation goal requires every changed normative sentence to have source text, exact preserved requirement/value, change class, complete owner, references, tests, semantic result, and final status. The ledger mostly maps broad clause ranges and labels them closed using generic "contract checks" or "final-text comparison." That is not clause-level proof for the large normative deletion set.

The ledger also says separator lines were reduced from 697 to 358. A current direct count across J00–J05 is 362, so the recorded result and method are not reproducible as written. The findings baseline's 339 value measures redundant separators, not total separator lines; these metrics must not be conflated.

Because G-01 through G-03 remain open, the ledger statement that it has no open remediation entries and this findings file's previous completion conclusion were false.

### G-05 — MAN-08 version treatment changed governance meaning without durable proof

The prior MAN-08 rule said component revisions advance when normative content changes. The current edit says revisions advance only when normative meaning changes and creates a no-bump exception for lossless restructuring supported by a ledger.

That is a normative version-policy change, not merely formatting. The ledger calls it an owner-authorized clarification but contains no durable evidence of the exact authorization or its scope. The closure pass must either restore the prior rule and apply its revision consequences, or obtain explicit governance authorization for the new policy and process it as a material amendment. It must not use the changed rule to justify itself.

### G-06 — Protected-test scope is not truthfully resolved

The remediation goal says application behavior tests remain unchanged except an authorized validator read-only dependency, while a hard criterion later says application behavior tests are unchanged without repeating the exception. `tests/layers/unit/desktop-production-tauri-build.test.mjs` changed to consume derived Phase 0 metadata. Its assertions were not intentionally weakened, but the file is not byte-for-byte unchanged.

The next goal must resolve this contradiction explicitly: classify the exact edit as a validator-consumer adaptation and prove unchanged application behavior coverage, or restore the file and provide the compatibility boundary elsewhere. It may not simply report that application behavior tests were unchanged.

### G-07 — Required closure reporting was not delivered

The previous goal required a detailed final report containing repository identity, file-by-file changes, ownership transfers, independent discoveries, ledger state, measured duplicate counts, full validation, protected-path confirmation, ADR confirmation, and authoritative GitHub evidence state. The completion response did not provide that report. Passing checks do not satisfy a missing required deliverable.

### Evidence that does pass

- Active clause IDs are unique and all detected direct clause references resolve.
- No tracked ADR, decision-record, or historical-overlay path is active authority.
- The implementation matrix and application source have no tracked diff.
- Contract generation, manifest, and drift checks pass.
- The normal local test profile passes 22 files.
- Governance and formatting checks pass, and `git diff --check` reports no whitespace error.
- GitHub Actions remains the stated mandatory CI authority; GitLab remains mirror-only and LocalCI remains non-authoritative.

These results are necessary but do not close G-01 through G-07.

## Current conclusion

The agreement is **not yet fully implemented**, and the existing remediation goal was **not fully completed**. The correct terminal state is `NEXT PASS`, not `COMPLETE`. A new bounded closure goal must address every gap above and repeat an independent final-tree audit until no open, unknown, contradicted, or unproven criterion remains.

## Current verification boundary

The normal local profile passes. The qualification profile currently stops before execution because required implementation-oriented layers have no tests: provider setup, tools, integrations, UI/accessibility, recovery, persistence/backup/migration, performance, voice, and packaging/update/release. This contract-only goal does not authorize adding application behavior or qualification coverage to resolve that repository-wide implementation gap. The absence of qualification-profile evidence therefore remains explicit and cannot be represented as release qualification.

## Final-closure remediation outcome — 2026-09-16

The conclusion above records the independent review at the time it was made and is retained rather than rewritten. The bounded final-closure pass subsequently resolved its seven findings:

- G-01: J01 now owns the cross-boundary protocol vocabularies, J02 retains persistence/transitions/atomicity, and J04 owns module lifecycle/support and presentation behavior. Negative drift tests reject relisting.
- G-02: J00-GOV-28 now owns the ordered local pre-publication preflight; RP-17 references that owner and J05-VER-33 owns qualification evidence.
- G-03: the Phase 0 subset is canonical and fail-closed; LocalCI renders through a checked temporary file; GitHub command variants are explicit controlled metadata; native Git Bash proves renderer failure exits 78 before sourcing.
- G-04: the preservation ledger now includes an exact changed-clause index and corrected reproducible separator accounting.
- G-05: the prior MAN-08 content-change revision rule is restored. J00–J05 and the Release Profile advance to revision 1.0.9 while the unchanged product-rule suite remains 1.0.8.
- G-06: the desktop test change is explicitly classified as a read-only validator-consumer adaptation; its two application assertions and mutation coverage remain unchanged and pass.
- G-07: the required persistent closure report is `docs/implementation/JARVIS-CONTRACT-SIMPLIFICATION-FINAL-CLOSURE-REPORT.md`.

The final hostile audit found 385 unique clause IDs and zero duplicates, no tracked prohibited ADR/decision/history path, no application-source or implementation-plan/matrix edit, and no remaining open ledger item. The normal profile passes 22 files, and all required local contract, schema, governance, security, dependency, provenance, architecture, format, type, build, and Phase 0 checks pass. This changes the bounded contract-simplification conclusion to `COMPLETE`; it does not create exact-candidate GitHub Actions evidence or authorize publication, integration, implementation, matrix advancement, release qualification, or `Production Complete`.
