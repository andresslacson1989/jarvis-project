# ADR-064 — Explicit IPC Response/Error Union

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Protocol/schema hardening  
**Scope:** JARVIS v1.0 Host ↔ Core and other typed request/response IPC boundaries

## Context

The protocol contract already defines a generic `IpcEnvelope<T>` with `kind: 'request' | 'response' | 'event'` and a normalized `JarvisError` structure.

What was not explicit is how a response payload represents success versus failure.

Leaving that implicit creates avoidable cross-language ambiguity. Rust and TypeScript implementations could otherwise choose incompatible conventions such as:

- success payload versus thrown transport exception;
- `null` payload meaning failure;
- optional `error` fields beside optional `result` fields;
- error envelopes encoded as a separate message kind;
- HTTP-style status conventions that do not exist on the named-pipe transport.

A privileged local protocol should make success/failure structurally impossible to confuse.

---

## Decision

Every request/response IPC operation SHALL use an explicit discriminated response union.

The canonical logical response payload SHALL be equivalent to:

```ts
type IpcResponse<T> =
  | {
      ok: true;
      result: T;
    }
  | {
      ok: false;
      error: JarvisError;
    };
```

For `kind: 'response'`, the envelope payload SHALL validate as exactly one branch of this union.

A successful response SHALL NOT contain an `error` field.

A failed response SHALL NOT contain a `result` field.

`null`, missing fields, thrown raw exceptions, or ad hoc status strings SHALL NOT substitute for the union.

---

## 1. Request/response identity

For a valid request:

```ts
interface IpcRequestEnvelope<T> {
  protocolVersion: 1;
  kind: 'request';
  id: UUIDv7;
  name: string;
  correlationId: UUIDv7;
  payload: T;
}
```

The matching response SHALL preserve:

```text
response.id            = request.id
response.name          = request.name
response.correlationId = request.correlationId
response.kind          = 'response'
```

The response `id` is therefore the request/response pairing key.

The correlation id remains the broader operation/causation tracing identifier.

---

## 2. Success branch

The success branch SHALL contain the operation-specific typed result:

```ts
{
  ok: true,
  result: <operation result>
}
```

Operations with no semantic return value SHALL still return a typed empty result rather than overloading absence as success/failure ambiguity.

Equivalent example:

```ts
interface EmptyResult {
  completed: true;
}
```

or another operation-specific acknowledgement defined by the schema package.

Asynchronous commands SHOULD normally return a typed acceptance/operation reference such as a task, mission, attempt, or operation id rather than holding the IPC request open until long-running work finishes.

---

## 3. Failure branch

The failure branch SHALL contain exactly one normalized `JarvisError`:

```ts
{
  ok: false,
  error: {
    code: string,
    category: ErrorCategory,
    message: string,
    retryable: boolean,
    details?: Record<string, unknown>,
    correlationId: UUIDv7
  }
}
```

Provider-native, Windows-native, SQLite-native, tool-native, and library-native errors SHALL be translated before crossing a generic trust/process boundary.

Raw stack traces, secret-bearing messages, tokens, credential values, or unrestricted provider error payloads SHALL NOT cross the boundary through `details`.

---

## 4. Correlation-id invariant

While `JarvisError` retains a `correlationId` for portable logging/diagnostics, an IPC failure response SHALL satisfy:

```text
response.payload.error.correlationId
=
response.correlationId
```

A mismatch is a protocol/schema violation.

A later clean protocol revision MAY remove the duplicated field if all diagnostic consumers can rely on the outer envelope, but V1 SHALL not allow contradictory correlation identifiers.

---

## 5. Error codes versus categories

`ErrorCategory` remains a stable coarse-grained enum used for policy and UI behavior.

`JarvisError.code` SHALL be a stable machine-readable identifier specific enough for deterministic handling.

Examples:

```text
IPC_SCHEMA_INVALID
SESSION_LOCKED
PERMISSION_DENIED
APPROVAL_REQUIRED
APPROVAL_DIGEST_MISMATCH
BUDGET_HARD_LIMIT
PROVIDER_VERSION_UNSUPPORTED
TOOL_TARGET_NOT_FOUND
CORE_RUNTIME_INTEGRITY_FAILED
BACKUP_DECRYPT_FAILED
```

Human-readable `message` is explanatory only and SHALL NOT be parsed to drive control flow.

Unknown error codes within a known compatible category MAY be surfaced generically when forward-compatibility policy permits it.

Unknown error categories SHALL follow protocol-version compatibility rules and fail closed when safe interpretation is impossible.

---

## 6. Retry semantics

`retryable: true` is advisory metadata, not unconditional permission to retry.

Automatic retry SHALL still obey:

- idempotency policy;
- external-side-effect uncertainty;
- authority envelope;
- budget/resource policy;
- provider circuit breaker;
- retry ceilings/backoff;
- destructive-action rules.

For example, a network timeout after a consequential remote request MAY produce an error whose transport condition is retryable while the task attempt is still `UNCERTAIN`; JARVIS must verify live state before replaying the action.

---

## 7. Protocol/transport failure

There are failures where a normal response cannot safely be generated because the request envelope itself is not trustworthy or parseable.

Examples:

- invalid frame length;
- malformed UTF-8;
- invalid JSON;
- unsupported protocol version before request dispatch;
- failed bootstrap authentication;
- oversized payload;
- envelope schema violation so severe that a trustworthy request id cannot be established.

In those cases the transport SHALL fail closed according to the runtime contract. It MAY close the connection without an application-level response.

If enough of the request envelope has been authenticated and validated to safely produce a response, a normalized failure response MAY be returned instead.

JARVIS SHALL NOT invent an `id` for an untrusted malformed request merely to send an error.

---

## 8. Events are not responses

Events remain structurally distinct:

```ts
interface IpcEventEnvelope<T> {
  protocolVersion: 1;
  kind: 'event';
  id: null;
  name: string;
  correlationId: UUIDv7;
  payload: T;
}
```

Events SHALL NOT use `IpcResponse<T>`.

An event reporting a task/provider failure is still a domain event, not the failure branch of some unrelated old request.

This distinction prevents request completion semantics from becoming entangled with durable mission/task events.

---

## 9. Operation schemas

Every registered request name SHALL have schemas equivalent to:

```text
request payload schema
success result schema
possible normalized failure categories/codes
```

The canonical schema package SHOULD expose generated TypeScript and Rust mappings where practical.

Generic `Record<string, unknown>` SHALL not replace operation-specific success result schemas for authoritative commands merely for convenience.

---

## 10. Exhaustive handling

TypeScript and Rust consumers SHOULD use exhaustive handling over the `ok` discriminator.

Conceptually:

```ts
const response: IpcResponse<SystemStatus> = ...;

if (response.ok) {
  use(response.result);
} else {
  handle(response.error);
}
```

No caller should need to ask independent questions such as:

```text
is result present?
is error present?
is status success?
did the transport throw?
```

for an application-level response.

---

## 11. One terminal response per request

For each accepted request id, the responder SHALL emit at most one terminal `kind: 'response'` message.

Long-running progress SHALL be emitted through typed events or operation status queries, not multiple response messages sharing one request id.

Duplicate terminal responses are protocol violations and SHALL be logged/ignored according to deterministic duplicate handling.

---

## 12. Cancellation

Cancellation of the request itself SHALL normalize to the failure branch when the request has not already returned an asynchronous operation acknowledgement.

Example:

```ts
{
  ok: false,
  error: {
    code: 'REQUEST_CANCELLED',
    category: 'CANCELLED',
    ...
  }
}
```

If the request already returned an accepted task/operation id, later cancellation belongs to that task/operation state machine and event stream rather than retroactively changing the completed IPC response.

---

## 13. Security handling

A failure response SHALL reveal no more information than the caller is authorized to know.

For example, an unauthorized request for a secret-bearing resource SHOULD receive a sanitized authorization failure rather than details proving the secret exists or exposing its metadata beyond policy.

Errors crossing from Core to renderer/UI SHALL be treated as user/developer-safe normalized objects, not raw trusted exception objects.

---

## 14. Verification requirements

Production verification SHALL include at minimum:

1. valid success response round-trip Rust ↔ TypeScript;
2. valid failure response round-trip Rust ↔ TypeScript;
3. schema rejection when `ok: true` also includes `error`;
4. schema rejection when `ok: false` also includes `result`;
5. schema rejection when neither branch is complete;
6. response request-id mismatch rejection/diagnostics;
7. response name mismatch rejection/diagnostics;
8. correlation-id mismatch rejection, including error/outer-envelope mismatch;
9. raw provider/native error sanitization tests;
10. malformed-frame behavior proving application response is not fabricated when request identity is untrustworthy;
11. one-terminal-response-per-request enforcement;
12. cancellation before response versus cancellation after asynchronous acknowledgement;
13. `retryable` tests proving destructive/uncertain work is not automatically replayed merely because the flag is true;
14. operation-specific success payload schema validation.

---

## Non-goals

This ADR does not require:

- HTTP status codes on named-pipe IPC;
- exceptions as a cross-process response mechanism;
- changing the domain event model;
- keeping long-running IPC calls open until mission completion;
- exposing raw provider/Windows exception payloads;
- encoding every possible error code in one global enum.

---

## Consequences

### Positive

- success and failure are structurally unambiguous;
- Rust and TypeScript use one response convention;
- generic callers can handle normalized failures deterministically;
- transport failure and application failure remain distinct;
- retry policy cannot be accidentally inferred from thrown exceptions;
- response correlation and request pairing are explicit and testable.

### Trade-offs

- every operation must define a success result schema;
- adapter/native exceptions need explicit normalization;
- some duplicate correlation information remains in V1 for diagnostics compatibility.

These costs are small and appropriate for a privileged cross-process protocol.

---

## Governing Principle

> **Every valid JARVIS response says exactly one of two things: here is the typed result, or here is the normalized failure. Never both, never neither.**
