import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".rs"]);
const REQUIRED_CHILDREN = Object.freeze([
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
]);

function violation(code, path, detail) {
  return Object.freeze({ code, path, detail });
}

export function parseWorkflowSteps(text) {
  const steps = [];
  let current = null;

  for (const line of String(text).split(/\r?\n/)) {
    const start = line.match(/^\s*-\s+name:\s*(.+?)\s*$/);
    if (start) {
      current = Object.seal({
        name: start[1],
        run: null,
        if: null,
        continueOnError: null,
      });
      steps.push(current);
      continue;
    }
    if (!current) continue;

    const run = line.match(/^\s+run:\s*(.+?)\s*$/);
    if (run) current.run = run[1];

    const condition = line.match(/^\s+if:\s*(.+?)\s*$/);
    if (condition) current.if = condition[1];

    const continueOnError = line.match(/^\s+continue-on-error:\s*(.+?)\s*$/);
    if (continueOnError) current.continueOnError = continueOnError[1];
  }

  return steps;
}

function workflowJobBlock(text, jobId) {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function validateNativeWindowsGate(profile, workflowText) {
  const violations = [];
  const gate = profile?.requiredNativeWindowsGate;
  const path = ".github/workflows/static-ci.yml";
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) {
    return [violation("PHASE0_WINDOWS_NATIVE_PROFILE", "tools/checkpoints/phase0-checkpoint-profile.json", "requiredNativeWindowsGate is required")];
  }

  const windowsJob = workflowJobBlock(workflowText, gate.jobId);
  if (windowsJob === null) {
    violations.push(violation("PHASE0_WINDOWS_NATIVE_JOB_MISSING", path, `missing ${gate.jobId} job`));
  } else {
    if (!windowsJob.includes(`\n    name: ${gate.jobName}`)) {
      violations.push(violation("PHASE0_WINDOWS_NATIVE_JOB_NAME", path, `native Windows job name must be ${gate.jobName}`));
    }
    if (!windowsJob.includes(`\n    runs-on: ${gate.runner}`)) {
      violations.push(violation("PHASE0_WINDOWS_NATIVE_RUNNER", path, `native Windows job must run on ${gate.runner}`));
    }
    if (/^    (?:if|continue-on-error):/m.test(windowsJob) || /^\s+continue-on-error:/m.test(windowsJob) || /^\s+if:/m.test(windowsJob)) {
      violations.push(violation("PHASE0_WINDOWS_NATIVE_SKIPPABLE", path, "native Windows job and its steps may not use if/continue-on-error"));
    }
    if (!/uses:\s*actions\/checkout@[0-9a-f]{40}/.test(windowsJob) || !/persist-credentials:\s*false/.test(windowsJob) || !/fetch-depth:\s*1/.test(windowsJob)) {
      violations.push(violation("PHASE0_WINDOWS_NATIVE_CHECKOUT", path, "native Windows job must use immutable shallow credential-free checkout"));
    }
    if (!/uses:\s*pnpm\/setup@[0-9a-f]{40}/.test(windowsJob) || !/version:\s*11\.21\.0/.test(windowsJob) || !/runtime:\s*node@24\.18\.0/.test(windowsJob)) {
      violations.push(violation("PHASE0_WINDOWS_NATIVE_NODE_TOOLCHAIN", path, "native Windows job must use pinned pnpm 11.21.0 and Node 24.18.0"));
    }
    for (const [code, command] of [
      ["PHASE0_WINDOWS_NATIVE_RUST_TOOLCHAIN", gate.rustToolchainCommand],
      ["PHASE0_WINDOWS_NATIVE_DEPENDENCIES", gate.dependencyInstallCommand],
      ["PHASE0_WINDOWS_NATIVE_FRONTEND_BUILD", gate.frontendBuildCommand],
      ["PHASE0_WINDOWS_NATIVE_BUILD", gate.buildCommand],
    ]) {
      if (!windowsJob.includes(command)) violations.push(violation(code, path, `native Windows job must run ${command}`));
    }
  }

  const staticJob = workflowJobBlock(workflowText, gate.prerequisiteFor);
  if (staticJob === null || !staticJob.includes(`\n    needs: ${gate.jobId}`)) {
    violations.push(violation("PHASE0_WINDOWS_NATIVE_NOT_REQUIRED", path, `${gate.prerequisiteFor} must depend on ${gate.jobId}`));
  }

  if (/\bllvm-rc\b|RC_x86_64_pc_windows_msvc|apt(?:-get)?\s+install[^\n]*llvm/i.test(workflowText)) {
    violations.push(violation("PHASE0_WINDOWS_CROSS_COMPILE_FALLBACK", path, "MSVC Tauri qualification must use native Windows CI rather than an ambient Linux llvm-rc fallback"));
  }

  return violations;
}

function matrixRowStatus(matrix, id) {
  const escaped = id.replace(".", "\\.");
  const match = String(matrix).match(
    new RegExp(`^\\| ↳ \\*\\*${escaped}\\*\\*[^\\n]*\\| \\*\\*([^*]+)\\*\\* \\|`, "m"),
  );
  return match?.[1] ?? null;
}

function section0Status(matrix) {
  const match = String(matrix).match(
    /^\| \*\*SECTION 0 — Repository \/ Platform Contracts \/ Toolchain \/ Governance\*\* \| \*\*([^*]+)\*\* \|/m,
  );
  return match?.[1] ?? null;
}

export function validatePhase0Snapshot({
  profile,
  workflow,
  packageJson,
  canonicalValues,
  matrix,
  linuxSourcePaths = [],
  androidSourcePaths = [],
  existingPaths = new Set(),
}) {
  const violations = [];

  if (profile?.schemaVersion !== 1 || profile?.checkpointId !== "0.CP") {
    return [
      violation(
        "PHASE0_PROFILE_INVALID",
        "tools/checkpoints/phase0-checkpoint-profile.json",
        "schemaVersion=1 and checkpointId=0.CP are required",
      ),
    ];
  }

  if (profile.contractSuiteVersion !== "1.0.7") {
    violations.push(
      violation(
        "PHASE0_CONTRACT_SUITE",
        "tools/checkpoints/phase0-checkpoint-profile.json",
        "contractSuiteVersion must be 1.0.7",
      ),
    );
  }

  if (
    profile.checkpointName !==
    "Repository Governance + Platform Boundary + Contract-Drift Protection Ready"
  ) {
    violations.push(
      violation(
        "PHASE0_CHECKPOINT_NAME",
        "tools/checkpoints/phase0-checkpoint-profile.json",
        "checkpoint name must match Implementation Plan §26",
      ),
    );
  }

  const workflowText = String(workflow);
  if (/\bpull_request_target\s*:/.test(workflowText)) {
    violations.push(
      violation(
        "PHASE0_UNSAFE_WORKFLOW_TRIGGER",
        ".github/workflows/static-ci.yml",
        "pull_request_target is forbidden",
      ),
    );
  }

  if (!/permissions:\s*\n\s*contents:\s*read/.test(workflowText)) {
    violations.push(
      violation(
        "PHASE0_WORKFLOW_PERMISSIONS",
        ".github/workflows/static-ci.yml",
        "workflow must use contents: read",
      ),
    );
  }

  if (
    !/uses:\s*actions\/checkout@[0-9a-f]{40}/.test(workflowText) ||
    !/persist-credentials:\s*false/.test(workflowText) ||
    !/fetch-depth:\s*1/.test(workflowText)
  ) {
    violations.push(
      violation(
        "PHASE0_CLEAN_CHECKOUT",
        ".github/workflows/static-ci.yml",
        "checkout must be immutable, shallow, and credential-free",
      ),
    );
  }

  violations.push(...validateNativeWindowsGate(profile, workflowText));

  const steps = parseWorkflowSteps(workflowText);
  let lastIndex = -1;

  for (const required of profile.requiredWorkflowSteps ?? []) {
    const index = steps.findIndex((step) => step.name === required.name);
    if (index < 0) {
      violations.push(
        violation(
          "PHASE0_REQUIRED_GATE_MISSING",
          ".github/workflows/static-ci.yml",
          `missing ${required.name}`,
        ),
      );
      continue;
    }

    const step = steps[index];
    if (index <= lastIndex) {
      violations.push(
        violation(
          "PHASE0_GATE_ORDER",
          ".github/workflows/static-ci.yml",
          `${required.name} is out of required order`,
        ),
      );
    }
    lastIndex = index;

    if (step.run !== required.run) {
      violations.push(
        violation(
          "PHASE0_GATE_COMMAND_DRIFT",
          ".github/workflows/static-ci.yml",
          `${required.name} must run ${required.run}`,
        ),
      );
    }

    if (step.if !== null || step.continueOnError !== null) {
      violations.push(
        violation(
          "PHASE0_GATE_SKIPPABLE",
          ".github/workflows/static-ci.yml",
          `${required.name} may not use if/continue-on-error`,
        ),
      );
    }
  }

  const checkpointIndex = steps.findIndex(
    (step) => step.name === "Phase 0 section checkpoint",
  );
  const evidenceIndex = steps.findIndex((step) => step.name === "Static CI evidence");

  if (
    checkpointIndex < 0 ||
    steps[checkpointIndex]?.run !== "pnpm phase0:check" ||
    steps[checkpointIndex]?.if !== null ||
    steps[checkpointIndex]?.continueOnError !== null
  ) {
    violations.push(
      violation(
        "PHASE0_CHECKPOINT_STEP_MISSING",
        ".github/workflows/static-ci.yml",
        "unconditional Phase 0 section checkpoint must run pnpm phase0:check",
      ),
    );
  }

  if (
    evidenceIndex < 0 ||
    steps[evidenceIndex]?.run !== "pnpm ci:evidence" ||
    steps[evidenceIndex]?.if !== null ||
    steps[evidenceIndex]?.continueOnError !== null
  ) {
    violations.push(
      violation(
        "PHASE0_EVIDENCE_STEP_INVALID",
        ".github/workflows/static-ci.yml",
        "unconditional Static CI evidence step must run pnpm ci:evidence",
      ),
    );
  }

  if (
    checkpointIndex >= 0 &&
    evidenceIndex >= 0 &&
    checkpointIndex >= evidenceIndex
  ) {
    violations.push(
      violation(
        "PHASE0_EVIDENCE_ORDER",
        ".github/workflows/static-ci.yml",
        "checkpoint must pass before static CI evidence",
      ),
    );
  }

  if (
    packageJson?.scripts?.["phase0:check"] !==
    "node tools/checkpoints/phase0-checkpoint.mjs"
  ) {
    violations.push(
      violation(
        "PHASE0_SCRIPT_MISSING",
        "package.json",
        "phase0:check must invoke the canonical checkpoint checker",
      ),
    );
  }

  const target = canonicalValues?.v1RuntimeTarget ?? {};
  if (
    canonicalValues?.contractSuiteVersion !== "1.0.7" ||
    target.platform !== "WINDOWS" ||
    target.runtimeRole !== "FULL_HOST" ||
    target.architecture !== "x64"
  ) {
    violations.push(
      violation(
        "PHASE0_RUNTIME_TARGET",
        "packages/schemas/src/canonical/v1/jarvis-v1.0.6.contract-values.json",
        "V1 target must be JARVIS 1.0.7 WINDOWS/FULL_HOST/x64",
      ),
    );
  }

  for (const path of [...linuxSourcePaths, ...androidSourcePaths].sort()) {
    violations.push(
      violation(
        "PHASE0_UNQUALIFIED_RUNTIME_SOURCE",
        path,
        "Linux/Android executable runtime source is outside the Windows V1 support claim",
      ),
    );
  }

  if (!String(matrix).includes("| Contract suite | JARVIS v1.0.8 |")) {
    violations.push(
      violation(
        "PHASE0_MATRIX_SUITE_DRIFT",
        "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md",
        "live matrix must identify JARVIS v1.0.8",
      ),
    );
  }

  if (section0Status(matrix) !== "VERIFIED") {
    for (const id of REQUIRED_CHILDREN) {
      if (matrixRowStatus(matrix, id) !== "VERIFIED") {
        violations.push(
          violation(
            "PHASE0_CHILD_NOT_VERIFIED",
            "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md",
            `${id} must be VERIFIED before 0.CP while Section 0 is not yet closed`,
          ),
        );
      }
    }
  }

  for (const path of profile.requiredEvidencePaths ?? []) {
    if (!existingPaths.has(path)) {
      violations.push(
        violation(
          "PHASE0_CHILD_EVIDENCE_MISSING",
          path,
          "required verified child evidence is missing",
        ),
      );
    }
  }

  for (const path of profile.forbiddenActivePaths ?? []) {
    if (existingPaths.has(path)) {
      violations.push(
        violation(
          "PHASE0_SUPERSEDED_ACTIVE_CONTRACT",
          path,
          "superseded top-level contract/manifest must not remain active",
        ),
      );
    }
  }

  return violations.sort((a, b) =>
    `${a.code}:${a.path}:${a.detail}`.localeCompare(
      `${b.code}:${b.path}:${b.detail}`,
      "en",
    ),
  );
}

async function collectRuntimeSources(rootDir, relativeRoot) {
  const base = resolve(rootDir, relativeRoot);
  if (!existsSync(base)) return [];

  const result = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
        result.push(relative(rootDir, absolute).split(sep).join("/"));
      }
    }
  }

  await walk(base);
  return result.sort((a, b) => a.localeCompare(b, "en"));
}

export async function checkPhase0(rootDir) {
  const profilePath = resolve(
    rootDir,
    "tools/checkpoints/phase0-checkpoint-profile.json",
  );
  const profile = JSON.parse(await readFile(profilePath, "utf8"));

  const [workflow, packageJson, canonicalValues, matrix, linuxSourcePaths, androidSourcePaths] =
    await Promise.all([
      readFile(resolve(rootDir, ".github/workflows/static-ci.yml"), "utf8"),
      readFile(resolve(rootDir, "package.json"), "utf8").then(JSON.parse),
      readFile(
        resolve(
          rootDir,
          "packages/schemas/src/canonical/v1/jarvis-v1.0.6.contract-values.json",
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(
        resolve(rootDir, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md"),
        "utf8",
      ),
      collectRuntimeSources(rootDir, "platform/linux"),
      collectRuntimeSources(rootDir, "platform/android"),
    ]);

  const relevantPaths = new Set([
    ...(profile.requiredEvidencePaths ?? []),
    ...(profile.forbiddenActivePaths ?? []),
  ]);
  const existingPaths = new Set(
    [...relevantPaths].filter((path) => existsSync(resolve(rootDir, path))),
  );

  return validatePhase0Snapshot({
    profile,
    workflow,
    packageJson,
    canonicalValues,
    matrix,
    linuxSourcePaths,
    androidSourcePaths,
    existingPaths,
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const violations = await checkPhase0(rootDir);
  if (violations.length > 0) {
    for (const item of violations) {
      console.error(
        `[phase0-checkpoint] ${item.code} ${item.path}: ${item.detail}`,
      );
    }
    process.exit(1);
  }

  console.log("[phase0-checkpoint] PASS");
}
