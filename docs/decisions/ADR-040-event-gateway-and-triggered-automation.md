# ADR-040 — Event Gateway and Triggered Automation

**Status:** Accepted  
**Date:** 2026-08-11

## Context

JARVIS will integrate with external services such as Google Workspace, GitHub, Cloudflare, Microsoft 365, Proxmox, and local system components. These services may produce events that should notify the user or create work. Constant polling is wasteful and can consume API quota, CPU, bandwidth, and rate limits, while direct event-to-action execution would bypass JARVIS's safety architecture.

## Decision

JARVIS SHALL use a centralized Event Gateway for external and local event ingestion.

The Event Gateway SHALL normalize incoming events into a common internal event model before they are processed by JARVIS Core.

Push- or event-driven mechanisms SHOULD be preferred over polling where supported and reliable. Polling MAY be used when required, with service-appropriate intervals, backoff, and rate-limit awareness.

Incoming events SHALL be authenticated or otherwise validated where the source supports verification. Duplicate or replayed events SHOULD be detected and safely deduplicated.

External events MUST NOT bypass the normal task, permission, resource, authorization, and audit systems.

Events that require work SHOULD normally create or update tracked tasks rather than granting an AI worker direct unrestricted execution.

Users SHALL control, per supported integration and event class, whether an event is ignored, recorded, surfaced as a notification, converted into a task, or allowed to invoke an approved automation policy.

Event-driven tasks that cannot start immediately SHALL obey the mandatory queue-transparency rule and remain visible in the work dashboard.

The Event Gateway SHALL support three broad trigger sources:

- push events such as webhooks or subscriptions;
- scheduled checks where reliable push delivery is unavailable;
- local events from JARVIS workers, filesystems, processes, devices, and system state.

## Examples

A GitHub workflow failure may create an investigation task if the user's policy allows automatic investigation. A Cloudflare event may notify the user without allowing DNS changes unless a separate automation and permission policy authorizes that action. Calendar, Gmail, local worker, or deployment events use the same Event Gateway and task architecture.

## Consequences

JARVIS can react proactively without aggressively polling every service. External systems cannot become a backdoor around authorization, resource scheduling, queue visibility, recovery, or audit controls. Event handling remains modular and consistent across integrations.
