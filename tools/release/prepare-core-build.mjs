import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const generatedEntrypoint = resolve(projectRoot, ".artifacts/core-build/services/core/src/main.js");
const outputDirectory = resolve(projectRoot, "services/core/dist");
const outputEntrypoint = resolve(outputDirectory, "main.js");
const generatedTrustModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/release-trust.js",
);
const outputTrustModule = resolve(outputDirectory, "release-trust.js");
const generatedIpcModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/ipc-bootstrap.js",
);
const outputIpcModule = resolve(outputDirectory, "ipc-bootstrap.js");
const generatedPersistenceModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/persistence.js",
);
const outputPersistenceModule = resolve(outputDirectory, "persistence.js");
const generatedSchemaModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/schema.js",
);
const outputSchemaModule = resolve(outputDirectory, "schema.js");
const generatedBackupDescriptorModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/backup-descriptor.js",
);
const outputBackupDescriptorModule = resolve(outputDirectory, "backup-descriptor.js");
const generatedBackupManifestModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/backup-manifest.js",
);
const outputBackupManifestModule = resolve(outputDirectory, "backup-manifest.js");
const generatedBackupChunksModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/backup-chunks.js",
);
const outputBackupChunksModule = resolve(outputDirectory, "backup-chunks.js");
const generatedBackupRecoveryModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/backup-recovery.js",
);
const outputBackupRecoveryModule = resolve(outputDirectory, "backup-recovery.js");
const generatedBackupPackageModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/backup-package.js",
);
const outputBackupPackageModule = resolve(outputDirectory, "backup-package.js");
const generatedBackupPayloadModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/backup-payload.js",
);
const outputBackupPayloadModule = resolve(outputDirectory, "backup-payload.js");

async function main() {
  const information = await stat(generatedEntrypoint).catch(() => null);
  if (!information?.isFile()) {
    throw new Error("compiled Core entrypoint is missing from the generated build graph");
  }
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await copyFile(generatedEntrypoint, outputEntrypoint);
  await copyFile(generatedTrustModule, outputTrustModule);
  await copyFile(generatedIpcModule, outputIpcModule);
  await copyFile(generatedPersistenceModule, outputPersistenceModule);
  await copyFile(generatedSchemaModule, outputSchemaModule);
  await copyFile(generatedBackupDescriptorModule, outputBackupDescriptorModule);
  await copyFile(generatedBackupManifestModule, outputBackupManifestModule);
  await copyFile(generatedBackupChunksModule, outputBackupChunksModule);
  await copyFile(generatedBackupRecoveryModule, outputBackupRecoveryModule);
  await copyFile(generatedBackupPackageModule, outputBackupPackageModule);
  await copyFile(generatedBackupPayloadModule, outputBackupPayloadModule);
  console.log(`[core-build] wrote ${outputEntrypoint}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[core-build] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
