import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("platform selection stays in the composition root and Linux remains non-runtime", async () => {
  const rootComposition = await readFile(resolve(root, "platform", "composition.ts"), "utf8");
  const contractComposition = await readFile(
    resolve(root, "packages", "platform-contracts", "src", "composition.ts"),
    "utf8",
  );
  const linuxMarker = await readFile(resolve(root, "platform", "linux", "src", "README.md"), "utf8");

  assert.match(rootComposition, /composePlatformBackend/);
  assert.doesNotMatch(contractComposition, /platform\/windows|Win32|process\.platform/i);
  assert.doesNotMatch(rootComposition, /process\.platform|DPAPI|Job Object|named pipe/i);
  assert.match(linuxMarker, /no V1 runtime/i);
});
