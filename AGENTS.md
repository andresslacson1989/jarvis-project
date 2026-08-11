# JARVIS Repository Engineering Instructions

These instructions apply to all human and AI contributors.

## Source of truth

Before implementation or architecture work, read:

1. `README.md`
2. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`
3. `docs/JARVIS-V1-RELEASE-PROFILE.md`
4. `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
5. `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`
6. `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
7. `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
8. `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`
9. `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`
10. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`
11. relevant ADRs only when rationale/history is needed.

The v1.0.2 suite is the current normative implementation source. ADRs do not form a second overlay that implementers must mentally merge.

## Synchronous architecture-amendment rule

A material architecture change SHALL be recorded by a new unique ADR and SHALL update every affected active normative contract file in the same reviewed change before implementation depends on it.

Do not merge an ADR that knowingly leaves contradictory current contract wording behind. Do not modify the contract merely to excuse an implementation shortcut.

## Historical material

`docs/history/` is provenance only.

The old divergent `codex/contract-implementation-lock` branch is non-authoritative. Do not import its duplicate ADR-054/055/056 identifiers. Useful semantics from that branch have already been reconciled into v1.0.2.

## Non-negotiable principles

- **AI decides. Software authorizes. Software verifies.**
- **Workers own the loop. JARVIS owns the graph. Verification decides done.**
- Never bypass final destructive confirmation.
- Never treat AI confidence, provider capability, shell availability, or credential possession as authorization.
- Never silently weaken `LOCAL_ONLY`, sensitivity, PermissionEngine, budget, execution-scope, provider, recovery, IPC, WebView, or module-integrity policy.
- Never place raw long-lived credentials in AI prompts, normal SQLite rows, config, logs, journals, ordinary artifacts, or ordinary backups.
- Never report consequential work complete without required postcondition/verification evidence.
- Never represent Windows Job Objects as a filesystem/network security sandbox.
- Never represent provider-native sandboxing as stronger than its qualified behavior.
- Never treat documentation/architecture completion as `Production Complete`.

## Repository boundaries

Follow `JARVIS-CODING-STANDARDS-CONTRACT.md`.

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
- add a dependency without a concrete need.

## Engineering workflow

- Work on a feature branch/worktree rather than directly on `master` unless explicitly instructed otherwise.
- Re-fetch the live branch tip before repository writes when concurrent changes may exist.
- Preserve valid concurrent work.
- Keep commits scoped and reviewable.
- Contract/schema changes must include compatibility/migration implications.
- Security/state/recovery changes must include negative/failure/adversarial tests.
- Persistence/encryption/recovery changes must preserve the qualified clean-profile portable-restore path.
- Provider upgrades require compatibility/conformance evidence before `SUPPORTED`.
- Tauri/WebView capability/CSP changes are security changes and require negative tests.

## Definition of done

A change is complete only after all applicable formatting, strict type/build checks, unit/property/schema tests, integration/security/recovery tests, and documentation pass.

Production readiness is defined only by `JARVIS-VERIFICATION-RELEASE-CONTRACT.md` for the active Release Profile and exact signed artifacts.
