import { appendFile, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib.mjs";

export const GATES = Object.freeze([
  "dependencies-frozen",
  "toolchain-exact",
  "format-hygiene",
  "schema-integrity",
  "contract-generated-reproducible",
  "contract-manifest-valid",
  "contract-profile-drift",
  "repository-governance",
  "secret-scan",
  "dependency-inventory",
  "license-provenance",
  "typescript-strict",
  "typescript-build",
  "core-build",
  "desktop-ui-build",
  "desktop-foundation-contract",
  "desktop-security-contract",
  "architecture-enforcement",
  "normal-tests",
  "dependency-vulnerability-high-plus",
  "cargo-audit-install",
  "cargo-audit-version",
  "rust-dependency-vulnerability-rustsec",
  "rustsec-audit-json",
  "cargo-metadata-windows",
  "rustsec-informational-warning-review",
  "rustfmt",
  "rust-clippy-warnings-as-errors",
  "rust-host-build",
  "rust-windows-target-build",
  "windows-tauri-production-build",
  "phase0-section-checkpoint",
]);

const GOVERNANCE_MODES = new Set(["SERVER_ENFORCED", "COMPENSATING_CONTROLS"]);

function requireValue(value, name) {
  if (!value) throw new Error(`${name} is required for PASS evidence`);
  return value;
}

function resolveCandidateSha(env) {
  const hasExplicitCandidate = Object.prototype.hasOwnProperty.call(
    env,
    "JARVIS_CANDIDATE_SHA",
  );
  if (env.GITHUB_EVENT_NAME === "pull_request" || hasExplicitCandidate) {
    const candidateSha = requireValue(
      env.JARVIS_CANDIDATE_SHA,
      "JARVIS_CANDIDATE_SHA",
    );
    if (!/^[0-9a-f]{40}$/.test(candidateSha)) {
      throw new Error("JARVIS_CANDIDATE_SHA must be a 40-hex commit SHA");
    }
    return candidateSha;
  }

  const githubSha = requireValue(env.GITHUB_SHA, "GITHUB_SHA");
  if (!/^[0-9a-f]{40}$/.test(githubSha)) {
    throw new Error("GITHUB_SHA must be a 40-hex commit SHA");
  }
  return githubSha;
}

export function buildCiEvidence({
  env,
  versions,
  contractSuiteVersion,
  governanceMode,
}) {
  const commitSha = resolveCandidateSha(env);
  if (env.JARVIS_STATIC_CI_GATES_PASSED !== "1") {
    throw new Error(
      "JARVIS_STATIC_CI_GATES_PASSED=1 is required for PASS evidence",
    );
  }
  if (env.JARVIS_PHASE0_CHECKPOINT_PASSED !== "1") {
    throw new Error(
      "JARVIS_PHASE0_CHECKPOINT_PASSED=1 is required for PASS evidence",
    );
  }
  if (env.JARVIS_WINDOWS_TAURI_GATES_PASSED !== "1") {
    throw new Error(
      "JARVIS_WINDOWS_TAURI_GATES_PASSED=1 is required for PASS evidence",
    );
  }
  if (env.JARVIS_RUST_AUDIT_PASSED !== "1") {
    throw new Error(
      "JARVIS_RUST_AUDIT_PASSED=1 is required for PASS evidence",
    );
  }
  if (env.JARVIS_RUSTSEC_REVIEW_PASSED !== "1") {
    throw new Error(
      "JARVIS_RUSTSEC_REVIEW_PASSED=1 is required for PASS evidence",
    );
  }
  if (contractSuiteVersion !== "1.0.7") {
    throw new Error(
      `contractSuiteVersion evidence mismatch: expected 1.0.7, got ${contractSuiteVersion ?? "<missing>"}`,
    );
  }
  if (!GOVERNANCE_MODES.has(governanceMode)) {
    throw new Error(
      `governanceMode must be SERVER_ENFORCED or COMPENSATING_CONTROLS, got ${governanceMode ?? "<missing>"}`,
    );
  }

  return Object.freeze({
    schemaVersion: 2,
    scope: "PHASE_0_STATIC_CI",
    checkpoint: "0.CP",
    status: "PASS",
    contractSuiteVersion,
    governanceMode,
    commitSha,
    runId: requireValue(env.GITHUB_RUN_ID, "GITHUB_RUN_ID"),
    runAttempt: requireValue(env.GITHUB_RUN_ATTEMPT, "GITHUB_RUN_ATTEMPT"),
    ref: requireValue(env.GITHUB_REF, "GITHUB_REF"),
    runner: Object.freeze({
      os: requireValue(env.RUNNER_OS, "RUNNER_OS"),
      arch: requireValue(env.RUNNER_ARCH, "RUNNER_ARCH"),
    }),
    toolchain: Object.freeze({ ...versions }),
    gates: GATES,
  });
}

export function parseLocalCiGateResults(text) {
  const results = String(text).split(/\r?\n/).filter(Boolean).map((line, index) => {
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`LocalCI gate result line ${index + 1} is not valid JSON`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value) || !GATES.includes(value.gate) || value.exitCode !== 0 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.startedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.finishedAt)) {
      throw new Error(`LocalCI gate result line ${index + 1} is invalid or not successful`);
    }
    return Object.freeze({ gate: value.gate, startedAt: value.startedAt, finishedAt: value.finishedAt, exitCode: 0 });
  });
  if (JSON.stringify(results.map(({ gate }) => gate)) !== JSON.stringify(GATES)) {
    throw new Error("LocalCI gate results must contain every mandatory gate exactly once and in canonical order");
  }
  return Object.freeze(results);
}

function requirePattern(value, name, pattern) {
  const result = requireValue(value, name);
  if (!pattern.test(result)) throw new Error(`${name} has an invalid value`);
  return result;
}

function orderedTimestamps(values) {
  const parsed = values.map((value, index) => {
    const text = requirePattern(value, `LocalCI timestamp ${index + 1}`, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    const time = Date.parse(text);
    if (!Number.isFinite(time)) throw new Error(`LocalCI timestamp ${index + 1} is invalid`);
    return time;
  });
  if (parsed.some((time, index) => index > 0 && time < parsed[index - 1])) throw new Error("LocalCI timestamps must be ordered");
}

function validateLocalCiGateResults(gateResults) {
  if (Array.isArray(gateResults)) {
    return parseLocalCiGateResults(gateResults.map((value) => JSON.stringify(value)).join("\n"));
  }
  return parseLocalCiGateResults(gateResults);
}

export function buildLocalCiExecutionEvidence({ env, versions, contractSuiteVersion, governanceMode, gateResults }) {
  const commitSha = resolveCandidateSha(env);
  if (contractSuiteVersion !== "1.0.7") throw new Error(`contractSuiteVersion evidence mismatch: expected 1.0.7, got ${contractSuiteVersion ?? "<missing>"}`);
  if (!GOVERNANCE_MODES.has(governanceMode)) throw new Error(`invalid governanceMode ${governanceMode ?? "<missing>"}`);
  const expectedCommit = requireValue(env.LOCALCI_EXPECTED_COMMIT, "LOCALCI_EXPECTED_COMMIT");
  const resolvedCommit = requireValue(env.LOCALCI_RESOLVED_COMMIT, "LOCALCI_RESOLVED_COMMIT");
  if (expectedCommit !== commitSha || resolvedCommit !== commitSha) throw new Error("LocalCI expected, resolved, and candidate commit identities must match exactly");
  if (requireValue(env.LOCALCI_OBSERVED_CHECKOUT_SHA, "LOCALCI_OBSERVED_CHECKOUT_SHA") !== commitSha) throw new Error("LocalCI observed checkout SHA must match the candidate commit exactly");
  if (requireValue(env.LOCALCI_OBSERVED_REPOSITORY, "LOCALCI_OBSERVED_REPOSITORY") !== "andresslacson1989/jarvis-project") throw new Error("LocalCI observed repository identity is not approved");
  if (requireValue(env.LOCALCI_OBSERVED_REF, "LOCALCI_OBSERVED_REF") !== env.LOCALCI_REQUESTED_REF) throw new Error("LocalCI observed ref must match the requested ref exactly");
  const requestedRef = requirePattern(env.LOCALCI_REQUESTED_REF, "LOCALCI_REQUESTED_REF", /^refs\/heads\/[A-Za-z0-9._\/-]+$/);
  const queuedAt = requireValue(env.LOCALCI_QUEUED_AT, "LOCALCI_QUEUED_AT");
  const startedAt = requireValue(env.LOCALCI_STARTED_AT, "LOCALCI_STARTED_AT");
  orderedTimestamps([queuedAt, startedAt]);
  const verifiedGates = validateLocalCiGateResults(gateResults);
  return Object.freeze({
    schemaVersion: 3,
    scope: "PHASE_0_STATIC_CI",
    checkpoint: "0.CP",
    status: "GATES_PASS_PENDING_AUTHORITY_FINALIZATION",
    contractSuiteVersion,
    governanceMode,
    authority: Object.freeze({
      type: "LOCALCI",
      instanceIdentity: requireValue(env.LOCALCI_INSTANCE_ID, "LOCALCI_INSTANCE_ID"),
      jobId: requireValue(env.LOCALCI_JOB_ID, "LOCALCI_JOB_ID"),
      pipelineIdentity: requireValue(env.LOCALCI_PIPELINE_ID, "LOCALCI_PIPELINE_ID"),
      pipelineVersion: requireValue(env.LOCALCI_PIPELINE_VERSION, "LOCALCI_PIPELINE_VERSION"),
    }),
    requestedRevision: Object.freeze({
      ref: requestedRef,
      expectedCommit,
      resolvedCommit,
    }),
    observedCheckout: Object.freeze({
      repository: env.LOCALCI_OBSERVED_REPOSITORY,
      ref: env.LOCALCI_OBSERVED_REF,
      sha: env.LOCALCI_OBSERVED_CHECKOUT_SHA,
    }),
    timestamps: Object.freeze({
      queuedAt,
      startedAt,
    }),
    runner: Object.freeze({ os: requirePattern(env.LOCALCI_RUNNER_OS, "LOCALCI_RUNNER_OS", /^Windows$/), arch: requirePattern(env.LOCALCI_RUNNER_ARCH, "LOCALCI_RUNNER_ARCH", /^X64$/) }),
    toolchain: Object.freeze({ ...versions }),
    gateResults: verifiedGates,
    finalizationRequirement: "LOCALCI_CONTROL_PLANE_MUST_APPEND_TERMINAL_STATUS_FINISHED_AT_LOG_AND_ARTIFACT_HASHES_RETENTION_EXPORT_AND_CANCELLATION_RECOVERY_EVIDENCE",
  });
}

function runVersion(command, args, parser = (value) => value.trim()) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`${command} unavailable: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with exit ${result.status}: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return parser(result.stdout.trim());
}

async function gatherVersions() {
  return {
    node: process.version.replace(/^v/, ""),
    pnpm: runVersion("pnpm", ["--version"]),
    typescript: runVersion(
      "pnpm",
      ["exec", "tsc", "--version"],
      (value) => value.replace(/^Version\s+/, ""),
    ),
    rust: runVersion("rustc", ["--version"], (value) => value.split(/\s+/)[1]),
    cargo: runVersion("cargo", ["--version"], (value) => value.split(/\s+/)[1]),
  };
}

async function assertCanonicalVersions(rootDir, versions) {
  const baseline = JSON.parse(
    await readFile(
      resolve(rootDir, "tools", "toolchain", "toolchain-baseline.json"),
      "utf8",
    ),
  );
  const expected = {
    node: baseline.node.version,
    pnpm: baseline.pnpm.version,
    typescript: baseline.typescript.version,
    rust: baseline.rust.version,
    cargo: baseline.rust.version,
  };
  for (const [name, version] of Object.entries(expected)) {
    if (versions[name] !== version) {
      throw new Error(
        `${name} evidence mismatch: expected ${version}, got ${versions[name]}`,
      );
    }
  }
}

if (isMain(import.meta.url)) {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const [versions, canonicalValues, governanceProfile] = await Promise.all([
    gatherVersions(),
    readFile(
      resolve(
        rootDir,
        "packages/schemas/src/canonical/v1/jarvis-v1.0.7.contract-values.json",
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      resolve(
        rootDir,
        "docs/implementation/governance/repository-governance-profile.json",
      ),
      "utf8",
    ).then(JSON.parse),
  ]);

  await assertCanonicalVersions(rootDir, versions);

  const localCi = process.env.JARVIS_CI_AUTHORITY === "LOCALCI";
  const evidence = localCi
    ? buildLocalCiExecutionEvidence({
      env: process.env,
      versions,
      contractSuiteVersion: canonicalValues.contractSuiteVersion,
      governanceMode: governanceProfile.governanceMode,
      gateResults: parseLocalCiGateResults(await readFile(requireValue(process.env.JARVIS_CI_GATE_RESULTS_PATH, "JARVIS_CI_GATE_RESULTS_PATH"), "utf8")),
    })
    : buildCiEvidence({
      env: process.env,
      versions,
      contractSuiteVersion: canonicalValues.contractSuiteVersion,
      governanceMode: governanceProfile.governanceMode,
    });
  const json = JSON.stringify(evidence);
  console.log(`[ci-evidence] ${json}`);

  if (localCi) {
    await writeFile(resolve(rootDir, "reports", "localci-execution-attestation.json"), `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### JARVIS Phase 0 Static CI evidence\n\n\`${json}\`\n`,
      "utf8",
    );
  }
}
