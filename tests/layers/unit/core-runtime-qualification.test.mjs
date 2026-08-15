import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  parseArguments,
  qualifyPackagedCore,
  V1_NODE_VERSION,
} from "../../../tools/release/qualify-core-runtime.mjs";

test("packaged-Core qualification requires an absolute release root and bounded timeouts", () => {
  assert.throws(() => parseArguments([]), /Usage:/);
  assert.throws(() => parseArguments(["--release-root", "relative"]), /Usage:/);
  assert.throws(
    () => parseArguments(["--release-root", "C:\\release", "--startup-timeout-ms", "0"]),
    /between 1 and 10000 milliseconds/,
  );
  assert.throws(
    () => parseArguments(["--release-root", "C:\\release", "--unknown", "value"]),
    /unknown argument/,
  );
  assert.equal(
    parseArguments(["--release-root", "C:\\release", "--production-tuf-profile"])
      .requireProductionTufProfile,
    true,
  );
  assert.throws(
    () => parseArguments(["--release-root", "C:\\release", "--production-tuf-profile", "true"]),
    /unexpected argument: true/,
  );
  assert.equal(V1_NODE_VERSION, "24.18.0");
});
test("packaged-Core qualification fails closed for a missing release root", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-core-qualification-"));
  try {
    await assert.rejects(
      qualifyPackagedCore({ releaseRoot: join(root, "missing") }),
      /release root is missing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
