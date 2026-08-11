# JARVIS Project

JARVIS is a Windows-first, voice-capable AI operating companion built around deterministic authorization, bounded AI workers, durable mission orchestration, replaceable providers, secure integrations, verified execution, tested recovery, and one unified adaptive product identity.

Windows is the V1 production full-host platform. The architecture deliberately preserves Linux as a future full-host platform through explicit native capability boundaries. A future Android application is treated as a non-authoritative companion/dashboard/prompting surface rather than a second full JARVIS host.

## Branch authority

**`master` is the only authoritative and latest repository branch.**

Temporary feature/review branches MAY exist while work is in progress, but they SHALL start from the current live `master` and SHALL NOT become parallel implementation sources of truth. After accepted work is incorporated into `master`, the temporary branch is historical/disposable and must not be used as the base for new work.

Before Phase 0 implementation is considered complete, `master` must have production-grade repository protection that blocks force pushes/deletion and requires designated CI checks, with narrowly controlled/auditable bypass.

## Current implementation source of truth

**There is one current contract suite: JARVIS v1.0.4.**

Start with [`docs/JARVIS-CONTRACT-MANIFEST-v1.0.4.md`](docs/JARVIS-CONTRACT-MANIFEST-v1.0.4.md). It is the authoritative index of the current suite and records each component revision.

Read the active suite in this order:

1. [`docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.4.md`](docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.4.md) — canonical product, architecture, security, operations, platform-role, and production contract.
2. [`docs/JARVIS-V1-RELEASE-PROFILE.md`](docs/JARVIS-V1-RELEASE-PROFILE.md) — exact Windows V1 production support/capability/release target.
3. [`docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md`](docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md) — Windows/Linux full-host boundaries and future companion role.
4. [`docs/implementation/JARVIS-RUNTIME-CONTRACT.md`](docs/implementation/JARVIS-RUNTIME-CONTRACT.md) — current Windows V1 runtime specialization, secure IPC, provider setup, worker/provider supervision, scheduling, cancellation, and recovery.
5. [`docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`](docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md) — canonical V1 protocol/domain/KDF/provider/integration schemas.
6. [`docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`](docs/implementation/JARVIS-DATA-STATE-CONTRACT.md) — SQLite/SQLCipher state, KDF metadata, state machines, budgets, backups, restore, and migrations.
7. [`docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`](docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md) — threat model, permission precedence, Windows V1 security mechanisms, worker/provider/tool/module/integration security, and recovery-key rules.
8. [`docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`](docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md) — normative coding/package/platform-boundary/validation/testing/CI rules.
9. [`docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`](docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md) — queue/dashboard truth, recovery visibility, notification/focus behavior, module/integration UX, voice responsiveness, diagnostics, and governance.
10. [`docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`](docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md) — canonical brand, dark-theme Mission Control, adaptive/reflow behavior, accessibility, and UI qualification.
11. [`docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`](docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md) — Definition of Done, portability-boundary evidence, Windows V1 security/provider/integration/UI/recovery gates, and release qualification.
12. [`docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`](docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md) — ordered implementation and exit criteria. It does not authorize implementation to begin by itself.

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

## No overlay interpretation

Accepted ADRs under `docs/decisions/` and `docs/adr/` preserve decision history and rationale. **They are not a second implementation layer.** Their still-valid effects are incorporated into the v1.0.4 suite.

If an ADR/history file and the active suite appear to conflict, the current manifest and normative documents govern; a suspected missing still-valid requirement is treated as a contract defect and corrected in the current suite rather than silently inferred from history.

## Key production closures

v1.0.3 closed UI release integration, Codex setup/repair, KDF floors, exact GitHub/Proxmox matrices, brand provenance, contract versioning, and repository governance.

v1.0.4 adds one deliberate architectural preservation constraint without expanding V1 delivery scope:

- Windows and Linux are full-host platform targets, with Windows alone required for V1;
- native OS functions sit behind explicit platform capability/composition boundaries;
- shared Core/domain/policy code must not accumulate direct Windows implementation dependencies;
- stronger Windows mechanisms are never weakened for portability;
- provider/module/tool support remains platform-qualified;
- Android is reserved as a future companion, not a full-host parity requirement;
- future companion communication requires a separately qualified remote-access gateway and never direct unrestricted Core exposure.

## Governing principles

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **One system. One identity. Any screen.**

> **Abstract the capability, not the security away.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**

> **One authoritative host. Multiple interaction surfaces may come later.**

`Implementation-locked` means the active contract defines architecture tightly enough that implementation does not invent product/security/platform boundaries. `Production Complete` still requires an implemented, signed Windows V1 release that passes every mandatory active release gate.
