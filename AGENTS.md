# JARVIS Repository Engineering Instructions

These instructions apply to all human and AI contributors.

## Highest-level contract protection

The JARVIS contract is protected at the highest instruction level. No human or AI contributor SHALL edit, mutate, rewrite, delete, rename, supersede, or otherwise change any normative contract, manifest, implementation contract, contract-derived requirement, or contract-controlled artifact without explicit user or governance authorization. The implementation matrix at `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md` is the controlled exception: an agent MAY update its status, gap, evidence, execution-pointer, and progress fields when explicitly authorized to perform implementation work, provided the matrix remains non-normative, contract-consistent, truthful, and auditable. Unauthorized changes remain prohibited.

## Branch authority

`master` is the only authoritative/latest repository branch.

Before creating or continuing implementation work, re-fetch live `master` and base the work from that tip. Temporary feature/review branches MAY exist while a change is in progress, but they SHALL NOT become parallel sources of truth.

Repository governance SHALL follow active contract §28 and Verification §33. When the hosting provider/account exposes server-side branch protection or rulesets for the authoritative repository, `master` SHALL use them with mandatory CI, force-push/deletion prevention, and narrowly controlled/auditable bypass. When that server-side capability is unavailable because of a verified hosting plan/platform limitation, the v1.0.6 `COMPENSATING_CONTROLS` mode MAY be used: temporary implementation branches, exact candidate CI, immediate live-`master` tip revalidation, non-force integration, post-integration tip/diff/evidence verification, and truthful recording that `master` is not server-protected. The fallback SHALL NOT be used if server-side protection becomes available and SHALL NOT be represented as equivalent hard prevention of an out-of-band administrator force push or deletion.

## Source of truth

Before implementation or architecture work, read:

1. `README.md`
2. `docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md`
3. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md`
4. `docs/JARVIS-V1-RELEASE-PROFILE.md`
5. `docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md`
6. `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
7. `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`
8. `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
9. `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
10. `docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md`
11. `docs/implementation/JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`
12. `docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`
13. `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`
14. `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`
15. `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`
16. `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`
17. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`
18. relevant ADRs only when rationale/history is needed.

The **v1.0.8 manifest defines the current component revision set**. ADRs do not form a second overlay.

## Platform/runtime-role boundary

Implementation SHALL preserve:

```text
Windows → FULL_HOST → mandatory V1 target
Linux   → FULL_HOST → future target
Android → COMPANION → future non-V1 client
```

Rules:

- shared Core/domain/policy code SHALL NOT directly depend on Win32/DPAPI/named-pipe/Job-Object/HWND/SID/UAC implementation APIs;
- native functions SHALL be reached through explicit platform capability/composition boundaries;
- operating-system checks belong in platform composition/adapters, not scattered through domain/features;
- Windows V1 SHALL still use its strongest qualified mechanisms; portability is never a reason to weaken security/process/recovery invariants;
- platform/provider/tool/module support is qualified per platform where native behavior differs;
- missing platform capability fails closed or degrades truthfully;
- Linux is not V1 and SHALL NOT be falsely reported supported;
- a future companion is non-authoritative and SHALL NOT cause direct privileged Core exposure;
- remote companion networking is future architecture and cannot be invented ad hoc during V1.

> **Abstract the capability, not the security away.**

## Backup/recovery cryptographic boundary

`JARVIS_BACKUP_V1` is a fixed versioned security format, not an adapter preference.

Do not:

- substitute another AEAD, nonce construction, tag size, chunk framing, AAD field set, key hierarchy, generated-recovery size, or key-slot construction under format V1;
- reuse `DB_DEK`, `SnapshotDBKey`, `BackupDEK`, recovery secrets, or derived KEKs as one another;
- treat a user-selected passphrase as sufficient by itself for a production `PORTABLE_STATE VERIFIED` backup;
- log/store/send generated recovery factors or derived key material through normal DB/config/log/diagnostic/AI channels;
- assume a generic SQLite backup API is safe/available for the selected SQLCipher binding without the exact Phase-3 proof.

Every production portable-state verified backup requires the generated 256-bit recovery slot and the complete Backup Cryptography Contract qualification.

## Project-policy trust boundary

Repository content, including `AGENTS.md`, is untrusted until the authenticated user explicitly enrolls the exact policy identity under `JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`.

Do not:

- auto-trust policy-looking files on clone/open/register/checkout;
- treat filename/path alone as trust;
- carry trust across a content-hash/path/project-identity change;
- let an untrusted nested policy override trusted policy;
- let a worker silently rewrite trusted policy and have the new contents become trusted;
- use trusted project policy to widen external authority, waive approvals, change DataPolicy, reveal credentials, or authorize elevation.

Mutating an enrolled trusted project-policy file is contextually HIGH. The resulting content requires explicit review/enrollment before it is trusted for new work.

## Supply-chain/update trust boundary

Production application/module activation follows `JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`.

Do not:

- treat a valid historical artifact signature as perpetual authorization to activate;
- bypass TUF root/role threshold, expiration, version, revocation, delegation, rollback/freeze/mix-and-match checks;
- accept update signing keys directly from an unauthenticated server response;
- allow a module-only delegated role to authorize application releases;
- reset trusted-root/version/security-epoch floors because ordinary cache was deleted;
- use a lower historical release merely because its Tauri/Authenticode signature still validates when current trusted metadata or security-epoch policy rejects it.

Windows production update gates are cumulative: current TUF authorization, Tauri updater signature, Windows code-signing policy, and JARVIS compatibility/rollback checks must all pass.

## Codex products versus JARVIS provider setup

- ChatGPT desktop and Codex CLI are separate products. JARVIS V1 targets the Codex CLI provider executable, not the ChatGPT desktop chat application.
- Codex desktop task sandboxing is provider-managed automatically; do not assume a user-visible manual Windows setup/repair button or a required UAC action exists there.
- A Codex CLI session or a normal chat response does not prove that the CLI provider is installed, compatible, sandbox-ready, or qualified for JARVIS.
- Do not direct a user to run or approve `codex-windows-sandbox-setup.exe` for JARVIS based only on Codex desktop being open, a chat greeting, or a CLI session.
- JARVIS CLI-provider qualification is separate: it requires a release-qualified CLI/helper identity, exact provider-defined invocation/payload, independent readiness/conformance verification, and an explicit user action only when JARVIS presents an exact qualified UAC prompt.
- Network-policy clarification (ADR-076): the Codex CLI host/provider and all delegated Codex `WORKSPACE_ENGINEERING` workers are network-connected by contract so they can communicate with the model service and perform normal engineering work. The typed Codex workspace request must use `networkMode: ENABLED`; the conformance probe must demonstrate bounded worker HTTPS availability from inside the worker. Network access still does not authorize GitHub push, deployment, infrastructure mutation, messaging, credential administration, or other consequential external actions; those remain behind typed JARVIS tools and PermissionEngine. Do not claim readiness when the worker network probe is unavailable or inconclusive.
- If the provider does not expose that stable interface, keep the matrix status truthful (`BLOCKED`/`IN PROGRESS`) and do not reuse a private Codex host bridge or claim qualification without an authorized architecture change.

### Codex worker network amendment record (2026-08-17)

ADR-076 and the v1.0.8 contract-suite amendment change the delegated Codex
worker network requirement from denial to availability. The active normative
records are `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md`,
`docs/implementation/JARVIS-RUNTIME-CONTRACT.md`,
`docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`,
`docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`, and
`docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`. The implementation is in
`packages/protocol/src/provider-workspace.ts`,
`packages/protocol/src/provider-workspace-runtime.mts`,
`services/core/src/provider-routing.ts`, and
`platform/windows/src/provider_qualification.rs`.

The typed Codex workspace request now requires `networkMode: ENABLED`; the
provider conformance probe uses a bounded direct HTTPS request to
`https://example.com/` and no longer passes a network-disable flag. These are
repository-tracked source/contract files. The canonical contract-value source
is `G:\Jarvis Project\packages\schemas\src\canonical\v1\jarvis-v1.0.6.contract-values.json`;
generated contract artifacts under `G:\Jarvis Project\generated\contract\` are
ignored/generated and must be regenerated by the contract generator.

This amendment does not grant unrelated secrets, elevation, writes outside the
assigned worktree, or authorization for consequential external actions. The
worker and host remain network-connected, and readiness is only truthful after
the independent worker probe passes. Pre-amendment denial failures in the
matrix remain historical evidence; they are not current v1.0.8 requirements.

The current live qualification evidence (2026-08-17) is the ignored/generated
release host `G:\Jarvis Project\target\release\jarvis-desktop-host.exe` and the
live Rust test `live_qualified_codex_probe_must_pass_all_workspace_gates`, which
passed identity, non-elevation, workspace write/read, outside-workspace write
denial, and HTTPS access from inside the Codex worker sandbox. The visual
capture is `C:\Users\junme\AppData\Local\Temp\jarvis-network-amendment-final-release.png`;
it is an external temporary screenshot and contains no credentials. It proves
the rebuilt window renders, but the current user profile still displays the
older `SETUP_FAILED` state because the exact provider-helper UAC request was
denied; no setup-ready state was fabricated and the screenshot remains truthful
qualification evidence until the user-authorized helper repair is completed.

### Current 8.CP native capability transport record (2026-08-17)

The typed Core-to-native capability transport is recorded here so a future
agent does not infer that a passing source build is equivalent to a qualified
Windows adapter. The repository-tracked implementation is in
`G:\Jarvis Project\services\core\src\native-capability.mts`,
`G:\Jarvis Project\services\core\src\native-capability.mjs`,
`G:\Jarvis Project\services\core\src\tool-runtime.ts`,
`G:\Jarvis Project\services\core\src\main.ts`, and
`G:\Jarvis Project\platform\windows\src\local_ipc.rs`. It carries only
enumerated capability names, bounded typed records, correlation IDs, timeout,
cancellation, and fail-closed errors over the authenticated IPC channel. The
release packaging sources are
`G:\Jarvis Project\tools\release\prepare-core-build.mjs` and
`G:\Jarvis Project\tools\release\package-core-runtime.mjs`; generated
`services\core\dist\` and `.artifacts\core-build\` outputs are ignored build
artifacts and must be regenerated from the exact source commit.

The focused test fixture is
`G:\Jarvis Project\tests\layers\unit\native-capability.test.mjs`, and the
Windows IPC round-trip coverage is in `platform\windows\src\local_ipc.rs`.
The source/Core/desktop TypeScript checks passed, the prior focused Core/native
transport suite passed 22/22 and the current native-capability unit suite
passes 6/6, the Windows-target Rust workspace check passed, and the
normal local profile passed 80 files when run with the available Node 24.19.0
workspace runtime. The repository requires Node 24.18.0 and the native
SQLCipher binding uses the matching ABI 137; the system-installed Node 22.20.0
remains incompatible and must not be used for repository verification. No
repository artifact was changed to hide that environment mismatch. The host
now has a narrow typed `status.system` response based on authenticated
Core/platform identity plus the first workspace-scoped filesystem slice. Core
resolves a registered workspace from its encrypted repository and emits the
typed `workspace.bind` frame; the Windows host keeps the binding in an
authenticated-session registry and dispatches bounded `filesystem.read_text`
and conditional `filesystem.write_text` through `PlatformPathsAndIdentity`.
Application-open, project-status, and supervised-process capabilities still
return `NATIVE_CAPABILITY_UNQUALIFIED`; project/file open is now dispatched
through the same typed workspace registry. Live Core permission/pre-ALLOW facts remain
required before 8.CP can be marked `VERIFIED`. No private key, credential,
password, recovery secret, external signing input, or removable artifact was
created or moved by this slice.

### Current 8.CP workspace-binding record (2026-08-17)

This implementation record identifies the important source and generated
locations for the workspace binding without copying a user path into a
repository configuration or claiming a workspace is registered when Core has
not registered it.

| Item | Exact location | Purpose / allowed use | State and verification |
|---|---|---|---|
| Core workspace binding resolver | `G:\Jarvis Project\services\core\src\main.ts` and `G:\Jarvis Project\services\core\src\native-capability.mts` | Resolves the Core-owned `(projectId, workspaceId)` record and sends only a typed root binding before workspace-scoped native requests | Repository-tracked source; `pnpm typecheck` PASS and native-capability suite PASS 6/6 |
| Windows workspace registry and native dispatch | `G:\Jarvis Project\apps\desktop\src-tauri\src\main.rs` | Keeps a session-lifetime typed registry and routes read/conditional-write/open project/open file operations through typed Windows boundaries | Repository-tracked source; Windows x64 release-target cargo check PASS; not yet installed/release-qualified |
| Workspace-binding test fixture | `G:\Jarvis Project\tests\layers\unit\native-capability.test.mjs` | Proves Core emits `workspace.bind` before a workspace-scoped filesystem request and validates the returned typed result | Repository-tracked test; bundled Node 24.19.0 normal profile PASS 80 files |
| Release copies | `G:\Jarvis Project\services\core\dist\` and `G:\Jarvis Project\.artifacts\core-build\` | Ignored/generated Core packaging outputs; must be regenerated from the exact source commit | No new release copy or installed desktop build was created in this slice; no visual shipment claim |

### Current 8.CP native Git inspection record (2026-08-17)

The bounded native Git implementation is recorded here so a future agent knows
which files provide the capability and does not substitute a generic shell.

| Item | Exact location | Purpose / allowed use | State and verification |
|---|---|---|---|
| Native Git boundary | `G:\Jarvis Project\platform\windows\src\git_read.rs` | Read-only STATUS, BRANCH, DIFF, and LOG evidence from the exact Core-bound workspace using fixed Git arguments, no shell, no inherited stdin, timeout, and output bounds | Repository-tracked source; Windows x64 release-target cargo check PASS; not yet live-installed qualification |
| Host capability dispatch | `G:\Jarvis Project\apps\desktop\src-tauri\src\main.rs` | Dispatches only the four enumerated `git.*` capability names after workspace binding; all other native names remain explicitly unqualified | Repository-tracked source; no generic command authority; release build not installed in this slice |
| Git protocol contract/tests | `G:\Jarvis Project\packages\protocol\src\tool-git.mts` and `G:\Jarvis Project\tests\layers\unit\tool-git.test.mjs` | Defines typed bounded output and permits truthful empty diff/history results | Repository-tracked source/test; Git suite PASS 2/2 and full normal profile PASS 80 files |
| Generated or external artifacts | None | No Git executable copy, repository data, credentials, or release artifact was created or moved; the host resolves the installed `git.exe` only at execution time | No removable or secret-bearing artifact; live provider/Core admission and desktop visual qualification remain open |

### Current 8.CP native open-target record (2026-08-17)

The native open implementation is intentionally narrower than the protocol
surface. `open.application` remains unqualified because no contract-bound
application allowlist exists. Project and file opening are recorded here so a
future agent does not mistake Explorer launch for arbitrary process authority.

| Item | Exact location | Purpose / allowed use | State and verification |
|---|---|---|---|
| Native project/file opener | `G:\Jarvis Project\platform\windows\src\open_target.rs` | Starts fixed `explorer.exe` only for a Core-registered project root or a reparse-safe existing workspace-relative file; returns hashed target identity and `OPEN_REQUESTED` | Repository-tracked source; Windows x64 release-target cargo check PASS; no live installed qualification |
| Host dispatch | `G:\Jarvis Project\apps\desktop\src-tauri\src\main.rs` | Dispatches `open.project` and `open.file`; rejects malformed/missing bindings and keeps `open.application` explicitly unqualified | Repository-tracked source; no arbitrary executable or shell authority; no new desktop build installed |
| Generated or external artifacts | None | No Explorer copy, credential, release artifact, or removable artifact was created or moved | No secret-bearing artifact; live Core admission, postcondition evidence, and visual qualification remain open |

### Current 8.CP Core composition test record (2026-08-17)

The repository-tracked test
`G:\Jarvis Project\tests\layers\unit\core-tool-composition.test.mjs`
creates a disposable release-trusted Core and database, persists a secret-free
`ALLOW` permission decision, attaches the typed native capability client, and
verifies a real Core `status.system` tool execution plus its durable
`TOOL_EXECUTION` audit event. The test uses only temporary data under the
current user's temporary directory, deletes that data in `finally`, and writes
no credentials, keys, or release artifacts. It passed together with the native
capability and Core-runtime suites (`14/14`). This is Core-side composition
evidence only; it does not claim live Windows PermissionEngine/native execution
or installed desktop qualification.

### Current 8.CP release-host visual record (2026-08-17)

The current source-built Windows host was rebuilt from this worktree and
launched from `G:\Jarvis Project\target\release\jarvis-desktop-host.exe`.
The process was responsive, its bootstrap log reached `stage=CoreAuthenticated`,
and the targeted window capture
`C:\Users\junme\AppData\Local\Temp\jarvis-8cp-window.png` was visually
inspected. It shows a nonblank Mission Control window with `Core locked`,
`SESSION_UNLOCKED`, and the provider-status error `FrameMalformed`. The capture
is an external temporary PNG, not repository content, and contains no private
keys, credentials, or recovery material. The error is retained as truthful
evidence that the installed generated Core runtime is stale relative to the
current source provider-status view; the source path is not being weakened to
accept the stale frame. A freshly packaged, source-bound runtime and its
corresponding integrity/TUF evidence are still required before claiming the
installed provider/tool path qualified.

### Current 8.CP packaging reconciliation record (2026-08-17)

The current source-built Core candidate was packaged at
`C:\Users\junme\AppData\Local\Temp\jarvis-core-candidate-20260817-03`.
It is a temporary, external/generated candidate used for supervised private
qualification; it is not repository content or a public release. Its Core
entrypoint hash is
`40c5d1049f0b75a00bc19b39d8b9ad7a828eedde82ef1f946e1ed8ddee60bb0e`, and the
entrypoint contains the current `listProviderSetupStatusViews()` implementation.
The candidate includes `tuf-js` from the source Core dependency tree and was
packaged with the pinned Windows Node 24.18.0 runtime. Its public TUF metadata
was refreshed through `jarvissigner` on the Proxmox-hosted CT via
`root@192.168.99.2`, with targets/snapshot/timestamp version 4 and target
manifest SHA-256
`2be8063f3ac81090bb07c9ca389beea70eff52be0e6644f0f96873ffbd638cc9`.
Repository TUF verification and packaged Core qualification both pass;
`keyCustodyEvidence=EXTERNAL_REQUIRED` remains truthful because the root
custody model is not independently audited here.

An earlier disposable candidate at
`C:\Users\junme\AppData\Local\Temp\jarvis-core-candidate-20260817-02`
was also external and temporary; its first qualification attempt exposed the
dependency-source mismatch before the corrected source dependency tree was
used. The prior public CT metadata was preserved at
`/srv/jarvis-tuf-signing/metadata/archive-20260817-01/`; the new signing input
was `/srv/jarvis-tuf-signing/artifacts/runtime-manifest.next.json`. Private keys
were accessed only inside the signer CT and were not copied to Windows. These
candidates remain temporary diagnostic artifacts until cleanup is permitted;
they contain no private keys, passwords, or recovery secrets.

The verified candidate was copied into the generated Tauri resource at
`G:\Jarvis Project\apps\desktop\src-tauri\resources\core-runtime\` and the
release host was rebuilt at
`G:\Jarvis Project\target\release\jarvis-desktop-host.exe`. The old generated
resource was preserved at
`G:\Jarvis Project\apps\desktop\src-tauri\resources\core-runtime-stale-20260817-01`.
The rebuilt host launched visibly with a responsive, nonblank Mission Control
window; the fresh profile showed `NOT_INITIALIZED` and `Create session` rather
than `FrameMalformed`. Visual evidence is retained at
`C:\Users\junme\AppData\Local\Temp\jarvis-8cp-window-refreshed.png`.

The pinned verification command was run directly with
`G:\Jarvis Project\target\release\resources\core-runtime\runtime\node.exe`
against `tools/test/run-tests.mjs --profile normal`; all 81 selected test files
passed. Running the package-manager script from the workstation's default
Node 22 is not equivalent and produced native SQLite ABI failures; future
qualification must use the pinned Node 24.18.0 runtime or an equivalent
verified toolchain launcher.

Temporary diagnostic artifacts created during this reconciliation were
`G:\Jarvis Project\.tmp-refresh-tuf-metadata.zip` (a non-secret transfer
archive for the CT metadata-refresh helper) and
`G:\Jarvis Project\.tmp-sqlite-probe.db` (a disposable local SQLite binding
probe). They were untracked, contained no private keys or credentials, were
not release inputs, and were removed after verification; no cleanup copy
remains in the repository workspace.

The open-tool postcondition gap was corrected in
`G:\Jarvis Project\services\core\src\main.ts`: Core now requires the native
response to match the requested qualified PROJECT/FILE target kind, contain a
bounded non-empty target identity, and report `OPEN_REQUESTED`. APPLICATION
opens remain fail-closed because the active contract still lacks an
application allowlist and identity binding. Focused Core runtime/composition
coverage passes 7/7, the pinned normal profile passes 81/81 files, and root,
Core, and desktop typechecks pass. A refreshed release package was not created
because the repository intentionally remains dirty with uncommitted
implementation work; the existing signed candidate must not be treated as
containing this new source change.

### TUF signing location and operating procedure

The repository-side TUF profile verifier is `tools/release/verify-tuf-metadata-profile.mjs`, with focused coverage in `tests/layers/unit/tuf-metadata-profile.test.mjs`. Release-owned metadata is packaged under the candidate Core runtime at:

```text
<release-root>/tuf/metadata/
├── root.json
├── targets.json
├── snapshot.json
└── timestamp.json
```

The private/internal signing workspace is the dedicated non-login `jarvissigner` account on the already-provisioned signing CT (`jarvis-ct`, currently `192.168.99.77`):

```text
/srv/jarvis-tuf-signing/
├── keys/
│   ├── root/       # 3 Ed25519 keys, threshold 2
│   ├── targets/    # 3 Ed25519 keys, threshold 2
│   ├── modules/    # 3 Ed25519 keys, threshold 2; delegated to modules/*
│   ├── snapshot/   # 1 Ed25519 key, threshold 1
│   └── timestamp/  # 1 Ed25519 key, threshold 1
├── artifacts/      # public release candidate inputs only
├── metadata/       # generated public TUF metadata
└── evidence/       # secret-free signing and verification evidence
```

Signing procedure:

1. Build and freeze the exact Windows `FULL_HOST` candidate. Do not sign a moving tree.
2. Copy only the public release candidate inputs, including `runtime-manifest.json`, into the CT signing workspace. Never copy private keys to the repository, Windows workstation, ordinary CI, application runtime, or metadata.
3. Generate/sign `root.json`, `targets.json`, delegated `modules/*` metadata, `snapshot.json`, and `timestamp.json` with separated role keys and the thresholds fixed by the Supply-Chain Trust Contract. The target custom identity must match the exact artifact hash, source commit, release sequence, security epoch, Windows platform, `FULL_HOST` role, and x64 architecture.
4. Copy only the resulting public metadata into the candidate's `tuf/metadata/` directory, then run:

   ```text
   node tools/release/verify-tuf-metadata-profile.mjs --metadata-dir <absolute-candidate>/tuf/metadata
   ```

5. Run the packaged Core qualification with `--production-tuf-profile` and record the exact source/artifact/metadata hashes in the implementation matrix. A successful metadata-shape check is not proof of private-key custody.

Private-key files SHALL remain mode `600`, owned by the dedicated signer account. Do not print, log, commit, upload, or paste private key contents. The current CT setup is a controlled qualification signer, but its role keys are presently co-located on that CT; until independent offline root-key custody evidence exists, report `keyCustodyEvidence=EXTERNAL_REQUIRED` and do not claim production signing qualification or `Production Complete`.

### Current signing/custody record (2026-08-15)

This record is intentionally secret-free and exists so a future agent can locate
the inputs without guessing. It does not authorize a signing operation by itself.

| Item | Location / identity | Contents or use | Current state |
|---|---|---|---|
| Offline TUF root custody copy A | `K:\TUF-ROOT-CUSTODY\` | `root-1.private.pem`, `root-2.private.pem`, `root-3.private.pem`; root role only, 2-of-3 | Present; do not print or copy contents |
| Offline TUF root custody copy B | `L:\TUF-ROOT-CUSTODY\` | Matching three root private-key filenames; independent custody copy | Present; do not print or copy contents |
| Offline TUF release-role custody copies | `K:\TUF-TARGETS-CUSTODY\targets-1.private.pem` through `targets-3.private.pem`; corresponding `modules-*`, `snapshot-1.private.pem`, and `timestamp-1.private.pem` files in the matching `K:\TUF-MODULES-CUSTODY\`, `K:\TUF-SNAPSHOT-CUSTODY\`, `K:\TUF-TIMESTAMP-CUSTODY\` directories and identical directory names under `L:\` | Fresh separated private role keys generated by the offline hierarchy ceremony; targets/modules are 2-of-3, snapshot/timestamp are 1-of-1 | Present on both encrypted volumes; do not print or copy contents |
| TUF release-signing workspace | `jarvisadmin@192.168.99.77:/srv/jarvis-tuf-signing/` (signing CT) | `keys/targets`, `keys/modules`, `keys/snapshot`, and `keys/timestamp` are the role-signing locations; `metadata/` contains public outputs | Required for the signing ceremony; do not assume it is mounted or reachable |
| Release-owned TUF metadata | `<candidate-release-root>/tuf/metadata/` | Public `root.json`, `targets.json`, `snapshot.json`, and `timestamp.json` consumed by Core admission | Copy public outputs here only after signing |
| Windows private/internal certificate | Current user's Windows certificate stores; thumbprint `23DA4DA3E340B66EC4240B4CC845E4387E5BBDD3` | Authenticode/Tauri private-internal artifact signing | Enrolled for this machine/user; not public CA trust |

The USBs now contain both the three root-key custody copies and the separately
generated release-role custody copies listed above. A future release still
requires the authorized signing ceremony and exact role thresholds; never use
root keys as substitute role keys and never weaken TUF admission to proceed.

### TUF metadata refresh record (2026-08-16)

The exact rebuilt candidate runtime manifest was refreshed through the signing
CT using its existing targets-1/2, snapshot-1, and timestamp-1 private role
keys. The private keys were read only inside the CT and were not copied to the
Windows workstation. The public outputs now describe source commit
`769d900fa6ba67823fecc5496fc72fd4ce683ed0`, manifest SHA-256
`1bdea14c7124710e037c4e8ab62b8681c1876ab9c54e8ef534077c22f2d94203`, and
metadata versions targets=3, snapshot=3, timestamp=3. The prior public
metadata is preserved at
`/srv/jarvis-tuf-signing/metadata/archive-20260816-141009-before-refresh/` on
the signing CT. Two intermediate failed refresh attempts also left duplicate
pre-refresh public metadata archives at
`/srv/jarvis-tuf-signing/metadata/archive-20260816-140855-before-refresh/` and
`/srv/jarvis-tuf-signing/metadata/archive-20260816-140930-before-refresh/`;
they contain no private keys and are retained for audit. The refreshed public
metadata is installed in the generated
candidate at
`G:\Jarvis Project\target\x86_64-pc-windows-msvc\release\resources\core-runtime\tuf\metadata\`
and is consumed only by the rebuilt private-internal Windows candidate. The
repository verifier returned `productionProfileShape=PASS`; root-key custody
remains `keyCustodyEvidence=EXTERNAL_REQUIRED`, so this is not a public release
or a claim of independent offline-root production qualification. A temporary
public-only validation copy remains at
`C:\Users\junme\AppData\Local\Temp\jarvis-tuf-metadata-refresh-20260816\`;
automated cleanup was attempted but blocked by the execution policy, so it is
retained until the next permitted cleanup.

The repository ceremony implementation is
`tools/release/create-offline-tuf-hierarchy.mjs`. It writes only public metadata
to the candidate release and writes private role keys only to the two encrypted
custody volumes. Its output was independently verified with
`tools/release/verify-tuf-metadata-profile.mjs`; the packaged Core admission and
the supervised Windows authentication test passed after the new metadata was
installed.

The post-refresh shipped-desktop visual evidence is
`C:\Users\junme\AppData\Local\Temp\jarvis-visual-after-tuf-refresh.png`.
It is a temporary, external screenshot of the rebuilt host, not repository
content. It shows a nonblank Mission Control window with `Core locked`,
`SESSION_UNLOCKED`, and `SETUP_READY`; the bootstrap log ends at
`stage=CoreAuthenticated`. It is retained only for this qualification session.

The public metadata generated for that candidate is located at
`apps/desktop/src-tauri/resources/core-runtime/tuf/metadata/` and consists of
`root.json`, `targets.json`, `snapshot.json`, and `timestamp.json`. The generated
candidate runtime itself is an ignored build artifact under
`apps/desktop/src-tauri/resources/core-runtime/`; it is not repository source
and must be regenerated from the exact source commit before a release.

Current runtime note: after the metadata and packaging checks passed, the
installed desktop host initially reported `PERSISTENCE_SCHEMA_INVALID` against
the existing user database at `%LOCALAPPDATA%\JARVIS\data\state.db`. With the
user's explicit authorization for clean-profile qualification, each affected
directory was reversibly preserved before replacement. The first legacy copy is
`C:\Users\junme\AppData\Local\JARVIS\data-legacy-20260815-232126`; the second
stale-profile copy is
`C:\Users\junme\AppData\Local\JARVIS\data-legacy-20260815-233551`. A new
empty `%LOCALAPPDATA%\JARVIS\data` directory was created for the qualified
build. The rebuilt host opened visibly with `WINDOWED` state and the bootstrap
log ended with `stage=CoreAuthenticated`. The legacy directories are preserved
for future migration/recovery work; they were not deleted or overwritten.

Fresh-profile reset record (2026-08-16): at the user's explicit request after
the session password was forgotten, the active JARVIS profile was moved intact
from `C:\Users\junme\AppData\Local\JARVIS\data` to
`C:\Users\junme\AppData\Local\JARVIS\data-legacy-20260816-170950-fresh-profile`.
That preserved directory contains the prior database, WAL files, secure-storage
handle, and window state; it is external local user data, not repository content,
and was not deleted or overwritten. It remains reserved for recovery or future
authorized migration and must not be opened by ordinary agents or copied into
prompts/logs. A new empty active profile was then created at
`C:\Users\junme\AppData\Local\JARVIS\data`, reserved for the JARVIS desktop
host's fresh-session initialization. The rebuilt host launched with a visible,
responsive Mission Control window showing `NOT_INITIALIZED` and `Create session`;
the fresh profile is therefore visually verified, while the old profile remains
preserved and no old password was recovered.

Runtime qualification record (2026-08-16): the newer generated Core runtime was
preserved at `G:\Jarvis Project\apps\desktop\src-tauri\resources\core-runtime-unqualified-20260816-234000`.
It is an ignored/generated candidate with a newer runtime manifest and was not
used as a trusted release because its TUF target metadata was stale. The signed
fallback currently used for local qualification is at
`G:\Jarvis Project\apps\desktop\src-tauri\resources\core-runtime`, with the
packaged copy at
`G:\Jarvis Project\target\x86_64-pc-windows-msvc\release\resources\core-runtime`.
Its public TUF metadata passed the profile verifier and direct admission
(`1.0.35`); this is qualification evidence only and does not claim production
release completion.

The active profile's persistence-init failure copy is preserved at
`C:\Users\junme\AppData\Local\JARVIS\data-legacy-20260816-234500-persistence-init-failure`.
It is external local user data, not repository content, and remains retained for
authorized recovery. The active fresh profile is
`C:\Users\junme\AppData\Local\JARVIS\data`.

The bundled Node 24.18 SQLite native binding was rebuilt with the installed
Visual Studio toolchain and copied into the generated packaged runtime at
`G:\Jarvis Project\target\x86_64-pc-windows-msvc\release\resources\core-runtime\core\node_modules\better-sqlite3-multiple-ciphers\build\Release\better_sqlite3.node`.
The generated module is ignored build output, is used only by the packaged Core
runtime, and has SHA-256
`84827B1C1B7AEA09C743BA5D466065D5AC609D91CCC17A21B3C1EB65C68DE3F1`.
Evidence: the packaged Node runtime completed a real SQLite create/insert/query
test, and the isolated Core bootstrap returned `state=READY` with the expected
Windows FULL_HOST identity. Temporary probe databases and scripts were removed.
The current visual evidence capture is
`C:\Users\junme\AppData\Local\Temp\jarvis-live-20260816.png`; it shows a
responsive, nonblank Mission Control window with `NOT_INITIALIZED`, an enabled
`Create session` action, and no session-request error.

Historical pre-ADR-076 Codex sandbox network-gate retest (2026-08-17): Bitdefender Firewall was
confirmed off (`SecurityCenter2` product state `262144`), Windows Firewall
profiles were on, BFE and MpsSvc were running, and the three Codex offline block
rules were enabled. The ignored live provider qualification still failed with
`NetworkAccessNotDenied`. A temporary elevated Windows Firewall rule blocking
`C:\Windows\System32\curl.exe` was tested and removed after the test; the
loopback probe still succeeded, while an external HTTPS probe also returned
HTTP 200. This is evidence that the installed Codex/Windows boundary is not
enforcing the required loopback/network denial even with Bitdefender disabled.
No diagnostic firewall rule remains. Do not claim `SETUP_READY` or production
sandbox qualification from this result; 7.10 remains `IN PROGRESS` pending a
provider-side or qualified platform-boundary fix.

Historical pre-ADR-076 Codex full-setup retest (2026-08-17): the repository payload in
`G:\Jarvis Project\platform\windows\src\provider_qualification.rs` was corrected
from `refresh_only=true` to `refresh_only=false`. The prior value caused the
provider helper to log `read-acl-only mode`, which could repair permissions but
could not perform full firewall/WFP provisioning. The exact external helper
`C:\Users\junme\.codex\packages\standalone\releases\0.147.0-x86_64-pc-windows-msvc\codex-resources\codex-windows-sandbox-setup.exe`
was then run once with the bounded full-setup payload under the approved UAC
path. Its secret-free log reported `WFP setup succeeded ... with 12 installed
filters`; the active provider marker remains
`C:\Users\junme\.codex\.sandbox\setup_marker.json`. The real JARVIS UI path was
also exercised through the visible `Repair Codex setup` action and exact UAC
prompt. After full setup, the independent live probe still failed
`NetworkAccessNotDenied`; identity, non-elevation, workspace write/read, and
outside-write denial continued to pass. The Codex host remained online and the
failure is limited to the delegated child-command boundary. The release host
was rebuilt at
`G:\Jarvis Project\target\x86_64-pc-windows-msvc\release\jarvis-desktop-host.exe`
and visually inspected in
`C:\Users\junme\AppData\Local\Temp\jarvis-live-20260817.png`; the window was
visible and nonblank with truthful `SETUP_FAILED` state. The helper and marker
are external provider state, not repository or release artifacts; do not treat
the 12-filter message as qualification evidence until the independent network
probe passes.

### Mandatory important-artifact recording

After creating, receiving, moving, mounting, or materially changing any
important document, key, certificate, metadata set, release artifact, database,
backup, recovery item, installer, test fixture, or external signing input, the
agent SHALL update an agent-facing record in `AGENTS.md` or the relevant current
implementation evidence before ending the task. The record SHALL state, in
plain language:

1. what the artifact is and why it exists;
2. the exact absolute path, drive, host, or service where it is saved;
3. whether it is repository-tracked, ignored/generated, external, or removable;
4. who or what is allowed to use it and for which workflow;
5. its custody, retention, expiration, or cleanup state; and
6. the verification evidence or known limitation.

This record must never contain private-key contents, passwords, recovery
secrets, tokens, raw credentials, derived key material, or other secret values.
Record secret-free identifiers such as filenames, role names, certificate
thumbprints, hashes, public key IDs, versions, and purpose instead. If the
artifact is intentionally temporary, record its cleanup result; if cleanup is
not performed, record the exact remaining location and reason. A task is not
complete when an important artifact is left undocumented or its location is
left for the next agent to infer.

### Current 7.7 implementation record (2026-08-16)

The authenticated-text conversation boundary is implemented in the following
repository files. These are source/test files, not generated release artifacts
and contain no credentials or provider secrets:

| Artifact | Exact location | Purpose and allowed use | State / evidence |
|---|---|---|---|
| Conversation protocol types | `G:\Jarvis Project\packages\protocol\src\conversation.ts` | Defines authenticated text input and content-only structured decisions; Core/protocol code only | Working-tree source addition; Core typecheck and build pass |
| Conversation protocol validators | `G:\Jarvis Project\packages\protocol\src\conversation-runtime.mts` and `G:\Jarvis Project\packages\protocol\src\conversation-runtime.mjs` | Validates LOCAL_UI text/session identity, bounded context binding, SECRET exclusion, and decision shape; consumed by Core | Working-tree source addition; focused authority/conversation tests pass |
| ConversationService | `G:\Jarvis Project\services\core\src\conversation.ts` | Core-owned pipeline: authenticated session check → conversation persistence → Core-bound context → typed provider callback → one bounded repair attempt → content-only decision persistence | Working-tree source addition; ConversationService tests pass 2/2; live CoreBootstrap route with the real adapter passed and persisted two messages |
| Qualified Codex adapter | `G:\Jarvis Project\providers\ai\src\codex-cli-adapter.mts` and `G:\Jarvis Project\providers\ai\src\codex-cli-adapter.mjs` | Invokes only the qualified Codex CLI distribution with `exec --ephemeral --ignore-user-config --strict-config --sandbox read-only`, exact release working directory, bounded stdin/result, strict structured output, and temporary schema/output files | Working-tree source addition; live `codex-cli 0.147.0` probe returned a valid content-only decision; temporary files are deleted in `finally`; no credentials are recorded |
| Authenticated Core route | `G:\Jarvis Project\services\core\src\main.ts` | Owns `process_authenticated_text`, requires `SETUP_READY`, and routes only validated authenticated input through ConversationService to the qualified adapter | Working-tree change; live CoreBootstrap probe admitted the release runtime, completed setup, authenticated a session, returned `ANSWER`, and persisted the conversation |
| Native/UI typed bridge | `G:\Jarvis Project\platform\windows\src\local_ipc.rs`, `G:\Jarvis Project\apps\desktop\src-tauri\src\main.rs`, and `G:\Jarvis Project\apps\desktop\src\coreBridge.ts` | Carries the bounded text request through authenticated native IPC/Tauri boundaries; renderer has no direct provider or authority access | Working-tree changes; desktop typecheck and Rust check pass; transport regression remains covered by the Core IPC test |
| ConversationService tests | `G:\Jarvis Project\tests\layers\unit\conversation-service.test.mjs` | Synthetic local tests for successful text flow, one repair retry, and authority-bearing output rejection | Working-tree test addition; normal local profile passes 65 test files with 0 failures (two workflow-specific tests skipped because GitHub Actions is intentionally absent) |

The service and adapter intentionally do not authorize, execute, or bypass
PermissionEngine gates. Provider work requests remain content-only structured
decisions; execution requires later typed JARVIS work/approval paths. The
qualified adapter uses the provider's read-only sandbox contract for this
conversation slice; universal process containment and write/network conformance
remain explicitly owned by subsections 7.9–7.11. The implementation matrix now
records 7.7 as `VERIFIED` for its authenticated text/decision boundary, with
those downstream provider capability gates still open.

### Current 7.8 implementation record (2026-08-16)

The first provider-role/routing boundary is implemented in these secret-free
repository files:

| Artifact | Exact location | Purpose and allowed use | State / evidence |
|---|---|---|---|
| Role/routing protocol types | `G:\Jarvis Project\packages\protocol\src\provider.ts` | Defines `GENERALIST`, `SOFTWARE_ENGINEER`, `VERIFIER`, and `SYNTHESIZER` profiles, required capability names, routing requests/candidates, rejection reasons, and deterministic results | Working-tree source change; Core typecheck passes |
| Role/routing validators and selector | `G:\Jarvis Project\packages\protocol\src\provider-runtime.mts`, `G:\Jarvis Project\packages\protocol\src\provider-routing.mjs`, and `G:\Jarvis Project\packages\protocol\src\provider-routing.d.mts` | Validates role/routing identity and selects only setup-ready, compatible, healthy, qualified candidates whose capabilities/mode/locality satisfy the request; the declaration shim keeps the public re-export typed | Working-tree source/declaration changes; provider routing test passes in the 16/16 provider-state suite and Core/desktop typechecks pass |
| Core persisted routing boundary | `G:\Jarvis Project\services\core\src\provider-routing.ts`, `G:\Jarvis Project\services\core\src\provider-routing.js`, `G:\Jarvis Project\services\core\src\schema.ts`, and `G:\Jarvis Project\services\core\src\main.ts` | Builds candidates only from Core-owned provider profile, setup, qualification, and registered-adapter records; profile/policy changes invalidate prior qualification and missing records produce no-match rather than fallback | Working-tree source/loader/build changes; Core bootstrap and provider-state tests pass; Core build emits `services\core\dist\provider-routing.js` |
| Codex adapter capability contract | `G:\Jarvis Project\providers\ai\src\codex-cli-adapter.mts` | Declares only the Codex CLI capabilities and `ONE_SHOT`/LOCAL behavior actually implemented; it is used by Core routing and release packaging, not as a claim of unsupported coding/tool-use modes | Working-tree source change; Core typecheck/build and packaged-runtime tests pass; no secrets |
| Routing regression coverage | `G:\Jarvis Project\tests\layers\unit\provider-state.test.mjs` | Covers deterministic selection, locality rejection, setup/health/qualification rejection, persisted profile invalidation, explicit multi-adapter registration, and malformed routing policy | Working-tree test change; focused suite PASS 16/16 |

The 7.8 selector is a protocol-level deterministic boundary and Core now
consumes it through persisted provider records without synthesizing setup or
qualification state. It is not yet a claim that multiple live providers are
registered or supported: Core-wide multi-provider registration, live
qualification records, and provider-specific routing evidence remain required
before the matrix can mark 7.8 `VERIFIED`. The focused provider-state suite
passed 14/14, Core bootstrap passed 11/11, the Core packaging/packaged-runtime
tests passed 4/4, the full local normal profile passed 65 files with zero
failures, and architecture verification passed 8/8. The native SQLite binding
used for these checks is an external ignored dependency artifact, not
repository source; this shell used its locally available Node-compatible
prebuild after a stale ABI mismatch was detected.

### Current 7.9 workspace-engineering boundary record (2026-08-16)

The bounded `WORKSPACE_ENGINEERING` request model is implemented in these
secret-free repository files:

| Artifact | Exact location | Purpose and allowed use | State / evidence |
|---|---|---|---|
| Workspace-engineering request types | `G:\Jarvis Project\packages\protocol\src\provider-workspace.ts` | Binds provider execution to an exact project/workspace record, explicit write/read/external-action boundaries, a data policy, network mode, and environment variable names only; it carries no environment values or credentials | Working-tree source change; no secrets |
| Workspace-engineering validator | `G:\Jarvis Project\packages\protocol\src\provider-workspace-runtime.mts` and `G:\Jarvis Project\packages\protocol\src\provider-workspace-runtime.mjs` | Validates project/worktree identity and explicit network modes, requires `ENABLED` for Codex admission, rejects secret-bearing environment names, and permits consequential external actions only through JARVIS tools | Working-tree source/loader changes; focused negative coverage passes; root typecheck and full normal profile pass |
| Core workspace admission | `G:\Jarvis Project\services\core\src\schema.ts`, `G:\Jarvis Project\services\core\src\provider-routing.ts`, and `G:\Jarvis Project\services\core\src\main.ts` | Reads the Core-registered workspace identity and admits `WORKSPACE_ENGINEERING` only when the exact workspace still matches and the assigned provider is qualified/routable for the software-engineer role; this is admission only, not process or OS enforcement | Working-tree source/build changes; missing, drifted, unqualified, and unregistered-provider cases fail closed; Core build emits `provider-routing.js`; no credentials or secrets |
| Workspace-engineering regression coverage | `G:\Jarvis Project\tests\layers\unit\provider-state.test.mjs` | Verifies exact workspace binding, explicit network modes with Codex `ENABLED` admission, secret-name rejection, policy-boundary failures, persisted workspace admission, and qualified provider routing | Working-tree test change; focused provider-state suite PASS 16/16; full local normal profile PASS 65 files with 0 failures |

This is a typed admission boundary only. It does not claim that the real
Codex provider enforces filesystem isolation, and it does not place secret
values in the request. The enabled-network provider conformance evidence is
recorded separately under 7.10; concrete provider execution integration and
native filesystem-boundary wiring remain downstream work.

### Current 7.11 provider lifecycle record (2026-08-17)

The bounded provider lifecycle slice is implemented in these secret-free
repository files:

| Artifact | Exact location | Purpose and allowed use | State / evidence |
|---|---|---|---|
| Provider execution controller | `G:\Jarvis Project\providers\ai\src\provider-execution.mts` and `G:\Jarvis Project\providers\ai\src\provider-execution.mjs`; shipped support copies are generated at `G:\Jarvis Project\services\core\dist\provider-execution.mts` and `G:\Jarvis Project\services\core\dist\provider-execution.mjs` | Owns the Codex adapter's bounded process request, external abort signal, timeout, one crash restart, Windows descendant-termination request, and three-failure/30-second circuit-breaker state; it does not contain credentials or authority | Working-tree source/loader addition and generated Core support files; lifecycle tests PASS 3/3, Core typecheck/build passes, and release manifest/package/packaged-runtime tests PASS 7/7 |
| Codex adapter integration | `G:\Jarvis Project\providers\ai\src\codex-cli-adapter.mts` | Routes the qualified one-shot Codex invocation through the lifecycle controller and maps timeout, cancellation, crash, and open-circuit outcomes to bounded provider errors | Working-tree source change; provider/conversation focused tests pass; live installed Codex descendant containment and forced-shutdown verification passed |
| Provider lifecycle regression tests | `G:\Jarvis Project\tests\layers\unit\provider-execution.test.mjs` | Verifies one bounded restart after a crash, circuit opening after repeated failures, half-open recovery timing, timeout, and external cancellation without launching a real provider | Working-tree test addition; PASS 3/3; synthetic evidence only, not live Windows containment proof |

The 7.11 gate is now recorded as verified: the native supervisor suite passed,
and the ignored live Windows test launched the installed `codex.exe` from a
supervised Core-like Node parent, discovered it as a managed descendant, and
verified forced shutdown removed it with an empty Job Object. The controller
remains lifecycle logic while the native supervisor remains the authoritative
process-tree boundary.

### Current 7.12 provider fallback/routing record (2026-08-17)

Provider routing now requires exact platform binding and has a Core-owned
admission path in `G:\Jarvis Project\services\core\src\provider-routing.ts`.
`routePersistedProviderForRoleWithAdmission` validates the current
PermissionEngine decision and complete pre-ALLOW facts before selecting any
provider. The selection primitive separately rejects setup, compatibility,
health, qualification, capability, execution-mode, locality, and platform
mismatches. The pre-ALLOW implementation is loaded from
`G:\Jarvis Project\packages\policy\src\pre-allow-gates.mjs` and its typed
source; the runtime package includes it under `core/packages/policy/src/`
and the release manifest hashes it. Provider-state coverage PASS 18/18,
Core typecheck/build PASS, and the normal profile PASS 66 files with 0
failures. This does not perform or fabricate a budget reservation;
chargeable reservation/settlement remains owned by the later
resource/accounting execution boundary.

### Current 7.14 worker recovery record (2026-08-17)

The worker recovery boundary is implemented in the repository-tracked files
`G:\Jarvis Project\packages\protocol\src\worker-recovery.ts`,
`G:\Jarvis Project\packages\protocol\src\worker-recovery-runtime.mts`, and
the runtime wrapper
`G:\Jarvis Project\packages\protocol\src\worker-recovery-runtime.mjs`.
The Core-owned latest-checkpoint read path is in
`G:\Jarvis Project\services\core\src\schema.ts`.

These records reconstruct a fresh worker only from the durable JARVIS-owned
checkpoint summary, completed work, decisions/findings, artifacts, verification
state, activity, next step, blockers, and live-state assumptions. An opaque
provider resume handle is never included in the fresh-session context. Provider
resume is selected only when the exact reference, provider identity,
authentication, privacy, authority, setup, and provider-resumption capability
gates all pass; any failed gate or resume failure falls back to the fresh plan.
Worker-state coverage PASS 4/4, Core typecheck/build PASS, release
manifest/package/packaged-runtime tests pass, and the normal profile PASS 66
files with zero failures. No provider transcript or secret is persisted by this
boundary.

### Current 7.15 trusted project-policy snapshot injection record (2026-08-17)

The Core-owned trusted project-policy context boundary is implemented in
`G:\Jarvis Project\services\core\src\schema.ts`. The immutable snapshot is
read by exact `snapshotId`, `projectId`, and `attemptId`; its durable contents
remain limited to trust-record IDs, revisions, and SHA-256 identities. The
`buildProjectPolicyContextItems` path accepts policy bytes only in memory, and
fails closed unless the supplied set exactly matches every snapshot policy ID,
revision, and UTF-8 SHA-256 digest. Successful items are bounded and labeled
`PROJECT_POLICY` / `SCOPED_INSTRUCTION` with deterministic snapshot resolution
evidence; changed, untrusted, disabled, or revoked policy identities cannot
enter a new snapshot through the existing Core gates. Raw policy content is not
written to the database, logs, repository evidence, or this record.

The supporting protocol types are in
`G:\Jarvis Project\packages\protocol\src\project-policy.ts`, and the focused
coverage is in
`G:\Jarvis Project\tests\layers\unit\project-policy-state.test.mjs`.
Project-policy coverage PASS 4/4, content-authority coverage PASS 4/4, Core
typecheck PASS, and the normal profile PASS 66 files with zero failures. This
is repository-tracked source and test evidence; no external credential,
private key, or removable artifact was created.

### Current 7.16 provider support diagnostics record (2026-08-17)

The authenticated provider-status read model is implemented in the
repository-tracked files `G:\Jarvis Project\services\core\src\schema.ts` and
`G:\Jarvis Project\services\core\src\main.ts`. It combines the persisted
setup record with the persisted provider profile and qualification record, but
keeps each gate explicit: setup state/evidence, compatibility, health,
qualification/evidence, locality, a per-capability supported/unsupported
list, and the derived support state (`SUPPORTED`, `SETUP_REQUIRED`,
`QUALIFICATION_REQUIRED`, `HEALTH_UNAVAILABLE`, or `UNSUPPORTED`). The
support state is fail-closed and is never inferred from the presence of a
setup button.

The authenticated transport preserves those fields through
`G:\Jarvis Project\platform\windows\src\local_ipc.rs` and
`G:\Jarvis Project\apps\desktop\src-tauri\src\main.rs`. Mission Control
renders the fields as separate diagnostics in
`G:\Jarvis Project\apps\desktop\src\coreBridge.ts`,
`G:\Jarvis Project\apps\desktop\src\App.tsx`, and
`G:\Jarvis Project\apps\desktop\src\mission-control.tsx`. Only sanitized
identities, statuses, evidence references, and capability booleans cross the
boundary; no credentials, provider transcripts, or secret material are
created or stored by this change.

Focused provider-state and desktop diagnostics coverage passes 34/34, Core
typecheck passes, desktop TypeScript typecheck passes, Rust host `cargo check`
passes, and the full local normal profile passes 66 files. These are
repository-tracked source/test changes; no external, removable, or generated
release artifact is part of the evidence. A new installed/shipped desktop
build was not produced by this subsection, so no new visual-installation
claim is made here.

### Current 7.17 Windows Codex support tuple and negative conformance record (2026-08-17)

The current qualified provider tuple is `codex-cli` distribution
`codex-cli-standalone-windows-x64-0.147.0`, adapter `1.0.0`, platform
`WINDOWS`, runtime role `FULL_HOST`, and architecture `x64`. The default
`WORKSPACE_ENGINEERING` network mode is `ENABLED` as required by ADR-076;
the live Codex worker probe verified bounded HTTPS availability while the
host remained network-connected. The live qualification test
`provider_qualification::tests::live_qualified_codex_probe_must_pass_all_workspace_gates`
passed on this Windows machine on 2026-08-17, proving the qualified identity,
medium-integrity/no-Administrators worker token, assigned-workspace
write/read, outside-workspace write denial, structured `exec` interface, and
enabled worker network behavior.

Negative and fail-closed evidence is repository-tracked in
`G:\Jarvis Project\platform\windows\src\provider_qualification.rs`,
`G:\Jarvis Project\platform\windows\src\local_ipc.rs`,
`G:\Jarvis Project\platform\windows\src\privilege_mediator.rs`,
`G:\Jarvis Project\platform\windows\src\process_supervisor.rs`,
`G:\Jarvis Project\packages\protocol\src\provider-runtime.mts`,
`G:\Jarvis Project\providers\ai\src\provider-execution.mts`, and the
provider/conversation tests. It covers setup-required/non-ready behavior,
helper identity and argument retargeting, non-elevated worker identity,
network failure mapping, invalid structured output, timeout/cancellation,
crash/restart/circuit-breaker behavior, unsupported capability/platform
selection, and containment of the provider process tree. The complete native
desktop-host suite passes 100 tests with 3 explicitly ignored live/external
fixtures; the targeted live provider qualification passes 1/1; focused
provider/desktop coverage passes 34/34; and the normal repository profile
passes 66 files. No provider credential, sandbox password, or raw provider
transcript is recorded or stored by this evidence.

These are repository-tracked tests/evidence only; no new removable, external,
or release artifact was created. This record does not claim Linux support or
`Production Complete`; the Section 7 checkpoint remains the next gate.

### Current Section 7 checkpoint record (2026-08-17)

The integrated Section 7 checkpoint is repository-tracked at
`G:\Jarvis Project\tests\layers\unit\phase7-checkpoint.test.mjs`. It verifies
that every Section 7 child row is present and complete/implemented, that the
Codex Windows support tuple and enabled-network requirement remain explicit,
that provider rejection codes and execution failure controls stay fail-closed,
and that the evidence does not promote the qualified Windows tuple to Linux or
`Production Complete`. The checkpoint passed 2/2 under the repository-pinned
Node 24 runtime. Supporting evidence is the native desktop-host suite at
100/100 executed tests with 3 explicitly ignored external/live fixtures, the
live provider qualification at 1/1, and focused provider/desktop coverage at
34/34. No new key, credential, removable artifact, or shipped desktop build
was created by this checkpoint, so no new visual-installation claim is made.

### Current 8.1 tool registry and executor record (2026-08-17)

The first Section 8 implementation slice is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool.ts`,
`G:\Jarvis Project\packages\protocol\src\tool-runtime.mts`,
`G:\Jarvis Project\packages\protocol\src\tool-runtime-types.mts`, and their
`.mjs` entrypoints, with focused coverage in
`G:\Jarvis Project\tests\layers\unit\tool-registry.test.mjs`. These files
define the strict versioned ToolManifest/ToolRequest/ToolResult boundary, the
schema registry, exact adapter identity registration, and the owned
admission → precondition → adapter → output → postcondition → audit sequence.
They do not authorize themselves or provide a filesystem/process/network
escape hatch; later Section 8 gates supply Core-owned target, permission,
resource, and platform decisions. Consequential tools cannot report success
without required postcondition evidence, and missing schemas, denied
admission, scope mismatch, missing idempotency keys, uncertain evidence, and
audit failure are fail-closed outcomes.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused tool
tests pass 6/6, combined provider/desktop/tool coverage passes 39/39, root
TypeScript plus Core/desktop typechecks pass, and scoped `git diff --check`
passes. No new desktop build was installed or shipped, so no new visual
installation claim is made. The matrix records 8.1 as `IMPLEMENTED`; the
integrated Core target/admission implementation remains in 8.2–8.5.

### Current 8.2 target-resolution and verification record (2026-08-17)

The Section 8.2 implementation is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool.ts`,
`G:\Jarvis Project\packages\protocol\src\tool-target-runtime.mts`, and
`G:\Jarvis Project\packages\protocol\src\tool-target-runtime.mjs`, with
focused coverage in
`G:\Jarvis Project\tests\layers\unit\tool-target.test.mjs`. It validates
canonical target references, preserves Windows path-shaped resource IDs,
canonicalizes target identity deterministically, rejects changed target
identity/version tokens during fresh resolution, and evaluates manifest checks
through a shared verifier registry. Missing or throwing verifiers return
bounded `UNKNOWN` evidence and never expose raw verifier errors. This is a
protocol/runtime boundary only; it does not claim a concrete filesystem,
process, Git, or external integration tool.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused target
tests pass 3/3, combined tool registry/target coverage passes 8/8, root
TypeScript typecheck passes, and scoped `git diff --check` passes. No new
desktop build was installed or shipped, so no new visual installation claim is
made. The matrix records 8.2 as `IMPLEMENTED`; Core/platform target wiring and
admission integration remain in 8.3–8.5.

### Current 8.3 tool admission record (2026-08-17)

The Section 8.3 admission boundary is repository-tracked at
`G:\Jarvis Project\packages\policy\src\tool-admission.ts` and
`G:\Jarvis Project\packages\policy\src\tool-admission.mjs`, with focused
coverage in `G:\Jarvis Project\tests\layers\unit\tool-admission.test.mjs`.
It binds the validated PermissionEngine decision to the exact tool execution
and optional task, requires `ALLOW`, and evaluates every pre-ALLOW fact owned
by the current policy boundary: platform capability, provider setup,
integrity, trusted project policy, supply-chain trust, locality, budget,
resource, and precondition. Unknown mandatory facts produce `UNCERTAIN`;
failed facts produce `DENIED`; approval-required and identity-mismatched
decisions never reach an adapter. It does not fabricate the facts or become a
permission engine itself; Core-owned producers and later ToolExecutor wiring
remain required.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused
admission tests pass 3/3 and root TypeScript typecheck passes. No new desktop
build was installed or shipped, so no new visual installation claim is made.
The matrix records 8.3 as `IMPLEMENTED`; 8.4 remains the next active
subsection.

### Current 8.4 conditional mutation and idempotency record (2026-08-17)

The Section 8.4 protocol/runtime boundary is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool-mutation-runtime.mts` and
`G:\Jarvis Project\packages\protocol\src\tool-mutation-runtime.mjs`, with
focused coverage in
`G:\Jarvis Project\tests\layers\unit\tool-mutation.test.mjs`. It compares a
fresh target resolution against the expected identity and version tokens before
mutation, returns `CONFLICT` on changed state, and returns `UNCERTAIN` when an
adapter failure could have occurred after an external effect. Idempotency is
delegated to an injected durable store: matching keys replay the stored result,
changed request digests conflict, and ambiguous failures persist `UNCERTAIN`.
This boundary does not pretend that an in-memory test store is production
durability and does not perform any concrete filesystem, Git, or external
mutation.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused
mutation tests pass 3/3 and root TypeScript typecheck passes. No new desktop
build was installed or shipped, so no new visual installation claim is made.
The matrix records 8.4 as `IMPLEMENTED`; Core-backed persistence and concrete
tool adapters remain required.

### Current 8.5 tool safety and evidence record (2026-08-17)

The Section 8.5 safety behavior is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool-runtime.mts`, with focused
coverage in `G:\Jarvis Project\tests\layers\unit\tool-registry.test.mjs`.
The executor now requires evidence for every required precondition and
postcondition before reporting success, returns cancellation or ambiguity as
bounded `CANCELLED`/`UNCERTAIN` outcomes, converts adapter failures to stable
secret-safe errors, and converts an unverified audit write to `UNCERTAIN`.
This is a protocol/runtime boundary only: durable Core audit/domain-event
ownership and concrete diagnostics integrations remain later work.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused
ToolExecutor tests pass 6/6, combined Section 8 tool registry/target/admission/
mutation tests pass 15/15, and root TypeScript typecheck passes using the
repository-compatible Node 24.10.0 binary available on this machine. No new
desktop build was installed or shipped, so no new visual-installation claim is
made. The matrix records 8.5 as `IMPLEMENTED` and advances the next eligible
subsection to 8.6.

### Current 8.6 typed project/system status record (2026-08-17)

The Section 8.6 status boundary is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool-status.mts` and its `.mjs`
entrypoint, with focused coverage in
`G:\Jarvis Project\tests\layers\unit\tool-status.test.mjs`. It defines the
read-only `jarvis.status.project-system@1` manifest, exact PROJECT/SYSTEM
inputs, the policy-status distinctions required by the Project Policy Trust
Contract, and qualified Windows/FULL_HOST/x64 Core/platform status output. The
adapter accepts only an injected typed provider; it does not infer or invent
project, policy, or system state.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused status
tests pass 3/3; the combined Section 7 checkpoint plus Section 8.1–8.6 tests
pass 20/20; and root TypeScript typecheck passes using the repository-compatible
Node 24.10.0 binary available on this machine. No new desktop build was
installed or shipped, so no new visual-installation claim is made. The matrix
records 8.6 as `IMPLEMENTED` and advances the next eligible subsection to 8.7.

### Current 8.7 controlled open-operation record (2026-08-17)

The Section 8.7 boundary is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool-open.mts` and its `.mjs`
entrypoint, with focused coverage in
`G:\Jarvis Project\tests\layers\unit\tool-open.test.mjs`. It defines the
bounded `jarvis.open.application-project-file@1` manifest and accepts only an
application identity, registered project/workspace identity, or a
workspace-relative file path. Absolute paths, UNC paths, and traversal are
rejected. The actual open operation is delegated through an injected platform
boundary, and success requires an idempotency key plus a verified
`OPEN_REQUESTED` postcondition; this protocol slice does not provide a generic
shell or silently launch arbitrary paths.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused open
tests pass 2/2; the combined Section 7 checkpoint plus Section 8.1–8.7 tests
pass 22/22; and root TypeScript typecheck passes using the
repository-compatible Node 24.10.0 binary available on this machine. No new
desktop build was installed or shipped, so no new visual-installation claim is
made. The matrix records 8.7 as `IMPLEMENTED` and advances the next eligible
subsection to 8.8.

### Current 8.8 bounded filesystem-tool record (2026-08-17)

The Section 8.8 filesystem boundary is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool-filesystem.mts` and its `.mjs`
entrypoint, with focused coverage in
`G:\Jarvis Project\tests\layers\unit\tool-filesystem.test.mjs`. It defines
separate read-text and write-text manifests, rejects absolute/UNC/traversal
paths, bounds text and bytes to 1 MiB, validates byte evidence, and requires
expected-version plus idempotency protection for writes. The adapters delegate
only to an injected platform filesystem boundary; they do not open arbitrary
paths or provide a generic shell. Concrete Windows reparse/path identity,
Core data-policy/permission wiring, and durable file-state CAS remain later
integration work.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused
filesystem tests pass 2/2; the combined Section 7 checkpoint plus Section
8.1–8.8 tests pass 24/24; and root TypeScript typecheck passes using the
repository-compatible Node 24.10.0 binary available on this machine. No new
desktop build was installed or shipped, so no new visual-installation claim is
made. The matrix records 8.8 as `IMPLEMENTED` and advances the next eligible
subsection to 8.9.

### Current 8.9 supervised project test/build boundary record (2026-08-17)

The Section 8.9 protocol boundary is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool-engineering.mts` and its `.mjs`
entrypoint, with focused coverage in
`G:\Jarvis Project\tests\layers\unit\tool-engineering.test.mjs`. It defines
separate typed TEST and BUILD manifests, bounded operation/profile identities,
exact project/workspace scope, bounded timeouts, standard-user and
`WINDOWS_JOB_OBJECT` supervision evidence, semantic result states, and required
postcondition evidence. No arbitrary command string is accepted, and a process
exit code alone is not treated as semantic success. Concrete Windows profile
allowlisting, Core/PermissionEngine wiring, and live Job Object launch/
timeout/cancellation evidence remain platform integration work.

The source and tests are repository-tracked; no key, credential, generated
release artifact, removable artifact, or user data was created. Focused
engineering tests pass 2/2; the combined Section 7 checkpoint plus Section
8.1–8.9 tests pass 26/26; and root TypeScript typecheck passes using the
repository-compatible Node 24.10.0 binary available on this machine. No new
desktop build was installed or shipped, so no new visual-installation claim is
made. The matrix records 8.9 as `IMPLEMENTED` and advances the next eligible
subsection to 8.10.

### Current 8.10 typed local Git read boundary record (2026-08-17)

The Section 8.10 protocol boundary is repository-tracked in
`G:\Jarvis Project\packages\protocol\src\tool-git.mts` and its `.mjs`
entrypoint, with focused coverage in
`G:\Jarvis Project\tests\layers\unit\tool-git.test.mjs`. It defines separate
typed STATUS, BRANCH, DIFF, and LOG read operations. Each operation is
PROJECT_WORKSPACE-scoped, Windows/FULL_HOST/x64-qualified, read-only,
idempotent, and declares no network requirement. Inputs and outputs are
strictly validated; Git paths stay workspace-relative, status/history and diff
sizes are bounded, and repository/workspace identity is returned as evidence.
The platform boundary is injected and owns the eventual canonical Windows
path/reparse and supervised process implementation. No arbitrary Git argument,
write operation, credential, or network side effect is exposed by this
protocol layer.

The source, entrypoint, and tests are repository-tracked; no key, credential,
generated release artifact, removable artifact, or user data was created.
Focused Git tests pass 2/2; the combined Section 7 checkpoint plus Section
8.1–8.10 tests pass 28/28; and root TypeScript typecheck passes using the
repository-compatible Node 24.10.0 binary available on this machine. No new
desktop build was installed or shipped, so no new visual-installation claim is
made. The matrix records 8.10 as `IMPLEMENTED` and advances the next eligible
subsection to 8.11.

### Current 8.11 tool conformance record (2026-08-17)

The Section 8.11 adversarial conformance suite is repository-tracked at
`G:\Jarvis Project\tests\layers\unit\tool-conformance.test.mjs`. It checks
all current Section 8 manifests for exact Windows/FULL_HOST scope, allowed
workspace/system scope distinctions, empty secret capabilities, and explicit
network declarations; exercises absolute/UNC/traversal rejection across
filesystem, open, and Git inputs; and verifies expected-target CAS conflict,
idempotent replay, and missing-postcondition `UNCERTAIN` behavior.

The test file is repository-tracked; no key, credential, generated release
artifact, removable artifact, or user data was created. The combined Section 7
checkpoint plus Section 8.1–8.11 regression passes 32/32, with the expected
Node module-type performance warning from the existing policy package, and root
TypeScript typecheck passes using the repository-compatible Node 24.10.0 binary.
The matrix records 8.11 as `IMPLEMENTED` and keeps 8.CP `IN PROGRESS` because
the concrete Windows path/reparse/process boundaries, Core-owned admission and
audit wiring, and live qualification evidence are still required.

### Current 8.CP native workspace path-boundary slice record (2026-08-17)

The first concrete Windows filesystem capability for the Section 8 checkpoint
is repository-tracked in
`G:\Jarvis Project\platform\windows\src\path_identity.rs`. Its typed
`PlatformPathsAndIdentity::read_workspace_text` operation resolves the exact
registered workspace and relative target, rejects reparse-point/non-file
targets, enforces the 1 MiB UTF-8 bound, returns only canonical target/version
evidence plus content bytes, and resolves the target again after reading to
reject identity or version drift. It is a native path/filesystem capability
only; it does not grant Core permission or bypass ToolExecutor admission.

The source is repository-tracked and contains no credentials, keys, generated
release artifact, removable artifact, or user data. Focused Windows path tests
pass 9/9, including bounded read success, oversized/non-UTF-8 rejection,
reparse/traversal rejection, missing-leaf handling, and target identity/version
behavior. The same boundary now also exposes
`PlatformPathsAndIdentity::write_workspace_text`, which accepts only an
expected current version token, writes bounded UTF-8 content to a same-directory
create-new temporary file, flushes it, atomically replaces the existing regular
file, and re-reads the result for postcondition evidence. It does not perform
Core permission/admission, project-policy, idempotency, or audit decisions.

The focused Windows path suite passes 14/14, including exact registration IDs,
identity-retargeting rejection, stale-version non-mutation, size/type
rejection, and successful postcondition evidence. The full locked Rust
workspace passes 109/109 executed tests with three explicitly ignored
live/external fixtures. The authenticated Core shell now exposes a typed
`execute_tool` request route that validates the `ToolRequest`, requires the IPC
request ID to equal the tool-execution ID, rejects retargeted/malformed
envelopes, and calls only an explicit Core-owned execution handler. Without
that handler it returns the truthful `CORE_TOOL_RUNTIME_NOT_READY` result; it
never fabricates tool success. The route and its failure/retargeting cases pass
the focused Core bootstrap suite 12/12. The authenticated Windows IPC/Tauri
boundary now exposes the same bounded `execute_tool` request with UUIDv7
identity, required boundary-field checks, payload-size enforcement, exact Core
result identity/outcome validation, and truthful Core error propagation. The
native IPC route passes 18/18 focused tests, including request framing,
not-ready propagation, and malformed/retargetable input rejection. The desktop
renderer now reaches that command only through `apps/desktop/src/coreBridge.ts`,
which validates the returned ToolResult identity/outcome envelope; the focused
desktop security/bridge suite passes 19/19. The live Core entrypoint now
composes the registered `CoreToolRuntime` and all ten Section 8 manifests
behind an explicit fail-closed native-capability and admission-context gate.
Until the authenticated Windows adapter channel and real permission/pre-ALLOW
fact providers are attached, a live tool request returns an audited
`UNCERTAIN` result with no adapter call; it cannot fabricate success. The
focused Core runtime suite passes 5/5 for this composition behavior and root,
Core, and desktop TypeScript checks pass. Native Windows adapter transport,
native open/supervised engineering execution, live fact production, and
end-to-end desktop tool qualification remain unfinished; therefore this record
does not claim 8.CP completion or a shipped desktop qualification.

### Current 7.13 provider quota/usage and evidence record (2026-08-17)

Provider quota and usage facts are represented by
`G:\Jarvis Project\packages\protocol\src\accounting.ts` and
`G:\Jarvis Project\packages\protocol\src\accounting-runtime.mts`, with
append-only Core persistence in
`G:\Jarvis Project\services\core\src\schema.ts` tables
`provider_quota_snapshots` and `usage_records`. The validators preserve
`PROVIDER_REPORTED`, `JARVIS_CALCULATED`, and `UNKNOWN`; unknown values are
omitted rather than fabricated as zero. Setup readiness claims require
`lastVerifiedAt` and `conformanceEvidenceRef`, while qualification claims
require `verifiedAt` and `evidenceRef`, so support claims cannot be persisted
without evidence references. The records are repository-tracked source and
no secrets are stored. Accounting/provider tests, Core typecheck/build, and
the normal profile pass; hard budget reservation/settlement remains a later
Section 11 responsibility.

### Historical pre-ADR-076 7.10 sandbox-conformance record (2026-08-16)

This subsection records the superseded network-denial experiment. ADR-076
changed the active requirement to enabled network access for delegated Codex
CLI workers. The current requirement and evidence are the ADR-076 record near
the top of this file and the current Section 7.10 matrix row; the denial
observations below must not be used as a current readiness gate.

The provider qualification boundary now performs real, bounded conformance
checks instead of treating setup-helper success, a sandbox identity, and CLI
help output as sufficient:

| Artifact | Exact location | Purpose and allowed use | State / evidence |
|---|---|---|---|
| Codex sandbox conformance implementation | `G:\Jarvis Project\platform\windows\src\provider_qualification.rs` | Runs the qualified `codex.exe` under an explicit provider sandbox state and verifies assigned-workspace write/read, outside-workspace write denial, the qualified identity, a medium-integrity/no-Administrators token, and network denial before setup can report readiness | Working-tree source change; ordinary focused Rust tests pass 6/6, including the medium-integrity/admin-SID negative checks and workspace-scoped/network-disabled state coverage; the ignored live test was run against the installed `codex-cli 0.147.0` and failed closed with `NetworkAccessNotDenied` after identity, token, workspace write/read, and outside-write-denial checks passed |
| Live conformance test | `G:\Jarvis Project\apps\desktop\src-tauri\src\main.rs` test target, test name `provider_qualification::tests::live_qualified_codex_probe_must_pass_all_workspace_gates` | Manual qualification-only test for the installed Windows provider; it is ignored in ordinary CI/local test runs because it requires the real installed provider and Windows sandbox | Intentionally failing on the current provider because a loopback/HTTP network probe succeeded even with `network.enabled=false` and `--sandbox-state-disable-network`; this prevents a false `SETUP_READY` claim |
| Temporary conformance fixtures | Created under `%TEMP%` and the current user's profile only during the live probe | Ephemeral marker files used to test assigned and outside-workspace behavior; never release inputs and never contain secrets | Removed after the probe; no fixture path remains |

The direct provider observations are: sandbox identity
`legion\\codexsandboxoffline`; medium-integrity token with no
`S-1-5-32-544` Administrators group PASS; assigned-workspace write PASS;
assigned-workspace read-back PASS; outside-home write denied PASS; network
denial FAIL because `curl.exe` reached the test endpoint. Enabling the
installed CLI's experimental
`network_proxy` feature through both `--enable network_proxy` and
`features.network_proxy=true` produced the same successful HTTP response, so
that feature is not evidence of network isolation on this installation. At
that historical point the provider was unqualified for the then-required
denied-network experiment. That conclusion was superseded by ADR-076; current
Codex readiness requires a successful enabled-network probe and does not
require provider network denial.

The active user Codex configuration reports `sandbox_mode = "danger-full-access"`,
so the probe was repeated with explicit provider overrides for
`sandbox_mode="workspace-write"`, `sandbox="workspace-write"`, and
`network_proxy=false` in addition to the explicit disabled-network state. Each
variant still reached the test endpoint and exited successfully. The failure is
therefore not explained by the user's default configuration alone.

The supported Codex updater was also run on this machine. It resolved to the
same `codex-cli 0.147.0` release and the installed binary hash was unchanged;
no newer provider was available through that update channel.

For completeness, a disposable active permission profile with the supported
network-proxy feature enabled, limited mode, and both a network-disabled
profile and an explicit `example.com = deny` domain rule was supplied to the
same sandbox invocation. The external HTTP probe still returned successfully,
so this is not caused only by omitting a proxy profile. A bare `*` domain rule
is rejected by the installed CLI as invalid and is not counted as evidence.

An isolated temporary `CODEX_HOME` with a complete `config.toml` and the
named `development` permission profile was also attempted. The installed
CLI rejected the invocation before running the command with
`Restricted read-only access requires the elevated Windows sandbox backend`;
the temporary configuration file was removed and is not qualification
evidence. A separate disposable profile using the documented network-proxy
shape was also removed after the same provider rejection; only empty generated
directories remain under
`G:\Jarvis Project\target\jarvis-codex-network-profile*`.

An official pre-release candidate was tested separately and was not adopted:
`codex-cli 0.148.0-alpha.20`, downloaded only to
`C:\Users\junme\AppData\Local\Temp\jarvis-codex-alpha-0.148.0-alpha.20\`
from the official release asset. The downloaded archive SHA-256 was
`33c3b2274165c595ec2f521e927c68c1e59429fe43d866f71c13f9e759b89632`; the
matching sandbox-helper SHA-256 was
`1cf81f485518e8242033f2843d98eea37d6899b6742cb0fec24958d06497ccb4`.
The candidate passed the qualified identity and sentinel probes, but its
network-disabled HTTP probe also exited successfully (`NETWORK_EXIT=0`), so
it does not satisfy 7.10 and is not a supported replacement. The temporary
pre-release files remain at that exact path because the runtime refused the
cleanup command; they are not repository-tracked or release inputs and must
not be used by JARVIS. They should be removed when the host permits safe
per-file cleanup.

The provider source documentation was also checked against this result. The
official network-proxy documentation describes `network_proxy` as a policy
proxy for sandboxed sessions that already have network access and warns that
stronger lower-layer egress control requires a firewall or equivalent boundary:
<https://github.com/openai/codex/blob/main/codex-rs/network-proxy/README.md>.
The provider's debug-sandbox path currently constructs the Windows request with
proxy enforcement disabled:
<https://github.com/openai/codex/blob/main/codex-rs/cli/src/debug_sandbox.rs>.
These sources explain why enabling the experimental proxy, setting a proxy
environment variable, or observing provider-created firewall rules cannot be
recorded as JARVIS network-denial evidence. They do not qualify the installed
provider and do not authorize a repository-side bypass.

An earlier read-only check reported `Bitdefender Firewall` as the firewall
category owner and the provider-created rules as inactive. After the user
disabled Bitdefender Firewall and the full helper setup was rerun, Windows
Firewall profiles remained enabled and the provider rules parsed successfully,
but the independent HTTP/loopback probe still succeeded. The remaining cause
is therefore not established as a missing UAC step or a disconnected Codex
host; the installed provider/Windows boundary still has no demonstrated
worker-side egress denial. This diagnostic is read-only evidence from the
current machine, is not a repository or release artifact, and must not be
treated as network-denial qualification. JARVIS must not silently disable or
reconfigure a third-party firewall; a supported equivalent firewall policy or
an explicitly qualified provider/platform boundary is required before 7.10 can
pass.

### Codex setup-marker repair record (2026-08-16)

The installed Codex provider keeps its setup marker at
`C:\Users\junme\.codex\.sandbox\setup_marker.json`. This is provider-owned,
external user state; it is not repository-tracked and must never be copied into
the repository or release artifacts. The marker can remain after incomplete
firewall/WFP provisioning and cause later refreshes to repair only ACLs while
leaving network enforcement unqualified. The repository-side repair path is
`G:\Jarvis Project\platform\windows\src\provider_qualification.rs`:
before the user-authorized, exact Codex UAC setup operation it preserves an
existing marker as
`C:\Users\junme\.codex\.sandbox\setup_marker.json.jarvis-previous-<timestamp>`
and lets the qualified helper recreate the active marker. A broker/UAC failure
restores the original marker; a completed helper followed by a failed
conformance probe leaves the preserved copy for recovery and keeps readiness
failed closed. These backup copies contain provider setup metadata only, not
credentials or private keys, and must not be treated as proof of sandbox
qualification. This behavior is based on the provider's documented Windows
setup recovery behavior; live network-denial conformance remains required.

### Current 7.7 generated/build artifact record (2026-08-16)

The Core build generated these ignored, reproducible outputs under the repository
build tree:

| Artifact | Exact location | Purpose and allowed use | State / retention / evidence |
|---|---|---|---|
| Compiled conversation support | `G:\Jarvis Project\services\core\dist\conversation.js` and `G:\Jarvis Project\services\core\dist\conversation.mjs` | Release packaging inputs for Core's ConversationService boundary | Ignored/generated; regenerate from the exact source commit; package tests pass |
| Compiled Codex adapter support | `G:\Jarvis Project\services\core\dist\codex-cli-adapter.mjs` | Release packaging input for the qualified Codex adapter | Ignored/generated; contains no private keys or credentials; package tests pass |
| Compiled Core provider-routing support | `G:\Jarvis Project\services\core\dist\provider-routing.js` | Release packaging input for Core's persisted provider-role routing boundary | Ignored/generated; regenerate from the exact source commit; Core packaging and packaged-runtime tests pass 4/4 |
| Ephemeral provider schema/output | A temporary `jarvis-codex-*` directory under the current user's `%TEMP%` during each adapter call | Short-lived provider schema and final-message exchange files only | Removed by the adapter's `finally` cleanup; no retained path or secret material |
| Rebuilt Windows desktop host | `G:\Jarvis Project\target\x86_64-pc-windows-msvc\release\jarvis-desktop-host.exe` | Local qualification build containing the Codex setup-marker repair and current desktop/Core implementation; use only for supervised private qualification, not as a release artifact until the full release gates pass | Ignored/generated; release build completed on 2026-08-16; executable is not signed or publicly released |
| Desktop visual verification capture | `C:\Users\junme\AppData\Local\Temp\jarvis-visual-20260816.png` | Temporary full-screen evidence that the rebuilt host opened visibly with a nonblank Mission Control window; the fresh profile truthfully showed `NOT_INITIALIZED`/Create session rather than a false ready state | External temporary file; contains no credentials; retain only for this qualification record and remove when no longer needed |

### Mission Control navigation repair record (2026-08-16)

The desktop navigation links previously changed only the URL fragment to
nonexistent targets, so selecting `Systems / Integrations` appeared to do
nothing. The tracked renderer change is
`G:\Jarvis Project\apps\desktop\src\mission-control.tsx`, with focused
regression coverage in
`G:\Jarvis Project\tests\layers\unit\desktop-workspace.test.mjs`. The
navigation now updates the active destination and shows a truthful
`LOCKED · CORE_REQUIRED` panel for sections whose authoritative Core read model
is not connected; it does not fabricate integration or system state.

The rebuilt executable used for verification is the ignored/generated
`G:\Jarvis Project\target\x86_64-pc-windows-msvc\release\jarvis-desktop-host.exe`.
The live visual evidence is
`C:\Users\junme\AppData\Local\Temp\jarvis-visual-systems-clicked.png`, an
external temporary screenshot showing `Systems / Integrations` selected,
`LOCKED · CORE_REQUIRED`, session `UNLOCKED`, and provider `SETUP_READY`.
Focused desktop tests (11/11), strict TypeScript typecheck, and `git diff
--check` pass. The screenshot is retained for this qualification record and
contains no credentials; it is not a repository release artifact.

### Mandatory shipped-desktop visual verification

After every newly built, installed, or shipped desktop build, the agent SHALL
perform a real launch check and inspect the visible Mission Control window
before handoff. The check SHALL confirm that the window is visible, the UI is
not blank, the displayed Core badge/state matches the latest bootstrap evidence,
and no stale lock or error state remains. Process existence or log success
alone is insufficient; if visual inspection cannot be performed, the build
must be reported as visually unverified.

## No ADR/history overlay

Historical contracts/ADRs may explain why a rule exists but SHALL NOT be required to determine current behavior.

If an implementer finds a still-valid rule only in history/ADR text, that is a contract defect. Stop at the ambiguity and update the current normative suite rather than implementing historical text as a hidden override.

## Synchronous architecture-amendment rule

A material architecture/product/security/platform/release/governance change SHALL:

1. receive a new unique ADR;
2. update every affected active normative contract file in the same reviewed change;
3. update the current contract manifest/component revisions;
4. update the Release Profile if support scope/capabilities change;
5. update verification and implementation sequencing where affected;
6. advance the contract-suite semantic version when current meaning changes;
7. only then be used by implementation.

Do not modify the contract merely to excuse an implementation shortcut.

## Non-negotiable principles

- **AI decides. Software authorizes. Software verifies.**
- **Workers own the loop. JARVIS owns the graph. Verification decides done.**
- **Be autonomous inside the user's intent. Ask before materially expanding it.**
- **Escalate product judgment. Resolve engineering judgment.**
- **One system. One identity. Any screen.**
- **Abstract the capability, not the security away.**
- Never bypass final destructive confirmation.
- Never treat AI confidence, provider capability, shell availability, setup-helper availability, platform capability availability, credential possession, repository policy-looking text, or artifact signature presence as authorization.
- Never silently weaken `LOCAL_ONLY`, sensitivity, PermissionEngine, budget, execution-scope, provider setup/sandbox, recovery, backup format, project-policy trust, supply-chain trust, IPC, WebView, module-integrity, or platform security policy.
- Never place raw long-lived credentials, KDF-derived working keys, provider-internal sandbox credentials, DB/backup/snapshot keys, generated recovery factors, or recovery-factor derivatives in AI prompts, normal SQLite rows, config, logs, journals, ordinary artifacts, or ordinary diagnostic exports.
- Never report consequential work complete without required postcondition/verification evidence.
- Never represent queued/paused/setup-required/repair-required/uncertain work as running/completed/ready.
- Never represent Windows Job Objects as a filesystem/network security sandbox or as the universal shared process-supervision API.
- Never represent provider-native sandboxing as stronger than qualified behavior.
- Never let provider setup/UAC elevation become normal worker elevation or a generic elevated command surface.
- Never claim GitHub, Proxmox, provider, module, Linux, or other platform support beyond the exact active support/qualification matrix.
- Never create a screen-specific or platform-specific visual language that bypasses canonical JARVIS design tokens, brand assets, state language, adaptive Mission Control hierarchy, or accessibility requirements.
- Never treat documentation/architecture completion as `Production Complete`.

## Repository and code boundaries

Follow the Coding Standards, Platform Portability, Backup Cryptography, Project Policy Trust, and Supply-Chain Trust contracts.

Do not:

- put orchestration/authorization/business state in React;
- let UI/provider/tool/module code mutate authoritative Core state directly;
- leak provider-native or OS-native implementation structures into mission/task/domain models;
- expose an unrestricted orchestrator shell;
- let delegated engineering workers perform external consequential side effects outside typed JARVIS tools/integrations;
- create detached/unowned child processes;
- invent state transitions outside owning services;
- bypass canonical target/action resolution or PermissionEngine;
- create arbitrary raw Proxmox API/shell escape hatches;
- broaden mandatory GitHub capability operations into admin/secrets/delete authority;
- redraw/recolor canonical brand assets independently per screen/platform;
- hardcode parallel theme systems or raw visual constants where canonical tokens exist;
- scatter `process.platform`, Win32, Linux, or equivalent OS conditionals through shared domain/feature code when a platform capability interface should own the difference;
- add dependencies/assets without concrete need and license/provenance review.

## Engineering workflow

- Work on a temporary feature branch/worktree rather than directly on `master` unless explicitly instructed otherwise, always from current live `master`.
- Re-fetch `master` and working tip before writes when concurrent changes may exist.
- Preserve valid concurrent work.
- Keep commits scoped/reviewable.
- Contract/schema changes include compatibility/migration implications.
- Security/state/recovery/backup/update-trust/project-policy/governance changes include negative/failure/adversarial tests and truthful residual-risk evidence where applicable.
- Provider upgrades require setup/compatibility/platform conformance evidence before `SUPPORTED`.
- Tauri/WebView capability/CSP changes are security changes.
- Integration changes state exact capability support and do not rely on generic `connected` state.
- Platform-native changes preserve capability interfaces and include platform-specific qualification impact.
- UI changes preserve approved JARVIS identity across adaptive layouts; future Linux/companion surfaces reuse product identity rather than inventing unrelated shells.
- Do not begin application implementation unless the user explicitly moves the project into implementation work; contract hardening alone is not implementation authorization.

## Contract implementation execution protocol

These rules apply once the user explicitly authorizes application implementation. They operationalize the locked active contract suite; they do not replace it, narrow it, or become a competing source of product/security truth.

### Contract is master authority

- The active manifest and every active normative component remain the master authority for implementation behavior.
- The implementation goal, matrix, section/subsection structure, scores, plans, checklists, and progress summaries are execution aids only.
- Omission of a contract requirement from a matrix/checklist does not make that requirement optional.
- Code SHALL be corrected to the contract. Do not reinterpret or weaken the contract merely because a different implementation is easier.
- If current normative text has a genuine material ambiguity/contradiction/defect, stop at that ambiguity and use the synchronous architecture-amendment rule before implementation depends on a guessed interpretation.
- Routine engineering judgment that does not change product/security/architecture meaning SHALL be resolved by the implementer without stalling the execution loop; record material assumptions and keep them contract-consistent.

### Implementation matrix

Maintain one current implementation matrix derived from the active Implementation Plan plus all cumulative active-contract requirements.

The canonical execution/status board is `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`. Before starting or resuming application implementation, read that file after revalidating live `master`, the current manifest, and the Implementation Plan. Use its current execution pointer and next eligible subsection, update its status/gap/evidence fields as work progresses, and do not create a competing implementation matrix.

The matrix is non-normative. Its ordering/status/evidence aids execution, while the current active contract suite remains the only implementation authority. If the matrix and current contract ever disagree, stop dependent implementation, reconcile the matrix to the contract, and do not use the matrix to waive or reinterpret a normative requirement.

The matrix SHALL use one hierarchical first column named equivalent to `Section / Subsection`: each section appears once as a section row and its subsections are listed beneath it in the same column. Do not flatten the matrix by repeating the section name in a separate section column for every subsection.

Recommended tracking fields are:

```text
Section / Subsection
Status
Governing Contract / Traceability
Score
Weakest Current Gap
Evidence / Result
```

Additional fields such as dependencies, blocker, checkpoint, or evidence references MAY be added when useful, but the section/subsection hierarchy remains the primary execution structure.

Canonical implementation statuses are:

```text
NOT STARTED
IN PROGRESS
BLOCKED
IMPLEMENTED
VERIFYING
VERIFIED
```

`DEFERRED` or `NOT APPLICABLE` may be used only where the active contract actually permits that classification and the reason is recorded.

Status semantics:

- `NOT STARTED` — no implementation work has begun for the subsection.
- `IN PROGRESS` — active implementation/fix work continues.
- `BLOCKED` — a genuine external prerequisite prevents reasonable further progress; ordinary build/test/design failures are not blockers.
- `IMPLEMENTED` — intended implementation exists but has not yet cleared all required verification.
- `VERIFYING` — hard acceptance/evidence gates are being run or reconciled.
- `VERIFIED` — subsection hard criteria, mandatory evidence, and scoring gates all pass.

Only one implementation subsection SHALL be the primary active target at a time. Work may inspect dependencies or perform narrowly necessary enabling work, but the agent SHALL NOT abandon a failing subsection merely to accumulate partial progress across later subsections.

### Subsection contract packet

Before implementing an active subsection, define its execution packet from the current contract suite:

```text
GOAL
GOVERNING CONTRACT REFERENCES
DEPENDENCIES / PRECONDITIONS
REQUIRED IMPLEMENTATION OUTPUTS
HARD ACCEPTANCE CRITERIA
REQUIRED TESTS / NEGATIVE TESTS / LIVE EVIDENCE
ATOMICITY APPLICABILITY AND MODEL
IDEMPOTENCY / RETRY-SAFETY APPLICABILITY AND MODEL
CURRENT STATUS / SCORES / WEAKEST GAP
```

Criteria SHALL be specific enough to fail. Avoid soft wording such as "looks production ready", "mostly compliant", or "appears secure" without measurable evidence.

### Mandatory subsection scoring baseline

Every subsection SHALL be evaluated against the following cross-cutting criteria, in addition to subsection-specific criteria derived from the contract:

| Criterion | Required gate |
|---|---:|
| Contract Accuracy | **10/10 exactly** |
| Production Readiness | **>= 8/10** |
| Production Practices | **>= 8/10** |
| Enterprise Hardening | **>= 8/10** |
| Atomicity | **>= 8/10 where applicable** |
| Idempotency / Retry Safety | **>= 8/10 where applicable** |
| Failure / Recovery Behavior | **>= 8/10 where applicable** |
| Security / Least Privilege | **>= 8/10 where applicable** |
| Observability / Diagnostics | **>= 8/10 where applicable** |
| Test / Verification Quality | **>= 8/10** |
| Maintainability / Architecture Integrity | **>= 8/10** |

Rules:

- **Contract Accuracy is an absolute veto.** `9/10` is not sufficient. It cannot be waived by high scores elsewhere.
- Contract Accuracy reaches `10/10` only when the subsection is fully traceable to and consistent with all applicable active normative requirements, with no known omitted mandatory requirement, undocumented semantic deviation, or implementation-created architecture change.
- Scores are prioritization aids, not substitutes for mandatory evidence. A failed hard contract/test/security/recovery/release gate prevents completion regardless of a subjective numeric score.
- A criterion with a known material production blocker SHALL remain below its passing threshold.
- `N/A` requires a concrete technical reason and is permitted only for genuinely inapplicable criteria. Contract Accuracy is never `N/A`.
- Subsection-specific criteria may be stricter than the baseline and may require `10/10` where the contract fixes exact protocol/security/state semantics.

### Production-readiness standard

"Working" is not equivalent to production-ready. Applicable subsection evaluation SHALL consider normal success plus realistic failure, ambiguity, interruption, crash/restart, concurrency, stale state, cancellation, resource pressure, degraded dependency behavior, security abuse, recovery, upgrade/migration, and operational diagnosis.

Production-quality implementation SHALL, where applicable:

- fail closed or degrade truthfully;
- use explicit typed/runtime-validated boundaries;
- preserve least privilege and minimum authority;
- surface deterministic errors/status rather than swallow failures;
- prevent false success/completion reporting;
- define cancellation, timeout, lifecycle ownership, and cleanup;
- define restart/recovery behavior;
- reject stale/changed targets or state rather than silently retarget;
- protect secrets before relying on redaction;
- provide sufficient structured diagnostics/audit evidence;
- include negative/adversarial/failure tests, not only happy paths;
- use pinned/reproducible dependencies/toolchains and track license/provenance where applicable;
- avoid TODO/placeholders/stubs/fallbacks that make an incomplete production path appear supported.

Enterprise hardening is not decorative polish. It means the subsection remains controlled, truthful, diagnosable, recoverable, least-privileged, and bounded when realistic things go wrong.

### Atomicity requirements

Every subsection that mutates authoritative state or performs consequential operations SHALL explicitly determine its atomicity boundary.

For authoritative local state within one SQLite transaction boundary, preserve the contract pattern:

```text
resolve / compute / validate outside transaction
→ begin transaction
→ assert expected state/version
→ write authoritative transition
→ append causative event/audit evidence
→ update invariant-critical leases/reservations/indexes
→ commit
→ publish post-commit in-memory notification/event
```

A failed commit SHALL NOT be reported as successful completion.

Do not pretend JARVIS and an external provider/service share one atomic transaction. For external effects use attempts, persisted intent/state, preconditions/conditional mutation, postconditions, `UNCERTAIN`, and reconciliation/recovery as required by the active contracts.

Where true atomicity is technically unavailable, the implementation SHALL use the strongest contract-compatible safe pattern and explicitly prove the partial-failure/recovery behavior rather than hide the limitation.

### Idempotency and retry-safety requirements

Every retryable or replayable mutating path SHALL define behavior for duplicate requests, timeouts, crashes, event replay, stale responses, and concurrent execution.

Use provider/system-native conditional or idempotency mechanisms where supported, including mechanisms equivalent to:

```text
idempotency key
expected row version
ETag / If-Match
expected Git ref/SHA
filesystem identity/hash/version
generation/revision token
other compare-and-set precondition
```

A changed precondition SHALL trigger conflict/re-resolution/re-authorization/re-approval as applicable. Do not silently apply stale authority to changed state.

If a consequential external result may have occurred but cannot be proven, return/persist `UNCERTAIN` or the contract-equivalent state and reconcile live state before retry. Never blindly retry an ambiguous destructive/high-risk effect.

Idempotency does not mean "retry until green". It means repeated/replayed execution cannot silently duplicate or corrupt consequences outside the action's defined semantics.

### Subsection implementation loop

Work each subsection in repeated passes until it reaches its exact subsection goal:

1. **DRAFT** — implement or improve the active subsection and run the most relevant verification available.
2. **SCORE** — score every mandatory baseline criterion and subsection-specific criterion harshly against current evidence.
3. **GAPS** — list the exact remaining weaknesses and identify the single weakest legitimate score/gate.
4. **CALL** —
   - if Contract Accuracy is not `10/10`, write `NEXT PASS`;
   - if any other applicable required score is below its threshold, write `NEXT PASS`;
   - if any mandatory hard acceptance/test/security/recovery/evidence gate is failing or unknown, write `NEXT PASS`;
   - otherwise write `DONE` for the subsection and mark it `VERIFIED`.

Each new pass fixes the single weakest gap from the previous pass first. If several gaps tie, prioritize in this order unless the contract dictates otherwise:

```text
contract correctness
→ authorization/security/data-loss/recovery risk
→ state/atomicity/idempotency correctness
→ production functionality/reliability
→ verification/observability
→ maintainability/polish
```

Do not stop merely because a test, build, dependency, or first implementation approach fails. Diagnose, correct, retest, rescore, and continue while repository-side progress remains reasonably possible.

### Section checkpoint

A parent section does not become `VERIFIED` merely because its subsection rows individually show `VERIFIED`.

After every required subsection in a section is verified, run the section-level integration checkpoint required by the active Implementation Plan and all cross-subsection contracts. The checkpoint SHALL verify integration behavior, architecture boundaries, state/security invariants, failure/recovery interaction, and any named release checkpoint evidence applicable to that section.

Only when both conditions are true may the parent section be marked `VERIFIED`:

```text
all required subsections VERIFIED
AND
section integration/checkpoint gate passes
```

Then advance to the first subsection of the next section in the authoritative implementation sequence.

### Evidence hierarchy and no-soft-pass rule

Prefer completion evidence in this order where applicable:

1. deterministic automated verification;
2. real/live platform or external-system verification;
3. integration/conformance tests;
4. security/negative/adversarial tests;
5. crash/recovery/fault-injection evidence;
6. static architecture/type/schema/forbidden-import verification;
7. independent review where judgment is required;
8. producer/agent self-review only as supporting evidence.

A model/worker statement that something is complete is never sufficient by itself. Mock-only evidence does not replace a contract-required real Windows/provider/integration/device/release test.

Never raise a score to pass merely to advance the matrix. If evidence is unavailable, status remains truthful (`IN PROGRESS`, `VERIFYING`, or genuine `BLOCKED`) until the required gate can be satisfied.

### Blocker semantics

Use `BLOCKED` only for a genuine dependency outside the currently available repository-side work, such as unavailable required hardware, external service/environment/account access, signing material/certificate, production qualification target, or a true normative contract defect requiring user/product decision.

The following are not blockers by themselves:

```text
compile failure
test failure
lint/type failure
implementation bug
integration bug
dependency incompatibility that can be replaced/fixed
first approach failure
unexpected engineering complexity
```

Those remain `IN PROGRESS` and are worked through.

When a genuine blocker prevents one piece of evidence but other contract-safe repository work inside the same subsection can still be completed, complete that work first and document exactly what remains externally blocked.

An unavailable optional hosting governance feature is not a blocker when the active contract explicitly permits `COMPENSATING_CONTROLS` and that mode's verification gates can be satisfied. It remains a truthful recorded hosting limitation, not a fabricated `SERVER_ENFORCED` result.

### Checkpoint continuation summary

At every designated subsection/section/release checkpoint, maintain a concise continuation summary containing exactly these categories:

1. **Original goal** — the overall implementation objective governed by the locked contract.
2. **Completed / found** — what is actually implemented/verified and important discoveries.
3. **Key decisions** — implementation decisions made within the contract; do not record hidden reasoning/private chain-of-thought.
4. **Remaining** — current matrix position, blockers/gaps, and the next exact subsection/checkpoint target.

Treat the checkpoint summary as the next continuation baseline, but re-fetch live `master`, reread the current `AGENTS.md`, and revalidate the active manifest before new repository writes.

### Final completion boundary

The subsection/section scoring loop never overrides the active Release Profile or Verification Contract.

`Production Complete` may be declared only when the exact source commit and exact signed Windows `FULL_HOST` release artifacts pass every mandatory active-contract qualification gate, including the complete release/profile/security/recovery/provider/integration/UI/voice/update/soak/provenance evidence. Intermediate section completion, high scores, green unit CI, or documentation completion are not equivalent to `Production Complete`.

## Definition of done

A change is complete only after all applicable formatting, strict type/build checks, architecture/import checks, unit/property/schema tests, integration/security/recovery tests, backup-format vectors, project-policy trust tests, supply-chain trust tests, provider-setup tests, platform-boundary checks, UI/accessibility/adaptive-layout checks, and documentation pass.

Production readiness is defined only by the active Release Profile plus every mandatory qualification requirement in every active normative component for the exact signed artifacts.

### Current 8.CP native project-status record (2026-08-17)

The `status.project` native capability is wired through the authenticated
Core/native channel. `CoreBootstrap` reads the exact project, workspace, and
project-policy trust records from `G:\Jarvis Project\services\core\src\schema.ts`,
maps policy trust states to the protocol's explicit status vocabulary, and
sends that Core-owned snapshot only after the requested workspace is bound.
The Windows host validates the project/workspace identities against the bound
registration and returns the snapshot without deriving policy state from the
filesystem or AI/provider output. Unknown or mismatched identities fail
closed.

The implementation is repository-tracked source in
`G:\Jarvis Project\services\core\src\main.ts`,
`G:\Jarvis Project\services\core\src\schema.ts`,
`G:\Jarvis Project\services\core\src\native-capability.mts`, and
`G:\Jarvis Project\apps\desktop\src-tauri\src\main.rs`, with focused tests
in `G:\Jarvis Project\tests\layers\unit\native-capability.test.mjs`,
`project-registry.test.mjs`, and `project-policy-state.test.mjs`. No external,
generated, removable, key, credential, or user-data artifact was created.
The bundled-runtime focused suite passes 16/16, TypeScript and the Windows
release-target cargo check pass, and the broader normal profile remains the
required verification. This is source/test evidence only: live Core
permission and pre-ALLOW fact production, supervised engineering, and a
newly installed desktop visual qualification remain open, so 8.CP remains
`IN PROGRESS`.

### Current 8.CP supervised-engineering record (2026-08-17)

The Windows supervised engineering boundary is repository-tracked source, not
a release artifact. `G:\Jarvis Project\platform\windows\src\process_supervisor.rs`
contains the fixed `npm.test` and `npm.build` profile mapping to the installed
Node/Corepack `pnpm test` and `pnpm build` entry points. The desktop dispatch
and typed native-client coverage are in
`G:\Jarvis Project\apps\desktop\src-tauri\src\main.rs` and
`G:\Jarvis Project\tests\layers\unit\native-capability.test.mjs`.
The boundary is used only for Core-authorized PROJECT_WORKSPACE engineering;
it accepts no arbitrary command, shell, executable, argument, or inherited
environment and does not create or store credentials. The process is assigned
to the existing kill-on-close/no-breakaway Windows Job Object before resume.
The native client test passes; the Windows process-supervisor suite passes
10/10 executable tests with one separately ignored external Codex fixture;
TypeScript checks and the Windows release-target cargo check pass. No installer,
generated runtime, removable artifact, external
credential, or signing material was created or changed; live engineering and
Core permission/pre-ALLOW qualification remain outstanding and 8.CP remains
`IN PROGRESS`.

The Core admission context in
`G:\Jarvis Project\services\core\src\main.ts` now records the composed
Windows capability set and reads the exact Core project-policy status for
workspace-scoped requests. The read-only status tool may report policy state;
consequential workspace tools require `TRUSTED_POLICY`. Filesystem, Git, and
engineering precondition hooks now use typed native identity/status evidence;
the open-application path remains unqualified, and live permission,
postcondition, cancellation, and installed visual qualification remain open.
This is repository-tracked source behavior with no new external or generated
artifact; it is intentionally fail-closed and does not authorize a tool by
itself.

### Current 8.CP bounded open-target record (2026-08-17)

The typed open manifest in
`G:\Jarvis Project\packages\protocol\src\tool-open.mts` now advertises only
the qualified `project.open` and `file.open` platform capabilities. Core
admission in `G:\Jarvis Project\services\core\src\main.ts` accepts only the
registered workspace PROJECT/FILE forms after a native workspace identity
check; APPLICATION requests return the bounded
`APPLICATION_OPEN_UNQUALIFIED` admission failure because the active contract
does not define an application allowlist or identity binding. The Windows
host implementation remains in
`G:\Jarvis Project\platform\windows\src\open_target.rs` and uses only the
registered Explorer-backed project/file boundary. This is repository-tracked
source and test behavior, with no new installer, runtime, credential,
removable, or external artifact. Focused open tests pass 2/2, the full local
normal profile passes 80 files, and contract/typecheck/native checks pass; live
Core permission/postcondition and installed visual qualification remain open.
