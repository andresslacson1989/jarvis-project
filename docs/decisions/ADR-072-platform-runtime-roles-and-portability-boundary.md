# ADR-072 — Platform Runtime Roles and Portability Boundary

**Status:** Accepted  
**Date:** August 12, 2026  
**Decision scope:** Windows/Linux full-host portability, platform capability boundaries, runtime roles, future companion architecture, and V1 scope preservation

---

## Context

JARVIS V1 is a Windows application with deliberately strong Windows-specific mechanisms: Tauri/WebView2, Rust native supervision, Windows secure storage, restrictive named-pipe IPC, Job Objects, Windows session lock handling, and bounded UAC elevation for qualified provider setup.

The product is also expected to become a full JARVIS host on Linux in the future. A future Android application is expected to be a narrower companion/dashboard/prompting surface that obtains authoritative state and execution from a Windows or Linux host rather than reproducing the full worker/provider/control-plane runtime on the phone.

The existing architecture did not prohibit this direction, but it also did not require implementation to preserve it. Without a binding portability boundary, Windows implementation details could legally spread through shared Core/domain/UI code and create unnecessary future Linux rework.

Two bad approaches were rejected:

1. **Lowest-common-denominator portability** — weaken Windows-native security/process mechanisms so all platforms use the same primitive.
2. **Full Android host parity** — require mobile to run the authoritative database, engineering workers, providers, local tooling, and infrastructure adapters merely for conceptual symmetry.

Both increase risk/complexity without product value.

---

## Decision

The current contract advances to **JARVIS Contract Suite v1.0.4**.

### Runtime roles

JARVIS distinguishes platform identity from runtime responsibility:

```text
FULL_HOST
COMPANION
```

The product direction is:

```text
Windows  → FULL_HOST → V1 production target
Linux    → FULL_HOST → future production target
Android  → COMPANION → future non-V1 client
```

Windows remains the only V1 production target. This ADR does not add Linux or Android implementation scope to V1.

### Platform capability boundary

Shared Core/domain/policy/UI logic shall depend on semantic platform capabilities, not scattered Windows/Linux implementation details.

Platform responsibilities include secure storage, local IPC, process supervision, session observation, native windowing, notifications, platform paths/identity, audio/device integration, updates, and narrowly bounded privilege mediation.

Windows continues to use the strongest qualified Windows mechanisms. Linux later must implement and qualify its own mechanisms against the same semantic/security invariants.

### No lowest-common-denominator rule

Portability shall not weaken a stronger supported platform. If a future platform cannot meet an invariant, the affected capability remains unsupported until it can be implemented safely.

### Companion boundary

A future companion may present dashboard state, conversation, notifications, approvals, mission controls, and selected authorized commands, but it is not an authoritative host.

The full host remains authoritative for state, credentials, workers, providers, tools, integrations, permissions, budgets, and consequential execution.

A future companion connection requires a separately threat-modeled Remote Access Gateway. V1's existing prohibition on exposing privileged Core through a LAN/Internet control API remains unchanged.

---

## Consequences

### Positive

- Windows V1 keeps its strong production mechanisms.
- Shared implementation cannot casually accumulate Win32-only dependencies.
- Linux can later become a full host without redesigning mission, permission, provider, integration, or UI semantics.
- Android does not impose desktop/runtime parity requirements.
- Future companion work has a clear security boundary rather than an ad-hoc Core API.
- Product identity remains unified while native mechanisms remain platform-appropriate.

### Costs

- Phase 0/1 implementation must establish platform capability interfaces/composition boundaries before feature code proliferates.
- CI must enforce shared-versus-platform import rules.
- Some native-provider/tool qualification becomes platform-specific.
- Future Linux production support still requires substantial independent qualification; portability architecture is not a claim that Linux is already supported.

These costs are justified because they prevent avoidable architecture lock-in without adding speculative V1 platform scope.

---

## Rejected alternatives

### Make Linux a V1 target

Rejected. It would multiply packaging, security, provider, voice, filesystem, and release qualification before the Windows product exists.

### Make Android a full host

Rejected. Mobile is better treated as a future trusted interaction surface for an authoritative host.

### Defer all portability decisions until after Windows ships

Rejected. Platform boundaries are cheapest and most reliable to establish before shared Core/native code becomes entangled.

---

## Governing principle

> **Abstract the capability, not the security away.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**
