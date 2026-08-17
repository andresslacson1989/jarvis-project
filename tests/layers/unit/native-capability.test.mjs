import assert from "node:assert/strict";
import test from "node:test";
import { CoreNativeCapabilityClient, NativeCapabilityError, createNativeToolPlatformBoundaries } from "../../../services/core/src/native-capability.mjs";

class MemoryTransport {
  frames = [];
  handler;

  async write(frame) {
    this.frames.push(frame);
    await this.handler?.(frame);
  }
}

const responseFor = (frame, result) => ({
  ok: true,
  result,
  correlationId: frame.correlationId,
});

test("native capability client emits only the bounded typed request envelope", async () => {
  const transport = new MemoryTransport();
  const client = new CoreNativeCapabilityClient(transport);
  transport.handler = async (frame) => client.handleResponse(responseFor(frame, {
    operation: "READ_TEXT",
    targetIdentity: "readme.md",
    versionToken: "v1",
    content: "ok",
    bytes: 2,
  }));
  const result = await client.request("filesystem.read_text", { projectId: "project-1", workspaceId: "workspace-1", relativePath: "README.md", maxBytes: 1024 });
  assert.deepEqual(result, { operation: "READ_TEXT", targetIdentity: "readme.md", versionToken: "v1", content: "ok", bytes: 2 });
  assert.equal(transport.frames.length, 1);
  assert.deepEqual(Object.keys(transport.frames[0]).sort(), ["correlationId", "id", "kind", "name", "payload", "protocolVersion"]);
  assert.equal(transport.frames[0].name, "native_capability");
  assert.equal(transport.frames[0].payload.capability, "filesystem.read_text");
  assert.deepEqual(transport.frames[0].payload.arguments, { projectId: "project-1", workspaceId: "workspace-1", relativePath: "README.md", maxBytes: 1024 });
});

test("native capability boundaries validate native output before returning it", async () => {
  const transport = new MemoryTransport();
  const client = new CoreNativeCapabilityClient(transport, async (projectId, workspaceId) => ({ projectId, workspaceId, workspaceRoot: "C:\\workspace" }));
  transport.handler = async (frame) => client.handleResponse(responseFor(frame, frame.payload.capability === "workspace.bind" ? { state: "BOUND" } : {
    operation: "READ_TEXT",
    targetIdentity: "readme.md",
    versionToken: "v1",
    content: "ok",
    bytes: 2,
  }));
  const boundaries = createNativeToolPlatformBoundaries(client);
  const result = await boundaries.filesystem.readText({ operation: "READ_TEXT", projectId: "project-1", workspaceId: "workspace-1", relativePath: "README.md", maxBytes: 1024 });
  assert.equal(result.content, "ok");
  assert.equal(result.bytes, 2);
});

test("workspace-scoped native boundaries bind the Core-owned workspace before dispatch", async () => {
  const transport = new MemoryTransport();
  const client = new CoreNativeCapabilityClient(transport, async (projectId, workspaceId) => ({
    projectId,
    workspaceId,
    workspaceRoot: "C:\\workspace",
  }));
  transport.handler = async (frame) => {
    if (frame.payload.capability === "workspace.bind") {
      assert.deepEqual(frame.payload.arguments, { projectId: "project-1", workspaceId: "workspace-1", workspaceRoot: "C:\\workspace" });
      client.handleResponse(responseFor(frame, { state: "BOUND" }));
      return;
    }
    assert.equal(frame.payload.capability, "filesystem.read_text");
    client.handleResponse(responseFor(frame, {
      operation: "READ_TEXT",
      targetIdentity: "readme.md",
      versionToken: "v1",
      content: "ok",
      bytes: 2,
    }));
  };
  const boundaries = createNativeToolPlatformBoundaries(client);
  const result = await boundaries.filesystem.readText({ operation: "READ_TEXT", projectId: "project-1", workspaceId: "workspace-1", relativePath: "README.md", maxBytes: 1024 });
  assert.equal(result.content, "ok");
  assert.deepEqual(transport.frames.map((frame) => frame.payload.capability), ["workspace.bind", "filesystem.read_text"]);
});

test("project status sends the Core-owned snapshot only after workspace binding", async () => {
  const transport = new MemoryTransport();
  const snapshot = {
    project: {
      projectId: "project-1",
      displayName: "JARVIS",
      canonicalRoot: { platform: "WINDOWS", value: "C:\\workspace" },
      canonicalIdentity: "project-identity-1",
    },
    workspace: {
      workspaceId: "workspace-1",
      projectId: "project-1",
      displayName: "Primary",
      kind: "PRIMARY",
      canonicalRoot: { platform: "WINDOWS", value: "C:\\workspace" },
    },
    policyStatus: "POLICY_DECISION_REQUIRED",
  };
  const client = new CoreNativeCapabilityClient(
    transport,
    async (projectId, workspaceId) => ({ projectId, workspaceId, workspaceRoot: "C:\\workspace" }),
    async () => snapshot,
  );
  transport.handler = async (frame) => {
    if (frame.payload.capability === "workspace.bind") {
      client.handleResponse(responseFor(frame, { state: "BOUND" }));
      return;
    }
    assert.equal(frame.payload.capability, "status.project");
    assert.deepEqual(frame.payload.arguments.snapshot, snapshot);
    client.handleResponse(responseFor(frame, snapshot));
  };
  const result = await createNativeToolPlatformBoundaries(client).status.readProjectStatus("project-1", "workspace-1");
  assert.deepEqual(result, snapshot);
  assert.deepEqual(transport.frames.map((frame) => frame.payload.capability), ["workspace.bind", "status.project"]);
});

test("engineering boundaries bind the Core workspace and require qualified Job Object output", async () => {
  const transport = new MemoryTransport();
  const client = new CoreNativeCapabilityClient(
    transport,
    async (projectId, workspaceId) => ({ projectId, workspaceId, workspaceRoot: "C:\\workspace" }),
  );
  transport.handler = async (frame) => {
    if (frame.payload.capability === "workspace.bind") {
      client.handleResponse(responseFor(frame, { state: "BOUND" }));
      return;
    }
    assert.equal(frame.payload.capability, "engineering.execute");
    client.handleResponse(responseFor(frame, {
      operation: "TEST",
      projectId: "project-1",
      workspaceId: "workspace-1",
      profileId: "npm.test",
      workspaceIdentity: "workspace-identity-1",
      supervision: "WINDOWS_JOB_OBJECT",
      privilege: "STANDARD_USER",
      semanticState: "PASSED",
      exitCode: 0,
    }));
  };
  const result = await createNativeToolPlatformBoundaries(client).engineering.execute({
    operation: "TEST",
    projectId: "project-1",
    workspaceId: "workspace-1",
    profileId: "npm.test",
    timeoutMs: 1_000,
  });
  assert.equal(result.semanticState, "PASSED");
  assert.deepEqual(transport.frames.map((frame) => frame.payload.capability), ["workspace.bind", "engineering.execute"]);
});

test("native capability client rejects a failed response and does not silently succeed", async () => {
  const transport = new MemoryTransport();
  const client = new CoreNativeCapabilityClient(transport);
  transport.handler = async (frame) => client.handleResponse({
    ok: false,
    result: undefined,
    error: { code: "NATIVE_CAPABILITY_UNQUALIFIED", category: "UNSUPPORTED", message: "capability is not qualified", retryable: true, correlationId: frame.correlationId },
    correlationId: frame.correlationId,
  });
  await assert.rejects(
    client.request("filesystem.read_text", { projectId: "project-1", workspaceId: "workspace-1", relativePath: "README.md", maxBytes: 1024 }),
    (error) => error instanceof NativeCapabilityError && error.code === "NATIVE_CAPABILITY_UNQUALIFIED" && error.retryable,
  );
});

test("native capability client rejects retargeted or malformed responses", async () => {
  const transport = new MemoryTransport();
  const client = new CoreNativeCapabilityClient(transport);
  let frame;
  transport.handler = async (request) => {
    frame = request;
    assert.equal(client.handleResponse({ ok: true, result: {}, correlationId: "018f0000-0000-7000-8000-000000000999" }), false);
    client.handleResponse({ ok: true, result: {}, correlationId: request.correlationId });
  };
  const result = await client.request("status.system", {});
  assert.deepEqual(result, {});
  assert.ok(frame);
});

test("native capability cancellation closes the pending request without sending a fallback", async () => {
  const transport = new MemoryTransport();
  const client = new CoreNativeCapabilityClient(transport);
  const controller = new AbortController();
  const pending = client.request("status.system", {}, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof NativeCapabilityError && error.code === "NATIVE_CAPABILITY_CANCELLED");
  assert.equal(transport.frames.length, 1);
});
