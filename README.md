# JARVIS Project

JARVIS is a Windows-first, voice-capable AI operating companion built around deterministic authorization, bounded AI workers, durable mission orchestration, replaceable providers, secure integrations, verified execution, tested recovery, and one unified adaptive product identity.

## Branch authority

**`master` is the only authoritative and latest repository branch.**

Temporary feature/review branches MAY exist while work is in progress, but they SHALL start from the current live `master` and SHALL NOT become parallel implementation sources of truth. After accepted work is incorporated into `master`, the temporary branch is historical/disposable and must not be used as the base for new work.

Before Phase 0 implementation is considered complete, `master` must have production-grade repository protection that blocks force pushes/deletion and requires designated CI checks, with narrowly controlled/auditable bypass.

## Current implementation source of truth

**There is one current contract suite: JARVIS v1.0.3.**

Start with [`docs/JARVIS-CONTRACT-MANIFEST-v1.0.3.md`](docs/JARVIS-CONTRACT-MANIFEST-v1.0.3.md). It is the authoritative index of the current suite.

Read the active suite in this order:

1. [`docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`](docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md) — canonical product, architecture, security, operations, and production contract.
2. [`docs/JARVIS-V1-RELEASE-PROFILE.md`](docs/JARVIS-V1-RELEASE-PROFILE.md) — exact V1 production support/capability/release target.
3. [`docs/implementation/JARVIS-RUNTIME-CONTRACT.md`](docs/implementation/JARVIS-RUNTIME-CONTRACT.md) — process topology, application-owned Core, secure IPC, provider setup/repair, worker/provider supervision, scheduling, cancellation, and recovery.
4. [`docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`](docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md) — canonical protocol/domain/KDF/provider/integration schemas and exact cross-language representations.
5. [`docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`](docs/implementation/JARVIS-DATA-STATE-CONTRACT.md) — SQLite/SQLCipher state, KDF metadata, state machines, events, budgets, backups, restore, and migrations.
6. [`docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`](docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md) — threat model, KDF floor, session trust, permission precedence, IPC/WebView/worker/provider-setup/tool/module/integration security, and recovery-key rules.
7. [`docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`](docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md) — normative coding, package-boundary, validation, Rust/TypeScript, cryptography, database, provider setup, integration, UI, testing, and CI rules.
8. [`docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`](docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md) — queue/dashboard truth, provider setup/recovery visibility, event/notification/focus behavior, configuration/import safety, memory retrieval, module/integration UX, voice identity/responsiveness, diagnostics/audit behavior, vulnerability policy, and architecture decision escalation.
9. [`docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`](docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md) — canonical JARVIS brand identity, dark-theme visual system, Mission Control shell, adaptive/reflow behavior, dedicated-window behavior, component language, accessibility, brand provenance, and UI qualification.
10. [`docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`](docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md) — Definition of Done, UI/accessibility, KDF/provider-setup, exact integration-capability, adversarial, recovery, performance, voice, packaging, and release gates.
11. [`docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`](docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md) — ordered implementation and exit criteria. It does not authorize implementation to begin by itself.

Canonical vector brand assets live under [`assets/brand/`](assets/brand/). UI code SHALL consume the canonical mark/lockup/app-icon sources and centralized design system rather than recreate unrelated variants per screen.

Root [`AGENTS.md`](AGENTS.md) gives contributor instructions. [`docs/JARVIS-CONTRACT-LINEAGE.md`](docs/JARVIS-CONTRACT-LINEAGE.md) explains historical contract evolution.

## No overlay interpretation

Accepted ADRs under `docs/decisions/` and `docs/adr/` preserve decision history and rationale. **They are not a second implementation layer.** Their still-valid effects are incorporated into the v1.0.3 suite.

A future architectural/product/security/release ADR is incomplete until the same change also updates every affected active normative document and the current contract manifest. Implementation SHALL NOT rely on a new ADR while contradictory or incomplete canonical wording remains.

If an ADR/history file and an active v1.0.3 normative document appear to conflict, the current normative suite governs current behavior; however, a suspected missing still-valid requirement is treated as a contract defect and corrected in the current suite rather than silently inferred from history.

## Key production closures in v1.0.3

v1.0.3 closes the final pre-implementation gaps identified after UI adoption:

- UI identity/adaptive/accessibility is an explicit central V1 release gate;
- Codex Windows sandbox setup/repair/UAC lifecycle is modeled and fail-closed;
- JARVIS-managed Argon2id session/recovery profiles have a deterministic production floor and upgradeable versioned metadata;
- mandatory V1 GitHub and Proxmox capability matrices are exact rather than vague integration-family labels;
- canonical mark/lockup/app-icon sources and visual-asset license/provenance rules are defined;
- contract-suite semantic versioning and a manifest prevent material changes from hiding behind one old version number;
- protected-`master`/CI governance is a Phase 0 requirement before implementation is considered properly established.

## Historical material

Earlier top-level contracts and previous reconciliation reports are retained under [`docs/history/`](docs/history/) for provenance only. They are not current implementation instructions.

Former `codex/contract-*` review branches were deleted after their valid work was reconciled into `master`.

## Governing principles

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

> **Escalate product judgment. Resolve engineering judgment.**

> **One system. One identity. Any screen.**

> **Build the control plane first, prove recoverability early, then give intelligence access to it.**

> **Version the current truth; do not make implementers infer it from history.**

## Status semantics

`Implementation-locked` means the active contract defines foundational security, state, recovery, packaging, protocol, provider setup/qualification, exact V1 integration capability support, operational/user-visible behavior, UI identity/accessibility, and release behavior tightly enough that implementation does not invent architecture or require ADR overlay interpretation.

`Production Complete` is different. It may be declared only for an implemented, signed release that passes every mandatory gate in `JARVIS-VERIFICATION-RELEASE-CONTRACT.md` and every mandatory qualification requirement in the active normative suite for the active Release Profile. Documentation alone can never satisfy that product status.
