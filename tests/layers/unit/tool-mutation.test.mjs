import assert from "node:assert/strict";
import test from "node:test";
import { executeConditionalMutation, executeIdempotentMutation, validateIdempotencyRecord } from "../../../packages/protocol/src/tool-mutation-runtime.mjs";

const digest = "A".repeat(43);
const target = (versionToken = "v1") => ({ resolutionId: "resolution-1", resolvedAt: "2026-08-17T00:00:00.000Z", descriptorDigest: digest, targetIdentityDigest: digest, targets: [{ system: "filesystem", resourceType: "file", resourceId: "C:\\workspace\\file.txt", identityDigest: digest, versionToken }] });

test("conditional mutation uses identity/version CAS and never silently retargets", async () => {
  let calls = 0;
  const applied = await executeConditionalMutation(target(), target(), async () => { calls += 1; return { ok: true }; });
  assert.deepEqual([applied.state, applied.reasonCode, calls], ["APPLIED", "CONDITIONAL_MUTATION_APPLIED", 1]);
  const conflict = await executeConditionalMutation(target(), target("v2"), async () => { calls += 1; return { ok: true }; });
  assert.deepEqual([conflict.state, conflict.reasonCode, calls], ["CONFLICT", "TARGET_CHANGED", 1]);
  const uncertain = await executeConditionalMutation(target(), target(), async () => { throw new Error("ambiguous external effect"); });
  assert.deepEqual([uncertain.state, uncertain.reasonCode], ["UNCERTAIN", "CONDITIONAL_MUTATION_UNCERTAIN"]);
});

test("idempotent mutation replays durable results and rejects key reuse", async () => {
  const records = new Map();
  const store = {
    begin: async (key, requestDigest) => {
      const existing = records.get(key);
      if (existing === undefined) return { state: "NEW" };
      return { state: existing.requestDigest === requestDigest ? "REPLAY" : "CONFLICT", record: existing };
    },
    finish: async (key, requestDigest, record) => { records.set(key, { ...record, requestDigest }); },
  };
  let calls = 0;
  const first = await executeIdempotentMutation(store, "request-1", digest, async () => { calls += 1; return { value: "done" }; });
  const replay = await executeIdempotentMutation(store, "request-1", digest, async () => { calls += 1; return { value: "wrong" }; });
  const conflict = await executeIdempotentMutation(store, "request-1", "B".repeat(43), async () => { calls += 1; return { value: "wrong" }; });
  assert.deepEqual([first.state, replay.state, replay.value.value, conflict.state, calls], ["APPLIED", "APPLIED", "done", "CONFLICT", 1]);
});

test("uncertain outcomes are durable and idempotency records reject malformed state", () => {
  assert.deepEqual(validateIdempotencyRecord({ idempotencyKey: "request-1", requestDigest: digest, state: "UNCERTAIN" }).state, "UNCERTAIN");
  assert.throws(() => validateIdempotencyRecord({ idempotencyKey: "request-1", requestDigest: digest, state: "APPLIED", unsupported: true }), /unsupported/iu);
});

