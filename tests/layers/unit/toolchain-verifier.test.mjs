import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..", "..");

test("TypeScript verification launches the JS entrypoint through the pinned Node runtime", () => {
  const source = readFileSync(
    resolve(root, "tools", "toolchain", "verify-toolchain.mjs"),
    "utf8",
  );

  assert.doesNotMatch(source, /node_modules["', )\\/]+\.bin["', )\\/]+tsc(?:\.cmd)?/i);
  assert.doesNotMatch(source, /tsc\.cmd/i);
  assert.match(
    source,
    /resolve\(root,\s*"node_modules",\s*"typescript",\s*"bin",\s*"tsc"\)/,
  );
  assert.match(
    source,
    /runExact\(process\.execPath,\s*\[tscScript,\s*"--version"\]/,
  );
  assert.match(
    source,
    /function runPnpmVersion\(expected\)[\s\S]*process\.execPath[\s\S]*corepack[\s\S]*pnpm\.js/,
  );
});
