# Authoritative `master` Repository Governance

**Contract suite:** JARVIS v1.0.7
**Decisions:** ADR-074, ADR-076
**Authoritative branch:** `master`  
**Mandatory CI pipeline:** `static-ci`
**Selected CI authority:** `LOCALCI` (qualified JARVIS repository-CI scope)

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

The v1.0.6 exception does not permit:

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

The intended selected authority is LocalCI. GitHub Actions and LocalCI are equal alternatives only after authority-specific qualification; neither is required to run in addition to a complete pass from the other. The current machine-readable profile selects CT107's `tauri2418` profile and `.localci/ci.sh`, but truthfully records LocalCI as `VERIFYING`: job `01m1kcwwthcagkcnd2trznn8hf` resolved its requested SHA and terminated successfully, yet its former pipeline omitted mandatory gates and lacked native Windows and complete control-plane evidence. It is not accepted qualification evidence. A native Windows LocalCI worker, immutable metadata injection, terminal evidence finalization, a complete exact-SHA pass, and re-audit are required before `QUALIFIED`.

Final Phase-0 evidence SHALL also record the observed live `master` protection state, the hosting limitation evidence, exact candidate/source commit, exact CI run, selected governance mode, residual risk, and the post-integration verification result when authoritative integration occurs.
