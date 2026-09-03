# JARVIS Production Coding Standards Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.7.md`
**Version:** 1.0.6
**Date:** August 18, 2026

---

# 1. PURPOSE

These rules preserve the JARVIS trust, state, recovery, provider, UI, integration, and platform architecture in actual code. They apply equally to human-written and AI-generated code.

Prefer explicit, bounded, testable code over cleverness at authority/state/security boundaries.

> **Abstract the capability, not the security away.**

---

# 2. REPOSITORY BOUNDARIES

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

# 3. DEPENDENCY DIRECTION AND PLATFORM PORTABILITY

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

# 4. PLATFORM CAPABILITY CONTRACTS

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

# 5. TYPESCRIPT BASELINE

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

# 6. RUST BASELINE

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

# 7. RUNTIME VALIDATION

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

# 8. STATE-MACHINE OWNERSHIP

Mission/task/attempt/approval/provider/module/integration transitions happen only through their owning services/policy modules.

UI, repositories, workers, provider adapters, platform adapters, and tools do not invent transitions directly.

Provider setup state is separate from provider compatibility/health/platform support and is owned by the provider setup/qualification service, not inferred by UI/provider worker code.

State transition logic SHOULD be deterministic/property-testable with exhaustive enum handling.

One durable `RESUMING` TaskState is canonical. Unknown persisted states fail closed/migrate explicitly; they never default to RUNNING/success.

---

# 9. PERMISSIONENGINE CODE

PermissionEngine SHALL implement the Security Contract's exact ordered precedence as deterministic policy code.

Rules MUST NOT be duplicated in UI/tool/provider/platform adapters.

Tests SHALL prove:

- hard invariants dominate;
- explicit DENY dominates grants;
- current instruction and standing permission are distinguished;
- precedent never independently authorizes HIGH/CRITICAL;
- HIGH direct-instruction/standing-permission cases obey policy;
- CRITICAL/destructive always requires final confirmation;
- provider setup/elevation/platform state cannot be bypassed by AI/tool policy;
- platform capability availability is not authorization;
- AI confidence has no authorization effect.

Policy decisions persist stable reason codes/version references rather than only human prose.

---

# 10. ASYNC / CANCELLATION / PROCESS OWNERSHIP

Long-running work SHALL have explicit lifecycle owner and cancellation primitive (`AbortSignal` or typed equivalent in TypeScript; owned cancellation/process handles in Rust).

No untracked detached authoritative promises/processes.

Cancellation distinguishes user cancel, timeout, provider failure, provider setup/repair, pause/preemption, process termination, and app shutdown.

Local cancellation does not prove external side effect absence; `UNCERTAIN`/live-state recovery applies.

All normal managed executable children use the semantic PlatformProcessSupervisor boundary.

On Windows V1 the backend SHALL preserve mandatory Job Object and handle-inheritance invariants. A UAC-launched provider setup helper may use a separately qualified native lifecycle, but it remains explicitly tracked/awaited/reconciled and never becomes a general breakaway-worker exception.

---

# 11. ERROR MODEL

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

# 12. LOGGING / OBSERVABILITY

Logging is structured and uses relevant correlation/mission/task/attempt/tool/provider/module/integration/platform identifiers.

Never log passwords/recovery factors, KDF-derived working keys, `DB_DEK`, `BackupDEK`, SQLCipher snapshot keys, raw OAuth/API tokens, authorization headers, private keys, provider-internal sandbox-account credentials, complete environment dumps, or arbitrary full AI context.

Prevent secret entry first; centralized redaction is defense in depth.

A mandatory audit write failure SHALL fail/rollback the authoritative state change when audit/state atomicity is required.

---

# 13. DATABASE ACCESS

Only Core persistence code mutates authoritative DB during normal operation.

SQL uses parameter binding.

State-changing repository methods expose transaction/expected-version boundaries.

Authorization/business policy stays out of repositories.

Every connection uses one owned initialization path that verifies foreign keys, WAL compatibility, synchronous policy, busy behavior, and release-qualified SQLite/SQLCipher identity.

Never hold write transactions while awaiting AI, network, external API, provider setup/UAC, long verification, user approval, or slow filesystem work.

WAL/checkpoint/integrity/busy metrics feed DiagnosticsService.

Logical durable state SHOULD remain platform-neutral. Inherently platform-specific metadata SHALL be typed/namespaced and not become universal domain identity.

---

# 14. MIGRATIONS

Migrations are monotonic, deterministic, reviewed, fixture-tested production code.

They SHALL NOT hide conversion failure by silently dropping data.

Changes to KDF profiles/verifiers/key slots, money precision, DataSensitivity/DataLocality, approvals/action descriptors, provider setup/module/platform identity, backup encryption, session recovery, path representation, or state enums include explicit compatibility tests.

---

# 15. KDF / PASSWORD CODE

JARVIS SHALL have one validated implementation path for production KDF profiles.

Production profiles use Argon2id version `0x13` with at least:

```text
memoryKiB >= 65536
iterations >= 3
parallelism = 4
saltBytes >= 16
outputBytes >= 32
```

Code SHALL:

- use a maintained reviewed Argon2id implementation rather than custom cryptography;
- generate salts from the OS CSPRNG through an appropriate qualified runtime/backend;
- store exact versioned parameters with the verifier/key slot;
- reject under-floor production profiles;
- bound accepted parameter values to avoid attacker-controlled resource exhaustion;
- distinguish `SESSION_PASSWORD` and `PORTABLE_RECOVERY` profiles;
- allow controlled re-hash/re-wrap after successful use under an older still-supported profile;
- use constant-time comparison and memory-zeroization facilities where the selected library/runtime reliably provides them.

Test-only reduced parameters SHALL be impossible to activate in a production release/configuration.

---

# 16. FILESYSTEM / CANONICAL TARGET CODE

All consequential filesystem targets use one trusted platform-aware canonicalization/security contract.

Feature/domain code SHALL NOT authorize with `startsWith(root)` or ad-hoc string normalization.

The shared Project/Workspace model uses platform-tagged path identity rather than assuming Windows path syntax globally.

Windows V1 backend SHALL handle traversal, reparse/junction/symlink, UNC/alternate root, drive-root, aliases/case identity, and supported Windows path identity cases.

A future Linux backend SHALL separately handle Linux symlink/mount/root/case/filesystem identity semantics.

Mutable high-risk/destructive targets are re-resolved immediately before execution.

Where possible, execution also uses expected file identity/hash/version to fail on post-authorization target changes.

---

# 17. CREDENTIAL / SECRET CODE

Core domain types use opaque credential handles/capabilities, not broad `token: string` fields.

Only trusted credential/integration adapters resolve handles.

Core depends on a semantic PlatformSecureStorage/Credential Broker boundary, not DPAPI directly.

Windows V1 uses the qualified Windows secure-storage implementation. Future Linux secure storage must be separately qualified and does not justify moving secrets into portable Core state.

Secret wrappers SHOULD avoid ordinary debug/string serialization where language/library supports safer types.

Child environments are constructed from allowlists, not cloned wholesale and redacted afterward.

`WORKSPACE_ENGINEERING` receives no unrelated integration secrets by default.

Provider-owned sandbox-user credentials created by provider setup are not normal JARVIS integration secrets and SHALL NOT be copied into Core/config/logs.

---

# 18. APPROVAL CANONICALIZATION CODE

There is one implementation contract for `CanonicalActionDescriptorV1`.

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

# 19. CONDITIONAL MUTATION CODE

Consequential adapters SHALL expose expected-state/precondition inputs when upstream systems support them.

Examples:

- HTTP ETag/If-Match;
- Git expected ref/SHA;
- filesystem identity/hash;
- infrastructure generation/version;
- other CAS/precondition token.

A mismatch maps to typed `PRECONDITION`/`CONFLICT`, triggers re-resolution, and never silently executes against changed state under stale authorization.

---

# 20. PROVIDER ADAPTER / SETUP / PLATFORM STANDARDS

Each provider adapter:

- discovers exact executable/distribution/runtime identity/version;
- declares matching PlatformFamily/RuntimeRole compatibility;
- implements setup state, compatibility policy, platform support, and health/auth state separately;
- normalizes native events/errors/output;
- advertises validated capabilities/locality/resources honestly;
- defines cancellation/PlatformProcessSupervisor behavior;
- excludes unsupported/unready/unqualified platform versions from normal routing;
- passes common + provider/platform-specific conformance.

For Codex Windows engineering:

- use a qualified stable structured/non-interactive surface;
- model setup states explicitly when setup is required;
- validate the qualified distribution/setup-helper identity before asking the Rust host to invoke it;
- expose a bounded typed setup/repair request rather than a generic command/path;
- never run ordinary workers elevated because setup used UAC;
- test actual sandbox write and network restrictions;
- do not claim workspace-only read isolation unless proven;
- record selected setup/sandbox/profile/platform behavior in qualification evidence;
- invalidate readiness/conformance after relevant provider updates;
- prevent provider-native shell/client availability from becoming JARVIS external authority.

A future Linux Codex/provider implementation is a separate platform adapter/conformance target. Windows evidence cannot be reused as Linux sandbox/process evidence merely because provider protocol output is similar.

Provider session resume logic remains adapter metadata; durability logic lives in Core.

---

# 21. TOOL ADAPTER STANDARDS

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

# 22. GITHUB ADAPTER STANDARDS

GitHub code SHALL expose typed semantic operations mapped to the active Release Profile capability matrix.

V1 mandatory capability types are:

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

`GITHUB_ACTIONS_DISPATCH` is optional for V1. Generic repository administration, secret administration, branch-protection administration, membership administration, repository deletion, and ref deletion SHALL NOT be smuggled through these capabilities.

`GITHUB_REF_WRITE` uses canonical repository/ref identity, allowed-target policy, and expected-ref/conditional mutation for create/update where applicable.

Credential scopes/permissions SHALL be the least privilege that supports the enabled capability set.

Remote GitHub semantic operations SHOULD remain platform-neutral; local Git/filesystem mechanics use the platform path/process boundary.

---

# 23. PROXMOX ADAPTER STANDARDS

Proxmox code SHALL expose typed semantic operations, never a generic arbitrary REST endpoint to AI.

It SHALL:

- use HTTPS REST API normal path;
- obtain token through Credential Broker;
- verify TLS/pin policy;
- resolve connection/environment/node/guestType/vmid identity;
- enforce active Release Profile capability matrix and node/vmid/pool scope;
- track asynchronous task identifiers;
- verify terminal state/postconditions;
- map ambiguous writes to `UNCERTAIN`;
- never silently fall back to SSH/`qm`/`pct`/`pvesh`/root/direct `/etc/pve`;
- keep guest-shell connection separate.

Guest-create/config/backup implementations SHALL preserve the narrower semantics defined by the Release Profile and SHALL NOT use those capabilities as aliases for generic datastore/network/PBS administration.

Remote Proxmox API semantics SHOULD remain platform-neutral; platform support still requires the concrete release to qualify its TLS/runtime/network/credential dependencies.

---

# 24. MODULE CODE

Module execution class is mandatory.

`DATA_ONLY` parsers never eval/execute embedded script/native/WASM/shell content.

`BUILT_IN_TRUSTED` is release-owned first-party code.

`EXTERNAL_MANAGED` uses supervisor IPC and cannot import Core internals/database/secure-store implementation.

Module manifests declare platform/runtime-role compatibility through the canonical protocol rather than a Windows-only compatibility field.

Health checks are typed supervisor operations, not arbitrary executable strings or URLs.

Module support requires authenticated release/catalog metadata and platform-specific conformance where native execution/dependencies differ.

---

# 25. TAURI/REACT / DESIGN-SYSTEM CODE

React is presentation/control, never authority.

Production Tauri configuration is code-reviewed/security-tested:

- explicit capability files/allowlists;
- no privileged remote origins;
- restrictive CSP;
- no remote executable script/CDN by default;
- navigation restrictions;
- external link handling outside privileged WebView;
- sanitized inert untrusted HTML/Markdown;
- production devtools policy;
- pinned/qualified Tauri/runtime versions.

CI SHOULD statically inspect Tauri config/capability files for prohibited wildcard/remote-origin privilege where practical.

UI handles stale-version/conflict/degraded/recovery/platform-unavailable states explicitly and never reimplements PermissionEngine to improve UX.

Production UI SHALL:

- consume centralized design tokens/components rather than screen-local/platform-local theme systems;
- consume canonical brand source assets from `assets/brand/` rather than recreate the logo;
- derive raster/platform icon variants from canonical vector sources;
- keep primary font available locally/offline;
- retain source/license/provenance for packaged fonts, icon libraries, and third-party visual assets;
- support keyboard/semantic accessibility, reduced motion, forced-colors/high-contrast adaptation where applicable, and qualified reflow/scaling rules;
- keep core Mission Control component semantics reusable for future Linux/companion presentation unless a concrete platform UX difference requires an adapter/component specialization.

Platform-native window behavior remains behind PlatformWindowController; React SHALL NOT own native platform presentation authority.

---

# 26. BACKUP / RECOVERY CODE

Backup implementation SHALL use the Data Contract's exact hierarchy:

```text
live DB_DEK (local runtime only)
SQLite-safe snapshot
fresh SnapshotDBKey for snapshot
fresh per-backup BackupDEK for outer package
platform-local and/or portable Argon2id key slots for BackupDEK
```

On Windows V1 the local slot uses the qualified Windows DPAPI/secure-store path.

No plaintext snapshot key sidecar.

Portable key slots SHALL carry validated versioned KDF profile metadata and meet the production floor when created. Their cryptographic recovery path SHALL NOT require the historical platform-local secure-store key.

Portable Windows restore must work without old DPAPI/live DB_DEK, then re-key restored DB under fresh local DB_DEK.

Cross-platform restore is not a current V1 guarantee.

Backup package parser is bounded/versioned and authenticates before activating contents.

---

# 27. TEST CODE

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

# 28. STATIC / CI GATES

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

The mandatory pipeline SHALL be executable without weakening its gate set by either qualified authority type: `GITHUB_ACTIONS` or `LOCALCI`. Authority adapters MAY differ, but the repository-owned checks, exact candidate SHA, pinned/frozen inputs, aggregate fail-closed semantics, and evidence fields SHALL remain semantically equivalent. One qualified authority's complete pass is sufficient; two partial runs are not.

GitHub Actions workflows SHALL retain immutable action pins and least-privilege permissions while selected. LocalCI pipelines SHALL use a repository-owned script/profile, authenticated allowlisted submission, server-side commit resolution, isolated rootless execution, and no arbitrary command/image/mount/path/device/network authority. CI control-plane credentials SHALL never enter job containers. Material authority or pipeline changes require requalification.

CI SHALL detect direct imports of Windows native implementations from shared Core/domain/policy/protocol packages where practical.

Security-sensitive packages should have strong meaningful branch coverage; target numbers shall not drive low-value tests.

Before Phase 0 completes, repository-governance mode SHALL follow the verified hosting provider/account capability.

When server-side branch protection or repository rulesets are available, mandatory CI checks SHALL be attached to protected `master`; force pushes and branch deletion are prohibited and bypass SHALL be narrow/auditable.

If server-side protection/rulesets are unavailable because of a verified hosting plan/platform capability limitation, `COMPENSATING_CONTROLS` MAY be used only with temporary implementation branches, mandatory CI on the exact candidate commit, immediate live `master` tip revalidation and stale-movement reconciliation, non-force integration, post-integration tip/diff/CI/audit verification, and truthful reporting that `master` is not server-protected.

The fallback SHALL NOT weaken or waive mandatory CI and SHALL end when effective server-side protection becomes available.

---

# 29. DEPENDENCIES AND THIRD-PARTY ASSETS

Add dependencies only for a concrete product/engineering need.

Review maintenance, license, security, transitive surface, native packaging, Windows x64 support, and release/offline/update implications.

For dependencies used by shared Core/domain/UI code, future Linux portability SHOULD be considered before choosing a Windows-only dependency when an equally strong maintained platform-neutral option exists. This is not a mandate to choose an inferior abstraction or weaken Windows behavior.

A Windows-only dependency is acceptable inside the Windows backend when it is the correct production mechanism.

Runtime executable downloads occur only through explicit authenticated provider/module installation/update flows, never ordinary Core startup.

Production builds are reproducible from clean checkout + documented external prerequisites and pinned lockfiles/toolchains.

Fonts, icon libraries, images, audio models, and other redistributable third-party assets SHALL have source/version/license/provenance tracked with required notices. Primary UI assets/fonts SHALL not depend on a CDN at runtime.

---

# 30. CONFIGURATION / FEATURE FLAGS

Configuration is typed/versioned/runtime-validated.

Security defaults fail safe. Unknown flags do not activate behavior.

Feature flags cannot bypass mandatory security/recovery/qualification/platform rules to make incomplete features appear functional.

Experimental provider/module/integration/platform paths remain visibly separate from Release Profile `SUPPORTED` functionality.

No production feature flag may enable an under-floor KDF, unqualified provider sandbox/platform backend, or optional integration capability without corresponding signed release support/conformance.

---

# 31. CODE REVIEW REQUIREMENTS

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

# 32. ARCHITECTURE-ENFORCEMENT INVARIANTS

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

# 33. GOVERNING STANDARD

> **Prefer explicit, boring, testable code at trust, state, and platform boundaries. Cleverness is not an optimization when failure can authorize the wrong action, lose state, leak a secret, fabricate completion, or lock the architecture to one OS unnecessarily.**

> **Share product semantics; specialize native mechanisms.**

---

**END — JARVIS PRODUCTION CODING STANDARDS CONTRACT v1.0.6**
