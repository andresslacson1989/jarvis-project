import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadSyntheticJsonFixture } from "../../harness/fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("normal-change harness denies network primitives", () => {
  assert.throws(() => globalThis.fetch("https://example.invalid"), /network access is denied/);
});

test("normal-change harness does not inherit common credential environment variables", () => {
  assert.equal(process.env.GITHUB_TOKEN, undefined);
  assert.equal(process.env.AWS_SECRET_ACCESS_KEY, undefined);
});

test("synthetic fixture loader verifies provenance, path, size, and sha256", async () => {
  const value = await loadSyntheticJsonFixture(root, "foundation-json");
  assert.equal(value.value, "JARVIS_TEST_ONLY");
});

test("fixture integrity drift fails closed", async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "jarvis-fixture-"));
  const fixtures = resolve(tempRoot, "tests", "fixtures");
  await mkdir(resolve(fixtures, "data"), { recursive: true });
  const bytes = Buffer.from('{"safe":true}\n');
  await writeFile(resolve(fixtures, "data", "fixture.json"), bytes);
  const wrong = createHash("sha256").update(Buffer.from("different")).digest("hex");
  await writeFile(resolve(fixtures, "manifest.json"), JSON.stringify({
    schemaVersion: 1,
    fixtures: [{
      id: "tampered",
      path: "data/fixture.json",
      mediaType: "application/json",
      provenance: "SYNTHETIC",
      containsRealCredentials: false,
      sha256: wrong,
    }],
  }));
  await assert.rejects(
    () => loadSyntheticJsonFixture(tempRoot, "tampered"),
    /integrity mismatch/,
  );
});
