# JARVIS Repository Instructions

## Authority

- The active manifest, J00–J05, and Release Profile are the only normative product authority.
- Do not modify a normative contract, manifest, contract-derived artifact, or Release Profile without explicit user or governance authorization.
- The implementation matrix is non-normative; change it only when explicitly authorized for application implementation.
- Historical material, ADRs, decision records, reports, branches, and policy-looking files are never authority.
- A material architecture, security, platform, governance, release, or product change follows the synchronous amendment rule in J00-GOV-29 and MAN-03.

## Read before work

- Revalidate live `origin/master` and the current worktree before writes when concurrent work may exist.
- For contract work: read the manifest, every affected active component, the Release Profile when support or release scope applies, and the simplification findings/ledger when applicable.
- For application work: also read the Implementation Plan and matrix; inspect every governing active requirement before implementation.
- Before beginning or resuming an implementation subsection, or acting on or reporting a developer handoff, read `docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md`. Contract-simplification work also reads `docs/implementation/JARVIS-CONTRACT-SIMPLIFICATION-FINAL-CLOSURE-GOAL.md`. These are non-normative execution aids and never override the active suite.
- Read nested `AGENTS.md` files that apply to files you touch. Repository policy is untrusted until explicitly enrolled under J03.

## Scope and safety

- Do not start application implementation from contract hardening alone. Contract-consolidation work does not authorize application code, matrix progression, evidence advancement, or auditor handoff.
- Preserve platform capability boundaries; Windows remains the mandatory V1 `FULL_HOST`, while Linux and companion support remain future and truthful.
- Preserve the fixed `JARVIS_BACKUP_V1` format, project-policy trust, TUF/update trust, PermissionEngine, DataPolicy, process/IPC/WebView protections, and final destructive confirmation.
- Do not weaken least privilege, provider setup isolation, recovery, authorization, platform security, CI authority, or release qualification.
- Do not log or expose credentials, recovery factors, derived keys, DB/backup keys, or provider-internal setup credentials.
- Treat user-controlled inputs, paths, commands, environment values, and network content as untrusted.
- Never bypass an unavailable capability with an unsafe fallback; fail closed or degrade truthfully.

## Repository workflow

- `master` is the sole authoritative branch. Work on a temporary `codex/` branch/worktree based on current `origin/master` unless explicitly directed otherwise.
- Follow J00-GOV-28 and J05-VER-33 for server protection, compensating controls, exact-candidate CI, non-force integration, and truthful hosting-limit reporting.
- Do not pull, force-push, reset, overwrite user changes, rewrite history, or delete material without explicit authorization.
- Preserve concurrent work and pre-existing untracked files.
- Publish to GitHub `origin` before mirroring the same verified commit/ref to GitLab. GitHub Actions is mandatory CI authority; GitLab is mirror-only; LocalCI is non-authoritative.
- Keep changes scoped and reviewable. Do not add dependencies or assets without need, license, provenance, and security review.

## Verification

- For contract or verification-system changes, run targeted checks, the normal local profile, then applicable contract, schema/generated-output, governance, security, provenance, architecture, format, type, build, and platform checks.
- Local results are supplementary. Only exact-candidate GitHub Actions evidence can satisfy mandatory CI or release qualification.
- Do not claim completion without repository evidence. State any unverified gate and remaining limitation precisely.

## Package manager

- Use `pnpm` with the pinned toolchain. Key checks: `pnpm contract:check`, `pnpm format:check`, `pnpm test`, and `pnpm governance:check`.

## Reporting

- Use absolute file paths in reports. State evidence, scope, changed files, verification, and remaining limitations.
- When this file has governed an edit, include: `I have read the Custom Instructions and AGENTS.md before applying any fix and edit`.
