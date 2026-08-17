import { resolve } from "node:path";
import { readdir, rmdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { packageCoreRuntime } from "./package-core-runtime.mjs";
import { validateReleaseSource } from "./validate-source-commit.mjs";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const TAURI_RESOURCE_ROOT = resolve(
  REPOSITORY_ROOT,
  "apps",
  "desktop",
  "src-tauri",
  "resources",
  "core-runtime",
);

function usage() {
  return "Usage: node tools/release/package-tauri-core-runtime.mjs --node <absolute-node.exe> --core <absolute-core-entrypoint> --jarvis-release-version <version> --core-version <version> --source-commit-sha <40-hex-sha> --release-sequence <uint64> --security-epoch <uint64> --tuf-metadata-dir <absolute-dir> --core-node-modules <absolute-dir> [--node-version 24.18.0]";
}

function parseArguments(argv) {
  const values = new Map();
  const allowedArguments = new Set([
    "--node",
    "--core",
    "--node-version",
    "--jarvis-release-version",
    "--core-version",
    "--source-commit-sha",
    "--release-sequence",
    "--security-epoch",
    "--tuf-metadata-dir",
    "--core-node-modules",
    "--target",
    "--protocol-version",
    "--minimum-data-schema-version",
    "--maximum-data-schema-version",
  ]);
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
  const jarvisReleaseVersion = values.get("--jarvis-release-version");
  const coreVersion = values.get("--core-version");
  const sourceCommitSha = values.get("--source-commit-sha");
  const releaseSequence = values.get("--release-sequence");
  const securityEpoch = values.get("--security-epoch");
  const tufMetadataDirectory = values.get("--tuf-metadata-dir");
  const coreNodeModules = values.get("--core-node-modules");
  if (
    !node ||
    !core ||
    !jarvisReleaseVersion ||
    !coreVersion ||
    !sourceCommitSha ||
    !releaseSequence ||
    !securityEpoch ||
    !tufMetadataDirectory ||
    !coreNodeModules
  ) throw new Error(usage());
  return {
    node,
    core,
    nodeVersion: values.get("--node-version") ?? "24.18.0",
    jarvisReleaseVersion,
    coreVersion,
    sourceCommitSha,
    releaseSequence: parseSequence(releaseSequence, "--release-sequence"),
    securityEpoch: parseSequence(securityEpoch, "--security-epoch"),
    tufMetadataDirectory,
    coreNodeModules,
    target: values.get("--target") ?? "WINDOWS_FULL_HOST_X64",
    protocolVersion: Number(values.get("--protocol-version") ?? "1"),
    minimumDataSchemaVersion: Number(values.get("--minimum-data-schema-version") ?? "1"),
    maximumDataSchemaVersion: Number(values.get("--maximum-data-schema-version") ?? "1"),
  };
}

function parseSequence(value, label) {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a non-negative uint64`);
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence)) {
    throw new Error(`${label} must be representable exactly by the release tooling`);
  }
  return sequence;
}

export async function packageTauriCoreRuntime(options) {
  try {
    const entries = await readdir(TAURI_RESOURCE_ROOT);
    if (entries.length > 0) {
      throw new Error(
        "the Tauri Core runtime resource directory already contains files; refusing to overwrite it",
      );
    }
    await rmdir(TAURI_RESOURCE_ROOT);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return packageCoreRuntime({ ...options, output: TAURI_RESOURCE_ROOT });
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  await validateReleaseSource({ sourceCommitSha: arguments_.sourceCommitSha, repositoryRoot: REPOSITORY_ROOT });
  const result = await packageTauriCoreRuntime(arguments_);
  console.log(`[tauri-core-runtime-package] wrote ${result.releaseRoot}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[tauri-core-runtime-package] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
