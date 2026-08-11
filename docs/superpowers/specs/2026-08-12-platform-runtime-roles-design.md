# JARVIS Platform Runtime Roles Design

**Status:** Approved design input for Contract Suite v1.0.4  
**Date:** 2026-08-12

## Goal

Preserve production-quality Windows implementation while preventing unnecessary Windows lock-in, make Linux an explicit future full JARVIS host, and keep Android as a future companion rather than forcing mobile to reproduce the desktop control plane.

## Approved model

```text
JARVIS FULL HOST
  Windows — V1
  Linux   — future

Owns:
  authoritative Core/state
  providers/workers/tools
  integrations/credentials
  permissions/approvals
  automation/budgets/recovery

JARVIS COMPANION
  Android — future

Provides:
  dashboard/read models
  conversation/prompting
  notifications
  mission monitoring
  approvals
  selected authorized controls

Does not own:
  authoritative state
  host credentials
  engineering worker runtime
  infrastructure adapters
  full provider/tool control plane
```

## Design rules

1. Platform and runtime role are separate concepts.
2. Shared domain/policy/protocol/UI semantics stay platform-neutral where practical.
3. Native OS mechanisms sit behind explicit platform capability interfaces/composition.
4. Windows keeps DPAPI, named pipes, Job Objects, Windows session APIs, WebView2/Tauri behavior, and bounded UAC where those are the strongest qualified mechanisms.
5. Linux later uses independently qualified Linux mechanisms rather than forcing a weak shared implementation.
6. Unsupported platform capability remains unavailable; there is no unsafe portability fallback.
7. Provider/tool/module support may differ by platform and is qualified independently.
8. Android companion does not become a second authoritative JARVIS host.
9. Future companion networking requires explicit device/host identity, enrollment, encryption, replay resistance, revocation, remote authority policy, audit, and a separate gateway boundary.
10. V1 scope remains Windows-only.

## Alternatives considered

### A. Windows-only architecture until after V1

Lowest immediate work, highest future entanglement risk. Rejected because platform boundary decisions are cheap before implementation and expensive after native APIs leak through Core.

### B. Fully cross-platform V1

Strong portability immediately, but doubles/triples qualification work before product proof. Rejected as unjustified V1 scope.

### C. Windows V1 + Linux-preserving full-host boundary + future companion

Chosen. It keeps V1 focused while making the most consequential portability decisions early.

## Security position

Portability is not a reason to reduce native security. Platform abstractions define semantics and required guarantees; implementations use the strongest qualified mechanism available. A platform that cannot meet an invariant does not receive that capability.

## Verification position

V1 must verify architecture boundaries and Windows behavior. Linux production/runtime tests are not V1 release gates. Future Linux/companion support requires separate release qualification before support claims.

## Scope

This design changes the contract architecture only. It does not authorize application implementation, Linux implementation, Android implementation, or remote-access implementation.
