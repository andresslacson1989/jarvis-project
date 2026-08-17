import assert from "node:assert/strict";
import test from "node:test";
import {
  FILESYSTEM_READ_TOOL_MANIFEST,
  FILESYSTEM_WRITE_TOOL_MANIFEST,
  validateFilesystemToolInput,
  ToolFilesystemValidationError,
} from "../../../packages/protocol/src/tool-filesystem.mjs";
import {
  GIT_BRANCH_TOOL_MANIFEST,
  GIT_DIFF_TOOL_MANIFEST,
  GIT_LOG_TOOL_MANIFEST,
  GIT_STATUS_TOOL_MANIFEST,
  validateGitReadInput,
  ToolGitValidationError,
} from "../../../packages/protocol/src/tool-git.mjs";
import { OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST, validateOpenToolInput, ToolOpenValidationError } from "../../../packages/protocol/src/tool-open.mjs";
import { PROJECT_BUILD_TOOL_MANIFEST, PROJECT_TEST_TOOL_MANIFEST } from "../../../packages/protocol/src/tool-engineering.mjs";
import { PROJECT_SYSTEM_STATUS_TOOL_MANIFEST } from "../../../packages/protocol/src/tool-status.mjs";
import { executeConditionalMutation, executeIdempotentMutation } from "../../../packages/protocol/src/tool-mutation-runtime.mjs";
import { executeRegisteredTool, ToolRegistry, ToolSchemaRegistry, validateToolManifest, validateToolRequest } from "../../../packages/protocol/src/tool-runtime.mjs";

const localToolManifests = [
  PROJECT_SYSTEM_STATUS_TOOL_MANIFEST,
  OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST,
  FILESYSTEM_READ_TOOL_MANIFEST,
  FILESYSTEM_WRITE_TOOL_MANIFEST,
  PROJECT_TEST_TOOL_MANIFEST,
  PROJECT_BUILD_TOOL_MANIFEST,
  GIT_STATUS_TOOL_MANIFEST,
  GIT_BRANCH_TOOL_MANIFEST,
  GIT_DIFF_TOOL_MANIFEST,
  GIT_LOG_TOOL_MANIFEST,
];

test("all Section 8 tools preserve exact local scope, platform, and network declarations", () => {
  assert.deepEqual(localToolManifests.map((manifest) => manifest.toolId), [
    "jarvis.status.project-system",
    "jarvis.open.application-project-file",
    "jarvis.filesystem.read-text",
    "jarvis.filesystem.write-text",
    "jarvis.project.test",
    "jarvis.project.build",
    "jarvis.git.status",
    "jarvis.git.branch",
    "jarvis.git.diff",
    "jarvis.git.log",
  ]);
  for (const manifest of localToolManifests) {
    assert.deepEqual(manifest.allowedEnvironments, ["WINDOWS_FULL_HOST"]);
    assert.ok(manifest.allowedScopeKinds.includes("PROJECT_WORKSPACE"));
    if (manifest.toolId === "jarvis.status.project-system" || manifest.toolId === "jarvis.open.application-project-file") assert.ok(manifest.allowedScopeKinds.includes("SYSTEM"));
    else assert.deepEqual(manifest.allowedScopeKinds, ["PROJECT_WORKSPACE"]);
    assert.deepEqual(manifest.platformCompatibility, [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }]);
    assert.equal(manifest.secretCapabilities.length, 0);
    assert.equal(manifest.networkRequired, false);
  }
});

test("all workspace path entrypoints reject absolute, UNC, and traversal retargeting", () => {
  for (const relativePath of ["C:\\Windows\\system32", "\\\\server\\share\\secret", "..\\secret", "nested/../../secret"]) {
    assert.throws(() => validateFilesystemToolInput({ operation: "READ_TEXT", projectId: "jarvis", workspaceId: "primary", relativePath, maxBytes: 10 }), ToolFilesystemValidationError);
    assert.throws(() => validateOpenToolInput({ targetKind: "FILE", projectId: "jarvis", workspaceId: "primary", relativePath }), ToolOpenValidationError);
    assert.throws(() => validateGitReadInput({ operation: "STATUS", projectId: "jarvis", workspaceId: "primary", maxEntries: 10, relativePath }), ToolGitValidationError);
  }
});

test("consequential conformance keeps CAS and idempotency conflicts explicit", async () => {
  const token = "A".repeat(43);
  const resolution = (versionToken) => ({ resolutionId: "resolution-1", resolvedAt: "2026-08-17T00:00:00.000Z", descriptorDigest: token, targetIdentityDigest: token, targets: [{ system: "filesystem", resourceType: "file", resourceId: "C:\\workspace\\file.txt", identityDigest: token, versionToken }] });
  let calls = 0;
  assert.equal((await executeConditionalMutation(resolution("v1"), resolution("v2"), async () => { calls += 1; })).state, "CONFLICT");
  assert.equal(calls, 0);
  const records = new Map();
  const store = { begin: async (key, requestDigest) => { const record = records.get(key); return record === undefined ? { state: "NEW" } : record.requestDigest === requestDigest ? { state: "REPLAY", record } : { state: "CONFLICT", record }; }, finish: async (key, requestDigest, record) => { records.set(key, { ...record, requestDigest }); } };
  const first = await executeIdempotentMutation(store, "key-1", token, async () => { calls += 1; return { state: "done" }; });
  const replay = await executeIdempotentMutation(store, "key-1", token, async () => { calls += 1; return { state: "wrong" }; });
  assert.deepEqual([first.state, replay.state, replay.value.state, calls], ["APPLIED", "APPLIED", "done", 1]);
});

test("conformance rejects a tool result that skips required postcondition evidence", async () => {
  const executionId = "018f0000-0000-7000-8000-000000000001";
  const authorityId = "018f0000-0000-7000-8000-000000000002";
  const manifest = validateToolManifest({
    toolId: "jarvis.conformance.write",
    version: 1,
    description: "conformance mutation",
    inputSchemaId: "jarvis.schema.conformance.request.v1",
    outputSchemaId: "jarvis.schema.conformance.response.v1",
    baselineRisk: "HIGH",
    sideEffectClass: "REVERSIBLE_WRITE",
    reversible: true,
    requiredPermissionIds: ["workspace.write"],
    allowedEnvironments: ["WINDOWS_FULL_HOST"],
    allowedScopeKinds: ["PROJECT_WORKSPACE"],
    secretCapabilities: [],
    networkRequired: false,
    requiredPlatformCapabilities: ["filesystem.workspace.write"],
    idempotency: "IDEMPOTENCY_KEY",
    preconditions: [],
    postconditions: [{ checkId: "verified", kind: "FILE_STATE", verifierId: "file-state", parametersSchemaId: "jarvis.schema.conformance.response.v1", required: true, onUnknown: "UNCERTAIN" }],
    preemptionPolicy: "SAFE_POINT_ONLY",
  });
  const registry = new ToolRegistry();
  registry.register(manifest, { toolId: manifest.toolId, toolVersion: manifest.version, execute: async () => ({ ok: true }) });
  const schemas = new ToolSchemaRegistry();
  schemas.register(manifest.inputSchemaId, (value) => value);
  schemas.register(manifest.outputSchemaId, (value) => value);
  const request = validateToolRequest({ toolExecutionId: executionId, toolId: manifest.toolId, toolVersion: 1, executionScope: { kind: "PROJECT_WORKSPACE", projectId: "jarvis", workspaceId: "primary" }, authorityEnvelopeId: authorityId, arguments: {}, idempotencyKey: "conformance-key" });
  const result = await executeRegisteredTool(registry, schemas, request, { admit: async () => ({ outcome: "ALLOW" }), evaluatePreconditions: async () => [], evaluatePostconditions: async () => [], recordAudit: async () => {} });
  assert.equal(result.outcome, "UNCERTAIN");
  assert.equal(result.error?.code, "TOOL_POSTCONDITION_EVIDENCE_MISSING");
});
