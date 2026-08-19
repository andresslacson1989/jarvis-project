import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { buildNodeTestArgs } from "../../../tools/test/test-runner-args.mjs";

const root = resolve("synthetic-root");
const preloadPath = resolve(root, "tests", "harness", "deny-network.mjs");
const testFile = resolve(root, "tests", "layers", "unit", "sample.test.mjs");

test("normal test runner passes the ESM preload as a file URL", () => {
  const args = buildNodeTestArgs({ preloadPath, testFile, normalProfile: true });

  assert.equal(args[0], "--import");
  assert.match(args[1], /^file:/);
  assert.equal(fileURLToPath(args[1]), preloadPath);
  assert.deepEqual(args.slice(2), ["--test", testFile]);
});

test("qualification test runner omits the normal-profile network preload", () => {
  assert.deepEqual(
    buildNodeTestArgs({ preloadPath, testFile, normalProfile: false }),
    ["--test", testFile],
  );
});
