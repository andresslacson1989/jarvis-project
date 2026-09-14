# JARVIS Project

JARVIS is a Windows-first, voice-capable AI operating companion built around deterministic authorization, bounded AI workers, durable mission orchestration, replaceable providers, secure integrations, verified execution, tested recovery, and one unified adaptive product identity.

Windows is the V1 production full-host platform. The architecture deliberately preserves Linux as a future full-host platform through explicit native capability boundaries. A future Android application is treated as a non-authoritative companion/dashboard/prompting surface rather than a second full JARVIS host.

## Branch authority

**`master` is the only authoritative and latest repository branch.**

Temporary feature/review branches MAY exist while work is in progress, but they SHALL start from the current live `master` and SHALL NOT become parallel implementation sources of truth. After accepted work is incorporated into `master`, the temporary branch is historical/disposable and must not be used as the base for new work.

Before Phase 0 implementation is considered complete, repository governance must be qualified against the actual hosting capability. If server-side branch protection/rulesets are available, `master` must use them to block force pushes/deletion and require designated CI with narrowly controlled/auditable bypass. If the hosting plan/platform does not expose that capability, v1.0.7 permits the explicit `COMPENSATING_CONTROLS` mode: temporary implementation branches, exact candidate CI, immediate live-`master` tip revalidation, non-force integration, post-integration tip/diff/evidence verification, and truthful recording that `master` is not server-protected. Mandatory CI may be supplied by either qualified GitHub Actions or qualified LocalCI; one complete exact-SHA result is sufficient and both are not required. The fallback does not claim hard prevention of an out-of-band administrator force push/deletion and expires when server protection becomes available.

## Current implementation source of truth

**There is one current contract suite: JARVIS v1.0.7.**

Start with [`docs/JARVIS-CONTRACT-MANIFEST-v1.0.7.md`](docs/JARVIS-CONTRACT-MANIFEST-v1.0.7.md). It is the authoritative index of the current suite and records the exact component revision set.

Read the normative suite in this order:

1. [`docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md`](docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md) — product scope, authority, repository governance, and coding standards.
2. [`docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md`](docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md) — runtime roles, platform boundaries, process lifecycle, IPC, and schemas.
3. [`docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md`](docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md) — persistence, state, exact values, backup format, restore, and recovery.
4. [`docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md`](docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md) — security hardening, project-policy trust, and supply-chain trust.
5. [`docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md`](docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md) — operations, integrations, voice, visual identity, adaptive UX, and accessibility.
6. [`docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md`](docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md) — definition of done, qualification, release evidence, and Production Complete.
7. [`docs/JARVIS-V1-RELEASE-PROFILE.md`](docs/JARVIS-V1-RELEASE-PROFILE.md) — exact Windows V1 production support/capability/release target.

[`docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`](docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md) remains the non-authoritative dependency/sequencing aid and does not add requirements or authorize implementation by itself.

Canonical vector brand assets live under [`assets/brand/`](assets/brand/).

Root [`AGENTS.md`](AGENTS.md) gives contributor instructions. No historical document or decision record supplements the active suite.

## Platform/runtime model

```text
Windows → FULL_HOST → V1 production target
Linux   → FULL_HOST → future production target
Android → COMPANION → future non-V1 client
```

Shared Core/domain/policy/UI semantics must stay platform-neutral where practical. Windows-specific mechanisms such as DPAPI, named pipes, Job Objects, Windows session APIs and bounded UAC remain strong Windows backend implementations rather than being weakened for portability.

A future Linux release must independently qualify its native secure storage, IPC, process supervision, filesystem/path semantics, packaging/update, providers, voice, and recovery behavior.

A future companion remains non-authoritative and may only reach a host through a separately designed/qualified remote-access boundary. V1 still exposes no privileged LAN/Internet Core API.

## Current contract guarantees

The v1.0.7 active suite keeps the product scope and exact safeguards in the
manifest and six consolidated components. In particular:

- J02 fixes the `JARVIS_BACKUP_V1` envelope, key separation, recovery slots, and restore gates;
- J03 fixes project-policy enrollment, PermissionEngine/security boundaries, and TUF-backed update/module trust;
- J01 fixes the Windows `FULL_HOST` target and all platform/capability boundaries;
- J04 fixes truthful operations, voice behavior, UI identity, adaptive layout, and accessibility;
- J05 fixes the complete test, evidence, CI-authority, qualification, and signed-release gates;
- J00 fixes scope, governance, direct amendment, coding, and repository-boundary rules.

## No overlay interpretation

Historical documents do not supplement the active suite. If any non-current document appears to contain a missing requirement, treat that as a contract defect and restore the requirement directly into the active suite before implementation.

## Governing principles

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **One system. One identity. Any screen.**

> **Abstract the capability, not the security away.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**

> **One authoritative host. Multiple interaction surfaces may come later.**

> **A repository file is data until an authenticated user enrolls its exact policy identity.**

> **A valid historical signature is not perpetual authorization to activate.**

`Implementation-locked` means the active contract defines architecture tightly enough that implementation does not invent product/security/platform boundaries. `Production Complete` still requires an implemented, signed Windows V1 release that passes every mandatory active release gate.
