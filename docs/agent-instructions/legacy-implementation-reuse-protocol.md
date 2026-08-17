# JARVIS Legacy Implementation Reuse Protocol

**Document role:** Non-normative repository operating instruction for implementation agents.  
**Legacy reference branch:** `impl/phase0-0.1-admission`  
**Current authority:** live `master` + the active contract manifest and normative suite  
**Purpose:** preserve valuable historical engineering work as reusable implementation inventory without allowing a divergent historical branch, historical matrix state, or historical contract lineage to become implementation authority.

---

## 1. Goal

Future implementation work SHALL aggressively reuse valid engineering assets from the historical implementation branch `impl/phase0-0.1-admission` when doing so is compatible with the current active contract and current authoritative repository state.

The goal is to avoid wasting already-written code, tests, boundaries, fixtures, procedures, and hard-earned implementation knowledge while preserving strict contract accuracy and current-source authority.

The required operating model is:

```text
CURRENT ACTIVE CONTRACT
        ↓
CURRENT AUTHORITATIVE master
        ↓
CURRENT ACTIVE SUBSECTION PACKET
        ↓
INSPECT CURRENT IMPLEMENTATION
        ↓
INSPECT MATCHING LEGACY IMPLEMENTATION
        ↓
CLASSIFY LEGACY ASSETS
        ↓
PORT ONLY CURRENT-CONTRACT-COMPATIBLE ASSETS
        ↓
CURRENT TESTS + ADVERSARIAL TESTS
        ↓
EXACT-HEAD QUALIFICATION
        ↓
FRESH INDEPENDENT REVIEW
        ↓
CONTROLLED INTEGRATION
```

The legacy branch is a **reference implementation and reuse inventory**. It is never a second source of truth.

---

## 2. Authority order

When sources disagree, agents SHALL use this precedence:

```text
1. current active normative contract suite
2. current authoritative master
3. current verified exact-source evidence
4. current implementation matrix for execution/status only
5. valid reusable legacy code/tests/patterns
6. legacy documentation, historical matrix labels, historical evidence, ADR/history
```

Rules:

- The active manifest defines the normative contract component set.
- `master` is the only authoritative/latest implementation branch.
- The current implementation matrix is non-normative and cannot waive contract requirements.
- The legacy branch cannot override the current contract or current `master`.
- Historical `VERIFIED`, `PASS`, `SUPPORTED`, or score labels are evidence leads only; they are never accepted automatically.
- Historical contract edits are not imported as authority merely because legacy code depended on them.
- A legacy implementation that conflicts with the current contract SHALL be corrected, rejected, or reimplemented.

---

## 3. Mandatory pre-implementation legacy inspection

Before writing new implementation for any active subsection whose subject matter overlaps code present on `impl/phase0-0.1-admission`, the implementing agent SHALL inspect the corresponding legacy implementation first.

This inspection occurs **after** reading current `AGENTS.md`, the current active contract packet, and current implementation state, but **before** designing or writing replacement code.

The inspection SHALL include, where applicable:

- matching production source files;
- matching tests and fixtures;
- platform adapters and composition boundaries;
- protocol/schema types;
- state models;
- security checks;
- failure/recovery behavior;
- build/packaging logic;
- CI/checkpoint logic;
- evidence documents as historical leads only;
- implementation notes that explain difficult platform behavior;
- provider/tool/native integration patterns;
- known negative/adversarial cases.

An agent SHALL NOT rewrite an already-solved mechanism from scratch without first determining whether the legacy implementation contains usable work.

---

## 4. Required classification of legacy assets

For every materially relevant legacy component, classify it before use as one of:

### `REUSE_AS_IS`

Use only when the exact legacy bytes are compatible with:

- current active contract meaning;
- current subsection scope;
- current dependency/toolchain baseline;
- current platform/runtime role;
- current security and authority boundaries;
- current interfaces and data models;
- current repository architecture.

`REUSE_AS_IS` does **not** mean previously verified. The code still requires current tests and qualification after porting.

### `REUSE_WITH_CORRECTION`

Use when the legacy component is structurally valuable but requires current-contract changes, for example:

- stale dependency/toolchain assumptions;
- outdated API shapes;
- incorrect scope ownership;
- weak or missing failure behavior;
- incomplete adversarial testing;
- old qualification assumptions;
- contract-lineage differences;
- evidence/checkpoint changes;
- security hardening required by the current suite.

This is expected to be a common category.

### `REIMPLEMENT`

Use when the old component solves the right problem but is too coupled to obsolete assumptions to port safely.

Reimplementation SHOULD still use valid lessons, tests, interfaces, and failure cases from the old work where compatible.

### `REJECT_OUT_OF_SCOPE`

Use when the legacy component:

- belongs to a later subsection;
- expands product/platform scope not authorized now;
- depends on obsolete normative rules;
- violates current authority/security boundaries;
- represents unqualified support;
- is a temporary workaround that current implementation should not preserve.

Record the reason for rejecting a materially relevant asset.

---

## 5. Required subsection reuse assessment

Each subsection execution packet SHALL include a short `LEGACY REUSE ASSESSMENT` when matching legacy work exists.

It SHALL answer at least:

1. What corresponding production code exists on `impl/phase0-0.1-admission`?
2. What corresponding tests/fixtures exist?
3. What useful interfaces, data structures, or platform boundaries exist?
4. Which pieces were built under a different or later contract assumption?
5. Which pieces directly satisfy the current active requirement?
6. Which pieces require correction?
7. Which pieces belong to later subsection ownership and must not be pulled forward?
8. Which security/authority assumptions differ from the current contract?
9. Which tests can be ported or strengthened?
10. What real/native qualification must be rerun after reuse?
11. What dependency, lockfile, license, or provenance impact would reuse introduce?
12. What is the final classification of each materially reused/rejected asset?

This assessment is an execution aid, not a new normative artifact.

---

## 6. No wholesale legacy merge

Agents SHALL NOT merge, rebase, or bulk-copy the legacy branch into current implementation merely to recover old progress.

Specifically prohibited without separate explicit user/governance authorization:

- merging `impl/phase0-0.1-admission` wholesale into `master`;
- treating the old branch as a parallel authoritative branch;
- importing its normative contract modifications as implementation requirements;
- importing its matrix state as current status;
- importing its CI/evidence claims as current qualification;
- advancing the current matrix based solely on historical legacy status.

Reuse SHALL be selective and subsection-scoped.

---

## 7. Contract-lineage firewall

The historical branch previously diverged into a later/different contract lineage. Therefore legacy implementation review SHALL distinguish code from authority.

Legacy normative files, ADRs, manifest changes, release-profile changes, and historical policy text may be read for context, but they SHALL NOT silently modify current requirements.

If legacy code requires behavior absent from or contradictory to the current active contract:

1. do not assume the old behavior is still required;
2. check the current normative suite;
3. if current text clearly differs, current text wins;
4. if current text is materially ambiguous or defective, stop dependent implementation and use the repository's synchronous architecture-amendment procedure;
5. never edit current contracts merely to excuse importing old code.

---

## 8. Historical verification is not current verification

Legacy evidence may guide test design but cannot substitute for current qualification.

The old branch previously carried strong completion labels for work that later required correction under the current implementation line. Therefore every reused component SHALL be treated as unverified until current evidence proves it.

At minimum, reused work must pass the same current gates as newly written work:

- current exact contract packet;
- current deterministic tests;
- current negative/adversarial tests;
- current architecture/import-boundary checks;
- current type/schema checks;
- current dependency/license/provenance checks where applicable;
- current platform-specific tests;
- current real Windows qualification where required;
- exact candidate binding;
- required independent review;
- controlled integration/post-integration proof.

Do not lower test rigor because code already existed historically.

---

## 9. Test reuse rules

Legacy tests are valuable assets and SHOULD be inspected before inventing replacements.

Agents SHOULD reuse or adapt legacy tests when they:

- encode current contract invariants;
- reproduce difficult Windows/runtime behavior;
- protect security or authority boundaries;
- cover failure/recovery cases;
- validate canonicalization/state transitions;
- capture regression history;
- exercise platform/native edge cases.

Agents SHALL NOT preserve a legacy test merely because it is green if the assertion encodes an obsolete assumption.

For every ported test, ask:

- Does it test the current invariant or only a historical implementation detail?
- Can it pass while the real requirement is broken?
- Does it need a stronger negative mutation?
- Does a mock need to be replaced or supplemented with real qualification?
- Does it incorrectly qualify Linux, a provider, a tool, or a release path?

Tests must prove current behavior, not historical confidence.

---

## 10. Structural/procedural reuse

Legacy value is not limited to source-code copying.

Agents SHOULD inspect and reuse compatible:

- module/package decomposition;
- semantic platform interfaces;
- deterministic composition patterns;
- typed request/response shapes;
- state-machine decomposition;
- fail-closed validation patterns;
- native lifecycle ownership;
- cancellation/cleanup patterns;
- bounded process execution patterns;
- Windows path/identity handling;
- audit/evidence patterns;
- fixture design;
- negative-test design;
- CI/checkpoint techniques;
- debugging lessons from previously encountered platform failures.

A structurally sound old approach may remain valuable even if its old code cannot be copied directly.

---

## 11. Fresh branch requirement

All current implementation work SHALL still begin from freshly revalidated live `master` according to root `AGENTS.md`.

The legacy branch is inspected read-only as a reference.

Do not create new implementation by branching from the legacy branch.

The normal pattern is:

```text
fresh live master
→ current subsection branch
→ inspect legacy branch read-only
→ selectively port/adapt assets
→ current verification
```

This ensures old branch history cannot become an accidental alternate base.

---

## 12. Scope discipline

Legacy code often contains implementation beyond the current subsection.

Agents SHALL NOT pull future work forward merely because it already exists.

For each candidate legacy file, determine whether the reusable unit can be isolated without importing later ownership.

Examples of scope leakage to avoid include:

- importing Core IPC while working only on a renderer-foundation subsection;
- importing provider execution while implementing a platform boundary;
- importing final Mission Control screens before their design-system subsection;
- importing release signing/updater logic during an earlier application-build subsection;
- importing tool execution before PermissionEngine/state prerequisites exist;
- importing Linux runtime claims into Windows-only V1 work.

A legacy file may contain both reusable and out-of-scope logic. Port only the valid subset or refactor the reusable mechanism behind the current boundary.

---

## 13. Security and authority review

Legacy reuse SHALL receive the same or stronger security scrutiny as new code.

Before porting code that touches consequential behavior, verify:

- authority owner remains correct;
- renderer/provider/worker code does not gain Core authority;
- PermissionEngine cannot be bypassed;
- canonical target/action resolution remains current;
- secrets are not broadened into logs/prompts/config/state;
- native interfaces remain typed and narrow;
- process execution is not converted into a generic shell;
- Windows security mechanisms are not weakened for portability;
- stale targets/state fail closed;
- retry/ambiguity behavior remains truthful;
- historical setup/provider assumptions still match the current contract.

If the old code is weaker, harden it before reuse.

---

## 14. Dependency and provenance review

Do not import a legacy dependency merely because old code uses it.

Before reuse, verify:

- current dependency baseline;
- exact version compatibility;
- lockfile impact;
- license;
- provenance;
- platform scope;
- security/advisory posture;
- whether a current existing dependency can serve the same need.

Remove obsolete dependencies when porting code if they are no longer required.

---

## 15. Evidence discipline for reused code

Implementation notes/evidence SHOULD identify material legacy reuse truthfully, for example:

```text
Legacy source inspected: impl/phase0-0.1-admission
Assets reused: <paths/components>
Classification: REUSE_WITH_CORRECTION
Material corrections: <summary>
Current verification: <tests/run/SHA>
Historical verification imported: NONE
```

Do not imply provenance from the legacy branch is current qualification.

A reviewer should be able to determine what was reused, what changed, and what current evidence proves it.

---

## 16. Known legacy implementation inventory

At the time this protocol was introduced, `impl/phase0-0.1-admission` contained substantial historical implementation through approximately Section 8, including assets in areas such as:

- Tauri/React desktop host and renderer;
- WebView security/capabilities;
- Mission Control/design-system work;
- Rust lifecycle/platform composition;
- Windows local IPC;
- process supervision and Job Objects;
- privilege mediation;
- Windows path identity;
- Git read boundaries;
- open-target boundaries;
- KDF/security support;
- application-owned Core runtime/bootstrap;
- persistence/backup work;
- native-capability transport;
- protocol/domain schemas;
- state machines;
- PermissionEngine/pre-ALLOW gates;
- project-policy handling;
- provider models;
- tool runtime;
- filesystem/Git/status/open/engineering tools;
- broad deterministic/native test coverage.

This inventory is illustrative, not authoritative or exhaustive. Agents must inspect the live legacy branch rather than rely on this list.

---

## 17. Legacy branch retention

`impl/phase0-0.1-admission` SHALL be retained as a reference branch until all materially useful assets have been deliberately examined and either:

- migrated into the current authoritative implementation;
- superseded by a current implementation;
- explicitly rejected as obsolete/out-of-scope.

Do not delete the branch merely because current work advances beyond its first sections.

Deletion requires explicit authorization after current implementation has progressed beyond the useful historical scope and no unique useful implementation/test knowledge remains only there.

---

## 18. Completion gate for legacy-assisted work

Legacy-assisted implementation reaches the same completion state as any other implementation only when current evidence passes.

There is no reduced bar for reused code.

A subsection is not complete merely because:

- the old branch had it;
- the old matrix called it verified;
- old CI was green;
- the code compiles after copying;
- old tests still pass.

Completion remains governed by the current contract, current exact candidate, current qualification, and current independent review.

---

## 19. Mandatory future-agent rule

Before implementing each applicable subsection, the AI agent SHALL explicitly state that it inspected the corresponding legacy implementation and summarize the reuse classification before substantial new implementation begins.

If no matching legacy implementation exists, state that result and proceed normally.

If access to the legacy branch fails, do not invent its contents. Continue only with current authoritative sources and record that legacy inspection could not be completed.

This rule exists to prevent two opposite failures:

1. blindly trusting obsolete historical work; and
2. wasting valuable prior engineering by rewriting everything from scratch.

The intended standard is:

> **Reuse engineering knowledge aggressively; reuse authority never.**
