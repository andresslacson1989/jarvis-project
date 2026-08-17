import { strict as assert } from "node:assert";
import test from "node:test";
import { ProviderExecutionController, nativeProviderProcessRunner } from "../../../providers/ai/src/provider-execution.mts";

function request() {
  return { executable: "codex.exe", args: [], prompt: "test", workingDirectory: "C:\\jarvis", timeoutMs: 1000 };
}

test("provider execution restarts one crashed process and resets after success", async () => {
  let calls = 0;
  const controller = new ProviderExecutionController({ run: async () => {
    calls += 1;
    return calls === 1 ? { code: 1, timedOut: false, cancelled: false, crashed: true } : { code: 0, timedOut: false, cancelled: false, crashed: false };
  } });
  const result = await controller.execute(request());
  assert.equal(result.code, 0);
  assert.equal(calls, 2);
  assert.deepEqual(controller.snapshot(), { circuit: "CLOSED", consecutiveFailures: 0, restartCount: 0 });
});

test("provider execution opens the circuit after repeated failures and permits a half-open probe", async () => {
  let now = 1000;
  let calls = 0;
  const controller = new ProviderExecutionController({ run: async () => {
    calls += 1;
    return { code: 1, timedOut: false, cancelled: false, crashed: false };
  } }, () => now);
  for (let i = 0; i < 3; i += 1) await controller.execute(request());
  assert.equal(controller.snapshot().circuit, "OPEN");
  const skipped = await controller.execute(request());
  assert.equal(skipped.circuitOpen, true);
  assert.equal(calls, 3);
  now += 30_000;
  const halfOpen = await controller.execute(request());
  assert.equal(halfOpen.circuitOpen, undefined);
  assert.equal(calls, 4); // the half-open probe is the one bounded retry opportunity
});

test("native provider runner reports bounded timeout and external cancellation", async () => {
  const base = { executable: process.execPath, args: ["-e", "setTimeout(() => {}, 5000)"], prompt: "", workingDirectory: process.cwd() };
  const timedOut = await nativeProviderProcessRunner.run({ ...base, timeoutMs: 50 });
  assert.equal(timedOut.timedOut, true);
  assert.equal(timedOut.cancelled, false);

  const controller = new AbortController();
  const cancelledPromise = nativeProviderProcessRunner.run({ ...base, timeoutMs: 5000, signal: controller.signal });
  setTimeout(() => controller.abort(), 25);
  const cancelled = await cancelledPromise;
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.timedOut, false);
});
