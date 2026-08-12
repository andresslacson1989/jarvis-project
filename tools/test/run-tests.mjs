import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadLayerManifest } from "../../tests/harness/layers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

function fail(message, code = 1) {
  console.error(`[tests] ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  let profile = "normal";
  let layer = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--profile") {
      profile = argv[index + 1] ?? fail("--profile requires a value");
      index += 1;
    } else if (arg === "--layer") {
      layer = argv[index + 1] ?? fail("--layer requires a value");
      index += 1;
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }
  if (!["normal", "qualification"].includes(profile)) {
    fail(`unsupported profile: ${profile}`);
  }
  return { profile, layer };
}

async function discoverTests(directory) {
  const found = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith(".test.mjs")) found.push(path);
    }
  }
  await walk(directory);
  return found;
}

function scrubbedEnv() {
  const allowed = [
    "PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP",
    "HOME", "USERPROFILE", "COMSPEC", "NUMBER_OF_PROCESSORS", "CI", "GITHUB_ACTIONS",
  ];
  const env = {};
  for (const key of allowed) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  env.NODE_ENV = "test";
  env.TZ = "UTC";
  env.JARVIS_TEST_SEED = process.env.JARVIS_TEST_SEED ?? "12648430";
  return env;
}

async function runTestFile(path, normalProfile) {
  const args = [];
  if (normalProfile) {
    args.push("--import", resolve(root, "tests", "harness", "deny-network.mjs"));
  }
  args.push("--test", path);
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: scrubbedEnv(),
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    });
    child.on("error", (error) => {
      console.error(`[tests] failed to spawn ${path}: ${error.message}`);
      resolvePromise(1);
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        console.error(`[tests] ${path} terminated by signal ${signal}`);
        resolvePromise(1);
      } else {
        resolvePromise(code ?? 1);
      }
    });
  });
}

const { profile, layer: requestedLayer } = parseArgs(process.argv.slice(2));
const layers = await loadLayerManifest(root);
const known = new Map(layers.map((layer) => [layer.id, layer]));

if (requestedLayer !== null && !known.has(requestedLayer)) {
  fail(`unknown test layer: ${requestedLayer}`);
}

const candidates = requestedLayer
  ? [known.get(requestedLayer)]
  : profile === "normal"
    ? layers.filter((layer) => layer.normalChangeEligible)
    : layers;

const missingRequired = [];
const plans = [];
for (const layer of candidates) {
  const tests = await discoverTests(resolve(root, layer.directory));
  if (tests.length === 0) {
    if (requestedLayer || profile === "qualification" || layer.phase0HarnessRequired) {
      missingRequired.push(layer.id);
    }
    continue;
  }
  plans.push({ layer, tests });
}

if (missingRequired.length > 0) {
  fail(`required test layers have no tests: ${missingRequired.join(", ")}`, 2);
}
if (plans.length === 0) fail("no tests selected", 2);

console.log(`[tests] profile=${profile} layers=${plans.map((plan) => plan.layer.id).join(",")}`);
let failures = 0;
for (const plan of plans) {
  console.log(`[tests] layer=${plan.layer.id} files=${plan.tests.length}`);
  for (const testFile of plan.tests) {
    const code = await runTestFile(testFile, profile === "normal");
    if (code !== 0) failures += 1;
  }
}

if (failures > 0) fail(`${failures} test file(s) failed; blind rerun-to-green is not performed`);
console.log(`[tests] PASS files=${plans.reduce((sum, plan) => sum + plan.tests.length, 0)}`);
