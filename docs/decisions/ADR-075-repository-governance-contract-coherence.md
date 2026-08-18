# ADR-075: Repository Governance Contract Coherence Repair

**Status:** Accepted  
**Date:** August 18, 2026  
**Decision owner:** Project governance / explicit user authorization  
**Contract suite:** JARVIS v1.0.6

---

# 1. CONTEXT

ADR-074 established hosting-capability-aware repository governance for JARVIS v1.0.6. The top-level Implementation Contract, Verification & Release Contract, Implementation Plan, manifest, governance tooling, and Phase 0 evidence were synchronized to that decision.

Two active normative components were not synchronized completely:

- `docs/JARVIS-V1-RELEASE-PROFILE.md` §17 still required server-side branch protection unconditionally before Phase 0 completion;
- `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md` §28 and its related architecture-enforcement invariant still assumed protected `master` unconditionally.

Those clauses conflicted with the already-active v1.0.6 rule that permits explicit compensating controls only when server-side protection is verified unavailable because of a hosting plan/platform capability limitation.

The current top-level contract requires implementation to stop when current normative components conflict. The inconsistency therefore had to be repaired before further controlled integration.

---

# 2. DECISION

No new repository-governance semantic is introduced by this ADR.

The current JARVIS v1.0.6 repository-governance rule remains:

1. Server-side branch protection or repository rulesets are mandatory whenever the authoritative hosting provider/account makes the required capability available.
2. When that capability is verified unavailable because of a hosting plan/platform limitation, `COMPENSATING_CONTROLS` may satisfy the gate only with all required safeguards, including:
   - temporary implementation branches for normal implementation work;
   - mandatory CI on the exact candidate commit;
   - immediate validation of the live authoritative `master` tip before integration;
   - reconciliation rather than overwrite when that tip moves unexpectedly;
   - non-force integration;
   - post-integration verification of the resulting authoritative tip, intended diff/ancestry, required CI, and audit/evidence state;
   - truthful reporting that `master` is not server-protected and that an out-of-band administrator force push/deletion remains a residual risk.
3. `COMPENSATING_CONTROLS` must not be selected when effective server-side protection is available.
4. If the hosting provider/account later exposes the required protection capability, server-enforced governance becomes mandatory.

The synchronous contract repair is:

- Release Profile component revision `1.0.5` → `1.0.6`;
- Coding Standards component revision `1.0.4` → `1.0.5`;
- the v1.0.6 manifest and canonical/generated contract-value artifacts are synchronized to those component revisions;
- regression coverage is added so the Release Profile and Coding Standards repository-governance clauses cannot drift back to unconditional protected-`master` semantics.

The contract suite remains **JARVIS v1.0.6** because this repair does not change material current behavior. It makes two previously stale components express the repository-governance rule that v1.0.6 had already adopted. Component revision changes identify the repaired current component set.

---

# 3. CONSEQUENCES

- The active normative suite again has one current repository-governance answer.
- The repair does not weaken mandatory CI, integration safety, auditability, or the preference/requirement for server-side enforcement when available.
- The repair does not represent an unprotected branch as protected.
- The repair does not automatically qualify PR #7 or any other implementation candidate. Exact-candidate qualification, live-tip revalidation, non-force integration, and post-integration verification remain mandatory.
- ADR-074 remains historical rationale and is not rewritten to conceal the synchronization omission.
- Any future material change to repository-governance qualification still requires a contract-suite version advance under the manifest/top-level versioning rules.

---

# 4. REJECTED ALTERNATIVES

## 4.1 Ignore the stale clauses

Rejected because the active top-level contract requires current normative conflicts to stop implementation rather than be silently resolved by implementer preference.

## 4.2 Treat ADR-074 as an override

Rejected because ADRs are rationale/history, not implementation overrides for inconsistent current normative text.

## 4.3 Weaken CI or integration safeguards

Rejected because the hosting-capability exception is not permission to reduce qualification strength. The compensating controls are cumulative requirements.

## 4.4 Claim `master` is protected while using compensating controls

Rejected because truthful repository-state reporting is a mandatory part of the active rule.

## 4.5 Rewrite ADR-074 in place

Rejected because historical decisions should remain auditable. This ADR records the correction explicitly.

## 4.6 Advance the suite as though a new governance rule were adopted

Rejected because the material current repository-governance semantic remains the v1.0.6 rule. Advancing only the changed component revisions accurately records a synchronization repair without inventing a new product decision.

---

# 5. GOVERNING DISTINCTION

> **Repairing a stale component so it says what the current suite already requires is a coherence repair. Changing what the suite requires is a new semantic decision.**

---

**END — ADR-075**