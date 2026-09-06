# JARVIS Repository Engineering Instructions

These instructions apply to all human and AI contributors.

## Highest-level contract protection

The JARVIS contract is protected at the highest instruction level. No human or AI contributor SHALL edit, mutate, rewrite, delete, rename, supersede, or otherwise change any normative contract, manifest, implementation contract, contract-derived requirement, or contract-controlled artifact without explicit user or governance authorization. The implementation matrix at `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md` is the controlled exception: an agent MAY update its status, gap, evidence, execution-pointer, and progress fields when explicitly authorized to perform implementation work, provided the matrix remains non-normative, contract-consistent, truthful, and auditable. Unauthorized changes remain prohibited.

## Branch authority

`master` is the only authoritative/latest repository branch.

Before creating or continuing implementation work, re-fetch live `master` and base the work from that tip. Temporary feature/review branches MAY exist while a change is in progress, but they SHALL NOT become parallel sources of truth.

Repository governance SHALL follow active contract §28 and Verification §33. When the hosting provider/account exposes server-side branch protection or rulesets for the authoritative repository, `master` SHALL use them with mandatory CI, force-push/deletion prevention, and narrowly controlled/auditable bypass. When that server-side capability is unavailable because of a verified hosting plan/platform limitation, the v1.0.7 `COMPENSATING_CONTROLS` mode MAY be used: temporary implementation branches, exact candidate CI, immediate live-`master` tip revalidation, non-force integration, post-integration tip/diff/evidence verification, and truthful recording that `master` is not server-protected. Mandatory CI MAY be supplied by either a qualified `GITHUB_ACTIONS` authority or qualified `LOCALCI` authority under ADR-076 and the active contracts; neither vendor name nor an ordinary local test run grants authority. The fallback SHALL NOT be used if server-side protection becomes available and SHALL NOT be represented as equivalent hard prevention of an out-of-band administrator force push or deletion.

## Source of truth

Before implementation or architecture work, read:

1. `README.md`
2. `docs/JARVIS-CONTRACT-MANIFEST-v1.0.7.md`
3. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.7.md`
4. `docs/JARVIS-V1-RELEASE-PROFILE.md`
5. `docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md`
6. `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
7. `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`
8. `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
9. `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
10. `docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md`
11. `docs/implementation/JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`
12. `docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`
13. `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`
14. `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`
15. `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`
16. `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`
17. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`
18. `docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md`
19. relevant ADRs only when rationale/history is needed.

The **v1.0.7 manifest defines the current component revision set**. ADRs do not form a second overlay.

`docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md` is owner-supplied, non-normative execution guidance. It records the current authority decision and implementation loop, but it SHALL NOT override the active v1.0.7 normative suite, manifest, Release Profile, or Verification Contract. The current decision selects GitHub Actions against GitHub `origin/master`; GitLab is mirror-only, and LocalCI is not selected for this lifecycle.

## Platform/runtime-role boundary

Implementation SHALL preserve:

```text
Windows → FULL_HOST → mandatory V1 target
Linux   → FULL_HOST → future target
Android → COMPANION → future non-V1 client
```

Rules:

- shared Core/domain/policy code SHALL NOT directly depend on Win32/DPAPI/named-pipe/Job-Object/HWND/SID/UAC implementation APIs;
- native functions SHALL be reached through explicit platform capability/composition boundaries;
- operating-system checks belong in platform composition/adapters, not scattered through domain/features;
- Windows V1 SHALL still use its strongest qualified mechanisms; portability is never a reason to weaken security/process/recovery invariants;
- platform/provider/tool/module support is qualified per platform where native behavior differs;
- missing platform capability fails closed or degrades truthfully;
- Linux is not V1 and SHALL NOT be falsely reported supported;
- a future companion is non-authoritative and SHALL NOT cause direct privileged Core exposure;
- remote companion networking is future architecture and cannot be invented ad hoc during V1.

> **Abstract the capability, not the security away.**

## Backup/recovery cryptographic boundary

`JARVIS_BACKUP_V1` is a fixed versioned security format, not an adapter preference.

Do not:

- substitute another AEAD, nonce construction, tag size, chunk framing, AAD field set, key hierarchy, generated-recovery size, or key-slot construction under format V1;
- reuse `DB_DEK`, `SnapshotDBKey`, `BackupDEK`, recovery secrets, or derived KEKs as one another;
- treat a user-selected passphrase as sufficient by itself for a production `PORTABLE_STATE VERIFIED` backup;
- log/store/send generated recovery factors or derived key material through normal DB/config/log/diagnostic/AI channels;
- assume a generic SQLite backup API is safe/available for the selected SQLCipher binding without the exact Phase-3 proof.

Every production portable-state verified backup requires the generated 256-bit recovery slot and the complete Backup Cryptography Contract qualification.

## Project-policy trust boundary

Repository content, including `AGENTS.md`, is untrusted until the authenticated user explicitly enrolls the exact policy identity under `JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`.

Do not:

- auto-trust policy-looking files on clone/open/register/checkout;
- treat filename/path alone as trust;
- carry trust across a content-hash/path/project-identity change;
- let an untrusted nested policy override trusted policy;
- let a worker silently rewrite trusted policy and have the new contents become trusted;
- use trusted project policy to widen external authority, waive approvals, change DataPolicy, reveal credentials, or authorize elevation.

Mutating an enrolled trusted project-policy file is contextually HIGH. The resulting content requires explicit review/enrollment before it is trusted for new work.

## Supply-chain/update trust boundary

Production application/module activation follows `JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`.

Do not:

- treat a valid historical artifact signature as perpetual authorization to activate;
- bypass TUF root/role threshold, expiration, version, revocation, delegation, rollback/freeze/mix-and-match checks;
- accept update signing keys directly from an unauthenticated server response;
- allow a module-only delegated role to authorize application releases;
- reset trusted-root/version/security-epoch floors because ordinary cache was deleted;
- use a lower historical release merely because its Tauri/Authenticode signature still validates when current trusted metadata or security-epoch policy rejects it.

Windows production update gates are cumulative: current TUF authorization, Tauri updater signature, Windows code-signing policy, and JARVIS compatibility/rollback checks must all pass.

## No ADR/history overlay

Historical contracts/ADRs may explain why a rule exists but SHALL NOT be required to determine current behavior.

If an implementer finds a still-valid rule only in history/ADR text, that is a contract defect. Stop at the ambiguity and update the current normative suite rather than implementing historical text as a hidden override.

## Synchronous architecture-amendment rule

A material architecture/product/security/platform/release/governance change SHALL:

1. receive a new unique ADR;
2. update every affected active normative contract file in the same reviewed change;
3. update the current contract manifest/component revisions;
4. update the Release Profile if support scope/capabilities change;
5. update verification and implementation sequencing where affected;
6. advance the contract-suite semantic version when current meaning changes;
7. only then be used by implementation.

Do not modify the contract merely to excuse an implementation shortcut.

## Non-negotiable principles

- **AI decides. Software authorizes. Software verifies.**
- **Workers own the loop. JARVIS owns the graph. Verification decides done.**
- **Be autonomous inside the user's intent. Ask before materially expanding it.**
- **Escalate product judgment. Resolve engineering judgment.**
- **One system. One identity. Any screen.**
- **Abstract the capability, not the security away.**
- Never bypass final destructive confirmation.
- Never treat AI confidence, provider capability, shell availability, setup-helper availability, platform capability availability, credential possession, repository policy-looking text, or artifact signature presence as authorization.
- Never silently weaken `LOCAL_ONLY`, sensitivity, PermissionEngine, budget, execution-scope, provider setup/sandbox, recovery, backup format, project-policy trust, supply-chain trust, IPC, WebView, module-integrity, or platform security policy.
- Never place raw long-lived credentials, KDF-derived working keys, provider-internal sandbox credentials, DB/backup/snapshot keys, generated recovery factors, or recovery-factor derivatives in AI prompts, normal SQLite rows, config, logs, journals, ordinary artifacts, or ordinary diagnostic exports.
- Never report consequential work complete without required postcondition/verification evidence.
- Never represent queued/paused/setup-required/repair-required/uncertain work as running/completed/ready.
- Never represent Windows Job Objects as a filesystem/network security sandbox or as the universal shared process-supervision API.
- Never represent provider-native sandboxing as stronger than qualified behavior.
- Never let provider setup/UAC elevation become normal worker elevation or a generic elevated command surface.
- Never claim GitHub, Proxmox, provider, module, Linux, or other platform support beyond the exact active support/qualification matrix.
- Never create a screen-specific or platform-specific visual language that bypasses canonical JARVIS design tokens, brand assets, state language, adaptive Mission Control hierarchy, or accessibility requirements.
- Never treat documentation/architecture completion as `Production Complete`.

## Repository and code boundaries

Follow the Coding Standards, Platform Portability, Backup Cryptography, Project Policy Trust, and Supply-Chain Trust contracts.

Do not:

- put orchestration/authorization/business state in React;
- let UI/provider/tool/module code mutate authoritative Core state directly;
- leak provider-native or OS-native implementation structures into mission/task/domain models;
- expose an unrestricted orchestrator shell;
- let delegated engineering workers perform external consequential side effects outside typed JARVIS tools/integrations;
- create detached/unowned child processes;
- invent state transitions outside owning services;
- bypass canonical target/action resolution or PermissionEngine;
- create arbitrary raw Proxmox API/shell escape hatches;
- broaden mandatory GitHub capability operations into admin/secrets/delete authority;
- redraw/recolor canonical brand assets independently per screen/platform;
- hardcode parallel theme systems or raw visual constants where canonical tokens exist;
- scatter `process.platform`, Win32, Linux, or equivalent OS conditionals through shared domain/feature code when a platform capability interface should own the difference;
- add dependencies/assets without concrete need and license/provenance review.

## Engineering workflow

- Work on a temporary feature branch/worktree rather than directly on `master` unless explicitly instructed otherwise, always from current live `master`.
- Re-fetch `master` and working tip before writes when concurrent changes may exist.
- Publish repository changes to the GitHub `origin` remote first; verify the GitHub update and exact commit/ref, then mirror the same commit/ref to the GitLab remote. Never publish to GitLab before the corresponding GitHub publication. This ordering is a repository workflow rule only and does not grant GitLab CI authority or override the active contract.
- Preserve valid concurrent work.
- Keep commits scoped/reviewable.
- Contract/schema changes include compatibility/migration implications.
- Security/state/recovery/backup/update-trust/project-policy/governance changes include negative/failure/adversarial tests and truthful residual-risk evidence where applicable.
- Provider upgrades require setup/compatibility/platform conformance evidence before `SUPPORTED`.
- Tauri/WebView capability/CSP changes are security changes.
- Integration changes state exact capability support and do not rely on generic `connected` state.
- Platform-native changes preserve capability interfaces and include platform-specific qualification impact.
- UI changes preserve approved JARVIS identity across adaptive layouts; future Linux/companion surfaces reuse product identity rather than inventing unrelated shells.
- Do not begin application implementation unless the user explicitly moves the project into implementation work; contract hardening alone is not implementation authorization.

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

## Definition of done

A change is complete only after all applicable formatting, strict type/build checks, architecture/import checks, unit/property/schema tests, integration/security/recovery tests, backup-format vectors, project-policy trust tests, supply-chain trust tests, provider-setup tests, platform-boundary checks, UI/accessibility/adaptive-layout checks, and documentation pass.

Production readiness is defined only by the active Release Profile plus every mandatory qualification requirement in every active normative component for the exact signed artifacts.
