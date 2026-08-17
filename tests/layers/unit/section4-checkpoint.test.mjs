import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import test from "node:test";

const matrixPath = new URL("../../../docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md", import.meta.url);

test("Section 4 checkpoint requires every authoritative-state child and the parent checkpoint to be VERIFIED", async () => {
  const matrix = await readFile(matrixPath, "utf8");
  for (let index = 1; index <= 16; index += 1) {
    assert.match(matrix, new RegExp(`\\| ↳ \\*\\*4\\.${index}\\*\\*[^\\n]*\\| \\*\\*VERIFIED\\*\\* \\|`), `4.${index} is not VERIFIED`);
  }
  assert.match(matrix, /\| \*\*SECTION 4 — Authoritative State \/ Events\*\* \| \*\*VERIFIED\*\* \|/);
  assert.match(matrix, /\| ↳ \*\*4\.CP\*\*[^\n]*\| \*\*VERIFIED\*\* \|/);
});
