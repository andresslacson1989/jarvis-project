import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, open, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateRuntimeManifest } from "./generate-core-runtime-manifest.mjs";

const V1_NODE_VERSION = "24.18.0";

function usage() {
  return "Usage: node tools/release/package-core-runtime.mjs --node <absolute-node.exe> --core <absolute-core-entrypoint> --output <absolute-release-root> [--node-version 24.18.0]";
}

function parseArguments(argv) {
  const values = new Map();
  const allowedArguments = new Set(["--node", "--core", "--output", "--node-version"]);
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

  const node = values.get("--node");
  const core = values.get("--core");
  const output = values.get("--output");
  const nodeVersion = values.get("--node-version") ?? V1_NODE_VERSION;
  if (!node || !core || !output) throw new Error(usage());
  return { node, core, output, nodeVersion };
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function requireRegularFile(path, label) {
  let information;
  try {
    information = await lstat(path);
  } catch (error) {
    throw new Error(`${label} is missing: ${error.message}`, { cause: error });
  }
  if (information.isSymbolicLink() || !information.isFile()) {
    throw new Error(`${label} must be a regular, non-symbolic-link file`);
  }
}

async function readAt(handle, position, length, label) {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  if (bytesRead !== length) throw new Error(`${label} is truncated`);
  return buffer;
}

async function validateWindowsX64Executable(path) {
  const handle = await open(path, "r");
  try {
    const dosHeader = await readAt(handle, 0, 64, "node.exe DOS header");
    if (dosHeader.toString("ascii", 0, 2) !== "MZ") {
      throw new Error("release-owned node.exe is not a Windows PE executable");
    }
    const peOffset = dosHeader.readUInt32LE(0x3c);
    const peHeader = await readAt(handle, peOffset, 6, "node.exe PE header");
    if (peHeader.toString("ascii", 0, 4) !== "PE\0\0") {
      throw new Error("release-owned node.exe has an invalid PE signature");
    }
    if (peHeader.readUInt16LE(4) !== 0x8664) {
      throw new Error("release-owned node.exe must target x64");
    }
  } finally {
    await handle.close();
  }
}

function requireAbsolutePath(path, label) {
  if (!isAbsolute(path)) throw new Error(`${label} must be an absolute path`);
  return resolve(path);
}

async function copyReleaseUnit({ node, core, output }) {
  const runtimeDirectory = join(output, "runtime");
  const coreDirectory = join(output, "core", "dist");
  await mkdir(runtimeDirectory, { recursive: true });
  await mkdir(coreDirectory, { recursive: true });
  await copyFile(node, join(runtimeDirectory, "node.exe"), constants.COPYFILE_EXCL);
  await copyFile(core, join(coreDirectory, "main.js"), constants.COPYFILE_EXCL);
}

export async function packageCoreRuntime({ node, core, output, nodeVersion = V1_NODE_VERSION, ...unknownOptions }) {
  if (Object.keys(unknownOptions).length > 0) {
    throw new Error(`unknown option: ${Object.keys(unknownOptions)[0]}`);
  }
  if (nodeVersion !== V1_NODE_VERSION) {
    throw new Error(`--node-version must be the V1 pinned runtime ${V1_NODE_VERSION}`);
  }

  const sourceNode = requireAbsolutePath(node, "--node");
  const sourceCore = requireAbsolutePath(core, "--core");
  const releaseRoot = requireAbsolutePath(output, "--output");

  await requireRegularFile(sourceNode, "source node.exe");
  await requireRegularFile(sourceCore, "source Core entrypoint");
  if (sourceNode.split(/[\\/]/u).at(-1)?.toLowerCase() !== "node.exe") {
    throw new Error("source node executable must be named node.exe");
  }
  await validateWindowsX64Executable(sourceNode);
  if (await pathExists(releaseRoot)) {
    throw new Error("release output root already exists; refusing to overwrite it");
  }

  await mkdir(dirname(releaseRoot), { recursive: true });
  const temporaryRoot = await mkdtemp(join(dirname(releaseRoot), ".jarvis-core-runtime-"));
  try {
    await copyReleaseUnit({ node: sourceNode, core: sourceCore, output: temporaryRoot });
    const manifestResult = await generateRuntimeManifest({
      root: temporaryRoot,
      nodeVersion,
    });
    await rename(temporaryRoot, releaseRoot);
    return { manifest: manifestResult.manifest, releaseRoot };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const result = await packageCoreRuntime(arguments_);
  console.log(`[core-runtime-package] wrote ${result.releaseRoot}`);
}

if (pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[core-runtime-package] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
