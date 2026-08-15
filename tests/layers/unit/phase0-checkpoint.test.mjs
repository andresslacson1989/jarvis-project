import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePhase0Snapshot,
} from "../../../tools/checkpoints/phase0-checkpoint.mjs";
import profile from "../../../tools/checkpoints/phase0-checkpoint-profile.json" with {
  type: "json",
};

const childIds = [
  "0.1",
  "0.2",
  "0.3",
  "0.4",
  "0.5",
  "0.6",
  "0.7",
  "0.8",
  "0.9",
  "0.10",
  "0.11",
  "0.12",
  "0.13",
];

function workflowFromProfile() {
  const native = profile.requiredNativeWindowsGate;
  const gates = profile.requiredWorkflowSteps
    .map(
      ({ name, run }) =>
        `      - name: ${name}\n        run: ${run}\n`,
    )
    .join("\n");

  return `name: Static CI
on:
  push:
permissions:
  contents: read
jobs:
  ${native.jobId}:
    name: ${native.jobName}
    runs-on: ${native.runner}
    steps:
      - name: Checkout Windows candidate
        uses: actions/checkout@${"a".repeat(40)}
        with:
          persist-credentials: false
          fetch-depth: 1
      - name: Install pinned Windows pnpm and Node
        uses: pnpm/setup@${"b".repeat(40)}
        with:
          version: 11.21.0
          runtime: node@24.18.0
      - name: Install pinned Windows Rust toolchain
        run: ${native.rustToolchainCommand}
      - name: Install Windows dependencies without lifecycle scripts
        run: ${native.dependencyInstallCommand}
      - name: Build bundled local desktop frontend on Windows
        run: ${native.frontendBuildCommand}
      - name: Native Windows MSVC Tauri compile
        run: ${native.buildCommand}

  static-ci:
    name: static-ci
    needs: ${native.jobId}
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@${"a".repeat(40)}
        with:
          persist-credentials: false
          fetch-depth: 1

${gates}
      - name: Phase 0 section checkpoint
        run: pnpm phase0:check

      - name: Static CI evidence
        run: pnpm ci:evidence
`;
}

const packageJson = {
  scripts: {
    "phase0:check": "node tools/checkpoints/phase0-checkpoint.mjs",
  },
};

const canonicalValues = {
  contractSuiteVersion: "1.0.7",
  v1RuntimeTarget: {
    platform: "WINDOWS",
    runtimeRole: "FULL_HOST",
    architecture: "x64",
  },
};

const matrix =
  `| Contract suite | JARVIS v1.0.7 |\n` +
  childIds
    .map((id) => `| ↳ **${id}** x | **VERIFIED** |`)
    .join("\n") +
  "\n";

const allEvidencePaths = new Set(profile.requiredEvidencePaths);

function codes(overrides = {}) {
  return validatePhase0Snapshot({
    profile,
    workflow: workflowFromProfile(),
    packageJson,
    canonicalValues,
    matrix,
    linuxSourcePaths: [],
    androidSourcePaths: [],
    existingPaths: allEvidencePaths,
    ...overrides,
  }).map((item) => item.code);
}

test("0.CP aggregate Phase 0 checkpoint snapshot passes", () => {
  assert.deepEqual(codes(), []);
});

test("native Windows runner is required", () => {
  const workflow = workflowFromProfile().replace(
    `    runs-on: ${profile.requiredNativeWindowsGate.runner}`,
    "    runs-on: ubuntu-24.04",
  );
  assert.ok(codes({ workflow }).includes("PHASE0_WINDOWS_NATIVE_RUNNER"));
});

test("mandatory static-ci context must depend on native Windows gate", () => {
  const workflow = workflowFromProfile().replace(
    `    needs: ${profile.requiredNativeWindowsGate.jobId}\n`,
    "",
  );
  assert.ok(codes({ workflow }).includes("PHASE0_WINDOWS_NATIVE_NOT_REQUIRED"));
});

test("Linux llvm-rc workaround is rejected in favor of native Windows qualification", () => {
  const workflow = `${workflowFromProfile()}\nenv:\n  RC_x86_64_pc_windows_msvc: llvm-rc\n`;
  assert.ok(codes({ workflow }).includes("PHASE0_WINDOWS_CROSS_COMPILE_FALLBACK"));
});

test("missing mandatory Phase 0 gate fails closed", () => {
  const workflow = workflowFromProfile().replace(
    "      - name: Architecture enforcement\n        run: pnpm architecture:check\n",
    "",
  );
  assert.ok(codes({ workflow }).includes("PHASE0_REQUIRED_GATE_MISSING"));
});

test("conditional mandatory Phase 0 gate fails closed", () => {
  const workflow = workflowFromProfile().replace(
    "      - name: Contract and profile drift\n        run: pnpm contract:check-drift",
    "      - name: Contract and profile drift\n        if: false\n        run: pnpm contract:check-drift",
  );
  assert.ok(codes({ workflow }).includes("PHASE0_GATE_SKIPPABLE"));
});

test("Phase 0 checkpoint must precede evidence", () => {
  const checkpoint =
    "      - name: Phase 0 section checkpoint\n        run: pnpm phase0:check\n\n";
  const workflow = workflowFromProfile()
    .replace(checkpoint, "")
    .replace(
      "      - name: Static CI evidence\n        run: pnpm ci:evidence",
      `      - name: Static CI evidence\n        run: pnpm ci:evidence\n\n${checkpoint.trimEnd()}`,
    );
  assert.ok(codes({ workflow }).includes("PHASE0_EVIDENCE_ORDER"));
});

test("canonical V1 runtime target drift fails", () => {
  assert.ok(
    codes({
      canonicalValues: {
        ...canonicalValues,
        v1RuntimeTarget: {
          platform: "LINUX",
          runtimeRole: "FULL_HOST",
          architecture: "x64",
        },
      },
    }).includes("PHASE0_RUNTIME_TARGET"),
  );
});

test("unqualified Linux or Android runtime sources fail", () => {
  const result = codes({
    linuxSourcePaths: ["platform/linux/src/runtime.ts"],
    androidSourcePaths: ["platform/android/src/main.rs"],
  });
  assert.equal(
    result.filter((code) => code === "PHASE0_UNQUALIFIED_RUNTIME_SOURCE")
      .length,
    2,
  );
});

test("unverified child subsection fails checkpoint", () => {
  const mutated = matrix.replace(
    "| ↳ **0.13** x | **VERIFIED** |",
    "| ↳ **0.13** x | **IN PROGRESS** |",
  );
  assert.ok(
    codes({ matrix: mutated }).includes("PHASE0_CHILD_NOT_VERIFIED"),
  );
});

test("verified Section 0 summary permits completed child rows to be compacted later", () => {
  const compactMatrix =
    "| Contract suite | JARVIS v1.0.7 |\n" +
    "| **SECTION 0 — Repository / Platform Contracts / Toolchain / Governance** | **VERIFIED** | — |\n";
  assert.deepEqual(codes({ matrix: compactMatrix }), []);
});

test("live matrix suite drift fails checkpoint", () => {
  assert.ok(
    codes({
      matrix: matrix.replace("JARVIS v1.0.7", "JARVIS v1.0.5"),
    }).includes("PHASE0_MATRIX_SUITE_DRIFT"),
  );
});

test("missing child evidence fails checkpoint", () => {
  const existingPaths = new Set(allEvidencePaths);
  existingPaths.delete(profile.requiredEvidencePaths.at(-1));
  assert.ok(
    codes({ existingPaths }).includes("PHASE0_CHILD_EVIDENCE_MISSING"),
  );
});

test("superseded active top-level contract fails checkpoint", () => {
  const existingPaths = new Set([
    ...allEvidencePaths,
    "docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.5.md",
  ]);
  assert.ok(
    codes({ existingPaths }).includes(
      "PHASE0_SUPERSEDED_ACTIVE_CONTRACT",
    ),
  );
});

test("unsafe pull_request_target trigger fails checkpoint", () => {
  const workflow = workflowFromProfile().replace(
    "on:\n  push:",
    "on:\n  pull_request_target:\n  push:",
  );
  assert.ok(
    codes({ workflow }).includes("PHASE0_UNSAFE_WORKFLOW_TRIGGER"),
  );
});
