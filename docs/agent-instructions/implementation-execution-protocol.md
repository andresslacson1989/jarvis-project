# JARVIS Contract Implementation Execution Protocol

This file is a non-normative repository operating instruction referenced by `AGENTS.md`. It preserves the current v1.0.6 implementation-execution rules previously carried inline in root `AGENTS.md`. It does not replace, narrow, supersede, or reinterpret the active normative contract suite.

## Contract implementation execution protocol

These rules apply once the user explicitly authorizes application implementation. They operationalize the locked active contract suite; they do not replace it, narrow it, or become a competing source of product/security truth.

### Contract is master authority

- The active manifest and every active normative component remain the master authority for implementation behavior.
- The implementation goal, matrix, section/subsection structure, scores, plans, checklists, and progress summaries are execution aids only.
- Omission of a contract requirement from a matrix/checklist does not make that requirement optional.
- Code SHALL be corrected to the contract. Do not reinterpret or weaken the contract merely because a different implementation is easier.
- If current normative text has a genuine material ambiguity/contradiction/defect, stop at that ambiguity and use the synchronous architecture-amendment rule before implementation depends on a guessed interpretation.
- Routine engineering judgment that does not change product/security/architecture meaning SHALL be resolved by the implementer without stalling the execution loop; record material assumptions and keep them contract-consistent.

### Implementation matrix

Maintain one current implementation matrix derived from the active Implementation Plan plus all cumulative active-contract requirements.

The canonical execution/status board is `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`. Before starting or resuming application implementation, read that file after revalidating live `master`, the current manifest, and the Implementation Plan. Use its current execution pointer and next eligible subsection, update its status/gap/evidence fields as work progresses, and do not create a competing implementation matrix.

The matrix is non-normative. Its ordering/status/evidence aids execution, while the current active contract suite remains the only implementation authority. If the matrix and current contract ever disagree, stop dependent implementation, reconcile the matrix to the contract, and do not use the matrix to waive or reinterpret a normative requirement.

The matrix SHALL use one hierarchical first column named equivalent to `Section / Subsection`: each section appears once as a section row and its subsections are listed beneath it in the same column. Do not flatten the matrix by repeating the section name in a separate section column for every subsection.

Recommended tracking fields are:

```text
Section / Subsection
Status
Governing Contract / Traceability
Score
Weakest Current Gap
Evidence / Result
```

Additional fields such as dependencies, blocker, checkpoint, or evidence references MAY be added when useful, but the section/subsection hierarchy remains the primary execution structure.

Canonical implementation statuses are:

```text
NOT STARTED
IN PROGRESS
BLOCKED
IMPLEMENTED
VERIFYING
VERIFIED
```

`DEFERRED` or `NOT APPLICABLE` may be used only where the active contract actually permits that classification and the reason is recorded.

Status semantics:

- `NOT STARTED` — no implementation work has begun for the subsection.
- `IN PROGRESS` — active implementation/fix work continues.
- `BLOCKED` — a genuine external prerequisite prevents reasonable further progress; ordinary build/test/design failures are not blockers.
- `IMPLEMENTED` — intended implementation exists but has not yet cleared all required verification.
- `VERIFYING` — hard acceptance/evidence gates are being run or reconciled.
- `VERIFIED` — subsection hard criteria, mandatory evidence, and scoring gates all pass.

Only one implementation subsection SHALL be the primary active target at a time. Work may inspect dependencies or perform narrowly necessary enabling work, but the agent SHALL NOT abandon a failing subsection merely to accumulate partial progress across later subsections.

### Subsection contract packet

Before implementing an active subsection, define its execution packet from the current contract suite:

```text
GOAL
GOVERNING CONTRACT REFERENCES
DEPENDENCIES / PRECONDITIONS
REQUIRED IMPLEMENTATION OUTPUTS
HARD ACCEPTANCE CRITERIA
REQUIRED TESTS / NEGATIVE TESTS / LIVE EVIDENCE
ATOMICITY APPLICABILITY AND MODEL
IDEMPOTENCY / RETRY-SAFETY APPLICABILITY AND MODEL
CURRENT STATUS / SCORES / WEAKEST GAP
```

Criteria SHALL be specific enough to fail. Avoid soft wording such as "looks production ready", "mostly compliant", or "appears secure" without measurable evidence.

### Mandatory subsection scoring baseline

Every subsection SHALL be evaluated against the following cross-cutting criteria, in addition to subsection-specific criteria derived from the contract:

| Criterion | Required gate |
|---|---:|
| Contract Accuracy | **10/10 exactly** |
| Production Readiness | **>= 8/10** |
| Production Practices | **>= 8/10** |
| Enterprise Hardening | **>= 8/10** |
| Atomicity | **>= 8/10 where applicable** |
| Idempotency / Retry Safety | **>= 8/10 where applicable** |
| Failure / Recovery Behavior | **>= 8/10 where applicable** |
| Security / Least Privilege | **>= 8/10 where applicable** |
| Observability / Diagnostics | **>= 8/10 where applicable** |
| Test / Verification Quality | **>= 8/10** |
| Maintainability / Architecture Integrity | **>= 8/10** |

Rules:

- **Contract Accuracy is an absolute veto.** `9/10` is not sufficient. It cannot be waived by high scores elsewhere.
- Contract Accuracy reaches `10/10` only when the subsection is fully traceable to and consistent with all applicable active normative requirements, with no known omitted mandatory requirement, undocumented semantic deviation, or implementation-created architecture change.
- Scores are prioritization aids, not substitutes for mandatory evidence. A failed hard contract/test/security/recovery/release gate prevents completion regardless of a subjective numeric score.
- A criterion with a known material production blocker SHALL remain below its passing threshold.
- `N/A` requires a concrete technical reason and is permitted only for genuinely inapplicable criteria. Contract Accuracy is never `N/A`.
- Subsection-specific criteria may be stricter than the baseline and may require `10/10` where the contract fixes exact protocol/security/state semantics.

### Production-readiness standard

"Working" is not equivalent to production-ready. Applicable subsection evaluation SHALL consider normal success plus realistic failure, ambiguity, interruption, crash/restart, concurrency, stale state, cancellation, resource pressure, degraded dependency behavior, security abuse, recovery, upgrade/migration, and operational diagnosis.

Production-quality implementation SHALL, where applicable:

- fail closed or degrade truthfully;
- use explicit typed/runtime-validated boundaries;
- preserve least privilege and minimum authority;
- surface deterministic errors/status rather than swallow failures;
- prevent false success/completion reporting;
- define cancellation, timeout, lifecycle ownership, and cleanup;
- define restart/recovery behavior;
- reject stale/changed targets or state rather than silently retarget;
- protect secrets before relying on redaction;
- provide sufficient structured diagnostics/audit evidence;
- include negative/adversarial/failure tests, not only happy paths;
- use pinned/reproducible dependencies/toolchains and track license/provenance where applicable;
- avoid TODO/placeholders/stubs/fallbacks that make an incomplete production path appear supported.

Enterprise hardening is not decorative polish. It means the subsection remains controlled, truthful, diagnosable, recoverable, least-privileged, and bounded when realistic things go wrong.

### Atomicity requirements

Every subsection that mutates authoritative state or performs consequential operations SHALL explicitly determine its atomicity boundary.

For authoritative local state within one SQLite transaction boundary, preserve the contract pattern:

```text
resolve / compute / validate outside transaction
→ begin transaction
→ assert expected state/version
→ write authoritative transition
→ append causative event/audit evidence
→ update invariant-critical leases/reservations/indexes
→ commit
→ publish post-commit in-memory notification/event
```

A failed commit SHALL NOT be reported as successful completion.

Do not pretend JARVIS and an external provider/service share one atomic transaction. For external effects use attempts, persisted intent/state, preconditions/conditional mutation, postconditions, `UNCERTAIN`, and reconciliation/recovery as required by the active contracts.

Where true atomicity is technically unavailable, the implementation SHALL use the strongest contract-compatible safe pattern and explicitly prove the partial-failure/recovery behavior rather than hide the limitation.

### Idempotency and retry-safety requirements

Every retryable or replayable mutating path SHALL define behavior for duplicate requests, timeouts, crashes, event replay, stale responses, and concurrent execution.

Use provider/system-native conditional or idempotency mechanisms where supported, including mechanisms equivalent to:

```text
idempotency key
expected row version
ETag / If-Match
expected Git ref/SHA
filesystem identity/hash/version
generation/revision token
other compare-and-set precondition
```

A changed precondition SHALL trigger conflict/re-resolution/re-authorization/re-approval as applicable. Do not silently apply stale authority to changed state.

If a consequential external result may have occurred but cannot be proven, return/persist `UNCERTAIN` or the contract-equivalent state and reconcile live state before retry. Never blindly retry an ambiguous destructive/high-risk effect.

Idempotency does not mean "retry until green". It means repeated/replayed execution cannot silently duplicate or corrupt consequences outside the action's defined semantics.

### Subsection implementation loop

Work each subsection in repeated passes until it reaches its exact subsection goal:

1. **DRAFT** — implement or improve the active subsection and run the most relevant verification available.
2. **SCORE** — score every mandatory baseline criterion and subsection-specific criterion harshly against current evidence.
3. **GAPS** — list the exact remaining weaknesses and identify the single weakest legitimate score/gate.
4. **CALL** —
   - if Contract Accuracy is not `10/10`, write `NEXT PASS`;
   - if any other applicable required score is below its threshold, write `NEXT PASS`;
   - if any mandatory hard acceptance/test/security/recovery/evidence gate is failing or unknown, write `NEXT PASS`;
   - otherwise write `DONE` for the subsection and mark it `VERIFIED`.

Each new pass fixes the single weakest gap from the previous pass first. If several gaps tie, prioritize in this order unless the contract dictates otherwise:

```text
contract correctness
→ authorization/security/data-loss/recovery risk
→ state/atomicity/idempotency correctness
→ production functionality/reliability
→ verification/observability
→ maintainability/polish
```

Do not stop merely because a test, build, dependency, or first implementation approach fails. Diagnose, correct, retest, rescore, and continue while repository-side progress remains reasonably possible.

### Section checkpoint

A parent section does not become `VERIFIED` merely because its subsection rows individually show `VERIFIED`.

After every required subsection in a section is verified, run the section-level integration checkpoint required by the active Implementation Plan and all cross-subsection contracts. The checkpoint SHALL verify integration behavior, architecture boundaries, state/security invariants, failure/recovery interaction, and any named release checkpoint evidence applicable to that section.

Only when both conditions are true may the parent section be marked `VERIFIED`:

```text
all required subsections VERIFIED
AND
section integration/checkpoint gate passes
```

Then advance to the first subsection of the next section in the authoritative implementation sequence.

### Evidence hierarchy and no-soft-pass rule

Prefer completion evidence in this order where applicable:

1. deterministic automated verification;
2. real/live platform or external-system verification;
3. integration/conformance tests;
4. security/negative/adversarial tests;
5. crash/recovery/fault-injection evidence;
6. static architecture/type/schema/forbidden-import verification;
7. independent review where judgment is required;
8. producer/agent self-review only as supporting evidence.

A model/worker statement that something is complete is never sufficient by itself. Mock-only evidence does not replace a contract-required real Windows/provider/integration/device/release test.

Never raise a score to pass merely to advance the matrix. If evidence is unavailable, status remains truthful (`IN PROGRESS`, `VERIFYING`, or genuine `BLOCKED`) until the required gate can be satisfied.

### Blocker semantics

Use `BLOCKED` only for a genuine dependency outside the currently available repository-side work, such as unavailable required hardware, external service/environment/account access, signing material/certificate, production qualification target, or a true normative contract defect requiring user/product decision.

The following are not blockers by themselves:

```text
compile failure
test failure
lint/type failure
implementation bug
integration bug
dependency incompatibility that can be replaced/fixed
first approach failure
unexpected engineering complexity
```

Those remain `IN PROGRESS` and are worked through.

When a genuine blocker prevents one piece of evidence but other contract-safe repository work inside the same subsection can still be completed, complete that work first and document exactly what remains externally blocked.

An unavailable optional hosting governance feature is not a blocker when the active contract explicitly permits `COMPENSATING_CONTROLS` and that mode's verification gates can be satisfied. It remains a truthful recorded hosting limitation, not a fabricated `SERVER_ENFORCED` result.

### Checkpoint continuation summary

At every designated subsection/section/release checkpoint, maintain a concise continuation summary containing exactly these categories:

1. **Original goal** — the overall implementation objective governed by the locked contract.
2. **Completed / found** — what is actually implemented/verified and important discoveries.
3. **Key decisions** — implementation decisions made within the contract; do not record hidden reasoning/private chain-of-thought.
4. **Remaining** — current matrix position, blockers/gaps, and the next exact subsection/checkpoint target.

Treat the checkpoint summary as the next continuation baseline, but re-fetch live `master`, reread the current `AGENTS.md`, and revalidate the active manifest before new repository writes.

### Final completion boundary

The subsection/section scoring loop never overrides the active Release Profile or Verification Contract.

`Production Complete` may be declared only when the exact source commit and exact signed Windows `FULL_HOST` release artifacts pass every mandatory active-contract qualification gate, including the complete release/profile/security/recovery/provider/integration/UI/voice/update/soak/provenance evidence. Intermediate section completion, high scores, green unit CI, or documentation completion are not equivalent to `Production Complete`.
