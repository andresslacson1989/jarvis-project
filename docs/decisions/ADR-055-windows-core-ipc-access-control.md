# ADR-055 — Windows Core IPC Access Control

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Security hardening  
**Scope:** JARVIS V1 privileged Rust Host ↔ Core IPC boundary

## Context

JARVIS V1 uses a Windows named pipe or equivalent non-network local IPC transport between the Rust native host and the Node.js/TypeScript Core. The existing runtime contract already requires an unpredictable per-launch endpoint name, an independently generated bootstrap authentication secret, framed protocol messages, version checks, and schema validation.

Those controls are necessary but do not by themselves define the Windows object-level access policy for the named pipe.

Windows named pipes are securable kernel objects. If a custom security descriptor is not supplied, Windows applies a default descriptor whose access is broader than is appropriate for the JARVIS privileged control plane. Windows also supports explicit rejection of remote named-pipe clients.

Because this IPC channel is part of the principal local control plane for missions, tools, credentials, providers, and consequential actions, JARVIS SHALL fail closed at the operating-system access boundary before protocol authentication is reached.

This ADR adopts the approved production-hardening decision without changing the overall process topology.

---

## Decision

The V1 privileged Core IPC server SHALL use an explicit Windows security descriptor and SHALL NOT rely on the default named-pipe security descriptor.

The named pipe SHALL be created as a local-only endpoint and SHALL reject remote clients at pipe creation.

The IPC boundary SHALL preserve all existing application-layer authentication and protocol validation. Windows ACL enforcement is an additional layer, not a replacement.

---

## Required Windows access-control behavior

For the privileged Host ↔ Core named pipe:

1. the Rust host SHALL create the server endpoint with an explicit `SECURITY_DESCRIPTOR` / DACL;
2. the DACL SHALL grant only the access rights required for the intended JARVIS client/server exchange;
3. the current JARVIS user's **logon SID/session identity** SHALL be used as the primary interactive-session access boundary;
4. access SHALL NOT be granted to `Everyone`, anonymous users, unrelated interactive sessions, or network users;
5. `PIPE_REJECT_REMOTE_CLIENTS` or an equivalent Windows-enforced local-only mechanism SHALL be enabled;
6. broad generic rights SHALL NOT be used when narrower pipe rights are sufficient, particularly where a broad right could unintentionally include `FILE_CREATE_PIPE_INSTANCE`;
7. additional system principals such as `LOCAL SYSTEM` MAY be granted access only if the packaged runtime demonstrably requires them; they SHALL NOT be added by default merely for convenience;
8. the pipe security descriptor SHALL be constructed deterministically by trusted native code, never from AI-generated or module-provided ACL text;
9. failure to resolve the current logon identity, construct the required descriptor, apply the DACL, or enforce local-only semantics SHALL fail Core bootstrap closed;
10. a security fallback that silently creates the pipe with default Windows permissions is prohibited.

---

## Existing controls remain mandatory

The following existing controls remain independent requirements:

- unpredictable cryptographically random per-launch pipe name;
- bootstrap authentication secret generated with a cryptographically secure RNG;
- bootstrap secret transferred through an inherited/anonymous secure bootstrap channel rather than command-line arguments;
- Core/Host authentication before normal messages are accepted;
- framed bounded messages;
- protocol-version validation;
- schema validation;
- typed errors;
- renderer prohibition from opening the Core pipe directly.

A process that passes the Windows object access check SHALL still have to pass JARVIS bootstrap authentication and protocol validation.

---

## Intended boundary

Conceptually the privileged path is:

```text
Client process
    ↓
Windows named-pipe DACL / logon-session check
    ↓
remote-client rejection
    ↓
unpredictable per-launch endpoint
    ↓
bootstrap authentication
    ↓
protocol/version/schema validation
    ↓
JARVIS Core
```

Failure at any required layer SHALL deny privileged Core access.

---

## Session scope

The named-pipe DACL SHALL be scoped to the intended JARVIS interactive logon session rather than merely to a broad machine-level user group.

This is intended to prevent a process in another Windows interactive or Terminal Services session from gaining access simply because it runs on the same computer.

This decision does **not** claim that a DACL can fully isolate JARVIS from arbitrary malicious code already executing with the same effective Windows logon identity. That threat-model limitation is handled separately and SHALL not be obscured by this ADR.

---

## Native-host ownership

The Rust native host remains authoritative for:

- creating the privileged Core IPC endpoint;
- resolving the Windows logon/session identity needed for the DACL;
- creating/applying the Windows security descriptor;
- enabling local-only pipe behavior;
- launching the Core;
- transferring bootstrap material;
- rejecting bootstrap when the security boundary cannot be established.

The Node Core SHALL NOT weaken or recreate this privileged endpoint using less restrictive settings.

---

## Verification requirements

Production qualification SHALL include automated or deterministic Windows tests that prove at least:

1. the pipe has an explicit security descriptor rather than the Windows default descriptor;
2. the intended JARVIS Core client can connect and complete bootstrap;
3. an unauthorized security principal cannot open the pipe;
4. a process from an unrelated interactive/logon session is rejected where the test environment supports creation of that session;
5. a remote named-pipe connection attempt is rejected before JARVIS protocol authentication;
6. malformed or absent bootstrap credentials are rejected even when the OS identity is otherwise permitted;
7. failure to apply the required DACL prevents normal Core startup;
8. diagnostics do not log bootstrap secrets or security-sensitive ACL material beyond safe identity/status metadata.

The release test SHALL verify behavior, not only inspect configuration source code.

---

## Consequences

### Positive

- closes a real OS-level access-control gap at the principal local control-plane boundary;
- prevents reliance on Windows default named-pipe permissions;
- blocks remote named-pipe clients by construction;
- reduces exposure across unrelated Windows sessions;
- adds defense in depth without changing JARVIS architecture;
- adds negligible runtime overhead.

### Cost

- requires native Windows security-descriptor construction and logon-SID resolution in Rust/native bindings;
- requires Windows-specific integration tests;
- requires careful least-privilege access-mask selection.

These costs are accepted because the boundary is security-critical and already Windows-specific in V1.

---

## Non-goals

This ADR does not:

- introduce localhost TCP, HTTP, gRPC, LAN, or remote Core APIs;
- replace the bootstrap secret;
- claim protection from a fully compromised administrator/kernel;
- claim full isolation from arbitrary malicious code already executing under the same effective Windows logon identity;
- change Tauri/React/Rust/Node process topology;
- introduce a separate Windows service account.

---

## Governing Principle

> **The privileged JARVIS control plane should reject an unauthorized process at the earliest enforceable boundary, then authenticate and validate it again at the application boundary.**
