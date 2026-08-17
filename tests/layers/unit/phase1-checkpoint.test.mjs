import { strict as assert } from "node:assert";
import test from "node:test";
import {
  loadPhase1Snapshot,
  validatePhase1Snapshot,
} from "../../../tools/checkpoints/phase1-checkpoint.mjs";

test("Section 1 checkpoint accepts the verified Windows foundation snapshot", async () => {
  const violations = await validatePhase1Snapshot(await loadPhase1Snapshot());
  assert.deepEqual(violations, []);
});

test("Section 1 checkpoint rejects an unverified child row", async () => {
  const snapshot = await loadPhase1Snapshot();
  const mutated = {
    ...snapshot,
    matrix: snapshot.matrix.replace(
      /^(\| ↳ \*\*1\.14\*\*[^\n]*\| \*\*)VERIFIED(\*\* \|)/m,
      "$1IMPLEMENTED$2",
    ),
  };
  const violations = await validatePhase1Snapshot(mutated);
  assert.ok(violations.some(({ code }) => code === "PHASE1_CHILD_NOT_VERIFIED"));
});

test("Section 1 checkpoint rejects a runtime identity drift", async () => {
  const snapshot = await loadPhase1Snapshot();
  const mutated = {
    ...snapshot,
    coreRuntimeManifest: { ...snapshot.coreRuntimeManifest, nodeVersion: "0.0.0" },
  };
  const violations = await validatePhase1Snapshot(mutated);
  assert.ok(violations.some(({ code }) => code === "PHASE1_RUNTIME_IDENTITY"));
});
