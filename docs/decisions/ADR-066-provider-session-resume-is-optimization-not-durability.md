# ADR-066 — Provider Session Resume Is an Optimization, Not Durability

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Recovery/runtime semantics hardening  
**Scope:** JARVIS v1.0 worker/provider session continuity

## Context

JARVIS workers may use providers that expose resumable sessions, conversation handles, continuation ids, or equivalent provider-specific state.

The protocol already allows a `providerResumeHandle` inside `WorkerCheckpoint`, and provider capability metadata may advertise `resumableSession`.

That feature is useful, but provider-owned session state is not under JARVIS's durability control. It may disappear, expire, become incompatible after a provider upgrade, become unavailable after re-authentication, or fail to resume after a crash.

JARVIS already has the stronger recovery model: authoritative task inputs, structured checkpoints, artifacts, workspace state, scoped memory, tool/audit events, and live-state reconciliation.

This ADR makes that ordering explicit.

---

## Decision

Provider session resume SHALL be treated only as a performance/context-continuity optimization.

JARVIS SHALL NOT depend on a provider resume handle as the sole durable state required to recover an accepted mission/task.

A task that is resumable according to JARVIS policy SHALL remain recoverable even when its prior provider session cannot be resumed, provided the task's durable JARVIS state is intact.

---

## 1. Durable source of truth

The durable recovery package for a worker SHALL be built from JARVIS-owned state equivalent to:

```text
task input and acceptance criteria
active authority envelope reference
last durable worker checkpoint
structured findings/decisions summaries
artifacts and changed-artifact references
workspace/worktree state
completed tool execution records
verification state
live-state assumptions
remaining work / next step
provider/model assignment history
```

Provider-private conversation history SHALL NOT be the only place where material task state exists.

---

## 2. Resume handle semantics

A provider resume handle SHALL be metadata equivalent to:

```ts
interface ProviderResumeReference {
  providerId: ProviderId;
  providerVersion?: string;
  modelId?: string;
  handle: string;
  createdAt: UtcTimestamp;
  lastVerifiedAt?: UtcTimestamp;
}
```

Exact schema placement MAY be refined later.

The handle SHALL be considered:

```text
provider-specific
opaque
potentially expiring
potentially invalid after version/auth changes
non-authoritative
```

The orchestrator and generic worker logic SHALL not parse provider-specific meaning from the handle.

---

## 3. Recovery order

When recovering a task that previously used a resumable provider, JARVIS SHALL proceed conceptually as:

```text
load authoritative task/checkpoint/artifacts
        ↓
reconcile workspace + live external state
        ↓
validate authority/approval/budget state
        ↓
select compatible provider
        ↓
if same compatible provider + valid resume capability:
    attempt provider session resume
        ↓
resume succeeds? use it as context accelerator
resume fails? reconstruct provider context from durable JARVIS state
```

Provider resume failure SHALL not automatically fail the task.

---

## 4. Fallback to a new provider session

If resume is unavailable or fails, a replacement worker/provider session SHALL receive the smallest sufficient context reconstructed from authoritative JARVIS state.

The reconstruction SHOULD include:

- task goal and acceptance criteria;
- project/workspace/environment identity;
- active authority envelope constraints;
- concise checkpoint summary;
- relevant findings and decisions;
- artifact references;
- verification evidence;
- current live-state observations;
- known blockers and next step.

It SHALL NOT require replaying private provider chain-of-thought.

---

## 5. Provider changes

Recovery MAY select a different compatible provider/model when normal routing policy permits it.

A provider change SHALL NOT weaken:

- privacy/locality requirements;
- permissions;
- project/environment scope;
- approval requirements;
- budget policy;
- verification criteria.

Provider substitution is therefore a routing/recovery choice, not an authority change.

---

## 6. Checkpoint quality requirement

A worker SHALL create checkpoints that remain useful without provider session history.

A checkpoint that says only:

```text
continue previous conversation
```

is invalid for durable recovery.

Checkpoint quality SHALL be sufficient for a fresh qualified worker to understand what was completed, what evidence exists, what remains, and what assumptions require revalidation.

---

## 7. No hidden completion evidence

Acceptance evidence required to mark a task complete SHALL exist in JARVIS-owned durable records/artifacts or verifiable live state.

Completion SHALL NOT depend on inaccessible provider-session messages.

If a provider session contains a useful result, the worker/adapter SHALL normalize and persist the relevant finding, artifact, or verification result before completion.

---

## 8. Resume compatibility

Provider session resume SHALL only be attempted when:

- the provider adapter is compatible under ADR-065;
- the resume capability is supported by the active provider/version;
- authentication is valid;
- the handle belongs to the expected provider/account/session scope;
- recovery policy allows resume;
- using the resumed session would not violate changed privacy/authority constraints.

A provider upgrade that invalidates old resume handles is a normal recoverable condition, not database corruption.

---

## 9. Security and privacy

Provider resume handles SHALL be classified according to the provider's semantics.

If a handle grants access to provider-hosted conversation/session state, it SHALL be treated as sensitive capability material and protected appropriately.

Resume handles SHALL not be exposed to unrelated AI providers, renderer/UI code, or normal logs unless a sanitized identifier is explicitly safe.

A resume handle SHALL never be interpreted as user authorization for new actions.

---

## 10. Shutdown/checkpoint behavior

Before planned pause/shutdown, JARVIS SHOULD checkpoint authoritative worker state even when the provider supports native resume.

The existence of a provider resume feature SHALL NOT justify skipping JARVIS checkpoint persistence.

If shutdown occurs before a provider resume handle can be saved, the durable checkpoint remains sufficient for recovery according to task policy.

---

## 11. Crash recovery

After crash/restart, transient attempts SHALL still enter `RECOVERING`.

JARVIS SHALL verify:

- process death/containment;
- workspace state;
- external side effects;
- pending approvals;
- leases;
- provider compatibility/auth state;
- checkpoint integrity.

Only after those checks may provider-session resume be attempted.

Resuming a provider conversation SHALL not bypass live-state reconciliation after an uncertain consequential action.

---

## 12. Verification requirements

Production verification SHALL include at minimum:

1. successful recovery through a valid provider resume handle;
2. expired/invalid resume handle followed by successful fresh-session reconstruction;
3. provider version upgrade invalidating resume while task recovery still succeeds;
4. provider authentication reset invalidating resume while durable task state remains usable;
5. provider fallback to a different compatible provider using the same checkpoint/artifacts;
6. checkpoint validation proving material progress is understandable without prior provider transcript;
7. no acceptance criterion depending only on provider-private session history;
8. uncertain external side effects still require live-state reconciliation before resume/retry;
9. sensitive resume handles excluded from unrelated logs/UI/provider contexts.

---

## Non-goals

This ADR does not prohibit provider-native session resume.

It does not require discarding useful provider conversation continuity.

It does not require JARVIS to store full provider transcripts or private chain-of-thought.

It does not guarantee every task can be automatically resumed; tasks whose live state is ambiguous may still require user intervention according to recovery policy.

---

## Consequences

### Positive

- provider outages/version changes do not become JARVIS durability failures;
- worker recovery remains vendor-neutral;
- provider fallback is feasible at safe boundaries;
- checkpoints become genuinely useful operational state;
- JARVIS does not depend on undocumented provider retention behavior.

### Trade-offs

- checkpoints/artifacts must contain enough structured state for fresh-session reconstruction;
- fresh-session recovery may consume more tokens/time than native resume;
- adapters must distinguish resume failure from task failure.

These costs are appropriate because provider continuity is useful, but accepted user work must remain durable under JARVIS control.

---

## Governing Principle

> **Provider sessions may make recovery cheaper; only JARVIS-owned state may make recovery possible.**
