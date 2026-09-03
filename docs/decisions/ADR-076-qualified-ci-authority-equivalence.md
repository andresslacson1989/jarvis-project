# ADR-076 — Qualified CI Authority Equivalence

**Status:** Accepted
**Date:** September 3, 2026
**Decision owner:** User / project governance
**Contract suite introduced:** v1.0.7

## Context

JARVIS v1.0.6 named mandatory CI but its repository controls and executable governance profile were coupled to GitHub Actions and the `static-ci` GitHub job identity. GitHub Actions later became unavailable because of an account billing failure. A separately administered LocalCI appliance then executed the repository-owned pipeline for an exact candidate SHA and produced a successful result across the mandatory checks.

The successful run proves that CI authority does not inherently depend on GitHub Actions. Authority must instead depend on qualified security, exact-source binding, reproducibility, isolation, complete gate execution, and auditable evidence. Treating every LocalCI installation as trusted would be unsafe; treating GitHub Actions as the only possible authority would create an unnecessary vendor and billing dependency.

## Decision

GitHub Actions and LocalCI are equal **eligible CI authority types**. Either one may independently satisfy a mandatory JARVIS CI gate after the specific authority instance and pipeline are qualified against the same common requirements and the applicable authority-specific requirements.

Qualification is disjunctive, not cumulative: one complete result from one qualified authority is sufficient unless a later subsection or release rule explicitly requires independent dual execution. A partial result from each authority cannot be combined into one pass.

Every authoritative CI result SHALL prove:

- the approved repository identity, requested revision, and server-resolved immutable 40-hex commit SHA;
- exact equality between the resolved commit and the candidate being qualified;
- execution of a repository-owned, reviewable, immutable-at-that-SHA pipeline definition or script;
- the complete mandatory gate set with fail-closed step and aggregate status;
- pinned toolchain/dependency installation and frozen/locked dependency resolution;
- authenticated, least-privilege job submission and evidence retrieval;
- isolation from CI control-plane credentials, databases, sockets, arbitrary host paths/devices, and unapproved host networking;
- bounded timeouts, cancellation, cleanup, concurrency, duplicate/idempotency behavior, and truthful terminal state;
- durable evidence containing authority/instance identity, job identity, timestamps, candidate SHA, pipeline identity/version, per-gate outcomes, logs/artifact identities or hashes, and final status;
- evidence export or retention sufficient for independent audit and post-integration verification.

GitHub Actions qualification additionally requires immutable action pins, least-privilege workflow permissions, no persisted checkout credential beyond need, the exact approved workflow/job identity, and live run evidence from GitHub for the exact candidate.

LocalCI qualification additionally requires an explicitly identified production-qualified appliance or service, authenticated TLS, separate least-privilege API-client credentials rather than administrator password/TOTP automation, repository/profile/branch allowlists, server-side revision resolution, rootless isolated job execution, denial of arbitrary clone URLs/commands/images/mounts/paths/devices/networks, secret non-exposure to jobs, controlled upgrades, clock integrity, evidence retention/export, and tested cancellation/recovery. A demo, stale, unknown, or materially changed LocalCI instance is not authoritative until qualified or requalified.

Changing authority type or material authority identity/configuration invalidates inherited qualification evidence. Historical GitHub Actions results remain valid historical evidence for the commits they actually tested; they are not rewritten as LocalCI results. LocalCI results are never represented as GitHub results.

The selected authority is machine-readable. GitHub Actions may be disabled when a qualified LocalCI authority is selected and available; this is not a skipped CI gate. If no qualified authority can execute the complete required pipeline, the affected subsection remains `VERIFYING` or truthfully `BLOCKED` where blocker semantics apply.

## Consequences

- JARVIS no longer has a mandatory GitHub Actions billing dependency for repository CI.
- LocalCI and GitHub Actions have equal authority only after qualification, not by declaration or product name.
- Existing exact-SHA, non-force integration, stale-tip reconciliation, audit, and post-integration requirements remain unchanged.
- Server-side branch protection remains required when available. A selected LocalCI authority used with server-enforced protection must publish or otherwise provide an enforceable required status that the hosting ruleset can require.
- The active suite advances to v1.0.7 and synchronizes every affected normative and executable governance surface.

## Rejected alternatives

### Require both authorities

Rejected because it preserves GitHub Actions as a hidden availability/billing dependency and adds cost without being required for ordinary qualification.

### Trust CT107 or every LocalCI deployment automatically

Rejected because one successful run does not prove all control-plane, retention, recovery, upgrade, and isolation properties of every instance.

### Treat local developer tests as an authority

Rejected because ordinary local execution lacks the independent control plane, exact-SHA admission, isolation, and durable evidence requirements.

### Remove CI while GitHub Actions is unavailable

Rejected because authority portability must not weaken mandatory verification.

## Governing distinction

> **CI authority follows qualified properties and exact evidence, not the vendor name.**

---

**END — ADR-076**
