# JARVIS Contract Manifest v1.0.3

**Suite Version:** 1.0.3  
**Status:** Canonical current contract manifest  
**Date:** August 12, 2026

---

# 1. PURPOSE

This manifest is the authoritative index of the current JARVIS contract suite. It pins which documents define current implementation behavior and prevents historical contracts/ADRs from becoming an implicit overlay.

This manifest contains no independent product behavior. If a rule is needed to implement JARVIS, that rule SHALL exist in one or more listed normative documents.

---

# 2. CURRENT NORMATIVE DOCUMENTS

All current documents below are **revision 1.0.3** and are governed by `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`.

1. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`
2. `docs/JARVIS-V1-RELEASE-PROFILE.md`
3. `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
4. `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`
5. `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
6. `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
7. `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`
8. `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`
9. `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`
10. `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`
11. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`

`README.md` and `AGENTS.md` are contributor/governance entry points and SHALL point to this same suite.

---

# 3. CURRENT DECISION BOUNDARY

The suite incorporates the accepted current effects of ADRs through **ADR-071**.

ADRs are rationale/history. They are not implementation overrides. A future ADR is incomplete until every affected normative document and this manifest are updated synchronously.

---

# 4. HISTORICAL MATERIAL

Documents under `docs/history/` are non-normative provenance.

Historical contracts, reconciliation audits, deleted branch names, obsolete examples, and earlier schema forms SHALL NOT be used to override or fill gaps in the current suite.

If an implementer believes a required rule exists only in history/ADR text, that is a contract defect and implementation SHALL stop at the ambiguity until the current suite is corrected.

---

# 5. VERSIONING RULE

The suite version advances when a material current rule changes in areas such as:

- product scope or required V1 capability;
- trust/security/privacy boundary;
- authentication/recovery/cryptography;
- protocol behavior that changes implementation obligations;
- persistence/recovery semantics;
- mandatory provider/integration support;
- production release gates;
- core UI identity/interaction behavior.

Editorial changes that do not alter behavior MAY retain the suite version when clearly identified as non-semantic.

Every production release records both:

```text
contract_suite_version
source_commit_sha
```

The semantic suite version explains what contract applies; the source SHA identifies the exact repository state.

---

# 6. CURRENT BRAND SOURCES

Canonical JARVIS brand source assets are:

- `assets/brand/jarvis-mark.svg`
- `assets/brand/jarvis-lockup.svg`
- `assets/brand/jarvis-app-icon.svg`
- `assets/brand/README.md`

Generated platform assets derive from these sources.

---

# 7. GOVERNING RULE

> **One suite version. One manifest. One current answer. History explains why; current normative documents define what to build.**

---

**END — JARVIS CONTRACT MANIFEST v1.0.3**
