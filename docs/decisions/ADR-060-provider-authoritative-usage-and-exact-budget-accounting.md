# ADR-060 — Provider-Authoritative Usage and Exact Budget Accounting

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Runtime/accounting hardening  
**Scope:** JARVIS v1.0 provider usage, quotas, budgets, and chargeable-work admission

## Context

JARVIS can use metered, quota-limited, subscription-backed, or locally hosted AI providers. The existing contract requires usage accounting, warning thresholds, and optional hard limits, but the protocol currently represents monetary values with ordinary JavaScript/JSON `number` fields.

That representation is acceptable for non-authoritative UI estimates, but it is not appropriate as the sole source of truth for hard monetary limits across TypeScript, Rust, SQLite, and provider adapters.

A second and more important issue is concurrency: multiple workers can independently observe the same remaining JARVIS budget and start chargeable work unless expected spend is reserved atomically before provider execution.

Provider billing and quota systems are also authoritative for facts that JARVIS cannot reconstruct perfectly. When a provider exposes current spend, remaining credit, token/request quota, subscription allowance, reset time, or equivalent usage state, JARVIS should consume that provider-reported state rather than pretending a local reconstruction is more authoritative.

This ADR separates provider-authoritative usage/quota state from the user's local JARVIS budget policy and defines exact accounting semantics for the latter.

---

## Decision

JARVIS V1 SHALL distinguish:

1. **provider-reported usage/quota/balance state** — authoritative when the provider exposes it programmatically and it is successfully verified; and
2. **JARVIS budget policy state** — the user's independent limit on what JARVIS may initiate or commit.

JARVIS SHALL NOT fabricate monetary cost, remaining balance, quota, or subscription allowance when a provider does not expose enough information to determine it reliably.

Authoritative JARVIS monetary state SHALL NOT use binary floating-point arithmetic.

Chargeable work governed by a hard JARVIS budget SHALL reserve expected spend atomically before provider execution whenever a monetary reservation can be determined.

---

## 1. Provider-authoritative quota and usage state

Provider adapters SHOULD retrieve provider-reported state when the provider exposes a supported API or trusted local interface for it.

The logical schema SHALL be equivalent to:

```ts
type ProviderQuotaType =
  | 'MONETARY'
  | 'TOKENS'
  | 'REQUESTS'
  | 'COMPUTE'
  | 'SUBSCRIPTION_ALLOWANCE'
  | 'OTHER';

type ProviderQuotaSource =
  | 'PROVIDER_REPORTED'
  | 'JARVIS_CALCULATED'
  | 'UNKNOWN';

interface ProviderQuotaSnapshot {
  snapshotId: UUIDv7;
  providerId: ProviderId;
  modelId?: string;
  accountId?: UUIDv7;

  quotaType: ProviderQuotaType;
  unit: string;

  limit?: CanonicalQuantity;
  used?: CanonicalQuantity;
  remaining?: CanonicalQuantity;

  resetsAt?: UtcTimestamp;
  observedAt: UtcTimestamp;
  source: ProviderQuotaSource;
}
```

`CanonicalQuantity` SHALL use an integer or canonical decimal-string representation appropriate to the unit. It SHALL NOT silently coerce unknown provider semantics into an invented monetary value.

A provider may expose multiple simultaneous limits. JARVIS SHALL preserve them independently rather than collapsing them into a misleading single `remaining` number.

Examples include request-per-minute, token-per-minute, daily request, weekly subscription allowance, and monetary credit limits.

---

## 2. Provider-reported state precedence

When a provider exposes verified current usage, balance, quota, or reset information, JARVIS SHALL label that data `PROVIDER_REPORTED` and treat it as authoritative for what the provider reports.

JARVIS MAY maintain local estimates for scheduling and reservation, but SHALL NOT overwrite or disguise conflicting provider-reported facts.

If provider-reported data and local estimates differ, JARVIS SHALL preserve the distinction and surface the discrepancy diagnostically when material.

Provider-reported values can still be stale because of provider-side update latency. Every snapshot SHALL therefore retain `observedAt` and any available provider reset/effective timestamp.

---

## 3. JARVIS budget policy remains independent

Provider availability does not grant JARVIS permission to consume the full provider allowance.

A user may configure a lower JARVIS budget than the provider permits.

The effective admission policy SHALL respect all applicable constraints, including:

- JARVIS global/project/mission/provider budget;
- provider-reported quota or balance when known;
- authority/privacy/locality policy;
- scheduler/resource limits;
- user override policy.

Where comparable limits are known in the same unit/currency, the effective available amount is bounded by the most restrictive applicable limit.

JARVIS SHALL NOT silently bypass its own budget merely because provider capacity remains available.

---

## 4. Exact monetary representation

Authoritative monetary values SHALL use fixed-point integer semantics.

The canonical V1 logical representation SHALL be equivalent to:

```ts
interface MoneyAmount {
  currency: string; // ISO 4217 code where applicable
  nanoUnits: string; // signed base-10 integer, major currency unit × 1,000,000,000
}
```

Examples:

```text
USD 1.00       => 1000000000 nanoUnits
USD 0.10       => 100000000 nanoUnits
USD 0.0000025  => 2500 nanoUnits
```

The JSON representation uses a canonical decimal string so values can be transported losslessly across TypeScript, Rust, and other future runtimes.

Recommended in-process representations are:

- TypeScript: `bigint`;
- Rust: checked signed integer type with overflow detection;
- SQLite: INTEGER where the schema and range are proven safe, otherwise canonical decimal text with deterministic conversion.

Overflow, malformed integer text, unsupported precision, or currency mismatch SHALL fail closed for authoritative budget decisions.

Binary floating-point MAY still be used for non-authoritative display graphs or approximate telemetry, but not for authoritative budget limits, reservations, settlements, or remaining monetary budget.

---

## 5. Budget schema normalization

The canonical budget policy SHALL be equivalent to:

```ts
interface BudgetPolicy {
  budgetId: UUIDv7;
  scopeType: 'GLOBAL' | 'PROJECT' | 'MISSION' | 'PROVIDER';
  scopeId?: string;

  limit: MoneyAmount;
  warningAtBasisPoints: number; // 0..10000
  hardLimit: boolean;

  period: 'MISSION' | 'DAY' | 'MONTH' | 'CUSTOM';
}
```

`warningAtBasisPoints` supersedes floating-point percentage thresholds for authoritative warning comparisons.

`10000` basis points equals 100 percent.

---

## 6. Usage records

The canonical monetary usage representation SHALL be equivalent to:

```ts
type CostConfidence =
  | 'ESTIMATED'
  | 'PROVIDER_REPORTED'
  | 'JARVIS_CALCULATED'
  | 'SETTLED'
  | 'UNKNOWN';

interface UsageRecord {
  usageId: UUIDv7;
  providerId: ProviderId;
  modelId?: string;
  projectId?: ProjectId;
  missionId?: MissionId;
  taskId?: TaskId;
  attemptId?: AttemptId;

  units?: Record<string, CanonicalQuantity>;
  estimatedCost?: MoneyAmount;
  actualCost?: MoneyAmount;
  costConfidence: CostConfidence;

  pricingSnapshotId?: UUIDv7;
  occurredAt: UtcTimestamp;
}
```

A missing or unknowable cost SHALL remain absent/`UNKNOWN`. JARVIS SHALL NOT substitute zero or an invented estimate merely to complete a dashboard field.

Provider-reported actual cost SHALL not be rewritten to match an earlier JARVIS reservation.

---

## 7. Atomic budget reservation

Before initiating new chargeable work subject to a hard monetary budget, BudgetService SHALL atomically consider:

```text
settled spend
+ outstanding reservations
+ requested reservation
```

against every applicable hard budget.

The logical flow SHALL be:

```text
route candidate provider
      ↓
determine reservation when possible
      ↓
BEGIN authoritative transaction
      ↓
read applicable budget state
      ↓
spent + reserved + requested <= limit ?
      ├─ no  → deny / queue / request explicit override
      └─ yes → create reservation
      ↓
COMMIT
      ↓
only then start chargeable provider work
```

Two workers SHALL NOT be able to oversubscribe the same hard budget merely because each independently observed the same pre-reservation balance.

---

## 8. Reservation schema and lifecycle

The reservation model SHALL be equivalent to:

```ts
type BudgetReservationState =
  | 'RESERVED'
  | 'SETTLED'
  | 'RELEASED'
  | 'EXPIRED'
  | 'UNCERTAIN';

interface BudgetReservation {
  reservationId: UUIDv7;
  budgetId: UUIDv7;
  providerId: ProviderId;
  taskId?: TaskId;
  attemptId?: AttemptId;

  amount: MoneyAmount;
  state: BudgetReservationState;

  createdAt: UtcTimestamp;
  expiresAt?: UtcTimestamp;
  settledUsageId?: UUIDv7;
}
```

A reservation SHALL be single-purpose and auditable.

Unused reserved value SHALL be released after final settlement when safe.

If provider execution outcome or billing state is ambiguous, the reservation MAY remain `UNCERTAIN` until reconciliation rather than being automatically released and allowing accidental overspend.

---

## 9. Settlement

When provider usage becomes known, JARVIS SHALL settle using the best authoritative information available.

Example:

```text
reserved: 2.000000000 USD
actual:   1.370000000 USD
```

JARVIS records the actual `1.370000000 USD` and releases the unused reservation.

If actual provider-reported cost exceeds the reservation, JARVIS SHALL record the real cost and the resulting budget overrun. It SHALL NOT cap or rewrite actual usage to preserve the appearance of compliance.

A hard budget is an admission-control guarantee over JARVIS decisions, not a guarantee that an external provider's final invoice can never exceed an estimate.

---

## 10. Honest hard-budget guarantee

The V1 guarantee SHALL be:

> **A hard JARVIS budget prevents JARVIS from knowingly initiating new chargeable work that would exceed its authoritative committed budget according to the provider, pricing, reservation, and usage information currently available.**

JARVIS SHALL NOT claim that it can perfectly cap an external provider's final bill when:

- the provider reports cost only after execution;
- pricing changes externally;
- provider-side rounding differs;
- usage reporting is delayed;
- execution succeeds but the response is lost;
- the final cost exceeds the pre-execution estimate.

---

## 11. Pricing snapshots for local estimation

When JARVIS must calculate an estimated cost locally, the pricing definition used for that estimate SHOULD be versioned and durable.

The logical model MAY be equivalent to:

```ts
interface PricingSnapshot {
  pricingSnapshotId: UUIDv7;
  providerId: ProviderId;
  modelId?: string;
  effectiveAt: UtcTimestamp;
  pricingSchemaVersion: number;
  rates: Record<string, CanonicalMoneyRate>;
}
```

Historical usage SHALL retain the pricing snapshot identity used for its estimate where one existed.

JARVIS SHALL prefer provider-reported actual usage/cost over recalculating history with newer pricing.

---

## 12. Multiple currencies

Amounts in different currencies SHALL NOT be added directly.

V1 SHALL require a budget to use the same currency as the monetary accounting stream it governs unless a future explicit FX-conversion contract is introduced.

Any future currency conversion SHALL identify the exchange rate, source, effective time, and rounding policy. Implicit conversion is prohibited.

---

## 13. Subscription and non-monetary providers

A provider does not need a dollar cost to participate in BudgetService.

For subscription or quota-based providers, JARVIS MAY govern usage using exact provider-reported or locally tracked quantities such as:

- request count;
- token count;
- compute duration;
- audio duration;
- subscription allowance percentage/base units;
- provider-specific quota units.

If no trustworthy monetary mapping exists, JARVIS SHALL display monetary cost as unknown/not applicable rather than inventing one.

---

## 14. Provider adapter responsibilities

Provider adapters SHALL normalize whatever trustworthy usage/quota information the provider exposes into the canonical provider quota/usage schemas.

Adapters SHALL distinguish:

- provider-reported facts;
- JARVIS-calculated estimates;
- unknown values.

Adapters SHALL NOT mark locally reconstructed state as `PROVIDER_REPORTED`.

Where a provider exposes rate-limit headers or quota snapshots useful only for short-term scheduling, the adapter MAY publish them without treating them as monetary billing state.

---

## 15. Verification requirements

Production verification SHALL include at minimum:

1. exact fixed-point arithmetic across TypeScript, Rust, and persistence boundaries;
2. rejection of malformed/overflowing monetary values;
3. property tests confirming no binary-float path determines authoritative monetary admission;
4. two concurrent workers competing for the same remaining hard budget, proving only valid reservations commit;
5. reservation settlement below estimate and correct release of unused value;
6. actual cost above reservation, proving real provider cost is retained and new work is blocked appropriately;
7. provider-reported usage conflicting with local estimate, proving both provenance and precedence are preserved;
8. provider with quota but no monetary cost, proving JARVIS does not fabricate currency values;
9. provider with multiple independent quotas, proving JARVIS does not collapse them incorrectly;
10. currency-mismatch rejection;
11. stale/unknown provider quota state handling;
12. crash/recovery with outstanding reservations;
13. ambiguous provider outcome preserving `UNCERTAIN` reservation/accounting state until reconciliation;
14. hard-limit override requiring the existing explicit user/policy authorization path.

---

## Consequences

### Positive

- Provider billing/quota truth is not replaced by a weaker local reconstruction.
- JARVIS retains an independent user-controlled budget even when the provider permits more usage.
- Hard budgets become concurrency-safe through atomic reservation.
- Cross-language money arithmetic is deterministic and auditable.
- Subscription/quota providers are represented honestly without invented dollar values.
- Cost estimates can be explained later using durable pricing provenance.

### Trade-offs

- BudgetService requires reservation and settlement state rather than a single running total.
- Provider adapters need explicit provenance for reported versus calculated values.
- Some providers will expose incomplete usage/balance data; JARVIS must preserve `UNKNOWN` rather than present false certainty.
- Provider billing can still exceed a pre-execution estimate; hard limits govern JARVIS admission, not external invoice guarantees.

---

## Governing Principle

> **Trust providers for the usage state they actually report; trust JARVIS policy for what JARVIS is allowed to commit; never confuse estimates with authority.**
