# JARVIS Project

JARVIS is a Windows-first, voice-capable AI operating companion built around deterministic authorization, bounded AI workers, durable mission orchestration, replaceable providers, secure integrations, verified execution, and tested recovery.

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
8. [`docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`](docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md) — Definition of Done, conformance, adversarial, recovery, performance, voice, packaging, and release gates.
9. [`docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`](docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md) — ordered implementation and exit criteria.

Root [`AGENTS.md`](AGENTS.md) gives contributor instructions. [`docs/JARVIS-CONTRACT-LINEAGE.md`](docs/JARVIS-CONTRACT-LINEAGE.md) explains how prior branches/ADRs were reconciled.

## No overlay interpretation

Accepted ADRs under `docs/decisions/` and `docs/adr/` preserve decision history and rationale. **They are not a second implementation layer.** Their still-valid effects are incorporated into the v1.0.2 suite.

A future architectural ADR is incomplete until the same change also updates every affected active normative document. Implementation SHALL NOT rely on a new ADR while contradictory canonical wording remains.

If an ADR and an active v1.0.2 normative document appear to conflict, stop and correct the canonical contract; do not choose an interpretation silently.

## Historical material

Earlier top-level contracts are retained under [`docs/history/`](docs/history/) for provenance only. They are not current implementation instructions.

The divergent branch `codex/contract-implementation-lock` is historical/non-authoritative. Useful work from it was incorporated into v1.0.2, but its colliding ADR-054/055/056 identifiers are **not** part of the canonical ADR lineage.

## Governing principles

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

> **Build the control plane first, prove recoverability early, then give intelligence access to it.**

> **History explains the contract. The current contract defines the product.**

## Status semantics

`Implementation-locked` means the active contract defines foundational security, state, recovery, packaging, protocol, provider, integration, and release behavior tightly enough that implementation does not invent architecture ad hoc.

`Production Complete` is different. It may be declared only for an implemented, signed release that passes every mandatory gate in `JARVIS-VERIFICATION-RELEASE-CONTRACT.md` for the active Release Profile. Documentation alone can never satisfy that product status.
