# ADR-061 — Application-Owned JARVIS Core Runtime

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Runtime/release architecture hardening  
**Scope:** JARVIS v1.0 production packaging and Core launch

## Context

The JARVIS runtime contract defines the authoritative Core as a separate Node.js/TypeScript process supervised by the Rust/Tauri native host.

That process boundary is intentional and remains unchanged. What was not yet explicit is how the production Node.js runtime is supplied and selected.

Allowing production JARVIS to discover or use an arbitrary system `node.exe` through `PATH` would make the trusted runtime dependent on machine-local developer configuration, installed Node versions, environment variables, and executable search order. That would weaken reproducibility, release qualification, rollback, startup diagnostics, and supply-chain control.

A production desktop application should carry and verify the runtime it was qualified against.

---

## Decision

Production JARVIS SHALL ship an application-owned, release-pinned Node.js runtime together with the bundled JARVIS Core application.

The Rust native host SHALL launch the Core using the exact application-owned runtime path from the active JARVIS release.

Production JARVIS SHALL NOT discover, require, or silently fall back to an arbitrary system Node.js installation.

The logical production process remains:

```text
jarvis-desktop.exe (Rust/Tauri host)
        |
        | exact verified release-owned path
        v
bundled Node.js runtime
        |
        v
bundled JARVIS Core
```

This ADR changes runtime ownership and packaging, not the Host ↔ Core process boundary.

---

## 1. Production release unit

A qualified JARVIS release SHALL treat the following as one compatible release unit:

```text
Rust/Tauri host version
React/WebView application version
JARVIS Core version
Node.js runtime version
Core protocol/schema compatibility
required native/runtime assets
```

The installer/updater SHALL deploy the compatible set together.

A Core/runtime pair SHALL NOT be independently replaced in production unless the replacement has passed the same compatibility and release gates as a normal JARVIS release.

---

## 2. Application-owned runtime path

The production layout MAY vary by installer technology, but it SHALL be equivalent to:

```text
<JARVIS release>\
  jarvis-desktop.exe
  core\
    runtime\
      node.exe
    jarvis-core.bundle.js
    runtime-manifest.json
    assets\
```

The native host SHALL resolve the Core runtime from the active signed/verified JARVIS release location.

It SHALL NOT perform a generic executable lookup equivalent to:

```text
node
node.exe
where node
PATH search
registry-based discovery of unrelated Node installations
```

for production Core launch.

---

## 3. No silent system-runtime fallback

If the application-owned runtime is missing, corrupt, incompatible, or fails integrity validation, JARVIS SHALL fail closed into repair/recovery/diagnostics behavior.

It SHALL NOT:

- use a different Node version found on `PATH`;
- use a developer-installed Node version;
- download the latest Node release ad hoc;
- ask the user to install Node manually as the normal production recovery path;
- continue with an unqualified runtime merely to make startup succeed.

Repair or rollback SHALL restore a previously qualified JARVIS release/runtime pair.

---

## 4. Release-pinned Node version

Each JARVIS release SHALL declare the exact Node.js runtime version and target architecture it ships.

The selected version SHOULD be a supported Node.js release line appropriate for production at the time that JARVIS release is built and qualified.

Upgrading Node.js is a JARVIS release change and SHALL trigger compatibility testing for:

- Core startup;
- IPC framing and authentication;
- SQLite/native dependencies if any;
- provider adapters;
- integration adapters;
- module supervision;
- child-process behavior;
- shutdown/cancellation;
- crash recovery;
- packaging and Windows code-signing interactions.

Production SHALL NOT automatically track "latest Node" independently of JARVIS releases.

---

## 5. Bundled Core application

Production installation SHALL contain a prebuilt Core application and its required runtime assets.

The end-user machine SHALL NOT need to perform normal application dependency installation such as:

```text
npm install
pnpm install
yarn install
```

as part of first launch or ordinary startup.

Package resolution and dependency installation belong to the controlled build/release pipeline.

Where practical, the Core SHOULD be bundled to minimize the production dependency surface. Required native modules or non-bundleable runtime assets MAY remain separate when necessary, but they SHALL be included in the release manifest and qualified as part of the release.

---

## 6. Runtime manifest and integrity

Each production release SHALL contain or expose signed-release metadata equivalent to:

```ts
interface CoreRuntimeManifest {
  manifestVersion: number;

  jarvisReleaseVersion: string;
  coreVersion: string;
  nodeVersion: string;
  target: string;

  protocolVersion: number;
  minimumDataSchemaVersion: number;
  maximumDataSchemaVersion: number;

  files: {
    relativePath: string;
    sha256: string;
  }[];
}
```

Exact schema ownership MAY be refined during implementation, but these semantics are binding.

Before launching the authoritative Core, the native host SHALL verify enough release/runtime metadata to establish that:

- the selected runtime belongs to the active JARVIS release;
- the expected Core entry point exists;
- required protocol compatibility is satisfied;
- the release/runtime integrity checks required by the signed installer/update contract pass.

Integrity verification SHALL integrate with the existing signed release/update trust model rather than creating an unrelated parallel trust system.

---

## 7. Controlled Core environment

The Rust host SHALL construct a controlled environment for the Core rather than blindly inheriting all process-specific Node configuration from the user's interactive shell.

Production Core launch SHALL explicitly handle or remove environment variables that can materially alter Node execution, including equivalents of:

```text
NODE_OPTIONS
NODE_PATH
```

unless a particular value is intentionally supplied by JARVIS itself.

Other inherited variables SHALL be minimized where doing so does not break required Windows/runtime behavior.

The production Core SHALL receive only the environment needed for its approved operation, including explicitly constructed JARVIS paths, bootstrap-channel information, locale/system requirements, and other registered runtime values.

Secrets SHALL follow the existing secure bootstrap/Credential Broker rules and SHALL NOT be placed into the command line merely because the runtime is bundled.

---

## 8. Working directory and path control

The native host SHALL set an explicit Core working directory appropriate to the active release/runtime.

The Core SHALL NOT depend on the user's current shell directory.

Mutable state SHALL remain under the established per-user JARVIS data directories and SHALL NOT be written into the immutable application release directory during ordinary operation.

Relative path resolution that affects trusted runtime resources SHALL be anchored to verified JARVIS-owned paths rather than process-launch accident.

---

## 9. Windows architecture and packaging

The packaged Node runtime SHALL match the supported JARVIS Windows target architecture.

The release pipeline SHALL verify that the expected runtime binary and required native dependencies are packaged for each supported target.

Tauri sidecar/external-binary packaging MAY be used as the physical delivery mechanism, but the governing requirement is application ownership and exact-path launch, not a specific Tauri configuration syntax.

The Node runtime and Core assets SHALL participate in installer/update integrity, provenance, and release verification.

---

## 10. Update and rollback atomicity

Node runtime upgrades SHALL be staged and activated with the corresponding JARVIS release.

The updater SHALL preserve the ability to restore the last known-good compatible release pair when rollback is supported.

A rollback SHALL restore the matching:

```text
native host
Core
Node runtime
runtime assets
```

rather than combining an old Core with a newly installed runtime unless that exact combination was independently qualified.

A failed Core/runtime activation SHALL not trigger system-Node fallback.

---

## 11. Development mode

This ADR does not restrict normal developer workflows.

Development MAY use developer-managed Node.js installations, package managers, test runners, TypeScript execution tools, hot reload, and other local tooling.

Development and production SHALL remain explicitly distinct:

```text
DEVELOPMENT
  developer toolchain allowed

PRODUCTION
  application-owned qualified runtime only
```

A production build SHALL not accidentally inherit the development runtime-selection behavior.

---

## 12. Single Executable Application (SEA)

Node.js Single Executable Application packaging or an equivalent future mechanism MAY later replace the physical `node.exe + Core bundle` layout.

SEA is not mandatory for JARVIS V1.

A migration to SEA SHALL be accepted only after explicit production qualification covering at least:

- required Node/runtime features;
- bundled assets;
- native dependencies;
- Windows signing;
- updater/rollback behavior;
- diagnostics and crash reporting;
- startup and IPC behavior;
- provider/integration compatibility.

If qualified later, the logical architecture SHALL remain a separately supervised JARVIS Core process unless another accepted ADR changes that boundary.

---

## 13. Failure behavior

Runtime failures SHALL produce explicit diagnosable states.

Examples include:

```text
CORE_RUNTIME_MISSING
CORE_RUNTIME_INTEGRITY_FAILED
CORE_RUNTIME_INCOMPATIBLE
CORE_ENTRYPOINT_MISSING
CORE_START_FAILED
CORE_PROTOCOL_INCOMPATIBLE
```

Exact error identifiers MAY be normalized later in the protocol contract.

The UI SHALL surface repair/rollback guidance rather than presenting normal readiness.

---

## 14. Verification requirements

Production verification SHALL include at minimum:

1. clean Windows installation on a machine with no system Node.js installed;
2. successful Core launch using only the packaged runtime;
3. installation on a machine with an incompatible system Node version, proving JARVIS ignores it for Core launch;
4. installation with a malicious or dummy `node.exe` earlier in `PATH`, proving it is not selected;
5. mutation/removal of the bundled runtime, proving startup fails closed into recovery rather than falling back;
6. `NODE_OPTIONS`/`NODE_PATH` contamination tests proving user shell configuration cannot silently alter production Core execution;
7. runtime-manifest/protocol compatibility rejection tests;
8. installer/update tests proving runtime and Core upgrade together;
9. rollback tests proving the previous compatible runtime/Core pair is restored together;
10. clean uninstall/repair behavior for packaged runtime assets;
11. code-signing/integrity/provenance verification covering the runtime and Core artifacts;
12. target-architecture packaging verification.

---

## Non-goals

This ADR does not require:

- merging the Node Core into Rust;
- requiring Node SEA in V1;
- preventing developers from using local Node installations;
- inventing a custom JavaScript runtime;
- downloading Node dynamically at first launch;
- exposing Node or npm as a general JARVIS user tool merely because Node is bundled internally.

---

## Consequences

### Positive

- production startup is independent of machine-local Node configuration;
- the exact Core/runtime pair can be qualified and reproduced;
- update and rollback behavior becomes deterministic;
- installer behavior is self-contained;
- arbitrary `PATH` resolution is removed from the trusted Core launch path;
- runtime compatibility failures become diagnosable rather than accidental;
- supply-chain verification covers the actual runtime JARVIS executes.

### Trade-offs

- installer/update size increases by the packaged runtime size;
- each supported architecture requires packaging the matching runtime;
- Node security/runtime updates must flow through the JARVIS release process;
- release qualification must include the packaged runtime rather than assuming the user's system runtime is maintained separately.

These costs are appropriate for a production desktop application whose authoritative Core depends on Node.js.

---

## Governing Principle

> **The JARVIS release owns the runtime that executes its authoritative Core. Production never delegates that trust decision to the user's PATH.**
