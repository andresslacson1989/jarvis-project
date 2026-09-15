# JARVIS Scope, Governance & Coding Contract

**Contract Suite Version:** 1.0.8
**Version:** 1.0.8
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

---

## J00-SCOPE-03 — CONTRACT LANGUAGE

`MUST`, `MUST NOT`, `SHALL`, and `SHALL NOT` are mandatory.

`SHOULD` and `SHOULD NOT` are strong defaults requiring a documented engineering reason to deviate.

`MAY` is optional.

Unknown/ambiguous security-critical interpretation SHALL fail closed rather than choose a permissive meaning.

---

---

## J00-SCOPE-04 — PRODUCT DEFINITION

JARVIS is a persistent, local-first AI operating companion with a Windows V1 full host and an architecture explicitly preserving future Linux full-host support.

V1 SHALL provide:

- natural text interaction;
- production voice interaction through replaceable local-first providers;
- a unified dark-theme **JARVIS Mission Control** interface with one approved brand/design system across conversation, missions, approvals, systems, integrations, memory, artifacts, diagnostics, and voice state;
- a dedicated primary desktop dashboard/window that can be hidden, shown, windowed, maximized, full-screen, or focused-context presented under deterministic native/application policy;
- adaptive layout across qualified window sizes, screen classes, multi-monitor/DPI conditions, WebView zoom/reflow, accessibility modes, and user text scaling without inventing separate visual products;
- AI orchestration for flexible language understanding;
- deterministic authorization and typed tool/integration execution;
- durable project, memory, mission, task, approval, budget, event, and recovery state;
- bounded AI workers and graph-based missions;
- dynamic graph revision through validated immutable graph versions;
- queueing, priority, pause/resume/cancel/recovery;
- provider supervision, setup/repair state, compatibility qualification, and capability-based routing;
- secure credentials and integration boundaries;
- worker journals/work dashboard without private chain-of-thought;
- exact budget/usage accounting;
- event-triggered automation under normal authorization;
- encrypted backup/restore and staged reversible updates;
- production diagnostics, provenance, and qualification evidence.

JARVIS SHALL NOT be implemented as a single LLM session with broad shell access, as a custom foundation-model project, as unrelated screens that merely share a name, or as Windows-specific domain logic coupled directly to native APIs when a platform capability boundary is appropriate.

---

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

A pull-request requirement is strongly preferred for implementation changes. Repository governance SHALL NOT require maintaining a second long-lived authoritative branch.

Phase 0 SHALL also establish machine-readable canonical definitions/checks for repeated security/profile constants and capability matrices where practical, with CI detecting divergence from current normative values rather than relying indefinitely on manual duplication discipline.

---

---

## J00-GOV-29 — FUTURE ARCHITECTURE AMENDMENTS

A future material amendment SHALL be made directly in the affected active contract clauses under the owner/governance amendment process; it SHALL NOT create, retain, cite, or rely on ADR/decision-record material. Before implementation depends on it, the same reviewed change SHALL update every affected active normative file, the current contract manifest, the Release Profile when applicable, verification requirements, implementation sequencing, compatibility/migration/rollback notes, and required tests/evidence.

Material changes to product scope, runtime roles/platform intent, trust boundaries, release gates, authentication/recovery, backup cryptographic format, project-policy admission, supply-chain trust root, required capabilities, UI identity, or repository-governance qualification SHALL advance the contract-suite semantic version rather than silently changing the meaning of an existing suite version.

No later document, branch, report, or historical material silently supersedes an active clause until the active suite is synchronously reconciled.

If current normative documents conflict, the contract is defective and implementation SHALL stop at that ambiguity until the documents are reconciled.

---

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

---

## J00-CODE-04 — PLATFORM CAPABILITY CONTRACTS

Native responsibilities SHALL be exposed through explicit typed capabilities or equivalent service boundaries for responsibilities such as:

```text
PlatformSecureStorage
PlatformLocalIpc
PlatformProcessSupervisor
PlatformSessionObserver
PlatformWindowController
PlatformNotificationBackend
PlatformPathsAndIdentity
PlatformAudioBackend
PlatformUpdateBackend
PlatformPrivilegeMediator
PlatformSystemInfo
```

Interface names may vary. The contract must express required semantics and failure modes, not the implementation technology.

Capability discovery reports technical availability/qualification only. It never grants action authority.

An unavailable/unqualified platform capability SHALL block or degrade the dependent feature truthfully. There is no weaker generic fallback merely to preserve nominal cross-platform parity.

Windows V1 backend implementations remain governed by all specific Windows requirements in the Runtime/Security/Data/Release contracts.

---

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

---

## J00-CODE-08 — STATE-MACHINE OWNERSHIP

Mission/task/attempt/approval/provider/module/integration transitions happen only through their owning services/policy modules.

UI, repositories, workers, provider adapters, platform adapters, and tools do not invent transitions directly.

Provider setup state is separate from provider compatibility/health/platform support and is owned by the provider setup/qualification service, not inferred by UI/provider worker code.

State transition logic SHOULD be deterministic/property-testable with exhaustive enum handling.

One durable `RESUMING` TaskState is canonical. Unknown persisted states fail closed/migrate explicitly; they never default to RUNNING/success.

---

---

## J00-CODE-09 — PERMISSIONENGINE CODE

PermissionEngine SHALL implement the exact ordered precedence owned by J03-SEC-13 as deterministic policy code. UI, tool, provider, and platform adapters SHALL call that implementation rather than duplicate or reinterpret its rules.

The J03-SEC-13 negative cases remain mandatory: hard invariants and explicit DENY precedence; separation of current instructions, standing permission, and precedent; HIGH/CRITICAL authorization limits; final confirmation for destructive actions; and rejection of provider setup/elevation, platform availability, or AI confidence as authorization. Tests SHALL prove those cases and policy decisions SHALL persist stable reason-code/version references rather than only human prose.

---

---

## J00-CODE-10 — ASYNC / CANCELLATION / PROCESS OWNERSHIP

Long-running work SHALL have explicit lifecycle owner and cancellation primitive (`AbortSignal` or typed equivalent in TypeScript; owned cancellation/process handles in Rust).

No untracked detached authoritative promises/processes.

Cancellation distinguishes user cancel, timeout, provider failure, provider setup/repair, pause/preemption, process termination, and app shutdown.

Local cancellation does not prove external side effect absence; `UNCERTAIN`/live-state recovery applies.

All normal managed executable children use the semantic PlatformProcessSupervisor boundary.

On Windows V1 the backend SHALL preserve mandatory Job Object and handle-inheritance invariants. A UAC-launched provider setup helper may use a separately qualified native lifecycle, but it remains explicitly tracked/awaited/reconciled and never becomes a general breakaway-worker exception.

---

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

---

## J00-CODE-12 — LOGGING / OBSERVABILITY

Logging is structured and uses relevant correlation/mission/task/attempt/tool/provider/module/integration/platform identifiers.

Never log passwords/recovery factors, KDF-derived working keys, `DB_DEK`, `BackupDEK`, SQLCipher snapshot keys, raw OAuth/API tokens, authorization headers, private keys, provider-internal sandbox-account credentials, complete environment dumps, or arbitrary full AI context.

Prevent secret entry first; centralized redaction is defense in depth.

A mandatory audit write failure SHALL fail/rollback the authoritative state change when audit/state atomicity is required.

---

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

---

## J00-CODE-14 — MIGRATIONS

Migrations are monotonic, deterministic, reviewed, fixture-tested production code.

They SHALL NOT hide conversion failure by silently dropping data.

Changes to KDF profiles/verifiers/key slots, money precision, DataSensitivity/DataLocality, approvals/action descriptors, provider setup/module/platform identity, backup encryption, session recovery, path representation, or state enums include explicit compatibility tests.

---

---

## J00-CODE-15 — KDF / PASSWORD CODE

JARVIS SHALL have one validated implementation path for production KDF profiles. The exact Argon2id profile, salt/parameter floor, profile distinction, verifier/key-slot persistence, re-hash/re-wrap rules, comparison/zeroization requirements, and test-only restrictions are owned by J03-SEC-04 and J02-DATA-05 and SHALL be consumed without reinterpretation.

Code SHALL use a maintained reviewed implementation, qualified CSPRNG/backend, bounded accepted parameters, and fail closed on under-floor or malformed production metadata. Test-only reduced parameters SHALL be impossible to activate in a production release/configuration.

---

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

---

## J00-CODE-17 — CREDENTIAL / SECRET CODE

Credential and secret code SHALL implement the opaque-handle, broker, storage, environment-allowlist, and provider-setup boundaries owned by J03-SEC-06, J03-SEC-07, J03-SEC-23, J03-SEC-24, and the applicable J02 state rules. Core types SHALL not expose broad raw-token fields, resolve credentials directly, or depend on DPAPI.

Windows V1 uses the qualified Windows secure-storage path; future Linux storage is separately qualified and does not move secrets into portable Core state. Secret wrappers avoid ordinary serialization, `WORKSPACE_ENGINEERING` receives no unrelated integration secrets, and provider-owned setup credentials never enter Core/config/logs.

---

---

## J00-CODE-18 — APPROVAL CANONICALIZATION CODE

There is one implementation contract for `CanonicalActionDescriptorV1`, whose exact fields, canonicalization, digest, approval binding, and rejection vectors are owned by J01-PROTO-18, J01-PROTO-25, and J03-SEC-17.

Focused modules expose typed operations equivalent to:

```text
buildCanonicalAction(...resolved material...) -> CanonicalActionDescriptorV1
canonicalizeAction(descriptor) -> bytes
digestAction(bytes) -> SHA-256 bytes
encodeActionDigest(bytes) -> base64url-no-pad
```

Adapters/tools cannot independently omit/add material approval fields.

Rust and TypeScript pass shared golden vectors including duplicate-key/non-finite/negative-zero/Unicode/precision rejection.

---

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

---

## J00-CODE-20 — PROVIDER ADAPTER / SETUP / PLATFORM STANDARDS

Provider discovery, compatibility/platform identity, setup/repair, health/auth state, normalized events/errors, capabilities/resources, cancellation, supervisor behavior, routing, and conformance are owned by J01-RT-14/J01-RT-16, J01-PROTO-19, J03-SEC-23, and J04-OPS-14. Adapters SHALL expose those typed semantics and shall not turn provider availability or setup elevation into authority.

The Windows Codex qualification remains a separate native target: setup-helper identity, actual sandbox restrictions, no workspace-only isolation claim without proof, provider-update invalidation, and evidence identity are required. Future Linux evidence is not reusable for Windows or vice versa. Session-resume metadata stays in the adapter; durability stays in Core.

---

---

## J00-CODE-21 — TOOL ADAPTER STANDARDS

Every executable tool has one registered `ToolManifest` and bounded input/output schemas.

Tool implementation:

- accepts validated typed arguments;
- declares required semantic platform capabilities and optional explicit platform compatibility where native behavior differs;
- revalidates mutable security-critical preconditions before execution;
- never self-authorizes;
- uses only declared credential capabilities;
- uses conditional mutation where supported;
- returns typed outcome including `UNCERTAIN`;
- provides postcondition evidence for consequential success;
- emits audit/domain events through owning runtime;
- passes independent contract/platform tests.

Split broad multi-purpose tools when broadness materially increases blast radius or makes authorization/postconditions ambiguous.

---

---

## J00-CODE-22 — GITHUB ADAPTER STANDARDS

GitHub code SHALL expose only the typed semantic operations and exact V1 capability set owned by RP-09.1, J01-PROTO-21, and J05-VER-24. Generic repository/secret/branch-protection/membership administration, repository deletion, and ref deletion SHALL NOT be smuggled through those capabilities; `GITHUB_ACTIONS_DISPATCH` remains optional for V1.

`GITHUB_REF_WRITE` uses canonical repository/ref identity, allowed-target policy, and expected-ref/conditional mutation for create/update where applicable.

Credential scopes/permissions SHALL be the least privilege that supports the enabled capability set.

Remote GitHub semantic operations SHOULD remain platform-neutral; local Git/filesystem mechanics use the platform path/process boundary.

---

---

## J00-CODE-23 — PROXMOX ADAPTER STANDARDS

Proxmox code SHALL expose only the typed semantic operations, exact scope, TLS/credential boundary, asynchronous task/postcondition, and `UNCERTAIN` behavior owned by RP-09.2, J01-PROTO-21, J03-SEC-25, and J05-VER-25. It shall never expose a generic arbitrary REST endpoint to AI or silently fall back to SSH/`qm`/`pct`/`pvesh`/root/direct `/etc/pve`; guest-shell connection remains separate.

Guest-create/config/backup implementations SHALL preserve the narrower semantics defined by the Release Profile and SHALL NOT use those capabilities as aliases for generic datastore/network/PBS administration.

Remote Proxmox API semantics SHOULD remain platform-neutral; platform support still requires the concrete release to qualify its TLS/runtime/network/credential dependencies.

---

---

## J00-CODE-24 — MODULE CODE

Module execution classes, manifest compatibility, supervisor/health operations, authenticated catalog metadata, and platform-specific conformance are owned by J01-PROTO-20, J03-SEC-26/J03-SUPPLY, and J05-VER-26. Code SHALL preserve the `DATA_ONLY`, `BUILT_IN_TRUSTED`, and `EXTERNAL_MANAGED` class boundaries, including no execution for data-only content and no Core-internal imports for externally managed modules.

---

---

## J00-CODE-25 — TAURI/REACT / DESIGN-SYSTEM CODE

React is presentation/control, never authority. The Tauri/WebView security configuration and negative requirements are owned by J03-SEC-20 and J05-VER-12; the UI identity, design-token, brand-asset, typography, accessibility, state-language, adaptive-layout, and reusable-component requirements are owned by J04-UI-03–J04-UI-28 and J05-VER-11/J05-VER-35.

This code boundary SHALL consume those canonical capabilities and components, handle stale/conflict/degraded/recovery/platform-unavailable states, and never reimplement PermissionEngine to improve UX. Platform-native window authority remains behind PlatformWindowController.

Platform-native window behavior remains behind PlatformWindowController; React SHALL NOT own native platform presentation authority.

---

---

## J00-CODE-26 — BACKUP / RECOVERY CODE

Backup implementation SHALL use the exact hierarchy, key separation, fixed format, slot rules, restore order, bounded parser, and activation checks owned by J02-DATA-27 through J02-BACKUP-15 and the applicable J03 security clauses. Code SHALL preserve the Windows local secure-store slot, no plaintext snapshot-key sidecar, portable recovery without the historical local key, and the absence of a V1 cross-platform-restore guarantee.

---

---

## J00-CODE-27 — TEST CODE

Tests are production artifacts.

Prefer observable invariants over private implementation details. Security/state tests use deterministic fixtures/properties.

Mocks SHALL NOT replace required real Windows V1 integration tests against:

- actual selected SQLite/SQLCipher binding;
- Windows named-pipe DACL/bootstrap backend;
- Tauri capabilities/CSP/navigation configuration;
- Windows Job Objects/process trees;
- packaged Node/Core runtime;
- qualified Windows Codex executable/setup/sandbox;
- signed updater;
- GitHub/Proxmox conformance environments/fixtures where release qualification requires them;
- actual voice stack/devices for production qualification;
- representative UI viewport/DPI/accessibility behavior for production qualification.

CI/unit/architecture tests SHALL additionally verify platform boundary rules even though Linux runtime conformance is not a V1 gate.

Synthetic fixtures never contain real credentials.

Flaky tests are defects; blind rerun-to-green is not normal release policy.

---

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

---

## J00-CODE-30 — CONFIGURATION / FEATURE FLAGS

Configuration is typed/versioned/runtime-validated.

Security defaults fail safe. Unknown flags do not activate behavior.

Feature flags cannot bypass mandatory security/recovery/qualification/platform rules to make incomplete features appear functional.

Experimental provider/module/integration/platform paths remain visibly separate from Release Profile `SUPPORTED` functionality.

No production feature flag may enable an under-floor KDF, unqualified provider sandbox/platform backend, or optional integration capability without corresponding signed release support/conformance.

---

---

## J00-CODE-31 — CODE REVIEW REQUIREMENTS

Explicit invariant review is required for changes to:

- PermissionEngine/authority/approval;
- action canonicalization;
- KDF/password/recovery profiles;
- secure store/session recovery;
- platform capability interfaces/composition;
- IPC/native broker/process supervision/elevation mediation;
- Tauri capabilities/CSP/navigation/UI identity accessibility;
- path canonicalization/platform path identity;
- task/mission state machines;
- provider setup/sandbox/compatibility/platform support/fallback;
- database/WAL/migration/backup/restore;
- modules/catalog/update signing/platform compatibility;
- GitHub/Proxmox/other infrastructure integration capability matrices;
- release packaging/update/provenance.

Review verifies tests prove the invariant, not only that code looks plausible.

---

---

## J00-CODE-32 — ARCHITECTURE-ENFORCEMENT INVARIANTS

Production code/CI SHALL make these statements true:

1. UI cannot instantiate execution authority.
2. Provider adapters cannot mutate authoritative mission/task state directly.
3. Workers/tools cannot widen authority/scope.
4. Core domain types do not leak provider-native or OS-native implementation structures.
5. Unvalidated external/AI input cannot enter execution code.
6. Authoritative state transitions occur only through owning services.
7. PermissionEngine has one deterministic precedence implementation.
8. Approval hashing has one canonical implementation contract.
9. Authoritative DB writes cannot bypass transaction/version/event invariants.
10. Raw credentials cannot flow into normal domain/logging/backup channels.
11. Unsafe native code is narrowly contained/reviewed.
12. Long-running async/process work has cancellation/lifecycle ownership.
13. Shared process semantics use PlatformProcessSupervisor; Windows implementation satisfies mandatory Job Object policy.
14. Provider setup/sandbox claims match platform-specific conformance evidence.
15. Provider setup elevation never becomes normal worker elevation.
16. Consequential target changes are detected through fresh/conditional validation where supported.
17. Portable encrypted restore is technically complete, not only documented.
18. JARVIS-managed production KDF profiles meet the current floor and are versioned.
19. GitHub/Proxmox support claims cannot exceed the signed capability/platform matrix.
20. Canonical UI identity/assets/accessibility are release-tested, not optional styling.
21. CI plus the active qualified repository-governance mode enforce major package/security/config/history boundaries; server protection is mandatory when available and compensating controls remain explicit when it is not.
22. Shared Core/domain/policy/protocol code cannot import Windows-native backend implementations.
23. OS selection is concentrated in composition/platform adapters rather than scattered through domain/features.
24. Platform capability absence never triggers an unsafe weaker fallback.
25. Windows production mechanisms are not weakened for Linux portability.
26. Linux/companion support cannot be claimed without future explicit qualification.

---

---

## J00-CODE-33 — GOVERNING STANDARD

> **Prefer explicit, boring, testable code at trust, state, and platform boundaries. Cleverness is not an optimization when failure can authorize the wrong action, lose state, leak a secret, fabricate completion, or lock the architecture to one OS unnecessarily.**

> **Share product semantics; specialize native mechanisms.**

---

**END — JARVIS SCOPE, GOVERNANCE & CODING CONTRACT v1.0.8**
