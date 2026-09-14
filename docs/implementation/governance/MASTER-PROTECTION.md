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
SERVER_ENFORCED
```

On `2026-09-12T22:26:31Z`, authenticated GitHub API observations established that:

```text
repository: andresslacson1989/jarvis-project
visibility: public
authoritative branch: master
master SHA: bb59c13d99c8b472de0dbe08b8f5ce59cf50e705
rulesets endpoint: HTTP 200, 0 rulesets
branch-protection before configuration: HTTP 404, protected=false
branch-protection update: HTTP 200
branch-protection after configuration: HTTP 200, protected=true
```

The active machine-readable profile is:

`docs/implementation/governance/repository-governance-profile.json`

The profile records classic GitHub branch protection as available and active. The old private-repository HTTP `403` and its “Upgrade to GitHub Pro or make this repository public” message are retained only in historical evidence; they are not current capability evidence.

## Effective server-enforced policy

The post-configuration branch-protection response recorded:

```text
required status check: static-ci
required status checks strict/up-to-date: true
required pull-request approvals: 1
dismiss stale reviews: true
required conversation resolution: true
administrators covered: true
force pushes allowed: false
branch deletion allowed: false
configured bypass restrictions: none
```

The effective API response also reported `restrictions: null`, `allow_force_pushes.enabled=false`, `allow_deletions.enabled=false`, `enforce_admins=true`, and `required_status_checks.checks=[{context:"static-ci",app_id:15368}]`. No broad bypass actor is configured in the returned policy. The repository remains truthful about the distinction between server-enforced branch controls and the separate authority to administer those controls.

## Required integration discipline

Server enforcement does not waive the implementation workflow requirements. Normal implementation integration still SHALL:

1. use a temporary implementation branch;
2. require the complete `static-ci` pipeline for the exact candidate commit;
3. re-fetch the live `master` tip immediately before integration;
4. stop and reconcile if the authoritative tip moved unexpectedly;
5. use a non-force integration/ref update only; and
6. re-fetch the resulting authoritative tip and verify the intended diff plus relevant CI/audit evidence.

The safe integration algorithm remains:

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

## Current CI and evidence identity

The selected authority remains GitHub Actions. GitHub Actions and LocalCI are equal alternatives only after authority-specific qualification; neither is required in addition to a complete qualified pass from the other. LocalCI remains unselected and unqualified.

The profile retains the historical Phase 0 authority record for candidate `052902bfc52e676910d287e13fbf8a026915efe0` and authoritative-master verification `2cfcca9f2f7ee0faf334223b659e94ab410f5acd` / run `33950976184`; those identities remain referenced by the durable Phase 0 evidence set. The current live master observation above is separate and is not silently substituted into that historical qualification record.

The latest observed successful Static CI run for the current live `master` was run `34198981471` on exact SHA `bb59c13d99c8b472de0dbe08b8f5ce59cf50e705` (push event, completed successfully). This observation records current branch state; it is not the Section 1.4 candidate qualification or its post-integration proof.

### Section 1.4 documentation-revision validation

The documentation-only revision that corrected the Section 1.4 evidence record was independently validated before this governance reconciliation:

```text
documentation SHA: 367a3bdf8b083084abe9002783ddf9a6a1579bf6
GitHub Actions run: 34688940911
windows-tauri-build job: 103540708316 — SUCCESS
static-ci job: 103541583217 — SUCCESS
Tauri artifact: 10296976203, sha256:626d75ae94e5de0911bdaf5145f9e4821d225e032307a9f4a30c2d92746ce9c1
native artifact: 10296786503, sha256:92800513af3496f8baadf6d302ee04ec4c05d105355148d333c309edfa5d28ae
```

The retained downloaded evidence and the repository verifier passed for both qualification scopes. This validation is intentionally separate from the implementation candidate `97a6fc19388f94cd82c65914fd48859b57557e75` and its run `34686091847`; it does not replace the implementation evidence or authorize integration.

## Idempotency and recovery

Governance observations are read-only and repeatable. An integration retry starts from a freshly observed authoritative tip. A prior CI result cannot be silently transferred to a materially changed candidate. An ambiguous or failed ref update must be reconciled from live GitHub state before another mutation is attempted.

## Fallback rule — the v1.0.7 exception is not active

The v1.0.7 `COMPENSATING_CONTROLS` exception remains defined for a genuinely unavailable hosting capability, but it is not the current mode. It SHALL NOT be selected while the effective server-side protection capability is available and active. If the hosting capability is later removed or becomes unavailable, a fresh observation and a new evidence revision are required before selecting the fallback; the fallback must again record its exact limitation, truthful unprotected state, residual risk, exact candidate CI, stale-tip reconciliation, non-force integration, and post-integration proof.

## What governance does not permit

The active governance profile does not permit:

- claiming an unprotected branch is protected;
- disabling or weakening the active `static-ci` requirement;
- force-push implementation workflow or branch deletion;
- broad or unrecorded bypass actors;
- integrating over a moved authoritative tip;
- treating LocalCI as qualified without its complete authority-specific evidence;
- treating local tests as equivalent to authoritative GitHub Actions evidence; or
- declaring Section 1.4, Section 1, or Production Complete from governance configuration alone.

## Verification surfaces

Repository-side verification includes:

```text
pnpm governance:check
pnpm contract:check
pnpm test
```

The exact selected workflow/job identity remains `.github/workflows/static-ci.yml` / `static-ci`. The active profile records the live server-enforced policy observation and preserves the separate exact-CI qualification identities without embedding a self-referential documentation commit hash.
