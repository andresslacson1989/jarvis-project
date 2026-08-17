import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { delimiter, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".rs"]);
const requiredChildren = Object.freeze(["0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "0.10", "0.11", "0.12", "0.13"]);
const expectedTauri = Object.freeze({ runtime: "2.11.5", build: "2.6.3", rustPluginOpener: "2.5.4", javascriptApi: "2.11.1", javascriptPluginOpener: "2.5.4" });

function violation(code, path, detail) { return Object.freeze({ code, path, detail }); }
function rowStatus(matrix, id) { return String(matrix).match(new RegExp(`^\\| ↳ \\*\\*${id.replace(".", "\\.")}\\*\\*[^\\n]*\\| \\*\\*([^*]+)\\*\\* \\|`, "m"))?.[1] ?? null; }
function section0Status(matrix) { return String(matrix).match(/^\| \*\*SECTION 0 — Repository \/ Platform Contracts \/ Toolchain \/ Governance\*\* \| \*\*([^*]+)\*\* \|/m)?.[1] ?? null; }

function validateComponentBuilds(profile, packageJson, corePackageJson, desktopPackageJson, cargoToml, toolchainBaseline) {
  const failures = [];
  if (!Array.isArray(profile.requiredComponentBuilds) || profile.requiredComponentBuilds.length !== 3) return [violation("PHASE0_COMPONENT_BUILD_PROFILE", "tools/checkpoints/phase0-checkpoint-profile.json", "three independent Core, web UI, and Tauri host build gates are required")];
  const core = profile.requiredComponentBuilds.find((item) => item.packageName === "@jarvis/core");
  const desktop = profile.requiredComponentBuilds.find((item) => item.packageName === "@jarvis/desktop");
  const host = profile.requiredComponentBuilds.find((item) => item.crate === "jarvis-desktop-host");
  if (!core || corePackageJson?.scripts?.[core.script] !== core.scriptCommand || !String(packageJson?.scripts?.build).includes(core.rootBuildCommand)) failures.push(violation("PHASE0_CORE_BUILD_GATE", "package.json", "the Core build must be independently defined and required by the root build"));
  if (!desktop || desktopPackageJson?.scripts?.[desktop.script] !== desktop.scriptCommand || !String(packageJson?.scripts?.build).includes(desktop.rootBuildCommand)) failures.push(violation("PHASE0_DESKTOP_WEB_BUILD_GATE", "package.json", "the desktop web UI build must be independently defined and required by the root build"));
  if (!host || host.command !== "cargo check --locked -p jarvis-desktop-host --target x86_64-pc-windows-msvc" || !String(cargoToml).includes('name = "jarvis-desktop-host"')) failures.push(violation("PHASE0_TAURI_HOST_BUILD_GATE", "apps/desktop/src-tauri/Cargo.toml", "the native Tauri host must have an exact local Windows build gate"));
  for (const [key, version] of Object.entries(expectedTauri)) if (toolchainBaseline?.tauri?.[key] !== version) failures.push(violation("PHASE0_TAURI_RELEASE_FACTS", "tools/toolchain/toolchain-baseline.json", `Tauri ${key} must be pinned to ${version}`));
  for (const pin of ['tauri-build = { version = "=2.6.3", features = ["codegen"] }', 'tauri = { version = "=2.11.5", features = ["custom-protocol"] }', 'tauri-plugin-opener = "=2.5.4"']) if (!String(cargoToml).includes(pin)) failures.push(violation("PHASE0_TAURI_RELEASE_FACTS", "apps/desktop/src-tauri/Cargo.toml", `missing exact Tauri release pin ${pin}`));
  if (desktopPackageJson?.dependencies?.["@tauri-apps/api"] !== "2.11.1" || desktopPackageJson?.dependencies?.["@tauri-apps/plugin-opener"] !== "2.5.4") failures.push(violation("PHASE0_TAURI_RELEASE_FACTS", "apps/desktop/package.json", "desktop Tauri JavaScript package pins must match the baseline"));
  return failures;
}

function validateLocalGates(profile) {
  const expected = [["pnpm", "toolchain:verify"], ["pnpm", "format:check"], ["pnpm", "schema:check"], ["pnpm", "contract:check-generated"], ["pnpm", "contract:check-manifest"], ["pnpm", "contract:check-drift"], ["pnpm", "governance:check"], ["pnpm", "security:secrets"], ["pnpm", "dependency:check"], ["pnpm", "provenance:check"], ["pnpm", "typecheck"], ["pnpm", "--filter", "@jarvis/core", "build"], ["pnpm", "--filter", "@jarvis/desktop", "build:web"], ["cargo", "check", "--locked", "-p", "jarvis-desktop-host", "--target", "x86_64-pc-windows-msvc"], ["pnpm", "architecture:check"], ["pnpm", "test"], ["pnpm", "audit", "--audit-level", "high"], ["cargo", "audit"], ["cargo", "fmt", "--all", "--", "--check"], ["cargo", "clippy", "--locked", "-p", "jarvis-toolchain-smoke", "--all-targets", "--all-features", "--", "-D", "warnings"], ["cargo", "check", "--locked", "-p", "jarvis-toolchain-smoke", "--all-targets", "--all-features"]];
  if (!Array.isArray(profile.requiredLocalGates)) return [violation("PHASE0_LOCAL_GATES_PROFILE", "tools/checkpoints/phase0-checkpoint-profile.json", "requiredLocalGates is required")];
  return expected.filter((command) => !profile.requiredLocalGates.some((gate) => gate.command === command[0] && JSON.stringify(gate.args) === JSON.stringify(command.slice(1)))).map((command) => violation("PHASE0_LOCAL_GATE_MISSING", "tools/checkpoints/phase0-checkpoint-profile.json", `mandatory local gate missing: ${command.join(" ")}`));
}

export function validatePhase0Snapshot({ profile, packageJson, corePackageJson, desktopPackageJson, cargoToml, toolchainBaseline, canonicalValues, matrix, referenceMatrix, linuxSourcePaths = [], androidSourcePaths = [], existingPaths = new Set() }) {
  const failures = [];
  if (profile?.schemaVersion !== 1 || profile?.checkpointId !== "0.CP") return [violation("PHASE0_PROFILE_INVALID", "tools/checkpoints/phase0-checkpoint-profile.json", "schemaVersion=1 and checkpointId=0.CP are required")];
  if (profile.contractSuiteVersion !== "1.0.8") failures.push(violation("PHASE0_CONTRACT_SUITE", "tools/checkpoints/phase0-checkpoint-profile.json", "contractSuiteVersion must be 1.0.8"));
  if (profile.checkpointName !== "Repository Governance + Platform Boundary + Contract-Drift Protection Ready") failures.push(violation("PHASE0_CHECKPOINT_NAME", "tools/checkpoints/phase0-checkpoint-profile.json", "checkpoint name must match Implementation Plan §26"));
  if (packageJson?.scripts?.["phase0:check"] !== "node tools/checkpoints/phase0-checkpoint.mjs") failures.push(violation("PHASE0_SCRIPT_MISSING", "package.json", "phase0:check must invoke the canonical local checkpoint checker"));
  failures.push(...validateComponentBuilds(profile, packageJson, corePackageJson, desktopPackageJson, cargoToml, toolchainBaseline), ...validateLocalGates(profile));
  const target = canonicalValues?.v1RuntimeTarget ?? {};
  if (canonicalValues?.contractSuiteVersion !== "1.0.8" || target.platform !== "WINDOWS" || target.runtimeRole !== "FULL_HOST" || target.architecture !== "x64") failures.push(violation("PHASE0_RUNTIME_TARGET", "packages/schemas/src/canonical/v1/jarvis-v1.0.6.contract-values.json", "V1 target must be JARVIS 1.0.8 WINDOWS/FULL_HOST/x64"));
  for (const path of [...linuxSourcePaths, ...androidSourcePaths].sort()) failures.push(violation("PHASE0_UNQUALIFIED_RUNTIME_SOURCE", path, "Linux/Android executable runtime source is outside the Windows V1 support claim"));
  if (!String(matrix).includes("| Contract suite | JARVIS v1.0.8 |")) failures.push(violation("PHASE0_MATRIX_SUITE_DRIFT", "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md", "live matrix must identify JARVIS v1.0.8"));
  if (!String(referenceMatrix).includes("**Contract suite:** JARVIS v1.0.8") || !String(referenceMatrix).includes("docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md") || !String(referenceMatrix).includes("docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md")) failures.push(violation("PHASE0_REFERENCE_MATRIX_DRIFT", "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md", "reference matrix must route agents to the active v1.0.8 suite and v1.0.6 active component contracts"));
  if (section0Status(matrix) !== "VERIFIED") for (const id of requiredChildren) if (rowStatus(matrix, id) !== "VERIFIED") failures.push(violation("PHASE0_CHILD_NOT_VERIFIED", "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md", `${id} must be VERIFIED before 0.CP while Section 0 is not yet closed`));
  for (const path of profile.requiredEvidencePaths ?? []) if (!existingPaths.has(path)) failures.push(violation("PHASE0_CHILD_EVIDENCE_MISSING", path, "required verified child evidence is missing"));
  for (const path of profile.forbiddenActivePaths ?? []) if (existingPaths.has(path)) failures.push(violation("PHASE0_SUPERSEDED_ACTIVE_CONTRACT", path, "superseded top-level contract/manifest must not remain active"));
  return failures.sort((a, b) => `${a.code}:${a.path}:${a.detail}`.localeCompare(`${b.code}:${b.path}:${b.detail}`, "en"));
}

async function collectRuntimeSources(rootDir, relativeRoot) {
  const base = resolve(rootDir, relativeRoot); if (!existsSync(base)) return [];
  const result = [];
  async function walk(directory) { for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))) { const absolute = resolve(directory, entry.name); if (entry.isDirectory()) await walk(absolute); else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) result.push(relative(rootDir, absolute).split(sep).join("/")); } }
  await walk(base); return result.sort((a, b) => a.localeCompare(b, "en"));
}

export async function checkPhase0(rootDir) {
  const profile = JSON.parse(await readFile(resolve(rootDir, "tools/checkpoints/phase0-checkpoint-profile.json"), "utf8"));
  const [packageJson, corePackageJson, desktopPackageJson, cargoToml, toolchainBaseline, canonicalValues, matrix, referenceMatrix, linuxSourcePaths, androidSourcePaths] = await Promise.all([readFile(resolve(rootDir, "package.json"), "utf8").then(JSON.parse), readFile(resolve(rootDir, "services/core/package.json"), "utf8").then(JSON.parse), readFile(resolve(rootDir, "apps/desktop/package.json"), "utf8").then(JSON.parse), readFile(resolve(rootDir, "apps/desktop/src-tauri/Cargo.toml"), "utf8"), readFile(resolve(rootDir, "tools/toolchain/toolchain-baseline.json"), "utf8").then(JSON.parse), readFile(resolve(rootDir, "packages/schemas/src/canonical/v1/jarvis-v1.0.6.contract-values.json"), "utf8").then(JSON.parse), readFile(resolve(rootDir, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md"), "utf8"), readFile(resolve(rootDir, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md"), "utf8"), collectRuntimeSources(rootDir, "platform/linux"), collectRuntimeSources(rootDir, "platform/android")]);
  const paths = new Set([...(profile.requiredEvidencePaths ?? []), ...(profile.forbiddenActivePaths ?? [])]);
  const existingPaths = new Set([...paths].filter((path) => existsSync(resolve(rootDir, path))));
  return { profile, violations: validatePhase0Snapshot({ profile, packageJson, corePackageJson, desktopPackageJson, cargoToml, toolchainBaseline, canonicalValues, matrix, referenceMatrix, linuxSourcePaths, androidSourcePaths, existingPaths }) };
}

function runLocalGate(rootDir, gate) {
  const corepackScript = gate.command === "pnpm"
    ? (process.env.Path ?? process.env.PATH ?? "").split(delimiter).filter(Boolean).map((directory) => resolve(directory, "node_modules", "corepack", "dist", "pnpm.js")).find((candidate) => existsSync(candidate))
    : null;
  const command = corepackScript ? process.execPath : gate.command;
  const args = corepackScript ? [corepackScript, ...gate.args] : gate.args;
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: rootDir, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? accept() : reject(new Error(`${gate.command} ${gate.args.join(" ")} failed with ${signal ?? `exit ${code}`}`)));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const { profile, violations } = await checkPhase0(rootDir);
  if (violations.length > 0) { for (const item of violations) console.error(`[phase0-checkpoint] ${item.code} ${item.path}: ${item.detail}`); process.exit(1); }
  for (const gate of profile.requiredLocalGates) { console.log(`[phase0-checkpoint] running ${gate.command} ${gate.args.join(" ")}`); await runLocalGate(rootDir, gate); }
  console.log("[phase0-checkpoint] PASS");
}
