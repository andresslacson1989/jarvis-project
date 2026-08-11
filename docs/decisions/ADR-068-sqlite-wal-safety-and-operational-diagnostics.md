# ADR-068 — SQLite WAL Safety and Operational Diagnostics

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Persistence/runtime hardening  
**Scope:** JARVIS v1.0 authoritative SQLite/SQLCipher persistence

## Context

JARVIS uses SQLite as the authoritative local durable state store and prefers WAL journaling for concurrency and responsiveness.

WAL is a strong fit for the JARVIS workload, but a production implementation cannot treat `PRAGMA journal_mode=WAL` as a one-time setup detail. WAL introduces checkpointing, shared-memory behavior, single-writer contention, WAL-file growth, and version-specific correctness requirements that must be observable and qualified.

SQLite upstream also documents a rare WAL-reset corruption bug affecting multi-connection WAL use in SQLite versions through 3.51.2, with the upstream fix present in 3.51.3 and later and backports available for some earlier branches. Because JARVIS expects concurrent connections and authoritative durable state, production qualification must prove that the selected SQLite/SQLCipher build includes the fix rather than relying on version assumptions.

This ADR keeps WAL as the preferred production journal mode while making its safety prerequisites, durability posture, and operational diagnostics explicit.

---

## Decision

JARVIS V1 SHALL use SQLite/SQLCipher WAL mode for the authoritative database unless a validated platform limitation requires an explicitly qualified alternative.

Production Complete SHALL require all of the following:

1. the embedded SQLite/SQLCipher build includes the upstream WAL-reset corruption fix;
2. the runtime verifies that WAL activation actually succeeded;
3. the database resides on a local filesystem compatible with SQLite WAL shared-memory semantics;
4. authoritative durability uses a release-qualified synchronous policy, with `FULL` as the V1 default;
5. every connection is initialized with the required connection-local safety pragmas/handlers;
6. WAL/checkpoint health is observable;
7. checkpoint starvation, sustained `SQLITE_BUSY`, abnormal WAL growth, integrity failure, and unsupported runtime versions produce explicit degraded/recovery behavior rather than silent continuation.

---

## 1. SQLite/SQLCipher version and fix gate

JARVIS SHALL NOT infer WAL safety solely from a nominal SQLite version string when using SQLCipher or another embedded distribution.

The release manifest SHALL record enough evidence to identify the exact persistence runtime, including at least:

```text
sqlite_version
sqlcipher_version_if_applicable
build/source identity
compile options or build manifest reference
WAL-reset fix status
binding/driver version
```

Production qualification SHALL prove that the selected runtime contains the upstream WAL-reset fix.

Acceptable evidence includes:

- SQLite 3.51.3 or later containing the upstream fix;
- an upstream-supported fixed backport branch;
- a SQLCipher/embedded build whose source provenance demonstrably includes the equivalent upstream fix.

A version that is merely newer-looking than another dependency SHALL NOT be accepted without source/build evidence when the embedding layer may carry a different SQLite core.

If the persistence runtime cannot prove the fix is present, JARVIS SHALL fail the Production Complete persistence gate.

---

## 2. WAL activation must be verified

Startup SHALL not issue `PRAGMA journal_mode=WAL` and assume success.

The runtime SHALL inspect the returned journal mode and require the effective result to be `wal` for a WAL-qualified production database.

Conceptually:

```text
open database
   ↓
request WAL
   ↓
read effective journal mode
   ↓
wal?
 ├─ yes → continue persistence initialization
 └─ no  → persistence degraded/recovery path
```

JARVIS SHALL NOT silently run the production authoritative database in a different journal mode when the release expects WAL.

A deliberately qualified non-WAL fallback requires an explicit persistence compatibility decision and verification profile.

---

## 3. Local-filesystem requirement

The authoritative production database SHALL reside on a local filesystem/path compatible with SQLite WAL locking and shared-memory semantics.

The normal database path beneath `%LOCALAPPDATA%\JARVIS\data\` satisfies the intended topology.

JARVIS SHALL NOT place the live authoritative WAL database on:

```text
UNC/network shares
SMB/NFS-style remote filesystems
cloud-sync virtual mounts with unsupported locking semantics
removable/media paths not explicitly qualified
```

Backups may be copied to other storage after creation and verification, but the live WAL database SHALL remain on a qualified local path.

---

## 4. Durability policy

The V1 authoritative database SHALL default to a WAL durability configuration equivalent to:

```text
journal_mode = WAL
synchronous  = FULL
foreign_keys = ON
```

`FULL` is selected because JARVIS mission/task/approval/audit state is authoritative and accepted work should survive an ordinary power-loss boundary as strongly as SQLite's supported Windows durability path allows.

A future measured decision MAY allow `NORMAL` for a specifically separated non-authoritative cache database or another data class where losing the most recent commits after power loss is explicitly acceptable.

The authoritative production database SHALL NOT downgrade from `FULL` to `NORMAL` merely for benchmark improvement without an explicit contract revision and recovery analysis.

`OFF` SHALL NOT be used for authoritative production state.

---

## 5. Connection initialization

Every database connection SHALL pass through one owned initialization path.

The initialization SHALL establish and verify the connection-local settings required by the selected binding/runtime, including at minimum:

```text
foreign_keys = ON
bounded busy handling / busy timeout
known transaction mode policy
approved synchronous behavior
approved journal-mode compatibility
```

Because foreign-key enforcement is connection-local, a newly created pool connection SHALL NOT be considered ready until initialization has completed successfully.

The persistence layer SHALL NOT permit ad hoc database connections from unrelated services that bypass this initialization.

---

## 6. Bounded busy handling

SQLite supports a single writer at a time in WAL mode. Transient contention is therefore normal and SHALL be handled deliberately.

Each production connection SHALL use a bounded busy handler/timeout or equivalent binding-supported mechanism.

The timeout value SHALL be measurement-driven and SHALL NOT become an unbounded wait.

A busy timeout is a contention-management mechanism, not a correctness substitute.

Repeated or sustained `SQLITE_BUSY` / locking failures SHALL:

- emit structured diagnostics;
- identify the operation class where possible;
- preserve transactional correctness;
- avoid reporting work as completed when persistence did not commit;
- escalate to degraded/recovery behavior when thresholds are exceeded.

JARVIS SHALL NOT spin indefinitely or silently discard state because the database is busy.

---

## 7. Writer ownership and transactions

The Core persistence layer SHALL minimize avoidable writer contention through explicit transaction ownership.

Authoritative state changes SHALL remain short, bounded, and transactional.

Long-running AI/provider/network work SHALL NOT be performed while holding an SQLite write transaction open.

The normal pattern SHALL remain:

```text
compute/validate outside write transaction
        ↓
BEGIN
validate expected row/state/version
write authoritative state
append causative event/audit record
update required leases/indexes
COMMIT
        ↓
publish in-memory notification after commit
```

If a workflow needs to wait on a provider, user approval, external API, filesystem operation, or lengthy verification, it SHALL release the database transaction first and resume through durable state/version checks later.

---

## 8. Checkpoint policy

JARVIS SHALL preserve SQLite's safe checkpoint semantics and SHALL monitor whether checkpoints are making progress.

The exact checkpoint schedule MAY be tuned during qualification, but the policy SHALL:

- avoid disabling automatic checkpointing without replacing it with an owned checkpoint strategy;
- avoid running aggressive checkpoints on latency-sensitive foreground paths without measurement;
- allow passive/background checkpoint work during normal operation;
- permit stronger restart/truncate-style checkpoint maintenance only at safe boundaries where blocking readers is acceptable;
- perform a safe checkpoint/close sequence for backup/update/maintenance flows when the chosen backup mechanism requires it.

Checkpoint tuning SHALL be treated as a performance/operations setting, not an AI-planner decision.

---

## 9. WAL-growth diagnostics

The DiagnosticsService SHALL expose WAL operational health.

At minimum, diagnostics SHALL make it possible to observe:

```text
effective journal mode
SQLite/SQLCipher runtime identity
WAL-reset fix qualification status
WAL file size
checkpoint attempt/result
checkpointed frame progress where available
busy/locked event counts
long-lived transaction/reader indicators where available
integrity-check status
last successful backup
```

The UI need not expose every low-level metric continuously, but degraded conditions SHALL be visible and actionable.

---

## 10. Checkpoint-starvation detection

A long-lived reader can prevent checkpoints from fully resetting the WAL.

JARVIS SHALL detect sustained WAL growth or repeated incomplete checkpoints beyond release-qualified thresholds.

When checkpoint starvation is suspected, diagnostics SHOULD identify likely causes such as:

- long-lived read transactions;
- statements not finalized/reset;
- unexpectedly persistent database handles;
- background consumers holding snapshots too long;
- a checkpoint policy that is not being invoked effectively.

The system SHALL first diagnose and correct the application behavior rather than blindly forcing aggressive checkpoints on every commit.

---

## 11. WAL files are part of database state

The `-wal` and `-shm` sidecar files SHALL be treated according to SQLite's runtime semantics.

JARVIS SHALL NOT implement backup by simply copying the main `.db` file while live WAL state may contain committed transactions.

The existing backup contract remains binding: use SQLite's online backup API or another explicitly SQLite-safe snapshot mechanism.

Manual diagnostic/recovery tooling SHALL likewise avoid deleting or separating a live WAL file from its database as a casual repair technique.

---

## 12. Integrity and recovery response

Startup/recovery/backup qualification SHALL retain the existing integrity-check requirements.

If persistence integrity cannot be established:

```text
normal consequential execution stops
        ↓
Recovery Mode
        ↓
preserve damaged state for diagnostics
        ↓
identify newest verified backup
        ↓
restore/reconcile according to recovery policy
```

JARVIS SHALL NOT attempt speculative destructive repair against the only production copy.

A WAL-related corruption signal SHALL be treated as a persistence incident even if higher-level mission state appears readable.

---

## 13. Separate cache databases

JARVIS MAY use separate SQLite databases or other stores for disposable caches/derived indexes where operationally useful.

Such stores MAY use different durability settings only when:

- the data is reproducible or disposable;
- deletion does not lose accepted user work or authoritative audit/approval state;
- the separation is explicit in the persistence design;
- cache failure cannot be misreported as loss of authoritative state.

This flexibility SHALL NOT be used to weaken the durability of the authoritative database.

---

## 14. Verification requirements

Production verification SHALL include at minimum:

1. assert the exact embedded SQLite/SQLCipher runtime and WAL-reset fix status;
2. assert `journal_mode=WAL` succeeds on the supported Windows installation path;
3. assert production rejects/flags an incompatible network-hosted live DB path;
4. assert `foreign_keys=ON` on every pooled connection;
5. verify authoritative `synchronous=FULL` configuration;
6. exercise concurrent readers/writers and bounded `SQLITE_BUSY` handling;
7. exercise checkpoint progress under sustained reads;
8. simulate a deliberately long read and verify starvation diagnostics/WAL-growth detection;
9. verify safe backup while WAL contains recent committed data;
10. verify crash/restart recovery with WAL present;
11. verify integrity-check failure enters Recovery Mode;
12. verify persistence failure prevents a state transition from being reported as committed/completed.

Release qualification SHOULD include power-loss/crash-style tests appropriate to the Windows/SQLite test harness and binding capabilities.

---

## 15. Non-goals

This ADR does not:

- replace SQLite with a client/server database;
- require multiple writer processes;
- require a custom SQLite VFS;
- require disabling WAL automatic checkpointing;
- require aggressive checkpointing on every transaction;
- claim that application-level backups replace portable disaster-recovery key semantics in ADR-062;
- treat WAL as a network-filesystem solution.

---

## Consequences

### Positive

- WAL remains available for responsive concurrent reads while its real operational risks are controlled.
- The newly documented upstream WAL-reset issue becomes an explicit release gate instead of an invisible dependency risk.
- Power-loss durability for authoritative state is prioritized over marginal write-latency gains.
- Checkpoint starvation and lock contention become diagnosable production states.
- Backup behavior remains consistent with SQLite's actual WAL semantics.

### Costs

- The chosen SQLCipher/SQLite binding must expose enough runtime/build information for qualification.
- `synchronous=FULL` has additional I/O cost versus `NORMAL`.
- WAL/checkpoint diagnostics add a small amount of runtime and testing complexity.

These costs are accepted because persistence correctness is a foundational JARVIS trust requirement.

---

## Final rule

> **The JARVIS authoritative database SHALL use a release-qualified SQLite/SQLCipher WAL implementation whose embedded SQLite core includes the upstream WAL-reset fix. WAL activation and connection safety settings must be verified, the live database must remain on a qualified local filesystem, authoritative durability defaults to `synchronous=FULL`, and checkpoint/lock/WAL-growth health must be observable. Persistence uncertainty or integrity failure fails closed into degraded/recovery behavior rather than being hidden.**
