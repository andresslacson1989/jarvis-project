import { appendFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib.mjs";

const GATES = Object.freeze([
  "toolchain-exact",
  "format-hygiene",
  "schema-integrity",
  "secret-scan",
  "dependency-inventory",
  "license-provenance",
  "typescript-strict",
  "typescript-build",
  "architecture-enforcement",
  "normal-tests",
  "dependency-vulnerability-high-plus",
  "rustfmt",
  "rust-clippy-warnings-as-errors",
  "rust-host-build",
  "rust-windows-target-build",
]);

function requireValue(value, name) {
  if (!value) throw new Error(`${name} is required for PASS evidence`);
  return value;
}

export function buildCiEvidence({ env, versions }) {
  const commitSha = requireValue(env.GITHUB_SHA, "GITHUB_SHA");
  if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new Error("GITHUB_SHA must be a 40-hex commit SHA");
  if (env.JARVIS_STATIC_CI_GATES_PASSED !== "1") {
    throw new Error("JARVIS_STATIC_CI_GATES_PASSED=1 is required for PASS evidence");
  }

  return Object.freeze({
    schemaVersion: 1,
    subsection: "0.11",
    status: "PASS",
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

function runVersion(command, args, parser = (value) => value.trim()) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false, windowsHide: true });
  if (result.error) throw new Error(`${command} unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status}: ${(result.stderr || result.stdout).trim()}`);
  return parser(result.stdout.trim());
}

async function gatherVersions(rootDir) {
  return {
    node: process.version.replace(/^v/, ""),
    pnpm: runVersion("pnpm", ["--version"]),
    typescript: runVersion("pnpm", ["exec", "tsc", "--version"], (value) => value.replace(/^Version\s+/, "")),
    rust: runVersion("rustc", ["--version"], (value) => value.split(/\s+/)[1]),
    cargo: runVersion("cargo", ["--version"], (value) => value.split(/\s+/)[1]),
  };
}

async function assertCanonicalVersions(rootDir, versions) {
  const baseline = JSON.parse(await readFile(resolve(rootDir, "tools", "toolchain", "toolchain-baseline.json"), "utf8"));
  const expected = {
    node: baseline.node.version,
    pnpm: baseline.pnpm.version,
    typescript: baseline.typescript.version,
    rust: baseline.rust.version,
    cargo: baseline.rust.version,
  };
  for (const [name, version] of Object.entries(expected)) {
    if (versions[name] !== version) throw new Error(`${name} evidence mismatch: expected ${version}, got ${versions[name]}`);
  }
}

if (isMain(import.meta.url)) {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const versions = await gatherVersions(rootDir);
  await assertCanonicalVersions(rootDir, versions);
  const evidence = buildCiEvidence({ env: process.env, versions });
  const json = JSON.stringify(evidence);
  console.log(`[ci-evidence] ${json}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### JARVIS Static CI evidence\n\n\`${json}\`\n`, "utf8");
  }
}
