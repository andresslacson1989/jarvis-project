import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const NODE_RELATIVE_PATH = "runtime/node.exe";
const CORE_RELATIVE_PATH = "core/dist/main.js";
const DEFAULT_OUTPUT = "runtime-manifest.json";

function usage() {
  return "Usage: node tools/release/generate-core-runtime-manifest.mjs --root <absolute-release-root> --node-version <x.y.z> [--output <relative-path>]";
}

function parseArguments(argv) {
  const values = new Map();
  const allowedArguments = new Set(["--root", "--node-version", "--output"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`unexpected argument: ${argument}`);
    const [key, inlineValue] = argument.split("=", 2);
    if (!allowedArguments.has(key)) throw new Error(`unknown argument: ${key}`);
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${key}`);
    if (values.has(key)) throw new Error(`duplicate argument: ${key}`);
    values.set(key, value);
  }
  const root = values.get("--root");
  const nodeVersion = values.get("--node-version");
  const output = values.get("--output") ?? DEFAULT_OUTPUT;
  if (!root || !nodeVersion || values.size > 3) throw new Error(usage());
  return { root, nodeVersion, output };
}

function ensureReleaseChild(root, candidate, label) {
  const relativePath = relative(root, candidate);
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    relativePath.startsWith("..\\") ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`${label} must remain inside the release root`);
  }
}

async function sha256File(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

async function requireRegularFile(path, label) {
  let information;
  try {
    information = await stat(path);
  } catch (error) {
    throw new Error(`${label} is missing: ${error.message}`, { cause: error });
  }
  if (!information.isFile()) throw new Error(`${label} is not a regular file`);
}

export async function generateRuntimeManifest({
  root,
  nodeVersion,
  output = DEFAULT_OUTPUT,
  ...unknownOptions
}) {
  if (Object.keys(unknownOptions).length > 0) {
    throw new Error(`unknown option: ${Object.keys(unknownOptions)[0]}`);
  }
  if (!isAbsolute(root)) throw new Error("--root must be an absolute release root");
  if (!/^\d+\.\d+\.\d+$/.test(nodeVersion)) {
    throw new Error("--node-version must use exact x.y.z form");
  }

  const releaseRoot = resolve(root);
  const nodePath = resolve(releaseRoot, NODE_RELATIVE_PATH);
  const corePath = resolve(releaseRoot, CORE_RELATIVE_PATH);
  const manifestPath = resolve(releaseRoot, output);
  ensureReleaseChild(releaseRoot, manifestPath, "manifest output");

  await requireRegularFile(nodePath, "release-owned node.exe");
  await requireRegularFile(corePath, "release-owned Core entrypoint");

  const manifest = {
    schemaVersion: 1,
    platform: "WINDOWS",
    runtimeRole: "FULL_HOST",
    architecture: "x64",
    nodeVersion,
    protocolMajor: 1,
    nodePath: NODE_RELATIVE_PATH.replaceAll("\\", "/"),
    coreEntrypoint: CORE_RELATIVE_PATH.replaceAll("\\", "/"),
    nodeSha256: await sha256File(nodePath),
    coreSha256: await sha256File(corePath),
  };

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest, manifestPath };
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const result = await generateRuntimeManifest(arguments_);
  console.log(`[core-runtime-manifest] wrote ${result.manifestPath}`);
}

if (pathToFileURL(resolve(process.argv[1])) .href === import.meta.url) {
  main().catch((error) => {
    console.error(`[core-runtime-manifest] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
