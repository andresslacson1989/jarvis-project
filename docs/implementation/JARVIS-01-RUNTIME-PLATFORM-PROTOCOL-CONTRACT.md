# JARVIS Runtime, Platform & Protocol Contract

**Contract Suite Version:** 1.0.8
**Version:** 1.0.8
**Component:** `J01`
**Protocol Major:** 1
**Status:** Canonical normative component
**Scope:** runtime roles, platform capabilities, process lifecycle, IPC, protocol/schema boundaries, and typed cross-boundary representations

---

This file is the sole normative home for the clauses in this component. The manifest fixes the component set and revisions; the Release Profile fixes the supported V1 product profile. The implementation plan, execution matrix, evidence records, and audits are execution aids and do not add authority.

Clause identifiers in this file are stable traceability anchors. Cross-component references use clause identifiers and the separate Release Profile; historical material cannot override or supplement this suite.
## J01-PLAT-01 — PURPOSE

This contract defines the platform architecture that allows JARVIS to be production-grade on Windows now, become a full JARVIS host on Linux later, and support future companion clients without weakening the full-host trust model.

It is a portability contract, not a requirement to implement every platform in V1.

The governing rule is:

> **Windows production quality now. Linux portability through explicit platform boundaries. Companion clients never become host authority.**

---

---

## J01-PLAT-02 — PRODUCT RUNTIME ROLES

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

---

## J01-PLAT-03 — PLATFORM INTENT

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

---

## J01-PLAT-04 — FULL-HOST ARCHITECTURE

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

---

## J01-PLAT-05 — SHARED VERSUS PLATFORM-SPECIFIC CODE

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

---

## J01-PLAT-06 — PLATFORM CAPABILITY BOUNDARY

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

---

## J01-PLAT-07 — COMPOSITION ROOT

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

---

## J01-PLAT-08 — NO LOWEST-COMMON-DENOMINATOR SECURITY

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

---

## J01-PLAT-09 — WINDOWS FULL-HOST BACKEND

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

---

## J01-PLAT-10 — FUTURE LINUX FULL-HOST BACKEND

Linux is an explicit future full-host target.

A Linux production release SHALL preserve the same high-level authority, recovery, process ownership, secure-storage, local-IPC, UI, provider, tool, integration, and verification semantics while using separately qualified Linux-native implementations.

The current contract intentionally does not prematurely choose exact Linux technologies for every backend. A future Linux Release Profile SHALL select and qualify them based on the actual supported distributions, desktop/session environment, packaging model, provider behavior, and security properties at that time.

Linux production support SHALL NOT be inferred merely because Tauri, Node, Rust, React, SQLite, or a provider can launch on Linux.

---

---

## J01-PLAT-11 — PLATFORM-SPECIFIC RELEASE SUPPORT

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

---

## J01-PLAT-12 — PROVIDER QUALIFICATION

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

---

## J01-PLAT-13 — FILESYSTEM AND PATH IDENTITY

Domain code SHALL treat filesystem identity through canonical platform-aware path/resource abstractions.

Windows path semantics such as drive letters, UNC paths, junctions, reparse points, case behavior, and alternate roots remain required Windows checks but SHALL NOT define the generic Project/Workspace protocol.

A future Linux backend SHALL provide its own canonicalization and escape protections for Linux path/symlink/mount/filesystem semantics.

Persisted project/workspace records MAY store platform-native path text where required, but SHALL also retain enough platform identity/metadata to avoid interpreting a path under the wrong platform semantics.

---

---

## J01-PLAT-14 — SECURE STORAGE

Core/domain state SHALL use opaque credential/key handles and a semantic secure-storage interface.

The Windows backend uses the qualified Windows secure-storage design from J03-SEC-06/J02-DATA-03.

A future Linux backend SHALL use a separately qualified local secret-storage/key-protection design appropriate to the supported Linux environment.

Raw secret material SHALL NOT be moved into Core/domain state merely to make storage portable.

---

---

## J01-PLAT-15 — LOCAL IPC

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

---

## J01-PLAT-16 — PROCESS SUPERVISION

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

---

## J01-PLAT-17 — SESSION TRUST

The shared session model is `LOCKED`/`UNLOCKING`/`UNLOCKED`/`LOCKING` and the corresponding privacy/authority behavior.

Windows session lock/sign-out is one backend signal source.

A future Linux full host SHALL map supported desktop/session lock/logout behavior into the same JARVIS session-trust semantics and document limitations for each supported environment.

---

---

## J01-PLAT-18 — WINDOW AND UI PORTABILITY

Mission Control identity, state language, information hierarchy, design tokens, and reusable React component semantics are shared product behavior.

Native window lifecycle is platform-backed.

Windows V1 retains the dedicated primary window, monitor recovery, full-screen, focus-discipline, and accessibility requirements already defined.

A future Linux desktop release SHALL preserve the same product identity and equivalent user-facing behavior while permitting native platform differences that do not alter security, authority, truthfulness, or core interaction semantics.

Platform-native affordances MAY differ; JARVIS SHALL NOT fork into unrelated Windows and Linux product identities.

---

---

## J01-PLAT-19 — PERSISTENCE AND PORTABLE STATE

Logical persistence/state-machine schemas SHOULD remain platform-neutral unless the stored fact is inherently platform-specific.

Shared durable records SHALL NOT casually persist Windows-native handles, HWNDs, access tokens, raw SIDs, registry handles, process handles, or Linux-native descriptors as domain identity.

Platform-specific metadata SHALL be typed/namespaced and treated as non-portable unless explicitly qualified otherwise.

`PORTABLE_STATE` backup encryption remains independent of the historical live local secure-store key. The current V1 guarantee is Windows clean-profile restore. Cross-platform Windows↔Linux state migration/restore is **not** guaranteed until a future release explicitly qualifies schema, filesystem paths, provider/setup state, artifacts, and platform-specific metadata migration.

The backup format SHALL NOT be redesigned to require Windows-only secret material for its portable recovery slot.

---

---

## J01-PLAT-20 — UPDATE AND PACKAGING

Release artifacts are platform-specific.

A Windows installer/update artifact is never treated as a Linux artifact and vice versa.

Shared source/version identity MAY produce multiple platform artifacts, but every artifact has its own:

- platform/architecture identity;
- native runtime dependencies;
- signing/integrity metadata;
- provider/native-backend support matrix;
- qualification report.

A future Linux packaging decision SHALL be made through the normal direct active-contract amendment process when concrete supported distributions/package formats are selected.

---

---

## J01-PLAT-21 — MODULES AND INTEGRATIONS

Integration semantic capabilities SHOULD remain platform-neutral when the remote service semantics are platform-independent.

Local tool/module/provider implementations MAY be platform-specific.

Module manifests SHALL be capable of declaring platform/runtime-role compatibility without treating installation as support.

A module qualified only for Windows cannot be labeled supported on Linux merely because its package can be copied there.

---

---

## J01-PLAT-22 — VOICE AND DEVICES

Conversation/voice state semantics and DataPolicy remain shared.

Microphone, speaker, AEC/device APIs, local model packaging, acceleration, and provider availability may be platform-specific.

A future Linux full-host release SHALL separately qualify actual audio-device lifecycle, latency, AEC, STT/TTS, GPU/runtime, privacy, and packaging behavior.

---

---

## J01-PLAT-23 — FUTURE COMPANION ROLE

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

---

## J01-PLAT-24 — ONE AUTHORITATIVE HOST

A companion does not create a second authoritative copy of JARVIS state.

It MAY cache bounded presentation/read data, but cached companion state is never authoritative for consequential decisions.

Multi-host federation, distributed consensus, automatic host failover, or synchronized multi-master JARVIS state are not implied by companion support and require separate future architecture.

---

---

## J01-PLAT-25 — FUTURE REMOTE-ACCESS GATEWAY

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

---

## J01-PLAT-26 — PLATFORM CAPABILITY DISCOVERY

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

---

## J01-PLAT-27 — ERROR AND DIAGNOSTIC MODEL

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

---

## J01-PLAT-28 — TESTING AND ARCHITECTURE ENFORCEMENT

The platform/runtime/protocol invariants in this component are verified through the complete J05-VER-09, J05-VER-10, J05-VER-12, J05-VER-17, J05-VER-18, J05-VER-19, J05-VER-21, J05-VER-24 through J05-VER-26, and J05-VER-37 gates. Those gates cover import/composition boundaries, Windows native backend qualification, truthful unavailable/degraded behavior, portable recovery independence from DPAPI, provider/module platform qualification, and the explicit exclusion of Linux runtime qualification from the V1 claim. This clause defines the invariants; J05 defines their evidence and pass criteria.

---

---

## J01-PLAT-29 — FUTURE LINUX PRODUCTION PROMOTION

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

---

## J01-PLAT-30 — NON-GOALS

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

---

## J01-PLAT-31 — INVARIANTS

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

---

## J01-PLAT-32 — GOVERNING PRINCIPLES

> **Abstract the capability, not the security away.**

> **Share product semantics; specialize native mechanisms.**

> **Windows production quality now. Linux portability through explicit platform boundaries.**

> **One authoritative host. Multiple interaction surfaces may come later.**

---

## J01-RT-01 — PURPOSE

This document defines executable runtime ownership: production packaging, Tauri/WebView operation, startup/shutdown, IPC, provider setup/repair, provider/worker/module process supervision, delegated engineering execution, scheduling, cancellation, recovery, and degraded operation.

---

---

## J01-RT-02 — PROCESS TREE

Production is equivalent to:

```text
jarvis-desktop.exe (Tauri/Rust host)
├── WebView2 / React bundled-local renderer
├── application-owned Node.js JARVIS Core
└── Rust Native Process Broker managed jobs
    ├── Codex / AI worker processes
    ├── narrowly invoked provider setup/repair helper when required
    ├── voice/STT/TTS/AEC helpers when separate
    ├── integration helpers
    ├── EXTERNAL_MANAGED modules
    └── typed tool helper processes
```

Rust is the native root supervisor. Node Core owns authoritative application state/policy. Managed children do not become independent authorities.

The normal app runs non-elevated. A narrowly defined capability requiring elevation needs its own explicit typed path, user-visible reason, bounded lifetime, qualification, and audit. Ordinary provider/worker execution does not inherit elevation from setup/install operations.

---

---

## J01-RT-03 — APPLICATION-OWNED CORE PACKAGING

Production SHALL package one qualified release unit containing:

```text
Rust/Tauri host
React/WebView application
JARVIS Core application
Node.js runtime
protocol/schema compatibility metadata
required native assets
```

Rust SHALL launch Core from the exact active release-owned path. It SHALL NOT locate `node`, `node.exe`, or an unrelated developer runtime through PATH/registry/shell discovery.

The release declares the exact Node version/architecture. End users do not run `npm install`, `pnpm install`, or similar dependency installation during normal first launch/startup.

The host constructs an explicit Core environment and removes/controls execution modifiers such as `NODE_OPTIONS` and `NODE_PATH` unless JARVIS intentionally supplies them.

Core working directory and immutable runtime/resource paths are explicit. Mutable data lives under the JARVIS user data directory.

Missing/corrupt/incompatible runtime produces typed repair/recovery state such as:

```text
CORE_RUNTIME_MISSING
CORE_RUNTIME_INTEGRITY_FAILED
CORE_RUNTIME_INCOMPATIBLE
CORE_ENTRYPOINT_MISSING
CORE_START_FAILED
CORE_PROTOCOL_INCOMPATIBLE
```

No system-runtime fallback is permitted.

---

---

## J01-RT-04 — SINGLE INSTANCE AND DATA DIRECTORY

One authoritative desktop/Core pair operates against one production data directory.

Rust obtains the single-instance/native ownership lock before Core opens authoritative state. A second launch activates/focuses the existing instance.

Mutable application state is rooted under a stable per-user location equivalent to:

```text
%LOCALAPPDATA%\JARVIS\
  data\
  backups\
  logs\
  cache\
  artifacts\
  modules\
  updates\
  recovery\
```

Maintenance/recovery access requires an exclusive maintenance lock.

---

---

## J01-RT-05 — TAURI/WEBVIEW RUNTIME BOUNDARY

The authoritative JARVIS UI SHALL be bundled/local application content, not a privileged browser for arbitrary remote sites.

Production configuration SHALL:

- define explicit Tauri capability allowlists per window/WebView;
- grant no privileged command/plugin capability to remote origins;
- enable restrictive CSP;
- avoid remote executable JavaScript/CDN dependencies by default;
- block unexpected navigation of the privileged WebView;
- open ordinary external links outside that WebView;
- render untrusted HTML/Markdown as sanitized inert content;
- disable production devtools except a separately gated developer/diagnostic build policy;
- use a release-qualified Tauri/runtime version with relevant upstream security fixes.

React communicates only through typed Tauri commands/events. It never opens the Core named pipe directly.

UI caches/read models are non-authoritative. Optimistic UI never represents consequential work as complete before Core confirmation.

The Rust host owns primary-window native presentation state. Renderer/AI may request show/hide/focus/fullscreen/focused-context transitions through typed commands, but deterministic native policy enforces focus/privacy/NotificationPolicy rules.

---

---

## J01-RT-06 — BOOTSTRAP SEQUENCE

Startup SHALL occur in this order:

1. acquire single-instance ownership;
2. initialize crash-safe native diagnostics;
3. set application session state `LOCKED`;
4. load/validate non-secret bootstrap configuration, current contract manifest, and active Release Profile;
5. open native Windows secure-store broker;
6. verify signed release/runtime manifest and packaged Core/runtime integrity;
7. create unpredictable local Core IPC endpoint with restrictive security descriptor;
8. generate cryptographically random per-launch bootstrap secret;
9. create the required Windows Job Object containment for Core;
10. launch Core using the exact application-owned runtime path and controlled environment;
11. transfer bootstrap material through an inherited/anonymous secure channel rather than command-line/log output;
12. complete authenticated protocol handshake;
13. Core opens persistence and validates SQLite/SQLCipher build, WAL/safety settings, schema, KDF-profile metadata, and recovery state;
14. Core scans transient task/tool/provider states for recovery;
15. discover providers/integrations/modules and evaluate provider setup/compatibility state;
16. publish diagnostics/degraded/setup-required states;
17. render operational but locked Mission Control UI;
18. after native session authentication succeeds, permit authenticated user commands.

Failure of a mandatory step produces explicit recovery/diagnostic state rather than a false ready state.

---

---

## J01-RT-07 — PRIVILEGED CORE IPC

V1 uses a Windows named pipe or equivalent non-network local transport. It SHALL NOT expose the privileged Core control plane on ordinary localhost TCP/HTTP.

Named-pipe requirements:

- explicit `SECURITY_DESCRIPTOR` / restrictive DACL;
- current intended JARVIS logon/session identity as primary interactive principal;
- only narrowly required OS principals in addition;
- no `Everyone`, anonymous, unrelated session/user, or network-origin access;
- local-only/remote-client rejection;
- unpredictable per-launch endpoint name;
- independent bootstrap authentication;
- framed bounded protocol.

Normal framing:

```text
uint32_le payload_length
UTF-8 JSON payload
```

Default normal frame ceiling SHOULD be 1 MiB; large data uses artifact references.

Every message uses protocol-major 1 and runtime schema validation. Unsupported protocol or security establishment fails closed.

OS object security is defense layer one; bootstrap authentication and schema/protocol validation remain independent layers.

---

---

## J01-RT-08 — NATIVE PROCESS/CREDENTIAL/ELEVATION BROKER

The Rust host exposes narrow typed native capabilities such as:

- secure secret put/get/rotate/delete by opaque handle and scoped requesting context;
- managed process spawn/terminate/status;
- Windows session lock events;
- app activation/single-instance/window-presentation routing;
- signed update staging/activation;
- native audio/device helpers where appropriate;
- narrowly qualified provider setup/repair invocation where upstream requires elevation;
- future privileged Windows operations only through explicit typed capabilities.

There is no generic `execute_any_command` broker operation for the orchestrator.

Secure-store requests use resolved requesting component/capability context. Raw secret enumeration is not a normal Core/provider API.

Elevation mediation SHALL accept only an installed/qualified operation identity plus bounded arguments; it SHALL NOT become an elevated general shell. Elevated helper completion does not authorize ordinary work and does not leak an elevated process/handle/token into worker execution.

---

---

## J01-RT-09 — MANDATORY WINDOWS JOB OBJECT CONTAINMENT

Every JARVIS-managed executable process tree on supported Windows 11 SHALL be assigned to an explicitly owned Job Object hierarchy unless a narrow separately documented/verified incompatibility meets the approved exception criteria.

Covered processes include Core, AI/provider workers, engineering workers, voice helpers, integration helpers, EXTERNAL_MANAGED modules, and tool helpers. A provider-owned elevation helper may require a separately qualified lifecycle because Windows/UAC launch mechanics differ, but it remains bounded, awaited, audited, and is never treated as a normal uncontained worker exception.

Requirements:

- `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` or verified equivalent for subtrees that terminate with JARVIS;
- host retains controlling handles;
- creation-time job assignment is preferred; otherwise create suspended, assign before untrusted code executes, then resume;
- ordinary breakaway flags are prohibited;
- handle inheritance defaults to none and uses an explicit allowlist where required;
- containment-establishment failure blocks consequential child start rather than silently launching uncontained;
- cancellation escalates cooperative request → bounded grace → job/subtree termination → termination verification.

Job Objects provide lifecycle/resource containment and accounting. They do **not** prove filesystem, network, credential, or same-user memory isolation.

---

---

## J01-RT-10 — CORE SERVICES

Core SHALL have explicit owning services equivalent to:

```text
ConversationService
ContextManager
MemoryService
ProjectRegistry
MissionManager
TaskManager
GraphPlanner
Scheduler
PermissionEngine
ApprovalService
AuthorityEnvelopeService
ToolRegistry / ToolExecutor
ProviderRegistry / ProviderRouter / ProviderSupervisor
ProviderSetupCoordinator
WorkerManager
EventBus / durable event publisher
CredentialBrokerClient
ModuleRegistry
IntegrationRegistry
BudgetService
NotificationPolicyEngine
AutomationService
BackupCoordinator
DiagnosticsService
```

Direct imports/calls SHALL not bypass owning policy/state services for convenience.

---

---

## J01-RT-11 — INPUT/COMMAND PIPELINE

Authenticated text/voice work flows through:

```text
input/session binding
→ scoped context construction
→ AI orchestrator or deterministic reflex path
→ structured decision validation
→ task/mission/tool proposal
→ execution-scope + canonical-target resolution
→ authority envelope
→ deterministic PermissionEngine
→ locality/budget/resource/precondition checks
→ scheduler/tool/integration adapter
→ observed outcome
→ postcondition/verification
→ transactional state/event
→ user-visible result
```

No AI confidence or provider capability skips a deterministic gate.

---

---

## J01-RT-12 — DETERMINISTIC REFLEX PATH

Low-latency reflexes may handle established commands such as:

- stop speaking;
- mute/unmute;
- cancel current voice generation;
- push-to-talk state;
- lock;
- show/hide/focus JARVIS window after deterministic target/presentation resolution;
- unambiguous task pause/cancel after target resolution.

The reflex path does not generate substantive factual answers, broaden authority, authorize tools, or invent completion.

---

---

## J01-RT-13 — DELEGATED WORKSPACE ENGINEERING PROFILE

A shell-capable AI engineering provider is a delegated executor, not a collection of JARVIS typed tools.

Before launch Core SHALL resolve:

- `PROJECT_WORKSPACE` scope and exact assigned worktree;
- worker role/attempt identity;
- immutable authority envelope;
- data policy;
- provider/version/profile;
- approved setup-ready sandbox mode;
- resource/time/iteration limits;
- network policy;
- secret/capability inputs.

V1 `WORKSPACE_ENGINEERING` defaults:

```text
workspace writes:    allowed only inside assigned writable worktree under qualified sandbox
workspace reads:     required
other-user-file read isolation: not claimed unless provider/OS conformance proves it
network:             denied by default
integration secrets: none by default
external side effects: not delegated
admin/elevation:     prohibited by default
```

The provider may run local development commands required to inspect/edit/build/test the assigned project according to the qualified sandbox profile.

The existence of Git/GitHub/SSH/cloud/Proxmox client binaries inside the worker process does not authorize external writes. Push, publish, deploy, email/send, infrastructure mutation, credential administration, and similar consequential remote operations SHALL cross a registered JARVIS tool/integration/PermissionEngine boundary.

Provider-native sandbox behavior is tested as an actual technical boundary. Prompt text such as “stay in the project” is not a sandbox.

---

---

## J01-RT-14 — PROVIDER DISCOVERY, SETUP, COMPATIBILITY, AND SUPERVISION

Every provider adapter defines discovery, exact distribution/version identity, setup policy/state, authentication state, compatibility policy, startup timeout, execution timeout, cancel semantics, health probe, capability/locality/resource metadata, output normalization, sanitized errors, and process containment behavior.

States distinguish setup, compatibility, and health:

```text
NOT_REQUIRED / SETUP_REQUIRED / SETUP_IN_PROGRESS /
SETUP_READY / REPAIR_REQUIRED / SETUP_FAILED

NOT_DETECTED / VERSION_UNKNOWN / VERSION_UNSUPPORTED /
CONFORMANCE_UNQUALIFIED / COMPATIBLE

STARTING / READY / DEGRADED / UNAVAILABLE / FAILED
```

A provider becomes production `SUPPORTED` only when the selected version/range has release-time conformance evidence and runtime setup/identity/health/auth/capability checks pass.

A newly released provider version outside the qualified policy is not optimistically trusted. Provider self-update invalidates cached compatibility and any setup/conformance evidence whose applicability is version-sensitive until revalidated.

For Codex, the V1 adapter SHALL prefer the qualified stable non-interactive/structured interface rather than scraping an interactive TUI. Its Windows sandbox conformance tests SHALL observe actual write/network restrictions and SHALL not claim workspace-only read isolation unless technically proven.

---

---

## J01-RT-15 — CODEX WINDOWS SANDBOX SETUP / REPAIR

If the release-qualified Codex Windows sandbox requires first-class elevated setup, JARVIS SHALL provide an explicit setup/repair workflow.

The workflow is equivalent to:

```text
discover exact Codex distribution/version
→ determine setup policy/state
→ SETUP_REQUIRED / REPAIR_REQUIRED if needed
→ authenticated user starts explicit setup/repair
→ Rust validates qualified helper/distribution identity
→ Windows UAC consent for only that provider setup helper/path
→ wait for provider setup completion
→ verify provider setup probe/state
→ run sandbox conformance probe
→ SETUP_READY + COMPATIBLE only on success
```

Rules:

- UAC/elevation is never automatic background escalation.
- The setup helper receives only bounded provider-defined/qualified arguments.
- Ordinary Codex workers remain non-elevated.
- Provider-internal sandbox-account passwords/credentials remain provider-owned; JARVIS SHALL NOT read, copy, export, or make them general Credential Broker secrets.
- Setup/repair logs entering JARVIS diagnostics are sanitized and bounded.
- Failure/cancel leaves `SETUP_REQUIRED`, `REPAIR_REQUIRED`, or `SETUP_FAILED`; the engineering profile remains unsupported/unavailable.
- JARVIS SHALL NOT silently fall back to a less restrictive or unqualified Codex sandbox.
- A provider update that changes setup/helper/sandbox semantics invalidates readiness as required by the release compatibility policy.

---

---

## J01-RT-16 — PROVIDER SESSION RESUME

Provider session/conversation resume handles are optional optimizations.

Durable recovery state belongs to JARVIS:

```text
task input + acceptance criteria
authority/scope/data policy
checkpoint summaries
artifacts/worktree state
tool/audit results
verification state
live-state assumptions
remaining work
```

Recovery first loads/reconciles JARVIS-owned state. It may attempt provider resume only after compatibility/auth/privacy/authority/setup checks. Resume failure falls back to a fresh provider session reconstructed from durable JARVIS state.

No completion evidence may exist only inside an inaccessible provider session.

---

---

## J01-RT-17 — WORKER LOOP AND CHECKPOINTS

Worker loops are bounded and emit observable progress equivalent to:

```text
plan/next step
→ action request(s)
→ observation(s)
→ progress assessment
→ checkpoint/completion proposal/replan/block
```

No private chain-of-thought is required or persisted.

Recommended initial iteration ceilings remain:

```text
GENERALIST        12
RESEARCHER        16
SOFTWARE_ENGINEER 20
VERIFIER           8
SYNTHESIZER        6
DATA_ANALYST      12
```

Three consecutive no-material-progress iterations SHOULD cause reconsideration then `REPLAN_REQUESTED`/`BLOCKED` rather than blind continuation.

---

---

## J01-RT-18 — TOOL EXECUTION

All JARVIS typed tools execute through ToolExecutor.

Before consequential execution it SHALL:

1. resolve tool/version/schema;
2. validate scope and canonical target/account/environment;
3. evaluate manifest preconditions;
4. apply authority/PermissionEngine/approval/locality/budget/resource rules;
5. build/recompute the canonical action descriptor where approval-bound;
6. re-resolve mutable live target state;
7. use conditional/versioned mutation when supported;
8. execute the registered adapter;
9. validate output;
10. evaluate postconditions;
11. record durable audit/state/events.

Conditional mutation includes mechanisms such as ETag/If-Match, expected Git ref/SHA, filesystem identity/hash, provider version/generation tokens, or equivalent compare-and-set behavior.

A precondition/version mismatch is not silently retried against changed state. It returns to resolution/authorization/approval as required.

Unverifiable consequence is `UNCERTAIN`.

---

---

## J01-RT-19 — MISSION GRAPH AND SCHEDULER

A mission points to one active immutable graph version. Only owning mission services activate validated graph revisions.

Scheduler considers:

- priority/dependency readiness;
- execution-scope/workspace/resource leases;
- provider setup/compatibility/health/locality/concurrency;
- CPU/RAM/GPU pressure;
- foreground interaction/voice responsiveness;
- exact budget reservations;
- fairness/starvation prevention.

AI determines logical parallelism; deterministic scheduling determines actual concurrency.

Parallel writable engineering tasks never share one worktree.

---

---

## J01-RT-20 — PAUSE, PREEMPTION, RESUME

Preemption policy is exactly:

```text
PREEMPTIBLE
SAFE_POINT_ONLY
TEMPORARILY_NON_PREEMPTIBLE
```

Temporary non-preemptibility is narrow/bounded and cannot deny cancellation indefinitely.

Task pause uses:

```text
RUNNING → PAUSING → PAUSED
PAUSED → RESUMING
RESUMING → RUNNING | QUEUED | BLOCKED | RECOVERING | FAILED | CANCELLED
```

`RESUMING` verifies live/external state, execution scope, workspace/resource leases, provider setup/capability/version/health/locality, budget, approvals, and relevant preconditions before new execution.

---

---

## J01-RT-21 — BUDGET ADMISSION

Before new chargeable work subject to a hard monetary budget, BudgetService atomically evaluates:

```text
settled spend
+ outstanding reservations
+ requested reservation
<= applicable hard limit
```

Only after reservation commit may the metered attempt start when a monetary reservation can be determined.

Provider-reported usage/quota facts retain provenance and may differ from local estimates. Unknown values remain unknown rather than fabricated as zero.

If actual cost exceeds reservation, the actual provider-reported/settled cost is recorded; a hard budget is an admission-control guarantee, not a promise that an external invoice can never exceed an estimate.

---

---

## J01-RT-22 — CRASH RECOVERY

Startup identifies transient mission/task/attempt/tool/provider states and enters `RECOVERING` before retry/resume.

Recovery examines:

- last checkpoint/event;
- process death/Job Object cleanup;
- workspace/resource leases;
- execution scope and authority envelope;
- current provider setup/compatibility/auth/locality;
- approval expiry/digest/current target;
- budget reservations;
- live external state when side effects may have occurred.

Stale leases are reclaimed only after ownership is proven dead or policy permits it.

Ambiguous consequential/destructive side effects are never blindly replayed. They become `UNCERTAIN`/blocked/`REQUIRES_USER` according to recovery policy until live state is reconciled.

---

---

## J01-RT-23 — SHUTDOWN

Normal shutdown SHALL:

1. stop admitting new consequential work;
2. stop/finish speech safely;
3. request worker/task pause/cancel according to policy;
4. checkpoint resumable work;
5. flush authoritative state/events;
6. request provider/module/helper cooperative shutdown;
7. after bounded grace, terminate remaining managed jobs/subtrees;
8. verify intended child termination;
9. close persistence/IPC;
10. release instance ownership.

Crash semantics assume termination can occur between any two steps.

An active UAC-elevated provider setup helper is not force-killed through an unsafe unrelated handle assumption; its separately qualified setup lifecycle determines cancellation/reconciliation, and JARVIS does not mark setup ready until final verification succeeds.

---

---

## J01-RT-24 — INTEGRATIONS AND PROXMOX RUNTIME

Integration requests use typed registered adapters and Credential Broker handles; they do not execute arbitrary endpoint strings from AI output.

GitHub runtime exposes only Release Profile-supported typed capability operations. `GITHUB_REF_WRITE` uses canonical repo/ref identity and expected-ref/conditional behavior for create/update; protected/admin/secrets/ref-delete operations are not implied by generic GitHub connection.

The V1 Proxmox adapter uses HTTPS REST API as the normal control path. It SHALL:

- verify TLS/system trust or configured SHA-256 pin;
- resolve connection/environment/resource identity before consequential work;
- enforce Release Profile capability matrix and connection node/VMID/pool scopes;
- keep raw token out of AI/UI/journals/logs;
- track asynchronous Proxmox task identifiers through terminal outcome;
- re-resolve live target state before consequential execution;
- use provider-supported conflict/precondition semantics where available;
- return `UNCERTAIN` rather than blind replay after ambiguous writes;
- never silently fall back to SSH/`qm`/`pct`/`pvesh`/root shell/direct `/etc/pve` editing;
- keep guest OS access a separate connection/authority domain.

---

---

## J01-RT-25 — MODULE RUNTIME

Every module is `DATA_ONLY`, `BUILT_IN_TRUSTED`, or `EXTERNAL_MANAGED`.

`DATA_ONLY` never causes embedded executable content to run.

`BUILT_IN_TRUSTED` is first-party executable code shipped/qualified as part of the signed JARVIS release.

`EXTERNAL_MANAGED` runs out of Core through versioned typed IPC under a capability envelope and its own supervised process/Job Object boundary. It cannot receive Core database handles, blanket secure-store access, or arbitrary direct authoritative-state mutation.

Typed health checks are supervisor mechanisms, not arbitrary manifest commands.

Module crash degrades the module, not Core.

---

---

## J01-RT-26 — VOICE RUNTIME

Canonical voice path:

```text
Microphone
→ Audio Input Manager
→ AEC Provider ← exact TTS render reference
→ cleaned microphone
→ VAD / optional Wake / streaming STT
→ physical + semantic Turn Detector
→ Realtime Conversation Engine
→ Core / Orchestrator
→ interruptible TTS persistent voice
→ Speaker
```

Full-duplex keeps microphone available for barge-in when AEC is healthy. AEC failure may degrade to half-duplex without losing deterministic stop/mute/cancel.

Stale/cancelled transcripts cannot submit after cancel/lock/session reset.

Speech provider routing obeys the same DataLocality policy as AI providers.

---

---

## J01-RT-26A — NORMALIZED TTS AND AUDIO-PROCESSING PROVIDERS

JARVIS owns voice capability; TTS and audio-processing providers are replaceable adapters. Core, conversation state, UI, mission logic, and permission policy SHALL NOT depend on provider-native APIs, voice identifiers, request options, or event structures.

The normalized TTS provider boundary SHALL expose an adapter identity, health, capabilities, logical voice discovery, streaming synthesis, and interrupt/stop behavior. A normalized synthesis request SHALL carry `text`, logical voice identity, language, rate, style/expression, streaming preference, latency preference, quality preference, and applicable conversation/turn identity. Provider-specific options SHALL remain inside the adapter or its attached metadata.

The normalized TTS event vocabulary SHALL include `tts.started`, `tts.audio_chunk`, `tts.completed`, `tts.stopped`, and `tts.error`. Logical JARVIS voice identity is independent of a provider; an adapter maps that identity to its closest qualified provider configuration. Local speech is preferred, cloud TTS is optional and SHALL NOT be required for normal operation, and a fallback SHALL preserve DataLocality, privacy, permission, and approved-provider policy. TTS provider failure SHALL NOT crash Core.

The audio-processing boundary SHALL accept raw microphone input and the exact speaker/TTS render reference, then produce cleaned microphone audio before VAD, barge-in detection, and streaming STT. It SHALL remain provider-neutral. The initial qualified local CPU adapter SHALL use WebRTC APM/AEC3-compatible behavior, or an exact active-Release-Profile equivalent; Core and the realtime conversation engine SHALL NOT depend on WebRTC-native structures.

AEC capability and health reporting SHALL cover AEC, double-talk handling, noise suppression, gain control, supported sample rates, latency, CPU requirements, readiness, and health. The centralized Provider Supervisor owns discovery, lifecycle, readiness, health, restart, failure isolation, and approved fallback routing for AEC as well as AI/STT/TTS/VAD providers. A provider failure SHALL NOT crash Core; fallback occurs only when approved policy and required capability remain satisfied.

Full duplex is preferred whenever AEC is healthy. If AEC is unavailable or unreliable, JARVIS SHALL truthfully use a safe half-duplex fallback while retaining local deterministic stop, cancel, and mute reflexes without remote AI reasoning.

---

---

## J01-RT-27 — DEGRADED MODES

Runtime exposes explicit states equivalent to:

```text
CORE_READY
VOICE_DEGRADED
AI_DEGRADED
INTEGRATION_DEGRADED
PROVIDER_SETUP_REQUIRED
RECOVERY_MODE
OFFLINE_CAPABLE_LIMITED
```

Failure of one optional/degraded subsystem does not fabricate failure/success in another. UI states what remains usable and why capabilities are blocked.

---

---

## J01-RT-28 — RUNTIME INVARIANTS

1. UI state cannot authorize execution.
2. AI output cannot authorize execution.
3. Provider native capability cannot widen JARVIS scope.
4. A queued task is not running.
5. A task is not completed without acceptance evidence.
6. Activated mission graph versions are immutable.
7. A worker cannot widen its authority/scope.
8. Provider fallback cannot weaken setup/locality/permission/budget/security policy.
9. Destructive execution cannot bypass final confirmation.
10. Uncertain external result is not success.
11. Crash cannot silently erase accepted queued/running mission state.
12. Managed executable trees are OS-contained/owned or blocked, subject only to separately qualified elevation-helper lifecycle.
13. Job Objects are not represented as filesystem/network sandboxing.
14. Production Core does not depend on system Node.
15. Privileged Core IPC is restrictive local-only + authenticated.
16. `PAUSED` work does not resume execution without durable `RESUMING` validation.
17. Non-project tasks do not gain fake project authority.
18. Delegated engineering shell cannot directly gain consequential integration authority.
19. Provider resume metadata is not task durability.
20. External conditional-write conflicts cause reconciliation rather than silent retargeting.
21. Provider setup success is not inferred from helper launch; it is verified before support.
22. Elevation required for provider setup never grants elevated ordinary worker execution.

---

## J01-PROTO-01 — PURPOSE

This document defines the canonical cross-boundary types and representations for JARVIS. All data crossing process, AI/provider, tool, integration, module, persistence-event, approval, artifact, import/export, configuration, authentication, platform-capability, or security-material boundaries SHALL be runtime validated against versioned schemas.

The schemas below are the effective V1 definitions. Any non-current schema shape is non-authoritative and cannot supply or override a rule in this suite.

---

---

## J01-PROTO-02 — SCHEMA POLICY

Canonical validators SHALL live in `packages/schemas`; protocol/domain boundary types SHALL live in `packages/protocol` or generated equivalents.

Rules:

- TypeScript compile-time types never substitute for runtime validation.
- Rust boundary structs map explicitly to the same protocol definitions.
- Untrusted input enters as `unknown`/unparsed bytes and becomes a domain type only after bounded validation.
- Unknown required message/version semantics fail closed.
- Unknown optional fields may be ignored only where compatibility rules explicitly permit it.
- Security-material and money fields SHALL not be permissively coerced.
- Arrays, maps, strings, object depth, frame sizes, and arbitrary JSON fields SHALL be bounded.
- Shared domain schemas SHALL not encode an OS-native implementation object where a semantic platform-independent identity is sufficient.

---

---

## J01-PROTO-03 — COMMON TYPES AND PLATFORM IDENTITY

```ts
type UUIDv7 = string;
type UtcTimestamp = string; // ISO-8601 UTC

type ProjectId = UUIDv7;
type WorkspaceId = UUIDv7;
type EnvironmentId = UUIDv7;
type MissionId = UUIDv7;
type TaskId = UUIDv7;
type AttemptId = UUIDv7;
type EventId = UUIDv7;
type ArtifactId = UUIDv7;
type ApprovalId = UUIDv7;
type AuthorityEnvelopeId = UUIDv7;
type ProviderId = string;
type ModuleId = string;
type IntegrationId = string;
type IntegrationAccountId = UUIDv7;
type ConnectionId = UUIDv7;

type PlatformFamily = 'WINDOWS' | 'LINUX' | 'ANDROID';
type RuntimeRole = 'FULL_HOST' | 'COMPANION';

interface PlatformRuntimeIdentity {
  platform: PlatformFamily;
  runtimeRole: RuntimeRole;
  architecture: string;
  backendProfileId: string;
}

interface PlatformCompatibility {
  platform: PlatformFamily;
  runtimeRoles: RuntimeRole[];
  osVersionRange?: string;
  architecture?: string[];
}

interface PlatformPathRef {
  platform: PlatformFamily;
  value: string;
}
```

Identifiers are opaque and SHALL be validated before use. Display names are never authoritative identity for consequential execution.

V1 production identity is `WINDOWS + FULL_HOST`. Modeling `LINUX`/`ANDROID` does not itself grant support.

---

---

## J01-PROTO-04 — DATA POLICY

Sensitivity and routing locality are independent.

```ts
type DataSensitivity =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'SENSITIVE'
  | 'SECRET';

type DataLocality =
  | 'LOCAL_ONLY'
  | 'ANY_APPROVED_PROVIDER';

interface DataPolicy {
  sensitivity: DataSensitivity;
  locality: DataLocality;
}
```

`SECRET` is reserved for credentials/key material and normally exists only in secure storage or transient trusted adapter memory.

`LOCAL_ONLY` prohibits sending protected content to cloud/LAN/remote AI or speech providers.

A future companion transport requires a separate remote-device data-delivery policy contract; this V1 enum SHALL NOT be interpreted as silently authorizing `LOCAL_ONLY` content to leave the host.

Derived context/artifacts SHALL inherit the strictest applicable policy unless an explicit deterministic audited declassification/export decision changes it.

---

---

## J01-PROTO-05 — EXACT MONEY AND QUANTITIES

Authoritative monetary values SHALL not use binary floating point.

```ts
interface MoneyAmount {
  currency: string;
  nanoUnits: string;
}

type CanonicalQuantity = string;
```

Examples:

```text
USD 1.00      => 1000000000
USD 0.10      => 100000000
USD 0.0000025 => 2500
```

TypeScript SHOULD use `bigint` after parsing; Rust SHALL use a checked exact integer/decimal representation. Overflow, malformed integer text, unsupported precision, or currency mismatch fails authoritative budget decisions closed.

---

---

## J01-PROTO-06 — KDF PROFILES

```ts
type KdfPurpose = 'SESSION_PASSWORD' | 'PORTABLE_RECOVERY';

interface Argon2idProfile {
  profileId: string;
  purpose: KdfPurpose;
  algorithm: 'ARGON2ID';
  version: 0x13;
  memoryKiB: number;
  iterations: number;
  parallelism: 4;
  saltBytes: number;
  outputBytes: number;
}
```

A production V1 profile SHALL satisfy at least:

```text
memoryKiB  >= 65536
iterations >= 3
parallelism = 4
saltBytes  >= 16
outputBytes >= 32
```

Exact parameter metadata used to create a verifier/key slot SHALL be retained with that verifier/key slot so future releases can verify/derive historical values and then upgrade them deliberately.

Schema validation rejects unsupported Argon2 version, under-floor production profile, out-of-range resource values, or missing profile identity. Test/development-only weaker fixtures SHALL never be accepted by production configuration.

---

---

## J01-PROTO-07 — IPC ENVELOPE AND RESPONSE UNION

```ts
type IpcKind = 'request' | 'response' | 'event';

interface IpcEnvelope<T = unknown> {
  protocolVersion: 1;
  kind: IpcKind;
  id: UUIDv7 | null;
  name: string;
  correlationId: UUIDv7;
  payload: T;
}

type IpcResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: JarvisError };
```

For a request/response pair:

```text
response.id            = request.id
response.name          = request.name
response.correlationId = request.correlationId
```

Events use `id: null` and carry domain identity in their payload.

A success response SHALL NOT contain `error`; a failure response SHALL NOT contain `result`. Missing/nullable/ad-hoc status conventions do not substitute for this union.

One accepted request id receives at most one terminal response. Long-running progress uses events or operation/task identifiers.

Malformed frames/envelopes whose identity cannot be trusted may be rejected by closing the transport without fabricating an application response.

The envelope is transport-neutral. Windows V1 uses it over the qualified local named-pipe framing. A future Linux full host may use the same logical protocol over a separately qualified local transport without changing semantic message shapes.

---

---

## J01-PROTO-08 — ERROR MODEL

```ts
type ErrorCategory =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION'
  | 'POSTCONDITION'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_FAILED'
  | 'TOOL_FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'BUDGET'
  | 'RESOURCE'
  | 'PRIVACY'
  | 'INTEGRITY'
  | 'RECOVERY_REQUIRED'
  | 'UNSUPPORTED'
  | 'INTERNAL';

interface JarvisError {
  code: string;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  correlationId: UUIDv7;
}
```

`retryable` is advisory only. Idempotency, uncertainty, approval, budget, and recovery policy still govern replay.

Raw provider/native/SQLite stack traces or secret-bearing payloads SHALL be normalized before crossing generic boundaries.

Platform errors use stable codes such as `PLATFORM_CAPABILITY_UNAVAILABLE`, `PLATFORM_BACKEND_UNQUALIFIED`, `PLATFORM_IPC_SECURITY_FAILED`, or more specific registered equivalents rather than exposing native error text as policy input.

---

---

## J01-PROTO-09 — SESSION AND USER INPUT

```ts
type SessionTrustState = 'LOCKED' | 'UNLOCKING' | 'UNLOCKED' | 'LOCKING';

type SessionLockedReason =
  | 'STARTUP'
  | 'USER'
  | 'OS_SESSION_LOCK'
  | 'OS_SESSION_END'
  | 'IDLE'
  | 'SECURITY';

interface SessionState {
  state: SessionTrustState;
  sessionId: UUIDv7 | null;
  unlockedAt: UtcTimestamp | null;
  lockedReason: SessionLockedReason | null;
}

type InputModality = 'TEXT' | 'VOICE';

type InstructionOrigin = 'LOCAL_UI' | 'LOCAL_VOICE' | 'AUTOMATION' | 'EVENT_GATEWAY';

interface UserInstruction {
  id: UUIDv7;
  sessionId: UUIDv7;
  modality: InputModality;
  origin: InstructionOrigin;
  text: string;
  receivedAt: UtcTimestamp;
  conversationId: UUIDv7;
  activeProjectHint?: ProjectId;
  voiceMetadata?: {
    transcriptConfidence?: number;
    utteranceId: UUIDv7;
  };
}
```

No password, verifier, recovery factor, database key, token, or other secret appears in session state.

Voice confidence is informational and never authorizes an action or target.

A future companion origin is deliberately not added in V1. Remote-device instruction provenance requires the future Remote Access Gateway/security contract rather than being inferred from generic input.

---

---

## J01-PROTO-10 — ORCHESTRATOR DECISION

```ts
type OrchestratorAction =
  | 'RESPOND'
  | 'CLARIFY'
  | 'PROPOSE_TOOL'
  | 'PROPOSE_TASK'
  | 'PROPOSE_MISSION'
  | 'REQUEST_CONTEXT'
  | 'REQUEST_APPROVAL'
  | 'REPRIORITIZE'
  | 'CANCEL';

interface OrchestratorDecision {
  schemaVersion: 1;
  action: OrchestratorAction;
  userMessage?: string;
  rationaleSummary?: string;
  confidence?: number;
  payload: Record<string, unknown>;
}
```

`payload` is validated again against the selected action-specific schema. AI confidence is not an authorization field.

---

---

## J01-PROTO-11 — PROJECT AND EXECUTION SCOPE

```ts
interface Project {
  projectId: ProjectId;
  name: string;
  aliases: string[];
  rootPath: PlatformPathRef;
  defaultEnvironmentId?: EnvironmentId;
  defaultBranch?: string;
  enabled: boolean;
  version: number;
}

type ExecutionScope =
  | ProjectWorkspaceScope
  | IntegrationScope
  | SystemScope
  | GlobalScope;

interface ProjectWorkspaceScope {
  kind: 'PROJECT_WORKSPACE';
  projectId: ProjectId;
  workspaceId: WorkspaceId;
  environmentId?: EnvironmentId;
}

interface IntegrationBinding {
  integrationId: IntegrationId;
  accountId: IntegrationAccountId;
  capabilityIds: string[];
}

interface IntegrationScope {
  kind: 'INTEGRATION';
  bindings: IntegrationBinding[];
  projectId?: ProjectId;
  environmentId?: EnvironmentId;
}

interface SystemScope {
  kind: 'SYSTEM';
  capabilityIds: string[];
  environmentId?: EnvironmentId;
}

interface GlobalScope {
  kind: 'GLOBAL';
}
```

Rules:

- filesystem/repository/project-write tools require `PROJECT_WORKSPACE`;
- `INTEGRATION`, `SYSTEM`, and `GLOBAL` do not gain filesystem authority implicitly;
- `GLOBAL` itself grants no consequential tool authority;
- project/workspace/environment/account identities are stable IDs, never display-name guesses;
- a `PlatformPathRef` SHALL be interpreted only by the matching platform-aware path service or an explicit migration/import process.

---

---

## J01-PROTO-12 — AUTHORITY ENVELOPE

```ts
type ActionClass =
  | 'READ'
  | 'LOCAL_WRITE'
  | 'EXTERNAL_WRITE'
  | 'PUBLISH'
  | 'DEPLOY'
  | 'INFRASTRUCTURE_CHANGE'
  | 'SECURITY_CHANGE'
  | 'DESTRUCTIVE';

interface AuthorityEnvelope {
  id: AuthorityEnvelopeId;
  originatingInstructionId: UUIDv7;
  scopes: ExecutionScope[];
  allowedActionClasses: ActionClass[];
  deniedActionClasses: ActionClass[];
  externalSystems: string[];
  dataPolicy: DataPolicy;
  maxBudget?: MoneyAmount;
  createdAt: UtcTimestamp;
  expiresAt?: UtcTimestamp;
  policySnapshotVersion: number;
}
```

An envelope is immutable for an active attempt. A broader scope requires a new validated authority/revision record.

---

---

## J01-PROTO-13 — MISSIONS, TASKS, ATTEMPTS

```ts
type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';

type MissionState =
  | 'CREATED' | 'PLANNING' | 'QUEUED' | 'RUNNING'
  | 'WAITING_FOR_USER' | 'WAITING_FOR_APPROVAL'
  | 'PAUSING' | 'PAUSED' | 'BLOCKED' | 'VERIFYING'
  | 'RECOVERING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

type TaskState =
  | 'CREATED' | 'WAITING_FOR_DEPENDENCY' | 'QUEUED' | 'STARTING'
  | 'RUNNING' | 'WAITING_FOR_APPROVAL' | 'PAUSING' | 'PAUSED'
  | 'RESUMING' | 'BLOCKED' | 'VERIFYING' | 'RECOVERING'
  | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INVALIDATED';

type AttemptState =
  | 'QUEUED' | 'STARTING' | 'RUNNING' | 'CHECKPOINTING'
  | 'WAITING_FOR_APPROVAL' | 'PAUSING' | 'PAUSED'
  | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT' | 'UNCERTAIN';

type WorkerRole =
  | 'GENERALIST'
  | 'SOFTWARE_ENGINEER'
  | 'RESEARCHER'
  | 'VERIFIER'
  | 'SYNTHESIZER'
  | 'DATA_ANALYST';

type RecoveryPolicy =
  | 'SAFE_TO_RETRY'
  | 'VERIFY_THEN_RESUME'
  | 'REQUIRES_USER'
  | 'DO_NOT_AUTO_RESUME';

type PreemptionPolicy =
  | 'PREEMPTIBLE'
  | 'SAFE_POINT_ONLY'
  | 'TEMPORARILY_NON_PREEMPTIBLE';

interface Mission {
  missionId: MissionId;
  title: string;
  goal: string;
  state: MissionState;
  projectIds: ProjectId[];
  activeGraphVersion: number | null;
  authorityEnvelopeId: AuthorityEnvelopeId;
  priority: Priority;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  version: number;
}

interface Task {
  taskId: TaskId;
  missionId: MissionId;
  graphVersion: number;
  title: string;
  goal: string;
  state: TaskState;
  role: WorkerRole;
  executionScope: ExecutionScope;
  dataPolicy: DataPolicy;
  priority: Priority;
  authorityEnvelopeId: AuthorityEnvelopeId;
  recoveryPolicy: RecoveryPolicy;
  preemptionPolicy: PreemptionPolicy;
  acceptanceCriteria: AcceptanceCriterion[];
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
  version: number;
}

interface TaskAttempt {
  attemptId: AttemptId;
  taskId: TaskId;
  state: AttemptState;
  providerId: ProviderId;
  providerVersion?: string;
  modelId?: string;
  platform: PlatformRuntimeIdentity;
  startedAt?: UtcTimestamp;
  endedAt?: UtcTimestamp;
  retryOfAttemptId?: AttemptId;
  routingReason: string;
  error?: JarvisError;
}
```

`RESUMING` is one durable TaskState. It is not a transient alias outside the state model.

---

---

## J01-PROTO-14 — ACCEPTANCE AND GRAPH VERSIONING

```ts
type CriterionType =
  | 'TEST' | 'COMMAND' | 'FILE_STATE' | 'LIVE_STATE'
  | 'SCHEMA' | 'REVIEW' | 'CUSTOM';

type CriterionVerdict = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

interface AcceptanceCriterion {
  id: string;
  type: CriterionType;
  description: string;
  required: boolean;
  verifier: Record<string, unknown>;
}

interface CriterionResult {
  criterionId: string;
  verdict: CriterionVerdict;
  evidence: ArtifactRef[];
  summary: string;
  verifiedAt: UtcTimestamp;
  verifierType:
    | 'DETERMINISTIC'
    | 'LIVE_STATE'
    | 'INDEPENDENT_AI'
    | 'PRODUCER_SELF_CHECK';
}

type DependencyType =
  | 'REQUIRES_SUCCESS'
  | 'REQUIRES_COMPLETION'
  | 'REQUIRES_OUTPUT'
  | 'OPTIONAL_INPUT';

interface TaskDependency {
  fromTaskId: TaskId;
  toTaskId: TaskId;
  type: DependencyType;
  outputKey?: string;
}

interface MissionAcceptancePolicy {
  criteria: AcceptanceCriterion[];
}

interface MissionGraphVersion {
  missionId: MissionId;
  version: number;
  createdAt: UtcTimestamp;
  reason: string;
  causationEventId: EventId;
  taskIds: TaskId[];
  edges: TaskDependency[];
  acceptancePolicy: MissionAcceptancePolicy;
}
```

Activated graph versions are immutable. Core validates acyclicity, dependencies, scope coherence, acceptance policy, and authority before activation.

---

---

## J01-PROTO-15 — CHECKPOINTS, ARTIFACTS, RESULTS

```ts
interface ArtifactRef {
  artifactId: ArtifactId;
  logicalType: string;
  contentType: string;
  size: number;
  sha256?: string;
  dataPolicy: DataPolicy;
}

interface ProviderResumeReference {
  providerId: ProviderId;
  providerVersion?: string;
  modelId?: string;
  handle: string;
  createdAt: UtcTimestamp;
  lastVerifiedAt?: UtcTimestamp;
}

interface WorkerCheckpoint {
  checkpointId: UUIDv7;
  taskId: TaskId;
  attemptId: AttemptId;
  sequence: number;
  createdAt: UtcTimestamp;
  goalSummary: string;
  completedWork: string[];
  decisions: string[];
  findings: string[];
  artifacts: ArtifactRef[];
  verificationState: CriterionResult[];
  currentActivity: string;
  nextStep?: string;
  blockers: string[];
  liveStateAssumptions: string[];
  providerResume?: ProviderResumeReference;
}

type WorkerResultKind =
  | 'COMPLETION_PROPOSAL'
  | 'BLOCKED'
  | 'REPLAN_REQUESTED'
  | 'FAILED';

interface WorkerResult {
  schemaVersion: 1;
  kind: WorkerResultKind;
  taskId: TaskId;
  attemptId: AttemptId;
  summary: string;
  findings: string[];
  artifacts: ArtifactRef[];
  criterionResults: CriterionResult[];
  unresolvedRisks: string[];
  proposedNextActions: string[];
}
```

Provider resume handles are opaque potentially expiring capability material. They are optional continuity optimizations, not durable task truth.

---

---

## J01-PROTO-16 — TOOL MANIFEST AND OUTCOMES

```ts
type RiskClass = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

type SideEffectClass =
  | 'READ_ONLY'
  | 'REVERSIBLE_WRITE'
  | 'EXTERNAL_WRITE'
  | 'DESTRUCTIVE';

type ToolCheckKind =
  | 'STATE_QUERY'
  | 'FILE_STATE'
  | 'PROCESS_STATE'
  | 'INTEGRATION_STATE'
  | 'CUSTOM_VERIFIER';

interface ToolCheckSpec {
  checkId: string;
  kind: ToolCheckKind;
  verifierId: string;
  parametersSchemaId: string;
  required: boolean;
  timeoutMs?: number;
  onUnknown: 'FAIL' | 'UNCERTAIN';
}

interface ToolManifest {
  toolId: string;
  version: number;
  description: string;
  inputSchemaId: string;
  outputSchemaId: string;
  baselineRisk: RiskClass;
  sideEffectClass: SideEffectClass;
  reversible: boolean;
  requiredPermissionIds: string[];
  allowedEnvironments: string[];
  allowedScopeKinds: ExecutionScope['kind'][];
  secretCapabilities: string[];
  networkRequired: boolean;
  requiredPlatformCapabilities: string[];
  platformCompatibility?: PlatformCompatibility[];
  idempotency:
    | 'IDEMPOTENT'
    | 'IDEMPOTENCY_KEY'
    | 'NON_IDEMPOTENT'
    | 'UNKNOWN';
  preconditions: ToolCheckSpec[];
  postconditions: ToolCheckSpec[];
  preemptionPolicy: PreemptionPolicy;
}

interface ToolRequest {
  toolExecutionId: UUIDv7;
  toolId: string;
  toolVersion: number;
  taskId?: TaskId;
  executionScope: ExecutionScope;
  authorityEnvelopeId: AuthorityEnvelopeId;
  arguments: Record<string, unknown>;
  idempotencyKey?: string;
}

type ToolOutcome = 'SUCCEEDED' | 'FAILED' | 'DENIED' | 'CANCELLED' | 'UNCERTAIN';

interface ToolResult {
  toolExecutionId: UUIDv7;
  outcome: ToolOutcome;
  output?: Record<string, unknown>;
  artifacts?: ArtifactRef[];
  preconditions?: CriterionResult[];
  postconditions?: CriterionResult[];
  error?: JarvisError;
  startedAt: UtcTimestamp;
  endedAt: UtcTimestamp;
}
```

A missing/invalid manifest blocks AI execution. Consequential success requires declared postcondition evidence or explicit `UNCERTAIN` semantics.

Platform compatibility/technical availability is not action authority.

---

---

## J01-PROTO-17 — PERMISSION DECISION

```ts
type PermissionOutcome = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

interface PermissionDecision {
  decisionId: UUIDv7;
  toolExecutionId?: UUIDv7;
  taskId?: TaskId;
  outcome: PermissionOutcome;
  contextualRisk: RiskClass;
  reasonCodes: string[];
  matchedPolicyIds: string[];
  matchedPrecedentIds: UUIDv7[];
  approvalRequestId?: ApprovalId;
  decidedAt: UtcTimestamp;
  policyVersion: number;
}
```

Only deterministic Core policy produces an authoritative PermissionDecision.

---

---

## J01-PROTO-18 — CANONICAL ACTION DESCRIPTOR AND APPROVAL

```ts
interface CanonicalTargetRef {
  system: string;
  accountId?: string;
  environmentId?: string;
  resourceType: string;
  resourceId: string;
}

interface CanonicalActionDescriptorV1 {
  domain: 'jarvis.approval.action.v1';
  descriptorVersion: 1;
  toolId: string;
  toolVersion: number;
  actionClass: ActionClass;
  sideEffectClass: SideEffectClass;
  executionScope: ExecutionScope;
  targets: CanonicalTargetRef[];
  arguments: Record<string, unknown>;
  integrationBindings?: Array<{
    integrationId: IntegrationId;
    accountId: IntegrationAccountId;
  }>;
  authorityEnvelopeId: AuthorityEnvelopeId;
  policySnapshotVersion: number;
}

interface ApprovalRequest {
  approvalId: ApprovalId;
  kind: 'HIGH_RISK' | 'DESTRUCTIVE_FINAL_CONFIRMATION';
  descriptorVersion: 1;
  actionDigestAlgorithm: 'SHA-256';
  actionDigestEncoding: 'BASE64URL_NOPAD';
  actionDigest: string;
  actionSummary: string;
  targetSummary: string;
  environmentSummary?: string;
  consequenceSummary: string;
  createdAt: UtcTimestamp;
  expiresAt: UtcTimestamp;
}

type ApprovalStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED'
  | 'EXPIRED' | 'CANCELLED' | 'CONSUMED';
```

The digest pipeline is exactly:

```text
CanonicalActionDescriptorV1
→ schema validation
→ RFC 8785 JCS canonical JSON
→ UTF-8 bytes
→ SHA-256
→ base64url without padding
```

Canonicalization rejects duplicate object keys before materialization, non-finite numbers, negative zero, invalid Unicode, and unsafe numeric ambiguity. High-precision domain values use schema-defined integer/decimal strings.

Immediately before approval consumption JARVIS freshly resolves material identities/arguments, rebuilds the descriptor, recomputes the digest, and rejects any mismatch. Digest equality never bypasses expiry, single-use, session/policy, or transactional consumption checks.

Raw credentials never enter the descriptor.

---

---

## J01-PROTO-19 — PROVIDER SETUP, COMPATIBILITY, HEALTH, RESOURCES, PLATFORM

```ts
type ProviderSetupState =
  | 'NOT_REQUIRED'
  | 'SETUP_REQUIRED'
  | 'SETUP_IN_PROGRESS'
  | 'SETUP_READY'
  | 'REPAIR_REQUIRED'
  | 'SETUP_FAILED';

type ProviderCompatibilityState =
  | 'NOT_DETECTED'
  | 'VERSION_UNKNOWN'
  | 'VERSION_UNSUPPORTED'
  | 'CONFORMANCE_UNQUALIFIED'
  | 'COMPATIBLE';

type ProviderHealth =
  | 'STARTING'
  | 'READY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'FAILED';

interface ProviderCapabilities {
  naturalLanguage?: boolean;
  structuredOutput?: boolean;
  toolUse?: boolean;
  coding?: boolean;
  research?: boolean;
  vision?: boolean;
  streaming?: boolean;
  resumableSession?: boolean;
  maxContextTokens?: number;
  locality: 'LOCAL' | 'CLOUD' | 'LAN';
}

interface ProviderResourceProfile {
  memoryMb?: number;
  gpuVramMb?: number;
  cpuClass?: 'LOW' | 'MEDIUM' | 'HIGH';
  gpuRequired?: boolean;
  warmupMs?: number;
  unloadable?: boolean;
}

interface ProviderProfile {
  providerId: ProviderId;
  adapterType: string;
  adapterVersion: string;
  providerVersion?: string;
  modelId?: string;
  platform: PlatformRuntimeIdentity;
  setup: ProviderSetupState;
  compatibility: ProviderCompatibilityState;
  capabilities: ProviderCapabilities;
  costClass: 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  latencyClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  health: ProviderHealth;
  resources?: ProviderResourceProfile;
}

interface ProviderCompatibilityPolicy {
  providerId: ProviderId;
  adapterVersion: string;
  platformCompatibility: PlatformCompatibility[];
  acceptedVersions: Array<
    | { kind: 'EXACT'; version: string }
    | { kind: 'RANGE'; range: string }
  >;
  deniedVersions?: string[];
  requiredCapabilities: string[];
  conformanceProfileId: string;
  setupPolicyId?: string;
}
```

`SUPPORTED` requires compatible version/interface, required setup ready, current health/auth/capabilities, matching platform/runtime role, and platform-specific conformance evidence where native behavior matters. Executable presence alone is insufficient.

---

---

## J01-PROTO-20 — MODULE EXECUTION AND MANIFEST

```ts
type ModuleExecutionClass =
  | 'DATA_ONLY'
  | 'BUILT_IN_TRUSTED'
  | 'EXTERNAL_MANAGED';

type ModuleHealthCheck =
  | { kind: 'PROCESS_READY'; timeoutMs: number }
  | { kind: 'IPC_PROBE'; method: string; timeoutMs: number }
  | { kind: 'HTTP_LOCAL_PROBE'; endpointId: string; timeoutMs: number };

interface ModuleLifecycleMetadata {
  activationBoundary: 'SAFE_BOUNDARY' | 'APP_RESTART';
  rollbackSupported: boolean;
  retainsPreviousVersion: boolean;
}

interface ModuleManifest {
  moduleId: ModuleId;
  version: string;
  displayName: string;
  publisher: string;
  source: string;
  executionClass: ModuleExecutionClass;
  compatibility: {
    jarvis: string;
    platforms: PlatformCompatibility[];
  };
  capabilities: string[];
  requestedPermissions: string[];
  networkBehavior: string[];
  resourceHints?: {
    memoryMb?: number;
    gpuVramMb?: number;
    cpuClass?: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  healthCheck: ModuleHealthCheck;
  integrity: {
    sha256: string;
    signature?: string;
    catalogEntryId: string;
    catalogSignature: string;
    catalogKeyId: string;
  };
  lifecycle: ModuleLifecycleMetadata;
}

interface ModuleCapabilityEnvelope {
  moduleId: ModuleId;
  moduleVersion: string;
  allowedApiIds: string[];
  projectIds: ProjectId[];
  environmentIds: EnvironmentId[];
  credentialCapabilities: string[];
  networkPolicyId?: string;
  sensitivity: DataSensitivity;
  locality: DataLocality;
  resourcePolicyId?: string;
}
```

There is no untrusted-in-process execution class. `HTTP_LOCAL_PROBE.endpointId` resolves only to a supervisor-registered local endpoint, never an arbitrary URL.

Platform compatibility does not itself enable/install/authorize a module.

---

---

## J01-PROTO-21 — INTEGRATION ACCOUNT, GITHUB, AND PROXMOX

```ts
interface IntegrationAccount {
  integrationId: IntegrationId;
  accountId: IntegrationAccountId;
  displayName: string;
  tenantOrDomain?: string;
  credentialHandle: string;
  enabledCapabilities: string[];
  grantedScopes: string[];
  status: 'CONNECTED' | 'DEGRADED' | 'REAUTH_REQUIRED' | 'DISABLED' | 'ERROR';
  lastVerifiedAt?: UtcTimestamp;
}

type GitHubCapability =
  | 'GITHUB_REPOSITORY_READ'
  | 'GITHUB_REF_READ'
  | 'GITHUB_REF_WRITE'
  | 'GITHUB_PULL_REQUEST_READ'
  | 'GITHUB_PULL_REQUEST_WRITE'
  | 'GITHUB_ISSUE_READ'
  | 'GITHUB_COMMENT_WRITE'
  | 'GITHUB_CHECKS_READ'
  | 'GITHUB_ACTIONS_READ'
  | 'GITHUB_ACTIONS_DISPATCH';

type ProxmoxCapability =
  | 'PROXMOX_READ'
  | 'PROXMOX_POWER_CONTROL'
  | 'PROXMOX_SNAPSHOT'
  | 'PROXMOX_BACKUP'
  | 'PROXMOX_GUEST_CONFIG'
  | 'PROXMOX_GUEST_CREATE'
  | 'PROXMOX_MIGRATE'
  | 'PROXMOX_STORAGE_WRITE'
  | 'PROXMOX_NETWORK_WRITE'
  | 'PROXMOX_DESTROY';

interface ProxmoxConnection {
  connectionId: ConnectionId;
  displayName: string;
  endpoint: string;
  credentialHandle: string;
  tlsTrust:
    | { mode: 'SYSTEM_CA' }
    | { mode: 'PINNED_SHA256'; fingerprint: string };
  environmentId: EnvironmentId;
  enabledCapabilities: ProxmoxCapability[];
  allowedNodes?: string[];
  allowedVmids?: number[];
  allowedPools?: string[];
  status: 'CONNECTED' | 'DEGRADED' | 'REAUTH_REQUIRED' | 'DISABLED' | 'ERROR';
  lastVerifiedAt?: UtcTimestamp;
}

interface ProxmoxGuestIdentity {
  connectionId: ConnectionId;
  environmentId: EnvironmentId;
  nodeId: string;
  guestType: 'QEMU' | 'LXC';
  vmid: number;
}
```

GitHub/Proxmox capability support claims are governed by the active Release Profile and platform support matrix. Modeling a capability does not mean the current release/platform supports it.

Proxmox control-plane identity is separate from guest OS connection/credential identity.

---

---

## J01-PROTO-22 — PROVIDER QUOTA, USAGE, BUDGET RESERVATION

```ts
type ProviderQuotaType =
  | 'MONETARY' | 'TOKENS' | 'REQUESTS'
  | 'COMPUTE' | 'SUBSCRIPTION_ALLOWANCE' | 'OTHER';

type ProviderQuotaSource = 'PROVIDER_REPORTED' | 'JARVIS_CALCULATED' | 'UNKNOWN';

interface ProviderQuotaSnapshot {
  snapshotId: UUIDv7;
  providerId: ProviderId;
  modelId?: string;
  accountId?: UUIDv7;
  quotaType: ProviderQuotaType;
  unit: string;
  limit?: CanonicalQuantity;
  used?: CanonicalQuantity;
  remaining?: CanonicalQuantity;
  resetsAt?: UtcTimestamp;
  observedAt: UtcTimestamp;
  source: ProviderQuotaSource;
}

type CostConfidence =
  | 'ESTIMATED'
  | 'PROVIDER_REPORTED'
  | 'JARVIS_CALCULATED'
  | 'SETTLED'
  | 'UNKNOWN';

interface UsageRecord {
  usageId: UUIDv7;
  providerId: ProviderId;
  modelId?: string;
  projectId?: ProjectId;
  missionId?: MissionId;
  taskId?: TaskId;
  attemptId?: AttemptId;
  units?: Record<string, CanonicalQuantity>;
  estimatedCost?: MoneyAmount;
  actualCost?: MoneyAmount;
  costConfidence: CostConfidence;
  pricingSnapshotId?: UUIDv7;
  occurredAt: UtcTimestamp;
}

interface BudgetPolicy {
  budgetId: UUIDv7;
  scopeType: 'GLOBAL' | 'PROJECT' | 'MISSION' | 'PROVIDER';
  scopeId?: string;
  limit: MoneyAmount;
  warningAtBasisPoints: number;
  hardLimit: boolean;
  period: 'MISSION' | 'DAY' | 'MONTH' | 'CUSTOM';
}

type BudgetReservationState =
  | 'RESERVED' | 'SETTLED' | 'RELEASED' | 'EXPIRED' | 'UNCERTAIN';

interface BudgetReservation {
  reservationId: UUIDv7;
  budgetId: UUIDv7;
  providerId: ProviderId;
  taskId?: TaskId;
  attemptId?: AttemptId;
  amount: MoneyAmount;
  state: BudgetReservationState;
  createdAt: UtcTimestamp;
  expiresAt?: UtcTimestamp;
  settledUsageId?: UUIDv7;
}
```

Different currencies SHALL not be added without a separately defined conversion policy.

---

---

## J01-PROTO-23 — DOMAIN EVENTS

```ts
interface DomainEvent<T = unknown> {
  eventId: EventId;
  occurredAt: UtcTimestamp;
  type: string;
  payloadVersion: number;
  aggregateType: string;
  aggregateId: string;
  correlationId: UUIDv7;
  causationId?: UUIDv7;
  actorType:
    | 'USER' | 'CORE' | 'WORKER' | 'PROVIDER'
    | 'INTEGRATION' | 'MODULE' | 'SYSTEM';
  actorId?: string;
  payload: T;
}
```

Event payloads are independently versioned. Authoritative events use stable dot-notation names.

---

---

## J01-PROTO-24 — NOTIFICATION AND CONFIGURATION

```ts
type NotificationSeverity = 'CRITICAL' | 'IMPORTANT' | 'NORMAL' | 'LOW_VALUE';
type NotificationChannel = 'VOICE' | 'DESKTOP' | 'DASHBOARD' | 'SILENT';

interface NotificationDecision {
  notificationId: UUIDv7;
  severity: NotificationSeverity;
  channels: NotificationChannel[];
  title: string;
  body: string;
  dataPolicy: DataPolicy;
  deferUntilUnlocked: boolean;
}
```

Configuration domains are typed/versioned and include at least startup, session security, voice, providers, privacy, permissions, budgets, projects, modules, integrations, notifications, retention, updates, platform backend profile, and developer mode. Normal configuration never accepts raw secrets.

---

---

## J01-PROTO-25 — CRYPTOGRAPHIC CANONICALIZATION RULES

Security-material canonicalization is one shared implementation contract.

Required Rust/TypeScript golden vectors cover:

- property order invariance;
- Unicode;
- optional/empty fields;
- canonical IDs/paths/resources;
- integration/account bindings;
- target/environment/argument/tool-version changes;
- duplicate-key rejection;
- NaN/infinity/negative-zero rejection;
- unsafe numeric precision rejection/string representation;
- expired approval rejection despite matching digest;
- second consumption/replay rejection;
- secret exclusion.

No adapter/tool chooses its own approval material field set.

---

---

## J01-PROTO-26 — PROTOCOL COMPATIBILITY

After the first production protocol-major 1 release:

- adding optional fields is compatible only if receivers safely ignore them;
- removing/renaming required fields is breaking;
- changing the meaning of an enum value is breaking;
- adding enum values requires safe unknown handling or version negotiation;
- breaking IPC changes require protocol-major bump;
- persisted events retain independent `payloadVersion`;
- persistence schema changes follow migration rules even if IPC is unchanged.

Host and Core SHALL establish a mutually supported protocol major before normal operation.

Contract-suite version changes do not automatically require an IPC protocol-major change when wire compatibility is preserved.

These pre-production schema changes occur before the first production protocol-major-1 release, so platform-neutralizing the schema does not require protocol major 2.

---

---

## J01-PROTO-27 — SCHEMA QUALIFICATION

CI/release qualification SHALL prove:

- positive and negative fixtures for every boundary schema;
- Rust/TypeScript round-trip compatibility;
- explicit IpcResponse union behavior;
- PlatformFamily/RuntimeRole/PlatformRuntimeIdentity validation;
- PlatformPathRef cannot be interpreted by the wrong platform path backend without explicit migration/import;
- provider/module/tool platform compatibility schemas;
- one durable `RESUMING` enum meaning;
- execution-scope enforcement;
- sensitivity/locality propagation;
- exact money arithmetic/serialization;
- Argon2id profile validation and under-floor production rejection;
- provider setup/compatibility/health/platform separation;
- module execution-class/health/lifecycle/platform validation;
- approval canonicalization/digest vectors;
- GitHub/Proxmox capability schemas;
- Proxmox identity schemas;
- unbounded arbitrary AI/external fields are not introduced;
- secret-bearing fields are absent from AI/UI-safe views.

---

---

## J01-PROTO-28 — GOVERNING RULES

> **Cross a boundary only with a versioned, validated, bounded contract.**

> **Authorize the canonical resolved action, not ambiguous display text.**

> **Provider setup, compatibility, health, capability, platform support, and authorization are different facts.**

> **Platform identity belongs in typed compatibility/state, not scattered native assumptions.**

---

**END — JARVIS RUNTIME, PLATFORM & PROTOCOL CONTRACT v1.0.8**
