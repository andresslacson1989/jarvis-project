import assert from "node:assert/strict";
import test from "node:test";
import { createToolError, executeRegisteredTool, ToolRegistry, ToolSchemaRegistry, ToolValidationError, validateToolManifest, validateToolRequest } from "../../../packages/protocol/src/tool-runtime.mjs";

const executionId = "018f0000-0000-7000-8000-000000000001";
const authorityId = "018f0000-0000-7000-8000-000000000002";

function manifest(overrides = {}) {
  return validateToolManifest({
    toolId: "jarvis.test.read",
    version: 1,
    description: "bounded test tool",
    inputSchemaId: "jarvis.schema.test.input.v1",
    outputSchemaId: "jarvis.schema.test.output.v1",
    baselineRisk: "LOW",
    sideEffectClass: "READ_ONLY",
    reversible: true,
    requiredPermissionIds: ["project.read"],
    allowedEnvironments: ["WINDOWS_FULL_HOST"],
    allowedScopeKinds: ["PROJECT_WORKSPACE"],
    secretCapabilities: [],
    networkRequired: false,
    requiredPlatformCapabilities: ["filesystem.read"],
    idempotency: "IDEMPOTENT",
    preconditions: [],
    postconditions: [],
    preemptionPolicy: "PREEMPTIBLE",
    ...overrides,
  });
}

function request(overrides = {}) {
  return validateToolRequest({
    toolExecutionId: executionId,
    toolId: "jarvis.test.read",
    toolVersion: 1,
    executionScope: { kind: "PROJECT_WORKSPACE", projectId: "project-1", workspaceId: "workspace-1" },
    authorityEnvelopeId: authorityId,
    arguments: { value: "input" },
    ...overrides,
  });
}

function hooks(order, admission = { outcome: "ALLOW" }) {
  return {
    admit: async () => { order.push("admit"); return admission; },
    evaluatePreconditions: async () => { order.push("preconditions"); return []; },
    evaluatePostconditions: async () => { order.push("postconditions"); return []; },
    recordAudit: async () => { order.push("audit"); },
  };
}

test("tool manifests are strict, bounded, and require postcondition evidence for consequential tools", () => {
  assert.throws(() => manifest({ unknown: true }), ToolValidationError);
  assert.throws(() => manifest({ sideEffectClass: "REVERSIBLE_WRITE" }), /postcondition/iu);
  assert.throws(() => manifest({ allowedScopeKinds: [] }), /scope/iu);
  assert.throws(() => manifest({ preconditions: [{ checkId: "duplicate", kind: "STATE_QUERY", verifierId: "v", parametersSchemaId: "p", required: true, onUnknown: "FAIL" }, { checkId: "duplicate", kind: "STATE_QUERY", verifierId: "v2", parametersSchemaId: "p2", required: true, onUnknown: "FAIL" }] }), /duplicate/iu);
});

test("registry requires exact manifest/adapter identity and preserves versioned registrations", () => {
  const registry = new ToolRegistry();
  const current = manifest();
  const adapter = { toolId: current.toolId, toolVersion: current.version, execute: async () => ({ value: "ok" }) };
  registry.register(current, adapter);
  assert.equal(registry.resolve(current.toolId, current.version).toolId, current.toolId);
  assert.equal(registry.list().length, 1);
  assert.throws(() => registry.register(current, adapter), /already registered/iu);
  const mismatchRegistry = new ToolRegistry();
  assert.throws(() => mismatchRegistry.register(current, { ...adapter, toolVersion: 2 }), /identity/iu);
});

test("ToolExecutor owns manifest, schema, admission, precondition, adapter, postcondition, and audit ordering", async () => {
  const schemas = new ToolSchemaRegistry();
  schemas.register("jarvis.schema.test.input.v1", (value) => {
    assert.deepEqual(value, { value: "input" });
    return value;
  });
  schemas.register("jarvis.schema.test.output.v1", (value) => {
    const output = value;
    assert.equal(output.value, "ok");
    return output;
  });
  const registry = new ToolRegistry();
  const current = manifest();
  registry.register(current, { toolId: current.toolId, toolVersion: current.version, execute: async () => ({ value: "ok" }) });
  const order = [];
  const result = await executeRegisteredTool(registry, schemas, request(), hooks(order));
  assert.equal(result.outcome, "SUCCEEDED");
  assert.deepEqual(order, ["admit", "preconditions", "postconditions", "audit"]);
});

test("ToolExecutor fails closed before adapter execution on denied admission, scope mismatch, or missing schema", async () => {
  const schemas = new ToolSchemaRegistry();
  schemas.register("jarvis.schema.test.input.v1", (value) => value);
  schemas.register("jarvis.schema.test.output.v1", (value) => value);
  const registry = new ToolRegistry();
  const current = manifest();
  let adapterCalls = 0;
  registry.register(current, { toolId: current.toolId, toolVersion: current.version, execute: async () => { adapterCalls += 1; return { value: "ok" }; } });
  const denied = await executeRegisteredTool(registry, schemas, request(), hooks([], { outcome: "DENIED", error: createToolError("DENIED", "AUTHORIZATION", "denied", false, executionId) }));
  assert.equal(denied.outcome, "DENIED");
  assert.equal(adapterCalls, 0);
  const wrongScope = await executeRegisteredTool(registry, schemas, request({ executionScope: { kind: "GLOBAL" } }), hooks([]));
  assert.equal(wrongScope.outcome, "DENIED");
  assert.equal(adapterCalls, 0);
  const missingSchemaRegistry = new ToolSchemaRegistry();
  const missingSchema = await executeRegisteredTool(registry, missingSchemaRegistry, request(), hooks([]));
  assert.equal(missingSchema.outcome, "FAILED");
  assert.equal(missingSchema.error?.code, "TOOL_VALIDATION_FAILED");
  assert.equal(adapterCalls, 0);
});

test("consequential tool cannot report success without required postcondition evidence", async () => {
  const schemas = new ToolSchemaRegistry();
  schemas.register("jarvis.schema.test.input.v1", (value) => value);
  schemas.register("jarvis.schema.test.output.v1", (value) => value);
  const registry = new ToolRegistry();
  const current = manifest({ toolId: "jarvis.test.write", sideEffectClass: "REVERSIBLE_WRITE", reversible: true, postconditions: [{ checkId: "written", kind: "FILE_STATE", verifierId: "file-state", parametersSchemaId: "jarvis.schema.test.input.v1", required: true, onUnknown: "UNCERTAIN" }] });
  registry.register(current, { toolId: current.toolId, toolVersion: current.version, execute: async () => ({ value: "ok" }) });
  const hooksWithUnknownPostcondition = hooks([]);
  hooksWithUnknownPostcondition.evaluatePostconditions = async () => [{ criterionId: "written", verdict: "UNKNOWN", evidence: [], summary: "not observed", verifiedAt: new Date().toISOString(), verifierType: "LIVE_STATE" }];
  const result = await executeRegisteredTool(registry, schemas, request({ toolId: current.toolId }), hooksWithUnknownPostcondition);
  assert.equal(result.outcome, "UNCERTAIN");
  assert.equal(result.error?.code, "TOOL_POSTCONDITION_FAILED");
  const missing = await executeRegisteredTool(registry, schemas, request({ toolId: current.toolId }), hooks([]));
  assert.equal(missing.outcome, "UNCERTAIN");
  assert.equal(missing.error?.code, "TOOL_POSTCONDITION_EVIDENCE_MISSING");
});

test("ToolExecutor preserves cancellation, safe adapter errors, and uncertain audit outcomes", async () => {
  const schemas = new ToolSchemaRegistry();
  schemas.register("jarvis.schema.test.input.v1", (value) => value);
  schemas.register("jarvis.schema.test.output.v1", (value) => value);
  const registry = new ToolRegistry();
  const current = manifest({ toolId: "jarvis.test.safety" });
  let calls = 0;
  registry.register(current, { toolId: current.toolId, toolVersion: current.version, execute: async () => { calls += 1; throw new Error("password=raw-secret"); } });
  const cancelledController = new AbortController();
  cancelledController.abort();
  const cancelled = await executeRegisteredTool(registry, schemas, request({ toolId: current.toolId }), hooks([]), cancelledController.signal);
  assert.equal(cancelled.outcome, "CANCELLED");
  assert.equal(calls, 0);
  const failed = await executeRegisteredTool(registry, schemas, request({ toolId: current.toolId }), hooks([]));
  assert.equal(failed.outcome, "FAILED");
  assert.equal(failed.error?.code, "TOOL_ADAPTER_FAILED");
  assert.doesNotMatch(failed.error?.message ?? "", /password|raw-secret/iu);
  const auditFailure = hooks([]);
  auditFailure.recordAudit = async () => { throw new Error("audit unavailable"); };
  const uncertain = await executeRegisteredTool(registry, schemas, request({ toolId: current.toolId }), auditFailure);
  assert.equal(uncertain.outcome, "UNCERTAIN");
  assert.equal(uncertain.error?.code, "TOOL_AUDIT_FAILED");
});
