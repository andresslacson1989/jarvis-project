# JARVIS Repository Engineering Instructions

These instructions apply to all human and AI contributors.

## Branch authority

`master` is the only authoritative/latest repository branch.

Before creating or continuing implementation work, re-fetch live `master` and base the work from that tip. Temporary feature/review branches MAY exist while a change is in progress, but they SHALL NOT become parallel sources of truth.

Before Phase 0 is complete, `master` SHALL be protected by a GitHub ruleset/branch-protection equivalent that blocks force pushes/deletion and requires designated mandatory CI checks, with narrowly controlled/auditable bypass.

## Source of truth

Before implementation or architecture work, read:

1. `README.md`
2. `docs/JARVIS-CONTRACT-MANIFEST-v1.0.5.md`
3. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.5.md`
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

The **v1.0.5 manifest defines the current component revision set**. ADRs do not form a second overlay.

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

## No ADR/history overlay

Historical contracts/ADRs may explain why a rule exists but SHALL NOT be required to determine current behavior.

If an implementer finds a still-valid rule only in history/ADR text, that is a contract defect. Stop at the ambiguity and update the current normative suite rather than implementing historical text as a hidden override.

## Synchronous architecture-amendment rule

A material architecture/product/security/platform/release change SHALL:

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
- Security/state/recovery/backup/update-trust/project-policy changes include negative/failure/adversarial tests.
- Provider upgrades require setup/compatibility/platform conformance evidence before `SUPPORTED`.
- Tauri/WebView capability/CSP changes are security changes.
- Integration changes state exact capability support and do not rely on generic `connected` state.
- Platform-native changes preserve capability interfaces and include platform-specific qualification impact.
- UI changes preserve approved JARVIS identity across adaptive layouts; future Linux/companion surfaces reuse product identity rather than inventing unrelated shells.
- Do not begin application implementation unless the user explicitly moves the project into implementation work; contract hardening alone is not implementation authorization.

## Definition of done

A change is complete only after all applicable formatting, strict type/build checks, architecture/import checks, unit/property/schema tests, integration/security/recovery tests, backup-format vectors, project-policy trust tests, supply-chain trust tests, provider-setup tests, platform-boundary checks, UI/accessibility/adaptive-layout checks, and documentation pass.

Production readiness is defined only by the active Release Profile plus every mandatory qualification requirement in every active normative component for the exact signed artifacts.
