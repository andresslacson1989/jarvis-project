# JARVIS Scope, Governance & Coding Contract

**Contract Suite Version:** 1.0.8
**Version:** 1.0.9
**Component:** `J00`
**Status:** Canonical normative component
**Scope:** product scope, contract authority, repository governance, direct amendment process, and production coding standards

---

This file is the sole normative home for the clauses in this component. The manifest fixes the component set and revisions; the Release Profile fixes the supported V1 product profile. The implementation plan, execution matrix, evidence records, and audits are execution aids and do not add authority.

Clause identifiers in this file are stable traceability anchors. Cross-component references use clause identifiers and the separate Release Profile; historical material cannot override or supplement this suite.
## J00-SCOPE-01 — PURPOSE

This contract defines how JARVIS SHALL be implemented as a production-grade Windows-first AI operating companion rather than a prototype, chat wrapper, or loosely connected collection of scripts.

V1 is a Windows product. The architecture SHALL nevertheless preserve an explicit future Linux `FULL_HOST` path without weakening Windows security or requiring Linux implementation before V1. A future Android application is treated as a `COMPANION` interaction surface, not as a required full-host runtime.

A compliant implementation SHALL remain controlled, truthful, recoverable, observable, visually coherent, and architecturally portable at the defined platform boundaries under provider failure, user interruption, crash/restart, network loss, invalid AI output, stale external state, resource pressure, update/migration failure, and adversarial input.

The governing chain is:

```text
USER INTENT
    ↓
AI ORCHESTRATOR
    ↓
PROPOSED ACTION / MISSION PLAN
    ↓
DETERMINISTIC JARVIS CORE
    ↓
VALIDATE → RESOLVE → AUTHORIZE → SCHEDULE → EXECUTE → VERIFY
    ↓
PROVIDER / TOOL / WORKER / INTEGRATION
    ↓
OBSERVED RESULT
    ↓
VERIFIED STATE
    ↓
USER
```

> **AI decides. Software authorizes. Software verifies.**

---

## J00-SCOPE-02 — ONE CURRENT NORMATIVE SUITE

The current production contract consists of the six consolidated normative components and the separate Release Profile listed in `docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md`.

The six components are:

- `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` (`J00`);
- `docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md` (`J01`);
- `docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md` (`J02`);
- `docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md` (`J03`);
- `docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md` (`J04`);
- `docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md` (`J05`).

The Release Profile is the separate normative support/capability target. The implementation plan, execution matrix, developer execution goal, evidence records, and audit reports are execution aids; they do not add requirements or authority.

The suite version identifies the current combined product contract. Component revisions are recorded by the manifest and change when the corresponding consolidated component meaning changes.

Historical material cannot override, supplement, or fill a gap in the current suite. A future material product, architecture, security, platform, release, trust, or governance amendment is incomplete until the affected active clauses, manifest, Release Profile when applicable, verification requirements, and implementation sequencing are reconciled in one reviewed change.
---

## J00-SCOPE-03 — CONTRACT LANGUAGE

`MUST`, `MUST NOT`, `SHALL`, and `SHALL NOT` are mandatory.

`SHOULD` and `SHOULD NOT` are strong defaults requiring a documented engineering reason to deviate.

`MAY` is optional.

Unknown/ambiguous security-critical interpretation SHALL fail closed rather than choose a permissive meaning.

---

## J00-SCOPE-04 — PRODUCT DEFINITION

JARVIS is a persistent, local-first AI operating companion. `RP-01` through `RP-13` select the V1 product, support, capability, integration, voice, UI, hardware, and artifact profile. J01 through J04 own the complete runtime, data, security, operations, provider, integration, voice, and UI behavior; J05 owns qualification and release decisions.

JARVIS SHALL NOT be implemented as a single LLM session with broad shell access, as a custom foundation-model project, as unrelated screens that merely share a name, or as Windows-specific domain logic coupled directly to native APIs when a platform capability boundary is appropriate.

---

## J00-GOV-28 — REPOSITORY GOVERNANCE BEFORE IMPLEMENTATION

`master` is the sole authoritative/latest branch. Temporary branches may be used for review/work but do not become alternate contract sources.

Before Phase 0 is complete, the authoritative repository governance mode SHALL be determined from verified hosting/account capability.

`GITHUB_ACTIONS` is the sole designated mandatory CI authority. A complete GitHub Actions result for the exact candidate or resulting authoritative commit is required; partial results cannot be combined and a LocalCI result cannot substitute.

Authoritative GitHub Actions evidence SHALL bind the approved repository and server-resolved immutable 40-hex commit exactly to the candidate; execute the complete repository-owned pipeline at that commit; use pinned/frozen toolchains and dependencies; fail closed on every mandatory gate; use immutable action pins and least-privilege workflow permissions; implement bounded timeout/cancellation/cleanup/idempotency behavior; and retain or export independently auditable run, workflow/job, per-gate, log/artifact identity, timestamp, and final-status evidence.

LocalCI may run compatibility or security tooling under its own controls, but it is unselected and non-authoritative: it SHALL NOT be described as a qualified alternative, selected authority, CI authority, or release qualifier.

The selected GitHub Actions workflow/job identity SHALL be machine-readable and auditable. GitHub Actions SHALL remain enabled for mandatory CI. GitLab is repository mirror-only and SHALL NOT qualify CI or release evidence. If GitHub Actions cannot execute the complete required pipeline, the gate remains unsatisfied.

When the hosting provider/account exposes enforceable server-side branch protection or repository rulesets for the authoritative repository, `master` SHALL use that capability and the effective policy SHALL at minimum:

- prevent deletion;
- block force pushes;
- require designated mandatory CI checks once those checks exist;
- keep bypass narrowly controlled and auditable.

When the hosting provider/account does not expose server-side branch protection/rulesets for the authoritative repository because of a plan or platform capability limitation, absence of that unavailable paid/host-gated feature SHALL NOT by itself block Phase 0 or `Production Complete`. The limitation SHALL be verified and recorded, and normal implementation integration SHALL instead use compensating governance that at minimum:

- performs implementation work on temporary branches rather than routine direct implementation writes to `master`;
- requires the designated mandatory CI context to pass for the exact candidate commit before authoritative integration;
- re-fetches and validates the live `master` tip immediately before integration and rejects/reconciles stale-base or unexpected concurrent movement;
- uses non-force integration/ref updates only;
- verifies the resulting authoritative tip, intended diff, and relevant CI/audit evidence after integration;
- records that server-side protection is unavailable and SHALL NOT represent `master` as protected when it is not;
- re-enables the server-enforced mode when the hosting capability later becomes available, without requiring a product-architecture change.

The compensating mode does not claim hard server-side prevention of an out-of-band repository administrator force push or deletion. That residual hosting limitation is explicit and accepted by this contract only while the required server-side capability is unavailable. The exception SHALL NOT be used to disable an available protection feature, waive mandatory CI, permit force-push implementation workflow, create a broad bypass, or misrepresent repository state.

Before any authorized candidate publication, contract or verification-system changes SHALL pass a local fail-fast preflight in this order: relevant targeted checks; the normal local test profile; then applicable contract, schema/generated-output, governance, security, provenance, architecture, format, strict-type, build, and platform checks. Local preflight is supplementary evidence only, cannot qualify CI or a release, and cannot replace exact-candidate GitHub Actions verification.

A pull-request requirement is strongly preferred for implementation changes. Repository governance SHALL NOT require maintaining a second long-lived authoritative branch.

Phase 0 SHALL also establish machine-readable canonical definitions/checks for repeated security/profile constants and capability matrices where practical, with CI detecting divergence from current normative values rather than relying indefinitely on manual duplication discipline.

---

## J00-GOV-29 — FUTURE ARCHITECTURE AMENDMENTS

A future material amendment SHALL be made directly in the affected active contract clauses under the owner/governance amendment process; it SHALL NOT create, retain, cite, or rely on ADR/decision-record material. Before implementation depends on it, the same reviewed change SHALL update every affected active normative file, the current contract manifest, the Release Profile when applicable, verification requirements, implementation sequencing, compatibility/migration/rollback notes, and required tests/evidence.

Material changes to product scope, runtime roles/platform intent, trust boundaries, release gates, authentication/recovery, backup cryptographic format, project-policy admission, supply-chain trust root, required capabilities, UI identity, or repository-governance qualification SHALL advance the contract-suite semantic version rather than silently changing the meaning of an existing suite version.

No later document, branch, report, or historical material silently supersedes an active clause until the active suite is synchronously reconciled.

If current normative documents conflict, the contract is defective and implementation SHALL stop at that ambiguity until the documents are reconciled.

---

## J00-SCOPE-30 — DEFERRED / NON-GOALS FOR V1

V1 does not require:

- Linux production artifacts or Linux runtime qualification;
- Android/other companion application implementation;
- remote companion networking/gateway implementation;
- cross-platform Windows↔Linux state migration/restore qualification;
- integrated browser automation;
- mobile/remote web clients;
- LAN AI nodes;
- unrestricted computer-control agents;
- mandatory local large-LLM inference;
- custom foundation-model training/inference infrastructure;
- privileged Windows service architecture solely to claim same-user-malware isolation;
- an open arbitrary executable plugin marketplace;
- direct public Internet ingress to privileged Core;
- light theme, multiple visual themes, a 3D avatar, or a separate visual identity per integration/platform;
- GitHub repository/secrets/branch-protection administration as a JARVIS product capability;
- generic Proxmox storage/network administration;
- direct Proxmox Backup Server administration.

The absence of Linux/companion delivery from V1 SHALL NOT be used to justify violating the platform-boundary clauses in J01 during Windows implementation.

---

## J00-SCOPE-31 — GOVERNING PRINCIPLES

> **AI decides. Software authorizes. Software verifies.**

> **Workers own the loop. JARVIS owns the graph. Verification decides done.**

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

> **Escalate product judgment. Resolve engineering judgment.**

> **One system. One identity. Any screen.**

> **Abstract the capability, not the security away.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**

> **One authoritative host. Multiple interaction surfaces may come later.**

> **A repository file is data until an authenticated user enrolls its exact policy identity.**

> **A valid historical signature is not perpetual authorization to activate.**

> **Build the control plane first, prove recoverability early, then give intelligence access to it.**

> **Version the current truth; do not make implementers infer it from history.**

> **A capable assistant on the good day, a controlled system on the dangerous day, and a recoverable system on the bad day.**

---

## J00-CODE-01 — PURPOSE

These rules preserve the JARVIS trust, state, recovery, provider, UI, integration, and platform architecture in actual code. They apply equally to human-written and AI-generated code.

Prefer explicit, bounded, testable code over cleverness at authority/state/security boundaries.

> **Abstract the capability, not the security away.**

---

## J00-CODE-02 — REPOSITORY BOUNDARIES

The monorepo SHALL preserve responsibilities equivalent to:

```text
apps/
  desktop/
    src/                 React presentation/read models
    src-tauri/           Rust native composition/application shell

services/
  core/                  authoritative Node/TypeScript runtime

packages/
  protocol/              cross-boundary contracts/types
  schemas/               runtime validators
  policy/                deterministic side-effect-free policy/state logic
  platform-contracts/    semantic native-capability contracts/types
  shared/                narrow non-domain utilities only

platform/
  windows/               Windows native backends/composition
  linux/                 future Linux native backends; not V1 implementation scope

providers/
  ai/
  speech/
  integrations/

tools/
  platform/
  git/
  filesystem/
  projects/

modules/

tests/
  fixtures/
  unit/
  property/
  contract/
  integration/
  e2e/
  safety/
  recovery/
  performance/
  voice/
  platform/
  release/
```

Equivalent folder refinements are permitted only when authority/trust/platform boundaries remain clear.

Linux folders/interfaces MAY exist as contracts/test fixtures in V1, but V1 SHALL NOT implement or claim a Linux runtime merely to satisfy directory symmetry.

---

## J00-CODE-03 — DEPENDENCY DIRECTION AND PLATFORM PORTABILITY

- React SHALL not import Core persistence, provider implementations, secure-store code, process supervisor, or tool executors.
- Core/domain SHALL not depend on UI code.
- Shared Core/domain/policy/protocol code SHALL not import Windows or Linux native backend implementations.
- Shared code SHALL not directly invoke Win32, DPAPI, registry, Windows named-pipe, Job Object, HWND, SID, UAC, cgroup, Linux keyring/session, or equivalent native APIs unless it is explicitly inside the platform adapter layer.
- Provider-native types remain inside provider adapters; mission/task/domain models use canonical protocol types.
- Platform-native types remain inside platform adapters; domain models use semantic platform types/capability handles.
- Tools/integrations SHALL not bypass ToolExecutor, PermissionEngine, AuthorityEnvelopeService, Credential Broker, budget/locality/platform checks, or audit.
- `packages/policy` SHALL be deterministic/side-effect-free except explicitly injected clocks/randomness/test inputs.
- `packages/shared` SHALL not become a hidden domain/service/platform container.
- Circular package dependencies are prohibited.

CI SHALL enforce architecture/import boundaries where practical.

Operating-system selection SHALL occur at composition/startup/platform-adapter boundaries. Scattered `process.platform`, `cfg(target_os)`, or equivalent OS branching inside mission, permission, memory, budget, integration semantics, or general feature code is prohibited where a semantic platform capability interface can express the dependency.

---

## J00-CODE-04 — PLATFORM CAPABILITY CONTRACTS

`J01-PLAT-04` through `J01-PLAT-28` own the required platform capabilities, composition boundary, availability/qualification semantics, and Windows V1 mechanism requirements. Coding work SHALL consume those typed boundaries rather than introduce direct native dependencies into shared Core/domain/policy/protocol code.

---

## J00-CODE-05 — TYPESCRIPT BASELINE

Production TypeScript SHALL compile with strict settings equivalent to:

```text
strict: true
noImplicitAny: true
strictNullChecks: true
noUncheckedIndexedAccess: true
exactOptionalPropertyTypes: true
noImplicitOverride: true
noFallthroughCasesInSwitch: true
useUnknownInCatchVariables: true
noImplicitReturns: true
```

`any` is not a trust-boundary or platform-boundary escape hatch. A localized third-party typing exception must remain inside its adapter and validate before domain use.

Type assertions/non-null assertions SHALL not substitute for runtime validation or established invariants.

Authoritative money uses parsed exact integer/decimal logic, never JavaScript `number` arithmetic.

---

## J00-CODE-06 — RUST BASELINE

Rust uses a pinned stable toolchain unless a reviewed platform requirement dictates otherwise.

Production gates include `cargo fmt --check` and `cargo clippy` with warnings denied, with narrow documented exceptions only when technically required.

Unsafe Rust:

- policy/protocol/business/platform-contract crates SHOULD forbid unsafe code;
- unsafe is confined to narrow OS/FFI modules that require it;
- every unsafe block has a `SAFETY:` invariant explanation;
- wrappers expose safe typed semantic interfaces;
- buffer length/nullability/ownership/handle lifetime/thread assumptions are explicit and tested;
- native handles/resources use RAII.

Windows-specific unsafe/handle code lives in the Windows backend, not generic domain crates.

---

## J00-CODE-07 — RUNTIME VALIDATION

Runtime schema validation occurs for:

- UI → Rust commands;
- Rust ↔ Core IPC;
- platform capability requests/results where crossing a trust/process boundary;
- AI structured output;
- provider setup/events/results;
- tool inputs/outputs;
- module manifests/catalog metadata;
- integration/API/event payloads;
- persisted versioned events when decoded;
- configuration/import/export;
- KDF profile/verifier/key-slot metadata;
- backup manifests/key-slot metadata.

Validation occurs before expensive work and before authorization. Security-material fields are not permissively coerced.

---

## J00-CODE-08 — STATE-MACHINE OWNERSHIP

Mission/task/attempt/approval/provider/module/integration transitions happen only through their owning services/policy modules.

UI, repositories, workers, provider adapters, platform adapters, and tools do not invent transitions directly.

Provider setup state is separate from provider compatibility/health/platform support and is owned by the provider setup/qualification service, not inferred by UI/provider worker code.

State transition logic SHOULD be deterministic/property-testable with exhaustive enum handling.

One durable `RESUMING` TaskState is canonical. Unknown persisted states fail closed/migrate explicitly; they never default to RUNNING/success.

---

## J00-CODE-09 — PERMISSIONENGINE CODE

PermissionEngine SHALL implement the exact ordered precedence owned by J03-SEC-13 as deterministic policy code. UI, tool, provider, and platform adapters SHALL call that implementation rather than duplicate or reinterpret its rules.

J03-SEC-13 through J03-SEC-18 own authorization behavior and negative cases; J05-VER-15 owns their qualification. Policy decisions SHALL persist stable reason-code/version references rather than only human prose.

---

## J00-CODE-10 — ASYNC / CANCELLATION / PROCESS OWNERSHIP

Long-running work SHALL have explicit lifecycle owner and cancellation primitive (`AbortSignal` or typed equivalent in TypeScript; owned cancellation/process handles in Rust).

No untracked detached authoritative promises/processes.

Cancellation distinguishes user cancel, timeout, provider failure, provider setup/repair, pause/preemption, process termination, and app shutdown.

Local cancellation does not prove external side effect absence; `UNCERTAIN`/live-state recovery applies.

All normal managed executable children use the semantic PlatformProcessSupervisor boundary.

On Windows V1 the backend SHALL preserve mandatory Job Object and handle-inheritance invariants. A UAC-launched provider setup helper may use a separately qualified native lifecycle, but it remains explicitly tracked/awaited/reconciled and never becomes a general breakaway-worker exception.

---

## J00-CODE-11 — ERROR MODEL

Errors crossing package/process/platform boundaries use stable typed `JarvisError` categories/codes.

Do not:

- swallow errors without defined state/diagnostic outcome;
- expose raw provider/native stack traces or secret payloads to UI/AI;
- parse human error text for security decisions when a structured signal exists;
- retry based only on error text or `retryable` flag.

Preserve secret-safe causal context internally and map to stable domain errors at boundaries.

Platform adapters SHALL normalize failures to registered semantic errors while retaining sanitized native diagnostics internally.

Provider setup failures SHALL map to explicit setup/repair diagnostics rather than masquerade as generic worker/provider failure.

---

## J00-CODE-12 — LOGGING / OBSERVABILITY

Logging is structured and uses relevant correlation/mission/task/attempt/tool/provider/module/integration/platform identifiers.

Never log passwords/recovery factors, KDF-derived working keys, `DB_DEK`, `BackupDEK`, SQLCipher snapshot keys, raw OAuth/API tokens, authorization headers, private keys, provider-internal sandbox-account credentials, complete environment dumps, or arbitrary full AI context.

Prevent secret entry first; centralized redaction is defense in depth.

A mandatory audit write failure SHALL fail/rollback the authoritative state change when audit/state atomicity is required.

---

## J00-CODE-13 — DATABASE ACCESS

Only Core persistence code mutates authoritative DB during normal operation.

SQL uses parameter binding.

State-changing repository methods expose transaction/expected-version boundaries.

Authorization/business policy stays out of repositories.

Every connection uses one owned initialization path that verifies foreign keys, WAL compatibility, synchronous policy, busy behavior, and release-qualified SQLite/SQLCipher identity.

Never hold write transactions while awaiting AI, network, external API, provider setup/UAC, long verification, user approval, or slow filesystem work.

WAL/checkpoint/integrity/busy metrics feed DiagnosticsService.

Logical durable state SHOULD remain platform-neutral. Inherently platform-specific metadata SHALL be typed/namespaced and not become universal domain identity.

---

## J00-CODE-14 — MIGRATIONS

Migrations are monotonic, deterministic, reviewed, fixture-tested production code.

They SHALL NOT hide conversion failure by silently dropping data.

Changes to KDF profiles/verifiers/key slots, money precision, DataSensitivity/DataLocality, approvals/action descriptors, provider setup/module/platform identity, backup encryption, session recovery, path representation, or state enums include explicit compatibility tests.

---

## J00-CODE-15 — KDF / PASSWORD CODE

JARVIS SHALL have one validated implementation path for the production KDF profiles owned by J03-SEC-04 and J02-DATA-05, consumed without reinterpretation.

Code SHALL use a maintained reviewed implementation, qualified CSPRNG/backend, bounded accepted parameters, and fail closed on under-floor or malformed production metadata. Test-only reduced parameters SHALL be impossible to activate in a production release/configuration.

---

## J00-CODE-16 — FILESYSTEM / CANONICAL TARGET CODE

All consequential filesystem targets use the trusted platform-aware canonicalization/security rules in J03-SEC-16.

Feature/domain code SHALL NOT authorize with `startsWith(root)` or ad-hoc string normalization.

The shared Project/Workspace model uses platform-tagged path identity rather than assuming Windows path syntax globally.

Windows V1 backend SHALL handle traversal, reparse/junction/symlink, UNC/alternate root, drive-root, aliases/case identity, and supported Windows path identity cases.

A future Linux backend SHALL separately handle Linux symlink/mount/root/case/filesystem identity semantics.

Mutable high-risk/destructive targets are re-resolved immediately before execution.

Where possible, execution also uses expected file identity/hash/version to fail on post-authorization target changes.

---

## J00-CODE-17 — CREDENTIAL / SECRET CODE

Credential and secret code SHALL consume the opaque-handle, broker, storage, environment-allowlist, provider-setup, and durable-state boundaries in J03-SEC-06, J03-SEC-07, J03-SEC-23, J03-SEC-24, J01-PLAT-14, and the applicable J02 clauses. Core types SHALL not expose broad raw-token fields, resolve credentials directly, or depend on a platform-native storage mechanism.

---

## J00-CODE-18 — APPROVAL CANONICALIZATION CODE

`CanonicalActionDescriptorV1`, its fields, canonicalization, digest, approval binding, rejection vectors, and qualification are owned by J01-PROTO-18, J01-PROTO-25, J03-SEC-17, and J05-VER-08/J05-VER-10. Adapters and tools SHALL consume that one contract and SHALL NOT add, omit, or reinterpret material approval fields.

---

## J00-CODE-19 — CONDITIONAL MUTATION CODE

Consequential adapters SHALL expose expected-state/precondition inputs when upstream systems support them.

Examples:

- HTTP ETag/If-Match;
- Git expected ref/SHA;
- filesystem identity/hash;
- infrastructure generation/version;
- other CAS/precondition token.

A mismatch maps to typed `PRECONDITION`/`CONFLICT`, triggers re-resolution, and never silently executes against changed state under stale authorization.

---

## J00-CODE-20 — PROVIDER ADAPTER / SETUP / PLATFORM STANDARDS

Provider behavior, setup/repair, compatibility, platform identity, normalized events/errors, routing, and conformance are owned by J01-RT-14 through J01-RT-16, J01-PROTO-19, J03-SEC-21 through J03-SEC-23, J04-OPS-14, and J05-VER-17. Adapters SHALL expose those typed semantics and SHALL NOT turn availability or setup elevation into authority.

---

## J00-CODE-21 — TOOL ADAPTER STANDARDS

Every executable tool SHALL consume the registered `ToolManifest`, bounded schemas, authority, credential, conditional-mutation, outcome, audit, platform, and qualification requirements owned by J01-PROTO-16, J03-SEC-13, J03-SEC-18, J03-SEC-24, J01-PLAT-26, and J05-VER-18. A broad multi-purpose tool SHALL be split when it makes authorization or postconditions ambiguous or materially enlarges blast radius.

---

## J00-CODE-22 — GITHUB ADAPTER STANDARDS

GitHub code SHALL expose only the typed V1 capability selection and exclusions owned by RP-09.1, J01-PROTO-21, J03-SEC-24, and J05-VER-24. Local Git/filesystem mechanics SHALL use the platform path/process boundary.

---

## J00-CODE-23 — PROXMOX ADAPTER STANDARDS

Proxmox code SHALL expose only the typed V1 capability selection, TLS/credential boundary, asynchronous task/postcondition, `UNCERTAIN`, and prohibited-fallback behavior owned by RP-09.2, J01-PROTO-21, J03-SEC-25, and J05-VER-25. Remote semantics remain platform-neutral; concrete support requires qualified platform dependencies.

---

## J00-CODE-24 — MODULE CODE

Module execution classes, manifest compatibility, catalog trust, lifecycle, platform support, and conformance are owned by J01-PROTO-20, J03-SEC-26, J03-SUPPLY, and J05-VER-26. Code SHALL consume those boundaries without reinterpretation.

---

## J00-CODE-25 — TAURI/REACT / DESIGN-SYSTEM CODE

React is presentation/control, never authority. The Tauri/WebView security configuration and negative requirements are owned by J03-SEC-20 and J05-VER-12; the UI identity, design-token, brand-asset, typography, accessibility, state-language, adaptive-layout, and reusable-component requirements are owned by J04-UI-03–J04-UI-28 and J05-VER-11/J05-VER-35.

This boundary SHALL consume those canonical capabilities and components, handle their required truthful states, and never reimplement PermissionEngine or platform-native window authority for UX.

---

## J00-CODE-26 — BACKUP / RECOVERY CODE

Backup and recovery code SHALL consume the hierarchy, format, slots, parser, restore, activation, and security rules owned by J02-DATA-27 through J02-BACKUP-15 and the applicable J03 clauses without reinterpretation.

---

## J00-CODE-27 — TEST CODE

Tests are production artifacts.

Prefer observable invariants over private implementation details. Security/state tests use deterministic fixtures/properties.

`J05-VER-07` through `J05-VER-37` own required test layers, real-platform evidence, conformance environments, and release qualification. Test code SHALL not substitute mocks for evidence that those clauses require from a real Windows target, selected integration, device, package, or signed artifact. CI/unit/architecture tests SHALL additionally verify J01 platform-boundary rules even though Linux runtime conformance is not a V1 gate.

Synthetic fixtures never contain real credentials.

Flaky tests are defects; blind rerun-to-green is not normal release policy.

---

## J00-CODE-28 — STATIC / CI GATES

Normal CI SHALL include as applicable:

```text
format/lint
TypeScript strict typecheck
Rust fmt/clippy warnings-as-errors
unit/property/schema tests
architecture/import boundary checks
platform-boundary forbidden-import checks
Tauri capability/CSP config checks
design-token/brand-asset source checks where practical
secret scan
dependency/vulnerability scan
license/provenance checks for packaged dependencies/assets
stale generated-code detection
```

The mandatory pipeline SHALL execute in `GITHUB_ACTIONS` without weakening its gate set. It SHALL bind the exact candidate SHA, use pinned/frozen inputs, aggregate failures fail-closed, and retain the required evidence. LocalCI tooling may exercise compatibility or security checks, but no result from it can satisfy this mandatory CI gate.

GitHub Actions workflows SHALL retain immutable action pins and least-privilege permissions. GitLab is mirror-only. CI control-plane credentials SHALL never enter job containers. Material GitHub Actions authority or pipeline changes require requalification.

CI SHALL detect direct imports of Windows native implementations from shared Core/domain/policy/protocol packages where practical.

Security-sensitive packages should have strong meaningful branch coverage; target numbers shall not drive low-value tests.

Before Phase 0 completes, repository-governance mode SHALL follow the verified hosting provider/account capability.

The current mode, exact server-side protection facts, fallback transition record, local-first sequence, live `master` tip validation, and non-force integration controls are owned by J00-GOV-28/J05-VER-33 and the current governance profile/operational aid. This coding contract retains both the `SERVER_ENFORCED` and `COMPENSATING_CONTROLS` modes without treating them as equal: GitHub Actions is mandatory CI, GitLab is mirror-only, LocalCI is non-authoritative, exact candidate identity is required, and no local result substitutes for GitHub qualification.

---

## J00-CODE-29 — DEPENDENCIES AND THIRD-PARTY ASSETS

Add dependencies only for a concrete product/engineering need.

Review maintenance, license, security, transitive surface, native packaging, Windows x64 support, and release/offline/update implications.

For dependencies used by shared Core/domain/UI code, future Linux portability SHOULD be considered before choosing a Windows-only dependency when an equally strong maintained platform-neutral option exists. This is not a mandate to choose an inferior abstraction or weaken Windows behavior.

A Windows-only dependency is acceptable inside the Windows backend when it is the correct production mechanism.

Runtime executable downloads occur only through explicit authenticated provider/module installation/update flows, never ordinary Core startup.

Production builds are reproducible from clean checkout + documented external prerequisites and pinned lockfiles/toolchains.

Fonts, icon libraries, images, audio models, and other redistributable third-party assets SHALL have source/version/license/provenance tracked with required notices. Primary UI assets/fonts SHALL not depend on a CDN at runtime.

---

## J00-CODE-30 — CONFIGURATION / FEATURE FLAGS

Configuration is typed/versioned/runtime-validated.

Security defaults fail safe. Unknown flags do not activate behavior.

Feature flags cannot bypass mandatory security/recovery/qualification/platform rules to make incomplete features appear functional.

Experimental provider/module/integration/platform paths remain visibly separate from Release Profile `SUPPORTED` functionality.

No production feature flag may enable an under-floor KDF, unqualified provider sandbox/platform backend, or optional integration capability without corresponding signed release support/conformance.

---

## J00-CODE-31 — CODE REVIEW REQUIREMENTS

Explicit invariant review is required for changes governed by J01 platform/runtime/protocol clauses, J02 persistence/backup clauses, J03 security/trust clauses, J04 operations/UI clauses, the Release Profile selections, or J05 qualification gates. Review SHALL verify the owner's required tests prove the invariant, not merely that code appears plausible.

---

## J00-CODE-32 — ARCHITECTURE-ENFORCEMENT INVARIANTS

Production code and CI SHALL enforce the complete invariants owned by J01-PLAT-05 through J01-PLAT-28, J01-RT-07 through J01-RT-23, J01-PROTO-11 through J01-PROTO-21, J02-DATA-07 through J02-BACKUP-17, J03-SEC-06 through J03-SEC-32, J04-OPS-02 through J04-OPS-30, and J05-VER-09 through J05-VER-37. This includes one authority path, typed state transitions, canonical approvals, secret boundaries, owned process lifecycle, conditional mutation, portable recovery, and truthful platform qualification. Windows ARM64, Linux, and companion support remain governed by J01-PLAT-03, J01-PLAT-10 through J01-PLAT-12, J01-PLAT-23 through J01-PLAT-25, and the Release Profile; they SHALL NOT be inferred from a launchable build or executable.

---

## J00-CODE-33 — GOVERNING STANDARD

> **Prefer explicit, boring, testable code at trust, state, and platform boundaries. Cleverness is not an optimization when failure can authorize the wrong action, lose state, leak a secret, fabricate completion, or lock the architecture to one OS unnecessarily.**

> **Share product semantics; specialize native mechanisms.**

---

**END — JARVIS SCOPE, GOVERNANCE & CODING CONTRACT v1.0.9**
