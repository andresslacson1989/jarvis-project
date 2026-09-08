import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManifest } from "../../../tools/ci/verify-tauri-generated-artifacts.mjs";

const manifest = JSON.parse(readFileSync("tools/ci/tauri-generated-artifacts.json", "utf8"));

test("generated-artifact manifest matches the independent canonical values", () => {
  assert.doesNotThrow(() => validateManifest(manifest, null));
});

test("generated-artifact root mutation is rejected", () => {
  const changed = structuredClone(manifest);
  changed.root = "apps/desktop/src-tauri/gen/other";
  assert.throws(() => validateManifest(changed, null), /manifest values/);
});

test("generated-artifact file-set mutations are rejected", () => {
  const added = structuredClone(manifest);
  added.files.extra = "a".repeat(64);
  assert.throws(() => validateManifest(added, null), /manifest values/);

  const removed = structuredClone(manifest);
  delete removed.files["windows-schema.json"];
  assert.throws(() => validateManifest(removed, null), /manifest values/);
});

test("generated-artifact digest mutations are rejected", () => {
  const changed = structuredClone(manifest);
  changed.files["desktop-schema.json"] = "b".repeat(64);
  assert.throws(() => validateManifest(changed, null), /manifest values/);
});
