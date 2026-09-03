import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  validatePhase0Snapshot,
} from "../../../tools/checkpoints/phase0-checkpoint.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

async function loadPhase0Snapshot() {
  const profile = JSON.parse(
    await readFile(
      resolve(root, "tools/checkpoints/phase0-checkpoint-profile.json"),
      "utf8",
    ),
  );
  const [workflow, packageJson, canonicalValues, matrix] = await Promise.all([
    readFile(resolve(root, ".github/workflows/static-ci.yml"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8").then(JSON.parse),
    readFile(
      resolve(
        root,
        "packages/schemas/src/canonical/v1/jarvis-v1.0.7.contract-values.json",
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      resolve(root, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md"),
      "utf8",
    ),
  ]);
  const relevantPaths = new Set([
    ...(profile.requiredEvidencePaths ?? []),
    ...(profile.forbiddenActivePaths ?? []),
  ]);
  const existingPaths = new Set(
    [...relevantPaths].filter((path) => existsSync(resolve(root, path))),
  );

  return {
    profile,
    workflow,
    packageJson,
    canonicalValues,
    matrix,
    linuxSourcePaths: [],
    androidSourcePaths: [],
    existingPaths,
  };
}

test("native production Tauri qualification cannot move from Windows to Ubuntu", async () => {
  const snapshot = await loadPhase0Snapshot();
  assert.deepEqual(validatePhase0Snapshot(snapshot), []);

  const mutatedWorkflow = snapshot.workflow.replace(
    "  windows-tauri-build:\n    name: windows-tauri-build\n    runs-on: windows-2025",
    "  windows-tauri-build:\n    name: windows-tauri-build\n    runs-on: ubuntu-24.04",
  );
  assert.notEqual(mutatedWorkflow, snapshot.workflow);

  const codes = validatePhase0Snapshot({
    ...snapshot,
    workflow: mutatedWorkflow,
  }).map((item) => item.code);

  assert.ok(codes.includes("PHASE0_NATIVE_WINDOWS_JOB_MISSING"));
});
