import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
}

test("Section 1.1 requires a real Tauri host and Vite production renderer", async () => {
  const cargoPath = resolve(root, "apps", "desktop", "src-tauri", "Cargo.toml");
  const configPath = resolve(root, "apps", "desktop", "src-tauri", "tauri.conf.json");
  assert.equal(existsSync(cargoPath), true, "apps/desktop/src-tauri/Cargo.toml must exist");
  assert.equal(existsSync(configPath), true, "apps/desktop/src-tauri/tauri.conf.json must exist");

  const desktop = await readJson("apps/desktop/package.json");
  assert.match(desktop.scripts?.["build:web"] ?? "", /vite build/, "build:web must produce a Vite production bundle");

  const tauriConfig = await readJson("apps/desktop/src-tauri/tauri.conf.json");
  assert.equal(tauriConfig.build?.frontendDist, "../dist", "production frontendDist must be the bundled local renderer output");
});
