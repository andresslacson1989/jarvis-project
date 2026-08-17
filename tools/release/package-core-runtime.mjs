import { constants } from "node:fs";
import { copyFile, cp, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateRuntimeManifest } from "./generate-core-runtime-manifest.mjs";
import { validateReleaseSource } from "./validate-source-commit.mjs";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const V1_NODE_VERSION = "24.18.0";
const CORE_SUPPORT_FILES = [
  "release-trust.js",
  "authority-canonical.js",
  "ipc-bootstrap.js",
  "persistence.js",
  "schema.js",
  "backup-descriptor.js",
  "backup-manifest.js",
  "backup-chunks.js",
  "backup-recovery.js",
  "backup-package.js",
  "backup-payload.js",
  "conversation.js",
  "conversation.mjs",
  "provider-routing.js",
  "tool-runtime.mjs",
  "native-capability.mjs",
  "native-capability.mts",
  "codex-cli-adapter.mjs",
  "provider-execution.mjs",
  "provider-execution.mts",
];
const CORE_RUNTIME_INSTALL_ONLY_DEPENDENCIES = new Set(["prebuild-install"]);
const CORE_PACKAGE_JSON = '{"type":"module"}\n';

function usage() {
  return "Usage: node tools/release/package-core-runtime.mjs --node <absolute-node.exe> --core <absolute-core-entrypoint> --output <absolute-release-root> --jarvis-release-version <version> --core-version <version> --source-commit-sha <40-hex-sha> --release-sequence <uint64> --security-epoch <uint64> --tuf-metadata-dir <absolute-dir> [--node-version 24.18.0]";
}

function parseArguments(argv) {
  const values = new Map();
  const allowedArguments = new Set([
    "--node",
    "--core",
    "--output",
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
  const output = values.get("--output");
  const nodeVersion = values.get("--node-version") ?? V1_NODE_VERSION;
  const jarvisReleaseVersion = values.get("--jarvis-release-version");
  const coreVersion = values.get("--core-version");
  const sourceCommitSha = values.get("--source-commit-sha");
  const releaseSequence = values.get("--release-sequence");
  const securityEpoch = values.get("--security-epoch");
  const tufMetadataDirectory = values.get("--tuf-metadata-dir");
  const coreNodeModules = values.get("--core-node-modules");
  const target = values.get("--target") ?? "WINDOWS_FULL_HOST_X64";
  const protocolVersion = values.get("--protocol-version") ?? "1";
  const minimumDataSchemaVersion = values.get("--minimum-data-schema-version") ?? "1";
  const maximumDataSchemaVersion = values.get("--maximum-data-schema-version") ?? "1";
  if (
    !node ||
    !core ||
    !output ||
    !jarvisReleaseVersion ||
    !coreVersion ||
    !sourceCommitSha ||
    !releaseSequence ||
    !securityEpoch ||
    !tufMetadataDirectory ||
    !coreNodeModules
  ) {
    throw new Error(usage());
  }
  return {
    node,
    core,
    output,
    nodeVersion,
    jarvisReleaseVersion,
    coreVersion,
    sourceCommitSha,
    releaseSequence: parseSequence(releaseSequence, "--release-sequence"),
    securityEpoch: parseSequence(securityEpoch, "--security-epoch"),
    tufMetadataDirectory,
    coreNodeModules,
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

async function copyReleaseUnit({ node, core, coreSupports, coreNodeModules, output }) {
  const runtimeDirectory = join(output, "runtime");
  const coreDirectory = join(output, "core", "dist");
  await mkdir(runtimeDirectory, { recursive: true });
  await mkdir(coreDirectory, { recursive: true });
  await writeFile(join(output, "core", "package.json"), CORE_PACKAGE_JSON, { flag: "wx" });
  await copyFile(node, join(runtimeDirectory, "node.exe"), constants.COPYFILE_EXCL);
  await copyFile(core, join(coreDirectory, "main.js"), constants.COPYFILE_EXCL);
  for (const support of coreSupports) {
    await copyFile(support.source, join(coreDirectory, support.name), constants.COPYFILE_EXCL);
  }
  await copyCoreDependencies(coreNodeModules, join(output, "core", "node_modules"));
  await copyCoreWorkspaceRuntimeModules(output);
}

async function copyCoreWorkspaceRuntimeModules(output) {
  const workspacePackages = resolve(REPOSITORY_ROOT, "packages");
  const bundledPackages = join(output, "core", "packages");
  for (const packageName of ["protocol", "policy"]) {
    const source = join(workspacePackages, packageName, "src");
    const destination = join(bundledPackages, packageName, "src");
    await requireRegularDirectory(source, `Core workspace package ${packageName}`);
    await cp(source, destination, { recursive: true, dereference: true, force: false });
  }
  const distDirectory = join(output, "core", "dist");
  for (const entry of await readdir(distDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !(entry.name.endsWith(".js") || entry.name.endsWith(".mjs") || entry.name.endsWith(".mts"))) continue;
    const path = join(distDirectory, entry.name);
    const source = await readFile(path, "utf8");
    const rewritten = source
      .replaceAll("../../../packages/", "../packages/")
      .replaceAll("../../../providers/ai/src/codex-cli-adapter.mjs", "./codex-cli-adapter.mjs");
    if (rewritten !== source) await writeFile(path, rewritten, { flag: "w" });
  }
}

async function resolvePackageRoot(packageName, packageBase) {
  const packageRequire = createRequire(pathToFileURL(join(packageBase, "package.json")));
  const entrypoint = packageRequire.resolve(packageName);
  let current = dirname(entrypoint);
  while (current !== dirname(current)) {
    const manifestPath = join(current, "package.json");
    if (await pathExists(manifestPath)) {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (manifest.name === packageName) return current;
    }
    current = dirname(current);
  }
  throw new Error(`cannot resolve package root for ${packageName}`);
}

async function copyCoreDependencies(sourceNodeModules, destinationNodeModules) {
  const sourceRoot = resolve(sourceNodeModules);
  await requireRegularDirectory(sourceRoot, "Core node_modules directory");
  const corePackageJson = join(dirname(sourceRoot), "package.json");
  if (!(await pathExists(corePackageJson))) return;
  const corePackage = JSON.parse(await readFile(corePackageJson, "utf8"));
  const pending = Object.keys(corePackage.dependencies ?? {})
    .filter((name) => !CORE_RUNTIME_INSTALL_ONLY_DEPENDENCIES.has(name))
    .map((name) => ({
      name,
      base: dirname(corePackageJson),
    }));
  const copied = new Set();
  await mkdir(destinationNodeModules, { recursive: true });
  while (pending.length > 0) {
    const pendingPackage = pending.shift();
    const packageName = pendingPackage?.name;
    if (!packageName || copied.has(packageName)) continue;
    if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(packageName)) {
      throw new Error(`invalid Core dependency package name: ${packageName}`);
    }
    const packageRoot = await realpath(await resolvePackageRoot(packageName, pendingPackage.base));
    const destination = join(destinationNodeModules, ...packageName.split("/"));
    await mkdir(dirname(destination), { recursive: true });
    await cp(packageRoot, destination, {
      recursive: true,
      dereference: true,
      force: false,
      filter: (source) => {
        const relativeSource = relative(packageRoot, source);
        return relativeSource === "" || !relativeSource.split(/[\\/]/u).includes("node_modules");
      },
    });
    copied.add(packageName);
    const packageManifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    pending.push(
      ...[
        ...Object.keys(packageManifest.dependencies ?? {}),
        ...Object.keys(packageManifest.optionalDependencies ?? {}),
      ]
        .filter((name) => !CORE_RUNTIME_INSTALL_ONLY_DEPENDENCIES.has(name))
        .map((name) => ({
          name,
          base: packageRoot,
        })),
    );
  }
}

async function copyTrustMetadata(source, output) {
  const metadataRoot = resolve(source);
  await requireRegularDirectory(metadataRoot, "TUF metadata directory");
  const destination = join(output, "tuf", "metadata");
  await mkdir(destination, { recursive: true });
  for (const name of ["root.json", "timestamp.json", "snapshot.json", "targets.json"]) {
    const sourcePath = join(metadataRoot, name);
    await requireRegularFile(sourcePath, `TUF metadata ${name}`);
    await copyFile(sourcePath, join(destination, name), constants.COPYFILE_EXCL);
  }
}

async function requireRegularDirectory(path, label) {
  let information;
  try {
    information = await lstat(path);
  } catch (error) {
    throw new Error(`${label} is missing: ${error.message}`, { cause: error });
  }
  if (information.isSymbolicLink() || !information.isDirectory()) {
    throw new Error(`${label} must be a regular, non-symbolic-link directory`);
  }
}

export async function packageCoreRuntime({
  node,
  core,
  output,
  nodeVersion = V1_NODE_VERSION,
  jarvisReleaseVersion,
  coreVersion,
  sourceCommitSha,
  releaseSequence,
  securityEpoch,
  tufMetadataDirectory,
  coreNodeModules,
  target = "WINDOWS_FULL_HOST_X64",
  protocolVersion = 1,
  minimumDataSchemaVersion = 1,
  maximumDataSchemaVersion = 1,
  ...unknownOptions
}) {
  if (Object.keys(unknownOptions).length > 0) {
    throw new Error(`unknown option: ${Object.keys(unknownOptions)[0]}`);
  }
  if (nodeVersion !== V1_NODE_VERSION) {
    throw new Error(`--node-version must be the V1 pinned runtime ${V1_NODE_VERSION}`);
  }

  const sourceNode = requireAbsolutePath(node, "--node");
  const sourceCore = requireAbsolutePath(core, "--core");
  const sourceCoreSupports = CORE_SUPPORT_FILES.map((name) => ({
    name,
    source: join(dirname(sourceCore), name),
  }));
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
  for (const support of sourceCoreSupports) {
    await requireRegularFile(support.source, `source Core support module ${support.name}`);
  }

  const persistenceSupport = sourceCoreSupports.find(({ name }) => name === "persistence.js");
  if (!persistenceSupport) throw new Error("source Core persistence support module is missing");
  const persistenceModule = await import(pathToFileURL(persistenceSupport.source).href);
  const persistenceQualification = {
    binding: persistenceModule.QUALIFIED_SQLITE_BINDING,
    bindingVersion: persistenceModule.QUALIFIED_SQLITE_BINDING_VERSION,
    cipher: persistenceModule.QUALIFIED_SQLITE_CIPHER,
    cipherProfile: persistenceModule.QUALIFIED_SQLCIPHER_PROFILE,
    sqliteVersion: persistenceModule.QUALIFIED_SQLITE_VERSION,
    sqliteSourceId: persistenceModule.QUALIFIED_SQLITE_SOURCE_ID,
    walResetFixEvidence: {
      upstreamFixedSince: persistenceModule.QUALIFIED_SQLITE_WAL_RESET_FIX_VERSION,
      qualifiedSourceId: persistenceModule.QUALIFIED_SQLITE_SOURCE_ID,
    },
    snapshotMechanism: persistenceModule.SQLCIPHER_SNAPSHOT_MECHANISM,
  };
  if (Object.values(persistenceQualification).some((value) => value === undefined)) {
    throw new Error("source Core persistence module does not expose complete qualification metadata");
  }

  await mkdir(dirname(releaseRoot), { recursive: true });
  const temporaryRoot = await mkdtemp(join(dirname(releaseRoot), ".jarvis-core-runtime-"));
  try {
    await copyReleaseUnit({
      node: sourceNode,
      core: sourceCore,
      coreSupports: sourceCoreSupports,
      coreNodeModules,
      output: temporaryRoot,
    });
    const manifestResult = await generateRuntimeManifest({
      root: temporaryRoot,
      nodeVersion,
      jarvisReleaseVersion,
      coreVersion,
      sourceCommitSha,
      releaseSequence,
      securityEpoch,
      target,
      protocolVersion,
      minimumDataSchemaVersion,
      maximumDataSchemaVersion,
      persistenceQualification,
    });
    await copyTrustMetadata(tufMetadataDirectory, temporaryRoot);
    await rename(temporaryRoot, releaseRoot);
    return { manifest: manifestResult.manifest, releaseRoot };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  await validateReleaseSource({ sourceCommitSha: arguments_.sourceCommitSha });
  const result = await packageCoreRuntime(arguments_);
  console.log(`[core-runtime-package] wrote ${result.releaseRoot}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[core-runtime-package] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
