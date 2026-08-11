# ADR-035 — Versioned, Staged Module Updates and Rollback

**Status:** Approved
**Date:** 2026-08-11

## Context

JARVIS supports modular providers and capabilities that may be installed and updated independently. Replacing a working provider in place creates avoidable production risk: a new release may be incompatible, unhealthy, misconfigured, or otherwise regress a previously stable system.

## Decision

JARVIS SHALL manage supported module updates through versioned, reversible installations rather than destructive in-place replacement.

New module versions SHALL be verified, installed in a staged state, compatibility-checked, and health-tested before becoming active.

The previously working version SHOULD remain available for rollback until the replacement has been proven healthy.

JARVIS SHALL distinguish between upstream versions that merely exist and versions explicitly approved by the JARVIS Supported Module Registry for the user's platform and JARVIS release.

Users MAY pin module versions and configure update policy. Supported policies MAY include manual updates, notify-only behavior, and approved automatic updates for sufficiently low-risk modules.

Breaking or security-sensitive updates MUST surface their impact before activation. Core voice, AI, security, and infrastructure providers SHOULD default to explicit notification/approval rather than silent replacement.

Provider activation SHOULD occur only at a safe lifecycle boundary. Active tasks SHOULD NOT be disrupted by replacing their provider underneath them.

A failed update MUST NOT leave JARVIS without the previously working module whenever rollback is technically possible.

## Reference lifecycle

1. Detect an approved update in the Supported Module Registry.
2. Download from the defined source.
3. Verify integrity and expected package metadata.
4. Install alongside the currently active version.
5. Run compatibility and health checks.
6. Activate only after successful validation and at a safe lifecycle boundary.
7. Retain the previous working version as a rollback target.
8. Roll back automatically or with user action when activation proves unhealthy, according to policy.

## User-facing states

The dashboard SHOULD distinguish at least:

- active version
- available approved version
- staged version
- previous/rollback version
- pinned version
- update/validation failure

## Rationale

JARVIS should upgrade like a reliable appliance: upgrades must be controlled, observable, validated, and reversible rather than overwriting working components and hoping they remain compatible.
