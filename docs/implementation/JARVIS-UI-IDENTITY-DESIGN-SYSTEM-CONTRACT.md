# JARVIS UI Identity & Design System Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`  
**Version:** 1.0.2  
**Date:** August 12, 2026  
**Adopted by:** ADR-070

---

# 1. PURPOSE

This document defines the production visual identity, interaction tone, adaptive layout, desktop-window presentation behavior, component language, accessibility, and qualification requirements for JARVIS.

It is part of the current v1.0.2 normative implementation source of truth. ADRs/mockups preserve rationale and design exploration; implementation SHALL follow this contract rather than reconstructing UI rules from historical images or discussions.

The goal is not maximum visual novelty. The goal is a recognizable, calm, precise, high-information interface that remains coherent during ordinary conversation, deep technical work, approvals, infrastructure operations, recovery, and degraded conditions.

> **One system. One identity. Any screen.**

---

# 2. PRODUCT IDENTITY

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

# 3. BRAND SYSTEM

## 3.1 Canonical brand palette

The primary JARVIS brand uses exactly these three colors:

| Token | Value | Role |
|---|---:|---|
| `brand.blue` | `#2D7BFF` | primary identity, active state, links, selected controls, brand mark |
| `brand.white` | `#FFFFFF` | primary high-emphasis text and brand core |
| `brand.slate` | `#0B0F14` | canonical dark foundation/background and negative space |

The logo/wordmark SHALL use no colors outside these three.

Derived neutral tokens MAY be produced from `brand.white`/`brand.slate` by deterministic opacity/compositing or documented fixed values for surfaces, borders, muted text, hover, selected state, and disabled state.

Functional semantic colors MAY exist for status meaning. They are not brand colors.

## 3.2 Semantic color families

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

## 3.3 Theme

V1 SHALL ship **dark theme only**.

Dark theme is a product decision, not an unfinished light-theme toggle.

The dark system SHALL use layered dark surfaces with restrained luminance differences instead of pure-black panels separated only by glow.

A future light theme requires a deliberate design-system extension and qualification; it is not automatically inherited by inversion.

---

# 4. LOGO AND BRAND MARK

## 4.1 Symbol

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

## 4.2 Wordmark

The primary lockup is:

```text
[mark]  JARVIS
```

The wordmark is uppercase, geometric, clean, and horizontally balanced. It SHALL not use ornamental sci-fi glyph substitutions that reduce legibility.

UI navigation MAY render `JARVIS` using the application type system when the canonical lockup asset is not appropriate, but branded surfaces/app icons/startup assets SHALL use canonical vector assets.

## 4.3 Usage

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

# 5. TYPOGRAPHY

## 5.1 Typeface

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

## 5.2 Scale

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

## 5.3 Writing hierarchy

At-a-glance UI text follows:

```text
state / answer
→ important context
→ detail/evidence
→ action
```

Avoid redundant labels where layout/semantics already make meaning obvious, but never sacrifice clarity for minimalism.

---

# 6. SPACING, SHAPE, AND SURFACES

## 6.1 Grid

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

## 6.2 Shape

Typical radius:

```text
controls        6–8 px
cards/panels    8–12 px
large sheets    12–16 px where useful
```

Pill shape is reserved for compact tags/status/chips and SHALL NOT become the universal control shape.

## 6.3 Borders and elevation

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

# 7. ICONOGRAPHY

Icons SHALL be geometric, open, and consistent.

Normal icon construction SHOULD use a consistent outline system near 1.5–2 logical px stroke at common 20/24 logical px sizes.

Icons SHALL remain understandable without decorative detail at compact sizes.

Where an icon represents a consequential action or state, a text/accessible label SHALL exist.

Different integrations MAY use their official marks where permitted, but surrounding controls/layout remain JARVIS-native rather than adopting each integration's visual system.

---

# 8. JARVIS MISSION CONTROL

## 8.1 Signature shell

The primary JARVIS interface is **Mission Control**.

Mission Control unifies:

- conversation;
- voice state;
- mission/task work;
- queue;
- approvals;
- systems/integrations;
- project/context;
- data/memory/artifacts;
- notifications;
- settings/diagnostics.

No major subsystem SHALL invent an unrelated top-level shell.

## 8.2 Wide layout

Wide Mission Control uses four conceptual regions:

1. global navigation rail;
2. global status strip;
3. primary workspace;
4. contextual information/action pane.

### Global navigation rail

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

### Global status strip

Prioritizes compact high-value state such as:

- system health;
- voice/listening/speaking state;
- interaction/focus mode;
- active mission count;
- attention/notification state;
- current environment/context when material.

It is not a telemetry dump.

### Primary workspace

The primary workspace presents the user's current intent and the most important associated state.

It may show:

- conversation;
- mission overview;
- selected task;
- queue;
- requested analysis/information;
- system/integration detail;
- artifact/data view.

Conversation SHALL feel native to this workspace, not like an embedded third-party chat widget.

### Context pane

The context pane surfaces secondary but actionable information, for example:

- pending approval;
- selected mission/task detail;
- Proxmox/system status;
- GitHub activity;
- memory/context references;
- artifact preview;
- environment/account scope;
- verification evidence.

Context SHALL track the primary workspace rather than show unrelated dashboard filler.

---

# 9. DEDICATED WINDOW BEHAVIOR

## 9.1 Window authority

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

## 9.2 Show/hide behavior

The dashboard MAY be shown/focused when:

- user asks JARVIS to show/open itself;
- user asks for visual information best presented in the dashboard;
- user selects JARVIS from taskbar/tray/application controls;
- deterministic approval/notification policy explicitly calls for visual escalation;
- recovery/security state requires user interaction.

The dashboard MAY be hidden when:

- user asks JARVIS to hide/go away/minimize;
- user closes the window under configured hide-on-close behavior;
- a completed transient presentation returns to background state.

Hiding the window SHALL NOT imply quitting Core or cancelling accepted work.

Explicit quit/exit remains a distinct action with appropriate work-state handling.

## 9.3 Focus discipline

JARVIS SHALL NOT routinely steal focus because:

- a task progressed;
- background work completed;
- a low/normal notification arrived;
- a provider produced output.

Visual escalation SHALL respect NotificationPolicy, current focus mode, current full-screen activity, locked-session privacy, and severity.

Critical/security/destructive approval states may request stronger presentation only under deterministic policy.

`FULLSCREEN` is not the default attention mechanism.

## 9.4 Multi-monitor behavior

Window state SHALL store logical size/placement and recover safely across monitor topology changes.

If the last monitor is missing or saved bounds are off-screen, JARVIS SHALL reposition to an available work area.

Full-screen presentation occurs on an explicitly selected/current monitor and SHALL remain reversible.

No always-on-top policy is required by default.

---

# 10. ADAPTIVE LAYOUT CONTRACT

JARVIS adapts by available layout width/height and input characteristics rather than hardcoded device identity.

Reference layout bands MAY be approximately:

```text
COMPACT    < 720 CSS/logical px content width
MEDIUM     720–1199
WIDE       1200–1599
ULTRAWIDE  >= 1600
```

These values are starting design tokens, not an excuse for breakpoint-specific duplicated applications.

## 10.1 Ultrawide/wide

May show:

- persistent nav rail;
- persistent status strip;
- primary workspace plus persistent context pane;
- multiple mission cards/queue columns;
- more simultaneous secondary detail.

## 10.2 Medium

May:

- reduce nav labels;
- reduce visible status metadata;
- narrow context pane;
- reduce columns;
- prioritize current mission/conversation over secondary panels.

## 10.3 Compact

Shall:

- convert nav rail to compact rail/menu;
- stack primary content;
- move context pane to drawer/sheet/stacked detail;
- keep conversation/current task and pending critical approval easy to reach;
- convert dense tables to compact rows/cards where required;
- remove low-priority simultaneous metrics before shrinking essential text.

## 10.4 Touch-oriented/future smaller screens

Touch-optimized layout SHALL increase target size and vertical flow while preserving the same brand, hierarchy, state language, and component semantics.

There is no separate tablet/mobile brand.

---

# 11. INFORMATION HIERARCHY

The interface normally prioritizes:

1. what the user is currently asking/doing;
2. what JARVIS is doing now;
3. what requires user attention;
4. what is blocked/queued/waiting/uncertain;
5. relevant system/environment health;
6. supporting evidence/history/details.

Secondary metrics SHALL NOT visually outrank a pending approval, blocked mission, failed verification, or active user question.

Dashboards SHALL be contextual, not metric collections built merely because data exists.

---

# 12. CONVERSATION UI

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

# 13. WORK AND MISSION COMPONENTS

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

Queue views SHALL preserve the Operations Contract's truthful queued/blocked/wait semantics.

---

# 14. APPROVAL COMPONENTS

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

# 15. SYSTEM / INTEGRATION PANELS

System panels such as Proxmox/GitHub status SHALL answer useful operational questions first:

```text
Is it healthy?
What changed?
What needs attention?
What is JARVIS allowed to do?
What is the current environment/account scope?
```

Raw metrics are secondary unless requested or diagnostically important.

Integration-specific branding SHALL not break JARVIS component/layout hierarchy.

---

# 16. VOICE PRESENCE

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

# 17. STATUS LANGUAGE

Canonical visual state families include:

```text
SUCCESS
IN_PROGRESS
WARNING
ERROR
WAITING
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

State terms used in UI SHALL map cleanly to canonical domain/runtime state and SHALL NOT invent optimistic synonyms that hide `BLOCKED`, `RECOVERING`, or `UNCERTAIN`.

---

# 18. MOTION AND FEEDBACK

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

# 19. COPY AND TONE

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

Never use confident success language without authoritative evidence.

---

# 20. ACCESSIBILITY

The production UI SHALL target WCAG 2.2 AA-equivalent behavior where applicable to the desktop WebView.

Mandatory minimums:

- normal text contrast >= `4.5:1`;
- qualifying large text >= `3:1`;
- meaningful non-text UI indicators/controls use qualified contrast;
- state is not color-only;
- keyboard access for primary workflows;
- no keyboard traps;
- visible focus indicator;
- focused controls are not obscured by sticky surfaces;
- semantic names/roles/states for assistive technology;
- user text/content scaling to 200% without losing required content/function;
- Windows DPI scaling/high-DPI multi-monitor scenarios qualified;
- reduced-motion preference honored;
- touch-oriented interactive targets are enlarged appropriately;
- important content remains understandable without relying on hover alone.

The app SHALL remain usable with Windows display scaling at least across qualified `100%`, `125%`, `150%`, and `200%` profiles on representative hardware.

---

# 21. SECURITY / PRIVACY PRESENTATION

The UI remains an unprivileged presentation/control surface under the Security Contract.

Visual polish SHALL never encourage bypassing trust boundaries.

Sensitive/private content SHALL obey current DataPolicy and locked-session notification rules.

The dashboard SHALL NOT expose:

- raw credentials;
- recovery keys;
- hidden model chain-of-thought;
- unrestricted environment dumps;
- secret values in debug UI.

External/untrusted HTML remains sanitized/inert under the WebView contract even when displayed in polished cards or previews.

---

# 22. DESIGN TOKENS

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
```

Components consume tokens. Screens SHALL NOT create parallel undocumented theme systems.

Changing a brand/design token SHALL be testable across all major surfaces.

---

# 23. COMPONENT OWNERSHIP

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
- tables/list rows;
- system health blocks;
- message blocks;
- voice state;
- empty/degraded/recovery states.

Screens compose these components rather than cloning near-identical private variants.

Exceptions require a concrete product need.

---

# 24. FULLSCREEN AND FOCUSED PRESENTATION

Full-screen mode is a presentation state, not a separate application.

Entering/exiting full screen SHALL preserve:

- current navigation destination;
- active conversation/context;
- selected mission/task/artifact;
- unsent draft where safe;
- context-pane selection where applicable.

A focused presentation MAY temporarily remove navigation/secondary panels to show requested information, a graph, artifact, terminal/log view, presentation, approval, or system overview.

Dismissal returns to the previous shell state without losing context.

JARVIS SHALL be able to present requested information visually without forcing the user to navigate manually through unrelated screens.

---

# 25. EMPTY, DEGRADED, RECOVERY, AND ERROR STATES

Empty states SHALL be useful and restrained. They may explain what can be done next but SHALL NOT fill the screen with marketing content.

Degraded/recovery/error states SHALL:

- name the affected capability;
- state what remains available;
- state whether data/work is safe/queued/uncertain;
- provide the next useful action when known;
- preserve access to diagnostics/recovery where policy permits.

A polished dark screen with no explanation is not an acceptable failure state.

---

# 26. RELEASE QUALIFICATION MATRIX

A V1 UI release SHALL be exercised at minimum across representative combinations of:

```text
1920×1080 standard display
2560×1440 / 4K desktop class
ultrawide layout
compact resizable window
multi-monitor including monitor removal/reconnect
100% / 125% / 150% / 200% Windows scaling
keyboard-only primary workflows
reduced-motion preference
long text / long IDs / localization-safe expansion behavior
high mission/queue/notification counts
empty state
blocked/waiting/uncertain/recovery state
voice idle/listening/processing/speaking/degraded state
approval states including destructive confirmation
```

Qualification SHALL verify that adaptive layout changes information density, not product identity.

---

# 27. NON-GOALS

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

---

# 28. DEFINITION OF UI IDENTITY COMPLETE

UI identity implementation is complete only when:

1. canonical logo/vector assets are used consistently;
2. three-color brand identity is preserved;
3. design tokens are centralized;
4. Mission Control shell exists and is consistent across major sections;
5. dedicated window show/hide/windowed/maximized/fullscreen/focused behavior is deterministic and tested;
6. layouts adapt across required viewport/DPI conditions without parallel visual systems;
7. operational state is glanceable and truthful;
8. conversation/mission/approval/system views feel like one product;
9. keyboard/focus/contrast/scaling requirements pass;
10. reduced-motion behavior passes;
11. destructive/uncertain/degraded states remain visually explicit;
12. no major screen requires historical mockups/ADRs to infer its design language.

---

# 29. GOVERNING PRINCIPLES

> **One system. One identity. Any screen.**

> **Information first. Decoration second.**

> **Calm by default. Urgent only when justified.**

> **The user should know what JARVIS is doing in one glance, and why in one action.**

> **Clean enough to scan, precise enough to trust, calm enough to live with all day.**

---

**END — JARVIS UI IDENTITY & DESIGN SYSTEM CONTRACT v1.0.2**
