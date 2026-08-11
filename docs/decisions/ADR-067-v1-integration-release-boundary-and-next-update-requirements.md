# ADR-067 — V1 Integration Release Boundary and Immediate Next-Update Requirements

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Product/release scope and integration qualification  
**Scope:** JARVIS v1.0 Production Complete and the first feature-bearing post-V1 release

## Context

JARVIS has a broad integration catalog, including local filesystem/Git, GitHub, AI providers, Proxmox VE, SSH, Google Workspace, Microsoft 365, Cloudflare, and future integrations.

A production release must distinguish between:

- integrations that are mandatory for the V1 product to be considered Production Complete;
- integrations that remain part of the binding product contract but are not V1 release blockers; and
- integrations that are explicitly required for the first feature-bearing release after V1.

Without this distinction, V1 can become indefinitely blocked by the independent authentication, API, tenant-policy, failure-mode, and upgrade complexity of every third-party ecosystem in the catalog.

At the same time, deferring an integration from V1 must not silently demote it to an optional or indefinite backlog item when the product direction requires it immediately afterward.

This ADR therefore fixes the V1 integration release boundary while preserving SSH, Google Workspace, Microsoft 365, and Cloudflare as binding near-term requirements.

---

## Decision

### V1 mandatory integration set

JARVIS V1 SHALL NOT be declared **Production Complete** until all of the following integration families are implemented and production-qualified:

1. **Local filesystem + Git**
2. **GitHub**
3. **Codex/OpenAI provider integration**
4. **Proxmox VE**

Each mandatory integration SHALL satisfy the applicable security, protocol, credential, failure/recovery, upgrade, and release-conformance requirements of the canonical contract suite and accepted ADRs.

Merely detecting an executable, having an API endpoint, or proving a happy-path request SHALL NOT satisfy Production Complete qualification.

---

## 1. Local filesystem + Git

The V1 local project integration SHALL provide production-qualified support for the project/workspace model required by the runtime contract, including:

- explicit registered project roots;
- canonical Windows path resolution;
- containment against traversal, junction, symlink, UNC, drive-root, and wildcard scope escape;
- repository discovery and identity;
- read operations;
- bounded write operations through the normal Tool/Permission/Authority pipeline;
- branch/worktree awareness;
- isolated writable worktrees/branches for parallel writers;
- deterministic status/diff/verification evidence;
- cancellation and crash-recovery semantics;
- no implicit repository switching;
- no unrestricted renderer filesystem authority.

Local filesystem/Git support SHALL be considered a first-class V1 integration even though it does not require an external SaaS account.

---

## 2. GitHub

GitHub SHALL be a mandatory V1 production integration.

The implementation SHALL use scoped authenticated API operations rather than treating arbitrary `git` remote shell behavior as a substitute for the GitHub integration contract.

The GitHub integration SHALL include the subset required by JARVIS software-engineering workflows and SHALL be capability-scoped.

Representative V1 capabilities MAY include:

```text
repository metadata/read
branch/ref inspection
commit/file inspection
issue read/write where enabled
pull-request read/create/update where enabled
review/comment operations where enabled
workflow/status inspection where enabled
```

Exact capability names MAY evolve, but write and consequential operations SHALL pass normal JARVIS authorization and audit controls.

Credentials SHALL remain behind the Credential Broker or another explicitly approved secure provider boundary.

---

## 3. Codex/OpenAI

Codex/OpenAI SHALL be the mandatory initial AI-provider family for V1.

This requirement SHALL be interpreted together with ADR-060, ADR-061, ADR-065, and ADR-066:

- provider-reported usage/quota information is used when available;
- JARVIS owns its production Core runtime rather than depending on arbitrary system Node;
- provider/Codex versions require evidence-backed compatibility qualification;
- provider session resume is an optional continuity optimization, not JARVIS durability.

JARVIS SHALL remain provider-abstracted so future providers can be added without hardcoding product roles to OpenAI-specific models.

V1 Production Complete SHALL require at least one qualified Codex/OpenAI configuration capable of satisfying the mandatory orchestrator/worker flows defined by the product contract.

---

## 4. Proxmox VE

Proxmox VE SHALL be a mandatory V1 infrastructure integration.

ADR-059 governs its security and authority boundary.

V1 qualification SHALL include the approved REST-API-first connection model, scoped credentials, deterministic resource identity, live-state verification, safe asynchronous task handling, explicit capability enablement, and destructive-action approval binding.

Proxmox control-plane authority SHALL remain distinct from guest operating-system shell authority.

---

## 5. Integrations retained in the binding contract

The following integrations SHALL remain in the JARVIS contract and SHALL NOT be removed, reclassified as merely speculative, or silently deferred to an unspecified future roadmap:

```text
SSH
Google Workspace
Microsoft 365
Cloudflare
```

They remain official supported-integration requirements subject to implementation and qualification.

Their absence SHALL NOT block V1 Production Complete, but their implementation SHALL be a mandatory release objective immediately after V1 as defined below.

---

## 6. First post-V1 feature update is gated on four integrations

The **first feature-bearing release after V1** SHALL NOT be declared feature-complete until all four of the following have reached the contract's `SUPPORTED` qualification level:

1. SSH
2. Google Workspace
3. Microsoft 365
4. Cloudflare

This requirement is intentionally stronger than "planned" or "high priority".

These integrations are mandatory deliverables for the immediate post-V1 feature release.

The version number for that release is not fixed by this ADR; it MAY be V1.1 or another version selected by release management.

### Patch-release exception

This gate SHALL NOT prevent emergency or maintenance releases needed before those integrations are complete.

Security fixes, critical bug fixes, compatibility fixes, data-recovery fixes, and other non-feature patch releases MAY ship after V1 without first completing all four integrations.

Such patch releases SHALL NOT be used to evade the requirement by relabeling a feature-bearing release as maintenance-only.

---

## 7. Required qualification semantics

For every integration in either the V1 mandatory set or the immediate post-V1 set, the following states SHALL remain distinct:

```text
SUPPORTED
INSTALLED
ENABLED
AUTHORIZED
PREFERRED
HEALTHY
```

An integration SHALL be marked `SUPPORTED` only after it has passed the applicable release qualification suite.

At minimum this SHALL include:

- authentication/credential lifecycle behavior;
- least-privilege capability mapping;
- input/output schema validation;
- sanitized error mapping;
- timeout and cancellation behavior;
- retry/idempotency behavior;
- rate-limit/backoff behavior where applicable;
- permission/authority integration;
- secret minimization;
- prompt-injection/untrusted-content handling where applicable;
- live-state verification for consequential operations;
- failure/recovery behavior;
- upgrade/version compatibility behavior;
- integration conformance tests;
- negative tests for denied/out-of-scope operations.

The existence of an SDK or API SHALL NOT by itself qualify an integration as `SUPPORTED`.

---

## 8. SSH boundary for the immediate next update

SSH is an explicitly required post-V1 integration, but it SHALL NOT collapse into a generic unrestricted escape hatch that bypasses typed tools and permission policy.

The future SSH integration SHALL require:

- explicit registered connection identity;
- host-key verification;
- scoped credential handling;
- explicit target/environment resolution;
- bounded command/tool authority;
- auditable invocation;
- controlled environment/working directory where applicable;
- clear separation between read-only, write, administrative, and destructive capabilities;
- no silent fallback from another integration into SSH.

A later ADR MAY refine the exact SSH execution envelope before implementation if a material trust-boundary choice arises.

---

## 9. Google Workspace boundary for the immediate next update

Google Workspace SHALL remain a required integration family for the first feature-bearing post-V1 release.

Implementation SHALL use scoped OAuth/service capabilities appropriate to the selected user/account context and SHALL not grant broad Workspace authority merely because one Google account is connected.

Individual service capabilities such as Gmail, Calendar, Drive, Contacts, or other Workspace services SHALL remain independently authorizable where practical.

The integration SHALL preserve data-sensitivity and provider-routing policy when Workspace content is supplied to AI providers.

---

## 10. Microsoft 365 boundary for the immediate next update

Microsoft 365 SHALL remain a required integration family for the first feature-bearing post-V1 release.

Implementation SHALL use scoped Microsoft identity/Graph or other approved service APIs rather than a generic credential/shell shortcut.

Mail, calendar, files, contacts/directory, and other service families SHALL remain independently capability-scoped where practical.

Tenant/account identity SHALL be explicit so personal, work, and multi-tenant contexts cannot be conflated.

---

## 11. Cloudflare boundary for the immediate next update

Cloudflare SHALL remain a required integration family for the first feature-bearing post-V1 release.

Implementation SHALL use scoped API-token capabilities and explicit account/zone/resource identity.

Read-only observability SHALL be separable from write authority.

DNS, zone configuration, Workers, tunnels, firewall/security controls, and other Cloudflare capabilities SHALL not automatically imply one another.

Critical or destructive Cloudflare changes SHALL pass the normal JARVIS high-risk/destructive approval path.

---

## 12. Direct public inbound webhooks are not a V1 requirement

JARVIS V1 SHALL NOT require the privileged local desktop runtime to expose a direct public Internet-facing inbound webhook listener.

The preferred V1 event-ingestion patterns are:

```text
outbound authenticated API access
provider-supported subscriptions that do not expose the privileged desktop directly
bounded polling with rate-limit-aware scheduling/backoff
local event sources
```

If an integration requires Internet-originated push delivery, the production design SHOULD use a separate authenticated relay/gateway or another isolation boundary rather than directly exposing the privileged JARVIS desktop process.

A public inbound event surface requires a separate threat model covering authentication, replay, request validation, rate limiting, denial-of-service, endpoint discovery, secret rotation, network exposure, and compromised-event handling before becoming part of the production trust boundary.

This ADR does not require direct public inbound webhooks for the first post-V1 feature release merely because Google Workspace, Microsoft 365, or Cloudflare are required there. Those integrations MAY satisfy their event requirements through polling, provider-supported outbound-safe mechanisms, or a separately approved relay design.

---

## 13. Release reporting

Release qualification SHALL report the integration matrix explicitly.

For V1, release evidence SHALL identify at least:

```text
Local filesystem/Git   SUPPORTED and qualified
GitHub                 SUPPORTED and qualified
Codex/OpenAI           SUPPORTED and qualified
Proxmox VE             SUPPORTED and qualified

SSH                    POST_V1_REQUIRED until qualified
Google Workspace       POST_V1_REQUIRED until qualified
Microsoft 365          POST_V1_REQUIRED until qualified
Cloudflare              POST_V1_REQUIRED until qualified
```

For the first feature-bearing release after V1, all four `POST_V1_REQUIRED` entries SHALL have transitioned to `SUPPORTED` and passed their production qualification gates.

---

## 14. Non-goals

This ADR does not:

- require every possible operation of every third-party platform in the first supported implementation;
- require unrestricted administrator authority for any integration;
- require direct public Internet ingress into the desktop app;
- require Proxmox Backup Server as part of the Proxmox VE connection;
- remove any integration family from the broader architecture;
- prevent additional integrations from shipping earlier if they are independently production-qualified;
- prevent urgent patch/security releases between V1 and the first feature-bearing post-V1 release.

---

## Consequences

### Positive

- V1 has a finite, testable integration boundary.
- The four most important initial integration families become true release gates rather than aspirational catalog entries.
- SSH, Google Workspace, Microsoft 365, and Cloudflare remain binding commitments rather than indefinite backlog items.
- Emergency patch releases are not blocked by feature-roadmap commitments.
- Public Internet ingress is not introduced into the privileged desktop trust boundary prematurely.
- Integration qualification remains evidence-based and capability-scoped.

### Costs

- The first feature-bearing post-V1 release has a substantial four-integration acceptance gate.
- Integration conformance testing must be maintained across independent third-party API/version changes.
- Release management must clearly distinguish maintenance patches from the first post-V1 feature release.

These costs are accepted because they create a practical V1 boundary without weakening the immediate product roadmap.

---

## Verification requirements

Automated/release verification SHALL confirm at minimum:

1. V1 cannot be marked Production Complete when any of the four V1 mandatory integration families is unqualified.
2. A detected/connected integration is not automatically marked `SUPPORTED`.
3. SSH, Google Workspace, Microsoft 365, and Cloudflare remain present in the binding integration catalog after V1 scope evaluation.
4. The first feature-bearing post-V1 release gate requires all four immediate post-V1 integrations to be `SUPPORTED`.
5. Maintenance/security patch releases can be produced without falsely satisfying or bypassing the post-V1 feature gate.
6. No integration silently gains raw credential access outside the approved Credential Broker/provider boundary.
7. No integration uses an undocumented fallback into SSH or generic shell authority.
8. V1 does not require a direct public Internet listener in the privileged JARVIS desktop process.
9. Consequential integration writes remain subject to normal authority, permission, approval, budget, audit, and verification policy.

---

## Final rule

> **JARVIS V1 Production Complete requires production-qualified Local filesystem/Git, GitHub, Codex/OpenAI, and Proxmox VE integrations. SSH, Google Workspace, Microsoft 365, and Cloudflare remain binding contract requirements and are mandatory for the first feature-bearing release after V1. Emergency maintenance/security patches may ship before that feature release. Direct public inbound Internet listeners are not required for V1 and require a separately hardened boundary before entering the privileged desktop trust model.**
