import { strict as assert } from "node:assert";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { packageCoreRuntime } from "../../../tools/release/package-core-runtime.mjs";
import { generateRuntimeManifest } from "../../../tools/release/generate-core-runtime-manifest.mjs";
import { writeTufReleaseMetadata } from "../../helpers/tuf-release-fixture.mjs";

function syntheticX64Pe() {
  const image = Buffer.alloc(128);
  image.write("MZ", 0, "ascii");
  image.writeUInt32LE(0x40, 0x3c);
  image.write("PE\0\0", 0x40, "ascii");
  image.writeUInt16LE(0x8664, 0x44);
  return image;
}

test("Core runtime packaging creates one deterministic release-owned unit", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-core-package-"));
  try {
    const node = join(root, "node.exe");
    const core = join(root, "main.js");
    const coreSupport = join(root, "release-trust.js");
    const output = join(root, "release");
    await writeFile(node, syntheticX64Pe());
    await writeFile(core, "export const coreProtocolMajor = 1;\n");
    await writeFile(coreSupport, "export const trustProfile = '1.0.35';\n");
    const sourceCommitSha = "a".repeat(40);
    const preview = join(root, "preview");
    await mkdir(join(preview, "runtime"), { recursive: true });
    await mkdir(join(preview, "core", "dist"), { recursive: true });
    await copyFile(node, join(preview, "runtime", "node.exe"));
    await copyFile(core, join(preview, "core", "dist", "main.js"));
    await copyFile(coreSupport, join(preview, "core", "dist", "release-trust.js"));
    const previewManifest = await generateRuntimeManifest({
      root: preview,
      nodeVersion: "24.18.0",
      jarvisReleaseVersion: "0.0.0",
      coreVersion: "0.0.0",
      sourceCommitSha,
      releaseSequence: 1,
      securityEpoch: 1,
    });
    const previewManifestBytes = await readFile(previewManifest.manifestPath);
    const tufMetadataDirectory = join(root, "tuf-input");
    const coreNodeModules = join(root, "core-node-modules");
    await mkdir(coreNodeModules);
    await writeTufReleaseMetadata({
      metadataDirectory: tufMetadataDirectory,
      targetBytes: previewManifestBytes,
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

    const result = await packageCoreRuntime({
      node,
      core,
      output,
      jarvisReleaseVersion: "0.0.0",
      coreVersion: "0.0.0",
      sourceCommitSha,
      releaseSequence: 1,
      securityEpoch: 1,
      tufMetadataDirectory,
      coreNodeModules,
    });
    assert.equal(result.manifest.platform, "WINDOWS");
    assert.equal(result.manifest.runtimeRole, "FULL_HOST");
    assert.equal(result.manifest.architecture, "x64");
    assert.equal(result.manifest.nodeVersion, "24.18.0");
    assert.equal(result.manifest.target, "WINDOWS_FULL_HOST_X64");
    assert.equal(await readFile(join(output, "core", "dist", "main.js"), "utf8"), "export const coreProtocolMajor = 1;\n");
    assert.equal((await stat(join(output, "runtime", "node.exe"))).isFile(), true);
    assert.equal((await stat(join(output, "runtime-manifest.json"))).isFile(), true);
    assert.equal((await stat(join(output, "tuf", "metadata", "root.json"))).isFile(), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Core runtime packaging refuses overwrite and cleans failed staging", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-core-package-"));
  try {
    const node = join(root, "node.exe");
    const core = join(root, "main.js");
    const existingOutput = join(root, "existing");
    const failedOutput = join(root, "failed");
    await writeFile(node, syntheticX64Pe());
    await writeFile(core, "export const coreProtocolMajor = 1;\n");
    await mkdir(existingOutput);
    await writeFile(join(root, "sentinel.txt"), "do not overwrite");
    await assert.rejects(
      packageCoreRuntime({
        node,
        core,
        output: existingOutput,
        jarvisReleaseVersion: "0.0.0",
        coreVersion: "0.0.0",
      }),
      /release output root already exists/,
    );

    await rm(core);
    await assert.rejects(
      packageCoreRuntime({
        node,
        core,
        output: failedOutput,
        jarvisReleaseVersion: "0.0.0",
        coreVersion: "0.0.0",
      }),
      /source Core entrypoint is missing/,
    );
    await assert.rejects(stat(failedOutput), { code: "ENOENT" });
    assert.equal(await readFile(join(root, "sentinel.txt"), "utf8"), "do not overwrite");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Core runtime packaging rejects non-x64 or non-PE node executables", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-core-package-"));
  try {
    const node = join(root, "node.exe");
    const core = join(root, "main.js");
    await writeFile(node, "not an executable");
    await writeFile(core, "export const coreProtocolMajor = 1;\n");
    await assert.rejects(
      packageCoreRuntime({
        node,
        core,
        output: join(root, "release"),
        jarvisReleaseVersion: "0.0.0",
        coreVersion: "0.0.0",
      }),
      /Windows PE executable|DOS header is truncated/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
