import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

test("pinned toolchain verification accepts normalized Tauri dependency tables", () => {
  const output = execFileSync(
    process.execPath,
    [resolve(root, "tools/toolchain/verify-toolchain.mjs"), "--metadata-only"],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );
  assert.match(output, /metadata pins and lock coherence: PASS/);
});
