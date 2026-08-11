# ADR-071 — Contract v1.0.3 Production Hardening and Release Closure

**Status:** Accepted  
**Date:** August 12, 2026  
**Decision scope:** Contract-version traceability, UI release integration, Codex Windows sandbox setup/repair lifecycle, KDF security floors, exact V1 integration capability matrices, brand-asset reproducibility, accessibility qualification, and repository release governance

---

## Context

A fresh review of the post-ADR-070 contract found no need to redesign the JARVIS architecture, but identified several production-readiness gaps in how accepted behavior was propagated and qualified:

1. ADR-070 made the UI identity/design system normative, but the Release Profile, Verification Contract, and Implementation Plan did not yet make UI identity/adaptive/accessibility qualification explicit central release gates.
2. Current Codex Windows sandbox architecture requires a first-class elevated setup path with dedicated sandbox users/firewall configuration before ordinary non-elevated worker execution; JARVIS had provider conformance but no complete setup/repair lifecycle.
3. Session-password and portable-recovery Argon2id requirements lacked a deterministic minimum production floor and versioned parameter metadata.
4. GitHub and Proxmox were mandatory V1 integration families, but the exact capability subset required to declare V1 `SUPPORTED` was not fully enumerated.
5. The approved brand had a canonical mark but no canonical lockup/app-icon source and no explicit third-party visual-asset provenance/licensing rule.
6. Material normative changes were still being made while the contract continued to call itself v1.0.2, weakening contract-version traceability even though Git commit identity remained available.
7. `master` is the sole authoritative branch but was not yet contractually required to be protected against destructive history changes once implementation work begins.

These are contract-hardening issues. They do not justify changing the fundamental Tauri/Rust → authenticated IPC → Node/TypeScript Core architecture.

---

## Decision

The current production contract is advanced to **JARVIS Contract Suite v1.0.3**.

The v1.0.3 suite SHALL incorporate these rules directly into the appropriate current normative documents. ADR-071 is rationale/history only and SHALL NOT be required as an implementation overlay.

### Contract-version traceability

- `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md` becomes the sole current top-level contract.
- The former v1.0.2 top-level contract is retained under `docs/history/` as non-normative provenance.
- The current contract manifest identifies the exact normative files and their document revisions.
- Material product/security/release-contract changes require a new contract-suite version. The Git source commit remains an additional immutable identity, not a replacement for semantic contract versioning.

### UI production gate

The approved JARVIS Mission Control identity is a V1 release requirement. Central release qualification SHALL include:

- canonical brand assets and design-token usage;
- dedicated window show/hide/windowed/maximized/fullscreen/focused-context behavior;
- adaptive layout across qualified viewport/DPI/multi-monitor cases;
- keyboard and assistive-technology primary workflows;
- Windows high-contrast/forced-colors compatibility where supported by the WebView stack;
- WCAG 2.2 AA-equivalent text/non-text contrast, target-size, focus, resize/reflow, reduced-motion, and non-color-only state behavior where applicable;
- dark-theme consistency and truthful operational state language.

### Codex Windows setup/repair lifecycle

Codex provider support SHALL model setup independently from compatibility and health.

The production adapter SHALL support states equivalent to:

```text
NOT_REQUIRED
SETUP_REQUIRED
SETUP_IN_PROGRESS
SETUP_READY
REPAIR_REQUIRED
SETUP_FAILED
```

For provider versions whose qualified Windows sandbox requires elevated setup:

- setup is an explicit user-visible provider-onboarding/repair action;
- UAC/elevation is confined to the qualified provider setup helper/path and SHALL NOT be inherited by ordinary Codex workers;
- JARVIS validates the helper/distribution identity according to the release-qualified provider package before invoking it;
- JARVIS SHALL NOT read, copy, or manage provider-internal sandbox-account passwords that the provider itself protects;
- setup/repair failure blocks the corresponding sandboxed engineering profile and never silently downgrades to an unqualified or less restrictive mode;
- provider update/version change invalidates cached setup/conformance when the qualified policy says setup semantics may have changed;
- `SUPPORTED` requires setup readiness plus compatibility, health/auth, capability, and conformance evidence.

### Argon2id production profiles

V1 SHALL use Argon2id version 0x13 for JARVIS-managed password/recovery KDF profiles.

The minimum production floor for both session-password verification and portable recovery-factor derivation is:

```text
algorithm: Argon2id
version:   0x13
memory:    >= 65536 KiB
passes:    >= 3
lanes:     4
salt:      >= 16 random bytes
output:    >= 32 bytes
```

These values correspond to the RFC 9106 memory-constrained recommended Argon2id profile. Release calibration MAY raise cost but SHALL NOT silently lower below the floor without a new reviewed security-contract revision.

Session and portable-recovery profiles are distinct, versioned records. Portable recovery SHOULD use materially higher memory cost on the qualified baseline when the interactive restore target remains practical. Stored verifier/key-slot metadata records the exact profile required to verify/derive older values so parameters can strengthen over time.

### V1 GitHub capability matrix

Mandatory V1 GitHub capability families are:

```text
GITHUB_REPOSITORY_READ
GITHUB_REF_READ
GITHUB_REF_WRITE
GITHUB_PULL_REQUEST_READ
GITHUB_PULL_REQUEST_WRITE
GITHUB_ISSUE_READ
GITHUB_COMMENT_WRITE
GITHUB_CHECKS_READ
GITHUB_ACTIONS_READ
```

`GITHUB_ACTIONS_DISPATCH` MAY be qualified and enabled but does not block V1 Production Complete.

Repository administration, Actions permission administration, secrets administration, branch-protection administration, member/team administration, and arbitrary repository deletion are not required V1 capabilities.

`GITHUB_REF_WRITE` covers typed create/update of allowed non-protected branch refs with expected-ref/conditional semantics. Ref deletion is not required by V1 and, if later supported, requires its own risk/action definition.

### V1 Proxmox capability matrix

Mandatory V1 Proxmox capabilities are:

```text
PROXMOX_READ
PROXMOX_POWER_CONTROL
PROXMOX_SNAPSHOT
PROXMOX_BACKUP
PROXMOX_GUEST_CONFIG
PROXMOX_GUEST_CREATE
PROXMOX_MIGRATE
PROXMOX_DESTROY
```

`PROXMOX_STORAGE_WRITE` and `PROXMOX_NETWORK_WRITE` remain modeled but are **not** required to declare V1 Production Complete. If a release enables either, that release must fully qualify it and include it in the signed support matrix.

`PROXMOX_GUEST_CREATE` may allocate guest disks on already-authorized existing storage as part of typed guest creation; it does not imply arbitrary datastore administration. `PROXMOX_GUEST_CONFIG` modifies only typed guest-level configuration within allowed schemas; it does not imply arbitrary host/network/storage configuration. `PROXMOX_BACKUP` starts/tracks guest backup work against allowed configured targets and does not imply direct PBS administration.

### Brand assets and licensing

Canonical production brand sources SHALL include at least:

```text
assets/brand/jarvis-mark.svg
assets/brand/jarvis-lockup.svg
assets/brand/jarvis-app-icon.svg
assets/brand/README.md
```

Generated raster/icon variants derive from these sources. UI code SHALL NOT redraw substitute marks.

Packaged fonts, icons, and third-party visual assets require recorded source/license/provenance and any required notices in release artifacts. The product SHALL not depend on a CDN to obtain its primary typeface.

### Repository protection before implementation

Before Phase 0 may be declared complete, the authoritative `master` branch SHALL have an active GitHub ruleset/branch-protection equivalent that at minimum:

- prevents branch deletion;
- blocks force pushes;
- requires the mandatory CI status checks before protected changes land, once those checks exist;
- keeps bypass permissions narrowly controlled and auditable.

A pull-request requirement is strongly preferred once implementation work begins. Repository rules SHALL not create a second long-lived authoritative branch.

---

## Consequences

### Positive

- The contract version now accurately identifies the post-UI, production-hardened specification.
- UI identity cannot be accidentally treated as optional polish at release time.
- Codex sandbox setup/UAC behavior is explicit and fail-closed rather than assumed.
- Password/recovery KDF strength has a deterministic floor and upgrade path.
- GitHub/Proxmox V1 completion has an exact capability definition.
- Brand implementation is reproducible from canonical assets.
- Accessibility includes current WCAG 2.2 AA-relevant desktop/WebView behavior.
- `master` gains production-grade history/CI protection without introducing another permanent source-of-truth branch.

### Costs

- Qualification must test additional UI/accessibility/provider-setup scenarios.
- Provider onboarding must handle explicit setup/repair state.
- KDF metadata and migration/upgrade logic become explicit schema responsibilities.
- Integration adapters must expose capability-specific conformance rather than a single generic `connected` flag.

These costs are justified because each closes a real production ambiguity or security/release-definition gap.

---

## Governing principle

> **A production contract is complete only when the release gate, implementation sequence, schemas, security rules, and product identity all describe the same system.**

> **Version the current truth; do not make implementers infer it from history.**
