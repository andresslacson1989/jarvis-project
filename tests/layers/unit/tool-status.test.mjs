import assert from "node:assert/strict";
import test from "node:test";
import {
  PROJECT_SYSTEM_STATUS_TOOL_MANIFEST,
  ToolStatusValidationError,
  createProjectSystemStatusAdapter,
  validateProjectSystemStatusInput,
  validateProjectSystemStatusOutput,
} from "../../../packages/protocol/src/tool-status.mjs";

const project = {
  projectId: "jarvis",
  displayName: "JARVIS",
  canonicalRoot: { platform: "WINDOWS", value: "G:\\Jarvis Project" },
  canonicalIdentity: "windows.g.jarvis-project",
};
const workspace = {
  workspaceId: "primary",
  projectId: "jarvis",
  displayName: "Primary",
  kind: "PRIMARY",
  canonicalRoot: { platform: "WINDOWS", value: "G:\\Jarvis Project" },
};
const system = {
  core: { protocolMajor: 1, platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", serviceState: "LOCKED", transportState: "NOT_CONNECTED" },
  platform: { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", backendProfileId: "windows-full-host-x64" },
};

test("status tool manifest is read-only, typed, and Windows-qualified", () => {
  assert.equal(PROJECT_SYSTEM_STATUS_TOOL_MANIFEST.sideEffectClass, "READ_ONLY");
  assert.equal(PROJECT_SYSTEM_STATUS_TOOL_MANIFEST.networkRequired, false);
  assert.deepEqual(PROJECT_SYSTEM_STATUS_TOOL_MANIFEST.platformCompatibility, [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }]);
  assert.deepEqual(validateProjectSystemStatusInput({ query: "SYSTEM" }), { query: "SYSTEM" });
  assert.deepEqual(validateProjectSystemStatusInput({ query: "PROJECT", projectId: "jarvis", workspaceId: "primary" }), { query: "PROJECT", projectId: "jarvis", workspaceId: "primary" });
  assert.throws(() => validateProjectSystemStatusInput({ query: "PROJECT", projectId: "jarvis" }), ToolStatusValidationError);
});

test("status output preserves exact policy distinctions and qualified system identity", () => {
  const projectOutput = validateProjectSystemStatusOutput({ query: "PROJECT", observedAt: "2026-08-17T12:00:00.000Z", project: { project, workspace, policyStatus: "POLICY_DECISION_REQUIRED" } });
  assert.equal(projectOutput.project?.policyStatus, "POLICY_DECISION_REQUIRED");
  const systemOutput = validateProjectSystemStatusOutput({ query: "SYSTEM", observedAt: "2026-08-17T12:00:00.000Z", system });
  assert.equal(systemOutput.system?.platform.backendProfileId, "windows-full-host-x64");
  assert.throws(() => validateProjectSystemStatusOutput({ query: "PROJECT", observedAt: "now", project: { project, workspace, policyStatus: "TRUSTED_POLICY", fabricated: true } }), ToolStatusValidationError);
});

test("status adapter reads through the injected provider and does not invent state", async () => {
  const calls = [];
  const adapter = createProjectSystemStatusAdapter({
    readProjectStatus: async (projectId, workspaceId) => { calls.push(["project", projectId, workspaceId]); return { project, workspace, policyStatus: "TRUSTED_POLICY" }; },
    readSystemStatus: async () => { calls.push(["system"]); return system; },
  });
  const projectResult = await adapter.execute({ arguments: { query: "PROJECT", projectId: "jarvis", workspaceId: "primary" } });
  const systemResult = await adapter.execute({ arguments: { query: "SYSTEM" } });
  assert.equal(projectResult.project.policyStatus, "TRUSTED_POLICY");
  assert.equal(systemResult.system.core.transportState, "NOT_CONNECTED");
  assert.deepEqual(calls, [["project", "jarvis", "primary"], ["system"]]);
});
