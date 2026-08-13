import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const NODE_RELATIVE_PATH = "runtime/node.exe";
const CORE_RELATIVE_PATH = "core/dist/main.js";
const CORE_SUPPORT_RELATIVE_PATH = "core/dist/release-trust.js";
const DEFAULT_OUTPUT = "runtime-manifest.json";

function usage() {
  return "Usage: node tools/release/generate-core-runtime-manifest.mjs --root <absolute-release-root> --node-version <x.y.z> --jarvis-release-version <version> --core-version <version> --source-commit-sha <40-hex-sha> --release-sequence <uint64> --security-epoch <uint64> [--target WINDOWS_FULL_HOST_X64] [--protocol-version 1] [--minimum-data-schema-version 1] [--maximum-data-schema-version 1] [--output <relative-path>]";
}

function parseArguments(argv) {
  const values = new Map();
  const allowedArguments = new Set([
    "--root",
    "--node-version",
    "--jarvis-release-version",
    "--core-version",
    "--source-commit-sha",
    "--release-sequence",
    "--security-epoch",
    "--target",
    "--protocol-version",
    "--minimum-data-schema-version",
    "--maximum-data-schema-version",
    "--output",
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
  const root = values.get("--root");
  const nodeVersion = values.get("--node-version");
  const jarvisReleaseVersion = values.get("--jarvis-release-version");
  const coreVersion = values.get("--core-version");
  const sourceCommitSha = values.get("--source-commit-sha");
  const releaseSequence = values.get("--release-sequence");
  const securityEpoch = values.get("--security-epoch");
  const target = values.get("--target") ?? "WINDOWS_FULL_HOST_X64";
  const protocolVersion = values.get("--protocol-version") ?? "1";
  const minimumDataSchemaVersion = values.get("--minimum-data-schema-version") ?? "1";
  const maximumDataSchemaVersion = values.get("--maximum-data-schema-version") ?? "1";
  const output = values.get("--output") ?? DEFAULT_OUTPUT;
  if (
    !root ||
    !nodeVersion ||
    !jarvisReleaseVersion ||
    !coreVersion ||
    !sourceCommitSha ||
    !releaseSequence ||
    !securityEpoch
  ) throw new Error(usage());
  return {
    root,
    nodeVersion,
    jarvisReleaseVersion,
    coreVersion,
    sourceCommitSha,
    releaseSequence: parseSequence(releaseSequence, "--release-sequence"),
    securityEpoch: parseSequence(securityEpoch, "--security-epoch"),
    target,
    protocolVersion: parseVersionNumber(protocolVersion, "--protocol-version"),
    minimumDataSchemaVersion: parseVersionNumber(
      minimumDataSchemaVersion,
      "--minimum-data-schema-version",
    ),
    maximumDataSchemaVersion: parseVersionNumber(
      maximumDataSchemaVersion,
      "--maximum-data-schema-version",
    ),
    output,
  };
}

function parseVersionNumber(value, label) {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a non-negative integer`);
  return Number(value);
}

function parseSequence(value, label) {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a non-negative uint64`);
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence)) {
    throw new Error(`${label} must be representable exactly by the release tooling`);
  }
  return sequence;
}

function ensureReleaseChild(root, candidate, label) {
  const relativePath = relative(root, candidate);
  if (
    !relativePath ||
    isAbsolute(relativePath) ||
    !relativePath.split(/[\\/]/u).every((component) => component.length > 0 && component !== "..")
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
  jarvisReleaseVersion,
  coreVersion,
  sourceCommitSha,
  releaseSequence,
  securityEpoch,
  target = "WINDOWS_FULL_HOST_X64",
  protocolVersion = 1,
  minimumDataSchemaVersion = 1,
  maximumDataSchemaVersion = 1,
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
  if (typeof jarvisReleaseVersion !== "string" || jarvisReleaseVersion.length === 0) {
    throw new Error("--jarvis-release-version is required");
  }
  if (typeof coreVersion !== "string" || coreVersion.length === 0) {
    throw new Error("--core-version is required");
  }
  if (typeof sourceCommitSha !== "string" || !/^[0-9a-f]{40}$/iu.test(sourceCommitSha)) {
    throw new Error("--source-commit-sha must be exactly 40 hexadecimal characters");
  }
  if (!Number.isSafeInteger(releaseSequence) || releaseSequence < 1) {
    throw new Error("--release-sequence must be a positive uint64 representable exactly");
  }
  if (!Number.isSafeInteger(securityEpoch) || securityEpoch < 1) {
    throw new Error("--security-epoch must be a positive uint64 representable exactly");
  }
  if (target !== "WINDOWS_FULL_HOST_X64") {
    throw new Error("--target must be WINDOWS_FULL_HOST_X64");
  }
  if (protocolVersion !== 1) throw new Error("--protocol-version must be 1");
  if (
    !Number.isInteger(minimumDataSchemaVersion) ||
    !Number.isInteger(maximumDataSchemaVersion) ||
    minimumDataSchemaVersion < 1 ||
    maximumDataSchemaVersion < minimumDataSchemaVersion
  ) {
    throw new Error("data schema versions must be ordered positive integers");
  }

  const releaseRoot = resolve(root);
  const nodePath = resolve(releaseRoot, NODE_RELATIVE_PATH);
  const corePath = resolve(releaseRoot, CORE_RELATIVE_PATH);
  const coreSupportPath = resolve(releaseRoot, CORE_SUPPORT_RELATIVE_PATH);
  const manifestPath = resolve(releaseRoot, output);
  ensureReleaseChild(releaseRoot, manifestPath, "manifest output");

  await requireRegularFile(nodePath, "release-owned node.exe");
  await requireRegularFile(corePath, "release-owned Core entrypoint");
  await requireRegularFile(coreSupportPath, "release-owned Core trust module");

  const manifest = {
    manifestVersion: 1,
    jarvisReleaseVersion,
    coreVersion,
    sourceCommitSha: sourceCommitSha.toLowerCase(),
    releaseSequence,
    securityEpoch,
    tufSpecVersion: "1.0.35",
    target,
    protocolVersion,
    minimumDataSchemaVersion,
    maximumDataSchemaVersion,
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
    coreSupportFiles: [
      {
        path: CORE_SUPPORT_RELATIVE_PATH.replaceAll("\\", "/"),
        sha256: await sha256File(coreSupportPath),
      },
    ],
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

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[core-runtime-manifest] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
