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
  await writeFile(join(root, "core", "package.json"), '{"type":"module"}\n');
  await writeFile(join(root, "core", "dist", "main.js"), "synthetic core");
  await writeFile(join(root, "core", "dist", "release-trust.js"), "synthetic trust module");
  await writeFile(join(root, "core", "dist", "ipc-bootstrap.js"), "synthetic IPC module");
  await writeFile(join(root, "core", "dist", "persistence.js"), "synthetic persistence module");
  await writeFile(join(root, "core", "dist", "schema.js"), "synthetic schema module");
  await writeFile(join(root, "core", "dist", "backup-descriptor.js"), "synthetic backup descriptor module");
  await writeFile(join(root, "core", "dist", "backup-manifest.js"), "synthetic backup manifest module");
  await writeFile(join(root, "core", "dist", "backup-chunks.js"), "synthetic backup chunks module");
  await writeFile(join(root, "core", "dist", "backup-recovery.js"), "synthetic backup recovery module");
  await writeFile(join(root, "core", "dist", "backup-package.js"), "synthetic backup package module");
  await writeFile(join(root, "core", "dist", "backup-payload.js"), "synthetic backup payload module");
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
    assert.equal(parsed.releaseDistributionScope, "PRIVATE_INTERNAL");
    assert.equal(parsed.publicDistributionSupported, false);
    assert.deepEqual(parsed.windowsSigning, {
      trustMode: "PRIVATE_INTERNAL_AUTHENTICODE",
      certificateThumbprint: "23DA4DA3E340B66EC4240B4CC845E4387E5BBDD3",
      authorizedTargetScope: "CURRENT_USER_ONLY",
      trustEnrollment: "CURRENT_USER_TRUSTEDPUBLISHER_AND_ROOT",
      timestampEvidence: "ABSENT_PUBLIC_TIMESTAMP_PRIVATE_INTERNAL",
    });
    assert.equal(parsed.tufSpecVersion, "1.0.35");
    assert.equal(parsed.coreSupportFiles.length, 11);
    assert.equal(parsed.coreSupportFiles[0].path, "core/package.json");
    assert.equal(parsed.coreSupportFiles[1].path, "core/dist/release-trust.js");
    assert.equal(parsed.coreSupportFiles[2].path, "core/dist/ipc-bootstrap.js");
    assert.equal(parsed.coreSupportFiles[3].path, "core/dist/persistence.js");
    assert.equal(parsed.coreSupportFiles[4].path, "core/dist/schema.js");
    assert.equal(parsed.coreSupportFiles[5].path, "core/dist/backup-descriptor.js");
    assert.equal(parsed.coreSupportFiles[6].path, "core/dist/backup-manifest.js");
    assert.equal(parsed.coreSupportFiles[7].path, "core/dist/backup-chunks.js");
    assert.equal(parsed.coreSupportFiles[8].path, "core/dist/backup-recovery.js");
    assert.equal(parsed.coreSupportFiles[9].path, "core/dist/backup-package.js");
    assert.equal(parsed.coreSupportFiles[10].path, "core/dist/backup-payload.js");
    assert.equal(parsed.target, "WINDOWS_FULL_HOST_X64");
    assert.equal(parsed.protocolVersion, 1);
    assert.equal(parsed.minimumDataSchemaVersion, 1);
    assert.equal(parsed.maximumDataSchemaVersion, 1);
    assert.equal(parsed.persistenceQualification.binding, "better-sqlite3-multiple-ciphers");
    assert.equal(parsed.persistenceQualification.bindingVersion, "12.11.1");
    assert.equal(parsed.persistenceQualification.cipher, "sqlcipher");
    assert.equal(parsed.persistenceQualification.cipherProfile, "sqlcipher-legacy-v4");
    assert.equal(parsed.persistenceQualification.sqliteVersion, "3.53.2");
    assert.equal(parsed.persistenceQualification.walResetFixEvidence.upstreamFixedSince, "3.51.3");
    assert.equal(parsed.persistenceQualification.snapshotMechanism, "attached-sqlcipher-schema-export-v1");
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
