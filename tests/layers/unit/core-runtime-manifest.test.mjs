import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateRuntimeManifest } from "../../../tools/release/generate-core-runtime-manifest.mjs";

async function fixture() {
  const root = join(tmpdir(), `jarvis-runtime-${process.pid}-${Date.now()}`);
  await mkdir(join(root, "runtime"), { recursive: true });
  await mkdir(join(root, "core", "dist"), { recursive: true });
  await writeFile(join(root, "runtime", "node.exe"), "synthetic node");
  await writeFile(join(root, "core", "dist", "main.js"), "synthetic core");
  return root;
}

test("runtime manifest generation is deterministic and hashes explicit release files", async () => {
  const root = await fixture();
  try {
    const result = await generateRuntimeManifest({ root, nodeVersion: "24.18.0" });
    const parsed = JSON.parse(await readFile(result.manifestPath, "utf8"));
    assert.equal(parsed.platform, "WINDOWS");
    assert.equal(parsed.runtimeRole, "FULL_HOST");
    assert.equal(parsed.architecture, "x64");
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
      generateRuntimeManifest({ root, nodeVersion: "24.18.0", output: "../manifest.json" }),
      /manifest output must remain inside the release root/,
    );
    await rm(join(root, "runtime", "node.exe"));
    await assert.rejects(
      generateRuntimeManifest({ root, nodeVersion: "24.18.0" }),
      /release-owned node\.exe is missing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
