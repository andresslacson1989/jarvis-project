import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const NODE_RELATIVE_PATH = "runtime/node.exe";
const CORE_RELATIVE_PATH = "core/dist/main.js";
const CORE_SUPPORT_RELATIVE_PATHS = [
  "core/package.json",
  "core/dist/release-trust.js",
  "core/dist/authority-canonical.js",
  "core/dist/ipc-bootstrap.js",
  "core/dist/persistence.js",
  "core/dist/schema.js",
  "core/dist/backup-descriptor.js",
  "core/dist/backup-manifest.js",
  "core/dist/backup-chunks.js",
  "core/dist/backup-recovery.js",
  "core/dist/backup-package.js",
  "core/dist/backup-payload.js",
  "core/dist/conversation.js",
  "core/dist/conversation.mjs",
  "core/dist/codex-cli-adapter.mjs",
  "core/dist/provider-execution.mjs",
  "core/dist/provider-execution.mts",
  "core/packages/protocol/src/provider-runtime.mjs",
  "core/packages/protocol/src/authority-runtime.mjs",
  "core/packages/protocol/src/state-machine-runtime.mjs",
  "core/packages/protocol/src/execution-scope-runtime.mjs",
  "core/packages/protocol/src/mission-graph-runtime.mjs",
  "core/packages/protocol/src/accounting-runtime.mjs",
  "core/packages/protocol/src/worker-runtime.mjs",
  "core/packages/protocol/src/worker-recovery-runtime.mjs",
  "core/packages/protocol/src/project-policy-runtime.mjs",
  "core/packages/protocol/src/project-runtime.mjs",
  "core/packages/protocol/src/update-trust-runtime.mjs",
  "core/packages/protocol/src/domain-event-runtime.mjs",
  "core/packages/protocol/src/config-runtime.mjs",
  "core/packages/protocol/src/memory-runtime.mjs",
  "core/packages/protocol/src/platform-runtime.mjs",
  "core/packages/protocol/src/session-runtime.mjs",
  "core/packages/protocol/src/security-audit-runtime.mjs",
  "core/packages/protocol/src/authority-canonical-runtime.mjs",
  "core/packages/protocol/src/conversation-runtime.mjs",
  "core/packages/protocol/src/conversation-runtime.mts",
  "core/packages/policy/src/project-policy-mutation.mjs",
  "core/packages/policy/src/pre-allow-gates.mjs",
];
const DEFAULT_OUTPUT = "runtime-manifest.json";
const DEFAULT_WINDOWS_SIGNING = Object.freeze({
  trustMode: "PRIVATE_INTERNAL_AUTHENTICODE",
  certificateThumbprint: "23DA4DA3E340B66EC4240B4CC845E4387E5BBDD3",
  authorizedTargetScope: "CURRENT_USER_ONLY",
  trustEnrollment: "CURRENT_USER_TRUSTEDPUBLISHER_AND_ROOT",
  timestampEvidence: "ABSENT_PUBLIC_TIMESTAMP_PRIVATE_INTERNAL",
});
const DEFAULT_PERSISTENCE_QUALIFICATION = Object.freeze({
  binding: "better-sqlite3-multiple-ciphers",
  bindingVersion: "12.11.1",
  cipher: "sqlcipher",
  cipherProfile: "sqlcipher-legacy-v4",
  sqliteVersion: "3.53.2",
  sqliteSourceId:
    "2026-06-03 19:12:13 d6e03d8c777cfa2d35e3b60d8ec3e0187f3e9f99d8e2ee9cac695fd6fcdf1a24",
  walResetFixEvidence: {
    upstreamFixedSince: "3.51.3",
    qualifiedSourceId:
      "2026-06-03 19:12:13 d6e03d8c777cfa2d35e3b60d8ec3e0187f3e9f99d8e2ee9cac695fd6fcdf1a24",
  },
  snapshotMechanism: "attached-sqlcipher-schema-export-v1",
});

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
  persistenceQualification = DEFAULT_PERSISTENCE_QUALIFICATION,
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
    !persistenceQualification ||
    typeof persistenceQualification !== "object" ||
    persistenceQualification.binding !== DEFAULT_PERSISTENCE_QUALIFICATION.binding ||
    persistenceQualification.bindingVersion !== DEFAULT_PERSISTENCE_QUALIFICATION.bindingVersion ||
    persistenceQualification.cipher !== DEFAULT_PERSISTENCE_QUALIFICATION.cipher ||
    persistenceQualification.cipherProfile !== DEFAULT_PERSISTENCE_QUALIFICATION.cipherProfile ||
    persistenceQualification.sqliteVersion !== DEFAULT_PERSISTENCE_QUALIFICATION.sqliteVersion ||
    persistenceQualification.sqliteSourceId !== DEFAULT_PERSISTENCE_QUALIFICATION.sqliteSourceId ||
    persistenceQualification.snapshotMechanism !== DEFAULT_PERSISTENCE_QUALIFICATION.snapshotMechanism ||
    persistenceQualification.walResetFixEvidence?.upstreamFixedSince !==
      DEFAULT_PERSISTENCE_QUALIFICATION.walResetFixEvidence.upstreamFixedSince ||
    persistenceQualification.walResetFixEvidence?.qualifiedSourceId !==
      DEFAULT_PERSISTENCE_QUALIFICATION.walResetFixEvidence.qualifiedSourceId
  ) {
    throw new Error("persistence qualification metadata does not match the release-qualified V1 identity");
  }
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
  const manifestPath = resolve(releaseRoot, output);
  ensureReleaseChild(releaseRoot, manifestPath, "manifest output");

  await requireRegularFile(nodePath, "release-owned node.exe");
  await requireRegularFile(corePath, "release-owned Core entrypoint");
  const coreSupportPaths = await Promise.all(
    CORE_SUPPORT_RELATIVE_PATHS.map(async (relativePath) => {
      const path = resolve(releaseRoot, relativePath);
      await requireRegularFile(path, `release-owned Core support module ${relativePath}`);
      return { relativePath, path };
    }),
  );

  const manifest = {
    manifestVersion: 1,
    jarvisReleaseVersion,
    coreVersion,
    sourceCommitSha: sourceCommitSha.toLowerCase(),
    releaseSequence,
    securityEpoch,
    releaseDistributionScope: "PRIVATE_INTERNAL",
    publicDistributionSupported: false,
    windowsSigning: DEFAULT_WINDOWS_SIGNING,
    tufSpecVersion: "1.0.35",
    target,
    protocolVersion,
    minimumDataSchemaVersion,
    maximumDataSchemaVersion,
    persistenceQualification,
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
    coreSupportFiles: await Promise.all(
      coreSupportPaths.map(async ({ relativePath, path }) => ({
        path: relativePath.replaceAll("\\", "/"),
        sha256: await sha256File(path),
      })),
    ),
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
