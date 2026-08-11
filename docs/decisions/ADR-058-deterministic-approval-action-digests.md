# ADR-058 — Deterministic Approval Action Digests

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Security/protocol hardening  
**Scope:** JARVIS v1.0 approvals and consequential action binding

## Context

JARVIS requires destructive and other high-risk approvals to bind to the exact material action that the user approved. The existing contract requires an `actionDigest` computed with SHA-256 over canonical material action data, but did not define one cross-language canonical representation.

That omission is unsafe for a Rust + TypeScript system because semantically equivalent JSON can have different byte representations due to property ordering, whitespace, number formatting, and serializer behavior.

Approval integrity requires one deterministic representation that both implementations produce identically.

---

## Decision

JARVIS V1 SHALL compute approval action digests from a versioned, schema-validated action-material object using an RFC 8785 JSON Canonicalization Scheme (JCS) profile, UTF-8 encoding, and SHA-256.

The digest SHALL be recomputed from freshly resolved material action state immediately before approval consumption.

A material mismatch SHALL invalidate the approval and require a new approval decision.

---

## Canonical action-material schema

The canonical logical structure SHALL be equivalent to:

```ts
interface ApprovalActionMaterialV1 {
  domain: 'jarvis.approval.action.v1';

  toolId: string;
  toolVersion: number;

  actionClass: ActionClass;
  sideEffectClass: SideEffectClass;

  target: {
    system: string;
    accountId?: string;
    environmentId?: string;
    resourceType: string;
    resourceId: string;
  };

  arguments: Record<string, JsonValue>;
}
```

A future incompatible representation SHALL use a new explicit domain/version rather than silently changing V1 canonicalization semantics.

---

## Domain separation

The `domain` field SHALL be present and fixed to:

```text
jarvis.approval.action.v1
```

for this digest purpose.

Approval action digests SHALL NOT reuse an unqualified generic hash construction that could be confused with artifact hashes, module integrity hashes, event-chain hashes, or unrelated cryptographic identifiers.

---

## Material identity resolution

JARVIS SHALL resolve consequential identities before building the action-material object.

The digest SHALL bind to deterministic resource identity rather than ambiguous display strings wherever such identity exists.

Examples include:

- registered project/repository identity rather than an unresolved user nickname;
- canonical filesystem target rather than an unnormalized path;
- resolved integration account identity rather than a display label;
- exact environment identifier rather than an informal environment name;
- exact infrastructure cluster/node/resource identity rather than a human alias alone;
- exact recipients/account/attachment identities for consequential messaging operations;
- exact flags/options that materially change action consequence.

If a material target cannot be resolved unambiguously, JARVIS SHALL NOT issue a final destructive approval request for that action.

---

## Material fields

A value SHALL be included in the action material if changing that value could reasonably make the user consider the resulting action materially different from what they approved.

This normally includes, as applicable:

- tool and tool version;
- action class and side-effect class;
- target system;
- account/credential identity where it changes authority or destination;
- environment;
- resource type and resource identity;
- normalized arguments;
- force/purge/destruction flags;
- source/destination identities for move/migration/copy operations;
- recipient identities and attachment/content identities for publication/send operations;
- other consequence-changing parameters defined by the tool contract.

Incidental volatile runtime metadata SHALL NOT be included unless it changes the operation itself.

Examples normally excluded:

- correlation IDs;
- request IDs unrelated to resource identity;
- UI display text;
- localized descriptions;
- progress state;
- provider routing metadata;
- current timestamp unless time is itself an intentional material action parameter.

---

## Canonicalization

The validated `ApprovalActionMaterialV1` object SHALL be serialized using RFC 8785 JCS semantics.

JARVIS SHALL use an errata-aware restrictive profile suitable for security-sensitive cross-language operation.

At minimum:

- duplicate JSON object property names SHALL be rejected before canonicalization;
- `NaN` and infinities SHALL be rejected;
- negative zero SHALL be rejected rather than normalized silently;
- invalid Unicode SHALL be rejected;
- values outside the safely interoperable numeric model SHALL be rejected or represented by an explicit schema-defined string/integer encoding;
- implementations SHALL NOT rely on ordinary language-runtime object insertion order as a canonicalization mechanism.

Where a domain value requires precision that cannot be represented safely and identically in the allowed JSON numeric model, the schema SHALL define a canonical string or integer representation instead of using an imprecise floating-point number.

---

## Digest algorithm and encoding

The canonical pipeline SHALL be:

```text
ApprovalActionMaterialV1
    ↓ schema validation
RFC 8785 JCS canonical JSON
    ↓ UTF-8
canonical bytes
    ↓ SHA-256
digest bytes
    ↓ base64url without padding
actionDigest
```

The authoritative representation SHALL therefore be:

```text
actionDigest = base64url_no_pad(
  SHA256(
    UTF8(
      JCS(ApprovalActionMaterialV1)
    )
  )
)
```

No alternative digest encoding SHALL be accepted for protocol V1 unless explicitly version-negotiated by a future protocol revision.

---

## Approval issuance flow

Before presenting an approval request, JARVIS SHALL:

1. resolve the actual tool/action;
2. resolve canonical target/account/environment/resource identities;
3. normalize material arguments through the tool schema;
4. evaluate current permission/authority policy;
5. build `ApprovalActionMaterialV1`;
6. validate it;
7. canonicalize with JCS;
8. compute the SHA-256 action digest;
9. persist the approval request bound to that digest;
10. show the user an understandable rendering of the same material action.

The human-readable approval text is not the cryptographic source of truth. It SHALL accurately describe the material object whose digest is stored.

---

## Approval consumption flow

Immediately before executing an approval-bound action, JARVIS SHALL:

1. verify the approval is in an eligible approved state;
2. verify it has not expired;
3. verify it has not been consumed or cancelled;
4. freshly resolve the action target/account/environment and material arguments;
5. rebuild `ApprovalActionMaterialV1`;
6. canonicalize and recompute the digest;
7. compare the recomputed digest with the approved digest using a safe equality implementation;
8. consume the single-use approval transactionally with execution admission.

If the digest differs, execution SHALL NOT proceed under the prior approval.

The action SHALL return to an approval-required state with a new approval request describing the changed material action.

---

## Replay and race safety

Destructive final confirmations remain short-lived and single-use under the existing approval contract.

Digest equality alone SHALL NOT make an approval reusable.

Approval consumption SHALL also enforce:

- status eligibility;
- expiry;
- session/policy constraints where applicable;
- single-use consumption;
- action identity binding;
- transactional protection against double consumption;
- no automatic replay after uncertain destructive side effects.

If execution admission races with a material target change that invalidates the resolved action, execution SHALL fail closed or return to approval-required state.

---

## Cross-language conformance

Rust and TypeScript SHALL use the same canonicalization specification and conformance vectors.

The repository SHALL contain shared test vectors defining, for each vector:

- input logical object;
- expected canonical JCS UTF-8 representation or byte-equivalent fixture;
- expected SHA-256 bytes;
- expected base64url-without-padding digest.

Both implementations SHALL pass the same vectors before the approval subsystem can be considered production-qualified.

---

## Required verification cases

Production verification SHALL include at minimum:

1. property-order differences producing the same digest;
2. insignificant source whitespace differences producing the same digest;
3. target change producing a different digest;
4. environment change producing a different digest;
5. account identity change producing a different digest;
6. material argument/flag change producing a different digest;
7. tool version change producing a different digest where material;
8. duplicate JSON property rejection;
9. invalid/non-finite number rejection;
10. negative-zero rejection;
11. invalid Unicode rejection;
12. Rust/TypeScript conformance-vector equality;
13. expired approval rejection despite matching digest;
14. replay/second-consumption rejection despite matching digest;
15. digest mismatch immediately before execution causing approval invalidation;
16. ambiguous target resolution preventing final approval issuance;
17. canonical resource resolution proving display-label changes do not retarget the approved operation silently.

---

## Consequences

### Positive

- Approval binds to the exact material operation rather than an implementation-dependent serialization.
- Rust and TypeScript implementations have one testable cross-language contract.
- Material action changes invalidate stale approval automatically.
- Resource aliases/display strings cannot silently retarget destructive actions after approval.
- The digest format can be independently reproduced in tests and diagnostics.

### Trade-offs

- A JCS implementation and shared conformance fixtures are required in both Rust and TypeScript.
- Tool schemas must explicitly identify material target and argument semantics.
- Some high-precision domain values may require canonical string/integer representations instead of ordinary JSON floating-point numbers.

---

## Non-goals

This ADR does not:

- replace approval expiry or single-use semantics;
- make SHA-256 itself an authorization mechanism;
- allow AI-generated digests to authorize execution;
- permit unresolved raw strings to stand in for deterministically resolvable consequential resource identity;
- define a general-purpose canonical hash format for every JARVIS domain object.

---

## Governing Principle

> **The user approves one exact material action; any material change requires a new approval.**
