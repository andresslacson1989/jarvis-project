import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { isMain } from "./lib.mjs";

const manifestText = readFileSync(new URL("./tauri-generated-artifacts.json", import.meta.url), "utf8");
const manifest = JSON.parse(manifestText);
const EXPECTED_MANIFEST_SHA256 = "14ad311646e2bd99e02fb36220279a02828c828d17a046b32fb69847175bedd7";
const EXPECTED_MANIFEST = {
  schemaVersion: 1,
  root: "apps/desktop/src-tauri/gen/schemas",
  files: {
    "acl-manifests.json": "4d93885b464518dae2a2ed75ec63efc2c9d5a8991f51c26e6764dcb4264623c5",
    "capabilities.json": "29eb267745a510845c1334f9ef0e342d5e85294a5ee22ab83f7c2902b6f67222",
    "desktop-schema.json": "623c82e1cf0b1093b61b4b0900f8e2f06fbef272b8e5c24cc90dde35b063da97",
    "windows-schema.json": "623c82e1cf0b1093b61b4b0900f8e2f06fbef272b8e5c24cc90dde35b063da97",
  },
};

function fail(message) {
  throw new Error(`Tauri generated-artifact verification failed: ${message}`);
}

export function validateManifest(value = manifest, rawText = manifestText) {
  if (rawText !== null && createHash("sha256").update(rawText, "utf8").digest("hex") !== EXPECTED_MANIFEST_SHA256) {
    fail("generated-artifact manifest content digest does not match the approved manifest");
  }
  if (JSON.stringify(value) !== JSON.stringify(EXPECTED_MANIFEST)) {
    fail("generated-artifact manifest values do not match the approved manifest");
  }
}

function requireManifest() {
  validateManifest();
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
