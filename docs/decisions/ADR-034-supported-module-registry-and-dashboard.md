# ADR-034 — Supported Module Registry and Dashboard

**Status:** Accepted
**Date:** 2026-08-11

## Context

JARVIS is intentionally modular across AI, speech, audio processing, tools, and future capabilities. A user-facing management surface is required so users can understand what modules are available, what is installed, what is enabled, and what JARVIS is allowed to use.

An unrestricted plugin marketplace or arbitrary module discovery model would create avoidable compatibility, security, support, and reliability risks.

## Decision

JARVIS SHALL provide a centralized Module Registry and user-facing module-management dashboard.

By default, the dashboard SHALL list only modules and providers that are explicitly supported by the JARVIS project for the current platform/version.

Supported modules MAY be shown whether or not they are installed, so the user can see available capabilities and choose to install them.

For each supported module, JARVIS SHOULD expose clear user actions appropriate to its state, including where applicable:

- Install
- Enable
- Disable
- Configure
- Set as preferred
- Test/health check
- Update
- Remove

The following states SHALL remain distinct:

- supported
- installed
- enabled
- preferred
- authorized
- healthy

Installing a module MUST NOT implicitly enable it, grant it permission to receive user data, authorize privileged actions, or make it the preferred provider.

The Module Registry SHALL be the canonical source of normalized metadata used by the dashboard, Provider Supervisor, Resource Manager, and configuration system. Metadata SHOULD include identity, version, module type, capabilities, platform compatibility, resource requirements, and health information where available.

The dashboard, voice interface, and other control surfaces SHALL modify the same underlying configuration service so JARVIS does not maintain parallel configuration systems.

Module installation and updates SHALL use controlled, defined installers and verification procedures rather than arbitrary AI-generated shell commands. Supported installers SHOULD define source, version, dependencies, destination, integrity verification, post-install health verification, uninstall behavior, and rollback strategy where practical.

Updates SHOULD be validated before activation and SHOULD preserve a rollback path for important providers when practical.

Unsupported or manually added modules SHALL NOT appear as first-class supported choices by default. Future support for advanced/manual extension mechanisms MAY be added separately, but such mechanisms MUST be explicitly distinguished from officially supported modules.

## Rationale

This keeps JARVIS modular without turning the core product into an uncontrolled plugin marketplace. Users retain clear control over installation and usage while the project maintains compatibility, security, and support boundaries.

## User Experience Principle

JARVIS should show users the supported capabilities they can safely add, install, and configure—not an open-ended list of arbitrary software.
