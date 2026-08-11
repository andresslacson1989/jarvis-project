# JARVIS Data & State Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.md`  
**Version:** 1.0  
**Date:** August 11, 2026

---

# 1. PURPOSE

This document defines authoritative persistence, identifiers, state machines, transactions, event durability, graph/version semantics, backups, schema migration, memory representation, artifacts, and recovery data rules.

A production implementation SHALL NOT invent state transitions independently in UI components, provider adapters, or workers.

---

# 2. DATABASE

The primary V1 durable state store SHALL be SQLite.

The production database SHALL:

- enable foreign-key enforcement;
- use WAL journaling unless a validated platform limitation requires another mode;
- use a durability setting appropriate for authoritative mission/task state;
- use explicit transactions for state transitions;
- perform integrity checks during backup/recovery workflows;
- maintain versioned schema migrations;
- avoid storing raw long-lived credentials.

Sensitive database content SHALL be protected at rest according to the Security Hardening Contract. The recommended production implementation is SQLCipher-compatible encrypted SQLite using a random database key protected by Windows secure storage.

---

# 3. IDENTIFIERS AND TIME

New durable entities SHALL use globally unique, time-sortable identifiers such as UUIDv7.

Identifiers SHALL be opaque to AI providers and users unless displayed for diagnostics.

All durable timestamps SHALL be stored in UTC with millisecond precision or better.

Durations SHALL be stored as numeric milliseconds where practical.

Human-facing timezone conversion SHALL occur at the presentation layer.

---

# 4. CORE TABLE GROUPS

The schema SHALL contain logical tables equivalent to the following groups.

## System

```text
schema_migrations
system_meta
settings
feature_flags
```

## Session and Conversation

```text
user_profile
trusted_sessions
conversations
messages
conversation_context
```

## Projects and Workspaces

```text
projects
project_aliases
project_environments
project_workspaces
project_integrations
```

## Memory

```text
memories
memory_links
memory_revisions
```

## Missions and Tasks

```text
missions
mission_graph_versions
tasks
task_dependencies
task_attempts
task_inputs
task_outputs
authority_envelopes
```

## Workers and Artifacts

```text
worker_checkpoints
worker_events
artifacts
artifact_links
workspace_leases
resource_leases
```

## Permissions and Approvals

```text
permission_policies
standing_permissions
approval_requests
approval_decisions
precedent_records
```

## Providers, Modules, Integrations

```text
providers
provider_profiles
provider_health_history
modules
module_versions
integration_accounts
integration_capabilities
```

## Events and Automation

```text
events
event_dedup
subscriptions
automation_rules
automation_runs
notifications
```

## Budget and Usage

```text
usage_records
budgets
budget_thresholds
```

## Audit and Operations

```text
audit_events
backup_history
update_history
recovery_actions
```

Exact physical normalization MAY evolve, but the logical ownership and constraints in this document SHALL remain.

---

# 5. TRANSACTIONAL STATE CHANGES

Every authoritative state transition SHALL be persisted transactionally with its causative event/audit record when practical.

A transaction changing a mission/task state SHALL not commit the state while failing to persist the event that explains it.

The preferred pattern is:

```text
BEGIN
  validate current state/version
  write new state
  append durable event
  update derived indexes/leases
COMMIT
publish event to in-memory subscribers after commit
```

In-memory event delivery SHALL never be the only record of an authoritative transition.

---

# 6. OPTIMISTIC CONCURRENCY

Authoritative mutable rows SHALL include a monotonic `version` or equivalent concurrency token.

State changes SHALL assert the expected current version/state before update.

A stale worker/provider response SHALL not overwrite newer task/mission state.

Conflict SHALL be surfaced as a typed concurrency error and reconciled by the owning service.

---

# 7. MISSION STATE MACHINE

Mission states SHALL include:

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

Terminal states are:

```text
COMPLETED
FAILED
CANCELLED
```

A mission SHALL not transition from a terminal state back to running. Restarting work creates a new mission or an explicit continuation mission linked to the prior mission.

Representative legal transitions include:

```text
CREATED → PLANNING
PLANNING → QUEUED | WAITING_FOR_USER | FAILED | CANCELLED
QUEUED → RUNNING | PAUSED | CANCELLED
RUNNING → WAITING_FOR_USER | WAITING_FOR_APPROVAL | PAUSING | BLOCKED | VERIFYING | RECOVERING | FAILED | CANCELLED
PAUSING → PAUSED | FAILED
PAUSED → QUEUED | RUNNING | CANCELLED
BLOCKED → QUEUED | RUNNING | WAITING_FOR_USER | WAITING_FOR_APPROVAL | FAILED | CANCELLED
WAITING_FOR_USER → QUEUED | RUNNING | CANCELLED
WAITING_FOR_APPROVAL → QUEUED | RUNNING | CANCELLED
VERIFYING → COMPLETED | RUNNING | BLOCKED | FAILED
RECOVERING → QUEUED | RUNNING | PAUSED | BLOCKED | WAITING_FOR_USER | FAILED | CANCELLED
```

Illegal transitions SHALL be rejected by the Mission Manager.

---

# 8. TASK STATE MACHINE

Task states SHALL include:

```text
CREATED
WAITING_FOR_DEPENDENCY
QUEUED
STARTING
RUNNING
WAITING_FOR_APPROVAL
PAUSING
PAUSED
BLOCKED
VERIFYING
RECOVERING
COMPLETED
FAILED
CANCELLED
INVALIDATED
```

`INVALIDATED` is terminal for that task version and means its prior output is no longer valid for the active graph due to changed assumptions or graph revision.

A completed task MAY be invalidated by a later graph revision, but the original completion record and artifacts SHALL remain immutable/auditable.

A task SHALL not become `COMPLETED` directly from `RUNNING` unless all configured verification is part of the same atomic task completion policy; otherwise it SHALL pass through `VERIFYING`.

---

# 9. TASK ATTEMPT STATE MACHINE

Each execution attempt SHALL use states equivalent to:

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

Attempt state SHALL describe one provider/worker execution, not the task's overall semantic result.

`SUCCEEDED` means the attempt successfully produced its output; the task may still require verification.

`UNCERTAIN` means execution may have caused side effects but the final result cannot yet be established.

---

# 10. APPROVAL STATE MACHINE

Approval requests SHALL be durable objects with:

```text
PENDING
APPROVED
REJECTED
EXPIRED
CANCELLED
CONSUMED
```

An approval SHALL bind to an action digest containing the material target and arguments.

The default validity window for destructive final-confirmation approvals SHOULD be short (recommended 90 seconds) and SHALL be configurable by policy only within a bounded safe range.

Approval SHALL be single-use for the bound action unless the policy explicitly represents a standing permission rather than a one-time approval.

A changed target, environment, destructive scope, or materially changed arguments SHALL invalidate the prior approval.

---

# 11. AUTHORITY ENVELOPE

An authority envelope SHALL be immutable once a task attempt starts.

A new broader envelope requires a new validated revision/authorization record.

Envelope data SHALL include at least:

```text
id
originating_user_instruction_id
project_ids
environment_ids
workspace_ids
allowed_action_classes
denied_action_classes
external_systems
privacy_classification
budget_limit
created_at
expires_at_or_null
policy_snapshot_version
```

Workers receive a reference/copy of the envelope but SHALL not modify it.

---

# 12. GRAPH VERSIONING

A mission graph version SHALL be immutable after activation.

A graph version SHALL include:

```text
mission_id
graph_version
created_at
created_by
reason
causation_event_id
nodes
edges
acceptance_policy
```

Before activation, Core SHALL validate:

- no cycle exists between task nodes;
- every dependency references a valid node;
- no required output dependency points to a cancelled/invalid node without replacement;
- environment/workspace constraints are coherent;
- required tasks have completion policy;
- destructive nodes contain an approval boundary;
- graph expansion remains inside or explicitly revises the authority envelope.

Bounded iterative behavior belongs inside a task/worker loop, not as an unbounded graph cycle.

---

# 13. DEPENDENCIES

Dependency types SHOULD distinguish at least:

```text
REQUIRES_SUCCESS
REQUIRES_COMPLETION
REQUIRES_OUTPUT
OPTIONAL_INPUT
```

This prevents every edge from being interpreted as a hard success dependency.

A downstream node becomes runnable only when its mandatory dependencies satisfy the declared dependency policy.

---

# 14. TASK INPUTS AND OUTPUTS

Task inputs and outputs SHALL be persisted as structured references rather than hidden solely in provider conversation history.

Task input SHALL include:

- goal;
- acceptance criteria;
- structured context;
- artifact references;
- project/workspace/environment;
- authority envelope;
- role/capability requirements;
- resource/budget policy.

Task output SHALL include:

- status/result type;
- structured findings;
- artifact references;
- changed artifact references;
- verification evidence;
- unresolved risks/questions;
- provider/attempt reference;
- completion proposal.

---

# 15. ARTIFACT STORE

Large or durable worker outputs SHALL use an artifact store under the JARVIS data directory or explicit project workspace.

Artifacts SHALL have metadata equivalent to:

```text
artifact_id
content_type
logical_type
path_or_blob_ref
size
hash
created_by_task_attempt
project_id
sensitivity
retention_policy
created_at
```

Artifact paths SHALL be canonicalized and constrained to approved artifact/workspace roots.

Hashes SHALL be used when integrity or reproducibility matters.

Artifacts SHALL not silently disappear when provider conversations expire.

---

# 16. WORKER CHECKPOINTS

A checkpoint SHALL contain enough durable state to resume without replaying the entire provider conversation.

Checkpoint data SHALL include:

```text
task_id
attempt_id
sequence
created_at
goal_summary
completed_work
key_decisions
findings
artifacts
verification_state
current_activity
next_step
blockers
live_state_assumptions
provider_resume_handle_if_supported
```

Private chain-of-thought SHALL NOT be stored as checkpoint material.

A checkpoint MAY contain a concise provider-generated summary of relevant reasoning results/decisions.

---

# 17. WORKER EVENTS

Worker events SHALL be append-oriented.

Every event SHALL include:

```text
event_id
task_id
attempt_id
timestamp
type
summary
payload_version
payload
correlation_id
causation_id
```

Worker journals SHALL be reconstructable from these events and task/artifact records.

---

# 18. EVENT STORE

Durable domain events SHALL use an envelope equivalent to:

```json
{
  "eventId": "uuidv7",
  "occurredAt": "UTC timestamp",
  "type": "task.completed",
  "payloadVersion": 1,
  "aggregateType": "task",
  "aggregateId": "...",
  "correlationId": "...",
  "causationId": "...",
  "actorType": "user|core|worker|provider|integration|system",
  "actorId": "...",
  "payload": {}
}
```

Event payloads SHALL be versioned.

Breaking event changes require a new payload version and migration/compatibility policy.

In-memory subscribers receive events only after the transaction that created them commits.

---

# 19. EVENT DEDUPLICATION

External events SHALL carry a source identity and deduplication key when possible.

JARVIS SHALL persist recent deduplication records long enough to survive process restart/replay windows.

Duplicate delivery SHALL not create duplicate consequential tasks or actions.

Where the external source lacks stable IDs, JARVIS MAY derive a bounded hash from source + event type + stable fields + time bucket, but SHALL avoid over-deduplicating legitimately repeated events.

---

# 20. RESOURCE AND WORKSPACE LEASES

Exclusive resources SHALL use durable or recoverable leases.

A lease SHALL include:

```text
resource_id
owner_instance_id
owner_task_id
owner_attempt_id
acquired_at
heartbeat_or_last_seen
lease_type
```

Examples include writable worktrees, exclusive migration lock, backup lock, update lock, and sensitive device resources.

A stale lease SHALL only be reclaimed after the runtime proves the owning process/instance is dead or the lease's recovery policy permits it.

---

# 21. MEMORY RECORD

A memory record SHALL contain at least:

```text
memory_id
scope_type
scope_id
memory_type
content
confidence
source_type
source_id
created_at
updated_at
last_verified_at
stale_after_or_null
supersedes_memory_id_or_null
sensitivity
```

Confidence SHALL include:

```text
VERIFIED
CONFIRMED
INFERRED
STALE
```

Corrections SHALL create revision history rather than silently erasing prior recorded decisions where auditability matters.

Retrieved memories SHALL be ranked by scope match, type relevance, confidence, recency/verification, and semantic relevance when embeddings are used.

---

# 22. CONVERSATION STORAGE

Conversation messages SHALL preserve user-visible history separately from long-term memory.

Messages SHALL have sensitivity classification.

Conversation retention MAY be user-configurable.

Deleting conversation history SHALL not automatically delete independent project decisions/memories unless the user explicitly requests linked-memory deletion and policy permits it.

The UI SHALL distinguish conversation history from durable project memory when useful.

---

# 23. PRECEDENT RECORDS

Precedent used for autonomy decisions SHALL be structured.

A precedent SHALL include:

```text
action_class
target_scope
environment
project
reversibility
consequence_class
user_decision
created_at
last_used_at
confidence
```

A precedent SHALL NOT directly authorize a destructive/unrecoverable action.

Precedent matching SHALL be conservative across environment boundaries.

Production and security-sensitive precedents SHALL not be inferred from development actions.

---

# 24. BUDGET AND USAGE

Usage records SHALL be append-only accounting facts where possible.

A usage record SHOULD include:

```text
provider
model
project
mission
task
attempt
units/tokens/runtime if known
estimated_cost
actual_cost_if_known
currency
occurred_at
source
```

Budget checks SHALL use the latest persisted usage plus reservations for running/queued metered work where practical.

Concurrent workers SHALL not each independently assume the entire remaining budget is available.

---

# 25. SETTINGS

Settings SHALL be typed and versioned.

Unknown settings SHALL not silently become active.

Invalid configuration SHALL fail validation and preserve the previous valid configuration.

Secrets SHALL not be stored in ordinary settings rows/files.

Settings that materially affect permission/security policy SHALL be auditable.

---

# 26. MODULE STATE

Module records SHALL separate:

```text
SUPPORTED
INSTALLED
ENABLED
AUTHORIZED
PREFERRED
HEALTHY
```

Module versions SHALL be immutable install units.

Activation points to one installed version.

Rollback changes activation pointer/state; it does not overwrite the previous module files in place.

---

# 27. INTEGRATION ACCOUNT STATE

Integration account rows SHALL contain metadata and opaque credential handles only.

Example:

```text
integration_id
account_id
display_name
tenant/domain
credential_handle
scopes/capabilities
status
last_verified_at
```

Raw OAuth refresh tokens/API keys SHALL reside in Windows-protected secure storage, not the SQLite row.

---

# 28. DATABASE MIGRATIONS

Every schema change SHALL have a monotonic migration identifier.

Production startup SHALL:

1. read schema version;
2. reject databases newer than supported by the binary;
3. create a verified pre-migration backup when migration is required;
4. acquire exclusive migration lock;
5. apply migrations in deterministic order;
6. validate schema/integrity;
7. record migration success;
8. release lock;
9. start normal runtime.

Migration failure SHALL enter Recovery Mode and preserve the pre-migration backup.

Migrations SHALL be forward-oriented. A rollback of application version that cannot read the migrated schema SHALL restore the paired pre-update database snapshot rather than attempting unsafe reverse SQL by default.

---

# 29. DATABASE BACKUP

SQLite backup SHALL use the database's online backup mechanism or another SQLite-safe snapshot mechanism rather than copying a live database file incorrectly.

A backup SHALL include metadata:

```text
backup_id
app_version
schema_version
created_at
reason
integrity_status
content_hash/manifest
```

Backup creation SHALL run an integrity validation before marking the backup usable.

Recommended automatic retention baseline:

```text
7 daily backups
4 weekly backups
3 pre-update/pre-migration backups
```

Retention SHALL be configurable, bounded by disk policy, and MUST NOT delete the last known-good backup merely to satisfy retention count.

---

# 30. BACKUP CONTENT

Automatic backups SHALL include:

- authoritative database;
- non-secret validated configuration;
- module/integration registry metadata;
- durable JARVIS-managed artifacts required to resume accepted missions;
- migration/update manifests needed for recovery.

Automatic backups SHALL NOT duplicate external Git repositories by default.

Raw credentials SHALL NOT be placed into normal backup archives.

A user-requested portable credential export, if implemented, SHALL use a separate strongly encrypted export mechanism with explicit confirmation and SHALL never occur automatically.

After restoring a backup without credentials, integration accounts MAY appear disconnected/re-authentication-required rather than inventing access.

---

# 31. RESTORE

Restore SHALL be an explicit maintenance operation.

Restore SHALL:

1. stop normal Core execution;
2. obtain exclusive maintenance lock;
3. preserve the current state as a rollback snapshot when possible;
4. verify selected backup manifest/integrity;
5. restore database/config/artifacts;
6. verify schema compatibility;
7. run integrity checks;
8. restart Core in recovery mode;
9. reconcile external/live state before resuming previously active work;
10. report restored/disconnected/uncertain items.

Restore SHALL not blindly re-run external side effects recorded before the backup.

---

# 32. CORRUPTION RESPONSE

If database integrity checks fail:

- normal consequential execution SHALL stop;
- JARVIS SHALL enter Recovery Mode;
- the damaged database SHALL be preserved for diagnostics;
- the system SHALL identify the newest verified backup;
- restore SHALL require explicit user approval unless an existing recovery policy explicitly permits automatic restore;
- recovered missions/tasks SHALL undergo normal external-state reconciliation.

JARVIS SHALL not attempt speculative write repair against the only copy of a corrupted production database.

---

# 33. RETENTION

Retention SHALL distinguish:

- security/audit history;
- worker verbose events;
- user conversation;
- artifacts;
- diagnostics logs;
- backups.

Recommended defaults:

```text
critical audit events: 365 days minimum
worker detailed events: 90 days
rotating diagnostic logs: bounded by size/time
conversation history: user-configurable
completed-task transient artifacts: policy-based cleanup
backups: per retention policy above
```

Security-relevant retention settings SHALL not permit silent deletion of evidence required to explain recent consequential actions.

---

# 34. DATA EXPORT/IMPORT

JARVIS SHOULD provide a versioned user export format for non-secret portable state including projects, preferences, memories, and selected history.

Export manifests SHALL include schema/contract version.

Import SHALL validate before mutation and SHALL not overwrite existing projects/memories without an explicit merge/conflict policy.

Secrets remain a separate explicit export path.

---

# 35. DATA INVARIANTS

The persistence implementation SHALL enforce these invariants:

1. Every task belongs to a project/workspace context when execution can affect files/systems.
2. Every task attempt belongs to exactly one task.
3. Every active mission points to exactly one active graph version.
4. Activated graph versions are immutable.
5. Every consequential tool execution has an authority/permission decision reference.
6. Every destructive tool execution has a consumed final-confirmation approval reference.
7. Every completed task has verification evidence or an explicit completion policy indicating why independent verification was not required.
8. Every worker checkpoint references its task/attempt.
9. Credential rows contain handles, not raw secrets.
10. Terminal states do not silently return to running.
11. Invalidated outputs remain auditable.
12. External event deduplication survives restart.
13. Budget usage cannot be reduced by deleting a task record.
14. Migration history is append-only.
15. Restore/recovery actions are auditable.

---

**END — JARVIS DATA & STATE CONTRACT v1.0**
