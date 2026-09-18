# Authoritative `master` Repository Governance

**Contract suite:** JARVIS v1.0.8
**Governing clauses:** J00-GOV-28; J05-VER-33
**Authoritative branch:** `master`  
**Mandatory CI pipeline:** `static-ci`
**Selected CI authority:** `GITHUB_ACTIONS` (historical capability baseline plus a latest-completed-predecessor evidence record; successor qualification remains external)

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

## Latest recorded exact-candidate predecessor evidence

The profile records the latest completed predecessor in status `RECORDED` with role `LATEST_COMPLETED_PREDECESSOR` and `doesNotQualifySuccessor=true`. The immutable evidence is:

```text
contractSuiteVersion=1.0.8
status=RECORDED
recordedCandidateRole=LATEST_COMPLETED_PREDECESSOR
doesNotQualifySuccessor=true
candidateSha=d447b89c7506281567f5ee2f8771fba91a8bdf1f
repository=andresslacson1989/jarvis-project
ref=refs/heads/codex/contract-consolidation
workflow=.github/workflows/static-ci.yml
job=static-ci
runId=35184074308
runAttempt=1
event=pull_request
headBranch=codex/contract-consolidation
startedAt=2026-09-17T05:00:49Z
finishedAt=2026-09-17T05:16:36Z
recordedAt=2026-09-17T06:24:08Z
terminalResult=SUCCESS
requiredChecksPassed=true
windows-tauri-build jobId=105082244361 startedAt=2026-09-17T05:00:52Z finishedAt=2026-09-17T05:08:41Z terminalResult=SUCCESS
static-ci jobId=105083793438 startedAt=2026-09-17T05:08:44Z finishedAt=2026-09-17T05:16:35Z terminalResult=SUCCESS
jarvis-section-1-4-tauri-single-instance-evidence artifactId=10481224055 digest=sha256:3bd623d2e9e932cfc233ce20f08a7ad92ab728d809171d9d264a747218c7e885
jarvis-section-1-4-windows-native-evidence artifactId=10481019827 digest=sha256:b770658c5ab2e2964d46d5ff997bd59512e599894542e982a306c4d3e59424d4
evidenceIdentity=github-actions:repository=andresslacson1989/jarvis-project:ref=refs/heads/codex/contract-consolidation:workflow=.github/workflows/static-ci.yml:job=static-ci:runId=35184074308:runAttempt=1:sha=d447b89c7506281567f5ee2f8771fba91a8bdf1f:windowsJobId=105082244361:staticCiJobId=105083793438
artifactEvidenceIdentity=github-actions-artifacts:repository=andresslacson1989/jarvis-project:ref=refs/heads/codex/contract-consolidation:workflow=.github/workflows/static-ci.yml:job=static-ci:runId=35184074308:runAttempt=1:sha=d447b89c7506281567f5ee2f8771fba91a8bdf1f:artifact=10481224055@sha256:3bd623d2e9e932cfc233ce20f08a7ad92ab728d809171d9d264a747218c7e885:artifact=10481019827@sha256:b770658c5ab2e2964d46d5ff997bd59512e599894542e982a306c4d3e59424d4
qualificationBlocker=SUCCESSOR_EXACT_CANDIDATE_GITHUB_ACTIONS_REQUIRED
qualificationBlocker=INDEPENDENT_AUDIT_APPROVAL_REQUIRED
qualificationBlocker=SECTION_1_4_INTEGRATION_REQUIRED
qualificationBlocker=AUTHORITATIVE_MASTER_VERIFICATION_REQUIRED
qualificationBlocker=SECTION_1_CHECKPOINT_REQUIRED
```

This predecessor record does not qualify the successor documentation commit, the current checkout, integration, Section 1.4, or release. A successor is qualified only by its own external exact-head GitHub Actions checks/artifacts and independent audit handoff; a tracked commit is never required to embed its own future SHA or run identity. Independent approval, Section 1.4 integration, authoritative-`master` verification, and the Section 1 checkpoint remain open.

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
