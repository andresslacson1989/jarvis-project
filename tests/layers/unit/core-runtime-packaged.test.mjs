import { strict as assert } from "node:assert";
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
    const preview = join(root, "preview");
    const sourceCommitSha = "b".repeat(40);
    await writeFile(node, syntheticX64Pe());
    await mkdir(join(preview, "runtime"), { recursive: true });
    await mkdir(join(preview, "core", "dist"), { recursive: true });
    await copyFile(node, join(preview, "runtime", "node.exe"));
    await copyFile(core, join(preview, "core", "dist", "main.js"));
    await copyFile(support, join(preview, "core", "dist", "release-trust.js"));
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
    assert.equal(packagedDependencies.includes("@tufjs"), true);
    const packagedCore = await import(pathToFileURL(join(output, "core", "dist", "main.js")).href);
    const environment = await packagedCore.validateCoreEnvironment({
      JARVIS_CORE_ROOT: output,
      JARVIS_CORE_ENTRYPOINT: join(output, "core", "dist", "main.js"),
      JARVIS_TUF_METADATA_DIR: join(output, "tuf", "metadata"),
    });
    assert.equal(environment.releaseTrust.tufProfileVersion, "1.0.35");
    assert.equal(environment.releaseTrust.releaseSequence, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
