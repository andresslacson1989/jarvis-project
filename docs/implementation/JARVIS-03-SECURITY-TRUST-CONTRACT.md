# JARVIS Security & Trust Contract

**Contract Suite Version:** 1.0.8
**Version:** 1.0.9
**Component:** `J03`
**Status:** Canonical normative component
**Scope:** security hardening, threat boundaries, project-policy enrollment, supply-chain trust, update/module authorization, and security verification

---

This file is the sole normative home for the clauses in this component. The manifest fixes the component set and revisions; the Release Profile fixes the supported V1 product profile. The implementation plan, execution matrix, evidence records, and audits are execution aids and do not add authority.

Clause identifiers in this file are stable traceability anchors. Cross-component references use clause identifiers and the separate Release Profile; historical material cannot override or supplement this suite.
## J03-SEC-01 — PURPOSE

JARVIS is a high-trust desktop assistant capable of reading private data, modifying repositories, using connected accounts, and managing infrastructure. Security SHALL be implemented by deterministic software/OS boundaries, not by asking AI output to behave safely.

---

## J03-SEC-02 — SECURITY PRINCIPLES

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

## J03-SEC-03 — THREAT MODEL

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

## J03-SEC-04 — SESSION PASSWORD, ARGON2ID, AND RECOVERY

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

## J03-SEC-05 — WINDOWS LOCK

Native host observes Windows lock/sign-out and authoritatively drives JARVIS lock state.

While locked:

- private UI content is hidden/redacted;
- private/sensitive speech stops;
- sensitive notifications are deferred/redacted;
- new consequential work is not accepted from unauthenticated input;
- already-authorized background work may continue only under its task policy;
- pending approvals are not silently consumed after unlock without normal revalidation.

---

## J03-SEC-06 — WINDOWS SECURE STORAGE / CREDENTIAL BROKER

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

## J03-SEC-07 — DATABASE/BACKUP SECRET BOUNDARY

The live database uses a random local `DB_DEK` protected through Windows secure storage.

Backup packages use independent per-backup `BackupDEK` and backup-specific SQLCipher snapshot key semantics from J02-BACKUP-03/J02-BACKUP-04. The portable recovery factor derives a key using the exact recorded qualified KDF profile and wraps/unlocks `BackupDEK`; it does not become the live DB key.

A clean-profile restore obtains the backup snapshot key only after authenticating/decrypting the backup package, then re-keys restored state under a fresh local `DB_DEK`.

Ordinary portable/local state backups do not contain raw integration credentials.

---

## J03-SEC-08 — DATA POLICY

J01-PROTO-04 is the sole canonical definition of `DataSensitivity`, `DataLocality`, and `DataPolicy`. This clause owns their security and routing meaning.

`SECRET` normally remains only in secure store/trusted adapter memory.

`LOCAL_ONLY` prohibits cloud/LAN/remote provider routing.

Derived data inherits the strictest input policy unless deterministic audited declassification/export explicitly changes it. AI summarization never declassifies by itself.

---

## J03-SEC-09 — PROMPT-INJECTION / CONTENT AUTHORITY

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

## J03-SEC-10 — TRUSTED INSTRUCTION SOURCES

Potential scoped instruction sources after deterministic resolution include:

- authenticated current user instruction;
- accepted standing permissions/policies;
- Core-owned task/mission specification;
- global JARVIS policy;
- registered project policy such as `AGENTS.md` located inside the resolved project root.

Project policy remains subordinate to global security, locality, permission, budget, destructive-confirmation, credential, provider-setup, and update policy.

Path traversal/reparse behavior cannot make an out-of-root file become trusted project policy.

---

## J03-SEC-11 — CONTEXT PACKAGING

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

## J03-SEC-12 — STRUCTURED AI OUTPUT

AI output is attacker-controlled input to execution.

Runtime validation rejects malformed/unknown-required fields, invalid enums/IDs, out-of-scope paths/resources, excessive size/depth, unresolved consequential references, locality violations, and arguments inconsistent with authority/scope.

A bounded repair/reformat attempt may be requested for syntactic invalidity. Repeated failure blocks rather than enabling permissive parsers.

AI confidence is never an authorization input.

---

## J03-SEC-13 — DETERMINISTIC PERMISSION ENGINE PRECEDENCE

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

## J03-SEC-14 — RISK CLASS AUTHORIZATION

J01-PROTO-16 is the sole canonical definition of `RiskClass`. The authorization behavior for each canonical value follows.

#### LOW

May execute automatically when inside the current authority envelope and no prior gate blocks it.

#### MODERATE

May execute automatically when reasonably subordinate to the current explicit instruction or covered by an explicit scoped standing permission. Material scope expansion requires clarification/authorization.

#### HIGH

Precedent alone can never authorize HIGH work.

HIGH may execute without a new per-action prompt only when **either**:

- the current authenticated user instruction directly and unambiguously authorizes that same resolved HIGH action/target/scope and policy permits direct instruction as sufficient; or
- a dedicated explicit standing permission authorizes that specific action class/target/environment/account scope and policy permits standing authorization for that HIGH class.

Otherwise HIGH returns `REQUIRE_APPROVAL`.

A HIGH operation that is destructive/materially unrecoverable is governed by CRITICAL/destructive rules instead.

#### CRITICAL / destructive / materially unrecoverable

Always requires fresh final confirmation immediately before execution, even if the original instruction or a standing permission requested/allowed it. No precedent, AI confidence, credential, or standing policy waives final confirmation.

---

## J03-SEC-15 — PRECEDENT

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

## J03-SEC-16 — PATH / RESOURCE IDENTITY

Consequential filesystem paths and external resource targets are canonicalized/resolved before authorization.

Filesystem protections include traversal, junction/symlink/reparse escape, alternate drive/UNC roots, unintended root targeting, path alias/case identity, and broad wildcard scope.

External targets use stable repository/branch/ref/account/environment/resource IDs, not display labels alone.

If canonical identity cannot be established, JARVIS clarifies/blocks rather than approving the ambiguous raw string.

---

## J03-SEC-17 — APPROVAL ACTION BINDING

Final/high-risk approvals bind exactly to `CanonicalActionDescriptorV1`.

The sole canonical approval digest pipeline and rejection rules are defined by J01-PROTO-18/J01-PROTO-25. This clause owns the security binding and revalidation behavior that consumes that pipeline.

Before issuance, resolve all material tool/target/account/environment/scope/arguments/policy identity.

Before consumption, freshly re-resolve and recompute. Any material mismatch requires a new approval.

Canonicalization rejects duplicate keys, non-finite numbers, negative zero, invalid Unicode, and unsafe numeric ambiguity.

Approval remains short-lived, single-use, and transactionally protected. Human-readable summaries accurately describe—but do not replace—the canonical authorization object.

---

## J03-SEC-18 — TOCTOU / CONDITIONAL MUTATION

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

## J03-SEC-19 — NAMED-PIPE IPC SECURITY

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

## J03-SEC-20 — TAURI/WEBVIEW SECURITY

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

## J03-SEC-21 — WORKER / CODEX PROCESS SECURITY

Workers run non-elevated by default under Job Object lifecycle containment with allowlisted environment and minimum data/credential exposure.

`WORKSPACE_ENGINEERING` delegates local engineering work but does not equate to broad user authority.

JARVIS SHALL NOT claim workspace-only **read** isolation merely because a provider sandbox restricts writes. The exact provider/OS sandbox read/write/network semantics are measured and release-qualified.

V1 delegated engineering network is denied by default. A profile needing network must explicitly declare/qualify it and remain within DataLocality/authority policy.

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

## J03-SEC-22 — CODEX WINDOWS SETUP / ELEVATION SECURITY

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

## J03-SEC-23 — PROVIDER SECURITY AND COMPATIBILITY

A provider is production-supported only after required setup readiness, exact version/interface/sandbox/error/cancellation/conformance qualification, and current health/auth/capability checks.

Provider-native configuration/output is untrusted until adapter normalization/validation.

Unsupported/new unqualified versions are excluded from automatic production routing.

Provider self-update does not grant support and may invalidate setup/conformance readiness.

Provider session-resume handles are sensitive when they confer access to hosted session state and do not imply authorization for new actions.

No provider fallback may violate setup, `LOCAL_ONLY`, permission, budget, or capability policy.

---

## J03-SEC-24 — CREDENTIAL/INTEGRATION USE

An adapter may obtain a credential only after integration/account/capability identity, action authority, environment/scope, and required credential capability are resolved.

Refresh/rotation occurs inside trusted credential/integration logic, not AI reasoning.

Connection/authentication does not authorize all supported actions.

OAuth integrations use PKCE where supported and request minimal capability-driven scopes. Temporary loopback callbacks bind narrowly, validate state/PKCE, accept only expected callback flow, and close after completion.

For GitHub V1, credentials/scopes SHALL be limited to the exact enabled Release Profile capability matrix. Mandatory V1 support does not require repository administration, secret administration, branch-protection administration, membership administration, repository deletion, or ref deletion.

---

## J03-SEC-25 — PROXMOX SECURITY

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

## J03-SEC-26 — MODULE SECURITY

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

## J03-SEC-27 — APPLICATION UPDATE / SUPPLY CHAIN

Application updates are signed/integrity-verified, staged, and paired with schema/backup/recovery compatibility.

Tampered/unverified artifacts are never activated and never trigger fallback to another unverified binary.

Production pipeline uses pinned lockfiles/toolchains, secret/dependency/vulnerability/license review as appropriate, clean builds, release manifest, SBOM, and provenance linking artifacts to source/CI.

Node Core/runtime assets, canonical brand/font/icon assets, and module catalog trust metadata are part of release integrity. Third-party fonts/icons/visual assets SHALL have recorded source/license/provenance and required notices.

---

## J03-SEC-28 — LOGGING / DIAGNOSTICS / CRASH DATA

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

## J03-SEC-29 — EVENT / NETWORK EXPOSURE

Authenticated external events establish source authenticity, not action authority. They enter Event Gateway and normal permission/locality/budget/resource processing with durable replay/dedup protection.

V1 exposes no privileged Core LAN/Internet API.

Direct public inbound Internet webhooks are not required for V1. A future public ingress surface requires a separate relay/gateway or separately approved threat model including auth, replay, rate limiting, DoS, endpoint discovery, secret rotation, and compromised-event handling.

OAuth loopback listeners are temporary/narrow and are not a general network control plane.

---

## J03-SEC-30 — RATE / RESOURCE ABUSE

The runtime rate-limits unlock/recovery-factor attempts, repeated approval submissions, automation storms, provider retries, and failing tool calls where applicable.

KDF calibration SHALL not permit attacker-controlled unbounded memory/iteration values; production profiles come from validated bounded configuration/schema.

Emergency stop/cancel remains available.

Workers/providers have bounded time/resource/process policies. Background work cannot consume resources such that user stop/UI/voice control becomes unavailable.

Disk use for logs/artifacts/cache/backups/modules is bounded and disk-full conditions fail safely.

---

## J03-SEC-31 — AUDIT EVENTS

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

## J03-SEC-32 — FAILURE BEHAVIOR

Security-critical validation never guesses or silently weakens policy.

On failure:

- block/queue/setup/repair/recover as appropriate;
- record sanitized diagnostic/audit evidence;
- surface an actionable reason;
- never ask AI whether bypassing a hard security invariant is acceptable.

Examples include invalid action digest, changed target/version, permission deny, incompatible scope, locality-compliant provider unavailable, provider setup not ready, credential capability missing, pipe DACL/auth failure, WebView capability/CSP misconfiguration, provider sandbox mismatch, module signature failure, backup authentication failure, under-floor KDF profile, and unsupported database schema.

---

## J03-SEC-33 — REQUIRED SECURITY VERIFICATION

`J05-VER-16B` owns the complete security verification catalog. Failure of any listed case blocks qualification.

---

## J03-SEC-34 — SECURITY INVARIANTS

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

## J03-POLICY-01 — PURPOSE

This contract defines the deterministic trust transition by which repository files such as `AGENTS.md` may become scoped JARVIS project policy.

Repository content is untrusted data by default. Merely cloning, opening, registering, checking out, or scanning a repository SHALL NOT promote repository text into trusted policy.

> **Project policy is trusted because the user enrolled an exact policy identity—not because a filename looks authoritative.**

---

## J03-POLICY-02 — POLICY TRUST STATES

Canonical policy trust states are:

```text
UNTRUSTED_CANDIDATE
TRUSTED
CHANGED_REVIEW_REQUIRED
DISABLED_BY_USER
REVOKED
```

`TRUSTED` is the only state in which repository policy text may enter the trusted project-policy context class.

All other states remain untrusted content for AI/content-authority purposes.

---

## J03-POLICY-03 — CANDIDATE DISCOVERY

V1 SHALL recognize `AGENTS.md` as a project-policy candidate filename. Additional filenames require explicit typed configuration/contract support; arbitrary files SHALL NOT become trusted merely because they contain policy-like prose.

Candidate discovery SHALL:

- resolve the canonical project and filesystem identity first;
- reject traversal/reparse/symlink escape under the normal platform path policy;
- record the canonical project-relative path;
- record the canonical scope directory;
- hash the exact bytes with SHA-256;
- record Git blob OID/commit/ref provenance when available;
- treat contents as untrusted until enrollment completes.

A newly cloned or unfamiliar repository with an `AGENTS.md` SHALL therefore begin at `UNTRUSTED_CANDIDATE`.

---

## J03-POLICY-04 — EXPLICIT ENROLLMENT

Before an `UNTRUSTED_CANDIDATE` becomes `TRUSTED`, an unlocked authenticated user SHALL explicitly accept the candidate through a JARVIS-owned policy-enrollment flow.

The flow SHALL show at least:

- project identity;
- canonical project-relative policy path;
- scope root;
- source repository/ref/commit when known;
- content SHA-256;
- bounded policy summary;
- full content/diff access before acceptance;
- the fact that accepted policy constrains future JARVIS work in that scope.

Acceptance SHALL persist a `ProjectPolicyTrustRecord` equivalent to:

```ts
interface ProjectPolicyTrustRecord {
  policyTrustId: string;
  projectId: string;
  canonicalRelativePath: string;
  canonicalScopeRoot: string;
  contentSha256: string;
  gitBlobOid?: string;
  sourceCommit?: string;
  state: 'TRUSTED' | 'CHANGED_REVIEW_REQUIRED' | 'DISABLED_BY_USER' | 'REVOKED';
  acceptedAt?: string;
  acceptedSessionId?: string;
  revision: number;
}
```

Display names and raw path strings alone are never policy identity.

---

## J03-POLICY-05 — REGISTRATION/OPENING BEHAVIOR

Project registration SHALL NOT silently accept detected policy candidates.

If a candidate exists and consequential project mutation is requested before the user has decided how to handle it, JARVIS SHALL surface `PROJECT_POLICY_DECISION_REQUIRED` or equivalent and offer:

```text
Review and trust
Ignore/disable for this project
Cancel project work
```

If the user explicitly disables the candidate, JARVIS may proceed under global/user/task policy while continuing to treat the file as untrusted repository content. The UI SHALL make that choice visible in project policy status.

---

## J03-POLICY-06 — TRUSTED POLICY AUTHORITY LIMIT

Trusted project policy is subordinate to JARVIS global security, PermissionEngine, Authority Envelope, DataPolicy, budget, credential, provider setup, platform security, destructive-confirmation, update, and recovery invariants.

Trusted project policy MAY:

- constrain project-local engineering conventions;
- impose additional validation/build/test requirements;
- constrain file/layout/style/workflow choices;
- provide scoped project context/instructions;
- require more restrictive project-local handling.

Trusted project policy SHALL NOT by itself:

- grant external write/deploy/infrastructure authority;
- widen ExecutionScope or Authority Envelope;
- waive approval/final destructive confirmation;
- reveal credentials;
- change DataSensitivity/DataLocality;
- authorize provider setup/elevation;
- install/authorize modules;
- disable audit/security/update rules;
- convert untrusted external content into system policy.

A project policy is therefore primarily a scoped constraint/context source, not a permission grant.

---

## J03-POLICY-07 — IMMUTABLE POLICY SNAPSHOT PER ATTEMPT

Before an engineering attempt starts, Core SHALL resolve the applicable trusted policy set and persist an immutable `ProjectPolicySnapshot` containing the exact trust-record revisions/content hashes applied to that attempt.

AI/workers receive the snapshot contents/context, not a promise that the on-disk file will remain unchanged.

A repository file changing mid-attempt does not retroactively rewrite the active attempt's trusted instruction set.

However, before a new attempt, task `RESUMING`, or a consequential action whose safety/acceptance semantics materially depend on project policy, JARVIS SHALL revalidate the applicable policy identities/hashes.

---

## J03-POLICY-08 — POLICY CHANGE DETECTION

If a trusted policy file no longer matches its enrolled canonical identity/content hash, the record becomes `CHANGED_REVIEW_REQUIRED`.

Causes include:

- checkout/branch switch;
- pull/fetch/update changing the file;
- local edit;
- worker/tool edit;
- file replacement, symlink/reparse change, or path-identity change;
- source repository/worktree identity change.

The new content remains untrusted until re-enrolled.

JARVIS SHALL NOT silently carry trust from hash A to hash B merely because the path remains `AGENTS.md`.

---

## J03-POLICY-09 — MUTATING A TRUSTED POLICY FILE

A write that changes an enrolled trusted project-policy file is contextually HIGH project-policy work.

It SHALL NOT occur merely because a normal engineering worker has filesystem write access.

The mutation requires exact user authority under the normal HIGH-action rules and SHALL bind the intended policy path/content change as precisely as practical.

After the write, the resulting new content enters `CHANGED_REVIEW_REQUIRED`. It SHALL NOT become trusted automatically simply because JARVIS or a trusted worker produced it.

The user may then inspect the diff and explicitly accept the new policy revision.

---

## J03-POLICY-10 — NESTED POLICY FILES

Nested policy is supported without implicit trust propagation.

Each candidate path requires its own enrollment/disable decision.

For a target resource/path, applicable trusted policies are ordered from the shallowest enrolled scope to the deepest enrolled scope whose canonical scope contains the target.

A deeper trusted policy MAY refine project-local instructions for its subtree. It SHALL NOT widen authority/security beyond parent/global rules.

If two applicable trusted policies conflict materially and deterministic "stricter wins" handling cannot preserve user intent, JARVIS SHALL block/clarify rather than choose a permissive interpretation.

An untrusted nested `AGENTS.md` never overrides a trusted parent policy.

---

## J03-POLICY-11 — WORKTREES, BRANCHES, AND COPIES

Policy trust is bound to the registered project identity plus canonical policy identity and content hash.

Trust SHALL NOT automatically transfer to:

- an unrelated repository containing the same filename;
- a copied project directory registered as a different project;
- a branch/worktree whose policy content hash differs;
- a symlink/junction/reparse target outside the enrolled project identity.

Parallel worktrees may reuse a trust record only while canonical policy identity/content/provenance requirements remain satisfied.

---

## J03-POLICY-12 — CONTEXT PACKAGING

Context Manager SHALL label policy sources distinctly:

```text
SYSTEM POLICY
AUTHENTICATED USER INSTRUCTION
TRUSTED PROJECT POLICY (with policyTrustId/revision)
VERIFIED STATE
RETRIEVED MEMORY
UNTRUSTED REPOSITORY/EXTERNAL CONTENT
```

An `UNTRUSTED_CANDIDATE`, `CHANGED_REVIEW_REQUIRED`, disabled, or revoked policy-looking file stays under untrusted content labeling.

Workers SHALL NOT be told that an untrusted candidate is authoritative merely to improve compliance.

---

## J03-POLICY-13 — REVOCATION AND DISABLE

The user may disable/revoke a project policy trust record.

Revocation/disable prevents the record from entering new policy snapshots immediately after authoritative state changes.

Existing running work reaches an integrity-safe boundary and SHALL revalidate policy before new consequential actions as required by its task/recovery policy.

Policy trust changes are auditable without storing private chain-of-thought.

---

## J03-POLICY-14 — REQUIRED UI/DIAGNOSTIC STATE

Mission Control project status SHALL distinguish:

```text
no policy candidate
policy decision required
trusted policy
policy changed — review required
policy disabled
policy revoked
policy/path validation error
```

The UI SHALL expose the exact trusted path/hash/revision and source provenance needed to explain why JARVIS considered a project instruction trusted.

---

## J03-POLICY-15 — REQUIRED VERIFICATION

`J05-VER-16A` owns the complete positive and negative project-policy trust verification catalog. Failure of any listed case blocks qualification.

---

## J03-POLICY-16 — INVARIANTS

1. Repository content is untrusted by default.
2. Filename alone never grants trust.
3. Trust requires explicit authenticated enrollment.
4. Trust binds canonical project/path/scope/content identity.
5. Content change invalidates prior trust for new work.
6. Trusted project policy cannot widen JARVIS authority or waive global security.
7. Nested policy requires separate enrollment.
8. Workers cannot silently rewrite the policy that constrains them.
9. Active attempts use immutable policy snapshots.
10. Policy state is visible, revocable, durable, and auditable.

---

## J03-SUPPLY-01 — PURPOSE

This contract defines the trust-root lifecycle for JARVIS application updates and the supported module catalog. It closes the gap between "artifact has a valid signature" and "artifact is currently authorized, non-revoked, non-rollback, and issued under a recoverable trust hierarchy."

JARVIS SHALL use The Update Framework (TUF) trust model rather than inventing an ad-hoc key-rotation/revocation protocol.

> **A valid historical signature is provenance, not perpetual authorization to install or activate.**

---

## J03-SUPPLY-02 — TUF PROFILE

The initial production trust-metadata profile SHALL implement TUF specification **1.0.35** semantics for:

```text
root
targets
snapshot
timestamp
consistent snapshots
target delegations
metadata version monotonicity
metadata expiration
root rotation
rollback/freeze/mix-and-match protection
```

Production metadata SHALL use canonical deterministic serialization supported by the selected audited TUF implementation.

`consistent_snapshot` SHALL be enabled.

Changing to a different TUF major/minor semantic profile requires a synchronous security/update contract review. A patch-level TUF library update does not change this contract when wire/trust semantics remain compatible and release qualification passes.

---

## J03-SUPPLY-03 — SIGNATURE ALGORITHM

The JARVIS TUF V1 role-key profile SHALL use:

```text
keytype: ed25519
scheme:  ed25519
```

Key IDs and role metadata follow TUF 1.0.35 rules.

JARVIS SHALL use a maintained reviewed TUF/Ed25519 implementation and SHALL NOT implement signature primitives itself.

---

## J03-SUPPLY-04 — ROOT TRUST

The production root role SHALL have at least three independently stored root keys and threshold **2-of-3**.

Root private keys SHALL be kept offline from ordinary application runtime, developer workstations used for normal coding, and general CI execution. At least two threshold-capable root-key copies SHALL be stored in separately protected locations/devices so one compromised/lost storage location does not immediately destroy the trust root.

Production clients ship with an authenticated initial trusted root metadata version.

A client SHALL NOT fetch an arbitrary network key and treat it as a new root merely because it signs itself.

---

## J03-SUPPLY-05 — ROLE KEY CUSTODY AND THRESHOLDS

Root metadata SHALL authorize distinct keys for:

```text
root
targets
snapshot
timestamp
```

The production JARVIS profile SHALL use at least:

```text
root:      2-of-3, offline
targets:   2-of-3, offline/release-signing only
snapshot:  1-of-1 or stronger, offline/release-signing only
timestamp: 1-of-1 or stronger, online automation permitted
modules delegated targets role: 2-of-3, offline/release-signing only
```

`offline/release-signing only` means the private key is not available to ordinary application runtime, update servers, developer workstations used for normal coding, or general-purpose CI jobs. A narrowly isolated release-signing environment or hardware-backed signing ceremony MAY use the key when producing authorized metadata and SHALL keep key custody separate from ordinary build/test automation.

The timestamp role is intentionally the minimally trusted routinely-online role. Its key MAY be available to narrowly scoped automated infrastructure because timestamp metadata cannot by itself authorize a new target file.

Targets and delegated module-target keys authorize installable content and therefore SHALL NOT be ordinary online service/runtime keys. Snapshot keys also SHALL remain offline in accordance with the TUF key-management model, even though snapshot metadata does not directly authorize target bytes.

Root role keys SHALL NOT be reused for targets, snapshot, timestamp, or module-delegation signing. Targets/module keys SHALL NOT be reused as the online timestamp key.

Production key custody, key IDs, thresholds, storage class, and rotation procedure are release/security-operational records.

---

## J03-SUPPLY-06 — MODULE CATALOG DELEGATION

Supported externally installable module/catalog targets SHALL be authorized through a dedicated TUF delegated targets role such as:

```text
modules
```

The delegation SHALL be path/target-scoped so module-catalog authority cannot sign arbitrary JARVIS application release targets.

The production `modules` delegated role SHALL use at least three independent Ed25519 keys with a **2-of-3** signature threshold and offline/release-signing custody as defined above.

A publisher/self-signature MAY provide additional provenance, but it does not make a module `SUPPORTED` without current TUF catalog authorization, manifest compatibility, integrity, permission review, and conformance.

Revoking the module delegation/key or removing a target from current trusted catalog metadata prevents new installation/activation under normal supported policy.

---

## J03-SUPPLY-07 — ROOT ROTATION AND REVOCATION

Root rotation SHALL follow TUF's sequential root-update chain.

For root version `N+1`:

- version SHALL be exactly `N+1`;
- the new root metadata SHALL meet the old root's signature threshold;
- the new root metadata SHALL also meet the new root's signature threshold;
- the client SHALL persist successfully verified root versions monotonically;
- skipped/intermediate root versions are not silently bypassed.

Compromised/replaced top-level role keys are revoked by trusted root metadata that removes/replaces them.

If fewer than the root threshold keys are compromised, normal threshold rotation/revocation is the supported recovery path.

If an attacker compromises a full root threshold, JARVIS SHALL NOT claim that ordinary in-band update metadata can securely self-recover. Recovery requires an out-of-band trusted recovery/reinstall procedure and incident response.

---

## J03-SUPPLY-08 — METADATA EXPIRATION / FREEZE RESISTANCE

Production metadata maximum validity periods are:

```text
timestamp: <= 7 days
snapshot:  <= 30 days
targets:   <= 90 days
root:      <= 365 days
```

A release may use shorter periods.

Expired required metadata is not trusted to authorize a new target/module activation.

The one narrow exception is the TUF root-update procedure: an already trusted root metadata version MAY be used, even if its expiration has passed, only to authenticate the strictly sequential `N+1` root chain. After attempting root update, the final trusted root's expiration SHALL be checked against the fixed update-start time before timestamp/snapshot/targets processing or target activation proceeds. If that final trusted root is expired, the update cycle aborts and reports a potential freeze/trust-expiry condition.

If update metadata is expired/unavailable, the installed application may continue operating according to its normal security policy, but JARVIS SHALL truthfully report update/catalog trust as stale/unavailable and SHALL NOT activate newly obtained targets under expired authorization.

The client persists last-trusted metadata versions and update observation state. A material system-clock rollback relative to already trusted update observations SHALL produce a diagnostic/trust-degraded state rather than silently treating obviously stale metadata as fresh.

---

## J03-SUPPLY-09 — TARGET INTEGRITY AND CONSISTENT SNAPSHOTS

Application/module targets SHALL be bound by trusted TUF metadata to at least:

- target path/identity;
- exact byte length;
- SHA-256 digest;
- release/module identity and version in signed custom metadata;
- applicable platform/runtime-role/architecture metadata;
- release/catalog sequence data required by JARVIS policy.

Downloads are bounded by trusted target length before unbounded storage/allocation.

A hash/length mismatch rejects the target regardless of transport TLS success.

---

## J03-SUPPLY-10 — JARVIS RELEASE ANTI-ROLLBACK POLICY

TUF metadata rollback protection is mandatory but not sufficient by itself to authorize an older application target.

Every production JARVIS application target SHALL carry signed metadata equivalent to:

```text
releaseId
jarvisVersion
releaseSequence       // monotonically increasing uint64
securityEpoch         // monotonically non-decreasing uint64
platform/runtime/arch
sourceCommitSha
artifactSha256
rollbackPolicy
```

The client persists the highest trusted `releaseSequence` and `securityEpoch` it has accepted.

Normal update SHALL reject an application target whose `releaseSequence` is lower than the highest trusted sequence.

A controlled rollback is allowed only when **current trusted targets metadata** explicitly authorizes that exact rollback target for the installed/current release and:

- the target is not revoked;
- its `securityEpoch` is not below the client's minimum allowed security epoch;
- the paired database/schema rollback state is available/verified;
- normal update/recovery policy authorizes activation.

Possession of an old validly signed installer alone is insufficient for in-app rollback authorization.

A security response may raise the minimum allowed `securityEpoch` or revoke specific release IDs/hashes, after which those targets SHALL NOT be reactivated through the normal updater.

---

## J03-SUPPLY-11 — MODULE ANTI-ROLLBACK / REVOCATION

Module catalog metadata SHALL identify immutable module version target hashes and catalog sequence/revocation state.

A previously valid module artifact SHALL NOT be newly installed/activated when the current trusted catalog metadata revokes its target hash/version or no longer authorizes it for the active JARVIS/platform profile.

Rollback to a retained module version requires that the exact target remains currently authorized by trusted catalog metadata and is compatible with the active release/security policy.

---

## J03-SUPPLY-12 — TAURI UPDATER AND WINDOWS SIGNING LAYERS

For Windows V1, production application updates SHALL pass all applicable layers:

```text
TUF metadata authorization + hash/length/version/anti-rollback
AND
Tauri updater artifact-signature verification
AND
Windows production code-signing / Authenticode policy
AND
JARVIS release-manifest / schema / rollback compatibility checks
```

Tauri's runtime updater public key, when rotation is required, SHALL be selected only from already trusted JARVIS/TUF-authorized metadata or an embedded trusted bootstrap. It SHALL NOT be accepted directly from an unauthenticated update-server response.

A valid Tauri/Authenticode signature does not override TUF revocation/rollback/security-epoch policy.

A valid TUF target does not bypass the platform's required artifact signing checks.

---

## J03-SUPPLY-13 — STAGED ACTIVATION

Downloaded application/module targets remain staged/untrusted-for-execution until every required trust, compatibility, platform, migration, health, and policy gate passes.

Application activation SHALL preserve the existing paired binary/database backup/rollback semantics.

Module activation SHALL preserve immutable-version staging and retained rollback points.

No target is executed from an unverified temporary download path merely to run a health check.

---

## J03-SUPPLY-14 — TRUST METADATA STORAGE

The client SHALL durably retain the minimum trusted TUF state required to detect rollback/freeze/mix-and-match attempts, including current trusted root and the last accepted role metadata versions/hashes as required by the selected implementation.

Trusted update metadata is authoritative security state. It SHALL use crash-safe persistence and SHALL NOT be silently reset because cache cleanup occurred.

Deleting ordinary application cache SHALL NOT reset the trusted-root/version floor.

---

## J03-SUPPLY-15 — KEY INCIDENTS

A key-security incident SHALL support explicit states/reason codes equivalent to:

```text
UPDATE_TRUST_METADATA_EXPIRED
UPDATE_ROOT_ROTATION_REQUIRED
UPDATE_SIGNATURE_INVALID
UPDATE_TARGET_REVOKED
UPDATE_ROLLBACK_BLOCKED
UPDATE_SECURITY_EPOCH_BLOCKED
UPDATE_TRUST_ROOT_COMPROMISE_SUSPECTED
MODULE_TARGET_REVOKED
CATALOG_TRUST_UNAVAILABLE
```

Security-sensitive trust failures fail closed for new activation while preserving truthful diagnostics/recovery options.

---

## J03-SUPPLY-16 — RELEASE MANIFEST / PROVENANCE

Every production release SHALL record at least:

```text
tuf_spec_version
trusted_root_version
root_key_ids + threshold + custody class
targets_key_ids + threshold + custody class
snapshot_key_ids + threshold + custody class
timestamp_key_ids + threshold + custody class
module delegated-role identity/key ids + threshold + custody class
release_sequence
security_epoch
target metadata version/hash
Tauri updater signing key identity
Windows code-signing identity/timestamp metadata
revocation/minimum-version policy reference
```

Private signing keys never appear in the release manifest.

`RP-16` owns the selected V1 release-manifest field set. `J05-VER-36` owns proof that the exact production artifacts and provenance records satisfy that selection; this clause retains only the security validation requirements above.

---

## J03-SUPPLY-17 — REQUIRED QUALIFICATION

`J05-VER-22A` owns the complete supply-chain qualification catalog. Failure of any listed case blocks qualification.

---

## J03-SUPPLY-18 — STANDARDS BASIS

The trust lifecycle is based on The Update Framework specification 1.0.35. TUF's root, targets, snapshot, timestamp, threshold-signature, expiration, versioning, delegation, offline-key custody, and sequential root-update model is the normative update-metadata foundation for this JARVIS profile.

Tauri/Windows signing remains an additional artifact/platform integrity layer, not a replacement for TUF trust lifecycle semantics.

---

## J03-SUPPLY-19 — INVARIANTS

1. Root trust is threshold-based and recoverable from fewer-than-threshold key compromise.
2. Root, targets, snapshot, and install-authorizing module private keys are not ordinary online/CI/runtime keys; the timestamp key is the routinely-online minimally trusted role.
3. Application targets and supported executable-module targets require thresholded offline signing authority.
4. Role/key rotation and revocation are versioned authenticated state.
5. An expired already-trusted root may authenticate only the sequential root-update chain; final root freshness is required before normal update authorization continues.
6. Expired/stale metadata does not silently authorize new targets.
7. Old valid signatures do not bypass current revocation/anti-rollback policy.
8. Application and module trust authorities are scoped/delegated separately.
9. TUF, Tauri signature, and Windows code-signing gates are cumulative for Windows production updates.
10. Trusted metadata survives ordinary cache cleanup and crashes.
11. A full root-threshold compromise is not falsely claimed to be safely recoverable in-band.
12. Update/module trust failures block activation and remain diagnostically explicit.

---

**END — JARVIS SECURITY & TRUST CONTRACT v1.0.9**
