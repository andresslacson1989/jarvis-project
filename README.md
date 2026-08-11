# JARVIS Project

JARVIS is a Windows-first, voice-capable AI operating companion built around deterministic authorization, bounded AI workers, durable mission orchestration, replaceable providers, secure integrations, and verified execution.

## Canonical implementation contract

Implementation SHALL follow the v1.0 production contract suite:

1. [`docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.md`](docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.md) — top-level product, architecture, and implementation contract.
2. [`docs/implementation/JARVIS-RUNTIME-CONTRACT.md`](docs/implementation/JARVIS-RUNTIME-CONTRACT.md) — process topology, IPC, worker/provider runtime, scheduling, pause/resume, recovery.
3. [`docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`](docs/implementation/JARVIS-DATA-STATE-CONTRACT.md) — SQLite schema domains, state machines, graph versions, checkpoints, events, backups, restore, migrations.
4. [`docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`](docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md) — session trust, credential protection, prompt-injection boundary, worker/tool security, supply-chain hardening.
5. [`docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`](docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md) — Definition of Done, failure/recovery testing, security gates, performance/voice qualification, release acceptance.
6. [`docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`](docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md) — canonical versioned cross-process/domain schemas and compatibility rules.
7. [`docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`](docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md) — ordered build plan from control-plane foundation through Production Complete qualification.

`docs/JARVIS-TECHNICAL-CONTRACT.md` is preserved as the original architecture baseline. Where the v1.0 suite is more specific, v1.0 governs implementation.

Accepted ADRs under `docs/decisions/` and `docs/adr/` preserve the architectural decision history.

## Governing principles

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

> **Build the control plane first, then give intelligence access to it.**

> **Build JARVIS so the finished system is useful on the good day, controlled on the dangerous day, and recoverable on the bad day.**
