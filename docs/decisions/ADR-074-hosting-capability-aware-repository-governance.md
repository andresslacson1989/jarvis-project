# ADR-074 — Hosting-Capability-Aware Repository Governance

**Status:** Accepted  
**Date:** August 12, 2026  
**Decision owner:** User / project governance  
**Contract suite introduced:** v1.0.6

## Context

JARVIS Phase 0 originally required GitHub server-side branch protection/rulesets on the authoritative `master` branch before Phase 0 could complete.

The authoritative repository is currently private. The connected GitHub account/hosting plan does not expose branch protection or repository rulesets for this private repository without a paid plan upgrade. The observed GitHub response was HTTP `403` with the provider message that the account must upgrade or make the repository public to enable the feature.

Making a paid GitHub plan a hidden JARVIS product prerequisite is not a product/security requirement. Making the repository public merely to obtain a hosting feature is also not justified. At the same time, JARVIS must not falsely claim that `master` is server-protected when GitHub is not enforcing it.

## Decision

Repository governance is qualified against the hosting capability that actually exists.

Two modes are defined:

### `SERVER_ENFORCED`

Use this mode whenever the hosting provider/account exposes enforceable server-side branch protection/rulesets for the authoritative repository.

The effective policy must block force pushes and deletion, require designated mandatory CI, and keep bypass narrow and auditable.

An available protection capability may not be disabled merely to select the fallback mode.

### `COMPENSATING_CONTROLS`

This mode is permitted only when server-side protection/rulesets are unavailable because of a verified hosting plan/platform capability limitation.

It requires:

- temporary implementation branches rather than routine direct implementation writes to `master`;
- designated mandatory CI passing on the exact candidate commit before authoritative integration;
- immediate live-`master` tip revalidation before integration;
- reconciliation rather than overwrite when the authoritative tip moved unexpectedly;
- non-force integration/ref movement only;
- post-integration verification of the authoritative tip, intended diff, and CI/audit evidence;
- explicit recording that `master` is not server-protected;
- restoration of `SERVER_ENFORCED` mode if the hosting capability becomes available later.

This mode does not claim hard server-side prevention of an out-of-band repository-administrator force push or deletion. That residual hosting limitation is accepted and must remain visible in qualification evidence.

## Consequences

- GitHub Pro/Team/Enterprise is not a mandatory JARVIS implementation or Production Complete prerequisite merely to obtain private-repository protection.
- Making the repository public is not required to satisfy Phase 0.
- Mandatory CI remains mandatory.
- Normal implementation workflow remains non-force and stale-tip safe.
- Server-side protection remains stronger and mandatory whenever available.
- Qualification must distinguish the two modes truthfully; `COMPENSATING_CONTROLS` is not described as equivalent technical branch protection.
- No JARVIS product capability is added for repository administration or branch-protection administration.

## Rejected alternatives

### Require a paid GitHub plan

Rejected because the hosting subscription is not a JARVIS product/runtime requirement and would make an external commercial plan a hidden release prerequisite.

### Make the repository public

Rejected because repository visibility is a separate product/governance decision and should not be changed only to obtain a hosting control.

### Silently ignore the existing gate

Rejected because it would make Contract Accuracy less than 10/10 and create a false verification claim.

### Claim local process controls equal server protection

Rejected because local/process governance cannot technically prevent an out-of-band repository administrator from force-pushing or deleting an unprotected branch.

## Synchronous contract changes

ADR-074 requires synchronized updates to:

- the top-level implementation contract;
- the contract manifest and suite version;
- the Verification/Release Contract;
- the Implementation Plan;
- contributor governance/source-of-truth entry points;
- machine-readable suite identity and contract-drift tooling;
- the Phase-0 implementation matrix/evidence.

The V1 Release Profile does not change because supported platform, provider, integration, product capability, artifact, or user-facing release scope is unchanged.
