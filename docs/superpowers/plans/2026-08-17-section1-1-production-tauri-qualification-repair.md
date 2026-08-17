# Section 1.1 Production Tauri Qualification Repair Plan

> **For agentic workers:** use TDD, systematic debugging, code-review verification, and verification-before-completion. Revalidate `master` and the feature tip before writes.

**Goal:** Prove Section 1.1’s production bundled-local Tauri/React boundary on the exact Windows source candidate using a genuine release-mode Tauri application build, while preserving every inherited Phase 0/static/security/governance gate and keeping installer/release and Section 1.2 work out of scope.

**Authoritative production command:** from `apps/desktop`:

```text
pnpm tauri build --no-bundle --target x86_64-pc-windows-msvc --ci
```

The workflow uses the package-local pinned CLI through the exact desktop script `"tauri": "tauri"`. The checker must fail closed if that script is substituted. Do not replace the proven working-directory form with a different command spelling unless the workflow, checker, tests, and fresh qualification are deliberately updated together.

## Required semantics

- V1 qualification target is `WINDOWS + FULL_HOST + x64` on `windows-2025`.
- Keep native workspace `cargo check --locked --workspace --target x86_64-pc-windows-msvc` as a separate compile gate.
- Never represent Cargo check as the production Tauri proof.
- Tauri must invoke configured `beforeBuildCommand: pnpm build:web`, Vite must produce local `dist`, `frontendDist` must be `../dist`, and the optimized release application must emit `jarvis-desktop.exe`.
- `--no-bundle` avoids installer/signing/updater scope while still exercising production application semantics.
- Normative contracts remain read-only.
- Linux runtime qualification and WebKitGTK/GTK prerequisites remain outside V1.
- Exact PR-head checkout, candidate binding, Phase 0 gates, and compensating governance controls remain mandatory.

## Review-defect regression coverage

The deterministic suite must directly cover all of these:

1. Replace the production Tauri command with Cargo check → fail.
2. Remove production build flags/target/working directory or make the gate conditional → fail.
3. Redirect `apps/desktop`'s `tauri` package script to a successful no-op → `DESKTOP_TAURI_CLI_SCRIPT_DRIFT`.
4. Move `windows-tauri-build.runs-on` from `windows-2025` to `ubuntu-24.04` → `PHASE0_NATIVE_WINDOWS_JOB_MISSING`.
5. Keep the separate downstream `static-ci` Windows-runner regression; it is not a substitute for item 4.
6. Reintroduce Linux Tauri host prerequisites → fail.
7. Break exact-head checkout/evidence aggregation or use synthetic PR merge SHA as candidate → fail.

A missing focused mutation test is a verification defect even when the production checker already implements the invariant.

## Evidence lifecycle correction

The functional implementation proof and evidence-bearing review head are distinct when documentation/tests change after a functional run.

- Functional proof currently recorded by the evidence document: `2c5ed5017ec867afbcfaaa49eef1403ed2aa4c04`, run `32021889928`, native job `95363120563`, static job `95366512263`.
- Checked-in evidence must describe the real Tauri path and explicitly distinguish the Phase 0 aggregate payload from Section 1.1’s native production-Tauri job/log evidence.
- The later repository head containing reconciled evidence and additional regression coverage must receive its own exact-head Windows CI.
- Do not claim the reconciled evidence existed at the earlier functional SHA.
- After the later head’s CI completes, record that exact head/run/job identity in PR #7 metadata. Updating PR metadata does not mutate the source candidate.
- Keep Section 1 and 1.1 `IN PROGRESS` throughout review correction.

## Exact-head qualification requirements

For the evidence-bearing review candidate require, on one literal SHA:

- `windows-tauri-build` on `windows-2025` — success;
- native workspace MSVC compile — success;
- `Desktop Tauri production build` — success and not skipped;
- completed log proves `beforeBuildCommand → Vite production dist → optimized Tauri release → jarvis-desktop.exe`;
- downstream `static-ci` depends on the native result and succeeds;
- exact toolchain, format, schema, generated contract, manifest/drift, governance, secrets, dependency/provenance, TypeScript/Core/UI, desktop foundation, architecture, deterministic tests, audit, Rust fmt/clippy/host build, Phase 0 checkpoint, and candidate-bound evidence all succeed;
- the focused native-runner Ubuntu mutation executes and passes in the deterministic suite.

No source/evidence file changes occur during this run.

## Fresh unbiased audit before a fixed decision

After exact-head CI succeeds, re-fetch live `master`, feature head, PR #7, `AGENTS.md`, active manifest/contracts, complete PR diff, current application/CI/checker/test/dependency/evidence surface, and exact CI logs. Evaluate from scratch:

- production bundled-local asset consumption;
- native Windows qualification;
- exact dependency/toolchain pins;
- candidate/evidence lifecycle truthfulness;
- fail-closed/adversarial test precision;
- renderer/native authority boundaries;
- Linux portability without false Linux runtime qualification;
- Phase 0 preservation;
- absence of 1.2+ leakage.

**Repository-side blocker closure threshold:**
- Contract Accuracy = **10/10 exactly** from the fresh audit;
- production readiness/practices/enterprise hardening >= 8/10;
- test/verification quality >= 8/10;
- maintainability/architecture >= 8/10;
- atomicity/idempotency >= 8/10 where applicable;
- exact-head CI success;
- no known repository-side blocking defect from the independent review remains.

Passing this threshold means the candidate is ready for **renewed independent review**; it does not by itself mark subsection 1.1 `VERIFIED`.

## Integration boundary

Only after renewed independent review passes: immediately revalidate live `master`, reconcile movement, integrate non-force, verify resulting authoritative tip/diff and post-integration CI, then update matrix status in a controlled manner. Do not begin 1.2 before 1.1 is actually closed.
