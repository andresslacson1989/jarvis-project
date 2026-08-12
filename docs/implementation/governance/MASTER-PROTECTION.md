# Authoritative `master` Protection Policy

**Document role:** Non-normative implementation/governance procedure for JARVIS v1.0.5 Phase 0 subsection `0.13`.

This document does not replace the normative contract suite. It records the exact GitHub repository setting required to satisfy the current contract and gives future implementation agents an auditable verification target.

## Protected branch

The authoritative branch is exactly:

```text
master
```

No other branch may be substituted as the authoritative protected branch for Phase 0 completion.

## Required protection state

`master` SHALL be protected with all of the following properties simultaneously:

| Setting | Required state |
|---|---|
| Required status check | `static-ci` |
| Require branch to be up to date / strict status checks | `true` |
| Enforce protection for repository administrators | `true` |
| Force pushes | prohibited |
| Branch deletion | prohibited |
| Standing bypass actors | none |

The `static-ci` required-check identity is the GitHub Actions job/check produced by `.github/workflows/static-ci.yml`. A similarly named workflow, legacy commit status, or another branch's informal success is not a substitute for the required `static-ci` check on the commit proposed for `master`.

The current contract does not require an arbitrary pull-request approval count merely to satisfy `0.13`; do not invent an approval-count policy under this subsection. Additional repository governance may be added later only when it remains contract-consistent and does not weaken the mandatory checks above.

## Bypass governance

There is no permanent or broad bypass actor in the Phase 0 baseline.

If an extraordinary repository-recovery event requires temporarily changing protection, that change SHALL be treated as a separate consequential governance action and SHALL be auditable. Before changing the setting, record at minimum:

- actor;
- reason and incident/change reference;
- exact setting being changed;
- intended duration;
- current `master` commit SHA;
- approval/governance authority for the exception.

After the exceptional operation, restore the full policy above and record:

- restored settings;
- resulting `master` commit SHA;
- required-check result;
- time/actor of restoration.

Normal development, implementation convenience, a failing check, or an AI recommendation is not a bypass reason.

## Verification procedure

Before marking `0.13` `VERIFIED`, read GitHub's live branch-protection/ruleset state and prove all required settings above. Repository documentation by itself is not evidence that protection is active.

The verification packet SHALL include:

1. repository and branch identity;
2. exact live `master` SHA at verification time;
3. `protected = true` (or ruleset-equivalent enforcement);
4. required status-check identity `static-ci`;
5. strict/up-to-date status-check enforcement;
6. administrator enforcement;
7. force-push denial;
8. branch-deletion denial;
9. absence of a broad standing bypass;
10. a successful `static-ci` run/check demonstrating the required context exists;
11. the settings source/API response used for the proof.

Do not test force-push/deletion protection by destructively modifying `master`; verify the enforced GitHub policy state instead.

## Idempotency

Applying this exact desired state repeatedly must be idempotent. An implementation agent SHALL read the current protection state first, change only divergent fields, and reread the live state after mutation.

## Failure behavior

If GitHub administration permission or an authenticated branch-protection/ruleset mutation capability is unavailable, `0.13` remains `BLOCKED`. Do not weaken the desired policy, remove administrator enforcement, drop `static-ci`, allow force pushes/deletion, or mark the row verified to work around the missing administrative prerequisite.

## Ownership boundary

This file defines the repository-governance target for `0.13`. `0.CP` owns the final Phase 0 clean-checkout/governance/platform-boundary/drift checkpoint after this live setting is actually enforced.
