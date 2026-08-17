# ADR-076 — Enable Network Access for Delegated Codex Workers

**Status:** Accepted  
**Date:** 2026-08-17  
**Decision owners:** JARVIS project governance  
**Scope:** Windows V1 `WORKSPACE_ENGINEERING` Codex CLI workers

## Context

JARVIS V1 targets the Codex CLI provider, which requires network connectivity
to communicate with its model service and to perform ordinary engineering
workflows that depend on package registries, documentation, source hosts, and
other approved network resources. The previous contract defaulted delegated
worker network access to `DENIED`. The installed Windows provider could not
truthfully satisfy that restriction: the host remained online, while the
provider's lower-layer worker egress boundary was not independently proven.

Continuing to describe that behavior as a required denial gate would prevent
the provider from being used for its intended engineering role and would make
the qualification evidence misleading.

## Decision

Delegated Codex CLI `WORKSPACE_ENGINEERING` workers SHALL have network access
enabled by default. Core admission requires the typed workspace request for the
Codex provider to use `networkMode: ENABLED`; `DENIED` and
`QUALIFIED_POLICY` are not valid modes for a Codex worker admission.

This amendment changes only the network-availability default. It does not:

- grant workspace writes outside the exact assigned worktree;
- grant unrelated file or secret access;
- grant elevation or administrative authority;
- bypass Job Object process lifecycle containment;
- authorize GitHub push, deployment, infrastructure mutation, messaging, or
  other consequential external actions;
- change DataPolicy, project-policy trust, PermissionEngine, approval, budget,
  audit, recovery, supply-chain, or platform-role requirements.

The Codex host and its delegated worker are therefore both expected to remain
network-connected. Network availability is a qualification observation rather
than a denial requirement. The conformance probe SHALL verify that the worker
can perform a bounded network request and SHALL fail if network access is
unavailable or the probe is inconclusive.

## Alternatives considered

1. **Keep network denied by default.** Rejected because it contradicts the
   intended Codex CLI operating model and the observed provider behavior.
2. **Keep denial as the default and add a per-project exception.** Rejected
   because the user requested all Codex workers to be network-enabled and it
   would preserve an unnecessary provider-wide qualification blocker.
3. **Allow unrestricted external actions because the worker has network.**
   Rejected. Network transport is not authorization for consequential actions;
   those actions remain behind typed JARVIS tools and PermissionEngine.

## Consequences and migration

- The active contract suite advances from v1.0.7 to v1.0.8.
- The implementation, runtime, security, verification, and sequencing contract
  revisions advance synchronously.
- The typed workspace protocol gains the explicit `ENABLED` network mode.
- Core rejects Codex workspace requests that do not select `ENABLED`.
- Provider qualification changes from proving network denial to proving bounded
  network availability while retaining write, read-claim, and non-elevation
  checks.
- Existing pre-amendment denial evidence remains historical evidence and must
  not be used to claim current qualification.

## Verification and rollback

The amendment is complete only after the contract drift/generated-artifact
checks pass, focused protocol/Core/provider tests pass, the installed qualified
Codex worker passes the updated live conformance probe, and any newly built
desktop host is visually inspected. If the provider cannot demonstrate the
enabled network behavior, readiness remains failed closed; the contract does
not authorize a false `SETUP_READY` result.

## Related records

- `docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md`
- `docs/JARVIS-CONTRACT-LINEAGE.md`
- `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md`
- `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
- `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
- `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`
- `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`
- `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`
