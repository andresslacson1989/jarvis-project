# JARVIS Repository Engineering Instructions

These instructions apply to all human and AI contributors.

## Branch authority

`master` is the only authoritative/latest repository branch.

Before creating or continuing implementation work, re-fetch live `master` and base the work from that tip. Temporary feature/review branches MAY exist while a change is in progress, but they SHALL NOT become parallel sources of truth. Once accepted work is incorporated into `master`, the old branch is historical/disposable and MUST NOT be used as the base for new work.

Before Phase 0 is complete, `master` SHALL be protected by a GitHub ruleset/branch-protection equivalent that blocks force pushes/deletion and requires designated mandatory CI checks, with narrowly controlled/auditable bypass. A pull-request requirement is strongly preferred once implementation begins.

## Source of truth

Before implementation or architecture work, read:

1. `README.md`
2. `docs/JARVIS-CONTRACT-MANIFEST-v1.0.3.md`
3. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.3.md`
4. `docs/JARVIS-V1-RELEASE-PROFILE.md`
5. `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
6. `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`
7. `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
8. `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
9. `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`
10. `docs/implementation/JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md`
11. `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`
12. `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`
13. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`
14. relevant ADRs only when rationale/history is needed.

The **v1.0.3 suite is the current normative implementation source**. ADRs do not form a second overlay that implementers must mentally merge.

## No ADR/history overlay

Historical contracts/ADRs may explain why a rule exists but SHALL NOT be required to determine current behavior.

If an implementer finds a still-valid rule only in history/ADR text, that is a contract defect. Stop at the ambiguity and update the current normative suite rather than implementing the historical text as a hidden override.

## Synchronous architecture-amendment rule

A material architecture/product/security/release change SHALL:

1. receive a new unique ADR;
2. update every affected active normative contract file in the same reviewed change;
3. update the current contract manifest;
4. update the Release Profile if support scope/capabilities change;
5. update verification and implementation sequencing where affected;
6. advance the contract-suite semantic version when the material meaning of the current contract changes;
7. only then be used by implementation.

Do not merge an ADR that knowingly leaves contradictory current contract wording behind. Do not modify the contract merely to excuse an implementation shortcut.

## Historical material

`docs/history/` is provenance only.

Former divergent `codex/contract-*` branches are deleted/non-authoritative. Do not recreate them as parallel long-lived architecture lines. Useful semantics from historical work are already incorporated into the current suite.

## Non-negotiable principles

- **AI decides. Software authorizes. Software verifies.**
- **Workers own the loop. JARVIS owns the graph. Verification decides done.**
- **Be autonomous inside the user's intent. Ask before materially expanding it.**
- **Escalate product judgment. Resolve engineering judgment.**
- **One system. One identity. Any screen.**
- Never bypass final destructive confirmation.
- Never treat AI confidence, provider capability, shell availability, setup-helper availability, or credential possession as authorization.
- Never silently weaken `LOCAL_ONLY`, sensitivity, PermissionEngine, budget, execution-scope, provider setup/sandbox, recovery, IPC, WebView, or module-integrity policy.
- Never place raw long-lived credentials, KDF-derived working keys, provider-internal sandbox credentials, or recovery factors in AI prompts, normal SQLite rows, config, logs, journals, ordinary artifacts, or ordinary backups.
- Never report consequential work complete without required postcondition/verification evidence.
- Never represent queued/paused/setup-required/repair-required/uncertain work as running/completed/ready.
- Never represent Windows Job Objects as a filesystem/network security sandbox.
- Never represent provider-native sandboxing as stronger than its qualified behavior.
- Never let provider setup/UAC elevation become normal worker elevation or a generic elevated command surface.
- Never claim GitHub or Proxmox support beyond the exact active Release Profile capability matrix.
- Never create a screen-specific visual language that bypasses canonical JARVIS design tokens, brand assets, component/state language, adaptive Mission Control hierarchy, or accessibility requirements.
- Never treat documentation/architecture completion as `Production Complete`.

## Repository boundaries

Follow `JARVIS-CODING-STANDARDS-CONTRACT.md` and `JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`.

Do not:

- put orchestration/authorization/business state in React;
- let UI/provider/tool/module code mutate authoritative Core state directly;
- leak provider-native types into mission/task/domain models;
- expose an unrestricted orchestrator shell;
- let delegated engineering workers perform external consequential side effects outside typed JARVIS tools/integrations;
- create detached/unowned child processes;
- invent state transitions outside owning services;
- bypass canonical target/action resolution or PermissionEngine;
- create an arbitrary raw Proxmox API/shell escape hatch;
- broaden mandatory GitHub capability operations into repository/admin/secrets/delete authority;
- redraw or recolor canonical JARVIS mark/lockup/app-icon independently per screen;
- hardcode parallel theme systems or raw visual constants where canonical design tokens exist;
- add a dependency or third-party visual/font asset without concrete need and license/provenance review.

## Engineering workflow

- Work on a temporary feature branch/worktree rather than directly on `master` unless explicitly instructed otherwise, but always create/refresh it from current live protected `master`.
- Re-fetch `master` and working-branch tip before repository writes when concurrent changes may exist.
- Preserve valid concurrent work.
- Keep commits scoped and reviewable.
- Contract/schema changes must include compatibility/migration implications.
- Security/state/recovery changes must include negative/failure/adversarial tests.
- KDF/auth/recovery changes must preserve the production floor, versioned metadata, and clean-profile restore path.
- Provider upgrades require setup/compatibility/conformance evidence before `SUPPORTED`.
- Tauri/WebView capability/CSP changes are security changes and require negative tests.
- Integration changes must state exact capability support and not rely on generic `connected` state.
- UI changes must use centralized tokens/components, preserve approved dark-theme JARVIS identity, and be exercised at applicable compact/wide/high-DPI/text-scale/reflow/High-Contrast conditions.
- Window show/hide/focus/fullscreen behavior is native application behavior and must preserve focus/privacy/NotificationPolicy rules rather than being triggered as an unrestricted renderer/AI side effect.
- Do not begin application implementation unless the user has explicitly moved the project into implementation work; contract hardening alone is not implementation authorization.

## Definition of done

A change is complete only after all applicable formatting, strict type/build checks, unit/property/schema tests, integration/security/recovery tests, provider-setup tests, UI/accessibility/adaptive-layout checks, and documentation pass.

Production readiness is defined only by `JARVIS-VERIFICATION-RELEASE-CONTRACT.md` plus every mandatory qualification requirement in the active normative suite for the active Release Profile and exact signed artifacts.
