# JARVIS Project

JARVIS is a Windows-first, voice-capable AI operating companion built around deterministic authorization, bounded AI workers, durable mission orchestration, replaceable providers, secure integrations, verified execution, tested recovery, and one unified adaptive product identity.

Windows is the V1 production full-host platform. The architecture deliberately preserves Linux as a future full-host platform through explicit native capability boundaries. A future Android application is treated as a non-authoritative companion/dashboard/prompting surface rather than a second full JARVIS host.

## Branch authority

**`master` is the only authoritative and latest repository branch.**

Temporary feature/review branches MAY exist while work is in progress, but they SHALL start from the current live `master` and SHALL NOT become parallel implementation sources of truth. After accepted work is incorporated into `master`, the temporary branch is historical/disposable and must not be used as the base for new work.

Before Phase 0 implementation is considered complete, repository governance must be qualified against the actual hosting capability. If server-side branch protection/rulesets are available, `master` must use them to block force pushes/deletion and require designated CI with narrowly controlled/auditable bypass. If the hosting plan/platform does not expose that capability, v1.0.6 permits the explicit `COMPENSATING_CONTROLS` mode: temporary implementation branches, exact candidate CI, immediate live-`master` tip revalidation, non-force integration, post-integration tip/diff/evidence verification, and truthful recording that `master` is not server-protected. The fallback does not claim hard prevention of an out-of-band administrator force push/deletion and expires when server protection becomes available.

## Current implementation source of truth

**There is one current contract suite: JARVIS v1.0.6.**

Start with [`docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md`](docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md). It is the authoritative index of the current suite and records each component revision.

Read the active suite in this order:

1. [`docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md`](docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md) — canonical product, architecture, security, operations, platform-role, repository-governance, and production contract.
2. [`docs/JARVIS-V1-RELEASE-PROFILE.md`](docs/JARVIS-V1-RELEASE-PROFILE.md) — exact Windows V1 production support/capability/release target.
3. [`docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md`](docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md) — Windows/Linux full-host boundaries and future companion role.
4. [`docs/implementation/JARVIS-RUNTIME-CONTRACT.md`](docs/implementation/JARVIS-RUNTIME-CONTRACT.md) — current Windows V1 runtime specialization, secure IPC, provider setup, worker/provider supervision, scheduling, cancellation, and recovery.
5. [`docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`](docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md) — canonical V1 protocol/domain/KDF/provider/integration/platform schemas.
6. [`docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`](docs/implementation/JARVIS-DATA-STATE-CONTRACT.md) — SQLite/SQLCipher state, KDF metadata, state machines, budgets, broad backup/restore semantics, and migrations.
7. [`docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`](docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md) — threat model, permission precedence, Windows V1 security mechanisms, worker/provider/tool/module/integration security, and broad recovery-key rules.
8. [`docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md`](docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md) — exact `JARVIS_BACKUP_V1` cryptographic format, chunk/AAD/nonce/key-slot rules, generated recovery factor, and restore qualification.
9. [`docs/implementation/JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`](docs/implementation/JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md) — deterministic `AGENTS.md` candidate/enrollment/hash-change/nesting/revocation trust boundary.
10. [`docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`](docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md) — TUF-based update/module trust roots, rotation/revocation, expiration, delegations, anti-rollback and cumulative signing gates.
11. [`docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`](docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md) — normative coding/package/platform-boundary/validation/testing/CI rules.
12. [`docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`](docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md) — queue/dashboard truth, recovery visibility, notification/focus behavior, module/integration UX, voice responsiveness, diagnostics, and governance.
13. [`docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`](docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md) — canonical brand, dark-theme Mission Control, adaptive/reflow behavior, accessibility, and UI qualification.
14. [`docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`](docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md) — central Definition of Done and Windows V1 release qualification; all specialized mandatory verification rules in the active v1.0.6 contracts are cumulative.
15. [`docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`](docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md) — ordered implementation and exit criteria, including hosting-capability-aware repository governance and the early voice feasibility spike. It does not authorize implementation to begin by itself.

Canonical vector brand assets live under [`assets/brand/`](assets/brand/).

Root [`AGENTS.md`](AGENTS.md) gives contributor instructions. [`docs/JARVIS-CONTRACT-LINEAGE.md`](docs/JARVIS-CONTRACT-LINEAGE.md) explains historical contract evolution.

## Platform/runtime model

```text
Windows → FULL_HOST → V1 production target
Linux   → FULL_HOST → future production target
Android → COMPANION → future non-V1 client
```

Shared Core/domain/policy/UI semantics must stay platform-neutral where practical. Windows-specific mechanisms such as DPAPI, named pipes, Job Objects, Windows session APIs and bounded UAC remain strong Windows backend implementations rather than being weakened for portability.

A future Linux release must independently qualify its native secure storage, IPC, process supervision, filesystem/path semantics, packaging/update, providers, voice, and recovery behavior.

A future companion remains non-authoritative and may only reach a host through a separately designed/qualified remote-access boundary. V1 still exposes no privileged LAN/Internet Core API.

## v1.0.5 security closure

v1.0.5 does not redesign the architecture or reduce V1 scope. It closes the remaining pre-implementation security ambiguities:

- `JARVIS_BACKUP_V1` is a fixed production backup cryptographic format with AES-256-GCM chunk/AAD/nonce rules, strict ordering/truncation protection, fresh per-backup keys, and a mandatory JARVIS-generated 256-bit portable recovery factor; a user passphrase is optional additional recovery, not the sole production portability anchor;
- repository `AGENTS.md` is untrusted until the authenticated user enrolls an exact canonical project/path/scope/content hash; changed policy requires review and worker edits do not auto-trust new policy;
- application updates and supported module catalog use TUF trust metadata with threshold offline root trust, rotation/revocation/expiration/delegation/anti-rollback, plus cumulative Tauri and Windows signing gates;
- the implementation plan measures voice/AEC/barge-in feasibility immediately after the early persistence/recovery proof rather than discovering voice-stack infeasibility late;
- SSH, Google Workspace, Microsoft 365, and Cloudflare remain binding post-V1 targets but may ship independently when individually production-qualified;
- Phase 0 adds machine-readable repeated contract values and CI drift checks where practical;
- SQLite qualification is tied to the exact embedded build and fix evidence, not numerical version comparison alone.

## v1.0.6 repository-governance closure

v1.0.6 does not change the V1 platform, runtime, provider, integration, voice, backup, UI, or product capability scope. It makes repository governance truthful to the hosting capability:

- server-side branch protection/rulesets remain mandatory whenever the authoritative repository's hosting plan exposes them;
- a verified plan/platform limitation may use `COMPENSATING_CONTROLS` rather than making a paid hosting feature a hidden JARVIS prerequisite;
- compensating governance still requires exact candidate CI, stale-tip-safe non-force integration, and post-integration verification/audit;
- the residual inability to hard-block an out-of-band administrator force push/deletion is recorded explicitly rather than represented as equivalent protection;
- server-enforced protection becomes mandatory again if the hosting capability later becomes available.

## No overlay interpretation

Accepted ADRs preserve decision history and rationale. **They are not a second implementation layer.** Their still-valid effects are incorporated into the v1.0.6 suite.

If an ADR/history file and the active suite appear to conflict, the current manifest and normative documents govern; a suspected missing still-valid requirement is treated as a contract defect and corrected in the current suite rather than silently inferred from history.

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
