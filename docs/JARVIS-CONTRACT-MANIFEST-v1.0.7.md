# JARVIS Contract Manifest v1.0.7

**Suite Version:** 1.0.7
**Status:** Canonical current contract manifest
**Date:** August 18, 2026

---

# 1. PURPOSE

This manifest is the authoritative index of the current JARVIS contract suite. It pins which documents define current implementation behavior and prevents historical contracts/ADRs from becoming an implicit overlay.

This manifest contains no independent product behavior. If a rule is needed to implement JARVIS, that rule SHALL exist in one or more listed normative documents.

---

# 2. CURRENT NORMATIVE DOCUMENTS

The current suite is governed by `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.7.md`.

Component revisions are explicit; a suite-version change does not require rewriting a component whose normative content remains unchanged.

| # | Document | Current component revision | Role |
|---|---|---:|---|
| 1 | `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.7.md` | 1.0.7 | top-level product/architecture/security/production contract |
| 2 | `docs/JARVIS-V1-RELEASE-PROFILE.md` | 1.0.7 | exact Windows V1 production support target |
| 3 | `docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md` | 1.0.4 | Windows/Linux full-host portability and future companion boundary |
| 4 | `docs/implementation/JARVIS-RUNTIME-CONTRACT.md` | 1.0.3 | Windows V1 runtime specialization and process behavior |
| 5 | `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md` | 1.0.4 | canonical V1 protocol/domain/platform schemas |
| 6 | `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md` | 1.0.3 | Windows V1 persistence/state/recovery specialization |
| 7 | `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md` | 1.0.3 | Windows V1 security specialization and global security invariants |
| 8 | `docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md` | 1.0.5 | exact backup format, AEAD/chunk/key-slot/recovery-factor semantics |
| 9 | `docs/implementation/JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md` | 1.0.5 | deterministic project-policy candidate/enrollment/change trust boundary |
| 10 | `docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md` | 1.0.5 | TUF-based update/module trust-root lifecycle, revocation and anti-rollback |
| 11 | `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md` | 1.0.6 | coding/package/platform-boundary standards |
| 12 | `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md` | 1.0.3 | operational/user-visible/governance semantics |
| 13 | `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md` | 1.0.3 | unified Mission Control identity/adaptive design system |
| 14 | `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md` | 1.0.6 | central release evidence plus all cumulative active-contract gates |
| 15 | `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md` | 1.0.7 | implementation sequencing including hosting-capability-aware repository governance and qualified CI authority equivalence |

`README.md` and `AGENTS.md` are contributor/governance entry points and SHALL point to this same suite.

## 2.1 Inherited component headers

Several unchanged component revisions retain historical header text naming their earlier parent suite. Their inclusion in the current suite is governed exclusively by this manifest and the v1.0.7 top-level contract. Those historical header references do not make superseded top-level contracts current and do not create an overlay.

The specialized security contracts remain cumulative specializations of compatible broad rules in the inherited Data/Security/Operations components. The v1.0.5 security closure remains fully active. Verification 1.0.6 contains the repository-governance capability closure introduced by ADR-074 and the CI-authority closure introduced by ADR-076. Implementation Plan 1.0.7, Release Profile 1.0.7, and Coding Standards 1.0.6 synchronize their active gates with those rules. These current component rules are part of one suite, not ADR overrides.

---

# 3. CURRENT DECISION BOUNDARY

The suite incorporates the accepted current effects of ADRs through **ADR-076**.

ADR-073 closes the backup cryptographic format/recovery-factor strength, project-policy trust admission, update/module trust-root lifecycle, early voice-feasibility sequencing, post-V1 integration release coupling, and repeated-contract-value drift risks.

ADR-074 makes repository-governance qualification hosting-capability-aware: server-side protection remains mandatory when the hosting plan exposes it, while an explicitly verified unavailable hosting capability may use auditable compensating integration controls without becoming a paid-plan prerequisite or being misrepresented as protected.

ADR-075 repairs the normative-suite synchronization omission left by ADR-074 by advancing only the Release Profile and Coding Standards component revisions and aligning their stale protected-`master` absolutes with the already-active capability-aware rule. ADR-076 then changes the current suite meaning by qualifying LocalCI as an equal alternative CI authority.

ADR-076 makes qualified GitHub Actions and qualified LocalCI equal alternative CI authorities. It replaces vendor identity as the source of authority with common exact-SHA, complete-pipeline, least-privilege, isolation, recovery, and durable-evidence requirements plus authority-specific qualification.

ADRs are rationale/history, not implementation overrides.

---

# 4. CURRENT SECURITY / GOVERNANCE CLOSURES

## 4.1 Portable backup

Production `JARVIS_BACKUP_V1` is no longer an algorithm-neutral envelope. The Backup Cryptography Contract fixes AES-256-GCM framing, nonce/AAD/chunk/order/truncation rules, key hierarchy, generated 256-bit recovery factor, optional stronger Argon2id passphrase slot, and exact restore/tamper qualification requirements.

## 4.2 Project policy

Repository `AGENTS.md` is an untrusted candidate until an authenticated user enrolls an exact canonical project/path/scope/content identity. Content change invalidates trust for new work; workers cannot silently rewrite and auto-trust their own policy.

## 4.3 Update/module trust

Production update/catalog metadata uses TUF 1.0.35 semantics with offline threshold root trust, role/delegation separation, expiry, rotation/revocation, rollback/freeze/mix-and-match protection, application `releaseSequence`/`securityEpoch`, and cumulative Tauri/Windows signing gates.

## 4.4 Authoritative repository governance

`master` remains the sole authoritative branch. Server-side branch protection/rulesets remain the preferred and required governance mode whenever the hosting provider/account exposes them for the authoritative repository. If that capability is unavailable because of a hosting plan/platform limitation, the active suite permits a truthful compensating-control mode with exact candidate CI, non-force/stale-tip-safe integration, post-integration verification, explicit audit evidence, and no claim of hard server-side protection. The exception ends when server-side protection becomes available.

## 4.5 Qualified CI authority

`GITHUB_ACTIONS` and `LOCALCI` are equal eligible authority types after qualification. Either may independently provide the complete mandatory exact-SHA result. The selected authority and instance/pipeline identity are machine-readable and auditable; a demo, stale, unknown, or materially changed LocalCI instance is not authoritative without qualification.

---

# 5. CURRENT PLATFORM BOUNDARY

```text
Windows → FULL_HOST → V1 production target
Linux   → FULL_HOST → future production target
Android → COMPANION → future non-V1 client
```

Only Windows is required by the current V1 Release Profile.

The architecture SHALL preserve Linux full-host portability through explicit platform capability boundaries without weakening the Windows implementation.

A future companion does not become authoritative and requires a separately qualified Remote Access Gateway before remote control is enabled.

---

# 6. DELIVERY / ROADMAP CLOSURES

Voice remains mandatory V1, but candidate STT/VAD/TTS/AEC/barge-in/device/resource/licensing feasibility is tested immediately after the early persistence/recovery proof rather than waiting until the late voice implementation phases.

SSH, Google Workspace, Microsoft 365, and Cloudflare remain binding post-V1 product targets but may ship independently in production-qualified feature releases; they are no longer artificially coupled into one first feature-bearing release.

Phase 0 SHALL establish machine-readable canonical repeated security/profile/capability values and CI drift checks where practical.

Repository server-side protection SHALL be activated when available, but an unavailable paid/host-gated protection feature is not itself a JARVIS production prerequisite when the v1.0.7 compensating-governance qualification passes.

---

# 7. HISTORICAL MATERIAL

Documents under `docs/history/` and supersession stubs for earlier top-level suite files are non-current provenance.

Historical contracts, reconciliation audits, obsolete manifests, deleted branch names, older examples, and earlier schema forms SHALL NOT override or fill gaps in the current suite.

If an implementer believes a required rule exists only in history/ADR text, that is a contract defect and implementation SHALL stop at the ambiguity until the current suite is corrected.

---

# 8. VERSIONING RULE

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

Individual component revisions advance only when that component's normative content changes. The manifest records the exact current component revision set.

Every production release records at least:

```text
contract_suite_version
contract_component_revisions
source_commit_sha
```

---

# 9. CURRENT BRAND SOURCES

Canonical JARVIS brand source assets remain:

- `assets/brand/jarvis-mark.svg`
- `assets/brand/jarvis-lockup.svg`
- `assets/brand/jarvis-app-icon.svg`
- `assets/brand/README.md`

Generated platform assets derive from these sources.

---

# 10. GOVERNING RULE

> **One suite version. One manifest. One current answer. Share product semantics; specialize native mechanisms; freeze security formats that must survive failure and time.**

---

**END — JARVIS CONTRACT MANIFEST v1.0.7**
