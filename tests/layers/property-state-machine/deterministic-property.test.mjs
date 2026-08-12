import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeterministicRng,
  runDeterministicProperty,
} from "../../harness/property.mjs";

test("same seed produces the same property sequence", () => {
  const left = createDeterministicRng(0x12345678);
  const right = createDeterministicRng(0x12345678);
  assert.deepEqual(
    Array.from({ length: 32 }, () => left()),
    Array.from({ length: 32 }, () => right()),
  );
});

test("property failure reports reproducible seed and case without rerun", () => {
  assert.throws(
    () => runDeterministicProperty({
      seed: 7,
      cases: 10,
      generate: (_rng, index) => index,
      check: (value) => value < 3,
    }),
    /seed=7 case=3/,
  );
});
