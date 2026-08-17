import { strict as assert } from "node:assert";
import test from "node:test";
import { validateProviderSetupQualificationPlan } from "../../../packages/protocol/src/provider-setup-plan.ts";

const plan = {
  providerId: "codex-cli",
  distributionId: "codex-cli-standalone-windows-x64-0.147.0",
  adapterVersion: "1.0.0",
  interfaceId: "codex-structured-v1",
  executable: { kind: "MAIN_EXECUTABLE", fileName: "codex.exe", canonicalPath: { platform: "WINDOWS", value: "C:\\Users\\junme\\.codex\\bin\\codex.exe" }, sha256: "a".repeat(64) },
  setupHelper: { kind: "SETUP_HELPER", fileName: "codex-windows-sandbox-setup.exe", canonicalPath: { platform: "WINDOWS", value: "C:\\Users\\junme\\.codex\\bin\\codex-windows-sandbox-setup.exe" }, sha256: "b".repeat(64) },
  setupArguments: ["--repair"],
  qualifiedAt: "2026-08-15T00:00:00.000Z",
  evidenceRef: "evidence:codex-cli:0.147.0",
};

test("qualified setup plan validates exact bounded identities", () => {
  const result = validateProviderSetupQualificationPlan(plan);
  assert.equal(result.providerId, "codex-cli");
  assert.equal(result.setupHelper.kind, "SETUP_HELPER");
});

test("qualified setup plan rejects retargeted or unbounded arguments", () => {
  assert.throws(() => validateProviderSetupQualificationPlan({ ...plan, setupHelper: { ...plan.setupHelper, sha256: "x".repeat(64) } }));
  assert.throws(() => validateProviderSetupQualificationPlan({ ...plan, setupArguments: ["x".repeat(4097)] }));
});
