# Section 1.1 Production Tauri Qualification Repair Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use TDD, systematic debugging, code-review verification, and verification-before-completion. Execute each task against the live feature branch after revalidating `master` and the branch tip.

**Goal:** Prove Section 1.1’s production bundled-local Tauri/React boundary on the exact Windows candidate by replacing the misleading `cargo check` “Desktop Tauri Windows build” gate with a genuine Tauri release-mode build that consumes the real Vite `dist`, while preserving all existing Phase 0/static/security/governance gates and keeping installer/release and Section 1.2 scope out.

**Architecture:** Keep the existing two-job native-Windows CI topology. The `windows-tauri-build` prerequisite remains the native application qualification job, but its explicit desktop gate will execute the pinned Tauri CLI production build with bundling disabled. The desktop-foundation and Phase 0 validators will fail closed if that production gate is removed, weakened back to `cargo check`, made skippable, moved off native Windows, or disconnected from exact-candidate evidence.

**Tech stack:** Windows Server 2025 GitHub Actions runner; Node 24.18.0; pnpm 11.21.0; Rust 1.97.1; `x86_64-pc-windows-msvc`; Tauri 2.11.5; `tauri-build` 2.6.3; `@tauri-apps/cli` 2.11.4; React/Vite.

## Global constraints

- Normative contracts are read-only.
- V1 qualification target is `WINDOWS + FULL_HOST + x64`.
- Section 1.1 remains `IN PROGRESS` until complete exact-head evidence and fresh independent review pass.
- No Section 1.2 CSP/capability/navigation/devtools implementation.
- No installer/signing/updater/release-packaging work; `tauri build --no-bundle` is used specifically to exercise production application build semantics without bundling.
- No Linux runtime qualification or Linux WebKit/GTK prerequisites.
- No system Node assumption; toolchain pins and frozen lockfiles remain mandatory.
- Exact PR-head checkout and evidence binding remain mandatory.
- Existing Phase 0 gates must remain at least as strong as before.

---

### Task 1: Encode the review blocker as RED tests

**Files:**
- Modify: `tests/layers/unit/desktop-foundation.test.mjs`
- Modify: `tests/layers/unit/phase0-checkpoint.test.mjs`

**Required behavior:**
- Reject `cargo check --locked -p jarvis-desktop --target x86_64-pc-windows-msvc` as the explicit production Tauri qualification gate.
- Require an unconditional native-Windows step named `Desktop Tauri production build` running the pinned package-local CLI through pnpm: `pnpm --dir apps/desktop tauri build --no-bundle --target x86_64-pc-windows-msvc --ci`.
- Reject removal of `--no-bundle`, `--target x86_64-pc-windows-msvc`, or the Tauri CLI build verb.
- Preserve exact-head checkout and native Windows prerequisite assertions.

**RED proof:** The new tests must fail against the pre-fix workflow/checkers because the current workflow uses only `cargo check`.

### Task 2: Implement the genuine production Tauri gate

**Files:**
- Modify: `.github/workflows/static-ci.yml`
- Modify: `tools/ci/check-desktop-foundation.mjs`
- Modify: `tools/checkpoints/phase0-checkpoint.mjs`
- Modify: `tests/layers/unit/desktop-foundation.test.mjs`
- Modify: `tests/layers/unit/phase0-checkpoint.test.mjs`

**Implementation:**
- In `windows-tauri-build`, retain the workspace native MSVC `cargo check` as a separate compile gate.
- Replace the mislabeled desktop `cargo check` step with:
  `pnpm --dir apps/desktop tauri build --no-bundle --target x86_64-pc-windows-msvc --ci`
- Do not separately prebuild a synthetic `dist` in that job; allow Tauri CLI to run configured `beforeBuildCommand` (`pnpm build:web`) and consume configured `frontendDist` (`../dist`).
- Keep `bundle.active=false`; `--no-bundle` makes the CI intent explicit and prevents installer-generation scope.
- Update fail-closed validators to require the production Tauri command rather than the old `cargo check` string.
- Ensure Phase 0 aggregation still requires native Windows success and does not reinterpret this as Linux/cross-build qualification.

**GREEN proof:** Focused desktop-foundation and Phase 0 tests pass; desktop checker and Phase 0 checkpoint pass locally/CI.

### Task 3: Qualify the exact candidate on GitHub Actions

**Files:** no source changes during the run.

**Required evidence:**
- PR exact head SHA equals checked-out SHA.
- `windows-tauri-build` succeeds on `windows-2025`.
- Native workspace MSVC build succeeds.
- `Desktop Tauri production build` succeeds and is not skipped.
- `static-ci` succeeds on the same exact SHA.
- Desktop UI build, desktop foundation, architecture, deterministic tests, audit, Rust fmt/clippy/host build, Phase 0 checkpoint, and candidate-bound evidence all succeed.
- No required step is skipped/conditional.

### Task 4: Reconcile evidence and matrix truthfully

**Files:**
- Modify: `docs/implementation/evidence/1.1-tauri-react-desktop-foundation.md`
- Modify: `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`
- Modify PR #7 body if needed.

**Rules:**
- Record the exact qualifying SHA/run/job IDs.
- Replace any historical claim that `cargo check` was an explicit Tauri production build.
- Keep Section 1 and 1.1 `IN PROGRESS` pending final independent review/integration.
- Do not change historical Phase 0 rows.
- Do not mark 1.1 `VERIFIED` before review and controlled integration.

### Task 5: Fresh unbiased contract audit before declaring fixed

Re-fetch live `master`, feature head, PR #7, exact CI, `AGENTS.md`, and governing Section 1.1 contract documents. Re-read the actual changed files and complete PR diff.

Evaluate from scratch:
- production bundled-local asset consumption;
- native Windows qualification;
- pinned dependency/toolchain consistency;
- exact candidate evidence binding;
- fail-closed test quality;
- security/authority scope boundaries;
- Linux portability without Linux runtime qualification;
- Phase 0 preservation;
- absence of Section 1.2+ leakage;
- evidence/matrix truthfulness.

**Completion threshold:**
- Contract Accuracy = **10/10 exactly**.
- Production readiness/practices/enterprise hardening >= 8/10.
- Atomicity/idempotency >= 8/10 where applicable.
- Exact-head Windows CI = success.
- No blocking review finding remains.

If any condition fails, Section 1.1 remains `IN PROGRESS` and the observed defect is repaired before another completion decision.
