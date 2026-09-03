import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  checkPhase0,
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
  const gates = profile.requiredWorkflowSteps
    .filter(({ name }) => name !== "Rust Windows-target build")
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
      - name: Desktop Tauri production build
        working-directory: apps/desktop
        run: pnpm tauri build --no-bundle --target x86_64-pc-windows-msvc --ci
  static-ci:
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

test("missing mandatory Phase 0 gate fails closed", () => {
  const workflow = workflowFromProfile().replace(
    "      - name: Architecture enforcement\n        run: pnpm architecture:check\n",
    "",
  );
  assert.ok(codes({ workflow }).includes("PHASE0_REQUIRED_GATE_MISSING"));
});

test("independent Core and UI build gates are mandatory", () => {
  for (const gate of ["Core build", "Desktop UI build"]) {
    const workflow = workflowFromProfile().replace(
      `      - name: ${gate}\n        run: ${gate === "Core build" ? "pnpm build:core" : "pnpm build:ui"}\n\n`,
      "",
    );
    assert.ok(codes({ workflow }).includes("PHASE0_REQUIRED_GATE_MISSING"), gate);
  }
});

test("native Windows Tauri topology fails closed", () => {
  const cases = [
    ["windows job", (workflow) => workflow.replace("  windows-tauri-build:", "  removed-windows-job:")],
    ["static dependency", (workflow) => workflow.replace("    needs: windows-tauri-build\n", "")],
    ["Windows target", (workflow) => workflow.replaceAll("x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc")],
    ["production Tauri command", (workflow) => workflow.replace("pnpm tauri build --no-bundle --target x86_64-pc-windows-msvc --ci", "cargo check --locked -p jarvis-desktop --target x86_64-pc-windows-msvc")],
    ["production Tauri working directory", (workflow) => workflow.replace("        working-directory: apps/desktop\n", "")],
    ["synthetic checkout", (workflow) => workflow.replace("github.event.pull_request.head.sha", "github.sha")],
    ["duplicate Windows cross-build", (workflow) => workflow.replace("      - name: Verify native Windows Tauri prerequisite", "      - name: Rust Windows-target build\n        run: cargo check --locked --workspace --target x86_64-pc-windows-msvc\n\n      - name: Verify native Windows Tauri prerequisite")],
  ];
  for (const [label, mutate] of cases) {
    assert.ok(codes({ workflow: mutate(workflowFromProfile()) }).some((code) => code.startsWith("PHASE0_")), label);
  }
});

test("conditional native production Tauri gate fails closed", () => {
  const workflow = workflowFromProfile().replace(
    "      - name: Desktop Tauri production build\n        working-directory: apps/desktop",
    "      - name: Desktop Tauri production build\n        if: false\n        working-directory: apps/desktop",
  );
  assert.ok(codes({ workflow }).includes("PHASE0_NATIVE_WINDOWS_GATE_MISSING"));
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
      "      - name: Static CI evidence\n        env:\n          JARVIS_WINDOWS_TAURI_GATES_PASSED: '1'\n        run: pnpm ci:evidence",
      `      - name: Static CI evidence\n        env:\n          JARVIS_WINDOWS_TAURI_GATES_PASSED: '1'\n        run: pnpm ci:evidence\n\n${checkpoint.trimEnd()}`,
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

test("current checkpoint evidence cannot remain VERIFIED while LocalCI is VERIFYING", () => {
  const matrixWithSection =
    `| Contract suite | JARVIS v1.0.7 |\n| **SECTION 0 — Repository / Platform Contracts / Toolchain / Governance** | **VERIFYING** |\n` +
    childIds.map((id) => `| ↳ **${id}** x | **VERIFIED** |`).join("\n");
  const result = codes({
    matrix: matrixWithSection,
    currentEvidenceStatus: "VERIFIED",
    governanceQualificationStatus: "VERIFYING",
  });
  assert.ok(result.includes("PHASE0_CURRENT_EVIDENCE_STALE"));
});

test("stale Phase-0 candidate evidence fails closed", () => {
  assert.ok(codes({
    currentCandidateSha: "b".repeat(40),
    evidenceCandidateSha: "a".repeat(40),
    matrixCandidateSha: "a".repeat(40),
  }).includes("PHASE0_CANDIDATE_MISMATCH"));
});

test("checked-in Phase-0 records are coherent without self-referential HEAD binding", async () => {
  assert.deepEqual(await checkPhase0(process.cwd()), []);
});

test("the real evidence revision passes implicit mode and explicit current-checkout mode", async () => {
  const previous = process.env.JARVIS_CANDIDATE_SHA;
  try {
    delete process.env.JARVIS_CANDIDATE_SHA;
    assert.deepEqual(await checkPhase0(process.cwd()), []);
    process.env.JARVIS_CANDIDATE_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    assert.deepEqual(await checkPhase0(process.cwd()), []);
  } finally {
    if (previous === undefined) delete process.env.JARVIS_CANDIDATE_SHA;
    else process.env.JARVIS_CANDIDATE_SHA = previous;
  }
});

test("candidate mode does not accept an evidence revision as the exact implementation checkout", async () => {
  const previous = process.env.JARVIS_CANDIDATE_SHA;
  try {
    process.env.JARVIS_CANDIDATE_SHA = "6c72d9f9861ff858e34754d4bddcb749c6950598";
    const result = await checkPhase0(process.cwd());
    assert.ok(result.some(({ code }) => code === "PHASE0_CANDIDATE_MISMATCH"));
  } finally {
    if (previous === undefined) delete process.env.JARVIS_CANDIDATE_SHA;
    else process.env.JARVIS_CANDIDATE_SHA = previous;
  }
});

test("LocalCI exports the explicit candidate before the Phase-0 gate", () => {
  const script = readFileSync(".localci/ci.sh", "utf8");
  assert.ok(script.indexOf("export JARVIS_CANDIDATE_SHA=") < script.indexOf("run_gate phase0-section-checkpoint"));
});

test("candidate CI requires the checked-out SHA to equal the explicit candidate", () => {
  assert.ok(codes({
    currentCandidateSha: "a".repeat(40),
    evidenceCandidateSha: "a".repeat(40),
    matrixCandidateSha: "a".repeat(40),
    checkedOutSha: "b".repeat(40),
    explicitCandidateSha: "a".repeat(40),
  }).includes("PHASE0_CANDIDATE_MISMATCH"));
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
