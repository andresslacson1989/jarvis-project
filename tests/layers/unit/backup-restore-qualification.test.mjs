import { strict as assert } from "node:assert";
import test from "node:test";
import { parseArguments } from "../../../tools/release/qualify-backup-restore.mjs";

test("backup restore qualification requires absolute candidate and external recovery-secret paths", () => {
  assert.deepEqual(
    parseArguments([
      "--release-root",
      "C:\\candidate",
      "--recovery-secret-file",
      "C:\\private\\recovery.bin",
      "--output",
      "C:\\evidence\\restore.json",
    ]),
    {
      releaseRoot: "C:\\candidate",
      recoverySecretFile: "C:\\private\\recovery.bin",
      output: "C:\\evidence\\restore.json",
    },
  );
  assert.throws(
    () => parseArguments(["--release-root", "candidate", "--recovery-secret-file", "C:\\private\\recovery.bin"]),
    /Usage:/u,
  );
  assert.throws(
    () => parseArguments(["--release-root", "C:\\candidate", "--recovery-secret-file", "C:\\private\\recovery.bin", "--output", "evidence.json"]),
    /--output must be absolute/u,
  );
  assert.throws(
    () => parseArguments(["--release-root", "C:\\candidate", "--recovery-secret-file", "C:\\private\\recovery.bin", "--recovery-secret-file", "C:\\other.bin"]),
    /duplicate argument: --recovery-secret-file/u,
  );
});
