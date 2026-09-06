# JARVIS Developer Execution Goal

## Document role

This is owner-supplied, non-normative execution guidance for the implementation loop. The active v1.0.7 contract suite, its manifest, the Release Profile, and the Verification/Release Contract remain the only normative authority. If this goal ever conflicts with them, stop dependent work and resolve the conflict through the repository’s governance and architecture-amendment rules.

## Current authority decision

The owner’s current authority decision is explicit and supersedes stale local instructions or earlier GitLab-CI requests:

- GitHub `origin/master` is the authoritative repository branch and source-of-truth ref.
- The JARVIS v1.0.7 contract suite is the active normative suite.
- GitHub Actions is the selected and primary CI authority for this lifecycle.
- GitLab is mirror-only. It is not a CI authority and must not be used to satisfy a mandatory CI gate.
- LocalCI remains an eligible alternative authority only under the v1.0.7 qualification rules; it is unselected and unqualified for this lifecycle unless a later owner/governance decision explicitly selects and qualifies it.
- GitHub publication precedes any GitLab mirror publication. Mirroring does not create authority or permit a different source of truth.

This authority decision must remain consistent across `AGENTS.md`, `README.md`, the machine-readable governance profile, the implementation matrix, evidence records, and the exact CI/audit reports. Documentation must not promote GitLab or an unqualified LocalCI instance into an authoritative role.

## Implementation loop

Use `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md` as the single execution/status board. The matrix is non-normative: it orders the work and records status, gaps, scores, evidence, and checkpoints, but cannot waive or reinterpret a contract requirement.

Work on exactly one eligible subsection at a time:

1. Re-fetch live `origin/master` and verify the current branch, candidate ancestry, and active v1.0.7 authority before repository writes.
2. Read `AGENTS.md`, `README.md`, the active manifest, all applicable normative contracts, the Release Profile, the Implementation Plan, this goal, the live matrix, and the contract execution protocol.
3. Define the subsection contract packet: goal, governing references, dependencies, required outputs, hard acceptance criteria, required positive/negative/adversarial/failure/recovery/platform tests, atomicity, idempotency/retry safety, current scores, and weakest gap.
4. Implement only the current subsection and only the files required by its contract packet. Do not pre-stage the next subsection, make random changes, or use a shortcut to excuse a contract requirement.
5. Run targeted verification, then the applicable full local profile. Local tests are supporting evidence and are never represented as equivalent to GitHub Actions.
6. Record the exact implementation candidate SHA, separate documentation/evidence revision, changed files, test results, limitations, scores, and remaining mandatory gates in the evidence record and matrix.
7. Stop at the subsection boundary and send the complete report to the independent auditor. Explicitly request an APPROVED or NEXT PASS decision with exact remaining blockers.
8. Wait for the auditor’s response. A historical report, self-review, green local tests, skipped CI, synthetic merge, or stale candidate does not constitute approval.
9. If the auditor returns NEXT PASS, fix only the weakest legitimate gap first, reverify, update evidence, and repeat the report/wait loop. If the auditor returns APPROVED, continue only with the mandatory exact-authority and integration gates.

## Integration and advancement gates

For the current Section 1.4 candidate, keep the status `VERIFYING` and keep Section 1.5 `NOT STARTED`. Do not integrate until all of the following are complete:

- the exact candidate SHA has a complete passing GitHub Actions run with the pinned toolchain and all mandatory Windows/static gates;
- the independent auditor approves that exact candidate and evidence revision;
- `origin/master` is re-fetched immediately before integration and has not moved unexpectedly;
- integration uses only the permitted non-force operation;
- the resulting authoritative `master` SHA, intended diff, and post-integration GitHub Actions verification are recorded and pass;
- only after those gates pass may Section 1.4 become `VERIFIED` and the next eligible subsection begin.

Never claim `Production Complete` from an intermediate subsection, local verification, documentation completion, or an unqualified/mirror CI result.

## Working rules

- Do not guess when authority, contract meaning, an endpoint, a field, a platform result, or a required file is unclear; stop and ask the governing thread.
- Do not overcomplicate simple tasks; use the smallest contract-consistent change.
- Preserve unrelated user work and generated artifacts, including `apps/desktop/src-tauri/gen/` and `apps/desktop/src-tauri/resources/`.
- Add or update tests for every changed behavior, including negative, adversarial, failure, recovery, and platform-specific behavior where applicable.
- Double-check the exact diff, candidate ancestry, evidence identity, status, and postconditions before committing or reporting completion.
