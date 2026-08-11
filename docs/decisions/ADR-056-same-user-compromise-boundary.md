# ADR-056 — Same-User Compromise Boundary

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Security boundary clarification  
**Scope:** JARVIS v1.0 production security model

## Context

The JARVIS V1 security contract includes protection against local processes attempting to access exposed IPC, plaintext files, secrets, logs, or artifacts.

That protection remains required, but the contract must not imply a stronger Windows security guarantee than the platform actually provides.

JARVIS V1 is a normal per-user Windows desktop application. Its Rust host, Node Core, workers, secure-store broker, and user-scoped data all operate within the interactive user's Windows security context unless a future decision explicitly introduces a stronger OS isolation boundary.

Windows controls such as named-pipe DACLs, session/logon SIDs, DPAPI, filesystem ACLs, process supervision, randomized IPC endpoints, and application-level authentication materially reduce exposure. They do not, however, create complete secrecy or process isolation from arbitrary malicious code that is already executing with the same effective Windows user and logon identity.

This ADR makes that boundary explicit while preserving all existing hardening requirements.

---

## Decision

JARVIS V1 SHALL distinguish between:

1. threats the application is expected to prevent or materially resist through its own deterministic controls; and
2. a fully active same-user compromise that is outside the hard isolation guarantee of the V1 desktop architecture.

JARVIS SHALL continue to harden against opportunistic or accidental local access wherever Windows and application boundaries permit.

JARVIS V1 SHALL NOT claim robust secrecy or process isolation from arbitrary malicious code already executing with the same effective Windows user and logon identity.

This is a boundary statement, not permission to weaken implementation controls.

---

## In-scope local protections

The V1 production threat model SHALL continue to include and mitigate:

- insecure/default ACLs on JARVIS IPC objects;
- unauthorized access from other Windows users;
- unauthorized access from other logon/session identities;
- remote clients reaching a local privileged endpoint;
- accidental plaintext exposure in files, logs, diagnostics, artifacts, prompts, environment variables, or crash data;
- broad or unnecessary filesystem permissions;
- exposure of credentials or database key material caused by JARVIS itself;
- opportunistic local-process access where object, session, endpoint, protocol, or application-level controls can reject it;
- worker/provider processes receiving more secrets, paths, IPC access, authority, or environment state than their task requires;
- untrusted AI/provider/module content attempting to obtain credentials or bypass authorization;
- replay, confused-deputy, or unauthorized use of an otherwise valid credential.

These protections remain mandatory even though they do not constitute a complete same-user malware sandbox.

---

## Out-of-scope hard isolation guarantee

The V1 application security boundary SHALL explicitly state that JARVIS does not claim robust confidentiality or process isolation against arbitrary malicious code already executing with the same effective Windows user and logon identity.

Such code may possess substantially equivalent operating-system access to user-owned resources and may be able to invoke user-scoped Windows facilities available to that identity.

Examples include a hostile process already running as the same user attempting to:

- read user-accessible files or memory through capabilities available to that user;
- invoke user-scoped DPAPI operations against protected blobs it can obtain;
- observe or manipulate the interactive desktop;
- capture data legitimately displayed, typed, spoken, or made available to the current user;
- abuse user-authorized applications or developer tooling available in the same session.

This limitation SHALL be documented rather than obscured by claims of isolation the architecture does not provide.

---

## DPAPI and secure-storage interpretation

The existing decision to use Windows Credential Manager and/or DPAPI through the Rust host remains valid.

For V1, these mechanisms SHALL be treated primarily as protections for data at rest and against unauthorized identities, offline copying, accidental plaintext persistence, and routine credential handling.

They SHALL NOT be documented as a hard boundary against arbitrary hostile code already executing under the same effective Windows user/logon identity.

The secure-store broker SHALL nevertheless remain narrow and capability-scoped so JARVIS does not make secret access easier than the operating system requires.

Raw long-lived credentials and database key material SHALL continue to be excluded from normal Core persistence, AI context, worker environments, logs, journals, and artifacts.

---

## IPC interpretation

ADR-055 remains fully applicable.

The privileged Host ↔ Core pipe SHALL still use explicit restrictive Windows access control, local-session scoping, remote-client rejection, unpredictable endpoint naming, independent bootstrap authentication, framed protocol validation, and fail-closed behavior.

Those controls protect against broad classes of unauthorized access and accidental exposure.

They SHALL NOT be described as a complete security boundary against arbitrary hostile code already executing with the same effective Windows identity/session.

Application-level bootstrap authentication remains required even when the Windows DACL permits a connection.

---

## Worker and provider implications

This boundary does not reduce containment requirements for AI providers or workers.

Workers and providers SHALL still:

- run non-elevated by default;
- receive allowlisted environment variables only;
- receive only task-required paths and credentials;
- operate inside explicit project/workspace scope;
- use provider-native sandboxing where supported and validated;
- remain under native process supervision;
- be subject to deterministic permission, authority, budget, and tool controls;
- be excluded from direct access to unrelated secure-store entries;
- be prevented from receiving secrets merely because their process runs as the same Windows account.

The governing principle is exposure minimization even when perfect same-user isolation is unavailable.

---

## V1 architecture decision

JARVIS V1 SHALL NOT introduce a privileged Windows service, separate service account, mandatory AppContainer architecture, VM boundary, or equivalent new isolation tier solely to claim protection against arbitrary same-user malware.

Such a change would materially alter deployment, installation, lifecycle, update, recovery, IPC, debugging, provider/tool compatibility, and threat-model complexity.

A stronger OS isolation architecture MAY be introduced by a future ADR if concrete implementation evidence demonstrates that a specific high-value capability requires it and the production benefit justifies the cost.

Potential triggers for reconsideration include:

- storing or exercising credentials whose compromise has materially higher consequence than normal user-account compromise;
- exposing administrative or infrastructure-control capabilities that require a separate principal;
- adding remote/LAN control surfaces;
- introducing always-on privileged services;
- supporting multi-user Windows hosts with stronger tenant separation requirements;
- evidence from security testing that the current per-user boundary is insufficient for a required production capability.

---

## Verification requirements

Security verification SHALL distinguish the following cases instead of collapsing them into one claim:

### Data at rest

Tests SHALL verify that copied database/backup/secret files do not expose plaintext protected content without the required Windows/application key path.

### Unauthorized identity/session

Tests SHALL verify that other users, other logon/session identities, and remote clients cannot access privileged JARVIS IPC or protected application objects when those boundaries are applicable.

### Same-user active compromise

Documentation and tests SHALL NOT claim that successful protection against another user/session proves isolation from arbitrary code already running under the same effective user/logon identity.

Security reports SHALL describe same-user protections as defense-in-depth/exposure-minimization controls unless a future explicitly verified isolation mechanism provides a stronger guarantee.

---

## Consequences

### Positive

- The threat model matches the actual Windows desktop architecture.
- JARVIS keeps strong practical hardening without claiming impossible guarantees.
- DPAPI, SQLCipher, ACLs, IPC authentication, worker scoping, and secret minimization retain clear value.
- The project avoids introducing a privileged service or separate identity before a concrete requirement justifies it.
- Future security reviews can distinguish at-rest protection, unauthorized-session protection, and active same-user compromise.

### Trade-offs

- V1 does not provide a hard isolation boundary against arbitrary hostile code already running as the same user/session.
- Endpoint compromise of the user's Windows account remains a serious system-level risk.
- Some future high-value capabilities may require revisiting the process/security-identity architecture.

---

## Governing Principle

> **Harden every boundary JARVIS actually controls, and never claim a stronger boundary than the operating system and implementation truly provide.**
