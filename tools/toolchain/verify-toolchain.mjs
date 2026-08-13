import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const metadataOnly = process.argv.includes("--metadata-only");

function fail(message) {
  console.error(`[toolchain] ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function runExact(command, args, expected, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error) fail(`${label} unavailable: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`${label} failed with exit ${String(result.status)}: ${(result.stderr || result.stdout).trim()}`);
  }
  const actual = result.stdout.trim();
  assert(actual === expected, `${label} mismatch: expected ${expected}, got ${actual || "<empty>"}`);
}

function runContains(command, args, expectedFragment, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.error) fail(`${label} unavailable: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`${label} failed with exit ${String(result.status)}: ${(result.stderr || result.stdout).trim()}`);
  }
  const actual = result.stdout.trim();
  assert(actual.includes(expectedFragment), `${label} mismatch: expected ${expectedFragment} in ${actual || "<empty>"}`);
}

const baseline = readJson("tools/toolchain/toolchain-baseline.json");
const pkg = readJson("package.json");
const tsconfig = readJson("tsconfig.json");
const nodeVersion = read(".node-version").trim();
const workspace = read("pnpm-workspace.yaml");
const lockfile = read("pnpm-lock.yaml");
const rustToolchain = read("rust-toolchain.toml");
const cargoToml = read("Cargo.toml");
const cargoLock = read("Cargo.lock");
const rustSmokeManifest = read("tools/toolchain/rust-smoke/Cargo.toml");
const rustSmoke = read("tools/toolchain/rust-smoke/src/lib.rs");

assert(baseline.schemaVersion === 1, "toolchain baseline schema version mismatch");
assert(baseline.profile === "JARVIS_V1_WINDOWS_FULL_HOST", "toolchain profile mismatch");
assert(baseline.node?.lifecycle === "LTS", "Node selection must remain on the selected LTS line");
assert(baseline.rust?.channel === "stable", "Rust selection must remain stable");

const EXPECTED = Object.freeze({
  node: baseline.node.version,
  pnpm: baseline.pnpm.version,
  typescript: baseline.typescript.version,
  rust: baseline.rust.version,
  rustEdition: baseline.rust.edition,
  rustTarget: baseline.rust.target,
  lockfileVersion: baseline.pnpm.lockfileVersion,
  typescriptIntegrity: baseline.typescript.integrity,
});

assert(pkg.private === true, "root package must remain private");
assert(pkg.packageManager === `pnpm@${EXPECTED.pnpm}`, "packageManager pin mismatch");
assert(pkg.engines?.node === EXPECTED.node, "Node engine pin mismatch");
assert(pkg.engines?.pnpm === EXPECTED.pnpm, "pnpm engine pin mismatch");
assert(pkg.devDependencies?.typescript === EXPECTED.typescript, "TypeScript dependency must be exact");
assert(nodeVersion === EXPECTED.node, ".node-version mismatch");

for (const [option, value] of Object.entries({
  strict: true,
  noImplicitAny: true,
  strictNullChecks: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  useUnknownInCatchVariables: true,
  noImplicitReturns: true,
  noImplicitThis: true,
  alwaysStrict: true,
  verbatimModuleSyntax: true,
  isolatedModules: true,
  forceConsistentCasingInFileNames: true,
  allowJs: false,
  checkJs: false,
  skipLibCheck: false,
  resolveJsonModule: true,
  noEmit: true,
})) {
  assert(tsconfig.compilerOptions?.[option] === value, `tsconfig compiler option ${option} must be ${String(value)}`);
}

for (const [key, value] of [
  ["nodeVersion", EXPECTED.node],
  ["engineStrict", "true"],
  ["pmOnFail", "error"],
  ["minimumReleaseAge", "1440"],
  ["minimumReleaseAgeStrict", "true"],
  ["minimumReleaseAgeIgnoreMissingTime", "false"],
  ["trustPolicy", "no-downgrade"],
  ["trustLockfile", "false"],
  ["blockExoticSubdeps", "true"],
  ["strictPeerDependencies", "true"],
  ["strictDepBuilds", "true"],
  ["verifyDepsBeforeRun", "error"],
  ["saveExact", "true"],
  ["autoInstallPeers", "false"],
  ["disallowWorkspaceCycles", "true"],
]) {
  assert(workspace.includes(`${key}: ${value}`), `pnpm hardening setting ${key} mismatch`);
}
assert(workspace.includes("allowBuilds: {}"), "dependency build scripts must be deny-by-default");

assert(lockfile.includes(`lockfileVersion: '${EXPECTED.lockfileVersion}'`), "pnpm lockfile version mismatch");
assert(lockfile.includes(`specifier: ${EXPECTED.typescript}`), "TypeScript lock specifier mismatch");
assert(lockfile.includes(`version: ${EXPECTED.typescript}`), "TypeScript lock version mismatch");
assert(lockfile.includes(EXPECTED.typescriptIntegrity), "TypeScript lock integrity mismatch");

assert(rustToolchain.includes(`channel = \"${EXPECTED.rust}\"`), "Rust toolchain pin mismatch");
for (const component of baseline.rust.components) {
  assert(rustToolchain.includes(`\"${component}\"`), `Rust component ${component} missing`);
}
assert(rustToolchain.includes(`targets = [\"${EXPECTED.rustTarget}\"]`), "Rust Windows target mismatch");
assert(cargoToml.includes(`rust-version = \"${EXPECTED.rust}\"`), "Cargo rust-version mismatch");
assert(cargoToml.includes(`edition = \"${EXPECTED.rustEdition}\"`), "Cargo edition mismatch");
assert(cargoLock.includes("version = 4"), "Cargo lockfile version mismatch");
assert(cargoLock.includes('name = "jarvis-toolchain-smoke"'), "Rust smoke package missing from Cargo.lock");
assert(rustSmokeManifest.includes("publish = false"), "Rust smoke crate must be non-publishable");
assert(rustSmoke.includes("#![forbid(unsafe_code)]"), "Rust smoke crate must forbid unsafe code");
assert(rustSmoke.includes(EXPECTED.rust), "Rust smoke baseline mismatch");

console.log("[toolchain] metadata pins and lock coherence: PASS");
if (metadataOnly) process.exit(0);

const actualNode = process.version.replace(/^v/, "");
assert(actualNode === EXPECTED.node, `Node mismatch: expected ${EXPECTED.node}, got ${actualNode}`);
runExact("pnpm", ["--version"], EXPECTED.pnpm, "pnpm");

const tscScript = resolve(root, "node_modules", "typescript", "bin", "tsc");
runExact(process.execPath, [tscScript, "--version"], `Version ${EXPECTED.typescript}`, "TypeScript");
runContains("rustc", ["--version"], `rustc ${EXPECTED.rust} `, "rustc");
runContains("cargo", ["--version"], `cargo ${EXPECTED.rust} `, "cargo");
runContains("rustfmt", ["--version"], "rustfmt ", "rustfmt");
runContains("cargo", ["clippy", "--version"], "clippy ", "clippy");

console.log("[toolchain] exact runtime toolchain verification: PASS");
