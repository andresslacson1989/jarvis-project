# JARVIS Operations, User Experience & Governance Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`  
**Version:** 1.0.2  
**Date:** August 12, 2026

---

# 1. PURPOSE

This document defines current normative operational, user-visible, configuration, observability, and architecture-governance behavior that complements the Runtime, Protocol, Data, Security, Coding, Verification, and Release Profile contracts.

It is part of the current v1.0.2 implementation source of truth. It is not an ADR overlay and does not require implementers to reconstruct behavior from historical contracts or decision records.

Where this document describes behavior already constrained by another current normative contract, the requirements are cumulative and SHALL use the same canonical types, state machines, authority rules, data policy, and release semantics.

---

# 2. OPERATIONAL TRUTHFULNESS

JARVIS SHALL prefer explicit degraded, queued, blocked, uncertain, or recovery state over fabricated continuity.

JARVIS SHALL NOT:

- represent queued or paused work as running;
- represent an acknowledgement as completion;
- report an unverified consequential effect as success;
- imply a task stopped immediately when it is still reaching an integrity-safe interruption point;
- silently substitute an unavailable capability with one that violates required quality, locality, privacy, permission, budget, or support policy;
- reconstruct worker history from AI speculation when authoritative state/events exist.

When work is accepted but cannot proceed, the user SHALL be able to determine what state it is in and why.

---

# 3. WORK DASHBOARD AND QUEUE TRANSPARENCY

JARVIS SHALL provide a live work dashboard derived from authoritative state/events.

The dashboard SHALL make visible, as applicable:

- active work;
- queued work;
- blocked work;
- work waiting for user input;
- work waiting for approval;
- paused/resuming/recovering work;
- recently completed/failed/cancelled work;
- current worker activity;
- mission/task identity and project/environment where applicable;
- assigned worker role and provider/model where safe/useful;
- meaningful checkpoints/progress;
- queue/block/wait reason;
- queue position when deterministically known;
- blockers/pending approvals;
- findings and verification results;
- changed artifacts/resources;
- start time, last activity, and terminal result;
- pause/cancel/reprioritize controls where policy permits.

If accepted work cannot start immediately, JARVIS SHALL tell the user that it is queued and expose the queue state.

Tasks introduced by graph revision that cannot start immediately SHALL also appear as queued.

Queue ordering changes, resource/budget constraints, approval waits, provider waits, dependency waits, recovery waits, and other material start blockers SHALL be observable.

Routine worker activity SHALL remain available in the dashboard/journal without creating repetitive spoken interruptions.

JARVIS SHALL answer questions such as `What is that worker doing?`, `What did it do?`, `What is queued?`, and `Why is this blocked?` primarily from authoritative recorded task/worker/event state rather than AI reconstruction.

---

# 4. WORKER JOURNAL AND ACTIVITY EVENTS

Every active worker SHALL expose a concise current-activity state and maintain durable structured evidence sufficient to explain meaningful work without private chain-of-thought.

Recorded worker activity SHALL cover equivalents of:

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

Exact event names MAY be normalized by the current DomainEvent schema, but the observable semantics above SHALL remain available.

Worker journals record observable actions, findings, changes, blockers, verification, and results. They SHALL NOT require or expose private model reasoning.

Completed worker history remains accessible according to retention policy and may feed scoped authoritative task/project memory.

---

# 5. PRIORITY, PREEMPTION, PAUSE, RESUME, AND USER CONTROL

Explicit authenticated user instructions to reprioritize, pause, cancel, or focus work SHALL receive strong precedence over AI-generated priority recommendations, subject to mandatory integrity/safety constraints.

Priority alone SHALL NOT force unnecessary preemption when both old and new work can execute safely within resource, budget, workspace, provider, and responsiveness constraints.

When preemption is required, JARVIS SHALL preserve integrity by reaching the earliest appropriate interruption boundary, checkpointing durable state, releasing unnecessary resources, and making the resulting state visible.

If an operation is temporarily unsafe to interrupt, JARVIS SHALL surface that pause/cancel is pending at an integrity-safe boundary rather than pretending execution has already stopped.

Temporary non-preemptibility SHALL remain narrow and bounded and SHALL NOT indefinitely defeat legitimate user cancellation.

Meaningful scheduling transitions SHALL be auditable, including where applicable:

- task/mission identity;
- old/new priority or state;
- reason;
- triggering authenticated instruction or policy event;
- checkpoint reference;
- safe-point/interruption outcome.

After `PAUSED`, all new task execution follows the canonical durable `RESUMING` validation defined by the Runtime/Data contracts.

---

# 6. RECOVERY VISIBILITY

Accepted queued/pending work SHALL survive restart according to durability policy and remain visible after recovery.

After crash/restart or provider/runtime interruption, JARVIS SHALL inform the user of materially:

- interrupted work;
- resumed work;
- queued work;
- blocked work;
- uncertain effects;
- expired/revalidation-required approvals;
- user-action-required recovery.

Recovery messaging SHALL reflect live reconciliation, not merely the state that existed before interruption.

---

# 7. EVENT DISPOSITION AND AUTOMATION POLICY

All external/local events enter the current Event Gateway and remain subject to source validation, normalization, durable dedup/replay protection, normal authority, DataPolicy, budget, resource, and task/mission controls.

For each supported integration/event class, user policy SHALL be able to distinguish applicable dispositions equivalent to:

```text
IGNORE
RECORD_ONLY
NOTIFY
CREATE_OR_UPDATE_TRACKED_WORK
ALLOW_APPROVED_AUTOMATION_POLICY
```

An event source being authenticated never grants action authority by itself.

Event-triggered work that cannot start immediately SHALL obey the same queue-transparency contract as interactive work.

Push/subscription/event mechanisms SHOULD be preferred where reliable and safely supportable. Polling MAY be used with service-appropriate interval, backoff, quota/rate-limit awareness, and trigger-storm controls.

No event path creates direct unrestricted tool execution.

---

# 8. NOTIFICATION POLICY AND FOCUS MODES

NotificationPolicyEngine is the single policy authority for deciding whether an event is spoken, shown visually, grouped, deferred, dashboard-only, or silent.

Notification decisions SHALL consider, where relevant:

- severity;
- source;
- project/integration scope;
- DataPolicy;
- user-configured policy;
- current interaction/focus state;
- actionability;
- duplication/repetition;
- grouping opportunity;
- locked-session privacy.

Severity classes remain equivalent to:

```text
CRITICAL
IMPORTANT
NORMAL
LOW_VALUE
```

Voice notification is reserved for information important enough to justify interruption under current policy. Routine worker lifecycle noise SHALL default to dashboard/journal rather than repetitive speech.

Related repetitive events SHOULD be aggregated into a meaningful notification where practical.

Users SHALL be able to configure notification policy globally and, where applicable, per integration/project/event class.

V1 SHALL support user-selectable focus modes equivalent to:

```text
NORMAL
WORK_FOCUS
DO_NOT_DISTURB
CRITICAL_ONLY
```

Focus modes alter delivery, not underlying authoritative/audit events.

Critical safety/security notifications MAY override quiet policy only where the override is explicitly defined by deterministic policy.

`SENSITIVE` content SHOULD be excluded from verbose notifications and spoken notification bodies by default unless the user explicitly selects an appropriate trusted delivery policy.

---

# 9. CONFIGURATION ACTIVATION AND ONE CONFIGURATION AUTHORITY

Configuration domains remain typed, versioned, runtime-validated, and non-secret as defined by Protocol/Coding contracts.

A changed configuration SHALL be validated before activation.

Invalid candidate configuration SHALL be rejected atomically and SHALL preserve the prior active valid configuration.

Configuration persistence/activation SHALL use a deterministic lifecycle equivalent to:

```text
parse candidate
→ schema/version validation
→ cross-field/security validation
→ persist candidate/version as required
→ atomically activate
```

Failure before activation leaves the previous valid configuration authoritative.

Unknown flags/settings SHALL NOT silently activate behavior.

Configuration that materially changes permission, privacy/locality, credentials, budget, update, module, integration, or other security-relevant policy SHALL be auditable.

Dashboard, voice, and other control surfaces SHALL modify the same underlying configuration authority rather than maintaining divergent parallel settings systems.

---

# 10. IMPORT / MERGE SAFETY

User state import SHALL be versioned, schema-validated, bounded, and staged before mutation.

An import SHALL NOT silently overwrite existing projects, memories, settings, histories, module/integration records, or other durable user state when identities/content conflict.

Conflicts SHALL follow an explicit versioned merge/conflict policy. Where deterministic safe merge is not defined, JARVIS SHALL surface the conflict for user resolution rather than guess.

Credential import, if ever implemented, remains a separate high-risk encrypted/confirmed workflow and is not implied by normal state import.

---

# 11. SCOPED RANKED MEMORY RETRIEVAL

JARVIS SHALL retrieve memory through scoped, ranked, metadata-aware policy rather than unrestricted conversation-history retrieval or raw semantic similarity alone.

Memory ranking SHOULD consider, as applicable:

- user/global, project, mission, task, and session scope match;
- memory type;
- confidence and provenance;
- verification/staleness state;
- recency;
- semantic relevance;
- importance;
- relationship to the current authoritative project/environment/task.

Confirmed decisions and verified facts SHOULD rank above weak inference when otherwise relevant.

The Context Manager SHALL send only the smallest useful memory/context set required for the current interaction.

For current-state questions/actions, freshly verified live state remains authoritative over stored memory.

Consequential ambiguity that cannot be resolved reliably from current authoritative context SHALL result in clarification or blocking rather than cross-project/target guessing.

---

# 12. MODULE REGISTRY, DASHBOARD, AND STATE SEPARATION

JARVIS SHALL provide one centralized Module Registry and user-facing module-management dashboard.

The normal supported catalog/dashboard SHALL show only modules/providers explicitly supported for the applicable JARVIS/platform/release context. Supported modules MAY be visible before installation so available capabilities are discoverable.

States remain distinct:

```text
SUPPORTED
INSTALLED
ENABLED
AUTHORIZED
PREFERRED
HEALTHY
```

Installing a module SHALL NOT by itself:

- enable it;
- grant permission to receive private/sensitive data;
- authorize privileged/consequential actions;
- make it preferred;
- change standing permissions.

User actions MAY include, when applicable:

```text
Install
Enable / Disable
Configure
Set / clear preferred
Test / health check
Update
Remove
Pin / unpin version
```

Unsupported/manual extension mechanisms, if enabled by a future qualified feature, SHALL be clearly separated from officially supported choices and SHALL NOT be represented as supported merely because they can be loaded.

Controlled module installation/update uses defined verified installer/update paths, not arbitrary AI-generated shell commands.

---

# 13. MODULE VERSIONING, UPDATE POLICY, AND ROLLBACK UX

Module/provider versions are immutable installation units. Updating does not destructively overwrite the active version in place.

Activation points to one validated installed version. Rollback changes activation state/pointer to a retained qualified version; it does not depend on reconstructing overwritten previous files.

A new version SHALL be staged, provenance/integrity checked, compatibility checked, and health/conformance tested before activation according to module policy.

Users MAY pin versions and configure supported update policy such as manual, notify-only, or qualified automatic update for permitted low-risk classes.

Breaking/security-sensitive updates SHALL surface material impact before activation. Core voice, AI, security, credential, and infrastructure providers SHOULD default to explicit notification/approval for materially risky replacement rather than silent activation.

An active task SHOULD NOT have its provider/module replaced underneath it outside a qualified safe lifecycle boundary.

Where technically promised/possible, the prior known-working version SHALL remain available until the replacement is proven healthy.

The module dashboard SHOULD distinguish, when applicable:

- active version;
- available approved version;
- staged version;
- previous/rollback version;
- pinned version;
- validation/update failure.

---

# 14. INTEGRATION CATALOG UX

JARVIS SHALL maintain an official Supported Integration Catalog consistent with the V1 Release Profile and binding post-V1 integration requirements.

Each supported integration exposes normalized identity, capability/operation set, authentication method, least-privilege credential scopes, health behavior, compatibility/support state, permission/risk rules, and DataPolicy behavior.

Connecting/configuring an integration SHALL NOT imply that all service capabilities are enabled or authorized.

Where upstream platforms permit it, service capabilities are independently enabled/authorized. For example, connecting one Google or Microsoft account does not automatically authorize mail, files, calendar, contacts, messaging, and administration together.

The integration dashboard SHALL distinguish support, connection/configuration, enabled capabilities, authorization, and health without exposing secret material.

Manual/unsupported extensions SHALL remain clearly distinct from the official supported catalog.

---

# 15. BUDGET / QUOTA USER EXPERIENCE

Exact accounting/admission remains governed by the canonical MoneyAmount/quota/reservation contracts.

The dashboard SHALL expose understandable budget/quota state where applicable, including:

- current settled/provider-reported usage as available;
- outstanding reservations where useful;
- warning threshold;
- hard limit;
- attribution by provider/project/mission/task where available and meaningful;
- provider quota/reset state and provenance where reported.

User-facing states SHALL support equivalents of:

```text
NORMAL
WARNING
HARD_LIMIT
UNKNOWN
```

Unknown provider cost/quota SHALL remain visibly unknown rather than represented as zero.

When budget/quota/resource limits reduce concurrency, affected work SHALL queue/block transparently and expose the reason.

A hard limit blocks new governed chargeable work unless an explicitly authorized policy change/override permits it.

---

# 16. VOICE IDENTITY AND FALLBACK

JARVIS SHALL maintain one persistent configured human-quality voice identity across normal spoken interaction.

Voice identity is a product profile independent from any specific TTS implementation. Provider replacement SHALL preserve configured perceptual identity/naturalness within the qualified threshold.

Latency SHALL NOT be improved by silently switching to a substantially different or lower-quality generic voice.

If no available policy-compliant TTS provider can preserve the configured voice identity adequately, JARVIS SHALL degrade to text/UI with explicit voice-degraded status rather than silently impersonating the configured voice poorly.

Cloud speech fallback SHALL NOT occur when DataLocality/policy requires local-only processing.

---

# 17. VOICE REFLEX, ACKNOWLEDGEMENT, AND CONTINUITY

The deterministic low-latency reflex path SHALL remain independent of remote AI reasoning for established controls/state transitions, including as applicable:

- listening-state feedback;
- push-to-talk state;
- wake/session acknowledgement when wake is enabled;
- stop speaking / immediate TTS interruption;
- cancel current voice generation;
- mute/unmute;
- sleep/lock where semantics are deterministic;
- unambiguous task pause/cancel after target resolution.

Immediate acknowledgement MAY use visual state, a subtle local earcon, or a small bank of fixed/pre-generated phrases rendered in the exact approved JARVIS voice.

Acknowledgement SHALL mean only that input was received/listening started/processing started. It SHALL NOT imply task success unless completion is already authoritatively verified.

The fixed acknowledgement phrase bank SHALL remain intentionally small and semantically deterministic.

After a spoken response, the voice session MAY remain active for a configurable short conversational window so the user can continue without repeating a wake word when policy/device state permits.

---

# 18. SLOW-OPERATION RESPONSIVENESS

AI/provider/network/worker latency SHALL NOT freeze the local UI, voice-session controls, or deterministic safety controls.

When work is not immediate, JARVIS SHALL remain truthfully responsive through state such as `THINKING`, `WORKING`, `QUEUED`, `BLOCKED`, or equivalent.

Where useful JARVIS SHOULD:

- acknowledge accepted work promptly;
- stream meaningful progress events when authoritative progress exists;
- avoid repetitive verbal status chatter;
- speak only useful milestones according to NotificationPolicy;
- keep stop/mute/cancel controls responsive.

Routine deterministic controls SHALL NOT invoke AI after intent is already established when deterministic execution is sufficient.

---

# 19. VOICE/PERFORMANCE TELEMETRY

Diagnostic/developer performance instrumentation SHALL support measurements sufficient to explain voice responsiveness, including as applicable:

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

Telemetry SHALL NOT require retention of sensitive speech content merely to compute latency.

The canonical latency targets remain those in the Verification Contract. Measurements distinguish local responsiveness from remote/provider reasoning/network latency.

---

# 20. DIAGNOSTICS UX AND EXPORT PRIVACY

Diagnostics SHALL make common failure/degraded causes actionable and distinguish healthy, degraded, unavailable, blocked, uncertain, and recovery-required state where applicable.

For production scenarios, recorded diagnostic/audit evidence SHALL make it possible, subject to retention/data policy, to establish:

- what the user requested at a non-secret summary level;
- relevant project/mission/task/attempt;
- provider/worker/tool/integration involved;
- permission/approval result;
- important state transitions;
- failure/success outcome;
- verification evidence determining completion;
- fallback/retry/recovery behavior.

This SHALL NOT require private chain-of-thought or raw long-lived credentials.

Before generating a diagnostic/support export, JARVIS SHALL show the user the categories of information that will be included.

Diagnostic export SHALL default to excluding conversation bodies and private user content unless explicitly selected by the user for that export and allowed by DataPolicy.

Secret/recovery-key/credential material remains excluded by construction and cannot be opted into an ordinary diagnostic export.

---

# 21. AUDIT RETENTION AND INTEGRITY CLAIMS

Audit records SHALL be append-oriented and retained according to policy sufficient to explain recent consequential/security-relevant actions.

Retention policy SHALL NOT silently delete evidence still required by the configured security/audit explanation window merely to satisfy generic log cleanup preferences.

Audit/persistence integrity mechanisms SHOULD detect corruption, sequence discontinuity, unexpected truncation, or casual modification to the extent supported by the local architecture and qualified implementation.

JARVIS SHALL NOT claim that local audit history remains cryptographically trustworthy after compromise by arbitrary code with equivalent same-user rights and sufficient storage/process access, or after Administrator/kernel compromise. Such compromise is outside the V1 hard isolation claim.

Tamper/corruption diagnostics are defense-in-depth and operational evidence, not a claim of an independently trusted remote audit system.

---

# 22. DEPENDENCY / VULNERABILITY RELEASE POLICY

Production CI/release qualification SHALL review dependency and known-vulnerability results for reachable production paths.

A known unmitigated **Critical** vulnerability affecting a reachable production path SHALL block production release.

A known **High** vulnerability affecting a reachable production path SHALL also block production release unless an exceptional explicit risk acceptance records at least:

- affected component/version/path;
- exposure/reachability assessment;
- rationale for temporary acceptance;
- mitigation/compensating controls;
- accountable owner;
- expiry or mandatory review date;
- remediation/tracking reference.

A High-severity waiver is exceptional, auditable, time-bounded, and SHALL NOT waive a mandatory JARVIS security invariant such as destructive confirmation, secret protection, locality, IPC/WebView privilege separation, or credential authorization.

A Critical finding is not converted into a normal production pass merely by relabeling it as accepted risk.

---

# 23. UPGRADE / UNINSTALL USER-STATE PRESERVATION

Upgrade qualification SHALL prove preservation or explicit migration of durable user state that remains compatible, including applicable:

- projects/workspaces/environments;
- memories and conversation/history policy state;
- mission/task/worker history;
- settings;
- module/integration registry metadata;
- compatible approvals/standing permissions;
- backup/recovery availability.

Invalid/obsolete persisted states SHALL be migrated, invalidated, or surfaced explicitly. They SHALL NOT silently disappear merely because a new version no longer understands them.

Normal uninstall SHALL NOT silently delete durable user data/backups without explicit product policy and user-visible confirmation/choice appropriate to the removal operation.

---

# 24. ARCHITECTURE DECISION ESCALATION

Non-critical engineering choices SHALL be resolved from the current normative suite, production evidence, and established principles without requiring user approval for routine implementation detail.

The architecture/implementation process SHALL escalate when a decision materially requires user preference or consent, including material changes to:

- security/trust boundary;
- privacy/data exposure;
- destructive or materially irreversible behavior;
- recurring/significant financial cost;
- core user experience/interaction model;
- major product scope/capabilities;
- permanent external account/policy commitment;
- materially conflicting requirements where no clearly superior engineering resolution exists.

Implementation details such as internal package factoring, retry mechanics, schema organization, worker/provider routing implementation, observability mechanics, and equivalent choices SHOULD normally be resolved without user interruption when they preserve the accepted product behavior and safety model.

> **Escalate product judgment. Resolve engineering judgment.**

---

# 25. USER-INTENT AUTONOMY BOUNDARY

JARVIS SHOULD make useful progress without constant babysitting inside established user intent and authority.

Reasonable recoverable subordinate actions MAY proceed when permitted by the Authority Envelope and deterministic policy.

Consequential ambiguity or a material expansion of goal, project, environment, target, financial exposure, security posture, workflow architecture, or external side effects SHALL be clarified/authorized according to policy rather than silently guessed.

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

---

# 26. REQUIRED QUALIFICATION

Production qualification SHALL include tests proving at minimum:

1. accepted delayed work is shown queued and never shown running before start;
2. dependency/resource/budget/provider/approval/recovery queue reasons are visible;
3. graph-revision-created queued work is visible;
4. dashboard answers worker/current/history questions from authoritative records;
5. delayed pause/cancel at an integrity-safe point is visibly represented and audited;
6. explicit user reprioritization is not silently overridden by AI scheduling preference;
7. recovery reports interrupted/resumed/blocked/uncertain/user-action-required work accurately;
8. event disposition policy cannot bypass normal authority and queued event work remains visible;
9. notification grouping prevents repetitive noise and focus modes alter delivery without deleting events;
10. locked/sensitive notification policy does not disclose protected content;
11. invalid configuration candidate leaves the previous valid configuration active;
12. conflicting import does not overwrite durable state without merge/conflict policy;
13. ranked memory retrieval respects scope/confidence/provenance/live-state authority;
14. module install does not implicitly enable/authorize/prefer;
15. module update is staged and rollback does not require overwritten files;
16. module dashboard exposes qualified lifecycle/update state;
17. integration connection does not imply all service capabilities are authorized;
18. budget/usage UI preserves unknown provenance and queue reason;
19. TTS fallback does not silently change JARVIS voice identity;
20. acknowledgement never falsely implies completion;
21. UI/reflex stop/mute/cancel remains responsive during slow AI/provider work;
22. diagnostic export defaults to excluding conversation/private content and displays included categories;
23. audit retention preserves required recent consequential evidence;
24. High reachable vulnerability waiver requires all mandatory risk-acceptance fields and expiry;
25. Critical reachable vulnerability blocks release;
26. upgrade preserves/migrates durable compatible user state and does not silently drop unknown legacy state;
27. uninstall does not silently delete durable user data contrary to explicit policy;
28. operational explanations can identify request/work/provider/authorization/state/verification/recovery without chain-of-thought or secrets.

Failure of any mandatory production behavior above blocks `Production Complete` for the active Release Profile.

---

# 27. GOVERNING PRINCIPLES

> **Truthful state is a product feature.**

> **The user can see what JARVIS is doing, waiting for, and why.**

> **Configuration changes become active only after they are valid.**

> **Install, enable, authorize, prefer, and healthy are different states.**

> **JARVIS keeps one voice identity; provider failure does not license impersonation by a different voice.**

> **Escalate product judgment. Resolve engineering judgment.**

> **History explains the contract. The current normative suite defines the product.**

---

**END — JARVIS OPERATIONS, USER EXPERIENCE & GOVERNANCE CONTRACT v1.0.2**
