import { readFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

export const CANONICAL_TEST_LAYER_IDS = Object.freeze([
  "unit",
  "property-state-machine",
  "schema-cross-language-contract",
  "platform-architecture-contracts",
  "provider-setup-contract-sandbox",
  "tool-contract",
  "integration-module-conformance",
  "integration-e2e",
  "ui-accessibility-adaptive",
  "safety-adversarial",
  "recovery-chaos",
  "persistence-backup-migration",
  "performance-resource",
  "voice-audio",
  "packaging-update-release",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function loadLayerManifest(rootDir) {
  const path = resolve(rootDir, "tests", "test-layers.json");
  const parsed = JSON.parse(await readFile(path, "utf8"));
  assert(parsed?.schemaVersion === 1, "test-layer manifest schemaVersion must be 1");
  assert(Array.isArray(parsed.layers), "test-layer manifest layers must be an array");
  assert(parsed.layers.length === CANONICAL_TEST_LAYER_IDS.length,
    `test-layer manifest must contain exactly ${CANONICAL_TEST_LAYER_IDS.length} layers`);

  const ids = parsed.layers.map((layer) => layer?.id);
  assert(new Set(ids).size === ids.length, "test-layer ids must be unique");
  assert(JSON.stringify(ids) === JSON.stringify(CANONICAL_TEST_LAYER_IDS),
    "test-layer ids/order must match the canonical Verification Contract taxonomy");

  for (const layer of parsed.layers) {
    assert(typeof layer.directory === "string", `layer ${layer.id} directory missing`);
    assert(layer.directory === `tests/layers/${layer.id}`,
      `layer ${layer.id} directory must be tests/layers/${layer.id}`);
    assert(typeof layer.normalChangeEligible === "boolean",
      `layer ${layer.id} normalChangeEligible must be boolean`);
    assert(typeof layer.phase0HarnessRequired === "boolean",
      `layer ${layer.id} phase0HarnessRequired must be boolean`);
    const absolute = resolve(rootDir, layer.directory);
    const rel = relative(resolve(rootDir, "tests", "layers"), absolute);
    assert(rel && !rel.startsWith("..") && !rel.includes(`${sep}..${sep}`),
      `layer ${layer.id} escapes tests/layers`);
  }

  return Object.freeze(parsed.layers.map((layer) => Object.freeze({ ...layer })));
}
