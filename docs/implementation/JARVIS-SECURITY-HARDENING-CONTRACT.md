# JARVIS Security Hardening Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`  
**Version:** 1.0.4  
**Date:** August 17, 2026

---

# 1. PURPOSE

JARVIS is a high-trust desktop assistant capable of reading private data, modifying repositories, using connected accounts, and managing infrastructure. Security SHALL be implemented by deterministic software/OS boundaries, not by asking AI output to behave safely.

---

# 2. SECURITY PRINCIPLES

1. **AI decides. Software authorizes. Software verifies.**
2. Authentication establishes the authoritative user channel; it is not blanket authority.
3. Credential possession is not action authorization.
4. External content is data, not policy.
5. Historical precedent is evidence, not a permission grant.
6. Destructive/materially unrecoverable actions always require fresh final confirmation.
7. Least privilege applies to renderer, Core, providers, workers, tools, modules, integrations, credentials, IPC, and elevation helpers.
8. Unknown security-critical identity/target/scope/policy/integrity fails closed.
9. No sandbox/OS guarantee may be described as stronger than qualified behavior.
10. Secrets are excluded by design before redaction.
11. Recoverability is part of data-protection correctness.
12. A provider's technical ability does not expand JARVIS authority.
13. Setup/install elevation does not become runtime authority.

---

# 3. THREAT MODEL

V1 explicitly addresses:

- prompt injection in web/email/documents/source/logs/issues/tool output/integration events;
- malicious/malformed/hallucinated AI/provider output;
- stale memory/external state;
- accidental ambiguous/destructive instructions;
- target/account/environment confusion;
- credential/key leakage through prompts/env/logs/journals/artifacts/crashes;
- tampered modules/application/provider setup/update artifacts;
- compromised/untrusted external API responses;
- runaway workers/resource exhaustion;
- permissive local IPC/filesystem mistakes;
- event/approval replay;
- confused-deputy credential use;
- unsafe retry after uncertain external effects;
- worker shell escaping intended JARVIS authority;
- renderer/WebView injection or remote-origin privilege exposure;
- provider setup/UAC confused-deputy or elevation leakage;
- offline database/backup theft;
- original Windows profile/machine loss;
- locked-session voice/private-data leakage.

V1 does not claim hard protection from:

- compromised Administrator/kernel;
- malicious firmware/hardware;
- physical control of an already-unlocked Windows + JARVIS session;
- arbitrary malicious code already running with equivalent same-user/logon rights and sufficient local process access;
- external provider compromise beyond minimizing exposed data/authority.

DPAPI/Credential Manager/ACLs materially protect at rest and across principals but are not represented as a perfect same-user malware sandbox.

---

# 4. SESSION PASSWORD, ARGON2ID, AND RECOVERY

The session password exists only to establish JARVIS session trust. It is not an integration credential or DB key.

V1 JARVIS-managed password/recovery KDF profiles SHALL use Argon2id version `0x13`.

Minimum production floor:

```text
memory:      >= 65536 KiB
passes:      >= 3
parallelism: 4
salt:        >= 16 cryptographically random bytes
output:      >= 32 bytes
```

Session-password and portable-recovery profiles SHALL be separate, versioned profiles. Release calibration MAY raise memory/time cost but SHALL NOT silently reduce below this floor without a new reviewed security-contract revision.

The exact KDF profile/parameters and salt needed to verify an existing verifier/key slot SHALL be stored with or immutably referenced by that verifier/key slot. The plaintext password/recovery factor and derived working key are not stored.

After successful authentication using an older still-supported profile, JARVIS MAY atomically re-hash under the current stronger profile. Verification comparison SHALL use a constant-time primitive where the selected library/runtime exposes one appropriate to the representation. Secret working buffers SHOULD be zeroized/cleared as soon as practical where the language/library provides reliable support.

Portable recovery SHOULD use materially higher memory than the session-password floor when the qualified hardware baseline keeps recovery practical, because it is an infrequent operation.

Unlock attempts use rate limiting and progressive cooldown. Plaintext password/verifier-derived secret material is not logged.

Changing the password requires an unlocked session and explicit confirmation.

There is no weak “forgot password because Windows is logged in” bypass.

A verified portable JARVIS recovery factor MAY be used in an explicit recovery workflow to establish a new session password after the recovery factor and state/recovery preconditions are authenticated. Without such a factor, the Argon2id verifier is not reversible.

Clean-machine portable restore creates a new session password after successful state decryption/validation.

Session-password changes never silently invalidate portable state backups.

---

# 5. WINDOWS LOCK

Native host observes Windows lock/sign-out and authoritatively drives JARVIS lock state.

While locked:

- private UI content is hidden/redacted;
- private/sensitive speech stops;
- sensitive notifications are deferred/redacted;
- new consequential work is not accepted from unauthenticated input;
- already-authorized background work may continue only under its task policy;
- pending approvals are not silently consumed after unlock without normal revalidation.

---

# 6. WINDOWS SECURE STORAGE / CREDENTIAL BROKER

Long-lived credentials, local `DB_DEK` wrapping material, and other designated secrets use Windows-backed secure storage through Rust.

Core/domain/persistence stores opaque handles, not raw tokens/keys.

The broker API is narrow and context-scoped, conceptually:

```text
put_secret(scope, metadata, value) -> handle
get_secret(handle, requesting_adapter_capability) -> transient value
rotate_secret(handle)
delete_secret(handle)
```

AI/UI/provider code cannot enumerate all secrets. Secret handles supplied by untrusted AI output are not sufficient to retrieve a secret; requesting component/capability/account/scope is resolved independently.

Secrets are excluded from normal environment inheritance, logs, journals, artifacts, UI state, AI context, and ordinary backups.

Provider-internal Windows sandbox-account credentials created/managed by a qualified provider setup process are not imported into JARVIS as general Credential Broker secrets unless a future explicit integration contract requires it.

---

# 7. DATABASE/BACKUP SECRET BOUNDARY

The live database uses a random local `DB_DEK` protected through Windows secure storage.

Backup packages use independent per-backup `BackupDEK` and backup-specific SQLCipher snapshot key semantics from the Data Contract. The portable recovery factor derives a key using the exact recorded qualified KDF profile and wraps/unlocks `BackupDEK`; it does not become the live DB key.

A clean-profile restore obtains the backup snapshot key only after authenticating/decrypting the backup package, then re-keys restored state under a fresh local `DB_DEK`.

Ordinary portable/local state backups do not contain raw integration credentials.

---

# 8. DATA POLICY

Canonical policy is:

```text
DataSensitivity: PUBLIC | PRIVATE | SENSITIVE | SECRET
DataLocality:    LOCAL_ONLY | ANY_APPROVED_PROVIDER
```

`SECRET` normally remains only in secure store/trusted adapter memory.

`LOCAL_ONLY` prohibits cloud/LAN/remote provider routing.

Derived data inherits the strictest input policy unless deterministic audited declassification/export explicitly changes it. AI summarization never declassifies by itself.

---

# 9. PROMPT-INJECTION / CONTENT AUTHORITY

The following are untrusted content unless Core deterministically classifies them as a permitted scoped policy source:

- web/email/document/attachment content;
- source code, README, issue/PR text;
- logs/database query output;
- tool/provider/integration output;
- external event payloads;
- AI output.

Untrusted content cannot:

- grant permission or standing authority;
- alter authority envelope/execution scope;
- waive final confirmation;
- retrieve raw credentials;
- request elevation/provider setup as a trusted action by text alone;
- change DataLocality/DataSensitivity;
- expand project/environment/account scope;
- bypass budget/resource policy;
- disable audit;
- install/authorize modules;
- change security settings.

External text such as `SYSTEM:`/`ADMIN:` remains content, not policy.

---

# 10. TRUSTED INSTRUCTION SOURCES

Potential scoped instruction sources after deterministic resolution include:

- authenticated current user instruction;
- accepted standing permissions/policies;
- Core-owned task/mission specification;
- global JARVIS policy;
- registered project policy such as `AGENTS.md` located inside the resolved project root.

Project policy remains subordinate to global security, locality, permission, budget, destructive-confirmation, credential, provider-setup, and update policy.

Path traversal/reparse behavior cannot make an out-of-root file become trusted project policy.

---

# 11. CONTEXT PACKAGING

AI context is intentionally assembled and labeled by authority/source, for example:

```text
SYSTEM POLICY
USER INSTRUCTION
PROJECT POLICY
VERIFIED STATE
RETRIEVED MEMORY
UNTRUSTED EXTERNAL CONTENT
TASK ARTIFACTS
```

Only the smallest useful context is sent. Repository-wide/full-history context is not a default.

No context builder may downgrade locality/sensitivity to obtain a preferred provider.

---

# 12. STRUCTURED AI OUTPUT

AI output is attacker-controlled input to execution.

Runtime validation rejects malformed/unknown-required fields, invalid enums/IDs, out-of-scope paths/resources, excessive size/depth, unresolved consequential references, locality violations, and arguments inconsistent with authority/scope.

A bounded repair/reformat attempt may be requested for syntactic invalidity. Repeated failure blocks rather than enabling permissive parsers.

AI confidence is never an authorization input.

---

# 13. DETERMINISTIC PERMISSION ENGINE PRECEDENCE

PermissionEngine is the authoritative action-admission algorithm.

It SHALL evaluate in this order:

1. **Mandatory system invariant.** Destructive-final-confirmation rules, local-only routing, secret-protection, renderer/Core separation, provider-setup/elevation separation, required integrity checks, and other non-waivable safety rules are evaluated first.
2. **Explicit applicable DENY.** A matching deny blocks normal execution. Changing/revoking the policy is a separate explicitly authorized policy action; a conflicting ordinary instruction does not silently override the deny.
3. **Session/automation eligibility.** Establish a valid authenticated session or already-approved automation/event authority as applicable.
4. **Authority-envelope containment.** Concrete action/scope/external system must fit the immutable envelope.
5. **Capability and identity resolution.** Required tool/integration/provider capability and canonical target/account/environment identities must be valid.
6. **Locality, budget, resource, integrity, provider setup, and precondition gates.** Any mandatory failure blocks/queues/requires recovery/setup as defined.
7. **Current explicit instruction authority.** Determine whether the user's current instruction directly authorizes the resolved action class/target/scope.
8. **Standing permission.** If current instruction is not sufficient by itself, an explicit matching non-expired standing permission may provide authority within its exact scope.
9. **Risk/approval gate.** Apply the risk-class rule below.
10. **ALLOW.** Only if all prior gates are satisfied.

Mandatory invariants and explicit DENY dominate any grant.

---

# 14. RISK CLASS AUTHORIZATION

Canonical risk classes are LOW, MODERATE, HIGH, CRITICAL.

### LOW

May execute automatically when inside the current authority envelope and no prior gate blocks it.

### MODERATE

May execute automatically when reasonably subordinate to the current explicit instruction or covered by an explicit scoped standing permission. Material scope expansion requires clarification/authorization.

### HIGH

Precedent alone can never authorize HIGH work.

HIGH may execute without a new per-action prompt only when **either**:

- the current authenticated user instruction directly and unambiguously authorizes that same resolved HIGH action/target/scope and policy permits direct instruction as sufficient; or
- a dedicated explicit standing permission authorizes that specific action class/target/environment/account scope and policy permits standing authorization for that HIGH class.

Otherwise HIGH returns `REQUIRE_APPROVAL`.

A HIGH operation that is destructive/materially unrecoverable is governed by CRITICAL/destructive rules instead.

### CRITICAL / destructive / materially unrecoverable

Always requires fresh final confirmation immediately before execution, even if the original instruction or a standing permission requested/allowed it. No precedent, AI confidence, credential, or standing policy waives final confirmation.

---

# 15. PRECEDENT

Precedent may:

- help interpret whether LOW/MODERATE reversible subordinate work is within user intent;
- influence clarification UX;
- suggest creation of an explicit standing permission.

Precedent SHALL NOT:

- independently authorize HIGH/CRITICAL work;
- create a new environment/account/project scope;
- authorize security/policy changes;
- waive final confirmation;
- convert development behavior into production authority.

---

# 16. PATH / RESOURCE IDENTITY

Consequential filesystem paths and external resource targets are canonicalized/resolved before authorization.

Filesystem protections include traversal, junction/symlink/reparse escape, alternate drive/UNC roots, unintended root targeting, path alias/case identity, and broad wildcard scope.

External targets use stable repository/branch/ref/account/environment/resource IDs, not display labels alone.

If canonical identity cannot be established, JARVIS clarifies/blocks rather than approving the ambiguous raw string.

---

# 17. APPROVAL ACTION BINDING

Final/high-risk approvals bind exactly to `CanonicalActionDescriptorV1`.

Canonical pipeline:

```text
schema validation
→ RFC 8785 JCS
→ UTF-8
→ SHA-256
→ base64url without padding
```

Before issuance, resolve all material tool/target/account/environment/scope/arguments/policy identity.

Before consumption, freshly re-resolve and recompute. Any material mismatch requires a new approval.

Canonicalization rejects duplicate keys, non-finite numbers, negative zero, invalid Unicode, and unsafe numeric ambiguity.

Approval remains short-lived, single-use, and transactionally protected. Human-readable summaries accurately describe—but do not replace—the canonical authorization object.

---

# 18. TOCTOU / CONDITIONAL MUTATION

Fresh re-resolution narrows but does not eliminate a race between check and mutation.

Where the target system supports conditional updates, consequential adapters SHALL use provider-native compare-and-set semantics such as:

- ETag / `If-Match`;
- expected Git ref/SHA;
- expected file identity/hash/version;
- generation/revision tokens;
- transaction/precondition version;
- equivalent conditional mutation primitive.

A condition mismatch means the target changed. JARVIS re-resolves, re-evaluates permission, and obtains new approval if material action changed. It does not silently apply the old authorization to new state.

---

# 19. NAMED-PIPE IPC SECURITY

Privileged Host↔Core IPC uses an explicit restrictive Windows DACL/logon-session principal boundary plus:

- no Windows default permissive descriptor reliance;
- no Everyone/anonymous/unrelated-session/network access;
- remote client rejection/local-only behavior;
- unpredictable per-launch name;
- separate per-launch bootstrap authentication secret;
- secret transfer outside command line/normal logs;
- framed bounded schema-validated protocol;
- fail-closed bootstrap if ACL/locality/auth cannot be established.

A valid Windows principal still has to pass bootstrap authentication/protocol validation.

This does not claim isolation from arbitrary code already executing under the exact same effective user/logon identity.

---

# 20. TAURI/WEBVIEW SECURITY

The authoritative WebView is a presentation/control boundary, not a trusted browser for arbitrary remote pages.

Production SHALL:

- load bundled/local JARVIS application UI content;
- define explicit Tauri capabilities per window/WebView;
- grant no privileged capability to remote origins;
- enable restrictive CSP;
- avoid remote executable script/CDN dependencies by default;
- block unexpected privileged-WebView navigation;
- open external links outside the privileged WebView;
- sanitize/render untrusted HTML/Markdown inertly;
- disable production devtools unless a separately gated developer/diagnostic policy permits them;
- qualify Tauri/runtime versions for relevant security fixes.

Renderer cannot resolve secure-store handles, spawn arbitrary native processes, open privileged Core IPC, invoke arbitrary elevated operations, or make authoritative PermissionDecisions.

---

# 21. WORKER / CODEX PROCESS SECURITY

Workers run non-elevated by default under Job Object lifecycle containment with allowlisted environment and minimum data/credential exposure.

`WORKSPACE_ENGINEERING` delegates local engineering work but does not equate to broad user authority.

JARVIS SHALL NOT claim workspace-only **read** isolation merely because a provider sandbox restricts writes. The exact provider/OS sandbox read/write/network semantics are measured and release-qualified.

V1 delegated Codex CLI engineering network access is enabled by default and is required for the Codex `WORKSPACE_ENGINEERING` profile. The typed request SHALL declare `networkMode: ENABLED`, and the provider qualification probe SHALL verify bounded network availability. Network access remains subject to DataLocality, authority, secret, external-action, budget, audit, and PermissionEngine policy.

The worker receives no unrelated integration credentials by default.

Shell/process availability does not authorize:

```text
GitHub push
publish/deploy
Proxmox mutation
email/message send
Cloudflare/Google/Microsoft write
credential administration
other external consequential effects
```

Those return through typed JARVIS tools/integrations and PermissionEngine.

Job Objects are lifecycle/resource containment only; prompts are not a sandbox.

---

# 22. CODEX WINDOWS SETUP / ELEVATION SECURITY

A qualified Codex Windows sandbox may require one-time or repair-time elevated setup. That setup is a **provider setup operation**, not worker authority.

JARVIS SHALL:

- surface setup/repair as an explicit authenticated user action;
- invoke only the release-qualified Codex distribution/setup helper identity through a narrow Rust native operation;
- use UAC only when the qualified provider setup path requires it;
- pass only bounded provider-defined/qualified setup arguments;
- wait for and independently verify setup readiness/conformance before marking the profile supported;
- treat cancellation/failure as `SETUP_REQUIRED`, `REPAIR_REQUIRED`, or `SETUP_FAILED` rather than silently degrading;
- never use setup elevation to launch ordinary workers elevated;
- never expose a generic elevated command/path surface to AI/Core;
- not import provider-owned sandbox-account passwords/credentials into normal JARVIS state;
- sanitize provider setup output before logs/diagnostics;
- invalidate setup/conformance readiness after a provider update when the qualified policy cannot prove continued validity.

Untrusted content/AI cannot directly authorize an elevation helper. The setup workflow is initiated by an authenticated JARVIS control path and bounded to the exact known provider setup operation.

---

# 23. PROVIDER SECURITY AND COMPATIBILITY

A provider is production-supported only after required setup readiness, exact version/interface/sandbox/error/cancellation/conformance qualification, and current health/auth/capability checks.

Provider-native configuration/output is untrusted until adapter normalization/validation.

Unsupported/new unqualified versions are excluded from automatic production routing.

Provider self-update does not grant support and may invalidate setup/conformance readiness.

Provider session-resume handles are sensitive when they confer access to hosted session state and do not imply authorization for new actions.

No provider fallback may violate setup, `LOCAL_ONLY`, permission, budget, or capability policy.

---

# 24. CREDENTIAL/INTEGRATION USE

An adapter may obtain a credential only after integration/account/capability identity, action authority, environment/scope, and required credential capability are resolved.

Refresh/rotation occurs inside trusted credential/integration logic, not AI reasoning.

Connection/authentication does not authorize all supported actions.

OAuth integrations use PKCE where supported and request minimal capability-driven scopes. Temporary loopback callbacks bind narrowly, validate state/PKCE, accept only expected callback flow, and close after completion.

For GitHub V1, credentials/scopes SHALL be limited to the exact enabled Release Profile capability matrix. Mandatory V1 support does not require repository administration, secret administration, branch-protection administration, membership administration, repository deletion, or ref deletion.

---

# 25. PROXMOX SECURITY

V1 Proxmox is API-first and capability-scoped.

Required controls:

- dedicated scoped Proxmox identity/API token is preferred for routine operation;
- token secret remains behind Credential Broker;
- TLS verification is mandatory; system CA or explicit SHA-256 pin policy;
- durable connection/environment identity;
- node/VMID/pool allowlists when configured;
- typed operations only, no arbitrary raw API request tool;
- exact active Release Profile capability matrix enforced;
- no silent SSH/`qm`/`pct`/`pvesh`/root/direct `/etc/pve` fallback;
- guest OS shell access is separately registered/authorized;
- asynchronous Proxmox tasks are tracked to observed outcome;
- destructive actions use exact final confirmation;
- ambiguous writes become `UNCERTAIN`, not blind replay.

`PROXMOX_GUEST_CREATE` is not generic storage administration; `PROXMOX_GUEST_CONFIG` is not host/network/storage administration; `PROXMOX_BACKUP` is not direct PBS administration. `PROXMOX_STORAGE_WRITE` and `PROXMOX_NETWORK_WRITE` are optional/non-mandatory V1 capabilities and require full qualification if enabled by a concrete release.

Direct Proxmox Backup Server administration is a separate connection boundary.

---

# 26. MODULE SECURITY

A supported module requires authenticated release/catalog provenance, artifact integrity, manifest/schema validation, compatibility, requested-capability review, staged health/conformance, and lifecycle policy.

Execution classes:

```text
DATA_ONLY          no executable payload
BUILT_IN_TRUSTED   first-party signed-release code
EXTERNAL_MANAGED   supervised out-of-Core executable
```

There is no untrusted in-Core class.

Third-party signature proves provenance/integrity, not enough trust to run in Core.

EXTERNAL_MANAGED receives typed capability-scoped IPC, minimum credentials/environment, and mandatory process containment. Its health check cannot be an arbitrary command string/URL.

V1 need not expose an open arbitrary executable-module marketplace.

---

# 27. APPLICATION UPDATE / SUPPLY CHAIN

Application updates are signed/integrity-verified, staged, and paired with schema/backup/recovery compatibility.

Tampered/unverified artifacts are never activated and never trigger fallback to another unverified binary.

Production pipeline uses pinned lockfiles/toolchains, secret/dependency/vulnerability/license review as appropriate, clean builds, release manifest, SBOM, and provenance linking artifacts to source/CI.

Node Core/runtime assets, canonical brand/font/icon assets, and module catalog trust metadata are part of release integrity. Third-party fonts/icons/visual assets SHALL have recorded source/license/provenance and required notices.

---

# 28. LOGGING / DIAGNOSTICS / CRASH DATA

Logs/journals/audit/diagnostics exclude by construction where possible:

- passwords/recovery factors;
- live DB/backup/snapshot keys;
- KDF-derived working keys;
- OAuth/API tokens;
- authorization headers;
- private keys;
- provider-internal sandbox-account credentials;
- complete environment dumps;
- arbitrary full AI context.

Central redaction is defense in depth, not permission to spray secrets into logs.

Full memory dumps are not collected/uploaded automatically. User-requested support dumps containing memory are sensitive and explicit.

---

# 29. EVENT / NETWORK EXPOSURE

Authenticated external events establish source authenticity, not action authority. They enter Event Gateway and normal permission/locality/budget/resource processing with durable replay/dedup protection.

V1 exposes no privileged Core LAN/Internet API.

Direct public inbound Internet webhooks are not required for V1. A future public ingress surface requires a separate relay/gateway or separately approved threat model including auth, replay, rate limiting, DoS, endpoint discovery, secret rotation, and compromised-event handling.

OAuth loopback listeners are temporary/narrow and are not a general network control plane.

---

# 30. RATE / RESOURCE ABUSE

The runtime rate-limits unlock/recovery-factor attempts, repeated approval submissions, automation storms, provider retries, and failing tool calls where applicable.

KDF calibration SHALL not permit attacker-controlled unbounded memory/iteration values; production profiles come from validated bounded configuration/schema.

Emergency stop/cancel remains available.

Workers/providers have bounded time/resource/process policies. Background work cannot consume resources such that user stop/UI/voice control becomes unavailable.

Disk use for logs/artifacts/cache/backups/modules is bounded and disk-full conditions fail safely.

---

# 31. AUDIT EVENTS

Security audit includes at least:

- session unlock/lock/password change/recovery attempt (without secrets);
- KDF profile activation/upgrade where security-relevant;
- recovery-factor setup/verification;
- standing permission/policy change;
- approval issue/decision/expiry/consumption;
- high/critical tool execution;
- integration connect/disconnect/capability change;
- credential rotation/revocation;
- provider setup/repair/elevation result and compatibility/fallback security events;
- Proxmox destructive/high-risk operations;
- module catalog/install/update/rollback;
- DataLocality/security setting change;
- backup/restore/migration/update;
- conditional-mutation conflict where material;
- security-policy failures.

Audit is append-oriented and sufficient to explain consequential authorization without storing private chain-of-thought or secret material.

---

# 32. FAILURE BEHAVIOR

Security-critical validation never guesses or silently weakens policy.

On failure:

- block/queue/setup/repair/recover as appropriate;
- record sanitized diagnostic/audit evidence;
- surface an actionable reason;
- never ask AI whether bypassing a hard security invariant is acceptable.

Examples include invalid action digest, changed target/version, permission deny, incompatible scope, locality-compliant provider unavailable, provider setup not ready, credential capability missing, pipe DACL/auth failure, WebView capability/CSP misconfiguration, provider sandbox mismatch, module signature failure, backup authentication failure, under-floor KDF profile, and unsupported database schema.

---

# 33. REQUIRED SECURITY VERIFICATION

Production tests SHALL include:

- prompt injection from every major untrusted-content source;
- attempts to exfiltrate secret/recovery/KDF-derived material;
- path/reparse/UNC escape;
- deterministic PermissionEngine conflict/deny/risk scenarios;
- HIGH precedent proving insufficient authority;
- CRITICAL explicit instruction still requiring final confirmation;
- approval replay and material target/account/environment/argument change;
- Rust/TypeScript canonicalization vector equality;
- conditional-mutation target-race failure;
- unauthorized local named-pipe principal/session/remote attempt;
- wrong bootstrap secret;
- Tauri remote-origin capability denial;
- CSP/navigation/untrusted-rendering negative cases;
- production KDF profile floor/metadata/upgrade tests;
- Codex setup required/cancel/failure/repair/update invalidation and normal-worker non-elevation;
- provider/engineering sandbox write/network behavior and honest read-isolation reporting;
- shell attempt to perform external consequential operation outside typed JARVIS path;
- provider fallback violating locality/setup;
- module external-in-process rejection;
- module/update/catalog tamper;
- GitHub capability/scope overreach rejection;
- Proxmox raw API/shell/optional-capability overreach rejection;
- backup/package tamper and wrong recovery factor;
- clean-profile portable restore/re-key;
- integration credentials absent after restore and `REAUTH_REQUIRED` behavior;
- process-tree containment/breakaway/orphan cleanup;
- security-sensitive logging/redaction failures.

---

# 34. SECURITY INVARIANTS

1. Renderer cannot directly obtain secure-store secrets or Core authority.
2. Orchestrator has no unrestricted shell.
3. External content cannot grant permission or request trusted elevation directly.
4. Explicit DENY/mandatory invariant cannot be bypassed by ordinary instruction/precedent/AI confidence.
5. Precedent cannot independently authorize HIGH/CRITICAL work.
6. Destructive execution cannot occur without fresh bound final confirmation.
7. Locked JARVIS does not disclose private content through normal UI/voice APIs.
8. `LOCAL_ONLY` content cannot route remotely.
9. Credential presence does not authorize action.
10. Raw long-lived credentials do not enter normal DB/config/log/journal/backup/AI channels.
11. Named-pipe privilege boundary is explicit restrictive local-only + authenticated.
12. Privileged Tauri commands are not exposed to remote-origin WebViews.
13. Worker shell/provider native capability cannot widen JARVIS authority.
14. Job Objects are not described as filesystem/network isolation.
15. Provider sandbox/setup claims match conformance evidence.
16. Provider setup elevation never grants elevated ordinary worker execution.
17. Uncertain consequential execution is not blindly retried.
18. Conditional target/version conflict does not reuse stale authorization silently.
19. External executable modules never run in authoritative Core.
20. Portable state restore does not require historical live `DB_DEK` or export integration credentials.
21. Session-password recovery requires explicit recovery authority and cannot reverse the verifier by design.
22. JARVIS-managed production KDF profiles never fall below the current contract floor.
23. Production/provider/module/integration capability support claims are evidence-backed.

---

**END — JARVIS SECURITY HARDENING CONTRACT v1.0.3**
