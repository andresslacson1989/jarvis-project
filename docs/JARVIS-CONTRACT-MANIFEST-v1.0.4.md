# JARVIS Contract Manifest v1.0.4

**Suite Version:** 1.0.4  
**Status:** Canonical current contract manifest  
**Date:** August 12, 2026

---

# 1. PURPOSE

This manifest is the authoritative index of the current JARVIS contract suite. It pins which documents define current implementation behavior and prevents historical contracts/ADRs from becoming an implicit overlay.

This manifest contains no independent product behavior. If a rule is needed to implement JARVIS, that rule SHALL exist in one or more listed normative documents.

---

# 2. CURRENT NORMATIVE DOCUMENTS

The current suite is governed by `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.4.md`.

Component revisions are explicit; a suite-version change does not require rewriting a component whose normative content remains unchanged.

| # | Document | Current component revision | Role |
|---|---|---:|---|
| 1 | `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.4.md` | 1.0.4 | top-level product/architecture/security/production contract |
| 2 | `docs/JARVIS-V1-RELEASE-PROFILE.md` | 1.0.4 | exact Windows V1 production support target |
| 3 | `docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md` | 1.0.4 | Windows/Linux full-host portability and future companion boundary |
| 4 | `docs/implementation/JARVIS-RUNTIME-CONTRACT.md` | 1.0.3 | Windows V1 runtime specialization and process behavior |
| 5 | `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md` | 1.0.4 | canonical V1 protocol/domain/platform schemas |
| 6 | `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md` | 1.0.3 | Windows V1 persistence/state/recovery specialization |
| 7 | `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md` | 1.0.3 | Windows V1 security specialization and global security invariants |
| 8 | `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md` | 1.0.4 | coding/package/platform-boundary standards |
| 9 | `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md` | 1.0.3 | operational/user-visible/governance semantics |
| 10 | `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md` | 1.0.3 | unified Mission Control identity/adaptive design system |
| 11 | `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md` | 1.0.4 | release and portability-boundary evidence |
| 12 | `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` | 1.0.4 | implementation sequencing including platform boundary foundation |

`README.md` and `AGENTS.md` are contributor/governance entry points and SHALL point to this same suite.

## 2.1 Inherited 1.0.3 component headers

Several unchanged component revisions retain historical header text naming the v1.0.3 parent contract. Their inclusion in the current suite is governed by this manifest and the v1.0.4 top-level contract. Those historical header references do not make the superseded v1.0.3 top-level contract current and do not create an overlay.

The inherited components define the Windows V1 specialization unless their text is platform-neutral. The Platform Portability Contract defines how those Windows-specific mechanisms relate to future full-host platform backends.

---

# 3. CURRENT DECISION BOUNDARY

The suite incorporates the accepted current effects of ADRs through **ADR-072**.

ADR-072 introduces runtime-role/platform separation and the Windows/Linux portability boundary. Its effective rules are directly present in the v1.0.4 normative suite.

ADRs are rationale/history, not implementation overrides.

---

# 4. CURRENT PLATFORM BOUNDARY

```text
Windows → FULL_HOST → V1 production target
Linux   → FULL_HOST → future production target
Android → COMPANION → future non-V1 client
```

Only Windows is required by the current V1 Release Profile.

The architecture SHALL preserve Linux full-host portability through explicit platform capability boundaries without weakening the Windows implementation.

A future companion does not become authoritative and requires a separately qualified Remote Access Gateway before remote control is enabled.

---

# 5. HISTORICAL MATERIAL

Documents under `docs/history/` and supersession stubs for earlier top-level suite files are non-current provenance.

Historical contracts, reconciliation audits, obsolete manifests, deleted branch names, older examples, and earlier schema forms SHALL NOT override or fill gaps in the current suite.

If an implementer believes a required rule exists only in history/ADR text, that is a contract defect and implementation SHALL stop at the ambiguity until the current suite is corrected.

---

# 6. VERSIONING RULE

The suite version advances when a material current rule changes in areas such as:

- product/runtime role or intended platform architecture;
- product scope or required V1 capability;
- trust/security/privacy boundary;
- authentication/recovery/cryptography;
- protocol behavior that changes implementation obligations;
- persistence/recovery semantics;
- mandatory provider/integration support;
- production release gates;
- core UI identity/interaction behavior.

Individual component revisions advance only when that component's normative content changes. The manifest records the exact current component revision set.

Every production release records at least:

```text
contract_suite_version
contract_component_revisions
source_commit_sha
```

---

# 7. CURRENT BRAND SOURCES

Canonical JARVIS brand source assets remain:

- `assets/brand/jarvis-mark.svg`
- `assets/brand/jarvis-lockup.svg`
- `assets/brand/jarvis-app-icon.svg`
- `assets/brand/README.md`

Generated platform assets derive from these sources.

---

# 8. GOVERNING RULE

> **One suite version. One manifest. One current answer. Share product semantics; specialize native mechanisms.**

---

**END — JARVIS CONTRACT MANIFEST v1.0.4**
