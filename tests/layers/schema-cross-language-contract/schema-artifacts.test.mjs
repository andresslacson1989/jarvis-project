import test from "node:test";
import assert from "node:assert/strict";
import { validateDraft202012Schema } from "../../../tools/ci/check-schemas.mjs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function collectSchemas(current) {
  const results = [];
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const entry of entries) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) results.push(...await collectSchemas(path));
    else if (entry.isFile() && entry.name.endsWith(".schema.json")) results.push(path);
  }
  return results;
}

test("all repository JSON schema artifacts are valid Draft 2020-12 JSON", async () => {
  const paths = await collectSchemas(resolve(root, "packages", "schemas", "src"));
  assert.ok(paths.length > 0, "schema inventory must not be empty");
  for (const path of paths) {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    assert.equal(parsed.$schema, "https://json-schema.org/draft/2020-12/schema", path);
  }
});

test("a syntactically valid document with an invalid Draft 2020-12 schema shape is rejected", () => {
  const result = validateDraft202012Schema({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:test:invalid-schema-shape",
    type: 42,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});
