# JARVIS Production Coding Standards Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`  
**Version:** 1.0.3  
**Date:** August 12, 2026

---

# 1. PURPOSE

These rules preserve the JARVIS trust, state, recovery, provider, UI, and integration architecture in actual code. They apply equally to human-written and AI-generated code.

Prefer explicit, bounded, testable code over cleverness at authority/state/security boundaries.

---

# 2. REPOSITORY BOUNDARIES

The monorepo SHALL preserve responsibilities equivalent to:

```text
apps/
  desktop/
    src/                 React presentation/read models
    src-tauri/           Rust native host/composition

services/
  core/                  authoritative Node/TypeScript runtime

packages/
  protocol/              cross-boundary contracts/types
  schemas/               runtime validators
  policy/                deterministic side-effect-free policy/state logic
  shared/                narrow non-domain utilities only

providers/
  ai/
  speech/
  integrations/

tools/
  windows/
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
  release/
```

Equivalent folder refinements are permitted only when authority/trust boundaries remain clear.

---

# 3. DEPENDENCY DIRECTION

- React SHALL not import Core persistence, provider implementations, secure-store code, process broker, or tool executors.
- Core/domain SHALL not depend on UI code.
- Provider-native types remain inside provider adapters; mission/task/domain models use canonical protocol types.
- Tools/integrations SHALL not bypass ToolExecutor, PermissionEngine, AuthorityEnvelopeService, Credential Broker, budget/locality checks, or audit.
- `packages/policy` SHALL be deterministic/side-effect-free except explicitly injected clocks/randomness/test inputs.
- `packages/shared` SHALL not become a hidden domain/service container.
- Circular package dependencies are prohibited.

CI SHALL enforce architecture/import boundaries where practical.

---

# 4. TYPESCRIPT BASELINE

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

`any` is not a trust-boundary escape hatch. A localized third-party typing exception must remain inside its adapter and validate before domain use.

Type assertions/non-null assertions SHALL not substitute for runtime validation or established invariants.

Authoritative money uses parsed exact integer/decimal logic, never JavaScript `number` arithmetic.

---

# 5. RUST BASELINE

Rust uses a pinned stable toolchain unless a reviewed platform requirement dictates otherwise.

Production gates include `cargo fmt --check` and `cargo clippy` with warnings denied, with narrow documented exceptions only when technically required.

Unsafe Rust:

- policy/protocol/business crates SHOULD forbid unsafe code;
- unsafe is confined to narrow Windows/FFI modules that require it;
- every unsafe block has a `SAFETY:` invariant explanation;
- wrappers expose safe typed interfaces;
- buffer length/nullability/ownership/handle lifetime/thread assumptions are explicit and tested;
- Windows handles/resources use RAII.

---

# 6. RUNTIME VALIDATION

Runtime schema validation occurs for:

- UI → Rust commands;
- Rust ↔ Core IPC;
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

# 7. STATE-MACHINE OWNERSHIP

Mission/task/attempt/approval/provider/module/integration transitions happen only through their owning services/policy modules.

UI, repositories, workers, provider adapters, and tools do not invent transitions directly.

Provider setup state is separate from provider compatibility/health and is owned by the provider setup/qualification service, not inferred by UI/provider worker code.

State transition logic SHOULD be deterministic/property-testable with exhaustive enum handling.

One durable `RESUMING` TaskState is canonical. Unknown persisted states fail closed/migrate explicitly; they never default to RUNNING/success.

---

# 8. PERMISSIONENGINE CODE

PermissionEngine SHALL implement the Security Contract's exact ordered precedence as deterministic policy code.

Rules MUST NOT be duplicated in UI/tool/provider adapters.

Tests SHALL prove:

- hard invariants dominate;
- explicit DENY dominates grants;
- current instruction and standing permission are distinguished;
- precedent never independently authorizes HIGH/CRITICAL;
- HIGH direct-instruction/standing-permission cases obey policy;
- CRITICAL/destructive always requires final confirmation;
- provider setup/elevation state cannot be bypassed by AI/tool policy;
- AI confidence has no authorization effect.

Policy decisions persist stable reason codes/version references rather than only human prose.

---

# 9. ASYNC / CANCELLATION / PROCESS OWNERSHIP

Long-running work SHALL have explicit lifecycle owner and cancellation primitive (`AbortSignal` or typed equivalent in TypeScript; owned cancellation/process/job handles in Rust).

No untracked detached authoritative promises/processes.

Cancellation distinguishes user cancel, timeout, provider failure, provider setup/repair, pause/preemption, process termination, and app shutdown.

Local cancellation does not prove external side effect absence; `UNCERTAIN`/live-state recovery applies.

All normal managed executable children use Rust Process Broker/approved equivalent preserving mandatory Job Object and handle-inheritance invariants. A UAC-launched provider setup helper may use a separately qualified native lifecycle, but it is still explicitly tracked/awaited/reconciled and never becomes a general breakaway-worker exception.

---

# 10. ERROR MODEL

Errors crossing package/process boundaries use stable typed `JarvisError` categories/codes.

Do not:

- swallow errors without defined state/diagnostic outcome;
- expose raw provider/native stack traces or secret payloads to UI/AI;
- parse human error text for security decisions when a structured signal exists;
- retry based only on error text or `retryable` flag.

Preserve secret-safe causal context internally and map to stable domain errors at boundaries.

Provider setup failures SHALL map to explicit setup/repair diagnostics rather than masquerade as generic worker/provider failure.

---

# 11. LOGGING / OBSERVABILITY

Logging is structured and uses relevant correlation/mission/task/attempt/tool/provider/module/integration identifiers.

Never log passwords/recovery factors, KDF-derived working keys, `DB_DEK`, `BackupDEK`, SQLCipher snapshot keys, raw OAuth/API tokens, authorization headers, private keys, provider-internal sandbox-account credentials, complete environment dumps, or arbitrary full AI context.

Prevent secret entry first; centralized redaction is defense in depth.

A mandatory audit write failure SHALL fail/rollback the authoritative state change when audit/state atomicity is required.

---

# 12. DATABASE ACCESS

Only Core persistence code mutates authoritative DB during normal operation.

SQL uses parameter binding.

State-changing repository methods expose transaction/expected-version boundaries.

Authorization/business policy stays out of repositories.

Every connection uses one owned initialization path that verifies foreign keys, WAL compatibility, synchronous policy, busy behavior, and release-qualified SQLite/SQLCipher identity.

Never hold write transactions while awaiting AI, network, external API, provider setup/UAC, long verification, user approval, or slow filesystem work.

WAL/checkpoint/integrity/busy metrics feed DiagnosticsService.

---

# 13. MIGRATIONS

Migrations are monotonic, deterministic, reviewed, fixture-tested production code.

They SHALL NOT hide conversion failure by silently dropping data.

Changes to KDF profiles/verifiers/key slots, money precision, DataSensitivity/DataLocality, approvals/action descriptors, provider setup/module identity, backup encryption, session recovery, or state enums include explicit compatibility tests.

---

# 14. KDF / PASSWORD CODE

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
- generate salts from the OS CSPRNG;
- store exact versioned parameters with the verifier/key slot;
- reject under-floor production profiles;
- bound accepted parameter values to avoid attacker-controlled resource exhaustion;
- distinguish `SESSION_PASSWORD` and `PORTABLE_RECOVERY` profiles;
- allow controlled re-hash/re-wrap after successful use under an older still-supported profile;
- use constant-time comparison and memory-zeroization facilities where the selected library/runtime reliably provides them.

Test-only reduced parameters SHALL be impossible to activate in a production release/configuration.

---

# 15. FILESYSTEM / CANONICAL TARGET CODE

All consequential filesystem targets use one trusted Windows-aware canonicalization/security layer.

Feature code SHALL NOT authorize with `startsWith(root)` or ad-hoc string normalization.

Canonicalization handles traversal, reparse/junction/symlink, UNC/alternate root, drive-root, aliases, and supported path identity cases.

Mutable high-risk/destructive targets are re-resolved immediately before execution.

Where possible, execution also uses expected file identity/hash/version to fail on post-authorization target changes.

---

# 16. CREDENTIAL / SECRET CODE

Core domain types use opaque credential handles/capabilities, not broad `token: string` fields.

Only trusted credential/integration adapters resolve handles.

Secret wrappers SHOULD avoid ordinary debug/string serialization where language/library supports safer types.

Child environments are constructed from allowlists, not cloned wholesale and redacted afterward.

`WORKSPACE_ENGINEERING` receives no unrelated integration secrets by default.

Provider-owned sandbox-user credentials created by provider setup are not normal JARVIS integration secrets and SHALL NOT be copied into Core/config/logs.

---

# 17. APPROVAL CANONICALIZATION CODE

There is one implementation contract for `CanonicalActionDescriptorV1`.

Focused modules expose typed operations equivalent to:

```text
buildCanonicalAction(...resolved material...) -> CanonicalActionDescriptorV1
canonicalizeAction(descriptor) -> bytes // RFC 8785 JCS + UTF-8
digestAction(bytes) -> SHA-256 bytes
encodeActionDigest(bytes) -> base64url-no-pad
```

Adapters/tools cannot independently omit/add material approval fields.

Rust and TypeScript pass shared golden vectors including duplicate-key/non-finite/negative-zero/Unicode/precision rejection.

---

# 18. CONDITIONAL MUTATION CODE

Consequential adapters SHALL expose expected-state/precondition inputs when upstream systems support them.

Examples:

- HTTP ETag/If-Match;
- Git expected ref/SHA;
- filesystem identity/hash;
- infrastructure generation/version;
- other CAS/precondition token.

A mismatch maps to typed `PRECONDITION`/`CONFLICT`, triggers re-resolution, and never silently executes against changed state under stale authorization.

---

# 19. PROVIDER ADAPTER / SETUP STANDARDS

Each provider adapter:

- discovers exact executable/distribution/runtime identity/version;
- implements setup state, compatibility policy, and health/auth state separately;
- normalizes native events/errors/output;
- advertises validated capabilities/locality/resources honestly;
- defines cancellation/Job Object behavior;
- excludes unsupported/unready versions from normal routing;
- passes common + provider-specific conformance.

For Codex Windows engineering:

- use a qualified stable structured/non-interactive surface;
- model `SETUP_REQUIRED`, `SETUP_IN_PROGRESS`, `SETUP_READY`, `REPAIR_REQUIRED`, and `SETUP_FAILED` explicitly when setup is required;
- validate the qualified provider distribution/setup-helper identity before asking the Rust host to invoke it;
- expose a bounded typed setup/repair request rather than a generic command/path;
- never run ordinary workers elevated because setup used UAC;
- test actual sandbox write and network restrictions;
- do not claim workspace-only read isolation unless proven;
- record selected setup/sandbox/profile behavior in qualification evidence;
- invalidate readiness/conformance after relevant provider updates;
- prevent provider-native shell/client availability from becoming JARVIS external authority.

Provider session resume logic remains adapter metadata; durability logic lives in Core.

---

# 20. TOOL ADAPTER STANDARDS

Every executable tool has one registered `ToolManifest` and bounded input/output schemas.

Tool implementation:

- accepts validated typed arguments;
- revalidates mutable security-critical preconditions before execution;
- never self-authorizes;
- uses only declared credential capabilities;
- uses conditional mutation where supported;
- returns typed outcome including `UNCERTAIN`;
- provides postcondition evidence for consequential success;
- emits audit/domain events through owning runtime;
- passes independent contract tests.

Split broad multi-purpose tools when broadness materially increases blast radius or makes authorization/postconditions ambiguous.

---

# 21. GITHUB ADAPTER STANDARDS

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

---

# 22. PROXMOX ADAPTER STANDARDS

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

---

# 23. MODULE CODE

Module execution class is mandatory.

`DATA_ONLY` parsers never eval/execute embedded script/native/WASM/shell content.

`BUILT_IN_TRUSTED` is release-owned first-party code.

`EXTERNAL_MANAGED` uses supervisor IPC and cannot import Core internals/database/secure-store implementation.

Health checks are typed supervisor operations, not arbitrary executable strings or URLs.

Module support requires authenticated release/catalog metadata and conformance.

---

# 24. TAURI/REACT / DESIGN-SYSTEM CODE

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
- pinned Tauri/runtime versions.

CI SHOULD statically inspect Tauri config/capability files for prohibited wildcard/remote-origin privilege where practical.

UI handles stale-version/conflict/degraded/recovery states explicitly and never reimplements PermissionEngine to improve UX.

Production UI SHALL:

- consume centralized design tokens/components rather than screen-local theme systems;
- consume canonical brand source assets from `assets/brand/` rather than recreate the logo;
- derive raster/ICO variants from the canonical vector sources;
- keep primary font available locally/offline;
- retain source/license/provenance for packaged fonts, icon libraries, and third-party visual assets;
- support keyboard/semantic accessibility, reduced motion, forced-colors/high-contrast adaptation where applicable, and qualified reflow/scaling rules.

---

# 25. BACKUP / RECOVERY CODE

Backup implementation SHALL use the Data Contract's exact hierarchy:

```text
live DB_DEK (local runtime only)
SQLite-safe snapshot
fresh SnapshotDBKey for snapshot
fresh per-backup BackupDEK for outer package
DPAPI and/or portable Argon2id key slots for BackupDEK
```

No plaintext snapshot key sidecar.

Portable key slots SHALL carry validated versioned KDF profile metadata and meet the production floor when created.

Portable restore must work without old DPAPI/live DB_DEK, then re-key restored DB under fresh local DB_DEK.

Backup package parser is bounded/versioned and authenticates before activating contents.

---

# 26. TEST CODE

Tests are production artifacts.

Prefer observable invariants over private implementation details. Security/state tests use deterministic fixtures/properties.

Mocks SHALL NOT replace required real integration tests against:

- actual selected SQLite/SQLCipher binding;
- Windows named-pipe DACL/bootstrap;
- Tauri capabilities/CSP/navigation configuration;
- Windows Job Objects/process trees;
- packaged Node/Core runtime;
- qualified Codex executable/setup/sandbox;
- signed updater;
- GitHub/Proxmox conformance environments/fixtures where release qualification requires them;
- actual voice stack/devices for production qualification;
- representative UI viewport/DPI/accessibility behavior for production qualification.

Synthetic fixtures never contain real credentials.

Flaky tests are defects; blind rerun-to-green is not normal release policy.

---

# 27. STATIC / CI GATES

Normal CI SHALL include as applicable:

```text
format/lint
TypeScript strict typecheck
Rust fmt/clippy warnings-as-errors
unit/property/schema tests
architecture/import boundary checks
Tauri capability/CSP config checks
design-token/brand-asset source checks where practical
secret scan
dependency/vulnerability scan
license/provenance checks for packaged dependencies/assets
stale generated-code detection
```

Security-sensitive packages should have strong meaningful branch coverage; target numbers shall not drive low-value tests.

Before Phase 0 completes, mandatory CI checks SHALL be attached to protected `master` through GitHub ruleset/branch-protection equivalent. Force pushes and branch deletion are prohibited; bypass is narrow/auditable.

---

# 28. DEPENDENCIES AND THIRD-PARTY ASSETS

Add dependencies only for a concrete product/engineering need.

Review maintenance, license, security, transitive surface, native packaging, Windows x64 support, and release/offline/update implications.

Runtime executable downloads occur only through explicit authenticated provider/module installation/update flows, never ordinary Core startup.

Production builds are reproducible from clean checkout + documented external prerequisites and pinned lockfiles/toolchains.

Fonts, icon libraries, images, audio models, and other redistributable third-party assets SHALL have source/version/license/provenance tracked with required notices. Primary UI assets/fonts SHALL not depend on a CDN at runtime.

---

# 29. CONFIGURATION / FEATURE FLAGS

Configuration is typed/versioned/runtime-validated.

Security defaults fail safe. Unknown flags do not activate behavior.

Feature flags cannot bypass mandatory security/recovery/qualification rules to make incomplete features appear functional.

Experimental provider/module/integration paths remain visibly separate from Release Profile `SUPPORTED` functionality.

No production feature flag may enable an under-floor KDF, unqualified provider sandbox, or optional integration capability without corresponding signed release support/conformance.

---

# 30. CODE REVIEW REQUIREMENTS

Explicit invariant review is required for changes to:

- PermissionEngine/authority/approval;
- action canonicalization;
- KDF/password/recovery profiles;
- secure store/session recovery;
- IPC/native broker/Job Objects/elevation mediation;
- Tauri capabilities/CSP/navigation/UI identity accessibility;
- path canonicalization;
- task/mission state machines;
- provider setup/sandbox/compatibility/fallback;
- database/WAL/migration/backup/restore;
- modules/catalog/update signing;
- GitHub/Proxmox/other infrastructure integration capability matrices;
- release packaging/update/provenance.

Review verifies tests prove the invariant, not only that code looks plausible.

---

# 31. ARCHITECTURE-ENFORCEMENT INVARIANTS

Production code/CI SHALL make these statements true:

1. UI cannot instantiate execution authority.
2. Provider adapters cannot mutate authoritative mission/task state directly.
3. Workers/tools cannot widen authority/scope.
4. Core domain types do not leak provider-native structures.
5. Unvalidated external/AI input cannot enter execution code.
6. Authoritative state transitions occur only through owning services.
7. PermissionEngine has one deterministic precedence implementation.
8. Approval hashing has one canonical implementation contract.
9. Authoritative DB writes cannot bypass transaction/version/event invariants.
10. Raw credentials cannot flow into normal domain/logging/backup channels.
11. Unsafe native code is narrowly contained/reviewed.
12. Long-running async/process work has cancellation/lifecycle ownership.
13. Managed executable trees satisfy Job Object policy; elevation helpers use only a separately qualified bounded lifecycle.
14. Provider setup/sandbox claims match conformance evidence.
15. Provider setup elevation never becomes normal worker elevation.
16. Consequential target changes are detected through fresh/conditional validation where supported.
17. Portable encrypted restore is technically complete, not only documented.
18. JARVIS-managed production KDF profiles meet the current floor and are versioned.
19. GitHub/Proxmox support claims cannot exceed the signed capability matrix.
20. Canonical UI identity/assets/accessibility are release-tested, not optional styling.
21. CI and repository protection enforce the major package/security/config/history boundaries.

---

# 32. GOVERNING STANDARD

> **Prefer explicit, boring, testable code at trust and state boundaries. Cleverness is not an optimization when failure can authorize the wrong action, lose state, leak a secret, or fabricate completion.**

---

**END — JARVIS PRODUCTION CODING STANDARDS CONTRACT v1.0.3**
