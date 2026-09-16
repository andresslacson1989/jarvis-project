# JARVIS Operations, Integrations & UX Contract

**Contract Suite Version:** 1.0.8
**Version:** 1.0.9
**Component:** `J04`
**Status:** Canonical normative component
**Scope:** operational truth, queue and recovery UX, integrations, voice operations, diagnostics, governance UX, visual identity, adaptive layout, and accessibility

---

This file is the sole normative home for the clauses in this component. The manifest fixes the component set and revisions; the Release Profile fixes the supported V1 product profile. The implementation plan, execution matrix, evidence records, and audits are execution aids and do not add authority.

Clause identifiers in this file are stable traceability anchors. Cross-component references use clause identifiers and the separate Release Profile; historical material cannot override or supplement this suite.
## J04-OPS-01 — PURPOSE

This document defines current normative operational, user-visible, configuration, observability, and architecture-governance behavior that complements the J00–J03 and J05 component clauses and the separate Release Profile.

It is part of the current normative implementation source of truth. It is not a historical-material overlay. Implementation SHALL NOT require obsolete contracts or historical material to reconstruct any behavior defined here.

Requirements in this document are cumulative with the rest of the current normative suite and use the same canonical state machines, schemas, authority rules, DataPolicy, exact money, provider setup/qualification, and release semantics.

---

## J04-OPS-02 — OPERATIONAL TRUTHFULNESS

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

## J04-OPS-03 — WORK DASHBOARD AND QUEUE TRANSPARENCY

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

## J04-OPS-04 — WORKER JOURNAL AND ACTIVITY EVIDENCE

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

## J04-OPS-05 — MISSION PLANNING AND CONCURRENCY UX

The planner determines logical decomposition/parallelism; deterministic runtime policy determines actual concurrency.

The planner SHALL distinguish genuinely dependent, sequential, conditional, and parallel work. It SHOULD remove fake ordering dependencies when outputs are independent.

Trivial deterministic operations SHALL NOT be decomposed into unnecessary missions/workers merely because AI workers are available. Small bounded deterministic work SHOULD remain actions/tools.

Excess logical parallelism that cannot run because of resource, provider, budget, workspace, permission, locality, or responsiveness constraints SHALL queue transparently rather than overload the machine or disappear.

Consequential ambiguity in decomposition or material scope expansion SHALL follow clarification/authorization policy rather than guessing.

---

## J04-OPS-06 — PRIORITY, PREEMPTION, PAUSE, RESUME, AND USER CONTROL

Explicit authenticated user instructions to reprioritize, pause, cancel, or focus work SHALL receive strong precedence over AI-generated priority recommendations, subject to mandatory integrity/safety constraints.

Priority alone SHALL NOT force unnecessary preemption when both workloads can run safely.

When preemption is required, JARVIS SHALL reach the earliest safe interruption boundary, checkpoint durable state, release unnecessary resources, and make the transition visible.

If interruption is temporarily unsafe, JARVIS SHALL surface that pause/cancel is pending at an integrity-safe boundary instead of pretending work has stopped.

Temporary non-preemptibility SHALL be narrow/bounded and SHALL NOT indefinitely defeat legitimate user cancellation.

Meaningful scheduling transitions SHALL be auditable, including task/mission identity, old/new state or priority, reason, triggering instruction/policy event, checkpoint where applicable, and interruption outcome.

After `PAUSED`, all new execution follows canonical durable `RESUMING` validation.

---

## J04-OPS-07 — RECOVERY VISIBILITY

Accepted queued/pending work SHALL survive restart according to durability policy and remain visible after recovery.

After crash/restart/provider/runtime interruption, JARVIS SHALL accurately surface materially interrupted, resumed, queued, blocked, uncertain, setup/repair-required, approval-revalidation-required, or user-action-required work.

Recovery messaging SHALL reflect live reconciliation rather than merely repeating pre-crash assumptions.

---

## J04-OPS-08 — STANDING PERMISSION GOVERNANCE

Standing permissions SHALL be explicit, scoped, revocable, non-transitive across unrelated targets/environments/action classes, and auditable.

A standing permission SHALL identify sufficient canonical scope to prevent accidental expansion across projects, accounts, environments, resource classes, or materially different actions.

Revocation SHALL prevent new dependent execution immediately after authoritative policy state is updated. Revoking one capability SHALL NOT implicitly revoke unrelated independent capabilities unless policy explicitly couples them.

A development standing permission SHALL NOT become production authority. No standing permission waives mandatory destructive final confirmation.

---

## J04-OPS-09 — EVENT DISPOSITION AND AUTOMATION POLICY

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

## J04-OPS-10 — NOTIFICATION POLICY AND FOCUS MODES

NotificationPolicyEngine is the single policy authority for whether an event is spoken, displayed, grouped, deferred, dashboard-only, or silent.

Decisions SHALL consider relevant severity, source, project/integration scope, DataPolicy, preferences, interaction/focus state, actionability, repetition/grouping, and locked-session privacy.

Notification severity SHALL use the canonical `NotificationSeverity` vocabulary in J01-PROTO-24 without adding presentation-only severity values.

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

## J04-OPS-11 — CONFIGURATION ACTIVATION AND ONE CONFIGURATION AUTHORITY

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

## J04-OPS-12 — IMPORT / MERGE SAFETY

User state import SHALL be versioned, schema-validated, bounded, and staged before mutation.

Import SHALL NOT silently overwrite existing projects, memories, settings, histories, module/integration records, or other durable user state on conflict.

Conflicts SHALL use an explicit versioned merge/conflict policy. If deterministic safe merge is undefined, JARVIS SHALL surface the conflict for user resolution instead of guessing.

Credential import, if ever implemented, remains a separate high-risk encrypted/confirmed workflow.

---

## J04-OPS-13 — SCOPED RANKED MEMORY RETRIEVAL

JARVIS SHALL retrieve memory through scoped, ranked, metadata-aware policy rather than unrestricted history retrieval or raw semantic similarity alone.

Context SHALL distinguish verified live state, persisted fact/memory, and AI inference. For current-state questions or actions, verified live state overrides persisted fact/memory, which overrides AI inference.

Ranking SHOULD consider applicable scope match, memory type, confidence/provenance, verification/staleness, recency, semantic relevance, importance, and relationship to the authoritative current project/environment/task.

Confirmed decisions and verified facts SHOULD rank above weak inference when otherwise relevant.

Memory records SHALL carry applicable scope, project identity, type, importance, confidence, provenance, timestamp, and source metadata. Memory remains bounded to applicable global-user, project, mission, session, or task scope; unrestricted conversation history SHALL NOT be supplied by default.

Context Manager SHALL provide the smallest useful context/memory set for the current interaction.

For current-state questions/actions, freshly verified live state remains authoritative over memory.

Consequential ambiguity that cannot be resolved reliably SHALL clarify/block rather than cross-project/target guess.

---

## J04-OPS-14 — PROVIDER LIFECYCLE, SETUP, AND RESPONSIVENESS CAPABILITY

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

The centralized Provider Supervisor SHALL isolate provider process/lifecycle failure and manage discovery, health, capability detection, restart, and approved capability-based fallback. Outage, authentication, quota, rate-limit, or unavailable-model state SHALL remain explicit. Repeated failures SHALL use bounded retry/backoff rather than aggressive retry loops. A fallback SHALL preserve required capability, locality, privacy, permission, and provider policy; local reflex controls remain available when remote AI is unavailable where they need no AI reasoning.

Latency-critical lightweight components SHOULD remain warm while their feature is active where resource policy permits. Heavy RAM/VRAM/CPU/GPU providers SHOULD be warmed/unloaded according to measured resource pressure and latency requirements rather than assuming every provider can remain resident.

Provider lifecycle/resource scheduling SHALL preserve UI/voice/stop-cancel responsiveness on the qualified 16 GB baseline and SHALL prefer graceful degradation over resource exhaustion.

Streaming SHOULD be used where it improves responsiveness and remains semantically/safely valid; downstream work may begin before complete upstream output only when the partial information is sufficient and does not create premature authority/success claims.

---

## J04-OPS-15 — MODULE REGISTRY, DASHBOARD, AND STATE SEPARATION

JARVIS SHALL provide one centralized Module Registry and module-management dashboard.

The normal supported catalog/dashboard shows only modules/providers explicitly supported for the applicable JARVIS/platform/release context. Supported modules MAY be visible before installation.

This clause is the sole canonical owner of these distinct module lifecycle/support facts:

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

## J04-OPS-16 — MODULE VERSIONING, UPDATE POLICY, AND ROLLBACK UX

Module/provider versions are immutable installation units. Update does not destructively overwrite the active version in place.

Activation points to one validated installed version. Rollback changes activation state/pointer to a retained version rather than reconstructing overwritten files.

New versions SHALL be staged, provenance/integrity checked, compatibility checked, and health/conformance tested before activation under policy.

Users MAY pin versions and choose supported manual, notify-only, or qualified automatic update policy for allowed classes.

Breaking/security-sensitive updates SHALL surface material impact before activation. Core voice, AI, security, credential, and infrastructure providers SHOULD default to explicit notification/approval for materially risky replacement rather than silent activation.

Active tasks SHOULD NOT have their provider/module replaced underneath them outside a qualified safe lifecycle boundary.

Where rollback is promised/technically possible, the previous known-working version SHALL remain available until replacement is proven healthy.

Dashboard SHOULD distinguish active, approved-available, staged, previous/rollback, pinned, and failed-validation/update state when applicable.

---

## J04-OPS-17 — INTEGRATION CATALOG UX AND REVOCATION

JARVIS SHALL maintain an official Supported Integration Catalog consistent with the V1 Release Profile and binding post-V1 requirements.

Each supported integration exposes normalized identity, capabilities/operations, authentication method, least-privilege credential scopes, health, compatibility/support, permission/risk, and DataPolicy behavior.

Connecting/configuring an integration SHALL NOT imply every service capability is enabled or authorized. Where upstream permits, service capabilities are independently enabled/authorized.

The dashboard SHALL expose the active Release Profile support matrix so users can distinguish `modeled`, `available`, `enabled`, and `production-supported` capabilities. Optional GitHub Actions dispatch and optional Proxmox storage/network-write capabilities SHALL not appear as mandatory V1 support merely because their schemas exist.

Revoked/expired authentication or removed capability scope SHALL immediately prevent new dependent actions after authoritative integration state changes while leaving unrelated integration capabilities usable when independently valid.

The dashboard SHALL distinguish support, connection/configuration, enabled capabilities, authorization, and health without exposing secret material.

Manual/unsupported extensions remain clearly distinct from official support.

---

## J04-OPS-18 — BUDGET / QUOTA USER EXPERIENCE

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

## J04-OPS-19 — VOICE IDENTITY AND FALLBACK

JARVIS SHALL maintain one persistent configured human-quality voice identity across normal spoken interaction.

Voice identity is independent from a specific TTS implementation. Provider replacement SHALL preserve configured perceptual identity/naturalness within the qualified threshold.

Latency SHALL NOT be improved by silently switching to a substantially different/lower-quality generic voice.

If no policy-compliant TTS can preserve identity adequately, JARVIS SHALL degrade to text/UI with explicit `VOICE_DEGRADED`-equivalent state rather than poorly impersonating the configured voice.

Cloud speech fallback SHALL NOT violate DataLocality.

---

## J04-OPS-20 — VOICE REFLEX, ACKNOWLEDGEMENT, AND CONTINUITY

The deterministic low-latency reflex path SHALL remain independent of remote AI reasoning for established controls/state transitions including, as applicable, listening feedback, PTT state, wake/session acknowledgement when enabled, immediate TTS interruption, stop, cancel current voice generation, mute/unmute, sleep/lock, show/hide JARVIS presentation, and unambiguous task pause/cancel after target resolution.

Immediate acknowledgement MAY use visual state, local earcon, or a small fixed/pre-generated phrase bank rendered in the exact configured voice.

Acknowledgement means only received/listening/processing-started and SHALL NOT imply task success unless completion was already verified.

The fixed phrase bank SHALL remain intentionally small and deterministic.

After a spoken response, a configurable short conversation window MAY remain active so the user can continue without repeating a wake word when policy/device state permits.

---

## J04-OPS-21 — SLOW-OPERATION RESPONSIVENESS

AI/provider/network/worker latency SHALL NOT freeze local UI, voice controls, or deterministic safety controls.

Longer work SHALL remain truthfully visible through `THINKING`, `WORKING`, `QUEUED`, `BLOCKED`, or equivalent state.

JARVIS SHOULD acknowledge accepted longer work promptly, stream meaningful authoritative progress, avoid repetitive verbal chatter, speak useful milestones according to NotificationPolicy, and keep stop/mute/cancel responsive.

Routine deterministic controls SHALL NOT invoke AI unnecessarily after intent is established.

---

## J04-OPS-22 — VOICE/PERFORMANCE TELEMETRY

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

## J04-OPS-23 — DESTRUCTIVE APPROVAL USER EXPERIENCE

Final destructive confirmation SHALL present user-understandable exact target, environment where applicable, action, expected destructive/materially unrecoverable consequence, and whether a verified rollback/backup is known to exist when that information is available.

Voice approval MAY be accepted only in an unlocked authoritative session and only when it unambiguously maps to exactly one pending approval under current policy.

A UI confirmation path SHALL remain available for final destructive approval even when voice confirmation is supported.

Human-readable summaries never replace the canonical action descriptor/digest.

---

## J04-OPS-24 — DIAGNOSTICS UX AND EXPORT PRIVACY

Diagnostics SHALL make common failure/degraded causes actionable and distinguish healthy, setup-required, repair-required, degraded, unavailable, blocked, uncertain, and recovery-required state where applicable.

Recorded diagnostic/audit evidence SHALL be sufficient, subject to retention/DataPolicy, to establish non-secret request summary, relevant project/mission/task/attempt, provider/worker/tool/integration, provider setup/qualification state, permission/approval result, important transitions, outcome, verification evidence, and fallback/retry/recovery behavior.

This SHALL NOT require private chain-of-thought or raw credentials.

Before diagnostic/support export, JARVIS SHALL show the information categories included.

Diagnostic export SHALL default to excluding conversation bodies/private user content unless explicitly selected for that export and allowed by DataPolicy.

Secret/recovery-key/credential/KDF-derived/provider-internal sandbox credential material remains excluded by construction and cannot be opted into an ordinary diagnostic export.

---

## J04-OPS-25 — AUDIT RETENTION AND INTEGRITY CLAIMS

Audit records SHALL be append-oriented and retained according to policy sufficient to explain recent consequential/security-relevant actions.

Retention SHALL NOT silently delete evidence still required by the configured security/audit explanation window merely to satisfy generic cleanup preferences.

Integrity mechanisms SHOULD detect corruption, sequence discontinuity, unexpected truncation, or casual modification to the extent supported and qualified.

JARVIS SHALL NOT claim cryptographically trustworthy local audit history after equivalent same-user compromise with sufficient access or Administrator/kernel compromise. Tamper/corruption diagnostics are defense-in-depth, not an independently trusted remote audit system.

---

## J04-OPS-26 — DEPENDENCY / VULNERABILITY RELEASE POLICY

Production CI/release qualification SHALL review dependency/known-vulnerability results for reachable production paths.

A known unmitigated **Critical** vulnerability affecting a reachable production path SHALL block production release.

A known **High** vulnerability affecting a reachable production path SHALL also block release unless exceptional explicit risk acceptance records at least affected component/version/path, reachability assessment, temporary-acceptance rationale, mitigation/compensating controls, accountable owner, expiry/mandatory review date, and remediation/tracking reference.

A High waiver is exceptional, auditable, time-bounded, and SHALL NOT waive a mandatory JARVIS security invariant.

A Critical finding is not converted into a production pass merely by relabeling it accepted risk.

---

## J04-OPS-27 — UPGRADE / UNINSTALL USER-STATE PRESERVATION

Upgrade qualification SHALL prove preservation or explicit migration of compatible durable user state including applicable projects/workspaces/environments, memories/history policy state, mission/task/worker history, settings, provider setup/qualification state, module/integration metadata, compatible approvals/standing permissions, KDF profile/verifier metadata, and backup/recovery availability.

Invalid/obsolete persisted states SHALL be migrated, invalidated, or surfaced explicitly; they SHALL NOT silently disappear because a new version no longer understands them.

Normal uninstall SHALL NOT silently delete durable user data/backups without explicit product policy and user-visible confirmation/choice appropriate to removal.

---

## J04-OPS-28 — ARCHITECTURE CHANGE ESCALATION

Non-critical engineering choices SHALL be resolved from the current normative suite, production evidence, and established principles without requiring user approval for routine implementation detail.

Escalation is required when a decision materially requires user preference/consent regarding security/trust boundary, privacy/data exposure, destructive/irreversible behavior, significant recurring cost, core UX, major product scope, permanent external account/policy commitment, or materially conflicting requirements with no clearly superior engineering resolution.

Internal package factoring, retry mechanics, routing implementation, schemas, state-machine implementation, observability mechanics, and equivalent choices SHOULD normally be resolved without interruption when accepted behavior/safety is preserved.

Significant non-critical architecture choices made autonomously SHALL be documented directly in the applicable active contract clause when they change normative meaning, or in non-normative implementation evidence when they do not, as required by J00-GOV-29. ADR/decision-record creation, retention, citation, or use is prohibited. The user SHOULD receive a concise summary rather than being asked to approve every implementation detail or being left unaware of a material decision.

> **Escalate product judgment. Resolve engineering judgment.**

---

## J04-OPS-29 — USER-INTENT AUTONOMY BOUNDARY

JARVIS SHOULD make useful progress without constant babysitting inside established user intent and authority.

Reasonable recoverable subordinate actions MAY proceed when permitted by Authority Envelope and deterministic policy.

Consequential ambiguity or material expansion of goal, project, environment, target, financial exposure, security posture, workflow architecture, or external effects SHALL be clarified/authorized rather than silently guessed.

> **Be autonomous inside the user's intent. Ask before materially expanding it.**

---

## J04-OPS-30 — REQUIRED QUALIFICATION

J04-OPS-02 through J04-OPS-29 own the operational behavior that must be qualified. J05-VER-03 through J05-VER-39 own verification and release evidence. Failure of any applicable mandatory behavior or evidence gate blocks `Production Complete` for the active Release Profile.

---

## J04-OPS-31 — GOVERNING PRINCIPLES

> **Truthful state is a product feature.**

> **The user can see what JARVIS is doing, waiting for, and why.**

> **AI determines logical parallelism. Software determines actual concurrency.**

> **Configuration changes become active only after they are valid.**

> **Install, setup, enable, authorize, prefer, healthy, and supported are different facts.**

> **JARVIS keeps one voice identity; provider failure does not license impersonation by a different voice.**

> **Escalate product judgment. Resolve engineering judgment.**

> **The active clauses explain the requirements. The current normative suite defines the product.**

---

## J04-UI-01 — PURPOSE

This document defines the production visual identity, interaction tone, adaptive layout, desktop-window presentation behavior, component language, accessibility, brand-asset governance, and qualification requirements for JARVIS.

It is part of the current normative implementation source of truth. Required rationale and design rules are stated in these clauses; implementation SHALL not reconstruct UI rules from obsolete images or discussions.

The goal is not maximum visual novelty. The goal is a recognizable, calm, precise, high-information interface that remains coherent during ordinary conversation, deep technical work, approvals, infrastructure operations, provider setup, recovery, and degraded conditions.

> **One system. One identity. Any screen.**

---

## J04-UI-02 — PRODUCT IDENTITY

JARVIS SHALL feel:

```text
SMART
DIRECT
FRIENDLY
CANDID
CALM
PRECISE
TRUSTWORTHY
OPERATIONAL
```

The interface SHALL NOT feel like:

- a generic SaaS admin template;
- a detached chatbot glued onto operational screens;
- a cyberpunk/holographic novelty interface;
- an IDE clone;
- a dense monitoring wall where every metric is equally important;
- a constantly animated AI avatar.

The visual system SHALL communicate controlled intelligence rather than spectacle.

---

## J04-UI-03 — BRAND SYSTEM

### 3.1 Canonical brand palette

The primary JARVIS brand uses exactly these three colors:

| Token | Value | Role |
|---|---:|---|
| `brand.blue` | `#2D7BFF` | primary identity, active state, links, selected controls, brand mark |
| `brand.white` | `#FFFFFF` | primary high-emphasis text and brand core |
| `brand.slate` | `#0B0F14` | canonical dark foundation/background and negative space |

The logo/wordmark SHALL use no colors outside these three.

Derived neutral tokens MAY be produced from `brand.white`/`brand.slate` by deterministic opacity/compositing or documented fixed values for surfaces, borders, muted text, hover, selected state, and disabled state.

Functional semantic colors MAY exist for status meaning. They are not brand colors.

### 3.2 Semantic color families

Semantic state SHALL use token families equivalent to:

```text
info / active / in-progress → Brand Blue
success                     → accessible green
warning                     → accessible amber
error / destructive         → accessible red
waiting / paused             → accessible violet or neutral-violet
neutral / cancelled         → accessible slate/gray
uncertain                    → visually distinct warning/error hybrid treatment
```

Exact semantic hex values SHALL be qualified against actual backgrounds and MAY change without changing brand identity.

Color SHALL never be the only carrier of status. Iconography/text/state labels are mandatory for consequential states.

### 3.3 Theme

V1 SHALL ship **dark theme only**.

Dark theme is a product decision, not an unfinished light-theme toggle.

The dark system SHALL use layered dark surfaces with restrained luminance differences instead of pure-black panels separated only by glow.

Windows High Contrast/forced-colors modes MAY override brand/surface colors when required for platform accessibility. Such override is accessibility behavior, not a second JARVIS theme, and SHALL preserve semantics, focus, control visibility, and action differentiation.

A future light theme requires a deliberate design-system extension and qualification; it is not automatically inherited by inversion.

---

## J04-UI-04 — LOGO, LOCKUP, APP ICON, AND BRAND ASSET SOURCES

### 4.1 Symbol

The canonical JARVIS symbol is an original geometric mark:

- segmented circular outer ring;
- Brand Blue outer ring;
- Pure White central core/dot;
- Deep Slate/transparent negative space;
- no required gradient;
- no required glow;
- no more than three brand colors.

The mark represents:

```text
outer ring → awareness / operating boundary / controlled reach
center core → stable authority / identity / verified center
segmentation → openness / active system / non-monolithic intelligence
```

### 4.2 Canonical source files

Production brand source assets SHALL be:

```text
assets/brand/jarvis-mark.svg
assets/brand/jarvis-lockup.svg
assets/brand/jarvis-app-icon.svg
assets/brand/README.md
```

Generated PNG/ICO/installer/taskbar/start-menu variants SHALL derive from these sources. Screens SHALL NOT redraw approximate variants.

### 4.3 Wordmark

The primary lockup is:

```text
[mark]  JARVIS
```

The wordmark is uppercase, geometric, clean, and horizontally balanced. It SHALL not use ornamental sci-fi glyph substitutions that reduce legibility.

UI navigation MAY render `JARVIS` using the application type system when the canonical lockup asset is not appropriate, but branded surfaces/app icons/startup assets SHALL use canonical source assets or generated derivatives.

### 4.4 Usage

The brand mark SHALL remain recognizable at small application/status sizes.

Minimum target sizes:

- standalone UI mark: `16 × 16` logical px minimum;
- normal navigation/logo mark: `24–32` logical px;
- lockup height: normally `24–36` logical px.

At very small sizes, wordmark may be omitted before the symbol is simplified.

Do not:

- rotate the mark;
- recolor it with semantic state colors;
- add permanent glow, drop shadow, bevel, chrome, or texture;
- stretch it non-uniformly;
- put animated activity state inside the canonical logo geometry.

Voice/listening animation may appear adjacent to or around a UI instance of the mark, but it SHALL remain a state treatment rather than modifying the canonical brand asset.

---

## J04-UI-05 — TYPOGRAPHY AND FONT PROVENANCE

### 5.1 Typeface

Primary UI family:

```text
Inter
```

Production packaging SHALL make the qualified font available without network/CDN dependency.

Fallback order:

```text
Inter
→ Segoe UI Variable
→ Segoe UI
→ sans-serif
```

Packaged font files, icon libraries, and other third-party visual assets SHALL have source/version/license/provenance recorded and any required notices included in release artifacts. JARVIS SHALL NOT redistribute an asset without a license permitting the intended distribution.

### 5.2 Scale

The default type scale SHALL remain close to:

| Token | Typical size | Weight | Use |
|---|---:|---:|---|
| `type.display` | 40–48 | 600–700 | rare major identity/empty-state display |
| `type.page` | 26–30 | 600–700 | primary page title |
| `type.section` | 18–20 | 600 | section titles |
| `type.heading` | 14–16 | 600 | card/table/component heading |
| `type.body` | 14–16 | 400–500 | normal reading/assistant response |
| `type.caption` | 12–13 | 400–500 | secondary metadata/status detail |

Text smaller than 12 logical CSS px SHALL NOT be used for essential operational information.

Monospaced content MAY use an application-owned monospace stack for code, IDs, hashes, commands, paths, logs, and machine-readable material.

### 5.3 Writing hierarchy

At-a-glance UI text follows:

```text
state / answer
→ important context
→ detail/evidence
→ action
```

Avoid redundant labels where layout/semantics already make meaning obvious, but never sacrifice clarity for minimalism.

---

## J04-UI-06 — SPACING, SHAPE, AND SURFACES

### 6.1 Grid

The design system uses a 4 px base unit and an 8 px primary rhythm.

Preferred spacing tokens:

```text
4
8
12
16
24
32
48
```

Arbitrary one-off spacing SHOULD NOT proliferate when an existing token serves the hierarchy.

### 6.2 Shape

Typical radius:

```text
controls        6–8 px
cards/panels    8–12 px
large sheets    12–16 px where useful
```

Pill shape is reserved for compact tags/status/chips and SHALL NOT become the universal control shape.

### 6.3 Borders and elevation

Most structural separation SHALL use:

- 1 logical px restrained borders;
- surface luminance difference;
- spacing/hierarchy.

Shadow/blur is secondary.

Default UI SHALL NOT rely on:

- heavy glassmorphism;
- bright outer glows;
- animated gradients;
- ornamental grid overlays;
- multiple nested shadows;
- excessive transparency that harms text contrast.

---

## J04-UI-07 — ICONOGRAPHY

Icons SHALL be geometric, open, and consistent.

Normal icon construction SHOULD use a consistent outline system near 1.5–2 logical px stroke at common 20/24 logical px sizes.

Icons SHALL remain understandable without decorative detail at compact sizes.

Where an icon represents a consequential action or state, a text/accessible label SHALL exist.

Different integrations MAY use their official marks where permitted by their license/brand terms, but surrounding controls/layout remain JARVIS-native rather than adopting each integration's visual system.

---

## J04-UI-08 — JARVIS MISSION CONTROL

### 8.1 Signature shell

The primary JARVIS interface is **Mission Control**.

Mission Control unifies:

- conversation;
- voice state;
- mission/task work;
- queue;
- approvals;
- systems/integrations;
- provider setup/repair/status;
- project/context;
- data/memory/artifacts;
- notifications;
- settings/diagnostics.

No major subsystem SHALL invent an unrelated top-level shell.

### 8.2 Wide layout

Wide Mission Control uses four conceptual regions:

1. global navigation rail;
2. global status strip;
3. primary workspace;
4. contextual information/action pane.

#### Global navigation rail

Contains stable top-level destinations such as:

```text
Mission Control
Missions
Queue
Approvals
Systems / Integrations
Data
Memory
Artifacts
Settings
```

Exact grouping may evolve, but information architecture SHALL remain task-oriented and coherent.

#### Global status strip

Prioritizes compact high-value state such as:

- system health;
- voice/listening/speaking state;
- interaction/focus mode;
- active mission count;
- attention/notification state;
- current environment/context when material.

It is not a telemetry dump.

#### Primary workspace

The primary workspace presents the user's current intent and the most important associated state.

It may show:

- conversation;
- mission overview;
- selected task;
- queue;
- requested analysis/information;
- system/integration detail;
- provider setup/repair flow;
- artifact/data view.

Conversation SHALL feel native to this workspace, not like an embedded third-party chat widget.

#### Context pane

The context pane surfaces secondary but actionable information, for example:

- pending approval;
- selected mission/task detail;
- Proxmox/system status;
- GitHub activity;
- provider support/setup state;
- memory/context references;
- artifact preview;
- environment/account scope;
- verification evidence.

Context SHALL track the primary workspace rather than show unrelated dashboard filler.

---

## J04-UI-09 — DEDICATED WINDOW BEHAVIOR

### 9.1 Window authority

JARVIS SHALL have one dedicated primary desktop dashboard window controlled natively by the Rust/Tauri host.

Presentation state is deterministic application state, not an unrestricted AI side effect.

Canonical presentation modes are equivalents of:

```text
HIDDEN
WINDOWED
MAXIMIZED
FULLSCREEN
FOCUSED_CONTEXT
```

### 9.2 Show/hide behavior

The dashboard MAY be shown/focused when:

- user asks JARVIS to show/open itself;
- user asks for visual information best presented in the dashboard;
- user selects JARVIS from taskbar/tray/application controls;
- deterministic approval/notification policy explicitly calls for visual escalation;
- provider setup/repair needs explicit user action;
- recovery/security state requires user interaction.

The dashboard MAY be hidden when:

- user asks JARVIS to hide/go away/minimize;
- user closes the window under configured hide-on-close behavior;
- a completed transient presentation returns to background state.

Hiding the window SHALL NOT imply quitting Core or cancelling accepted work.

Explicit quit/exit remains a distinct action with appropriate work-state handling.

### 9.3 Focus discipline

JARVIS SHALL NOT routinely steal focus because:

- a task progressed;
- background work completed;
- a low/normal notification arrived;
- a provider produced output.

Visual escalation SHALL respect NotificationPolicy, current focus mode, current full-screen activity, locked-session privacy, and severity.

Critical/security/destructive approval states or an explicit setup action initiated by the user may request stronger presentation only under deterministic policy.

`FULLSCREEN` is not the default attention mechanism.

### 9.4 Multi-monitor behavior

Window state SHALL store logical size/placement and recover safely across monitor topology changes.

If the last monitor is missing or saved bounds are off-screen, JARVIS SHALL reposition to an available work area.

Full-screen presentation occurs on an explicitly selected/current monitor and SHALL remain reversible.

No always-on-top policy is required by default.

---

## J04-UI-10 — ADAPTIVE LAYOUT CONTRACT

JARVIS adapts by available layout width/height and input characteristics rather than hardcoded device identity.

Reference layout bands MAY be approximately:

```text
COMPACT    < 720 CSS/logical px content width
MEDIUM     720–1199
WIDE       1200–1599
ULTRAWIDE  >= 1600
```

These values are starting design tokens, not an excuse for breakpoint-specific duplicated applications.

### 10.1 Ultrawide/wide

May show:

- persistent nav rail;
- persistent status strip;
- primary workspace plus persistent context pane;
- multiple mission cards/queue columns;
- more simultaneous secondary detail.

### 10.2 Medium

May:

- reduce nav labels;
- reduce visible status metadata;
- narrow context pane;
- reduce columns;
- prioritize current mission/conversation over secondary panels.

### 10.3 Compact

Shall:

- convert nav rail to compact rail/menu;
- stack primary content;
- move context pane to drawer/sheet/stacked detail;
- keep conversation/current task and pending critical approval easy to reach;
- convert dense tables to compact rows/cards where required;
- remove low-priority simultaneous metrics before shrinking essential text.

### 10.4 Reflow and high zoom

Primary linear workflows SHALL remain usable at an effective layout equivalent to approximately **320 CSS px width / 400% zoom** without requiring simultaneous horizontal and vertical scrolling, except for content whose meaning intrinsically requires two-dimensional layout such as certain diagrams, maps, large code/data canvases, or equivalent WCAG-defined exceptions.

At high zoom/reflow, supporting detail may move behind drawers/details, but required primary actions and state SHALL remain reachable.

### 10.5 Touch-oriented/future smaller screens

Touch-optimized layout SHALL increase target size and vertical flow while preserving the same brand, hierarchy, state language, and component semantics.

There is no separate tablet/mobile brand.

---

## J04-UI-11 — INFORMATION HIERARCHY

The interface normally prioritizes:

1. what the user is currently asking/doing;
2. what JARVIS is doing now;
3. what requires user attention;
4. what is blocked/queued/waiting/setup-required/uncertain;
5. relevant system/environment health;
6. supporting evidence/history/details.

Secondary metrics SHALL NOT visually outrank a pending approval, blocked mission, failed verification, setup requirement, or active user question.

Dashboards SHALL be contextual, not metric collections built merely because data exists.

---

## J04-UI-12 — CONVERSATION UI

JARVIS conversation is integrated with operational truth.

A JARVIS response block SHOULD expose, when useful:

- speaker/identity;
- current answer/state;
- timestamp/relative time where useful;
- source/evidence affordance;
- related action/detail affordance;
- mission/task/context relationship.

Assistant responses SHALL not imitate human messaging apps with excessive bubbles or decorative avatars.

For operational answers, concise summary comes before verbose evidence.

Generated content SHALL be visually distinct from authoritative verified state when the distinction matters.

---

## J04-UI-13 — WORK AND MISSION COMPONENTS

Mission/task cards SHALL make the following glanceable where applicable:

- title;
- canonical state;
- project/environment;
- progress/checkpoint;
- blocker/wait reason;
- priority/impact;
- assigned worker/provider where useful;
- required user action;
- verification result.

Progress percentages/ETA SHALL only appear when they have a defined truthful basis. Fabricated certainty is prohibited.

Queue views SHALL preserve J04-OPS-03's truthful queued/blocked/wait semantics.

---

## J04-UI-14 — APPROVAL COMPONENTS

Approval UI is deliberate and information-dense without being visually dramatic.

It SHALL show, where applicable:

- exact action;
- exact target;
- account/environment;
- risk/impact;
- destructive/material consequence;
- rollback/backup availability if known;
- expiration/one-shot nature when relevant;
- confirm and reject/cancel paths.

Critical/destructive actions SHALL not use ambiguous color-only buttons or deceptive emphasis.

Approval language SHALL be plain, candid, and specific.

---

## J04-UI-15 — SYSTEM / INTEGRATION / PROVIDER PANELS

System panels such as Proxmox/GitHub/provider status SHALL answer useful operational questions first:

```text
Is it healthy?
Is required setup/repair complete?
What changed?
What needs attention?
What is JARVIS allowed to do?
Which capabilities are production-supported by this release?
What is the current environment/account scope?
```

Raw metrics are secondary unless requested or diagnostically important.

Integration-specific branding SHALL not break JARVIS component/layout hierarchy.

Mandatory vs optional/unsupported capability status SHALL be explicit rather than inferred from whether a button or schema exists.

---

## J04-UI-16 — VOICE PRESENCE

Voice UI SHALL provide immediate visible states equivalent to:

```text
IDLE
LISTENING
PROCESSING
SPEAKING
MUTED
INTERRUPTED
VOICE_DEGRADED
```

Voice indication may use the JARVIS mark as an anchor, adjacent waveform, ring progress, or compact status treatment.

Voice state animation SHALL remain subtle and functional.

The logo itself SHALL not permanently morph based on voice state.

Voice interaction and text interaction share the same conversational context unless product policy explicitly starts a separate context.

---

## J04-UI-17 — STATUS LANGUAGE

Canonical visual state families include:

```text
SUCCESS
IN_PROGRESS
WARNING
ERROR
WAITING
SETUP_REQUIRED
REPAIR_REQUIRED
BLOCKED
PAUSED
RESUMING
RECOVERING
UNCERTAIN
CANCELLED
```

Every consequential state SHALL provide at least two of:

- text;
- icon/shape;
- color;
- structural treatment.

Color alone is insufficient.

State terms used in UI SHALL map cleanly to canonical domain/runtime state and SHALL NOT invent optimistic synonyms that hide `BLOCKED`, `SETUP_REQUIRED`, `RECOVERING`, or `UNCERTAIN`.

---

## J04-UI-18 — MOTION AND FEEDBACK

Motion SHALL explain change, not decorate idle time.

Typical transition duration:

```text
120–200 ms
```

Longer animation requires a functional reason.

Allowed motion examples:

- drawer/panel reveal;
- focus transfer;
- status transition;
- compact progress;
- listening/speaking activity;
- input acknowledgement.

Default prohibited identity patterns:

- continuous ambient particle field;
- sweeping scanner overlays;
- looping glow pulses on ordinary cards;
- animated gradients as background decoration;
- large cinematic transitions that delay access to information.

Reduced-motion preference SHALL suppress nonessential motion.

---

## J04-UI-19 — COPY AND TONE

JARVIS copy SHALL be:

- direct;
- friendly without being chatty;
- candid about limitations/uncertainty;
- technically precise when needed;
- concise first, expandable second.

Preferred pattern:

```text
"Proxmox is healthy. All 3 nodes are online. One backup job is delayed by 18 minutes."
```

Avoid patterns like:

```text
"Great news! Everything looks amazing and I’m super excited to tell you..."
```

For failure:

```text
"The deploy did not complete. GitHub accepted the workflow request, but the runner result is still unknown. I’m treating the outcome as uncertain."
```

For setup:

```text
"Codex is installed, but its qualified Windows sandbox is not ready. Setup requires Windows approval before engineering workers can run."
```

Never use confident success language without authoritative evidence.

---

## J04-UI-20 — ACCESSIBILITY

The production UI SHALL target WCAG 2.2 AA-equivalent behavior where applicable to the desktop WebView.

Mandatory minimums:

- normal text contrast >= `4.5:1`;
- qualifying large text >= `3:1`;
- meaningful non-text UI indicators/controls use >= `3:1` contrast against adjacent colors where required by the applicable criterion;
- state is not color-only;
- keyboard access for primary workflows;
- no keyboard traps;
- visible focus indicator;
- focused controls are not obscured by sticky surfaces;
- semantic names/roles/states for assistive technology;
- user text/content scaling to 200% without losing required content/function;
- primary workflow reflow at an effective 320 CSS px / 400% zoom-equivalent layout subject only to intrinsic two-dimensional content exceptions;
- pointer targets at least `24 × 24` CSS px or satisfy an equivalent WCAG 2.2 target-spacing/exception rule;
- Windows DPI scaling/high-DPI multi-monitor scenarios qualified;
- Windows High Contrast / CSS forced-colors behavior qualified where supported by the production WebView stack;
- reduced-motion preference honored;
- touch-oriented interactive targets enlarged appropriately;
- important content remains understandable without relying on hover alone.

The app SHALL remain usable with Windows display scaling at least across qualified `100%`, `125%`, `150%`, and `200%` profiles on representative hardware.

High Contrast/forced-colors qualification SHALL verify focus, disabled/enabled distinction, selected state, warning/destructive action distinction, approval controls, status icons/text, and essential borders remain perceptible even when normal JARVIS colors are overridden.

---

## J04-UI-21 — SECURITY / PRIVACY PRESENTATION

The UI remains an unprivileged presentation/control surface under J03-SEC-20.

Visual polish SHALL never encourage bypassing trust boundaries.

Sensitive/private content SHALL obey current DataPolicy and locked-session notification rules.

The dashboard SHALL NOT expose:

- raw credentials;
- recovery keys/factors;
- KDF-derived working keys;
- provider-internal sandbox-user credentials;
- hidden model chain-of-thought;
- unrestricted environment dumps;
- secret values in debug UI.

External/untrusted HTML remains sanitized/inert under the WebView contract even when displayed in polished cards or previews.

A UAC/provider-setup prompt SHALL identify the provider/setup purpose clearly and SHALL NOT imitate a JARVIS approval for unrelated consequential work.

---

## J04-UI-22 — DESIGN TOKENS

Production UI SHALL centralize visual tokens rather than scatter raw style constants.

At minimum token groups cover:

```text
brand
surface
text
border
semantic status
spacing
radius
typography
motion
focus
z-order/layout
forced-colors/high-contrast adaptation
```

Components consume tokens. Screens SHALL NOT create parallel undocumented theme systems.

Changing a brand/design token SHALL be testable across all major surfaces.

---

## J04-UI-23 — COMPONENT OWNERSHIP

Reusable design-system components SHALL own common visual/interaction semantics for:

- buttons;
- text input/command input;
- selectors;
- tabs/segmented controls;
- dialogs;
- drawers/sheets;
- toasts/notifications;
- status chips;
- mission/task cards;
- approval panels;
- provider setup/repair panels;
- tables/list rows;
- system health blocks;
- message blocks;
- voice state;
- empty/degraded/recovery states.

Screens compose these components rather than cloning near-identical private variants.

Exceptions require a concrete product need.

---

## J04-UI-24 — FULLSCREEN AND FOCUSED PRESENTATION

Full-screen mode is a presentation state, not a separate application.

Entering/exiting full screen SHALL preserve:

- current navigation destination;
- active conversation/context;
- selected mission/task/artifact;
- unsent draft where safe;
- context-pane selection where applicable.

A focused presentation MAY temporarily remove navigation/secondary panels to show requested information, a graph, artifact, terminal/log view, presentation, approval, provider setup/repair flow, or system overview.

Dismissal returns to the previous shell state without losing context.

JARVIS SHALL be able to present requested information visually without forcing the user to navigate manually through unrelated screens.

---

## J04-UI-25 — EMPTY, DEGRADED, SETUP, RECOVERY, AND ERROR STATES

Empty states SHALL be useful and restrained. They may explain what can be done next but SHALL NOT fill the screen with marketing content.

Degraded/setup/recovery/error states SHALL:

- name the affected capability;
- state what remains available;
- state whether data/work is safe/queued/uncertain/setup-required;
- provide the next useful action when known;
- preserve access to diagnostics/recovery where policy permits.

Provider setup requiring UAC SHALL explain why elevation is needed and that normal workers remain non-elevated.

A polished dark screen with no explanation is not an acceptable failure state.

---

## J04-UI-26 — RELEASE QUALIFICATION MATRIX

J04-UI-03 through J04-UI-25 own UI behavior. J05-VER-11 and RP-12 own the exact V1 qualification matrix, including the requirement that adaptive layout changes information density rather than product identity.

---

## J04-UI-27 — NON-GOALS

V1 SHALL NOT require:

- light theme;
- theme marketplace;
- 3D avatar;
- photorealistic face;
- persistent animated orb as the primary navigation model;
- integration-specific full-page visual redesigns;
- glassmorphism as primary structure;
- fake holographic/parallax dashboards;
- always-on-top behavior;
- full-screen takeover for ordinary notifications;
- dense telemetry simply because data is available.

High Contrast/forced-colors is an accessibility adaptation and is not excluded by the dark-theme-only product decision.

---

## J04-UI-28 — DEFINITION OF UI IDENTITY COMPLETE

UI identity is complete only when J04-UI-03 through J04-UI-25 behavior and J05-VER-11/RP-12 qualification pass for the exact V1 release candidate.

---

## J04-UI-29 — GOVERNING PRINCIPLES

> **One system. One identity. Any screen.**

> **Information first. Decoration second.**

> **Calm by default. Urgent only when justified.**

> **The user should know what JARVIS is doing in one glance, and why in one action.**

> **Clean enough to scan, precise enough to trust, calm enough to live with all day.**

---

**END — JARVIS OPERATIONS, INTEGRATIONS & UX CONTRACT v1.0.9**
