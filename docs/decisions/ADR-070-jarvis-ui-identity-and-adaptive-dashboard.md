# ADR-070 — JARVIS UI Identity and Adaptive Dashboard

**Status:** Accepted  
**Date:** August 12, 2026  
**Decision scope:** Brand identity, visual language, dashboard/window behavior, adaptive layout, interaction tone, and UI qualification

---

## Context

JARVIS already has a detailed production architecture, runtime, security, operational, and release contract. Without an equally explicit UI identity, implementation could still drift into unrelated screen styles, a generic SaaS dashboard, a detached chatbot surface, or visually inconsistent tool-specific pages.

The product requires a recognizable JARVIS identity that remains coherent across conversation, mission control, approvals, infrastructure, memory, integrations, diagnostics, and voice interaction.

The user-approved direction is:

1. one unified visual and interaction concept;
2. a dedicated JARVIS dashboard/window that can be shown, hidden, maximized, or presented full-screen by user request or deterministic JARVIS presentation policy;
3. smart, direct, friendly, candid product behavior;
4. clean, precise, glanceable information presentation;
5. dark theme only for V1;
6. adaptive behavior across screen sizes, window sizes, DPI/scaling, and monitor configurations;
7. an original simple JARVIS brand/logo using at most three brand colors.

---

## Decision

JARVIS SHALL adopt one current UI identity and design-system contract as part of the normative v1.0.2 implementation suite.

The signature shell is **JARVIS Mission Control**.

Mission Control is not a separate admin application beside a chatbot. Conversation, active missions, queue state, approvals, systems/integrations, artifacts, memory/context, voice state, and operational status are different views of one product shell and one authoritative state model.

The approved brand direction is:

- **Brand Blue:** `#2D7BFF`
- **Pure White:** `#FFFFFF`
- **Deep Slate:** `#0B0F14`
- dark theme only for V1;
- clean geometric/open iconography;
- restrained borders and elevation;
- minimal decorative motion;
- no gratuitous neon, glassmorphism, pseudo-holographic effects, or sci-fi ornament that reduces readability;
- an original circular JARVIS symbol consisting of a segmented blue command/presence ring around a white central core;
- the logo/wordmark uses no more than the three approved brand colors.

Functional semantic status colors MAY extend beyond the brand palette when needed for unambiguous success/warning/error/waiting states. Those colors are system semantics, not brand-logo colors, and SHALL NOT be the sole carrier of meaning.

---

## Product personality

JARVIS SHALL communicate and present itself as:

- smart;
- direct;
- friendly;
- candid;
- calm;
- precise;
- useful without theatrics.

The default communication pattern is:

```text
answer / current state
→ important reason or evidence
→ recommended next action when useful
```

JARVIS SHALL avoid filler, exaggerated enthusiasm, false confidence, vague corporate language, and decorative complexity that hides operational truth.

---

## Dedicated window and presentation control

JARVIS SHALL have one dedicated primary desktop window whose content shell remains the canonical interactive dashboard.

Supported presentation states SHALL include equivalents of:

```text
HIDDEN
WINDOWED
MAXIMIZED
FULLSCREEN
FOCUSED_CONTEXT
```

The Rust/Tauri host owns native window lifecycle. AI may request a presentation transition, but deterministic application policy decides whether and how the transition occurs.

JARVIS MAY show or focus its dashboard when:

- the authenticated user explicitly asks;
- the user requests information that benefits materially from visual presentation;
- a deterministic notification/approval policy requires attention;
- a critical operational state requires visual escalation under current focus/privacy policy.

JARVIS SHALL NOT routinely steal focus, cover another application, or force full-screen merely because new information exists. Normal background activity uses notification/dashboard state. Critical escalation follows NotificationPolicy and focus-mode rules.

Closing the primary window MAY hide the UI while Core continues running according to application/session policy. Explicit `Quit JARVIS` remains distinct from hiding/minimizing the dashboard.

When a previously used monitor is unavailable, the window SHALL recover to an available display rather than reopen off-screen.

Sensitive content SHALL NOT be surfaced over the Windows lock screen or through an untrusted presentation path.

---

## Signature layout

At wide desktop sizes, Mission Control SHALL use a recognizable four-region shell:

```text
┌────────────┬──────────────────────────────────────────────┐
│ Brand/Nav  │ Global status strip                          │
│            ├──────────────────────────────┬───────────────┤
│            │ Primary workspace             │ Context pane  │
│            │ conversation + active work    │ approvals /   │
│            │ missions / queue / detail     │ systems / etc │
└────────────┴──────────────────────────────┴───────────────┘
```

The regions are:

1. **Global navigation rail** — Mission Control, missions, queue, approvals, systems/integrations, data/memory/artifacts, settings.
2. **Global status strip** — system health, voice state, current interaction/focus mode, active mission count, attention/notification state, and other high-value glanceable state.
3. **Primary workspace** — current conversation/context, active mission/work view, queue, requested information, or focused user task.
4. **Context pane** — approvals, live infrastructure/system detail, artifacts, selected mission/task, memory/context, integration status, or other secondary information relevant to the primary workspace.

The layout SHALL prioritize current user intent and required action over decorative or low-value metrics.

Chat is a first-class part of Mission Control, not an isolated visual product.

---

## Adaptive layout

JARVIS SHALL adapt by available logical viewport/container size rather than by hardcoded device names.

The same information hierarchy and brand identity SHALL survive transitions across ultrawide desktop, standard desktop/laptop, compact window, high-DPI scaling, and future touch-oriented surfaces.

Adaptive behavior SHALL include:

- navigation rail may collapse to icons or a menu;
- global status may condense to the highest-value indicators;
- context pane may become a drawer, sheet, or stacked section;
- multi-column cards may stack;
- tables may become prioritized rows/cards while preserving identity/state/action information;
- secondary metadata may collapse behind detail affordances;
- critical approvals and current conversation remain prominent;
- no horizontal scrolling for normal primary workflows at qualified compact widths;
- no separate mobile/tablet visual identity.

The UI SHALL respond to Windows DPI/display scaling and user text scaling without clipping or hiding required actions.

---

## Typography

The primary UI typeface SHALL be **Inter**, packaged with the application or otherwise made release-owned/offline-safe. System fallback is `Segoe UI Variable`, then `Segoe UI`, then a generic sans-serif fallback.

The system SHALL use a restrained hierarchy approximately equivalent to:

```text
Display      40–48 / 600–700
Page title   26–30 / 600–700
Section      18–20 / 600
UI heading   14–16 / 600
Body         14–16 / 400–500
Caption      12–13 / 400–500
```

Exact responsive values may use design tokens, but hierarchy SHALL remain consistent.

All important operational information SHALL remain readable without relying on ultra-small text.

---

## Spacing, shape, and density

The design system SHALL use a 4 px base unit with an 8 px primary spacing rhythm.

Normal component spacing SHOULD use tokenized increments such as `4, 8, 12, 16, 24, 32` logical px.

Normal panel/card corner radius SHOULD remain restrained, typically `8–12` logical px.

Borders SHOULD generally be 1 logical px using derived low-contrast slate/white-alpha tokens.

Heavy shadows, large blur, excessive transparency, glowing borders, animated gradients, and decorative layers SHALL NOT become default structure.

Information density is adaptive:

- wide screens may expose more parallel context;
- compact screens reduce simultaneous detail before reducing readability;
- important operational state never becomes tiny merely to preserve a desktop grid.

---

## Brand and logo rules

The JARVIS symbol is an original geometric mark representing presence, awareness, command, and a stable system core.

Canonical mark construction:

- circular segmented outer ring;
- Brand Blue outer ring;
- Pure White central core/dot;
- Deep Slate/transparent negative space;
- no gradients required;
- no more than three brand colors;
- no status color in the logo;
- no glow/effect required for recognition.

The primary lockup is symbol + uppercase `JARVIS` wordmark.

The mark SHALL remain recognizable at application-icon and small status sizes. Simplification for very small sizes is allowed, but the central core + segmented ring identity SHALL remain.

Brand assets SHALL be stored as release-controlled vector assets. UI code SHALL reference the canonical assets rather than recreate approximate logos ad hoc per screen.

---

## Component language

Core component families SHALL include consistent variants for:

- JARVIS message blocks;
- mission/task cards;
- queue rows/cards;
- approvals;
- status strips/chips;
- system/integration health panels;
- data/artifact/memory/context panels;
- settings/forms;
- dialogs/drawers/sheets;
- voice/listening/speaking state;
- empty/degraded/recovery states.

Components SHALL share the same token system, focus behavior, density rules, and state language.

Approval components SHALL visually distinguish target, environment, action, impact/risk, rollback/backup availability where known, and the exact confirm/cancel choice without ornamental distraction.

---

## State language

System state SHALL always include text/icon semantics in addition to color.

Canonical presentation families include equivalents of:

```text
SUCCESS
IN_PROGRESS
WARNING
ERROR
WAITING
BLOCKED
PAUSED
RECOVERING
UNCERTAIN
CANCELLED
```

Brand Blue is the default active/in-progress accent. Functional semantic tokens may use green/amber/red/violet/gray or equivalent accessible values after contrast qualification.

`UNCERTAIN`, `BLOCKED`, and destructive/critical states SHALL not be visually softened into generic neutral information.

---

## Motion

Motion is functional, short, and optional.

Typical transitions SHOULD complete in approximately 120–200 ms and use non-distracting easing.

Allowed uses include:

- panel/drawer transition;
- focus/context change;
- progress/state change;
- voice listening/speaking indication;
- subtle confirmation of user input.

Continuous ambient animation, decorative particle effects, scanning grids, excessive pulsing, and other theatrical motion are prohibited as default UI identity.

The application SHALL honor reduced-motion accessibility preference by suppressing nonessential animation.

---

## Accessibility

The production UI SHALL target WCAG 2.2 AA-equivalent behavior where applicable to the desktop WebView.

At minimum:

- normal text contrast >= 4.5:1;
- qualifying large text contrast >= 3:1;
- meaningful non-text controls/indicators use qualified contrast;
- color is never the sole indicator of state/risk/action;
- all primary workflows are keyboard operable;
- visible focus is retained and not obscured;
- semantic labels/roles are supplied for assistive technology;
- text/content scaling up to 200% preserves required content/function;
- high-DPI/Windows scaling is qualified;
- touch-oriented layouts use appropriately larger targets;
- user motion preferences are honored.

Accessibility is part of release qualification, not a post-V1 visual enhancement.

---

## Non-goals

V1 does not require:

- light theme;
- multiple selectable brand themes;
- a 3D avatar;
- a constantly animated AI orb;
- fake holographic UI;
- a separate visual identity per integration;
- a dashboard full of metrics unrelated to current user intent;
- maximizing information density at the expense of readability;
- an always-on-top full-screen window.

---

## Consequences

### Positive

- JARVIS has a recognizable product identity before UI implementation diverges.
- Conversation, operations, infrastructure, approvals, and voice feel like one product.
- Responsive behavior is defined as hierarchy adaptation, not screen-specific redesign.
- The dedicated dashboard can be summoned or hidden without coupling UI visibility to Core lifecycle.
- A small brand palette keeps the identity disciplined while semantic colors remain available for operational clarity.

### Costs

- UI changes now require design-token and layout-system discipline.
- Full qualification must cover multiple viewport/DPI/text-scale conditions rather than one development monitor.
- A release-owned font and vector brand assets become packaging inputs.

---

## Governing principle

> **One system. One identity. Any screen.**

> **Clean enough to scan, precise enough to trust, calm enough to live with all day.**
