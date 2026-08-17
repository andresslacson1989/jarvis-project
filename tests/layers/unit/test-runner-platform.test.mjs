import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..", "..");

test("test runner passes platform-safe relative paths to Node test workers", () => {
  const runner = readFileSync(resolve(root, "tools", "test", "run-tests.mjs"), "utf8");
  assert.match(runner, /--import\", \"\.\/tests\/harness\/deny-network\.mjs\"/);
  assert.match(runner, /relative\(root, path\)/);
  assert.match(runner, /args\.push\("--test", `\.\/\$\{relativeTestPath\}`\)/);
});
