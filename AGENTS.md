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

The **v1.0.6 manifest defines the current component revision set**. ADRs do not form a second overlay.

## Mandatory referenced instruction files

Root `AGENTS.md` intentionally contains only repository-wide authority, source-of-truth, high-level safety, and workflow rules. Detailed operating procedures are split into the following files so agents can load the full instructions relevant to their work without turning this root file back into a monolith.

These files are repository operating instructions, not normative contract components. They SHALL NOT override or reinterpret the active contract suite.

### Implementation execution

Before starting, resuming, scoring, reviewing, or checkpointing application implementation, read in full:

`docs/agent-instructions/implementation-execution-protocol.md`

It owns the detailed subsection packet, matrix/status semantics, scoring baseline, production-readiness standard, atomicity/idempotency rules, repeated implementation loop, section checkpoint, evidence hierarchy, blocker semantics, continuation summary, and final completion boundary previously carried inline here.

### Platform/security/trust boundaries

Before implementation or review involving platform/runtime boundaries, Windows-native mechanisms, backup/recovery cryptography, project-policy trust, supply-chain/update trust, or related security-sensitive behavior, read in full:

`docs/agent-instructions/security-runtime-provider-and-records.md`

It preserves the current v1.0.6 platform/runtime-role, backup/recovery, project-policy-trust, and supply-chain/update boundaries previously carried inline here.

### Legacy implementation reuse

Before implementing any active subsection whose subject matter may overlap historical implementation, read in full:

`docs/agent-instructions/legacy-implementation-reuse-protocol.md`

Future implementation agents SHALL inspect the corresponding implementation on legacy branch `impl/phase0-0.1-admission` before substantial new implementation begins, classify relevant historical assets as `REUSE_AS_IS`, `REUSE_WITH_CORRECTION`, `REIMPLEMENT`, or `REJECT_OUT_OF_SCOPE`, and reuse valid code/tests/structures where compatible with the current contract.

The legacy branch is valuable implementation/reference inventory only. It is never authoritative, never a second source of truth, and never current verification evidence. Current contract, current `master`, current tests, exact-head qualification, and current independent review remain mandatory.

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

## Definition of done

A change is complete only after all applicable formatting, strict type/build checks, architecture/import checks, unit/property/schema tests, integration/security/recovery tests, backup-format vectors, project-policy trust tests, supply-chain trust tests, provider-setup tests, platform-boundary checks, UI/accessibility/adaptive-layout checks, and documentation pass.

Production readiness is defined only by the active Release Profile plus every mandatory qualification requirement in every active normative component for the exact signed artifacts.
