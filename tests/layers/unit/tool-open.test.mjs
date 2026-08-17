import assert from "node:assert/strict";
import test from "node:test";
import {
  OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST,
  ToolOpenValidationError,
  createPlatformOpenAdapter,
  validateOpenToolInput,
  validateOpenToolOutput,
} from "../../../packages/protocol/src/tool-open.mjs";

test("open tool is bounded, platform-qualified, and requires conditional verification", () => {
  assert.equal(OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST.idempotency, "IDEMPOTENCY_KEY");
  assert.equal(OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST.sideEffectClass, "REVERSIBLE_WRITE");
  assert.deepEqual(OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST.requiredPlatformCapabilities, ["project.open", "file.open"]);
  assert.equal(OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST.postconditions[0].required, true);
  assert.deepEqual(validateOpenToolInput({ targetKind: "APPLICATION", applicationId: "notepad", arguments: ["--safe"] }), { targetKind: "APPLICATION", applicationId: "notepad", arguments: ["--safe"] });
  assert.deepEqual(validateOpenToolInput({ targetKind: "PROJECT", projectId: "jarvis", workspaceId: "primary" }), { targetKind: "PROJECT", projectId: "jarvis", workspaceId: "primary" });
  assert.throws(() => validateOpenToolInput({ targetKind: "FILE", projectId: "jarvis", workspaceId: "primary", relativePath: "C:\\Windows\\system32" }), ToolOpenValidationError);
  assert.throws(() => validateOpenToolInput({ targetKind: "FILE", projectId: "jarvis", workspaceId: "primary", relativePath: "..\\secret" }), ToolOpenValidationError);
});

test("open adapter delegates only typed targets and preserves provider postcondition state", async () => {
  const calls = [];
  const adapter = createPlatformOpenAdapter({
    openApplication: async (applicationId, args) => { calls.push(["application", applicationId, args]); return { targetKind: "APPLICATION", targetIdentity: "app.notepad", state: "OPEN_REQUESTED" }; },
    openProject: async (projectId, workspaceId) => { calls.push(["project", projectId, workspaceId]); return { targetKind: "PROJECT", targetIdentity: "project.jarvis.primary", state: "OPEN_REQUESTED" }; },
    openFile: async (projectId, workspaceId, relativePath) => { calls.push(["file", projectId, workspaceId, relativePath]); return { targetKind: "FILE", targetIdentity: "file.jarvis.primary.README.md", state: "OPEN_REQUESTED" }; },
  });
  const application = await adapter.execute({ arguments: { targetKind: "APPLICATION", applicationId: "notepad" } });
  const project = await adapter.execute({ arguments: { targetKind: "PROJECT", projectId: "jarvis", workspaceId: "primary" } });
  const file = await adapter.execute({ arguments: { targetKind: "FILE", projectId: "jarvis", workspaceId: "primary", relativePath: "README.md" } });
  assert.equal(application.state, "OPEN_REQUESTED");
  assert.equal(project.targetKind, "PROJECT");
  assert.equal(file.targetKind, "FILE");
  assert.deepEqual(calls, [["application", "notepad", []], ["project", "jarvis", "primary"], ["file", "jarvis", "primary", "README.md"]]);
  assert.deepEqual(validateOpenToolOutput(file), file);
});
