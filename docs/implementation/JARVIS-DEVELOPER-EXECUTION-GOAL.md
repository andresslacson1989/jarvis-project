Goal: Complete the JARVIS implementation matrix in strict order, using the matrix as the execution plan and the active contract suite as the governing authority.

The matrix determines the current subsection, implementation order, status progression, dependencies, evidence requirements, and next eligible work. The auditor’s recommendations provide review guidance only and must always be checked against the matrix, AGENTS.md, and all active normative contracts. If they conflict, stop and follow the contract-governed resolution process.

For each subsection:

1. Re-read AGENTS.md, the active manifest, applicable contracts, release profile, implementation plan, matrix, and execution protocol.
2. Confirm the current matrix pointer, subsection status, dependencies, scope, acceptance criteria, scores, weakest gap, and required evidence.
3. If any requirement or instruction is unclear, stop and ask the auditor or main thread. Do not guess.
4. Implement only the current matrix subsection. Do not begin, pre-stage, or modify later subsections.
5. Make only changes required by the matrix and active contracts. Preserve unrelated work, user changes, generated artifacts, and existing invariants.
6. Add or update all applicable positive, negative, adversarial, failure, recovery, security, and platform-specific tests.
7. Run the required local verification and distinguish clearly between local evidence, authoritative CI, live platform evidence, and independent audit evidence.
8. Double-check the implementation, changed files, tests, contracts, matrix status, evidence, and repository state before reporting completion.
9. Record the exact candidate SHA, changed files, verification results, limitations, scores, evidence references, and remaining gaps.
10. Send a complete redacted report to auditor thread `codex://threads/01a066d6-1a98-7260-8ce3-d8e8c2c07968`.
11. Explicitly request a highly detailed review or next-step plan containing sections, checkpoints, acceptance criteria, dependencies, required evidence, and file-by-file instructions.
12. Stop and wait for the auditor’s response. Do not continue implementation, integrate changes, or advance the matrix while approval or clarification is pending.
13. Apply auditor feedback only when it is aligned with the active contracts and matrix. If feedback conflicts with them, stop and resolve the conflict before editing.
14. When the subsection is approved, perform the required integration and post-integration verification exactly as defined by the matrix, AGENTS.md, and active contracts.
15. Update the matrix truthfully only after its required gates pass. Do not mark a subsection VERIFIED from self-review, historical evidence, skipped gates, synthetic results, or incomplete CI.
16. After a subsection and its section checkpoint are formally complete, proceed to the next matrix subsection and repeat the same loop.
17. Continue until every required matrix section and checkpoint is complete and all active contract requirements are satisfied. Do not declare Production Complete until the Release Profile and all mandatory qualification gates pass for the exact required release artifacts.

Operating rules:

- Do not overcomplicate simple tasks.
- Do not make assumptions when anything is unclear.
- Do not make random, speculative, or unrelated changes.
- Do not weaken, reinterpret, or bypass the matrix or active contracts.
- Do not treat auditor guidance as authority above the contracts.
- Do not treat local tests as equivalent to authoritative CI or live qualification.
- Re-fetch and revalidate repository state before writes and integration when required.
- Preserve `master` as the sole authoritative branch.
- Use temporary implementation branches and only permitted non-force integration.
- Keep LocalCI unselected or unqualified unless its complete contract-defined qualification is separately proven.
- Always double-check the work before shipping or stating that it is finished.
- Maintain truthful statuses, evidence, scores, limitations, and continuation summaries throughout the process. Explicitly use GitHub Actions for CI/CD, with GitLab as a mirror only.
