import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateRuntimeManifest } from "../../../tools/release/generate-core-runtime-manifest.mjs";
import { packageCoreRuntime } from "../../../tools/release/package-core-runtime.mjs";
import { writeTufReleaseMetadata } from "../../helpers/tuf-release-fixture.mjs";

function syntheticX64Pe() {
  const image = Buffer.alloc(128);
  image.write("MZ", 0, "ascii");
  image.writeUInt32LE(0x40, 0x3c);
  image.write("PE\0\0", 0x40, "ascii");
  image.writeUInt16LE(0x8664, 0x44);
  return image;
}

test("packaged Core resolves its release-owned TUF verifier and dependencies", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-packaged-core-"));
  try {
    const node = join(root, "node.exe");
    const core = resolve("services/core/dist/main.js");
    const support = resolve("services/core/dist/release-trust.js");
    const ipcSupport = resolve("services/core/dist/ipc-bootstrap.js");
    const persistenceSupport = resolve("services/core/dist/persistence.js");
    const schemaSupport = resolve("services/core/dist/schema.js");
    const backupDescriptorSupport = resolve("services/core/dist/backup-descriptor.js");
    const backupManifestSupport = resolve("services/core/dist/backup-manifest.js");
    const backupChunksSupport = resolve("services/core/dist/backup-chunks.js");
    const backupRecoverySupport = resolve("services/core/dist/backup-recovery.js");
    const backupPackageSupport = resolve("services/core/dist/backup-package.js");
    const backupPayloadSupport = resolve("services/core/dist/backup-payload.js");
    const preview = join(root, "preview");
    const sourceCommitSha = "b".repeat(40);
    await writeFile(node, syntheticX64Pe());
    await mkdir(join(preview, "runtime"), { recursive: true });
    await mkdir(join(preview, "core", "dist"), { recursive: true });
    await writeFile(join(preview, "core", "package.json"), '{"type":"module"}\n');
    await copyFile(node, join(preview, "runtime", "node.exe"));
    await copyFile(core, join(preview, "core", "dist", "main.js"));
    await copyFile(support, join(preview, "core", "dist", "release-trust.js"));
    await copyFile(ipcSupport, join(preview, "core", "dist", "ipc-bootstrap.js"));
    await copyFile(persistenceSupport, join(preview, "core", "dist", "persistence.js"));
    await copyFile(schemaSupport, join(preview, "core", "dist", "schema.js"));
    await copyFile(backupDescriptorSupport, join(preview, "core", "dist", "backup-descriptor.js"));
    await copyFile(backupManifestSupport, join(preview, "core", "dist", "backup-manifest.js"));
    await copyFile(backupChunksSupport, join(preview, "core", "dist", "backup-chunks.js"));
    await copyFile(backupRecoverySupport, join(preview, "core", "dist", "backup-recovery.js"));
    await copyFile(backupPackageSupport, join(preview, "core", "dist", "backup-package.js"));
    await copyFile(backupPayloadSupport, join(preview, "core", "dist", "backup-payload.js"));
    const previewManifest = await generateRuntimeManifest({
      root: preview,
      nodeVersion: "24.18.0",
      jarvisReleaseVersion: "0.0.0",
      coreVersion: "0.0.0",
      sourceCommitSha,
      releaseSequence: 1,
      securityEpoch: 1,
    });
    const metadata = join(root, "metadata");
    await writeTufReleaseMetadata({
      metadataDirectory: metadata,
      targetBytes: await readFile(previewManifest.manifestPath),
      custom: {
        tufSpecVersion: "1.0.35",
        releaseId: "0.0.0",
        jarvisVersion: "0.0.0",
        releaseSequence: 1,
        securityEpoch: 1,
        sourceCommitSha,
        platform: "WINDOWS",
        runtimeRole: "FULL_HOST",
        architecture: "x64",
      },
    });
    const output = join(root, "release");
    await packageCoreRuntime({
      node,
      core,
      output,
      jarvisReleaseVersion: "0.0.0",
      coreVersion: "0.0.0",
      sourceCommitSha,
      releaseSequence: 1,
      securityEpoch: 1,
      tufMetadataDirectory: metadata,
      coreNodeModules: resolve("services/core/node_modules"),
    });

    const packagedDependencies = await readdir(join(output, "core", "node_modules"));
    assert.equal(packagedDependencies.includes("tuf-js"), true);
    assert.equal(packagedDependencies.includes("better-sqlite3-multiple-ciphers"), true);
    assert.equal(packagedDependencies.includes("prebuild-install"), false);
    assert.equal(packagedDependencies.includes("@tufjs"), true);
    const packagedCore = await import(pathToFileURL(join(output, "core", "dist", "main.js")).href);
    const environment = await packagedCore.validateCoreEnvironment({
      JARVIS_CORE_ROOT: output,
      JARVIS_CORE_ENTRYPOINT: join(output, "core", "dist", "main.js"),
      JARVIS_TUF_METADATA_DIR: join(output, "tuf", "metadata"),
    });
    assert.equal(environment.releaseTrust.tufProfileVersion, "1.0.35");
    assert.equal(environment.releaseTrust.releaseSequence, 1);

    const childScript = `
      import { join } from "node:path";
      import { pathToFileURL } from "node:url";

      const packagedRoot = process.env.JARVIS_PACKAGED_ROOT;
      try {
        const packagedPersistence = await import(
          pathToFileURL(join(packagedRoot, "core", "dist", "persistence.js")).href
        );
        const packagedSchema = await import(
          pathToFileURL(join(packagedRoot, "core", "dist", "schema.js")).href
        );
        const packagedBackupDescriptor = await import(
          pathToFileURL(join(packagedRoot, "core", "dist", "backup-descriptor.js")).href
        );
        await import(pathToFileURL(join(packagedRoot, "core", "dist", "backup-manifest.js")).href);
        await import(pathToFileURL(join(packagedRoot, "core", "dist", "backup-chunks.js")).href);
        await import(pathToFileURL(join(packagedRoot, "core", "dist", "backup-recovery.js")).href);
        const packagedBackupPackage = await import(
          pathToFileURL(join(packagedRoot, "core", "dist", "backup-package.js")).href
        );
        const packagedBackupPayload = await import(
          pathToFileURL(join(packagedRoot, "core", "dist", "backup-payload.js")).href
        );
        if (typeof packagedBackupPackage.verifyAuthenticatedBackupPackage !== "function") {
          throw new Error("packaged Core did not include authenticated backup package verification");
        }
        if (typeof packagedBackupPayload.parseAuthenticatedBackupPayload !== "function") {
          throw new Error("packaged Core did not include the authenticated payload parser");
        }
        if (typeof packagedBackupDescriptor.parseBackupDescriptor !== "function") {
          throw new Error("packaged Core did not include the backup descriptor parser");
        }
        const connection = packagedPersistence.openCoreDatabase(join(packagedRoot, "packaged-state.db"), {
          dbDek: Buffer.alloc(32, 0x42),
        });
        try {
          packagedSchema.applyCoreMigrations(connection, () => "2026-08-14T00:00:00.000Z");
          connection.verifyIntegrity();
          if (connection.identity.cipher !== "sqlcipher") {
            throw new Error("packaged Core did not use SQLCipher");
          }
          const snapshotKey = Buffer.alloc(32, 0x43);
          const snapshotPath = join(packagedRoot, "packaged-snapshot.db");
          const snapshotResult = await packagedPersistence.exportSqlcipherSnapshot(
            connection,
            snapshotPath,
            snapshotKey,
          );
          if (snapshotResult.mechanism !== "attached-sqlcipher-schema-export-v1") {
            throw new Error("packaged Core did not use the qualified SQLCipher snapshot mechanism");
          }
          const snapshot = packagedPersistence.openSqlcipherSnapshot(snapshotPath, snapshotKey);
          snapshot.verifyIntegrity();
          snapshot.close();
        } finally {
          connection.close();
        }
      } catch (error) {
        console.error(error?.stack ?? error);
        process.exitCode = 1;
      }
    `;
    const child = spawn(process.execPath, ["--input-type=module", "-e", childScript], {
      env: { ...process.env, JARVIS_PACKAGED_ROOT: output },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let childError = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      childError += chunk;
    });
    const childExitCode = await new Promise((resolveExit, rejectExit) => {
      child.once("error", rejectExit);
      child.once("exit", (code, signal) => {
        if (signal) {
          rejectExit(new Error(`packaged persistence child terminated by ${signal}`));
        } else {
          resolveExit(code);
        }
      });
    });
    assert.equal(childExitCode, 0, childError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
