# JARVIS Operations, User Experience & Governance Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`  
**Version:** 1.0.3  
**Date:** August 12, 2026

---

# 1. PURPOSE

This document defines current normative operational, user-visible, configuration, observability, and architecture-governance behavior that complements the Runtime, Protocol, Data, Security, Coding, UI Identity, Verification, and Release Profile contracts.

It is part of the current v1.0.3 implementation source of truth. It is not an ADR overlay. Implementation SHALL NOT require historical contracts or ADRs to reconstruct any behavior defined here.

Requirements in this document are cumulative with the rest of the current normative suite and use the same canonical state machines, schemas, authority rules, DataPolicy, exact money, provider setup/qualification, and release semantics.

---

# 2. OPERATIONAL TRUTHFULNESS

JARVIS SHALL prefer explicit degraded, queued, blocked, paused, uncertain, setup-required, repair-required, or recovery state over fabricated continuity.

JARVIS SHALL NOT:

- represent queued or paused work as running;
- represent acknowledgement as completion;
- report an unverified consequential effect as success;
- imply a task stopped immediately while it is still reaching an integrity-safe interruption point;
- represent a provider as supported/ready while required setup or repair is incomplete;
- silently weaken quality, locality, privacy, permission, budget, support, sandbox, or recovery policy to keep working;
- reconstruct worker history from AI speculation when authoritative state/events exist.

When accepted work cannot proceed, the user SHALL be able to determine its current state and material reason.

---

# 3. WORK DASHBOARD AND QUEUE TRANSPARENCY

JARVIS SHALL provide a live work dashboard derived from authoritative state/events.

The dashboard SHALL expose, as applicable:

- active, queued, blocked, waiting-for-user, waiting-for-approval, paused, resuming, recovering, and recently terminal work;
- current worker activity;
- mission/task identity and project/environment where applicable;
- assigned worker role/provider where safe/useful;
- meaningful checkpoints/progress;
- queue/block/wait reason and queue position when deterministically known;
- blockers/pending approvals;
- findings/verification results and changed artifacts/resources;
- start/last-activity/completion information;
- pause/cancel/reprioritize controls where policy permits.

If accepted work cannot start immediately, JARVIS SHALL tell the user it is queued and expose the queue state. Tasks introduced by replanning are subject to the same rule.

Queue ordering changes and dependency, workspace, resource, budget, approval, provider setup/repair, provider availability, recovery, or other material start blockers SHALL remain observable.

Routine worker activity SHALL remain available in the dashboard/journal without repetitive spoken interruption.

Questions such as `What is that worker doing?`, `What did it do?`, `What is queued?`, and `Why is this blocked?` SHALL be answered primarily from recorded authoritative state/events rather than model reconstruction.

---

# 4. WORKER JOURNAL AND ACTIVITY EVIDENCE

Every active worker SHALL expose concise current activity and durable structured evidence sufficient to explain meaningful work without private chain-of-thought.

Recorded semantics SHALL cover equivalents of:

```text
WORK_STARTED
ACTIVITY_CHANGED
FINDING_RECORDED
ARTIFACT_CHANGED
VERIFICATION_STARTED
VERIFICATION_RESULT
BLOCKED
WAITING_FOR_APPROVAL
CHECKPOINT_CREATED
COMPLETED
FAILED
```

Exact DomainEvent names may be normalized, but these observable semantics SHALL remain available.

Worker journals record observable actions, findings, changes, blockers, verification, and results. They SHALL NOT require or expose hidden model reasoning.

Completed worker history remains accessible according to retention policy and may feed scoped authoritative project/task memory.

---

# 5. MISSION PLANNING AND CONCURRENCY UX

The planner determines logical decomposition/parallelism; deterministic runtime policy determines actual concurrency.

The planner SHALL distinguish genuinely dependent, sequential, conditional, and parallel work. It SHOULD remove fake ordering dependencies when outputs are independent.

Trivial deterministic operations SHALL NOT be decomposed into unnecessary missions/workers merely because AI workers are available. Small bounded deterministic work SHOULD remain actions/tools.

Excess logical parallelism that cannot run because of resource, provider, budget, workspace, permission, locality, or responsiveness constraints SHALL queue transparently rather than overload the machine or disappear.

Consequential ambiguity in decomposition or material scope expansion SHALL follow clarification/authorization policy rather than guessing.

---

# 6. PRIORITY, PREEMPTION, PAUSE, RESUME, AND USER CONTROL

Explicit authenticated user instructions to reprioritize, pause, cancel, or focus work SHALL receive strong precedence over AI-generated priority recommendations, subject to mandatory integrity/safety constraints.

Priority alone SHALL NOT force unnecessary preemption when both workloads can run safely.

When preemption is required, JARVIS SHALL reach the earliest safe interruption boundary, checkpoint durable state, release unnecessary resources, and make the transition visible.

If interruption is temporarily unsafe, JARVIS SHALL surface that pause/cancel is pending at an integrity-safe boundary instead of pretending work has stopped.

Temporary non-preemptibility SHALL be narrow/bounded and SHALL NOT indefinitely defeat legitimate user cancellation.

Meaningful scheduling transitions SHALL be auditable, including task/mission identity, old/new state or priority, reason, triggering instruction/policy event, checkpoint where applicable, and interruption outcome.

After `PAUSED`, all new execution follows canonical durable `RESUMING` validation.

---

# 7. RECOVERY VISIBILITY

Accepted queued/pending work SHALL survive restart according to durability policy and remain visible after recovery.

After crash/restart/provider/runtime interruption, JARVIS SHALL accurately surface materially interrupted, resumed, queued, blocked, uncertain, setup/repair-required, approval-revalidation-required, or user-action-required work.

Recovery messaging SHALL reflect live reconciliation rather than merely repeating pre-crash assumptions.

---

# 8. STANDING PERMISSION GOVERNANCE

Standing permissions SHALL be explicit, scoped, revocable, non-transitive across unrelated targets/environments/action classes, and auditable.

A standing permission SHALL identify sufficient canonical scope to prevent accidental expansion across projects, accounts, environments, resource classes, or materially different actions.

Revocation SHALL prevent new dependent execution immediately after authoritative policy state is updated. Revoking one capability SHALL NOT implicitly revoke unrelated independent capabilities unless policy explicitly couples them.

A development standing permission SHALL NOT become production authority. No standing permission waives mandatory destructive final confirmation.

---

# 9. EVENT DISPOSITION AND AUTOMATION POLICY

External/local events enter Event Gateway and remain subject to source validation, normalization, durable replay/dedup protection, authority, DataPolicy, budget, resource, and task/mission controls.

Per supported integration/event class, policy SHALL distinguish dispositions equivalent to:

```text
IGNORE
RECORD_ONLY
NOTIFY
CREATE_OR_UPDATE_TRACKED_WORK
ALLOW_APPROVED_AUTOMATION_POLICY
```

Authenticated source identity is not action authorization.

Event-created work obeys normal queue transparency.

Push/subscription/event mechanisms SHOULD be preferred where reliable and safely supportable. Polling MAY be used with appropriate intervals, backoff, quota/rate-limit awareness, and trigger-storm controls.

No event path creates direct unrestricted tool authority.

---

# 10. NOTIFICATION POLICY AND FOCUS MODES

NotificationPolicyEngine is the single policy authority for whether an event is spoken, displayed, grouped, deferred, dashboard-only, or silent.

Decisions SHALL consider relevant severity, source, project/integration scope, DataPolicy, preferences, interaction/focus state, actionability, repetition/grouping, and locked-session privacy.

Severity classes remain equivalent to:

```text
CRITICAL
IMPORTANT
NORMAL
LOW_VALUE
```

Voice is reserved for events important enough to interrupt under current policy. Routine worker lifecycle noise defaults to dashboard/journal.

Related repetitive events SHOULD be aggregated where practical.

Users SHALL be able to configure notification policy globally and, where applicable, per integration/project/event class.

V1 SHALL support focus modes equivalent to:

```text
NORMAL
WORK_FOCUS
DO_NOT_DISTURB
CRITICAL_ONLY
```

Focus modes alter delivery, not underlying authoritative/audit events. Critical safety/security events MAY override quiet policy only where deterministic policy explicitly defines the override.

`SENSITIVE` content SHOULD be excluded from verbose/spoken notifications by default unless an explicit trusted delivery policy permits it.

---

# 11. CONFIGURATION ACTIVATION AND ONE CONFIGURATION AUTHORITY

Configuration remains typed, versioned, runtime-validated, and non-secret.

A candidate configuration SHALL be validated before activation. Invalid configuration SHALL be rejected atomically and preserve the prior active valid configuration.

The lifecycle is equivalent to:

```text
parse candidate
→ schema/version validation
→ cross-field/security validation
→ persist candidate/version as required
→ atomically activate
```

Failure before activation leaves the previous valid configuration authoritative. Unknown flags/settings SHALL NOT silently enable behavior.

Security/permission/privacy/locality/credential/budget/update/module/integration/provider-setup/KDF policy changes SHALL be auditable where material.

Dashboard, voice, and other control surfaces SHALL mutate the same underlying configuration authority rather than parallel settings stores.

---

# 12. IMPORT / MERGE SAFETY

User state import SHALL be versioned, schema-validated, bounded, and staged before mutation.

Import SHALL NOT silently overwrite existing projects, memories, settings, histories, module/integration records, or other durable user state on conflict.

Conflicts SHALL use an explicit versioned merge/conflict policy. If deterministic safe merge is undefined, JARVIS SHALL surface the conflict for user resolution instead of guessing.

Credential import, if ever implemented, remains a separate high-risk encrypted/confirmed workflow.

---

# 13. SCOPED RANKED MEMORY RETRIEVAL

JARVIS SHALL retrieve memory through scoped, ranked, metadata-aware policy rather than unrestricted history retrieval or raw semantic similarity alone.

Ranking SHOULD consider applicable scope match, memory type, confidence/provenance, verification/staleness, recency, semantic relevance, importance, and relationship to the authoritative current project/environment/task.

Confirmed decisions and verified facts SHOULD rank above weak inference when otherwise relevant.

Context Manager SHALL provide the smallest useful context/memory set for the current interaction.

For current-state questions/actions, freshly verified live state remains authoritative over memory.

Consequential ambiguity that cannot be resolved reliably SHALL clarify/block rather than cross-project/target guess.

---

# 14. PROVIDER LIFECYCLE, SETUP, AND RESPONSIVENESS CAPABILITY

Provider abstractions SHALL NOT require a fresh one-shot process/session for every interaction.

Adapters MAY use one-shot execution when that is the provider's qualified interface, but the architecture SHALL support warm, persistent, streaming, session-oriented, resumable, local-server, cloud, and future LAN provider models without redesigning Core.

Provider UI/state SHALL distinguish installation/discovery, setup/repair readiness, compatibility/support, authentication/health, and capability availability. A provider needing setup or repair SHALL be presented honestly as unavailable for the affected profile rather than as a generic ready provider.

Where a qualified provider requires explicit setup/repair:

- the dashboard SHALL show why it is required;
- setup requiring UAC SHALL be a deliberate user action, not silent background focus/elevation;
- cancellation/failure SHALL remain visible/actionable;
- successful helper completion alone SHALL NOT be displayed as ready before setup/conformance verification;
- normal workers SHALL not inherit setup elevation.

Where safely supported, provider contracts SHOULD expose normalized lifecycle/capabilities for discovery, setup/repair, readiness/health, start/warm, execute/submit, streaming events, cancellation/interruption, restart, and stop/unload.

Latency-critical lightweight components SHOULD remain warm while their feature is active where resource policy permits. Heavy RAM/VRAM/CPU/GPU providers SHOULD be warmed/unloaded according to measured resource pressure and latency requirements rather than assuming every provider can remain resident.

Provider lifecycle/resource scheduling SHALL preserve UI/voice/stop-cancel responsiveness on the qualified 16 GB baseline and SHALL prefer graceful degradation over resource exhaustion.

Streaming SHOULD be used where it improves responsiveness and remains semantically/safely valid; downstream work may begin before complete upstream output only when the partial information is sufficient and does not create premature authority/success claims.

---

# 15. MODULE REGISTRY, DASHBOARD, AND STATE SEPARATION

JARVIS SHALL provide one centralized Module Registry and module-management dashboard.

The normal supported catalog/dashboard shows only modules/providers explicitly supported for the applicable JARVIS/platform/release context. Supported modules MAY be visible before installation.

States remain distinct:

```text
SUPPORTED
INSTALLED
ENABLED
AUTHORIZED
PREFERRED
HEALTHY
```

Installing a module SHALL NOT itself enable it, grant private-data access, authorize consequential actions, make it preferred, or change standing permissions.

Applicable actions MAY include Install, Enable/Disable, Configure, Set/Clear Preferred, Test/Health, Update, Remove, and Pin/Unpin.

Unsupported/manual mechanisms, if later permitted, SHALL remain clearly distinguished from officially supported modules.

Controlled installation/update uses defined verified paths, never arbitrary AI-generated shell as the standard installer mechanism.

---

# 16. MODULE VERSIONING, UPDATE POLICY, AND ROLLBACK UX

Module/provider versions are immutable installation units. Update does not destructively overwrite the active version in place.

Activation points to one validated installed version. Rollback changes activation state/pointer to a retained version rather than reconstructing overwritten files.

New versions SHALL be staged, provenance/integrity checked, compatibility checked, and health/conformance tested before activation under policy.

Users MAY pin versions and choose supported manual, notify-only, or qualified automatic update policy for allowed classes.

Breaking/security-sensitive updates SHALL surface material impact before activation. Core voice, AI, security, credential, and infrastructure providers SHOULD default to explicit notification/approval for materially risky replacement rather than silent activation.

Active tasks SHOULD NOT have their provider/module replaced underneath them outside a qualified safe lifecycle boundary.

Where rollback is promised/technically possible, the previous known-working version SHALL remain available until replacement is proven healthy.

Dashboard SHOULD distinguish active, approved-available, staged, previous/rollback, pinned, and failed-validation/update state when applicable.

---

# 17. INTEGRATION CATALOG UX AND REVOCATION

JARVIS SHALL maintain an official Supported Integration Catalog consistent with the V1 Release Profile and binding post-V1 requirements.

Each supported integration exposes normalized identity, capabilities/operations, authentication method, least-privilege credential scopes, health, compatibility/support, permission/risk, and DataPolicy behavior.

Connecting/configuring an integration SHALL NOT imply every service capability is enabled or authorized. Where upstream permits, service capabilities are independently enabled/authorized.

The dashboard SHALL expose the active Release Profile support matrix so users can distinguish `modeled`, `available`, `enabled`, and `production-supported` capabilities. Optional GitHub Actions dispatch and optional Proxmox storage/network-write capabilities SHALL not appear as mandatory V1 support merely because their schemas exist.

Revoked/expired authentication or removed capability scope SHALL immediately prevent new dependent actions after authoritative integration state changes while leaving unrelated integration capabilities usable when independently valid.

The dashboard SHALL distinguish support, connection/configuration, enabled capabilities, authorization, and health without exposing secret material.

Manual/unsupported extensions remain clearly distinct from official support.

---

# 18. BUDGET / QUOTA USER EXPERIENCE

Exact accounting/admission is governed by canonical MoneyAmount/quota/reservation contracts.

Dashboard SHALL expose understandable applicable settled/provider-reported usage, reservations where useful, warning threshold, hard limit, attribution, provider quota/reset state, and provenance.

User-facing states support equivalents of:

```text
NORMAL
WARNING
HARD_LIMIT
UNKNOWN
```

Unknown provider cost/quota remains visibly unknown rather than zero.

When budget/quota/resource limits reduce concurrency, affected work SHALL queue/block transparently with the reason.

Hard limit blocks new governed chargeable work unless explicitly authorized policy change/override permits it.

---

# 19. VOICE IDENTITY AND FALLBACK

JARVIS SHALL maintain one persistent configured human-quality voice identity across normal spoken interaction.

Voice identity is independent from a specific TTS implementation. Provider replacement SHALL preserve configured perceptual identity/naturalness within the qualified threshold.

Latency SHALL NOT be improved by silently switching to a substantially different/lower-quality generic voice.

If no policy-compliant TTS can preserve identity adequately, JARVIS SHALL degrade to text/UI with explicit `VOICE_DEGRADED`-equivalent state rather than poorly impersonating the configured voice.

Cloud speech fallback SHALL NOT violate DataLocality.

---

# 20. VOICE REFLEX, ACKNOWLEDGEMENT, AND CONTINUITY

The deterministic low-latency reflex path SHALL remain independent of remote AI reasoning for established controls/state transitions including, as applicable, listening feedback, PTT state, wake/session acknowledgement when enabled, immediate TTS interruption, stop, cancel current voice generation, mute/unmute, sleep/lock, show/hide JARVIS presentation, and unambiguous task pause/cancel after target resolution.

Immediate acknowledgement MAY use visual state, local earcon, or a small fixed/pre-generated phrase bank rendered in the exact configured voice.

Acknowledgement means only received/listening/processing-started and SHALL NOT imply task success unless completion was already verified.

The fixed phrase bank SHALL remain intentionally small and deterministic.

After a spoken response, a configurable short conversation window MAY remain active so the user can continue without repeating a wake word when policy/device state permits.

---

# 21. SLOW-OPERATION RESPONSIVENESS

AI/provider/network/worker latency SHALL NOT freeze local UI, voice controls, or deterministic safety controls.

Longer work SHALL remain truthfully visible through `THINKING`, `WORKING`, `QUEUED`, `BLOCKED`, or equivalent state.

JARVIS SHOULD acknowledge accepted longer work promptly, stream meaningful authoritative progress, avoid repetitive verbal chatter, speak useful milestones according to NotificationPolicy, and keep stop/mute/cancel responsive.

Routine deterministic controls SHALL NOT invoke AI unnecessarily after intent is established.

---

# 22. VOICE/PERFORMANCE TELEMETRY

Diagnostic/developer instrumentation SHALL support applicable measures equivalent to:

```text
wake/ack latency
listening-state latency
VAD speech-start latency
VAD/turn-close latency
STT first-partial latency
STT final latency
orchestrator first-event latency
orchestrator completion latency
TTS first-audio latency
stop/mute/cancel latency
end-to-end first-response latency
```

Telemetry SHALL NOT require retention of sensitive speech content to compute latency. Measurements distinguish local responsiveness from provider/network reasoning latency.

---

# 23. DESTRUCTIVE APPROVAL USER EXPERIENCE

Final destructive confirmation SHALL present user-understandable exact target, environment where applicable, action, expected destructive/materially unrecoverable consequence, and whether a verified rollback/backup is known to exist when that information is available.

Voice approval MAY be accepted only in an unlocked authoritative session and only when it unambiguously maps to exactly one pending approval under current policy.

A UI confirmation path SHALL remain available for final destructive approval even when voice confirmation is supported.

Human-readable summaries never replace the canonical action descriptor/digest.

---

# 24. DIAGNOSTICS UX AND EXPORT PRIVACY

Diagnostics SHALL make common failure/degraded causes actionable and distinguish healthy, setup-required, repair-required, degraded, unavailable, blocked, uncertain, and recovery-required state where applicable.

Recorded diagnostic/audit evidence SHALL be sufficient, subject to retention/DataPolicy, to establish non-secret request summary, relevant project/mission/task/attempt, provider/worker/tool/integration, provider setup/qualification state, permission/approval result, important transitions, outcome, verification evidence, and fallback/retry/recovery behavior.

This SHALL NOT require private chain-of-thought or raw credentials.

Before diagnostic/support export, JARVIS SHALL show the information categories included.

Diagnostic export SHALL default to excluding conversation bodies/private user content unless explicitly selected for that export and allowed by DataPolicy.

Secret/recovery-key/credential/KDF-derived/provider-internal sandbox credential material remains excluded by construction and cannot be opted into an ordinary diagnostic export.

---

# 25. AUDIT RETENTION AND INTEGRITY CLAIMS

Audit records SHALL be append-oriented and retained according to policy sufficient to explain recent consequential/security-relevant actions.

Retention SHALL NOT silently delete evidence still required by the configured security/audit explanation window merely to satisfy generic cleanup preferences.

Integrity mechanisms SHOULD detect corruption, sequence discontinuity, unexpected truncation, or casual modification to the extent supported and qualified.

JARVIS SHALL NOT claim cryptographically trustworthy local audit history after equivalent same-user compromise with sufficient access or Administrator/kernel compromise. Tamper/corruption diagnostics are defense-in-depth, not an independently trusted remote audit system.

---

# 26. DEPENDENCY / VULNERABILITY RELEASE POLICY

Production CI/release qualification SHALL review dependency/known-vulnerability results for reachable production paths.

A known unmitigated **Critical** vulnerability affecting a reachable production path SHALL block production release.

A known **High** vulnerability affecting a reachable production path SHALL also block release unless exceptional explicit risk acceptance records at least affected component/version/path, reachability assessment, temporary-acceptance rationale, mitigation/compensating controls, accountable owner, expiry/mandatory review date, and remediation/tracking reference.

A High waiver is exceptional, auditable, time-bounded, and SHALL NOT waive a mandatory JARVIS security invariant.

A Critical finding is not converted into a production pass merely by relabeling it accepted risk.

---

# 27. UPGRADE / UNINSTALL USER-STATE PRESERVATION

Upgrade qualification SHALL prove preservation or explicit migration of compatible durable user state including applicable projects/workspaces/environments, memories/history policy state, mission/task/worker history, settings, provider setup/qualification state, module/integration metadata, compatible approvals/standing permissions, KDF profile/verifier metadata, and backup/recovery availability.

Invalid/obsolete persisted states SHALL be migrated, invalidated, or surfaced explicitly; they SHALL NOT silently disappear because a new version no longer understands them.

Normal uninstall SHALL NOT silently delete durable user data/backups without explicit product policy and user-visible confirmation/choice appropriate to removal.

---

# 28. ARCHITECTURE DECISION ESCALATION

Non-critical engineering choices SHALL be resolved from the current normative suite, production evidence, and established principles without requiring user approval for routine implementation detail.

Escalation is required when a decision materially requires user preference/consent regarding security/trust boundary, privacy/data exposure, destructive/irreversible behavior, significant recurring cost, core UX, major product scope, permanent external account/policy commitment, or materially conflicting requirements with no clearly superior engineering resolution.

Internal package factoring, retry mechanics, routing implementation, schemas, state-machine implementation, observability mechanics, and equivalent choices SHOULD normally be resolved without interruption when accepted behavior/safety is preserved.

Significant non-critical architecture decisions made autonomously SHALL be documented in the appropriate current contract/ADR record as required by governance, and the user SHOULD receive a concise summary rather than being asked to approve every implementation detail or being left unaware of a material decision.

> **Escalate product judgment. Resolve engineering judgment.**

---

# 29. USER-INTENT AUTONOMY BOUNDARY

JARVIS SHOULD make useful progress without constant babysitting inside established user intent and authority.

Reasonable recoverable subordinate actions MAY proceed when permitted by Authority Envelope and deterministic policy.

Consequential ambiguity or material expansion of goal, project, environment, target, financial exposure, security posture, workflow architecture, or external effects SHALL be clarified/authorized rather than silently guessed.

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

---

# 30. REQUIRED QUALIFICATION

Production qualification SHALL prove at minimum:

1. delayed accepted work is queued visibly and never shown running before start;
2. dependency/workspace/resource/budget/provider/setup/approval/recovery queue reasons are visible;
3. replanned queued work is visible;
4. dashboard worker/current/history answers come from authoritative records;
5. delayed safe-point pause/cancel is visible and audited;
6. explicit user reprioritization is not silently overridden by AI priority;
7. recovery accurately reports interrupted/resumed/blocked/uncertain/setup-required/user-action-required work;
8. standing permissions are scoped/revocable/non-transitive and revocation blocks new dependent work;
9. event disposition cannot bypass normal authority and queued event work remains visible;
10. notification grouping/focus modes behave without deleting authoritative events;
11. locked/sensitive notification policy prevents protected disclosure;
12. invalid configuration leaves prior valid configuration active;
13. conflicting import does not overwrite durable state without merge/conflict policy;
14. ranked memory retrieval respects scope/confidence/provenance/live-state authority;
15. trivial deterministic actions are not forced into unnecessary worker missions;
16. provider abstraction supports qualified setup/warm/persistent/streaming lifecycle without mandating one-shot cold start;
17. provider setup failure/repair remains explicit and does not silently downgrade sandbox/elevation policy;
18. resource scheduling can unload/defer heavy providers while preserving interactive controls;
19. module install does not implicitly enable/authorize/prefer;
20. module update is staged and rollback does not depend on overwritten files;
21. module dashboard exposes qualified lifecycle/update state;
22. integration connection does not imply all capabilities and revocation blocks dependent actions;
23. integration dashboard distinguishes mandatory vs optional current Release Profile capabilities;
24. budget/usage UI preserves unknown provenance and queue reason;
25. TTS fallback does not silently change JARVIS voice identity;
26. acknowledgement never falsely implies completion;
27. UI/reflex stop/mute/cancel remains responsive during slow AI/provider work;
28. destructive approval UI shows target/consequence and UI confirmation remains available;
29. diagnostic export defaults to excluding conversation/private content and displays included categories;
30. audit retention preserves required recent consequential evidence;
31. High reachable vulnerability waiver requires mandatory fields/expiry;
32. Critical reachable vulnerability blocks release;
33. upgrade preserves/migrates durable compatible user state without silent disappearance;
34. uninstall does not silently delete durable user data contrary to explicit policy;
35. operational explanations identify request/work/provider/setup/authorization/state/verification/recovery without chain-of-thought/secrets;
36. significant autonomously resolved architecture decisions are documented and summarized to the user where appropriate.

Failure of any applicable mandatory production behavior above blocks `Production Complete` for the active Release Profile.

---

# 31. GOVERNING PRINCIPLES

> **Truthful state is a product feature.**

> **The user can see what JARVIS is doing, waiting for, and why.**

> **AI determines logical parallelism. Software determines actual concurrency.**

> **Configuration changes become active only after they are valid.**

> **Install, setup, enable, authorize, prefer, healthy, and supported are different facts.**

> **JARVIS keeps one voice identity; provider failure does not license impersonation by a different voice.**

> **Escalate product judgment. Resolve engineering judgment.**

> **History explains the contract. The current normative suite defines the product.**

---

**END — JARVIS OPERATIONS, USER EXPERIENCE & GOVERNANCE CONTRACT v1.0.3**
