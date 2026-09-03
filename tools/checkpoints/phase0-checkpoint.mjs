import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
const PRODUCTION_TAURI_COMMAND =
  "pnpm tauri build --no-bundle --target x86_64-pc-windows-msvc --ci";

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

function workflowStepBlock(workflow, name) {
  const normalized = String(workflow).replace(/\r\n/g, "\n");
  const start = normalized.indexOf(`- name: ${name}\n`);
  if (start < 0) return null;
  const next = normalized.indexOf("\n      - name: ", start + 1);
  return normalized.slice(start, next < 0 ? normalized.length : next);
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
  currentEvidenceStatus = null,
  governanceQualificationStatus = null,
  currentCandidateSha = null,
  checkedOutSha = null,
  explicitCandidateSha = null,
  candidateIsAncestor = null,
  evidenceCandidateSha = null,
  matrixCandidateSha = null,
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

  const steps = parseWorkflowSteps(workflowText);
  let lastIndex = -1;
  const nativeWindowsGateNames = new Set(["Rust Windows-target build"]);

  for (const required of profile.requiredWorkflowSteps ?? []) {
    if (nativeWindowsGateNames.has(required.name)) continue;
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

  const windowsJob = workflowText.match(
    /\n  windows-tauri-build:\s*\n([\s\S]*?)(?=\n  static-ci:\s*\n|$)/,
  )?.[1] ?? "";
  const staticJob = workflowText.match(
    /\n  static-ci:\s*\n([\s\S]*?)(?=\n  [A-Za-z0-9_-]+:\s*\n|$)/,
  )?.[1] ?? "";
  if (!/\n\s+runs-on:\s*windows-2025\s*\n/.test(windowsJob)) {
    violations.push(violation("PHASE0_NATIVE_WINDOWS_JOB_MISSING", ".github/workflows/static-ci.yml", "native Windows Tauri prerequisite must run on windows-2025"));
  }
  if (
    !/github\.event\.pull_request\.head\.sha/.test(windowsJob) ||
    !/Verify exact checkout/.test(windowsJob) ||
    !/git rev-parse HEAD/.test(windowsJob) ||
    !/EXPECTED_SHA/.test(windowsJob)
  ) {
    violations.push(violation("PHASE0_NATIVE_WINDOWS_EXACT_CHECKOUT_MISSING", ".github/workflows/static-ci.yml", "native Windows job must check out and verify the literal candidate SHA"));
  }

  const rustWindowsStep = workflowStepBlock(
    windowsJob,
    "Rust Windows-target build",
  );
  if (
    rustWindowsStep === null ||
    !rustWindowsStep.includes(
      "run: cargo check --locked --workspace --target x86_64-pc-windows-msvc",
    ) ||
    /\n\s+if:/.test(rustWindowsStep) ||
    /\n\s+continue-on-error:/.test(rustWindowsStep)
  ) {
    violations.push(
      violation(
        "PHASE0_NATIVE_WINDOWS_GATE_MISSING",
        ".github/workflows/static-ci.yml",
        "Rust Windows-target build must run unconditionally in the native Windows prerequisite",
      ),
    );
  }

  const productionTauriStep = workflowStepBlock(
    windowsJob,
    "Desktop Tauri production build",
  );
  if (
    productionTauriStep === null ||
    !productionTauriStep.includes(`run: ${PRODUCTION_TAURI_COMMAND}`) ||
    !productionTauriStep.includes("working-directory: apps/desktop") ||
    /\n\s+if:/.test(productionTauriStep) ||
    /\n\s+continue-on-error:/.test(productionTauriStep)
  ) {
    violations.push(
      violation(
        "PHASE0_NATIVE_WINDOWS_GATE_MISSING",
        ".github/workflows/static-ci.yml",
        "Desktop Tauri production build must run unconditionally from apps/desktop in the native Windows prerequisite",
      ),
    );
  }

  if (!/\n\s+needs:\s*windows-tauri-build\s*\n/.test(staticJob)) {
    violations.push(violation("PHASE0_STATIC_CI_WINDOWS_DEPENDENCY_MISSING", ".github/workflows/static-ci.yml", "static-ci must depend on the native Windows Tauri prerequisite"));
  }
  if (!staticJob.includes("Verify native Windows Tauri prerequisite") || !staticJob.includes("JARVIS_WINDOWS_TAURI_GATES_PASSED")) {
    violations.push(violation("PHASE0_STATIC_CI_WINDOWS_AGGREGATION_MISSING", ".github/workflows/static-ci.yml", "static-ci must fail closed and pass native Windows completion into evidence"));
  }
  if (
    staticJob.includes("cargo check --locked --workspace --target x86_64-pc-windows-msvc") ||
    staticJob.includes("cargo check --locked -p jarvis-desktop --target x86_64-pc-windows-msvc")
  ) {
    violations.push(violation("PHASE0_UBUNTU_WINDOWS_CROSS_BUILD_FORBIDDEN", ".github/workflows/static-ci.yml", "MSVC Windows-target Cargo builds must run only in the native Windows prerequisite"));
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
        "packages/schemas/src/canonical/v1/jarvis-v1.0.7.contract-values.json",
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

  if (!String(matrix).includes("| Contract suite | JARVIS v1.0.7 |")) {
    violations.push(
      violation(
        "PHASE0_MATRIX_SUITE_DRIFT",
        "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md",
        "live matrix must identify JARVIS v1.0.7",
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

  if (currentEvidenceStatus !== null || governanceQualificationStatus !== null) {
    const status = section0Status(matrix);
    const expected = status === "VERIFIED" ? "VERIFIED" : "VERIFYING";
    const expectedQualification = status === "VERIFIED" ? "QUALIFIED" : "VERIFYING";
    if (status !== "VERIFIED" && status !== "VERIFYING") {
      violations.push(violation("PHASE0_SECTION_STATUS_INVALID", "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md", "Section 0 must be VERIFIED or VERIFYING"));
    } else if (currentEvidenceStatus !== expected || governanceQualificationStatus !== expectedQualification) {
      violations.push(violation("PHASE0_CURRENT_EVIDENCE_STALE", "docs/implementation/evidence/0.CP-phase0-checkpoint.md", "current checkpoint evidence and selected authority status must match the live Section 0 status"));
    }
  }

  if (explicitCandidateSha !== null || currentCandidateSha !== null || evidenceCandidateSha !== null || matrixCandidateSha !== null) {
    const candidateSha = explicitCandidateSha ?? currentCandidateSha;
    const checkoutSha = checkedOutSha ?? currentCandidateSha;
    const candidateShapeValid = /^[0-9a-f]{40}$/.test(String(candidateSha ?? ""));
    const checkoutShapeValid = /^[0-9a-f]{40}$/.test(String(checkoutSha ?? ""));
    const recordsPresent = evidenceCandidateSha !== null || matrixCandidateSha !== null;
    const recordsMatch = !recordsPresent || (evidenceCandidateSha === candidateSha && matrixCandidateSha === candidateSha);
    let checkoutRelationshipValid = true;
    if (explicitCandidateSha !== null) {
      checkoutRelationshipValid = checkoutSha === explicitCandidateSha;
    } else if (candidateIsAncestor !== null) {
      checkoutRelationshipValid = candidateIsAncestor === true;
    }
    if (!candidateShapeValid || !checkoutShapeValid || !recordsMatch || !checkoutRelationshipValid) {
      violations.push(violation("PHASE0_CANDIDATE_MISMATCH", "docs/implementation/evidence/0.CP-phase0-checkpoint.md", "current matrix and checkpoint evidence candidate must match the resolved implementation candidate; candidate CI must check out that exact SHA"));
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

  const [workflow, packageJson, canonicalValues, matrix, checkpointEvidence, governanceProfile, linuxSourcePaths, androidSourcePaths] =
    await Promise.all([
      readFile(resolve(rootDir, ".github/workflows/static-ci.yml"), "utf8"),
      readFile(resolve(rootDir, "package.json"), "utf8").then(JSON.parse),
      readFile(
        resolve(
          rootDir,
          "packages/schemas/src/canonical/v1/jarvis-v1.0.7.contract-values.json",
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(
        resolve(rootDir, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md"),
        "utf8",
      ),
      readFile(resolve(rootDir, "docs/implementation/evidence/0.CP-phase0-checkpoint.md"), "utf8"),
      readFile(resolve(rootDir, "docs/implementation/governance/repository-governance-profile.json"), "utf8").then(JSON.parse),
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
  const checkedOutSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: rootDir, encoding: "utf8" }).trim();
  const evidenceCandidateSha = checkpointEvidence.match(/implementationCandidateSha:\s*([0-9a-f]{40})/)?.[1] ?? null;
  const explicitCandidateSha = process.env.JARVIS_CANDIDATE_SHA || null;
  const candidateForRelationship = explicitCandidateSha ?? evidenceCandidateSha;
  let candidateIsAncestor = null;
  if (candidateForRelationship && /^[0-9a-f]{40}$/.test(candidateForRelationship)) {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", candidateForRelationship, checkedOutSha], { cwd: rootDir, stdio: "ignore" });
      candidateIsAncestor = true;
    } catch {
      candidateIsAncestor = false;
    }
  }

  return validatePhase0Snapshot({
    profile,
    workflow,
    packageJson,
    canonicalValues,
    matrix,
    linuxSourcePaths,
    androidSourcePaths,
    existingPaths,
    currentEvidenceStatus: checkpointEvidence.match(/^\*\*(VERIFIED|VERIFYING)\b/m)?.[1] ?? null,
    governanceQualificationStatus: governanceProfile?.mandatoryCi?.selectedAuthority?.qualificationStatus ?? null,
    checkedOutSha,
    evidenceCandidateSha,
    matrixCandidateSha: matrix.match(/Implementation candidate under audit:\*{0,2}\s*`([0-9a-f]{40})`/)?.[1] ?? null,
    explicitCandidateSha,
    candidateIsAncestor,
    currentCandidateSha: evidenceCandidateSha,
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
