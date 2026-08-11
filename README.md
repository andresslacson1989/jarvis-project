# JARVIS Project

JARVIS is a Windows-first, voice-capable AI operating companion built around deterministic authorization, bounded AI workers, durable mission orchestration, replaceable providers, secure integrations, verified execution, tested recovery, and one unified adaptive product identity.

## Branch authority

**`master` is the only authoritative and latest repository branch.**

Temporary feature/review branches MAY exist while work is in progress, but they SHALL start from the current live `master` and SHALL NOT become parallel implementation sources of truth. After their accepted work is incorporated into `master`, they are historical/disposable branch pointers and MUST NOT be used as the base for new implementation work.

In particular, legacy `codex/contract-*` review branches are non-authoritative. Their useful work has already been reconciled into `master`. Branch names do not override the current contract on `master`.

## Current implementation source of truth

**There is one current implementation contract: JARVIS v1.0.2.**

Read the active suite in this order:

1. [`docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`](docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md) — canonical product, architecture, security, operations, and production contract.
2. [`docs/JARVIS-V1-RELEASE-PROFILE.md`](docs/JARVIS-V1-RELEASE-PROFILE.md) — exact V1 production support/release target.
3. [`docs/implementation/JARVIS-RUNTIME-CONTRACT.md`](docs/implementation/JARVIS-RUNTIME-CONTRACT.md) — process topology, Tauri/WebView boundary, application-owned Core runtime, IPC, worker/provider supervision, scheduling, cancellation, and recovery.
4. [`docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`](docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md) — canonical protocol/domain schemas and exact cross-language representations.
5. [`docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`](docs/implementation/JARVIS-DATA-STATE-CONTRACT.md) — SQLite/SQLCipher state, state machines, transactions, events, budgets, backups, restore, and migrations.
6. [`docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`](docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md) — threat model, session trust, permission precedence, IPC/WebView/worker/tool/module/integration security, and recovery-key rules.
7. [`docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`](docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md) — normative coding, package-boundary, validation, Rust/TypeScript, database, security, testing, and CI rules.
8. [`docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`](docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md) — queue/dashboard truth, worker/recovery visibility, event/notification/focus behavior, configuration/import safety, memory retrieval, module/integration UX, voice identity/responsiveness, diagnostics/audit behavior, vulnerability policy, and architecture decision escalation.
9. [`docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`](docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md) — canonical JARVIS brand identity, dark-theme visual system, Mission Control shell, adaptive layout, dedicated-window behavior, component language, accessibility, and UI qualification.
10. [`docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`](docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md) — Definition of Done, conformance, adversarial, recovery, performance, voice, packaging, and release gates.
11. [`docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`](docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md) — ordered implementation and exit criteria.

Canonical vector brand assets live under [`assets/brand/`](assets/brand/). UI code SHALL consume the canonical mark and design tokens rather than recreate unrelated variants per screen.

Root [`AGENTS.md`](AGENTS.md) gives contributor instructions. [`docs/JARVIS-CONTRACT-LINEAGE.md`](docs/JARVIS-CONTRACT-LINEAGE.md) explains how prior branches/ADRs were reconciled.

## No overlay interpretation

Accepted ADRs under `docs/decisions/` and `docs/adr/` preserve decision history and rationale. **They are not a second implementation layer.** Their still-valid effects are incorporated into the v1.0.2 suite.

The active implementation suite now includes explicit current normative operational/user-facing requirements that historically lived in ADRs, including queue transparency, work-dashboard truth, notification/focus policy, safe configuration activation/import behavior, scoped ranked memory retrieval, module lifecycle UX, persistent voice identity/fallback, diagnostic-export privacy, audit retention/integrity claims, dependency-vulnerability release policy, architecture escalation, and the approved JARVIS visual/interaction identity adopted by ADR-070.

A future architectural ADR is incomplete until the same change also updates every affected active normative document. Implementation SHALL NOT rely on a new ADR while contradictory or incomplete canonical wording remains.

If an ADR and an active v1.0.2 normative document appear to conflict, stop and correct the canonical contract; do not choose an interpretation silently.

## Historical material

Earlier top-level contracts are retained under [`docs/history/`](docs/history/) for provenance only. They are not current implementation instructions.

The divergent branch `codex/contract-implementation-lock` is historical/non-authoritative. Useful work from it was incorporated into v1.0.2, but its colliding ADR-054/055/056 identifiers are **not** part of the canonical ADR lineage.

## Governing principles

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

> **Escalate product judgment. Resolve engineering judgment.**

> **One system. One identity. Any screen.**

> **Build the control plane first, prove recoverability early, then give intelligence access to it.**

> **History explains the contract. The current contract defines the product.**

## Status semantics

`Implementation-locked` means the active contract defines foundational security, state, recovery, packaging, protocol, provider, integration, operational/user-visible behavior, UI identity, adaptive layout, and release behavior tightly enough that implementation does not invent architecture or require ADR overlay interpretation.

`Production Complete` is different. It may be declared only for an implemented, signed release that passes every mandatory gate in `JARVIS-VERIFICATION-RELEASE-CONTRACT.md` and every mandatory qualification requirement in the active normative suite for the active Release Profile. Documentation alone can never satisfy that product status.
