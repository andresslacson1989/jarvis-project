import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateRuntimeManifest } from "../../../tools/release/generate-core-runtime-manifest.mjs";

const releaseIdentity = {
  sourceCommitSha: "a".repeat(40),
  releaseSequence: 1,
  securityEpoch: 1,
};

async function fixture() {
  const root = join(tmpdir(), `jarvis-runtime-${process.pid}-${Date.now()}`);
  await mkdir(join(root, "runtime"), { recursive: true });
  await mkdir(join(root, "core", "dist"), { recursive: true });
  await writeFile(join(root, "runtime", "node.exe"), "synthetic node");
  await writeFile(join(root, "core", "dist", "main.js"), "synthetic core");
  await writeFile(join(root, "core", "dist", "release-trust.js"), "synthetic trust module");
  return root;
}

test("runtime manifest generation is deterministic and hashes explicit release files", async () => {
  const root = await fixture();
  try {
    const result = await generateRuntimeManifest({
      root,
      nodeVersion: "24.18.0",
      jarvisReleaseVersion: "0.0.0",
      coreVersion: "0.0.0",
      ...releaseIdentity,
    });
    const parsed = JSON.parse(await readFile(result.manifestPath, "utf8"));
    assert.equal(parsed.platform, "WINDOWS");
    assert.equal(parsed.runtimeRole, "FULL_HOST");
    assert.equal(parsed.architecture, "x64");
    assert.equal(parsed.manifestVersion, 1);
    assert.equal(parsed.jarvisReleaseVersion, "0.0.0");
    assert.equal(parsed.coreVersion, "0.0.0");
    assert.equal(parsed.sourceCommitSha, releaseIdentity.sourceCommitSha);
    assert.equal(parsed.releaseSequence, releaseIdentity.releaseSequence);
    assert.equal(parsed.securityEpoch, releaseIdentity.securityEpoch);
    assert.equal(parsed.tufSpecVersion, "1.0.35");
    assert.equal(parsed.coreSupportFiles.length, 1);
    assert.equal(parsed.coreSupportFiles[0].path, "core/dist/release-trust.js");
    assert.equal(parsed.target, "WINDOWS_FULL_HOST_X64");
    assert.equal(parsed.protocolVersion, 1);
    assert.equal(parsed.minimumDataSchemaVersion, 1);
    assert.equal(parsed.maximumDataSchemaVersion, 1);
    assert.equal(parsed.nodePath, "runtime/node.exe");
    assert.equal(parsed.coreEntrypoint, "core/dist/main.js");
    assert.equal(
      parsed.nodeSha256,
      createHash("sha256").update("synthetic node").digest("hex"),
    );
    assert.equal(
      parsed.coreSha256,
      createHash("sha256").update("synthetic core").digest("hex"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime manifest generation fails closed for missing files and outside output", async () => {
  const root = await fixture();
  try {
    await assert.rejects(
      generateRuntimeManifest({
        root,
        nodeVersion: "24.18.0",
        jarvisReleaseVersion: "0.0.0",
        coreVersion: "0.0.0",
        ...releaseIdentity,
        output: "../manifest.json",
      }),
      /manifest output must remain inside the release root/,
    );
    await rm(join(root, "runtime", "node.exe"));
    await assert.rejects(
      generateRuntimeManifest({
        root,
        nodeVersion: "24.18.0",
        jarvisReleaseVersion: "0.0.0",
        coreVersion: "0.0.0",
        ...releaseIdentity,
      }),
      /release-owned node\.exe is missing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime manifest CLI argument parsing rejects unknown options", async () => {
  const root = await fixture();
  try {
    await assert.rejects(
      generateRuntimeManifest({
        root,
        nodeVersion: "24.18.0",
      jarvisReleaseVersion: "0.0.0",
      coreVersion: "0.0.0",
      ...releaseIdentity,
        unknown: "rejected",
      }),
      /unknown option/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
