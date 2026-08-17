import assert from "node:assert/strict";
import test from "node:test";
import {
  PROJECT_BUILD_TOOL_MANIFEST,
  PROJECT_TEST_TOOL_MANIFEST,
  ToolEngineeringValidationError,
  createEngineeringExecutionAdapter,
  validateEngineeringExecutionInput,
  validateEngineeringExecutionOutput,
} from "../../../packages/protocol/src/tool-engineering.mjs";

test("engineering test/build tools are allowlisted, bounded, supervised, and semantic", () => {
  assert.equal(PROJECT_TEST_TOOL_MANIFEST.sideEffectClass, "REVERSIBLE_WRITE");
  assert.equal(PROJECT_TEST_TOOL_MANIFEST.networkRequired, false);
  assert.equal(PROJECT_BUILD_TOOL_MANIFEST.toolId, "jarvis.project.build");
  assert.equal(PROJECT_TEST_TOOL_MANIFEST.postconditions[0].required, true);
  assert.deepEqual(validateEngineeringExecutionInput({ operation: "TEST", projectId: "jarvis", workspaceId: "primary", profileId: "npm.test", timeoutMs: 60_000 }), { operation: "TEST", projectId: "jarvis", workspaceId: "primary", profileId: "npm.test", timeoutMs: 60_000 });
  assert.throws(() => validateEngineeringExecutionInput({ operation: "TEST", projectId: "jarvis", workspaceId: "primary", profileId: "npm.test", timeoutMs: 999 }), ToolEngineeringValidationError);
  assert.throws(() => validateEngineeringExecutionOutput({ operation: "TEST", projectId: "jarvis", workspaceId: "primary", profileId: "npm.test", workspaceIdentity: "ws", supervision: "NONE", privilege: "STANDARD_USER", semanticState: "PASSED" }), ToolEngineeringValidationError);
});

test("engineering adapter delegates only the selected operation and requires Job Object evidence", async () => {
  const calls = [];
  const adapter = createEngineeringExecutionAdapter({
    execute: async (input) => { calls.push(input); return { operation: input.operation, projectId: input.projectId, workspaceId: input.workspaceId, profileId: input.profileId, workspaceIdentity: "workspace.jarvis.primary", supervision: "WINDOWS_JOB_OBJECT", privilege: "STANDARD_USER", semanticState: "PASSED", exitCode: 0 }; },
  }, "TEST");
  const result = await adapter.execute({ arguments: { operation: "TEST", projectId: "jarvis", workspaceId: "primary", profileId: "npm.test", timeoutMs: 60_000 } });
  assert.equal(result.semanticState, "PASSED");
  assert.equal(result.supervision, "WINDOWS_JOB_OBJECT");
  assert.deepEqual(calls, [{ operation: "TEST", projectId: "jarvis", workspaceId: "primary", profileId: "npm.test", timeoutMs: 60_000 }]);
  assert.deepEqual(validateEngineeringExecutionOutput(result), result);
});
