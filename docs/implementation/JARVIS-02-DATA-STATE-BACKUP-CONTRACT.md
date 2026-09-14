# JARVIS Data, State & Backup Contract

**Contract Suite Version:** 1.0.8
**Version:** 1.0.8
**Component:** `J02`
**Status:** Canonical normative component
**Scope:** authoritative persistence, state machines, events, exact values, budgets, SQLite/SQLCipher operation, backup cryptography, restore, and recovery

---

This file is the sole normative home for the clauses in this component. The manifest fixes the component set and revisions; the Release Profile fixes the supported V1 product profile. The implementation plan, execution matrix, evidence records, and audits are execution aids and do not add authority.

Clause identifiers in this file are stable traceability anchors. Cross-component references use clause identifiers and the separate Release Profile; historical material cannot override or supplement this suite.
## J02-DATA-01 — PURPOSE

This document defines authoritative persistence, transactions, state machines, events, scopes, memory, artifacts, approvals, provider setup/usage, budgets, KDF metadata, SQLite/SQLCipher operation, encrypted backups, migrations, restore, and recovery.

UI, providers, workers, tools, integrations, and modules SHALL NOT invent their own authoritative state semantics.

---

---

## J02-DATA-02 — AUTHORITATIVE DATABASE

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

---

## J02-DATA-03 — DATABASE KEY

The live database uses a cryptographically random local database data-encryption key (`DB_DEK`).

`DB_DEK` SHALL NOT be the session password, an integration credential, or a deterministic derivative of either.

The local runtime form/wrapping is protected through Windows secure storage under the Rust boundary.

Normal Core domain state stores only opaque references/metadata needed to use the key path; plaintext `DB_DEK` is transient trusted-memory material.

---

---

## J02-DATA-04 — IDENTIFIERS, TIME, EXACT VALUES

New durable entities use UUIDv7 or an equivalently unique/time-sortable opaque identifier.

Durable timestamps use UTC ISO-8601 with millisecond precision or better.

Authoritative money uses J01-PROTO-05's:

```ts
interface MoneyAmount {
  currency: string;
  nanoUnits: string;
}
```

No database or TypeScript code may round authoritative budget/cost values through binary floating point.

SQLite storage MAY use checked INTEGER only where the full `nanoUnits` range is proven safe for that field; otherwise canonical decimal text SHALL be used. The logical protocol representation remains the canonical integer string.

---

---

## J02-DATA-05 — KDF PROFILE PERSISTENCE

Session-password verifiers and portable-recovery key slots SHALL retain the exact versioned KDF profile required to verify/derive them.

JARVIS-managed V1 production profiles are Argon2id version `0x13` and SHALL meet at least:

```text
memoryKiB  >= 65536
iterations >= 3
parallelism = 4
saltBytes  >= 16
outputBytes >= 32
```

Persistence SHALL retain, directly or through immutable profile reference:

```text
profile id
purpose: SESSION_PASSWORD | PORTABLE_RECOVERY
algorithm/version
memoryKiB
iterations
parallelism
salt length and actual random salt where required by the verifier/key slot
output length
created/activated timestamps
replacement/supersession metadata where applicable
```

The password/recovery secret itself is never stored.

A later release MAY strengthen parameters. Existing valid verifier/key slots remain interpretable using their recorded profile; after successful authentication/recovery, policy MAY atomically re-hash/re-wrap under the current stronger profile. Downgrade below the current production floor requires an explicit future security-contract revision and is not an automatic compatibility fallback.

---

---

## J02-DATA-06 — LOGICAL TABLE GROUPS

The schema SHALL provide logical ownership equivalent to:

```text
System
  schema_migrations
  system_meta
  settings
  feature_flags
  release_profile_state
  kdf_profiles

Session/Conversation
  user_profile
  trusted_sessions
  session_auth_verifiers
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
  provider_setup_state
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

---

## J02-DATA-07 — TRANSACTIONAL STATE CHANGES

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

Long-running AI, network, user-wait, filesystem, backup, provider setup, or external API work SHALL NOT hold an SQLite write transaction open.

SQLite and an external service/provider setup helper are never modeled as one atomic transaction. External effects use attempts, setup states, idempotency, preconditions, postconditions, and `UNCERTAIN`/repair recovery where appropriate.

---

---

## J02-DATA-08 — OPTIMISTIC CONCURRENCY

Authoritative mutable records SHALL use a monotonic `version`/equivalent token.

State mutations assert expected prior version/state. Stale worker/provider/UI responses cannot overwrite newer authoritative state.

Consequential policy/action records retain the policy snapshot/version used for authorization. A material policy change invalidates stale authorization according to PermissionEngine/Approval rules.

---

---

## J02-DATA-09 — MISSION STATE MACHINE

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

---

## J02-DATA-10 — TASK STATE MACHINE

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

`RESUMING` revalidates live state, scope, target, leases, provider setup/compatibility/health/locality, budget, approvals, and relevant preconditions.

`INVALIDATED` preserves historical completed output but marks it unusable by the active graph.

A task becomes `COMPLETED` only when its required acceptance/verification policy is satisfied.

---

---

## J02-DATA-11 — ATTEMPT STATE MACHINE

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

---

## J02-DATA-12 — EXECUTION SCOPE PERSISTENCE

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

---

## J02-DATA-13 — AUTHORITY ENVELOPES AND PERMISSION RECORDS

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

The deterministic precedence itself is defined by J03-SEC-13 and must be reproducible from persisted policy/state evidence.

---

---

## J02-DATA-14 — APPROVALS AND CANONICAL ACTION MATERIAL

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

Digest is exactly JCS → UTF-8 → SHA-256 → base64url-no-padding per J01-PROTO-25.

Immediately before consumption, Core re-resolves material identities/arguments and recomputes the descriptor/digest. Material mismatch invalidates the approval.

Approval is single-use. Approval consumption is transactionally guarded against double use. Crash after consumption with uncertain external execution does not auto-replay a destructive action.

---

---

## J02-DATA-15 — GRAPH VERSIONING AND ACCEPTANCE

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

---

## J02-DATA-16 — TASK INPUTS, OUTPUTS, ARTIFACTS

Task inputs persist goal, criteria, scope, authority, data policy, context/artifact references, role/capability requirements, and resource/budget policy.

Task outputs persist structured result/findings, artifact/change references, verification evidence, unresolved risks/questions, producing attempt/provider metadata, and resulting data policy.

Large/durable outputs use artifact references. Artifact metadata includes identity, logical/content type, size/hash, producing attempt, project if applicable, DataSensitivity, DataLocality, retention, and canonical internal storage reference.

Artifacts derived from `LOCAL_ONLY` remain `LOCAL_ONLY` absent explicit deterministic declassification/export.

`SECRET` content normally remains outside the general artifact store.

---

---

## J02-DATA-17 — WORKER CHECKPOINTS AND PROVIDER RESUME

A checkpoint SHALL be sufficient for a qualified fresh worker to continue without provider-private transcript history. It includes goal summary, completed work, decisions/findings, artifacts, verification state, current activity, next step, blockers, and live-state assumptions.

Private chain-of-thought is not stored.

Provider resume references may be persisted as sensitive opaque metadata when useful, but are never the sole source of material progress or completion evidence.

---

---

## J02-DATA-18 — EVENTS AND DEDUPLICATION

Durable domain events are append-oriented, versioned, and sufficient to explain authoritative transitions without AI reconstruction.

In-memory publication occurs only after the creating transaction commits.

External events persist source identity and stable deduplication key when available. Dedup survives restarts for at least the supported replay horizon.

A duplicate/replayed event does not create duplicate consequential work.

---

---

## J02-DATA-19 — RESOURCE/WORKSPACE LEASES

Exclusive resources use durable/recoverable lease records including owner instance/task/attempt, acquisition/heartbeat, resource identity, and lease type.

Examples include writable worktrees, provider slots, migration/backup/update locks, device resources, and other exclusive execution resources.

A lease is reclaimed only after owner death is established or the resource-specific recovery policy permits reclaim.

`RESUMING` validates/reacquires required leases before `RUNNING`.

---

---

## J02-DATA-20 — MEMORY AND CONVERSATION

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

---

## J02-DATA-21 — PRECEDENT RECORDS

Precedent records contain action class, scope/environment/target/account class, reversibility, consequence, prior user decision, timestamps, and confidence/relevance metadata.

Precedent is evidence only. It does not directly authorize HIGH/CRITICAL action, cannot cross environment/account/security boundaries, and never waives destructive final confirmation.

---

---

## J02-DATA-22 — PROVIDER SETUP / QUALIFICATION STATE

Provider setup state is durable logical state distinct from compatibility and health:

```text
NOT_REQUIRED
SETUP_REQUIRED
SETUP_IN_PROGRESS
SETUP_READY
REPAIR_REQUIRED
SETUP_FAILED
```

Persistence SHALL retain at least provider/distribution/version identity, setup policy/profile identity, current setup state, last setup/repair attempt timestamp/outcome, sanitized failure reason, last setup verification time, and conformance evidence reference where applicable.

A provider version/distribution change invalidates setup/conformance state according to its compatibility policy. JARVIS SHALL NOT carry `SETUP_READY` across a version change when the policy cannot prove the setup remains valid.

`SETUP_IN_PROGRESS` after crash/restart is reconciled through provider-specific setup probing; it does not become `SETUP_READY` by timeout or assumption.

Provider-owned internal sandbox credentials are not persisted by JARVIS as general secrets.

---

---

## J02-DATA-23 — PROVIDER QUOTA AND USAGE FACTS

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

---

## J02-DATA-24 — BUDGETS AND ATOMIC RESERVATIONS

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

---

## J02-DATA-25 — PROVIDERS, MODULES, INTEGRATIONS

Provider records separate installation/discovery, setup, compatibility, health/auth state, qualification evidence, model/capability availability, and current profile.

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

Integration account rows contain metadata and opaque credential handles only. Enabled/supported capability IDs are explicit. After state restore without local credential-store secrets, affected accounts become `REAUTH_REQUIRED`.

Proxmox connections persist stable connection/environment IDs, endpoint/trust configuration, capability/scope allowlists, status, and opaque credential handle. VM display names are not authoritative target identity.

---

---

## J02-DATA-26 — SQLITE WAL OPERATIONAL RULES

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

---

## J02-DATA-27 — BACKUP CLASSES AND CRYPTOGRAPHIC ENVELOPE

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

---

## J02-DATA-28 — BACKUP KEY SLOTS

`LOCAL_RECOVERY` SHALL contain a Windows current-user DPAPI/local-secure-store key slot suitable for unattended same-profile local restore.

`PORTABLE_STATE` SHALL contain an independent portable key slot based on a user-controlled recovery factor. The V1 passphrase path uses Argon2id version `0x13`, fresh random salt, versioned parameters meeting the current production KDF floor, and preferably a materially stronger memory cost when interactive restore remains practical. The derived key encrypts/wraps `BackupDEK`; it does not directly encrypt the entire package.

The key slot SHALL record its exact KDF profile/parameters needed for future recovery. A portable package MAY contain both local DPAPI and portable key slots.

The portable recovery passphrase/factor is never stored.

A package is labeled portable only after JARVIS verifies a non-DPAPI key slot can unlock its `BackupDEK`.

---

---

## J02-DATA-29 — BACKUP CONTENT POLICY

Normal backups may contain:

- authoritative database snapshot;
- non-secret validated configuration;
- module/integration registry metadata;
- required durable JARVIS-managed artifacts;
- migration/update/recovery/release metadata.

They SHALL NOT contain raw long-lived integration/provider credentials by default.

External Git repositories are not duplicated by ordinary JARVIS backup unless explicitly selected by a separate feature/policy.

The authenticated backup manifest records format/version, protection class, JARVIS/schema/protocol versions, content identities/hashes/sizes, encryption algorithm metadata, and key-slot/KDF profile metadata without exposing secret key material.

---

---

## J02-DATA-30 — BACKUP VERIFICATION

A backup is `VERIFIED` only after applicable checks prove:

- bounded/versioned container parses correctly;
- applicable key slot and recorded KDF profile are valid and unwrap `BackupDEK`;
- AEAD payload authentication succeeds;
- content hashes/manifest match;
- `SnapshotDBKey` can open the SQLCipher snapshot in validation flow;
- SQLite integrity check passes;
- required files/metadata exist;
- application/schema compatibility metadata is valid.

Portable disaster-recovery readiness additionally requires qualification of clean-profile restore using only the declared portable factor and backup package.

---

---

## J02-DATA-31 — CLEAN-PROFILE RESTORE

Portable restore follows:

```text
select package
→ parse bounded authenticated metadata
→ choose portable key slot
→ validate recorded KDF profile
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

After restore, old provider sessions/setup states/approvals/leases/external effects are revalidated/reconciled under normal recovery policy rather than blindly resumed/replayed.

---

---

## J02-DATA-32 — LOCAL RESTORE

Local rollback may use a local DPAPI key slot to obtain `BackupDEK` without repeatedly asking for the portable recovery factor.

It still authenticates/decrypts the package, opens/verifies the snapshot, and restores under exclusive maintenance rules.

A local-only backup is never labeled portable merely because its encrypted file can be copied elsewhere.

---

---

## J02-DATA-33 — SESSION PASSWORD AND STATE RECOVERY

Session password verifier and state-encryption recovery are separate.

A verified portable JARVIS recovery factor MAY authorize an explicit recovery flow that establishes a new JARVIS session password after successful recovery-factor verification and required state/recovery checks.

Without an applicable recovery factor, the old password is not derived from/recovered from its Argon2id verifier.

A clean-machine portable restore always creates a new session password after state is authenticated/decrypted/validated, using the current qualified session-password KDF profile.

Integration credentials remain separate and are re-authenticated as needed.

---

---

## J02-DATA-34 — DATABASE MIGRATIONS

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

Migrations affecting KDF profiles/verifiers, money precision, data policy, approval material, provider setup/module identities, encryption/backup formats, or recovery semantics require explicit compatibility fixtures.

---

---

## J02-DATA-35 — CORRUPTION RESPONSE

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

---

## J02-DATA-36 — RETENTION AND EXPORT

Retention distinguishes audit, worker events, conversation, artifacts, logs, backups, and transient cache.

Retention SHALL not delete the last known-good backup for a protected state solely to satisfy count/space preferences without an explicit safety policy.

User export/import is versioned and non-secret by default. Credential export, if implemented, is a separate high-risk encrypted/confirmed workflow.

---

---

## J02-DATA-37 — DATA INVARIANTS

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
18. Provider setup readiness is distinct from compatibility/health and is not inferred after crash/version change.
19. Module support is rooted in authenticated release/catalog provenance.
20. A portable backup can be restored without the historical live `DB_DEK`.
21. `SnapshotDBKey` is never stored outside the authenticated encrypted backup payload as plaintext.
22. Restored integrations without credentials become `REAUTH_REQUIRED`.
23. WAL activation/fix/connection safety state is release-qualified and observable.
24. Every production KDF verifier/key slot records a supported profile meeting the applicable floor at creation time.
25. Obsolete contract material does not create a second persistence/schema definition.

---

## J02-BACKUP-01 — PURPOSE

This contract freezes the cryptographic and structural rules for the first production JARVIS portable-backup format. It removes algorithm/nonce/chunk/key-slot ambiguity while preserving the existing `DB_DEK` → `SnapshotDBKey` → `BackupDEK` separation.

The implementation SHALL use reviewed cryptographic libraries. JARVIS SHALL NOT implement AES, GCM, HKDF, Argon2id, SHA-256, DPAPI, or random-number generation itself.

The governing rule is:

> **A portable backup is an offline security boundary. Its format, key hierarchy, recovery strength, ordering, truncation resistance, and restore semantics are versioned protocol—not implementation preference.**

---

---

## J02-BACKUP-02 — FORMAT IDENTITY

The first production format is:

```text
formatId: JARVIS_BACKUP_V1
formatVersion: 1
outerAead: AES_256_GCM
chunkSizeBytes: 4194304
maxPlaintextBytes: 1099511627776
chunkTagBytes: 16
chunkNonceBytes: 12
hash: SHA_256
canonicalMetadata: RFC_8785_JCS
```

`4194304` bytes is exactly 4 MiB. `1099511627776` bytes is exactly 1 TiB.

A package exceeding the V1 bounds SHALL be rejected before unbounded allocation or encryption/decryption. A future format may raise these bounds only through a versioned contract change.

---

---

## J02-BACKUP-03 — KEY HIERARCHY

Every backup SHALL use independent cryptographic material:

```text
live DB_DEK
  └─ protects the active local SQLCipher database only

fresh SnapshotDBKey (256 random bits per backup)
  └─ protects the backup SQLCipher snapshot

fresh BackupDEK (256 random bits per backup)
  └─ AES-256-GCM encrypts/authenticates the outer backup payload

recovery/local key slots
  └─ protect only BackupDEK
```

`DB_DEK`, `SnapshotDBKey`, `BackupDEK`, generated recovery secrets, and passphrase-derived KEKs SHALL NOT be reused as one another.

`SnapshotDBKey` SHALL exist only inside the authenticated encrypted outer payload and transient trusted restore memory. It SHALL NOT appear in the cleartext package descriptor, a sidecar, logs, diagnostics, or ordinary manifests.

`BackupDEK` SHALL be generated from the qualified OS CSPRNG for every backup. BackupDEK reuse across backup IDs is prohibited.

---

---

## J02-BACKUP-04 — SQLCIPHER SNAPSHOT REQUIREMENT

The database snapshot SHALL be produced through a release-qualified SQLite/SQLCipher-safe mechanism that proves a transactionally consistent encrypted snapshot and re-keys/exports it under the fresh `SnapshotDBKey`.

JARVIS SHALL NOT assume that a generic SQLite backup API has identical behavior for every SQLCipher version/binding. Phase 3 qualification SHALL prove the exact selected binding/version and snapshot/re-key/export path on the packaged application.

The release manifest SHALL record the exact SQLCipher/SQLite/binding identities and the tested snapshot mechanism.

---

---

## J02-BACKUP-05 — PACKAGE DESCRIPTOR

The package begins with bounded cleartext metadata sufficient to parse and authenticate the package without exposing secret content.

Canonical semantic fields are equivalent to:

```ts
interface BackupPackageDescriptorV1 {
  domain: 'jarvis.backup.package.v1';
  formatId: 'JARVIS_BACKUP_V1';
  formatVersion: 1;
  backupId: string;                 // UUIDv7
  createdAt: string;                // UTC ISO-8601
  protectionClass: 'LOCAL_RECOVERY' | 'PORTABLE_STATE';
  outerAead: 'AES_256_GCM';
  chunkSizeBytes: 4194304;
  chunkCount: string;               // canonical uint64 decimal text
  plaintextBytes: string;           // canonical uint64 decimal text
  noncePrefix: string;              // base64url-no-pad, exactly 4 random bytes
  payloadManifestSha256: string;    // base64url-no-pad, 32 bytes
  keySlotCount: number;
}
```

The descriptor SHALL be RFC 8785 JCS canonicalized and hashed with SHA-256:

```text
descriptorDigest = SHA-256(UTF-8(JCS(descriptor)))
```

The descriptor and all parser-controlled metadata are bounded. V1 SHALL allow at most 16 key slots and a total unencrypted descriptor/key-slot metadata area of 256 KiB.

---

---

## J02-BACKUP-06 — CHUNK ENCRYPTION

The outer payload SHALL be divided into 4 MiB plaintext chunks, except the final chunk which may be shorter.

For each backup, generate exactly one random 32-bit `noncePrefix`. The AES-GCM nonce for chunk `i` is:

```text
nonce = noncePrefix[4 bytes] || uint64_be(i)[8 bytes]
```

Chunk indices start at zero and SHALL be contiguous. Because each backup has a fresh BackupDEK and each chunk index is unique within that key, no two chunks under one BackupDEK may use the same nonce.

Every chunk SHALL use a 128-bit GCM authentication tag.

AAD is the RFC 8785 JCS encoding of:

```ts
interface BackupChunkAadV1 {
  domain: 'jarvis.backup.chunk.v1';
  backupId: string;
  descriptorSha256: string;
  chunkIndex: string;
  chunkCount: string;
  plaintextLength: number;
}
```

`descriptorSha256` is base64url-no-pad of `descriptorDigest`.

Decryption SHALL reject:

- duplicate, missing, out-of-order, or non-contiguous chunk indices;
- chunk count different from the descriptor;
- total plaintext length different from the descriptor;
- per-chunk length inconsistent with the fixed/final chunk rules;
- any GCM authentication failure;
- any trailing or unknown record after the declared package end;
- payload manifest hash different from `payloadManifestSha256`.

These checks make reordering, deletion, duplication, truncation, and unauthenticated extension detectable.

---

---

## J02-BACKUP-07 — GENERATED PORTABLE RECOVERY SECRET

Every production `PORTABLE_STATE` backup SHALL contain at least one `GENERATED_RECOVERY_V1` key slot backed by a JARVIS-generated 256-bit recovery secret from the OS CSPRNG.

This generated recovery secret is the production portability anchor. A user-selected passphrase MAY be added as an additional convenience slot but SHALL NOT be the sole key slot used to label a backup `PORTABLE_STATE VERIFIED`.

The canonical generated secret representation is:

```text
JRV1-<base64url-no-pad of exactly 32 random bytes>
```

The prefix is presentation/version metadata and is not part of the 32-byte secret. JARVIS SHALL support copy/paste and SHOULD support QR/print presentation to reduce transcription errors.

The generated recovery secret SHALL be shown only through an explicit recovery-setup/export flow. It SHALL NOT be written to normal logs, SQLite domain rows, AI context, ordinary diagnostic exports, or ordinary backup plaintext metadata.

JARVIS MAY offer an explicitly labeled local convenience copy protected by PlatformSecureStorage, but possession of such a local copy does not count as proof that the user has preserved an independent disaster-recovery factor.

---

---

## J02-BACKUP-08 — GENERATED-RECOVERY KEY SLOT

For a `GENERATED_RECOVERY_V1` slot:

1. parse the exact 32-byte recovery secret;
2. derive a 32-byte slot KEK using HKDF-SHA-256:

```text
IKM  = recoverySecret
salt = descriptorDigest
info = UTF-8("jarvis.backup.generated-recovery.v1/" + slotId)
L    = 32
```

3. generate a fresh random 96-bit AES-GCM wrap nonce;
4. AES-256-GCM encrypt `BackupDEK` with the slot KEK and a 128-bit tag.

The slot AAD is RFC 8785 JCS over an object equivalent to:

```ts
{
  domain: 'jarvis.backup.keyslot.v1',
  backupId,
  descriptorSha256,
  slotId,
  slotType: 'GENERATED_RECOVERY_V1',
  wrapAead: 'AES_256_GCM'
}
```

A slot record stores only the slot ID/type, wrap algorithm, wrap nonce, wrapped BackupDEK, authentication tag, and non-secret metadata needed to reproduce the AAD/derivation.

---

---

## J02-BACKUP-09 — OPTIONAL PASSPHRASE KEY SLOT

A `PASSPHRASE_ARGON2ID_V1` slot MAY be added in addition to the generated-recovery slot.

The passphrase path SHALL:

- accept Unicode and normalize to NFC before UTF-8 encoding;
- accept paste/password-manager input;
- not truncate;
- accept at least 128 Unicode code points;
- require at least 20 Unicode code points for a production portable-backup passphrase;
- reject known common/compromised/context-specific values using a maintained blocklist;
- impose no character-class composition rules;
- use a fresh random salt of at least 16 bytes per slot.

The production portable-passphrase KDF SHALL use Argon2id version `0x13` with at least:

```text
memoryKiB  >= 262144
iterations >= 3
parallelism = 4
outputBytes >= 32
```

The exact KDF profile is recorded in the slot. The implementation SHALL enforce bounded maximum KDF parameters before allocating memory.

The derived 32-byte value is the slot KEK. `BackupDEK` is wrapped with AES-256-GCM using a fresh random 96-bit nonce, a 128-bit tag, and AAD binding `backupId`, `descriptorSha256`, `slotId`, `slotType`, and the exact KDF-profile identity/parameters.

Wrong passphrase fails authentication without modifying the source backup.

---

---

## J02-BACKUP-10 — WINDOWS LOCAL-RECOVERY SLOT

`LOCAL_RECOVERY` on Windows V1 SHALL support a current-user Windows PlatformSecureStorage/DPAPI-backed slot for `BackupDEK`.

The local slot SHALL bind to the backup/descriptor identity using the qualified Windows backend's authenticated/additional-entropy facility where the selected implementation safely supports it.

A DPAPI-only package SHALL NOT be labeled portable.

---

---

## J02-BACKUP-11 — ENCRYPTED PAYLOAD CONTENT

The authenticated encrypted payload SHALL contain at least:

- the SQLCipher snapshot encrypted under `SnapshotDBKey`;
- `SnapshotDBKey` as secret internal restore material;
- a bounded authenticated payload manifest;
- required non-secret validated configuration/registry state;
- required JARVIS-managed durable artifacts selected by backup policy;
- schema/migration/update/recovery compatibility metadata.

Raw long-lived integration/provider credentials remain excluded from ordinary backups.

The payload manifest SHALL identify every included object by logical type, bounded path/reference, size, and SHA-256 digest as applicable. The descriptor's `payloadManifestSha256` binds the decrypted manifest.

---

---

## J02-BACKUP-12 — RESTORE ORDER

Portable restore SHALL fail closed in this order:

```text
parse bounded descriptor/key-slot metadata
→ validate format/version/bounds
→ canonicalize + hash descriptor
→ obtain generated recovery secret or optional passphrase
→ authenticate/unwrap BackupDEK
→ authenticate/decrypt every chunk in strict order
→ validate total length and payload-manifest digest
→ recover SnapshotDBKey transiently
→ open/integrity-check SQLCipher snapshot
→ validate schema/release compatibility
→ preserve current state where required
→ restore under exclusive maintenance lock
→ generate fresh local DB_DEK
→ re-key restored DB
→ protect new DB_DEK with current PlatformSecureStorage
→ mark missing credentials REAUTH_REQUIRED
→ reconcile provider/approval/lease/external live state
```

No partial decrypted state becomes authoritative before the entire package and database integrity checks pass.

---

---

## J02-BACKUP-13 — ROTATION AND RECOVERY-FACTOR LIFECYCLE

Creating a new generated recovery secret SHALL create new key slots for future backups. Historical backup packages are not silently rewritten.

JARVIS SHALL clearly identify which verified backups are recoverable by which recovery-factor generation without storing the factors themselves.

Removing/losing the only generated-recovery factor for a backup means that backup can no longer satisfy the production `PORTABLE_STATE VERIFIED` claim, even if an optional user passphrase slot remains usable.

Recovery-factor setup/rotation/export is security-sensitive and auditable without recording the secret.

---

---

## J02-BACKUP-14 — REQUIRED TEST VECTORS AND QUALIFICATION

Production qualification SHALL include deterministic cross-language/golden fixtures for:

- RFC 8785 descriptor/AAD canonicalization;
- descriptor SHA-256;
- nonce construction;
- chunk 0, middle, and final chunk encryption/decryption;
- 128-bit GCM tag validation;
- generated-recovery HKDF derivation;
- passphrase Argon2id slot derivation;
- BackupDEK wrapping/unwrapping;
- wrong recovery secret/passphrase;
- modified descriptor;
- modified slot metadata;
- nonce/tag/ciphertext corruption;
- chunk reorder/delete/duplicate/truncate/append;
- malicious oversized counts/lengths/KDF parameters;
- clean-profile restore without historical DPAPI/DB_DEK;
- SQLCipher snapshot/re-key behavior on the exact selected production binding;
- no plaintext key material in package metadata/logs/diagnostics.

At least one full disaster-recovery drill SHALL use the exact signed Release Candidate artifacts and a separately preserved generated recovery secret.

---

---

## J02-BACKUP-15 — CRYPTOGRAPHIC PROFILE CHANGE

Changing the V1 backup cipher suite, nonce construction, tag length, chunk framing/AAD, key-slot derivation/wrapping, generated recovery-secret size, or passphrase KDF floor is a backup-format/security contract change and requires a new format version or explicitly proven backwards-compatible profile revision.

No implementation may substitute an "equivalent" construction under `JARVIS_BACKUP_V1` without a synchronous contract amendment.

---

---

## J02-BACKUP-16 — STANDARDS BASIS

The production profile is grounded in reviewed standards including NIST SP 800-38D GCM requirements, RFC 5869 HKDF, RFC 9106 Argon2id, RFC 8785 JCS, SHA-256, and the platform-qualified Windows data-protection backend.

A standards update does not silently mutate an already-defined backup format. Future changes are versioned and migration-tested.

---

---

## J02-BACKUP-17 — INVARIANTS

1. Every backup gets a fresh BackupDEK and SnapshotDBKey.
2. AES-GCM nonces never repeat under one BackupDEK.
3. Chunk order/count/length and payload manifest are authenticated.
4. Portable recovery does not require historical Windows DPAPI material.
5. A verified production portable backup always has a 256-bit generated-recovery slot.
6. A user passphrase is optional additional recovery, not the sole production portability anchor.
7. Secret keys/factors never appear in cleartext backup metadata/logs/AI context.
8. Restore authenticates the whole package and database before activation.
9. SQLCipher backup behavior is proven for the exact selected binding/version.
10. Backup-format crypto cannot vary by adapter preference.

---

**END — JARVIS DATA, STATE & BACKUP CONTRACT v1.0.8**
