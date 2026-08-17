import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  evaluateDesktopFoundation,
  loadDesktopFoundationSnapshot,
} from "../../../tools/ci/check-desktop-foundation.mjs";
import { validatePhase0Snapshot } from "../../../tools/checkpoints/phase0-checkpoint.mjs";
import profile from "../../../tools/checkpoints/phase0-checkpoint-profile.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

const PRODUCTION_STEP = `      - name: Desktop Tauri production build\n        shell: pwsh\n        working-directory: apps/desktop\n        run: pnpm tauri build --no-bundle --target x86_64-pc-windows-msvc --ci\n`;
const OLD_CHECK_STEP = `      - name: Desktop Tauri Windows build\n        shell: pwsh\n        run: cargo check --locked -p jarvis-desktop --target x86_64-pc-windows-msvc\n`;

function desktopCodes(snapshot) {
  return evaluateDesktopFoundation(snapshot).map((item) => item.code);
}

test("Section 1.1 requires a real production Tauri build rather than cargo check", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const productionWorkflow = snapshot.workflow.replace(OLD_CHECK_STEP, PRODUCTION_STEP);
  const valid = { ...snapshot, workflow: productionWorkflow };
  assert.deepEqual(evaluateDesktopFoundation(valid), []);

  const cargoCheckOnly = { ...valid, workflow: productionWorkflow.replace(PRODUCTION_STEP, OLD_CHECK_STEP) };
  assert.ok(desktopCodes(cargoCheckOnly).includes("DESKTOP_TAURI_PRODUCTION_BUILD_CI_GATE_MISSING"));

  for (const [label, workflow] of [
    ["no-bundle", productionWorkflow.replace(" --no-bundle", "")],
    ["target", productionWorkflow.replace(" --target x86_64-pc-windows-msvc", "")],
    ["ci", productionWorkflow.replace(" --ci", "")],
    ["working directory", productionWorkflow.replace("        working-directory: apps/desktop\n", "")],
  ]) {
    assert.ok(
      desktopCodes({ ...snapshot, workflow }).includes("DESKTOP_TAURI_PRODUCTION_BUILD_CI_GATE_MISSING"),
      label,
    );
  }
});

function phase0Workflow(productionStep = PRODUCTION_STEP) {
  const gates = profile.requiredWorkflowSteps
    .filter(({ name }) => name !== "Rust Windows-target build")
    .map(({ name, run }) => `      - name: ${name}\n        run: ${run}\n`)
    .join("\n");

  return `name: Static CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  windows-tauri-build:
    name: windows-tauri-build
    runs-on: windows-2025
    steps:
      - name: Checkout
        uses: actions/checkout@${"a".repeat(40)}
        with:
          persist-credentials: false
          fetch-depth: 1
          ref: \${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
      - name: Verify exact checkout
        env:
          EXPECTED_SHA: candidate
        run: git rev-parse HEAD
      - name: Rust Windows-target build
        run: cargo check --locked --workspace --target x86_64-pc-windows-msvc
${productionStep}  static-ci:
    name: static-ci
    needs: windows-tauri-build
    runs-on: windows-2025
    steps:
      - name: Checkout
        uses: actions/checkout@${"a".repeat(40)}
        with:
          persist-credentials: false
          fetch-depth: 1
${gates}
      - name: Verify native Windows Tauri prerequisite
        run: verify native Windows prerequisite
      - name: Phase 0 section checkpoint
        run: pnpm phase0:check
      - name: Static CI evidence
        env:
          JARVIS_WINDOWS_TAURI_GATES_PASSED: '1'
        run: pnpm ci:evidence
`;
}

function phase0Codes(workflow) {
  return validatePhase0Snapshot({
    profile,
    workflow,
    packageJson: { scripts: { "phase0:check": "node tools/checkpoints/phase0-checkpoint.mjs" } },
    canonicalValues: {
      contractSuiteVersion: "1.0.6",
      v1RuntimeTarget: { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64" },
    },
    matrix: "| Contract suite | JARVIS v1.0.6 |\n| **SECTION 0 — Repository / Platform Contracts / Toolchain / Governance** | **VERIFIED** | — |\n",
    linuxSourcePaths: [],
    androidSourcePaths: [],
    existingPaths: new Set(profile.requiredEvidencePaths),
  }).map((item) => item.code);
}

test("Phase 0 aggregation requires the native production Tauri gate", () => {
  assert.ok(!phase0Codes(phase0Workflow()).includes("PHASE0_NATIVE_WINDOWS_GATE_MISSING"));
  assert.ok(
    phase0Codes(phase0Workflow(OLD_CHECK_STEP)).includes("PHASE0_NATIVE_WINDOWS_GATE_MISSING"),
  );
});
