# Authoritative `master` Repository Governance

**Contract suite:** JARVIS v1.0.7
**Decisions:** ADR-074, ADR-076
**Authoritative branch:** `master`  
**Mandatory CI pipeline:** `static-ci`
**Selected CI authority:** `GITHUB_ACTIONS` (QUALIFIED; exact candidate run `33934840029` passed)

This document is an operational implementation aid for the repository-governance requirements in the active top-level contract §28, Verification Contract §33, and Implementation Plan Phase 0. It is not a substitute for those normative requirements.

## Current effective mode

The current repository governance mode is:

```text
COMPENSATING_CONTROLS
```

GitHub server-side branch protection/rulesets are not available for this private repository under the current hosting/account plan. The observed administration attempt returned HTTP `403` with:

```text
Upgrade to GitHub Pro or make this repository public to enable this feature.
```

The live GitHub branch resource reports `master` as not protected. JARVIS therefore SHALL NOT describe the branch as server-protected and SHALL NOT claim that the current mode technically prevents an out-of-band repository administrator from force-pushing or deleting `master`.

The machine-readable selected profile is:

`docs/implementation/governance/repository-governance-profile.json`

Its residual-risk value is deliberately explicit:

```text
OUT_OF_BAND_ADMIN_FORCE_PUSH_OR_DELETION_NOT_SERVER_BLOCKED
```

## Mandatory compensating controls

While server-side protection is unavailable, normal implementation integration SHALL satisfy every control below:

1. Perform implementation work on a temporary implementation branch rather than routine direct implementation writes to `master`.
2. Require the complete `static-ci` pipeline to pass for the exact candidate commit on either qualified `GITHUB_ACTIONS` or qualified `LOCALCI`; the selected authority and evidence identity must be recorded.
3. Re-fetch the live `master` tip immediately before integration.
4. If `master` moved unexpectedly, stop the integration attempt, inspect/reconcile the intervening change, rebuild/reverify the candidate as required, and do not overwrite the new tip.
5. Integrate only with a non-force operation. Force-push/ref rewriting is not an accepted implementation workflow.
6. Re-fetch the resulting authoritative tip after integration and verify the intended commit/diff plus relevant CI/audit evidence.

These controls are cumulative. Failure of any one of them prevents the compensating-governance qualification from passing.

## Safe integration procedure

The normal algorithm is:

```text
fetch live master M0
→ verify candidate C is based on/reconciled with M0
→ require qualified-authority static-ci success for exact C
→ fetch live master again as M1
→ if M1 != M0: abort/reconcile/reverify
→ integrate C using non-force update / reviewed merge path
→ fetch resulting master M2
→ verify intended ancestry/diff and no unrelated overwrite
→ verify required CI/audit evidence for the resulting authoritative state
→ record evidence
```

A stale or moved `master` is a safe retry/reconciliation event, not permission to force-update the branch.

## Idempotency and retry behavior

Governance checks are read-only and repeatable. Re-running them against the same profile/workflow produces the same result.

An integration retry must start again from a freshly observed authoritative tip. A prior successful CI result cannot be silently transferred to a materially changed candidate. An ambiguous or failed ref update must be reconciled from live GitHub state before another mutation is attempted.

## Transition to server-enforced mode

If the hosting provider/account later exposes private-repository branch protection or repository rulesets, `COMPENSATING_CONTROLS` is no longer sufficient by itself. The repository SHALL transition to:

```text
SERVER_ENFORCED
```

The effective server configuration must then prove at least:

- protection/ruleset active for `master`;
- exact required CI context `static-ci`;
- strict/up-to-date required checks;
- force pushes blocked;
- deletion blocked;
- administrators covered by the protection;
- bypass narrow and auditable.

The machine-readable governance profile SHALL be updated to `SERVER_ENFORCED` only after those settings are observed live. Merely upgrading the GitHub account is not enough evidence by itself.

## What this exception does not permit

The v1.0.7 exception does not permit:

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

The intended selected authority is GitHub Actions. GitHub Actions and LocalCI are equal alternatives only after authority-specific qualification; neither is required to run in addition to a complete pass from the other. The machine-readable profile selects the immutable `static-ci` workflow/job and records GitHub Actions as `QUALIFIED` from run `33934840029` for candidate `052902bfc52e676910d287e13fbf8a026915efe0`. The Windows Tauri job `101220622635` and static job `101222623099` both completed successfully. The pull-request merge ref is metadata context only: checkout logs show the explicit candidate SHA was fetched and checked out, and the independent `git rev-parse HEAD` check matched it exactly. The generated Phase 0 evidence was `status=PASS` and included the complete named gate set. The earlier failed run `33818720345` remains historical negative evidence only.

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

The owner-authorized, one-run CT107 testing exception is recorded at
`docs/implementation/governance/LOCALCI-CT107-QUALIFICATION-EXCEPTION-2026-09-04.md`.
It permits only the explicitly bounded non-mutating qualification scope for
candidate `0fc861f...`; it does not change CT107's protected production role,
does not authorize setup/configuration/registration changes, and does not make
LocalCI qualified.

Every LocalCI submission must preserve the repository owner/name, full `refs/heads/...` ref, `tauri2418` pipeline profile, optional requested SHA, and a unique idempotency key. The worker must separately record the server-resolved repository/ref/SHA and attestation identity, verify the real Git remote and checkout SHA, and support a detached HEAD when it equals the server-resolved commit. Exit 78 after `PENDING_AUTHORITY_FINALIZATION` is a non-success pending state; the control plane must reconcile it explicitly before recording a terminal result.

Final Phase-0 evidence SHALL also record the observed live `master` protection state, the hosting limitation evidence, exact candidate/source commit, exact CI run, selected governance mode, residual risk, and the post-integration verification result when authoritative integration occurs.
