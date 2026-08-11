# JARVIS Platform Portability & Runtime Roles Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.4.md`  
**Version:** 1.0.4  
**Date:** August 12, 2026  
**Adopted by:** ADR-072

---

# 1. PURPOSE

This contract defines the platform architecture that allows JARVIS to be production-grade on Windows now, become a full JARVIS host on Linux later, and support future companion clients without weakening the full-host trust model.

It is a portability contract, not a requirement to implement every platform in V1.

The governing rule is:

> **Windows production quality now. Linux portability through explicit platform boundaries. Companion clients never become host authority.**

---

# 2. PRODUCT RUNTIME ROLES

JARVIS distinguishes operating-system/platform identity from runtime responsibility.

Canonical runtime roles are:

```text
FULL_HOST
COMPANION
```

`FULL_HOST` owns the authoritative JARVIS control plane, including the Core, authoritative persistence, providers, workers, tools, integrations, automation, credentials, permissions, approvals, budgets, recovery, and local execution.

`COMPANION` is a non-authoritative interaction surface that may later present host state, conversation, notifications, approvals, and selected authorized controls through a separately qualified remote-access boundary.

Runtime role SHALL NOT be inferred solely from screen size or operating-system name.

---

# 3. PLATFORM INTENT

The product direction is:

```text
Windows  → FULL_HOST → mandatory V1 production target
Linux    → FULL_HOST → explicit future production target
Android  → COMPANION → future non-V1 interaction client
```

Only Windows 11 x64 is part of the active V1 Release Profile.

Linux is an architectural preservation target, not a V1 delivery requirement. Android companion capability is also not a V1 delivery requirement.

No current V1 release may claim Linux or Android production support without a future synchronous Release Profile, security, verification, packaging, and compatibility update.

---

# 4. FULL-HOST ARCHITECTURE

The logical full-host topology is platform-neutral:

```text
JARVIS Mission Control UI
        ↓
Tauri/Rust Platform Host
        ↓
Authenticated Local Core Transport
        ↓
Application-owned Node/TypeScript JARVIS Core
        ↓
Providers / Tools / Workers / Integrations / Managed Modules
```

The semantic responsibilities remain the same across full-host platforms. The native mechanisms used to satisfy those responsibilities are platform backends.

Windows-specific mechanisms are therefore V1 backend implementations, not domain concepts.

---

# 5. SHARED VERSUS PLATFORM-SPECIFIC CODE

Shared code SHALL include, where practical and semantically valid:

- mission/task/attempt state and graph semantics;
- PermissionEngine and Authority Envelope rules;
- approval/risk semantics;
- DataPolicy and exact money;
- provider/integration/module contracts;
- context/memory logic;
- scheduler policy independent of OS resource probes;
- protocol/schema/domain types;
- conversation and operational state;
- brand/design tokens and reusable Mission Control components;
- persistence logical schema and backup-container semantics;
- verification policy that does not name an OS primitive unnecessarily.

Platform-specific code SHALL own mechanisms such as:

- secure local secret storage;
- local privileged IPC transport and peer identity;
- process-tree lifecycle/resource containment;
- session lock/sign-out observation;
- native window lifecycle and monitor/work-area behavior;
- native notifications where used;
- platform paths and filesystem identity/canonicalization details;
- local audio/device integration details where OS-specific;
- installer/update activation;
- elevation/privilege mediation;
- platform-specific provider setup behavior.

Shared Core/domain code SHALL NOT directly depend on Win32, Windows registry, DPAPI, Windows named-pipe, Job Object, HWND, SID, UAC, Linux-specific cgroup/session/keyring, or equivalent native implementation APIs.

---

# 6. PLATFORM CAPABILITY BOUNDARY

Full-host native functionality SHALL be exposed through explicit capability interfaces or equivalent typed service boundaries.

The architecture SHALL provide responsibilities equivalent to:

```text
PlatformSecureStorage
PlatformLocalIpc
PlatformProcessSupervisor
PlatformSessionObserver
PlatformWindowController
PlatformNotificationBackend
PlatformPathsAndIdentity
PlatformAudioBackend
PlatformUpdateBackend
PlatformPrivilegeMediator
PlatformSystemInfo
```

Exact interface names may differ, but feature/domain code SHALL depend on the semantic capability rather than the operating-system mechanism.

Capabilities SHALL report availability/qualification honestly. An unsupported capability is unavailable; it is not emulated through a weaker unsafe fallback merely to create platform parity.

---

# 7. COMPOSITION ROOT

Operating-system selection SHALL occur at a narrow application/platform composition boundary.

Scattered checks equivalent to:

```text
if windows ...
else if linux ...
```

inside domain, permission, mission, integration, memory, or general feature code are prohibited when a platform capability interface can express the dependency.

Platform detection is permitted in:

- startup/composition;
- platform adapter factories;
- packaging/configuration;
- explicitly platform-specific providers/tools/tests.

---

# 8. NO LOWEST-COMMON-DENOMINATOR SECURITY

Cross-platform design SHALL NOT weaken a stronger production platform because another platform lacks the same primitive.

The correct model is:

```text
shared semantic invariant
        ↓
platform-qualified implementation
```

not:

```text
weakest common mechanism
        ↓
all platforms
```

If Linux cannot satisfy a required full-host security or recovery invariant with a qualified mechanism, the affected capability remains unsupported on Linux until the invariant can be met. Windows behavior SHALL NOT be weakened to make Linux implementation easier.

---

# 9. WINDOWS FULL-HOST BACKEND

For the active V1 Windows full host, the current Runtime, Security, Data, and Release Profile requirements remain binding.

Windows mappings include, as applicable:

```text
secure storage       → Windows-backed secure storage / DPAPI boundary
local Core IPC       → restrictive authenticated Windows named pipe
process supervision  → Windows Job Objects + owned native process handles
session observation  → Windows lock/sign-out/session facilities
privilege mediation  → narrow UAC/elevation paths only where qualified
window host          → Tauri/Windows native window APIs
WebView              → qualified Windows WebView2/Tauri stack
```

These mappings are not placeholders. They remain full production requirements for Windows V1.

---

# 10. FUTURE LINUX FULL-HOST BACKEND

Linux is an explicit future full-host target.

A Linux production release SHALL preserve the same high-level authority, recovery, process ownership, secure-storage, local-IPC, UI, provider, tool, integration, and verification semantics while using separately qualified Linux-native implementations.

The current contract intentionally does not prematurely choose exact Linux technologies for every backend. A future Linux Release Profile SHALL select and qualify them based on the actual supported distributions, desktop/session environment, packaging model, provider behavior, and security properties at that time.

Linux production support SHALL NOT be inferred merely because Tauri, Node, Rust, React, SQLite, or a provider can launch on Linux.

---

# 11. PLATFORM-SPECIFIC RELEASE SUPPORT

Support is a tuple, not a global boolean:

```text
JARVIS release
+ PlatformFamily
+ RuntimeRole
+ CPU architecture
+ native backend profile
+ provider/integration support matrix
```

A provider/module/tool/integration may be supported on Windows and unsupported on Linux, or vice versa.

UI SHALL expose platform-specific support truthfully where it matters rather than implying that modeled capability equals qualified capability.

---

# 12. PROVIDER QUALIFICATION

Provider qualification is platform-specific whenever executable, sandbox, setup, filesystem, process, network, credential, or device behavior differs by platform.

Windows Codex qualification does not automatically qualify Codex on Linux.

A future Linux Codex/provider profile SHALL separately qualify:

- exact distribution/version;
- setup requirements;
- process containment;
- filesystem read/write boundary;
- network behavior;
- cancellation;
- environment/credential exposure;
- structured interface behavior;
- resume behavior;
- provider-specific security limitations.

The common Provider interface remains shared.

---

# 13. FILESYSTEM AND PATH IDENTITY

Domain code SHALL treat filesystem identity through canonical platform-aware path/resource abstractions.

Windows path semantics such as drive letters, UNC paths, junctions, reparse points, case behavior, and alternate roots remain required Windows checks but SHALL NOT define the generic Project/Workspace protocol.

A future Linux backend SHALL provide its own canonicalization and escape protections for Linux path/symlink/mount/filesystem semantics.

Persisted project/workspace records MAY store platform-native path text where required, but SHALL also retain enough platform identity/metadata to avoid interpreting a path under the wrong platform semantics.

---

# 14. SECURE STORAGE

Core/domain state SHALL use opaque credential/key handles and a semantic secure-storage interface.

The Windows backend uses the qualified Windows secure-storage design from the Security/Data contracts.

A future Linux backend SHALL use a separately qualified local secret-storage/key-protection design appropriate to the supported Linux environment.

Raw secret material SHALL NOT be moved into Core/domain state merely to make storage portable.

---

# 15. LOCAL IPC

Core control transport is a semantic local privileged channel, not permanently synonymous with Windows named pipes.

The Windows V1 backend SHALL continue using the restrictive authenticated named-pipe design.

A future Linux full host SHALL use a separately qualified local IPC mechanism providing equivalent required properties such as:

- local-only transport;
- restrictive peer access;
- authenticated/bootstrap-bound application peer;
- bounded versioned framing;
- remote-network rejection;
- clear lifecycle/cleanup semantics.

The privileged Core SHALL NOT be converted to localhost HTTP merely to make Windows/Linux code look identical.

---

# 16. PROCESS SUPERVISION

`PlatformProcessSupervisor` semantics include:

- owned child/process-tree lifecycle;
- bounded cancellation and termination;
- no untracked authoritative detached processes;
- minimum handle/descriptor inheritance;
- resource accounting/limits where required and available;
- crash/shutdown cleanup evidence;
- honest containment claims.

Windows fulfills the V1 containment requirement with Job Objects and related native process controls.

Linux later SHALL use separately qualified mechanisms capable of meeting the same semantic requirements. Job Objects SHALL not appear in shared domain types or APIs as though they were the universal concept.

---

# 17. SESSION TRUST

The shared session model is `LOCKED`/`UNLOCKING`/`UNLOCKED`/`LOCKING` and the corresponding privacy/authority behavior.

Windows session lock/sign-out is one backend signal source.

A future Linux full host SHALL map supported desktop/session lock/logout behavior into the same JARVIS session-trust semantics and document limitations for each supported environment.

---

# 18. WINDOW AND UI PORTABILITY

Mission Control identity, state language, information hierarchy, design tokens, and reusable React component semantics are shared product behavior.

Native window lifecycle is platform-backed.

Windows V1 retains the dedicated primary window, monitor recovery, full-screen, focus-discipline, and accessibility requirements already defined.

A future Linux desktop release SHALL preserve the same product identity and equivalent user-facing behavior while permitting native platform differences that do not alter security, authority, truthfulness, or core interaction semantics.

Platform-native affordances MAY differ; JARVIS SHALL NOT fork into unrelated Windows and Linux product identities.

---

# 19. PERSISTENCE AND PORTABLE STATE

Logical persistence/state-machine schemas SHOULD remain platform-neutral unless the stored fact is inherently platform-specific.

Shared durable records SHALL NOT casually persist Windows-native handles, HWNDs, access tokens, raw SIDs, registry handles, process handles, or Linux-native descriptors as domain identity.

Platform-specific metadata SHALL be typed/namespaced and treated as non-portable unless explicitly qualified otherwise.

`PORTABLE_STATE` backup encryption remains independent of the historical live local secure-store key. The current V1 guarantee is Windows clean-profile restore. Cross-platform Windows↔Linux state migration/restore is **not** guaranteed until a future release explicitly qualifies schema, filesystem paths, provider/setup state, artifacts, and platform-specific metadata migration.

The backup format SHALL NOT be redesigned to require Windows-only secret material for its portable recovery slot.

---

# 20. UPDATE AND PACKAGING

Release artifacts are platform-specific.

A Windows installer/update artifact is never treated as a Linux artifact and vice versa.

Shared source/version identity MAY produce multiple platform artifacts, but every artifact has its own:

- platform/architecture identity;
- native runtime dependencies;
- signing/integrity metadata;
- provider/native-backend support matrix;
- qualification report.

A future Linux packaging decision SHALL be made through the normal contract/ADR process when concrete supported distributions/package formats are selected.

---

# 21. MODULES AND INTEGRATIONS

Integration semantic capabilities SHOULD remain platform-neutral when the remote service semantics are platform-independent.

Local tool/module/provider implementations MAY be platform-specific.

Module manifests SHALL be capable of declaring platform/runtime-role compatibility without treating installation as support.

A module qualified only for Windows cannot be labeled supported on Linux merely because its package can be copied there.

---

# 22. VOICE AND DEVICES

Conversation/voice state semantics and DataPolicy remain shared.

Microphone, speaker, AEC/device APIs, local model packaging, acceleration, and provider availability may be platform-specific.

A future Linux full-host release SHALL separately qualify actual audio-device lifecycle, latency, AEC, STT/TTS, GPU/runtime, privacy, and packaging behavior.

---

# 23. FUTURE COMPANION ROLE

A future companion application is intentionally narrower than a full host.

Expected companion capability classes may include:

```text
host status/dashboard viewing
conversation / prompting
voice prompting
notifications
mission/task monitoring
approval presentation and decision
pause/resume/cancel/reprioritize selected work
selected policy-permitted controls
```

A companion SHALL NOT own the authoritative mission database, host credentials, worker runtime, infrastructure adapters, or general provider/tool execution merely because it presents those controls.

The authoritative full host evaluates all consequential companion-originated instructions through the same authentication, authority-envelope, PermissionEngine, approval, DataPolicy, budget, and verification rules as local instructions, with additional remote-device policy where required.

---

# 24. ONE AUTHORITATIVE HOST

A companion does not create a second authoritative copy of JARVIS state.

It MAY cache bounded presentation/read data, but cached companion state is never authoritative for consequential decisions.

Multi-host federation, distributed consensus, automatic host failover, or synchronized multi-master JARVIS state are not implied by companion support and require separate future architecture.

---

# 25. FUTURE REMOTE-ACCESS GATEWAY

V1 retains the rule that privileged Core is not exposed through a LAN/Internet HTTP control plane.

A future companion SHALL communicate through a separately designed and qualified Remote Access Gateway or equivalent boundary, not direct arbitrary Core access.

Before companion remote control is enabled, a future contract SHALL define at minimum:

- explicit host/device enrollment;
- cryptographic host and device identity;
- authenticated encrypted transport;
- replay resistance;
- session expiration/re-authentication;
- device revocation/lost-device handling;
- per-device capability/authority policy;
- rate/abuse limiting;
- local versus remote instruction provenance;
- approval provenance and final-confirmation rules;
- notification privacy;
- network exposure and discovery model;
- secure update compatibility;
- audit evidence;
- offline/stale-state behavior.

No current implementation work is authorized to invent this gateway ad hoc.

---

# 26. PLATFORM CAPABILITY DISCOVERY

Shared code MAY query semantic platform capability availability, for example:

```text
secure_storage
local_ipc
managed_process_tree
session_lock_observation
native_window_control
notifications
voice_capture
voice_output
hardware_acceleration
platform_update
```

Capability discovery SHALL be deterministic/application-owned and SHALL NOT grant authority. It only determines technical availability/qualification.

A missing capability blocks/degrades the dependent feature truthfully.

---

# 27. ERROR AND DIAGNOSTIC MODEL

Platform failures SHALL normalize to stable JARVIS errors/reason codes while retaining sanitized platform-specific diagnostics internally.

Examples include:

```text
PLATFORM_CAPABILITY_UNAVAILABLE
PLATFORM_BACKEND_UNQUALIFIED
PLATFORM_SECURE_STORAGE_FAILED
PLATFORM_IPC_SECURITY_FAILED
PLATFORM_PROCESS_CONTAINMENT_FAILED
PLATFORM_SESSION_OBSERVER_FAILED
PLATFORM_UPDATE_FAILED
```

Feature/UI code SHALL not parse Win32/Linux human-readable error text to make security or authority decisions.

---

# 28. TESTING AND ARCHITECTURE ENFORCEMENT

Before V1 implementation progresses beyond the foundation, CI SHALL prove at least:

- shared Core/domain/policy packages do not import Windows-native implementation modules;
- platform-specific code is reachable through explicit platform composition/capability boundaries;
- Windows native backends still pass all current Windows release gates;
- unsupported platform capability produces explicit unavailable/degraded behavior rather than unsafe fallback;
- design-system/shared UI code does not require Windows-only visual components for core semantics;
- portable backup format does not require DPAPI for the portable recovery slot;
- provider support remains platform-qualified rather than globally inferred.

Linux runtime tests are not required to pass V1 Production Complete unless a Linux profile is explicitly promoted by a future Release Profile.

---

# 29. FUTURE LINUX PRODUCTION PROMOTION

Linux becomes a production-supported full host only through a future synchronous contract change that defines:

- supported distributions/releases and CPU architectures;
- desktop/session assumptions where applicable;
- secure-storage backend;
- local IPC backend;
- process containment/resource-control backend;
- filesystem/path canonicalization;
- installer/package/update model;
- WebView/Tauri runtime qualification;
- provider support matrices;
- voice/device support;
- SQLite/SQLCipher/native dependency packaging;
- integration/tool/module differences;
- clean install, update, recovery, backup/restore, performance, soak, and security qualification.

Until then Linux is an architectural target, not a supported product claim.

---

# 30. NON-GOALS

This contract does not require V1 to:

- build or ship Linux artifacts;
- build or ship Android artifacts;
- implement remote companion networking;
- create a cross-platform remote Core API;
- weaken Windows security to match Linux;
- guarantee cross-platform backup restore;
- support every Linux distribution;
- build distributed/multi-master JARVIS state;
- abstract away meaningful platform security differences.

---

# 31. INVARIANTS

1. Windows remains the only mandatory V1 production platform.
2. Linux remains an explicit future `FULL_HOST` target.
3. Companion is a different runtime role from full host.
4. Shared Core/domain/policy code does not depend directly on Windows-native implementation APIs.
5. Platform-specific mechanisms are isolated behind explicit semantic capabilities/composition boundaries.
6. Strong Windows primitives are not weakened for portability.
7. Unsupported platform features fail closed or degrade truthfully.
8. Provider/module/tool support is platform-qualified where native behavior matters.
9. Portable recovery does not require the historical platform-local secret-store key.
10. Future companion control does not expose privileged Core directly and does not become a second authority.
11. Remote-origin instructions never bypass normal PermissionEngine/approval/DataPolicy rules.
12. Linux/companion support cannot be claimed without explicit future qualification.

---

# 32. GOVERNING PRINCIPLES

> **Abstract the capability, not the security away.**

> **Share product semantics; specialize native mechanisms.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**

> **One authoritative host. Multiple interaction surfaces may come later.**

---

**END — JARVIS PLATFORM PORTABILITY & RUNTIME ROLES CONTRACT v1.0.4**
