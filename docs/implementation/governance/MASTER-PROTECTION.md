# Authoritative `master` Repository Governance

**Contract suite:** JARVIS v1.0.8
**Governing clauses:** J00-GOV-28; J05-VER-33
**Authoritative branch:** `master`  
**Mandatory CI pipeline:** `static-ci`
**Selected CI authority:** `GITHUB_ACTIONS` (capability baseline; exact v1.0.8 candidate run not recorded)

This document is an operational implementation aid for the repository-governance requirements in J00-GOV-28, J05-VER-33, and Implementation Plan Phase 0. It is not a substitute for those normative requirements.

## Current effective mode

The current repository governance mode is:

```text
SERVER_ENFORCED
```

The live authenticated GitHub observation records a public repository with active server-side protection on the authoritative `master` branch. The current protection requires the strict `static-ci` status check, one approving pull-request review, administrator enforcement, force pushes are blocked, branch deletions are blocked, and required conversation resolution. The current observation identity is:

```text
source: AUTHENTICATED_GITHUB_API
observedAt: 2026-09-15T01:49:15Z
repository: andresslacson1989/jarvis-project
repositoryId: 1330469646
ref: refs/heads/master
evidenceIdentity: github-api:repo-1330469646:refs/heads/master:protection:static-ci:app-15368
```

The checked-in profile is:

`docs/implementation/governance/repository-governance-profile.json`

Its current residual-risk value is:


```text
SERVER_ENFORCED_PROTECTION_ACTIVE
```

The current v1.0.8 candidate has no exact GitHub Actions run recorded under its immutable candidate SHA. `EXACT_GITHUB_ACTIONS_RUN_NOT_RECORDED` remains the truthful candidate-evidence state; this operational profile does not promote local checks or historical runs into current CI qualification.

GitHub Actions remains the sole CI authority. GitLab is repository mirror-only and LocalCI is non-authoritative compatibility/security tooling. Local preflight is required before publication or candidate qualification, but ordinary local execution is not GitHub authority.

## Safe integration procedure

The normal algorithm is:

```text
fetch live master M0
→ verify candidate C is based on/reconciled with M0
→ run the required local preflight
→ publish only when publication is authorized
→ require qualified-authority static-ci success for exact C
→ fetch live master again as M1
→ if M1 != M0: abort/reconcile/reverify
→ integrate C using the reviewed non-force path
→ fetch resulting master M2
→ verify intended ancestry/diff and no unrelated overwrite
→ verify required CI/audit evidence for the resulting authoritative state
→ record evidence
```

A stale or moved `master` is a safe retry/reconciliation event, not permission to force-update the branch. A successful historical run cannot qualify a materially changed candidate.

## Idempotency and retry behavior

Governance checks are read-only and repeatable. Re-running them against the same profile/workflow produces the same result.

An integration retry must start again from a freshly observed authoritative tip. An ambiguous or failed ref update must be reconciled from live GitHub state before another mutation is attempted.

## Historical transition — non-current

The former checked-in profile recorded `COMPENSATING_CONTROLS` while the repository was private and GitHub server-side protection was unavailable under the then-observed hosting limitation. That mode, its HTTP `403` observation, compensating controls, and residual risk are retained only as historical transition data and historical evidence. They are not current governance facts and do not qualify the current v1.0.8 candidate.

The historical records retain the prior controls and evidence, including temporary implementation branches, exact candidate CI, live-tip revalidation, non-force integration, post-integration verification, and the former residual risk `OUT_OF_BAND_ADMIN_FORCE_PUSH_OR_DELETION_NOT_SERVER_BLOCKED`. The historical GitHub Actions run `33934840029` for candidate `052902bfc52e676910d287e13fbf8a026915efe0` remains capability-baseline evidence for the earlier suite only.

## Historical exception boundaries — non-current

The former v1.0.8 fallback record did not permit:

- claiming `master` is protected when GitHub reports it is not;
- disabling an available server-side protection feature to remain in fallback mode;
- weakening or skipping `static-ci`;
- force-push implementation workflow;
- broad/permanent bypass actors;
- silently integrating over a moved authoritative tip;
- treating local process conventions as equivalent technical branch protection;
- making the repository public merely to satisfy this governance gate;
- making a paid GitHub plan a hidden JARVIS product prerequisite.

## Verification commands / evidence surfaces

Repository-side verification includes:

```text
pnpm governance:check
pnpm contract:check
pnpm test
```

The authoritative CI pipeline identity remains exactly:

```text
static-ci
```

GitHub Actions is the sole selected CI authority. GitLab is repository mirror-only and LocalCI is non-authoritative compatibility/security tooling. The historical profile records the immutable `static-ci` workflow/job and historical GitHub Actions run `33934840029` for candidate `052902bfc52e676910d287e13fbf8a026915efe0`; that historical run does not qualify a later v1.0.8 consolidation commit. The Windows Tauri job `101220622635` and static job `101222623099` both completed successfully. The pull-request merge ref is metadata context only: checkout logs show the explicit candidate SHA was fetched and checked out, and the independent `git rev-parse HEAD` check matched it exactly. The generated Phase 0 evidence was `status=PASS` and included the complete named gate set. The earlier failed run `33818720345` remains historical negative evidence only.

The documentation-only reconciliation revision `1f99f53c10ce0d406429f9888c763e27359260ee` is also retained as negative evidence: run `33936789279` failed in the static job `101228227719` with `PHASE0_CANDIDATE_MISMATCH`. Its cause was a machine-bound `implementationCandidateSha`/matrix binding added to documentation while CI supplied the current revision through `JARVIS_CANDIDATE_SHA`; no implementation bytes were changed. The corrective documentation revision `a077dfdacd80f7ef5ef48d64f5cc61cec4fae70d` removed that self-referential binding and passed consistency run `33938490684` (Windows `101231030877`, static `101232608613`).

The earlier permitted non-force integration advanced `master` to
`cae911e2bb88e046ae84828bc98a5b484da401d1`; run `33944300852` (Windows
`101247490538`, static `101249233556`) remains historical and superseded.
The current documentation/evidence revision advanced `master` non-force to
`2cfcca9f2f7ee0faf334223b659e94ab410f5acd`. Immediate re-fetch confirmed the
authoritative tip. Current post-integration run `33950976184` passed on exact
`refs/heads/master` with Windows job `101265550867` and static job
`101267451179`, completing at `2026-09-05T07:24:22Z`. It published no artifacts
(`artifact_count=0`);
offline Cosign/transparency-log verification is not claimed.

LocalCI compatibility/security tooling may retain its own bounded operational controls, but its results are not CI or release evidence and are not consulted to qualify the active suite.

Future Phase-0 evidence SHALL record the observed live `master` protection state, exact candidate/source commit, exact CI run when candidate qualification is authorized, selected governance mode, residual risk, and the post-integration verification result when authoritative integration occurs. The former hosting-limitation evidence belongs only to the historical transition record above.
