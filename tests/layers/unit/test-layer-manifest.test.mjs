import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  CANONICAL_TEST_LAYER_IDS,
  loadLayerManifest,
} from "../../harness/layers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("test-layer manifest contains the exact 15-layer taxonomy once", async () => {
  const layers = await loadLayerManifest(root);
  assert.deepEqual(layers.map((layer) => layer.id), [...CANONICAL_TEST_LAYER_IDS]);
  assert.equal(new Set(layers.map((layer) => layer.id)).size, 15);
});
