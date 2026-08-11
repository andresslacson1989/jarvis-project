# JARVIS Data & State Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`  
**Version:** 1.0.2  
**Date:** August 11, 2026

---

# 1. PURPOSE

This document defines authoritative persistence, transactions, state machines, events, scopes, memory, artifacts, approvals, provider usage, budgets, SQLite/SQLCipher operation, encrypted backups, migrations, restore, and recovery.

UI, providers, workers, tools, integrations, and modules SHALL NOT invent their own authoritative state semantics.

---

# 2. AUTHORITATIVE DATABASE

V1 uses SQLite/SQLCipher-compatible encrypted SQLite for authoritative local state.

The production database SHALL:

- reside on a qualified local filesystem;
- use WAL unless an explicitly qualified alternative is adopted;
- use an embedded SQLite core proven to contain the upstream WAL-reset corruption fix;
- verify `journal_mode=WAL` actually became effective;
- use `synchronous=FULL` for authoritative state by default;
- enable foreign keys on every connection;
- initialize every connection through one owned path;
- use bounded busy handling;
- use explicit short transactions;
- expose WAL/checkpoint/busy/integrity diagnostics;
- use versioned migrations;
- contain no raw long-lived integration credentials;
- use exact monetary representations.

The production manifest identifies the SQLite/SQLCipher core, binding, build/source identity, and WAL-fix evidence.

The live authoritative database SHALL NOT run from UNC/SMB/NFS/cloud-sync virtual mounts or other unqualified remote/removable paths.

---

# 3. DATABASE KEY

The live database uses a cryptographically random local database data-encryption key (`DB_DEK`).

`DB_DEK` SHALL NOT be the session password, an integration credential, or a deterministic derivative of either.

The local runtime form/wrapping is protected through Windows secure storage under the Rust boundary.

Normal Core domain state stores only opaque references/metadata needed to use the key path; plaintext `DB_DEK` is transient trusted-memory material.

---

# 4. IDENTIFIERS, TIME, EXACT VALUES

New durable entities use UUIDv7 or an equivalently unique/time-sortable opaque identifier.

Durable timestamps use UTC ISO-8601 with millisecond precision or better.

Authoritative money uses the Protocol Contract's:

```ts
interface MoneyAmount {
  currency: string;
  nanoUnits: string;
}
```

No database or TypeScript code may round authoritative budget/cost values through binary floating point.

SQLite storage MAY use checked INTEGER only where the full `nanoUnits` range is proven safe for that field; otherwise canonical decimal text SHALL be used. The logical protocol representation remains the canonical integer string.

---

# 5. LOGICAL TABLE GROUPS

The schema SHALL provide logical ownership equivalent to:

```text
System
  schema_migrations
  system_meta
  settings
  feature_flags
  release_profile_state

Session/Conversation
  user_profile
  trusted_sessions
  conversations
  messages
  conversation_context

Projects/Scopes
  projects
  project_aliases
  project_environments
  project_workspaces
  project_integrations
  task_execution_scopes
  task_integration_scope_bindings

Memory
  memories
  memory_links
  memory_revisions

Missions/Tasks
  missions
  mission_graph_versions
  tasks
  task_dependencies
  task_attempts
  task_inputs
  task_outputs
  authority_envelopes
  authority_envelope_scopes

Workers/Artifacts/Leases
  worker_checkpoints
  worker_events
  artifacts
  artifact_links
  workspace_leases
  resource_leases

Permissions/Approvals
  permission_policies
  standing_permissions
  approval_requests
  approval_decisions
  precedent_records

Providers/Modules/Integrations
  providers
  provider_profiles
  provider_qualification_state
  provider_health_history
  modules
  module_versions
  module_catalog_entries
  module_catalog_keys
  integration_accounts
  integration_capabilities
  proxmox_connections

Events/Automation
  events
  event_dedup
  subscriptions
  automation_rules
  automation_runs
  notifications

Budget/Usage
  provider_quota_snapshots
  usage_records
  pricing_snapshots
  budgets
  budget_reservations

Operations
  audit_events
  backup_history
  update_history
  recovery_actions
```

Exact physical normalization may evolve before first production schema freeze as long as these ownership/invariant semantics remain.

---

# 6. TRANSACTIONAL STATE CHANGES

Authoritative transitions SHALL persist state and causative event/audit evidence atomically where they are within one SQLite transaction boundary.

Preferred pattern:

```text
compute/resolve/validate outside transaction
→ BEGIN
  assert expected row version/state
  write authoritative transition
  append causative event/audit
  update leases/reservations/indexes required by invariant
→ COMMIT
→ publish in-memory event
```

Long-running AI, network, user-wait, filesystem, backup, or external API work SHALL NOT hold an SQLite write transaction open.

SQLite and an external service are never modeled as one atomic transaction. External effects use attempts, idempotency, preconditions, postconditions, and `UNCERTAIN` recovery.

---

# 7. OPTIMISTIC CONCURRENCY

Authoritative mutable records SHALL use a monotonic `version`/equivalent token.

State mutations assert expected prior version/state. Stale worker/provider/UI responses cannot overwrite newer authoritative state.

Consequential policy/action records retain the policy snapshot/version used for authorization. A material policy change invalidates stale authorization according to PermissionEngine/Approval rules.

---

# 8. MISSION STATE MACHINE

Canonical mission states:

```text
CREATED
PLANNING
QUEUED
RUNNING
WAITING_FOR_USER
WAITING_FOR_APPROVAL
PAUSING
PAUSED
BLOCKED
VERIFYING
RECOVERING
COMPLETED
FAILED
CANCELLED
```

Terminal mission states are `COMPLETED`, `FAILED`, `CANCELLED`. A terminal mission does not silently return to running; continuation creates explicit linked work.

Representative legal transitions include:

```text
CREATED → PLANNING
PLANNING → QUEUED | WAITING_FOR_USER | FAILED | CANCELLED
QUEUED → RUNNING | PAUSED | CANCELLED
RUNNING → WAITING_FOR_USER | WAITING_FOR_APPROVAL | PAUSING | BLOCKED | VERIFYING | RECOVERING | FAILED | CANCELLED
PAUSING → PAUSED | FAILED | CANCELLED
PAUSED → QUEUED | RUNNING | CANCELLED
BLOCKED → QUEUED | RUNNING | WAITING_FOR_USER | WAITING_FOR_APPROVAL | FAILED | CANCELLED
WAITING_FOR_USER → QUEUED | RUNNING | CANCELLED
WAITING_FOR_APPROVAL → QUEUED | RUNNING | CANCELLED
VERIFYING → COMPLETED | RUNNING | BLOCKED | FAILED
RECOVERING → QUEUED | RUNNING | PAUSED | BLOCKED | WAITING_FOR_USER | FAILED | CANCELLED
```

Mission resume does not bypass task-level `RESUMING` validation.

---

# 9. TASK STATE MACHINE

Canonical task states:

```text
CREATED
WAITING_FOR_DEPENDENCY
QUEUED
STARTING
RUNNING
WAITING_FOR_APPROVAL
PAUSING
PAUSED
RESUMING
BLOCKED
VERIFYING
RECOVERING
COMPLETED
FAILED
CANCELLED
INVALIDATED
```

`RESUMING` is durable and canonical.

Required resume transitions:

```text
PAUSED → RESUMING | CANCELLED
RESUMING → RUNNING | QUEUED | BLOCKED | RECOVERING | FAILED | CANCELLED
```

`RESUMING` revalidates live state, scope, target, leases, provider compatibility/health/locality, budget, approvals, and relevant preconditions.

`INVALIDATED` preserves historical completed output but marks it unusable by the active graph.

A task becomes `COMPLETED` only when its required acceptance/verification policy is satisfied.

---

# 10. ATTEMPT STATE MACHINE

Attempt states:

```text
QUEUED
STARTING
RUNNING
CHECKPOINTING
WAITING_FOR_APPROVAL
PAUSING
PAUSED
SUCCEEDED
FAILED
CANCELLED
TIMED_OUT
UNCERTAIN
```

`SUCCEEDED` means the attempt produced its expected attempt result, not that the overall task is semantically complete.

`UNCERTAIN` means an effect may have occurred but final state is not established. Retry creates a new attempt identity and follows the recovery/idempotency policy.

---

# 11. EXECUTION SCOPE PERSISTENCE

Every executable task stores exactly one:

```text
PROJECT_WORKSPACE
INTEGRATION
SYSTEM
GLOBAL
```

`PROJECT_WORKSPACE` persists project/workspace and optional environment IDs and enforces workspace membership.

`INTEGRATION` persists explicit integration/account/capability bindings and optional organizational project/environment context.

`SYSTEM` persists explicit local system capabilities.

`GLOBAL` persists no implicit filesystem/integration/system authority.

Non-project work SHALL NOT create fake project/workspace rows.

Scope expansion after attempt start requires a new validated authority/revision; a worker cannot mutate its own scope.

---

# 12. AUTHORITY ENVELOPES AND PERMISSION RECORDS

Authority envelopes are immutable for active attempts and persist:

```text
originating instruction
allowed/denied action classes
allowed execution scopes
external systems
DataSensitivity
DataLocality
budget policy/reference
created/expires timestamps
policy snapshot version
```

Permission decisions persist:

```text
outcome
contextual risk
reason codes
matched policies
matched precedents as evidence only
approval request if required
policy version
```

The deterministic precedence itself is defined by the Security Contract and must be reproducible from persisted policy/state evidence.

---

# 13. APPROVALS AND CANONICAL ACTION MATERIAL

Approval states are exactly:

```text
PENDING
APPROVED
REJECTED
EXPIRED
CANCELLED
CONSUMED
```

An approval stores or integrity-binds:

```text
approval id/type
CanonicalActionDescriptorV1 or immutable reference
descriptor version
action digest algorithm + encoding
action digest
human action/target/environment/consequence summaries
created/expires timestamps
policy snapshot version
session/decision metadata
```

The canonical descriptor contains no raw secrets.

Digest is exactly JCS → UTF-8 → SHA-256 → base64url-no-padding per Protocol Contract.

Immediately before consumption, Core re-resolves material identities/arguments and recomputes the descriptor/digest. Material mismatch invalidates the approval.

Approval is single-use. Approval consumption is transactionally guarded against double use. Crash after consumption with uncertain external execution does not auto-replay a destructive action.

---

# 14. GRAPH VERSIONING AND ACCEPTANCE

Activated mission graph versions are immutable and include:

```text
mission/version
creation time/reason/causation
nodes
real dependency edges
MissionAcceptancePolicy
```

Before activation Core validates:

- acyclicity;
- node/dependency existence;
- required output dependencies;
- scope/environment/data-policy coherence;
- task acceptance/completion policy;
- destructive approval boundaries;
- authority-envelope containment or explicit revision;
- mission-level acceptance policy.

Bounded iteration belongs inside tasks/workers, not unbounded graph cycles.

---

# 15. TASK INPUTS, OUTPUTS, ARTIFACTS

Task inputs persist goal, criteria, scope, authority, data policy, context/artifact references, role/capability requirements, and resource/budget policy.

Task outputs persist structured result/findings, artifact/change references, verification evidence, unresolved risks/questions, producing attempt/provider metadata, and resulting data policy.

Large/durable outputs use artifact references. Artifact metadata includes identity, logical/content type, size/hash, producing attempt, project if applicable, DataSensitivity, DataLocality, retention, and canonical internal storage reference.

Artifacts derived from `LOCAL_ONLY` remain `LOCAL_ONLY` absent explicit deterministic declassification/export.

`SECRET` content normally remains outside the general artifact store.

---

# 16. WORKER CHECKPOINTS AND PROVIDER RESUME

A checkpoint SHALL be sufficient for a qualified fresh worker to continue without provider-private transcript history. It includes goal summary, completed work, decisions/findings, artifacts, verification state, current activity, next step, blockers, and live-state assumptions.

Private chain-of-thought is not stored.

Provider resume references may be persisted as sensitive opaque metadata when useful, but are never the sole source of material progress or completion evidence.

---

# 17. EVENTS AND DEDUPLICATION

Durable domain events are append-oriented, versioned, and sufficient to explain authoritative transitions without AI reconstruction.

In-memory publication occurs only after the creating transaction commits.

External events persist source identity and stable deduplication key when available. Dedup survives restarts for at least the supported replay horizon.

A duplicate/replayed event does not create duplicate consequential work.

---

# 18. RESOURCE/WORKSPACE LEASES

Exclusive resources use durable/recoverable lease records including owner instance/task/attempt, acquisition/heartbeat, resource identity, and lease type.

Examples include writable worktrees, provider slots, migration/backup/update locks, device resources, and other exclusive execution resources.

A lease is reclaimed only after owner death is established or the resource-specific recovery policy permits reclaim.

`RESUMING` validates/reacquires required leases before `RUNNING`.

---

# 19. MEMORY AND CONVERSATION

Memory scopes include user/global, project, mission, task, and session as appropriate.

Memory confidence is:

```text
VERIFIED
CONFIRMED
INFERRED
STALE
```

Records retain source/revision history, timestamps, verification/staleness metadata, DataSensitivity, and DataLocality.

Live verified state outranks stale memory for current truth.

Conversation history is separate from durable memory. Deleting one does not silently delete the other absent explicit linked policy.

Retrieving stored `LOCAL_ONLY` conversation/memory does not make it remotely routable.

---

# 20. PRECEDENT RECORDS

Precedent records contain action class, scope/environment/target/account class, reversibility, consequence, prior user decision, timestamps, and confidence/relevance metadata.

Precedent is evidence only. It does not directly authorize HIGH/CRITICAL action, cannot cross environment/account/security boundaries, and never waives destructive final confirmation.

---

# 21. PROVIDER QUOTA AND USAGE FACTS

Provider quota/usage snapshots preserve source provenance:

```text
PROVIDER_REPORTED
JARVIS_CALCULATED
UNKNOWN
```

Provider-reported facts are authoritative for what the provider reports and keep observation/reset timestamps. Local estimates may coexist but cannot be relabeled as provider facts.

Unknown cost/quota remains unknown rather than zero.

Usage records are append-oriented and include provider/model, task context where applicable, units, estimated/actual MoneyAmount, confidence/provenance, pricing snapshot if used, and time.

Deleting a task does not erase accounting facts required for budget/audit history.

---

# 22. BUDGETS AND ATOMIC RESERVATIONS

A hard monetary budget SHALL atomically consider:

```text
settled spend + outstanding reservations + requested reservation
```

before new chargeable work begins where expected monetary reservation is determinable.

A reservation state is:

```text
RESERVED
SETTLED
RELEASED
EXPIRED
UNCERTAIN
```

Reservation creation/admission is transactionally serialized against the applicable budget state so concurrent workers cannot each spend the same remaining amount.

Actual provider-reported/settled cost is recorded even if it exceeds the prior estimate. Uncertain provider billing/outcome may leave a reservation `UNCERTAIN` until reconciliation.

Different currencies are not added without an explicit versioned FX conversion contract.

---

# 23. PROVIDERS, MODULES, INTEGRATIONS

Provider records separate installation/discovery, compatibility, health/auth state, qualification evidence, model/capability availability, and current profile.

Module records separate:

```text
SUPPORTED
INSTALLED
ENABLED
AUTHORIZED
PREFERRED
HEALTHY
```

and store authenticated catalog/provenance metadata. Installed external code does not become `BUILT_IN_TRUSTED` through signature alone.

Integration account rows contain metadata and opaque credential handles only. After state restore without local credential-store secrets, affected accounts become `REAUTH_REQUIRED`.

Proxmox connections persist stable connection/environment IDs, endpoint/trust configuration, capability/scope allowlists, status, and opaque credential handle. VM display names are not authoritative target identity.

---

# 24. SQLITE WAL OPERATIONAL RULES

Every connection passes the owned initialization path that verifies required settings such as:

```text
foreign_keys = ON
approved synchronous policy
bounded busy handling
approved WAL compatibility
```

Long-running providers/network/user waits never occur while holding a write transaction.

Checkpoint strategy SHALL remain owned/observable. Sustained WAL growth, incomplete checkpoints, long-lived readers, repeated `SQLITE_BUSY`, or integrity failures emit diagnostics and may enter degraded/recovery state.

The `-wal`/`-shm` files are part of live database state. Backup SHALL use SQLite's online backup API or another explicitly SQLite-safe snapshot mechanism rather than copying only the main DB file.

---

# 25. BACKUP CLASSES AND CRYPTOGRAPHIC ENVELOPE

Backup protection classes are:

```text
LOCAL_RECOVERY
PORTABLE_STATE
```

Credential-bearing export, if later implemented, is a separate explicit workflow.

For every backup:

1. create a consistent SQLite-safe snapshot;
2. generate a fresh random backup-specific SQLCipher snapshot key (`SnapshotDBKey`);
3. re-key/export the backup snapshot so it is openable with `SnapshotDBKey`, not the historical live `DB_DEK`;
4. generate a fresh random 256-bit backup data-encryption key (`BackupDEK`);
5. build an authenticated backup payload containing the encrypted SQLCipher snapshot, `SnapshotDBKey` wrapped/authenticated as internal secret material, non-secret configuration/registry metadata, required durable JARVIS artifacts, and recovery/update manifests;
6. encrypt/authenticate the payload with `BackupDEK` using a reviewed AEAD (V1 preference AES-256-GCM or an equally reviewed qualified construction, chunked safely where required);
7. protect `BackupDEK` using one or more key slots.

The `SnapshotDBKey` SHALL never be emitted as plaintext sidecar or normal manifest data. It exists only inside the authenticated encrypted backup payload and trusted restore memory.

`BackupDEK` SHALL never be the live `DB_DEK`, session password, integration credential, deterministic backup metadata derivative, or long-lived global backup key.

---

# 26. BACKUP KEY SLOTS

`LOCAL_RECOVERY` SHALL contain a Windows current-user DPAPI/local-secure-store key slot suitable for unattended same-profile local restore.

`PORTABLE_STATE` SHALL contain an independent portable key slot based on a user-controlled recovery factor. The V1 passphrase path uses Argon2id with fresh salt, versioned parameters, and a strong baseline calibrated for interactive restore. The derived key encrypts/wraps `BackupDEK`; it does not directly encrypt the entire package.

A portable package MAY contain both local DPAPI and portable key slots.

The portable recovery passphrase/factor is never stored.

A package is labeled portable only after JARVIS verifies a non-DPAPI key slot can unlock its `BackupDEK`.

---

# 27. BACKUP CONTENT POLICY

Normal backups may contain:

- authoritative database snapshot;
- non-secret validated configuration;
- module/integration registry metadata;
- required durable JARVIS-managed artifacts;
- migration/update/recovery/release metadata.

They SHALL NOT contain raw long-lived integration/provider credentials by default.

External Git repositories are not duplicated by ordinary JARVIS backup unless explicitly selected by a separate feature/policy.

The authenticated backup manifest records format/version, protection class, JARVIS/schema/protocol versions, content identities/hashes/sizes, encryption algorithm metadata, and key-slot types without exposing secret key material.

---

# 28. BACKUP VERIFICATION

A backup is `VERIFIED` only after applicable checks prove:

- bounded/versioned container parses correctly;
- applicable key slot unwraps `BackupDEK`;
- AEAD payload authentication succeeds;
- content hashes/manifest match;
- `SnapshotDBKey` can open the SQLCipher snapshot in validation flow;
- SQLite integrity check passes;
- required files/metadata exist;
- application/schema compatibility metadata is valid.

Portable disaster-recovery readiness additionally requires qualification of clean-profile restore using only the declared portable factor and backup package.

---

# 29. CLEAN-PROFILE RESTORE

Portable restore follows:

```text
select package
→ parse bounded authenticated metadata
→ choose portable key slot
→ derive/unlock BackupDEK
→ authenticate/decrypt outer payload
→ recover SnapshotDBKey transiently
→ open + integrity-check SQLCipher snapshot
→ verify schema/application compatibility
→ preserve current state when possible
→ restore under exclusive maintenance lock
→ generate a fresh local DB_DEK
→ re-key restored database from SnapshotDBKey to new DB_DEK
→ protect new DB_DEK through current Windows secure storage
→ mark unavailable integration credentials REAUTH_REQUIRED
→ restart in recovery mode
→ reconcile external/live state
```

The old live `DB_DEK` is not required on a clean machine.

Wrong/unavailable recovery factor fails closed without modifying the only backup or partially activating unauthenticated contents.

After restore, old provider sessions/approvals/leases/external effects are reconciled under normal recovery policy rather than blindly resumed/replayed.

---

# 30. LOCAL RESTORE

Local rollback may use a local DPAPI key slot to obtain `BackupDEK` without repeatedly asking for the portable recovery factor.

It still authenticates/decrypts the package, opens/verifies the snapshot, and restores under exclusive maintenance rules.

A local-only backup is never labeled portable merely because its encrypted file can be copied elsewhere.

---

# 31. SESSION PASSWORD AND STATE RECOVERY

Session password verifier and state-encryption recovery are separate.

A verified portable JARVIS recovery factor MAY authorize an explicit recovery flow that establishes a new JARVIS session password after successful recovery-factor verification and required state/recovery checks.

Without an applicable recovery factor, the old password is not derived from/recovered from its Argon2id verifier.

A clean-machine portable restore always creates a new session password after state is authenticated/decrypted/validated.

Integration credentials remain separate and are re-authenticated as needed.

---

# 32. DATABASE MIGRATIONS

Every schema change has a monotonic migration identity.

Startup migration flow:

1. read schema version;
2. reject newer unsupported schema;
3. create/verify pre-migration backup;
4. acquire exclusive migration lock;
5. apply deterministic migrations;
6. validate schema/integrity;
7. record success;
8. release lock;
9. continue startup.

Failure enters Recovery Mode and preserves pre-migration backup.

Rollback to an older binary with incompatible schema restores the paired pre-update database snapshot rather than relying on unsafe reverse SQL.

Migrations affecting money precision, data policy, approval material, provider/module identities, encryption/backup formats, or recovery semantics require explicit compatibility fixtures.

---

# 33. CORRUPTION RESPONSE

If database integrity cannot be established:

- stop normal consequential execution;
- enter Recovery Mode;
- preserve damaged files for diagnostics;
- identify newest compatible verified backup;
- require explicit restore approval unless a narrow existing recovery policy permits otherwise;
- do not speculative-write-repair the only production copy;
- reconcile recovered external state before resumed consequential work.

WAL-related corruption is a persistence incident even if some higher-level records remain readable.

---

# 34. RETENTION AND EXPORT

Retention distinguishes audit, worker events, conversation, artifacts, logs, backups, and transient cache.

Retention SHALL not delete the last known-good backup for a protected state solely to satisfy count/space preferences without an explicit safety policy.

User export/import is versioned and non-secret by default. Credential export, if implemented, is a separate high-risk encrypted/confirmed workflow.

---

# 35. DATA INVARIANTS

1. Every executable task has exactly one valid ExecutionScope.
2. Filesystem/repository mutation requires `PROJECT_WORKSPACE`.
3. Every attempt belongs to exactly one task.
4. Every active mission points to exactly one immutable active graph version.
5. Every consequential tool execution has a PermissionDecision reference.
6. Every destructive execution has a consumed unexpired final confirmation bound to the current canonical action descriptor.
7. Every completed task has required verification evidence.
8. Credential rows contain opaque handles, not raw secrets.
9. Terminal states do not silently return to running.
10. `PAUSED` tasks enter durable `RESUMING` before new execution.
11. Invalidated outputs remain historical/auditable.
12. Event deduplication survives restart.
13. Budget/accounting facts cannot be erased by deleting task history and use exact money.
14. Concurrent hard-budget admission is reservation-safe.
15. DataSensitivity and DataLocality are independent and conservatively propagated.
16. Provider-reported usage/quota provenance is not rewritten as local estimate or vice versa.
17. Provider resume handles are not the sole durable task state.
18. Module support is rooted in authenticated release/catalog provenance.
19. A portable backup can be restored without the historical live `DB_DEK`.
20. `SnapshotDBKey` is never stored outside the authenticated encrypted backup payload as plaintext.
21. Restored integrations without credentials become `REAUTH_REQUIRED`.
22. WAL activation/fix/connection safety state is release-qualified and observable.
23. Historical contracts/ADRs do not create a second persistence/schema definition.

---

**END — JARVIS DATA & STATE CONTRACT v1.0.2**
