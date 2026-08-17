import assert from "node:assert/strict";
import test from "node:test";
import {
  FILESYSTEM_READ_TOOL_MANIFEST,
  FILESYSTEM_WRITE_TOOL_MANIFEST,
  ToolFilesystemValidationError,
  createPlatformFilesystemAdapter,
  validateFilesystemToolInput,
  validateFilesystemToolOutput,
} from "../../../packages/protocol/src/tool-filesystem.mjs";

test("filesystem tools are workspace-relative, bounded, and separated by capability", () => {
  assert.equal(FILESYSTEM_READ_TOOL_MANIFEST.networkRequired, false);
  assert.equal(FILESYSTEM_READ_TOOL_MANIFEST.idempotency, "IDEMPOTENT");
  assert.equal(FILESYSTEM_WRITE_TOOL_MANIFEST.baselineRisk, "HIGH");
  assert.equal(FILESYSTEM_WRITE_TOOL_MANIFEST.idempotency, "IDEMPOTENCY_KEY");
  assert.deepEqual(validateFilesystemToolInput({ operation: "READ_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath: "README.md", maxBytes: 4096 }), { operation: "READ_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath: "README.md", maxBytes: 4096 });
  assert.deepEqual(validateFilesystemToolInput({ operation: "WRITE_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath: "notes.txt", content: "hello", expectedVersionToken: "sha256:old" }), { operation: "WRITE_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath: "notes.txt", content: "hello", expectedVersionToken: "sha256:old" });
  assert.throws(() => validateFilesystemToolInput({ operation: "READ_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath: "..\\secret", maxBytes: 10 }), ToolFilesystemValidationError);
  assert.throws(() => validateFilesystemToolInput({ operation: "READ_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath: "README.md", maxBytes: 1_048_577 }), ToolFilesystemValidationError);
});

test("filesystem adapters delegate only the matching typed operation and validate byte evidence", async () => {
  const calls = [];
  const readAdapter = createPlatformFilesystemAdapter({
    readText: async (input) => { calls.push(["read", input.relativePath]); return { operation: "READ_TEXT", targetIdentity: "file.jarvis.primary.README.md", versionToken: "sha256:current", content: "hello", bytes: 5 }; },
    writeText: async (input) => { calls.push(["write", input.relativePath, input.expectedVersionToken]); return { operation: "WRITE_TEXT", targetIdentity: "file.jarvis.primary.notes.txt", versionToken: "sha256:new", state: "WRITE_REQUESTED" }; },
  }, "READ_TEXT");
  const writeAdapter = createPlatformFilesystemAdapter({
    readText: async () => { throw new Error("read must not be called"); },
    writeText: async (input) => { calls.push(["write", input.relativePath, input.expectedVersionToken]); return { operation: "WRITE_TEXT", targetIdentity: "file.jarvis.primary.notes.txt", versionToken: "sha256:new", state: "WRITE_REQUESTED" }; },
  }, "WRITE_TEXT");
  const read = await readAdapter.execute({ arguments: { operation: "READ_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath: "README.md", maxBytes: 4096 } });
  const write = await writeAdapter.execute({ arguments: { operation: "WRITE_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath: "notes.txt", content: "hello", expectedVersionToken: "sha256:old" } });
  assert.equal(read.bytes, 5);
  assert.equal(write.state, "WRITE_REQUESTED");
  assert.deepEqual(calls, [["read", "README.md"], ["write", "notes.txt", "sha256:old"]]);
  assert.throws(() => validateFilesystemToolOutput({ operation: "READ_TEXT", targetIdentity: "file", versionToken: "sha256:x", content: "hello", bytes: 4 }), ToolFilesystemValidationError);
});
