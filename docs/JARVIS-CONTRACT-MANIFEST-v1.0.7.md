# JARVIS Contract Manifest v1.0.7

**Suite Version:** 1.0.7
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
| 1 | `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` | `J00` | 1.0.7 | product scope, authority, repository governance, and coding standards |
| 2 | `docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md` | `J01` | 1.0.7 | runtime roles, platform boundaries, process lifecycle, IPC, and schemas |
| 3 | `docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md` | `J02` | 1.0.7 | persistence, state, exact values, backup format, restore, and recovery |
| 4 | `docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md` | `J03` | 1.0.7 | security hardening, project-policy trust, and supply-chain trust |
| 5 | `docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md` | `J04` | 1.0.7 | operations, integrations, voice, UX, identity, and accessibility |
| 6 | `docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md` | `J05` | 1.0.7 | verification, qualification, release evidence, and Production Complete |
| 7 | `docs/JARVIS-V1-RELEASE-PROFILE.md` | `RELEASE_PROFILE` | 1.0.7 | exact Windows V1 production support target |

`README.md` and `AGENTS.md` are contributor/governance entry points and SHALL point to this same suite. The implementation plan, execution matrix, developer execution goal, evidence records, and audit reports are non-authoritative execution aids.

---

# MAN-03 — SINGLE AUTHORITY AND AMENDMENT BOUNDARY

Every current normative rule has one canonical home in the six components, this manifest, or the Release Profile. Cross-component references use the stable clause identifiers defined by `J00` through `J05`; they do not rely on historical filenames or external decision records.

The current components preserve the complete existing product, security, platform, protocol, state, recovery, integration, UX, verification, and release requirements. Consolidation changes document ownership and traceability, not behavior.

A future material product, architecture, security, platform, release, trust, or governance amendment SHALL be made directly in the affected active clauses under the owner/governance amendment process. The same reviewed change SHALL update affected components, this manifest, the Release Profile when applicable, verification requirements, implementation sequencing, compatibility/migration/rollback notes, and required tests/evidence before implementation depends on the amendment. A separate decision record is neither required nor authoritative.

If active normative text conflicts or omits a mandatory requirement, implementation SHALL stop at that ambiguity until the active suite is reconciled. Later documents, branches, reports, or historical material cannot silently override it.

---

# MAN-04 — CURRENT SECURITY AND GOVERNANCE CLOSURES

## 4.1 Portable backup

Production `JARVIS_BACKUP_V1` is fixed by `J02`: AES-256-GCM framing, nonce/AAD/chunk/order/truncation rules, independent key hierarchy, generated 256-bit recovery factor, optional stronger Argon2id passphrase slot, and exact restore/tamper qualification requirements.

## 4.2 Project policy

Repository `AGENTS.md` is an untrusted candidate until an authenticated user enrolls an exact canonical project/path/scope/content identity. Content change invalidates trust for new work; workers cannot silently rewrite and auto-trust their own policy.

## 4.3 Update and module trust

Production update/catalog metadata uses the fixed TUF 1.0.35 profile in `J03`, including threshold root trust, role/delegation separation, expiry, rotation/revocation, rollback/freeze/mix-and-match protection, application `releaseSequence`/`securityEpoch`, and cumulative Tauri/Windows signing gates.

## 4.4 Authoritative repository governance

`master` remains the sole authoritative branch. Server-side branch protection/rulesets remain required whenever the hosting provider/account exposes them. If the capability is unavailable because of a verified hosting limitation, `J00` and `J05` permit a truthful compensating-control mode with exact candidate CI, non-force/stale-tip-safe integration, post-integration verification, explicit evidence, and no claim of hard server-side protection. The exception ends when server-side protection becomes available.

## 4.5 Qualified CI authority

`GITHUB_ACTIONS` and `LOCALCI` are equal eligible authority types after qualification. Either may independently provide the complete mandatory exact-SHA result. The selected authority and instance/pipeline identity are machine-readable and auditable; an unknown, stale, demo, or materially changed LocalCI instance is not authoritative without qualification.

---

# MAN-05 — CURRENT PLATFORM BOUNDARY

```text
Windows → FULL_HOST → V1 production target
Linux   → FULL_HOST → future production target
Android → COMPANION → future non-V1 client
```

Only Windows is required by the current V1 Release Profile.

The architecture SHALL preserve Linux full-host portability through explicit platform capability boundaries without weakening the Windows implementation.

A future companion does not become authoritative and requires a separately qualified Remote Access Gateway before remote control is enabled.

---

# MAN-06 — DELIVERY AND ROADMAP CLOSURES

Voice remains mandatory V1, but candidate STT/VAD/TTS/AEC/barge-in/device/resource/licensing feasibility is tested immediately after the early persistence/recovery proof rather than waiting until the late voice implementation phases.

SSH, Google Workspace, Microsoft 365, and Cloudflare remain binding post-V1 product targets but may ship independently in production-qualified feature releases.

Phase 0 SHALL establish machine-readable canonical repeated security/profile/capability values and CI drift checks where practical.

Repository server-side protection SHALL be activated when available, but an unavailable paid/host-gated protection feature is not itself a JARVIS production prerequisite when the compensating-governance qualification passes.

---

# MAN-07 — HISTORICAL MATERIAL

Historical contracts, superseded manifests, reconciliation audits, deleted branch names, older examples, and earlier schema forms are non-current provenance. They SHALL NOT override or fill gaps in this suite.

The repository does not retain historical decision records as implementation sources. If a required rule appears to exist only in removed or historical material, that is a contract defect and implementation SHALL stop until the requirement is restored directly into the active suite.

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

Individual component revisions advance when the corresponding component's normative content changes. The manifest records the exact current component revision set.

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

**END — JARVIS CONTRACT MANIFEST v1.0.7**
