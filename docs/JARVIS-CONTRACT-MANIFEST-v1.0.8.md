# JARVIS Contract Manifest v1.0.8

**Suite Version:** 1.0.8
**Status:** Canonical current contract manifest
**Date:** September 14, 2026

---

# MAN-01 — PURPOSE

This manifest is the authoritative index of the current JARVIS contract suite. It pins the six cohesive normative components and the separate V1 Release Profile so historical material cannot become an implicit overlay.

This manifest contains no independent product behavior. If a rule is needed to implement JARVIS, that rule SHALL exist in one or more listed normative components or in the separate Release Profile when it defines the exact supported product target.

---

# MAN-02 — CURRENT NORMATIVE DOCUMENTS

The current suite is governed by the six consolidated components below plus `docs/JARVIS-V1-RELEASE-PROFILE.md`.

| # | Document | Component | Current revision | Role |
|---|---|---|---:|---|
| 1 | `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` | `J00` | 1.0.9 | product scope, authority, repository governance, and coding standards |
| 2 | `docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md` | `J01` | 1.0.9 | runtime roles, platform boundaries, process lifecycle, IPC, and schemas |
| 3 | `docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md` | `J02` | 1.0.9 | persistence, state, exact values, backup format, restore, and recovery |
| 4 | `docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md` | `J03` | 1.0.9 | security hardening, project-policy trust, and supply-chain trust |
| 5 | `docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md` | `J04` | 1.0.9 | operations, integrations, voice, UX, identity, and accessibility |
| 6 | `docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md` | `J05` | 1.0.9 | verification, qualification, release evidence, and Production Complete |
| 7 | `docs/JARVIS-V1-RELEASE-PROFILE.md` | `RELEASE_PROFILE` | 1.0.9 | exact Windows V1 production support target |

`README.md` and `AGENTS.md` are contributor/governance entry points and SHALL point to this same suite. The implementation plan, execution matrix, developer execution goal, evidence records, and audit reports are non-authoritative execution aids.

---

# MAN-03 — SINGLE AUTHORITY AND AMENDMENT BOUNDARY

Every current normative rule has one canonical home in the six components, this manifest, or the Release Profile. Cross-component references use the stable clause identifiers defined by `J00` through `J05`; they SHALL NOT cite, retain, or consult ADR/decision-record material as authority.

The current components preserve the complete existing product, security, platform, protocol, state, recovery, integration, UX, verification, and release requirements. Consolidation changes document ownership and traceability, not behavior.

A future material product, architecture, security, platform, release, trust, or governance amendment SHALL be made directly in the affected active clauses under the owner/governance amendment process. The same reviewed change SHALL update affected components, this manifest, the Release Profile when applicable, verification requirements, implementation sequencing, compatibility/migration/rollback notes, and required tests/evidence before implementation depends on the amendment. ADR/decision-record files SHALL NOT be created, retained, cited, or used as current or historical authority.

If active normative text conflicts or omits a mandatory requirement, implementation SHALL stop at that ambiguity until the active suite is reconciled. Later documents, branches, reports, or historical material cannot silently override it.

---

# MAN-04 — CURRENT OWNERSHIP AND DEPENDENCIES

The manifest indexes authority; it does not restate component behavior. The following clauses are the complete current owners of the named areas.

| Area | Complete current owner |
| --- | --- |
| product scope, repository governance, coding, dependencies, and canonical drift definitions | J00-SCOPE-01 through J00-CODE-33, especially J00-GOV-28 and J00-GOV-29 |
| platform roles, capability boundaries, runtime, protocol, provider, and voice interfaces | J01-PLAT-01 through J01-PROTO-28 |
| persistence, state, transactions, recovery, `JARVIS_BACKUP_V1`, and restore | J02-DATA-01 through J02-BACKUP-17 |
| authorization, secrets, project-policy trust, supply-chain trust, TUF, update, and module security | J03-SEC-01 through J03-SUPPLY-19 |
| operations, integrations, voice/UI behavior, identity, and accessibility | J04-OPS-01 through J04-UI-29 |
| tests, evidence, CI qualification, release decisions, and Production Complete | J05-VER-01 through J05-VER-39 |
| exact V1 platform, capability, provider, integration, voice, hardware, and release selections | RP-01 through RP-19 |

---

# MAN-05 — CURRENT PLATFORM BOUNDARY

RP-02 selects Windows `FULL_HOST` as the V1 production target. J01-PLAT-02 through J01-PLAT-26 own runtime roles, capability boundaries, future Linux qualification, and the non-authoritative companion boundary. J01-PLAT-08 requires portability never weaken qualified Windows security.

---

# MAN-06 — DELIVERY AND ROADMAP DEPENDENCIES

RP-11 selects mandatory V1 voice and its early feasibility evidence. RP-14 owns binding post-V1 integration targets. J00-GOV-28 owns canonical repeated-value drift definitions and repository-protection fallback; J05-VER-33 owns its qualification evidence.

---

# MAN-07 — HISTORICAL MATERIAL

Historical contracts, superseded manifests, reconciliation audits, deleted branch names, older examples, and earlier schema forms are non-current provenance. They SHALL NOT override, fill gaps in, or be consulted as authority for this suite.

ADR/decision-record files and citations are prohibited. If a required rule is absent from the active suite, that is a contract defect and implementation SHALL stop until the requirement is restored directly into the active suite.

---

# MAN-08 — VERSIONING RULE

The suite version advances when a material current rule changes in areas such as:

- product/runtime role or intended platform architecture;
- product scope or required V1 capability;
- trust/security/privacy boundary;
- authentication/recovery/cryptography or backup-format semantics;
- trusted project-policy admission;
- update/module trust-root lifecycle;
- protocol behavior that changes implementation obligations;
- persistence/recovery semantics;
- mandatory provider/integration support;
- production release gates;
- repository-governance qualification;
- core UI identity/interaction behavior.

Individual component revisions advance when the corresponding component's normative content changes. The manifest records the exact current component revision set. The current J00–J05 and Release Profile revisions advance to 1.0.9 for this lossless normative-text simplification; the combined suite remains 1.0.8 because no material current product, security, platform, protocol, release, trust, or governance rule changed.

This v1.0.8 suite advances v1.0.7 because mandatory CI authority changed from a qualified-authority alternative to GitHub Actions only. That is a material repository-governance qualification change; this consolidation does not weaken any other active requirement.

Every production release records at least:

```text
contract_suite_version
contract_component_revisions
source_commit_sha
```

---

# MAN-09 — CURRENT BRAND SOURCES

Canonical JARVIS brand source assets remain:

- `assets/brand/jarvis-mark.svg`
- `assets/brand/jarvis-lockup.svg`
- `assets/brand/jarvis-app-icon.svg`
- `assets/brand/README.md`

Generated platform assets derive from these sources.

---

# MAN-10 — GOVERNING RULE

> **One suite version. One manifest. Six cohesive normative components. One current answer. Share product semantics; specialize native mechanisms; freeze security formats that must survive failure and time.**

---

**END — JARVIS CONTRACT MANIFEST v1.0.8**
