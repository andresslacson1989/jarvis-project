import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { isMain } from "./lib.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("./tauri-generated-artifacts.json", import.meta.url), "utf8"),
);

function fail(message) {
  throw new Error(`Tauri generated-artifact verification failed: ${message}`);
}

function requireManifest() {
  if (manifest.schemaVersion !== 1 || typeof manifest.root !== "string" || manifest.root.length === 0) {
    fail("generated-artifact manifest is malformed");
  }
  if (manifest.files === null || typeof manifest.files !== "object" || Array.isArray(manifest.files)) {
    fail("generated-artifact manifest files must be an object");
  }
  const names = Object.keys(manifest.files);
  if (names.length === 0 || names.some((name) => !/^[A-Za-z0-9._-]+\.json$/.test(name))) {
    fail("generated-artifact manifest contains an invalid file name");
  }
  for (const [name, digest] of Object.entries(manifest.files)) {
    if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) {
      fail(`generated-artifact digest is invalid for ${name}`);
    }
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verify() {
  requireManifest();
  const root = resolve(manifest.root);
  let actual;
  try {
    actual = readdirSync(root, { withFileTypes: true });
  } catch (error) {
    fail(`generated-artifact directory is unavailable: ${error.message}`);
  }

  const actualFiles = actual.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  const expectedFiles = Object.keys(manifest.files).sort();
  if (actual.some((entry) => !entry.isFile()) || actualFiles.length !== expectedFiles.length ||
      actualFiles.some((name, index) => name !== expectedFiles[index])) {
    fail(`generated-artifact file set differs; expected ${expectedFiles.join(",")}, observed ${actualFiles.join(",")}`);
  }

  for (const name of expectedFiles) {
    const actualDigest = sha256(resolve(root, name));
    if (actualDigest !== manifest.files[name]) {
      fail(`generated-artifact digest mismatch for ${name}`);
    }
  }

  const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    encoding: "utf8",
  }).trim();
  if (status.length > 0) {
    fail(`worktree is dirty after the approved build outputs were validated: ${status}`);
  }
  console.log(`[tauri-generated-artifacts] PASS files=${expectedFiles.length} worktreeClean=true`);
}

if (isMain(import.meta.url)) {
  try {
    verify();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export { verify };
