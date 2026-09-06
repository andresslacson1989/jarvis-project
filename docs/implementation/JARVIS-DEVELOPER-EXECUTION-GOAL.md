# JARVIS Developer Execution Goal

## Document role and authority

This is the owner-supplied, non-normative execution guidance and detailed execution goal for completing the JARVIS implementation matrix. It does not replace, amend, weaken, or reinterpret the active v1.0.7 contract suite, its manifest, the Release Profile, the Verification/Release Contract, `AGENTS.md`, or the active architecture-amendment rules. If this goal and a current normative contract conflict, stop dependent work, report the conflict to the main thread, and resolve it through the contract-governed process before implementation continues.

The implementation matrix is the execution plan and status board. Auditor recommendations are review input and approval decisions; they do not replace the matrix, change subsection order, or authorize work outside the active contract. The matrix may never waive a normative requirement.

## Current authority decision

The owner’s current authority decision supersedes the stale local v1.0.5 instructions and the earlier GitLab-CI request:

- GitHub `origin/master` is the authoritative repository branch and source-of-truth ref.
- The JARVIS v1.0.7 contract suite is the active normative suite.
- GitHub Actions is the sole selected and authoritative CI authority for this lifecycle, including qualification and approval evidence.
- GitLab is mirror-only. It is not a CI authority and must not satisfy a mandatory CI gate.
- LocalCI is unselected and unqualified for this lifecycle and must not be used as a substitute for GitHub Actions unless a later owner/governance decision explicitly selects and qualifies it under the v1.0.7 rules.
- GitHub publication precedes any GitLab mirror publication. Mirroring never creates authority or permits a different source of truth.

This decision must remain consistent across `AGENTS.md`, `README.md`, the machine-readable governance profile, the implementation matrix, evidence records, and auditor reports. No documentation may promote GitLab or an unqualified LocalCI instance into an authoritative role.

## Mandatory subsection loop

Repeat the following seventeen steps for every matrix subsection until the complete contract-controlled matrix is finished. Do not skip a step because the change appears small, because a local test is green, or because an auditor recommendation appears convenient.

1. **Establish the current authority.** Re-fetch live `origin/master`; verify its exact SHA, the current branch, candidate ancestry, selected CI authority, and the active v1.0.7 suite before repository writes. Never pull, force-move, rewrite, or silently substitute an authoritative ref.
2. **Read the governing material.** Re-read `AGENTS.md`, `README.md`, the active manifest, every applicable normative contract, the Release Profile, the Implementation Plan, the live matrix, and `docs/agent-instructions/implementation-execution-protocol.md` before starting or resuming implementation.
3. **Confirm the matrix pointer.** Identify the one and only eligible `IN PROGRESS`/`VERIFYING` subsection, its dependencies, its section checkpoint, its current status, its current score, its weakest gap, and the exact evidence record. Do not start, pre-stage, or accumulate work for a later subsection.
4. **Define the contract packet.** Record the subsection `GOAL`, governing contract references, dependencies and preconditions, required implementation outputs, hard acceptance criteria, required positive/negative/adversarial/failure/recovery/platform tests, atomicity model, idempotency/retry-safety model, current scores, and weakest legitimate gap.
5. **Check scope and file ownership.** Produce a file-by-file change boundary from the packet. Confirm which files may change, which generated artifacts must be preserved, and which contract-controlled files are immutable without explicit governance authorization. If a required file or authority boundary is unclear, stop and ask the main thread rather than guessing.
6. **Request an auditor plan before implementation.** Send the packet and the proposed bounded file list to auditor task `codex://threads/01a066d6-1a98-7260-8ce3-d8e8c2c07968`. Explicitly request a highly detailed planned goal with sections, checkpoints, acceptance criteria, and file-by-file instructions, and ask the auditor to identify contract conflicts before any implementation begins.
7. **Wait for the auditor response.** Do not begin or continue subsection implementation until the auditor has responded. A historical report, self-review, green local test, skipped gate, synthetic merge, or silent timeout is not approval. If the auditor needs owner or product judgment, ask the main thread directly.
8. **Execute only the approved bounded pass.** Use the matrix as the implementation plan and the auditor response as review guidance. Implement only the current subsection, only the authorized files, and only the contract-consistent behavior. Do not overcomplicate simple tasks, introduce random refactors, add unrelated architecture, or make a shortcut that excuses a requirement.
9. **Apply enterprise engineering practice.** Preserve typed boundaries, least privilege, fail-closed behavior, deterministic errors, lifecycle ownership, cancellation, timeout, cleanup, restart/recovery behavior, stale-state rejection, secret protection, structured diagnostics, pinned/reproducible dependencies, and maintainable architecture. Do not claim an unqualified platform, provider, CI authority, or release capability.
10. **Add complete verification.** Add or extend positive, negative, adversarial, failure, recovery, concurrency, interruption, stale-state, cancellation, resource-pressure, and platform-specific tests wherever applicable. Verify atomicity, idempotency, duplicate/replay handling, conflict handling, and uncertainty recovery for every consequential or retryable path. Do not treat mocks or local tests as equivalent to required live platform or CI evidence.
11. **Run the local profile.** Run the smallest targeted checks first, then the applicable full local profile: formatting, strict types/builds, architecture/import checks, unit/property/schema/security tests, contract/generated/manifest/drift checks, native/platform checks, and required release or dependency checks. Diagnose and fix failures; ordinary failures are not blockers.
12. **Score the subsection harshly.** Evaluate Contract Accuracy at exactly 10/10 or fail the pass. Evaluate every other applicable baseline and subsection-specific criterion against its required threshold, including production readiness, production practices, enterprise hardening, atomicity, idempotency/retry safety, failure/recovery, security/least privilege, observability, verification quality, and maintainability. Identify the single weakest legitimate score or hard gate.
13. **Record evidence and status.** Update the matrix and evidence with the exact implementation candidate SHA, separate documentation/evidence revision, changed files, tests and live results, scores, limitations, selected authority, known blockers, and next gate. Use only truthful statuses: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFYING`, or `VERIFIED` as defined by the active protocol.
14. **Double-check before reporting.** Re-fetch or inspect the relevant refs as required; verify the exact diff, candidate ancestry, generated-artifact preservation, evidence identity, matrix pointer, status, score, test output, and postconditions. Never report completion from intention, partial output, historical evidence, or an unverified external result.
15. **Report to the auditor.** Send the complete bounded-pass report to task `codex://threads/01a066d6-1a98-7260-8ce3-d8e8c2c07968`, including the contract packet, exact files, candidate/evidence identities, local and authoritative CI evidence, failures/recovery evidence, limitations, scores, and remaining gates. Explicitly ask for `APPROVED` or `NEXT PASS` and for a highly detailed next-step plan if any gap remains.
16. **Loop on the auditor decision.** Wait for the response. On `NEXT PASS`, fix only the weakest legitimate gap first, re-run the affected and full verification, update evidence, and repeat the report/wait loop. On `APPROVED`, do not infer integration approval: continue through every mandatory exact-authority, integration, and post-integration gate. If several gaps tie, prioritize contract correctness, authorization/security/data loss/recovery, state/atomicity/idempotency, production reliability, verification/observability, then maintainability/polish.
17. **Close the subsection and checkpoint the section.** A subsection becomes `VERIFIED` only after all hard criteria, required evidence, scores, exact CI, independent audit approval, and applicable integration gates pass. After all required subsections in a section are verified, run the section integration/checkpoint gate for architecture, state, security, failure/recovery, and release evidence. Only then advance the matrix pointer to the next subsection. For the current lifecycle, keep Section 1.4 `VERIFYING` and Section 1.5 `NOT STARTED` until the exact Section 1.4 lifecycle is complete.

## Authority, integration, and LocalCI rules

GitHub Actions is the sole selected authority for the current candidate. The exact implementation SHA must receive a complete passing GitHub Actions run with the pinned toolchain and all mandatory Windows/static gates. LocalCI remains governed by the v1.0.7 qualification rules but is not selected or authoritative for this lifecycle; a demo, stale, unknown, or materially changed LocalCI instance cannot substitute for GitHub Actions. GitLab remains mirror-only and cannot satisfy a mandatory CI gate.

Before any permitted integration, obtain independent auditor approval for the exact implementation candidate and evidence, re-fetch `origin/master` immediately before integration, use only the permitted non-force operation, verify the resulting authoritative `master` SHA and intended diff, and run/verify the post-integration authoritative CI. Never use a synthetic merge, force push, mutable tag, stale candidate, or skipped gate as a substitute.

## Checkpoint continuation summary

At every subsection, section, and release checkpoint, record exactly these categories in the continuation summary:

1. **Original goal** — the overall contract-governed implementation objective.
2. **Completed / found** — what is actually implemented or verified, including important discoveries.
3. **Key decisions** — contract-consistent decisions made within the authorized scope; do not record hidden reasoning.
4. **Remaining** — the exact matrix position, open gates, blockers, limitations, and next subsection/checkpoint target.

Re-fetch live `origin/master`, re-read `AGENTS.md`, and revalidate the active manifest before new repository writes after any checkpoint or context handoff. Preserve unrelated user work and generated artifacts, including `apps/desktop/src-tauri/gen/` and `apps/desktop/src-tauri/resources/`.

## Completion boundary

Do not claim `Production Complete` from an intermediate subsection, high scores, green local tests, documentation completion, an unqualified/mirror CI result, or an auditor recommendation alone. `Production Complete` is available only after the exact source commit and exact signed Windows `FULL_HOST` release artifacts pass every mandatory active-contract qualification gate, including release/profile/security/recovery/provider/integration/UI/voice/update/soak/provenance evidence.

Double-check all work before shipping or saying it is finished. If the matrix, contract, authority, required file, or evidence is unclear, do not assume: stop and ask the main thread.
