import assert from "node:assert/strict";
import test from "node:test";
import { CoreToolRuntime, createFailClosedCoreToolRuntime, registerCoreTools } from "../../../services/core/src/tool-runtime.mjs";
import { evaluateOpenTargetPostcondition } from "../../../services/core/src/main.ts";
import { ToolRegistry, ToolSchemaRegistry, validateToolManifest } from "../../../packages/protocol/src/tool-runtime.mjs";

const executionId = "018f0000-0000-7000-8000-000000000101";

const manifest = validateToolManifest({
  toolId: "jarvis.core.test-read",
  version: 1,
  description: "Core runtime test read tool",
  inputSchemaId: "jarvis.schema.core-test.input.v1",
  outputSchemaId: "jarvis.schema.core-test.output.v1",
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
});

const request = (id = executionId) => ({
  toolExecutionId: id,
  toolId: manifest.toolId,
  toolVersion: manifest.version,
  executionScope: { kind: "PROJECT_WORKSPACE", projectId: "project-1", workspaceId: "workspace-1" },
  authorityEnvelopeId: "018f0000-0000-7000-8000-000000000102",
  arguments: { value: "input" },
});

const facts = (state = "PASS") => Object.fromEntries([
  "PLATFORM_CAPABILITY", "PROVIDER_SETUP", "INTEGRITY", "PROJECT_POLICY_TRUST", "SUPPLY_CHAIN_TRUST", "LOCALITY", "BUDGET", "RESOURCE", "PRECONDITION",
].map((name) => [name, { state, reasonCode: `${name}_TEST` }]));

const permission = (outcome = "ALLOW") => ({
  decisionId: "permission-test-1",
  toolExecutionId: executionId,
  outcome,
  contextualRisk: "LOW",
  reasonCodes: ["TEST"],
  matchedPolicyIds: ["TEST_POLICY"],
  matchedPrecedentIds: [],
  decidedAt: new Date().toISOString(),
  policyVersion: 1,
});

function runtime({ permissionDecision = permission(), preAllowFacts = facts(), auditStore = { recordToolExecutionAudit() {} } } = {}) {
  const schemas = new ToolSchemaRegistry();
  schemas.register(manifest.inputSchemaId, (value) => value);
  schemas.register(manifest.outputSchemaId, (value) => value);
  const registry = new ToolRegistry();
  let adapterCalls = 0;
  registry.register(manifest, { toolId: manifest.toolId, toolVersion: 1, execute: async () => { adapterCalls += 1; return { value: "ok" }; } });
  const core = new CoreToolRuntime({
    registry,
    schemas,
    auditStore,
    context: {
      readPermissionDecision: async () => permissionDecision,
      readPreAllowGateFacts: async () => preAllowFacts,
    },
  });
  return { core, getAdapterCalls: () => adapterCalls };
}

test("CoreToolRuntime owns admission and records a sanitized successful execution", async () => {
  const audits = [];
  const { core, getAdapterCalls } = runtime({ auditStore: { recordToolExecutionAudit: (result, currentManifest) => audits.push({ result, currentManifest }) } });
  const result = await core.execute(request());
  assert.equal(result.outcome, "SUCCEEDED");
  assert.equal(getAdapterCalls(), 1);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].currentManifest.toolId, manifest.toolId);
  assert.equal(audits[0].result.output.value, "ok");
});

test("Core open postcondition accepts only the matching qualified project/file target", () => {
  const request = { arguments: { targetKind: "FILE", projectId: "project-1", workspaceId: "workspace-1", relativePath: "README.md" } };
  const passed = evaluateOpenTargetPostcondition(request, {
    targetKind: "FILE",
    targetIdentity: "file.project-1.workspace-1.README.md",
    state: "OPEN_REQUESTED",
  }, "2026-08-17T00:00:00.000Z");
  assert.equal(passed.criterionId, "target-open-requested");
  assert.equal(passed.verdict, "PASS");
  assert.equal(passed.verifiedAt, "2026-08-17T00:00:00.000Z");

  const mismatched = evaluateOpenTargetPostcondition(request, {
    targetKind: "PROJECT",
    targetIdentity: "project.project-1.workspace-1",
    state: "OPEN_REQUESTED",
  }, "2026-08-17T00:00:00.000Z");
  assert.equal(mismatched.verdict, "UNKNOWN");

  const application = evaluateOpenTargetPostcondition({ arguments: { targetKind: "APPLICATION", applicationId: "notepad" } }, {
    targetKind: "APPLICATION",
    targetIdentity: "app.notepad",
    state: "OPEN_REQUESTED",
  }, "2026-08-17T00:00:00.000Z");
  assert.equal(application.verdict, "UNKNOWN");
});

test("CoreToolRuntime blocks a denied permission before the adapter", async () => {
  const { core, getAdapterCalls } = runtime({ permissionDecision: permission("DENY") });
  const result = await core.execute(request());
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.error?.code, "TOOL_PERMISSION_DENIED");
  assert.equal(getAdapterCalls(), 0);
});

test("CoreToolRuntime returns UNCERTAIN when a mandatory admission fact is unknown", async () => {
  const { core, getAdapterCalls } = runtime({ preAllowFacts: facts("UNKNOWN") });
  const result = await core.execute(request());
  assert.equal(result.outcome, "UNCERTAIN");
  assert.equal(result.error?.code, "TOOL_PRE_ALLOW_GATE_UNKNOWN");
  assert.equal(getAdapterCalls(), 0);
});

test("Core registers every Section 8 tool through typed platform boundaries", () => {
  const registry = new ToolRegistry();
  const schemas = new ToolSchemaRegistry();
  registerCoreTools(registry, schemas, {
    status: { readProjectStatus: async () => ({ project: {}, workspace: {}, policyStatus: "NO_POLICY_CANDIDATE" }), readSystemStatus: async () => ({ core: {}, platform: {} }) },
    open: { open: async () => ({ targetKind: "PROJECT", opened: true, identity: "test" }) },
    filesystem: { readText: async () => ({ path: "file.txt", versionToken: "v", content: "", byteLength: 0 }), writeText: async () => ({ path: "file.txt", versionToken: "v2", byteLength: 0, state: "APPLIED" }) },
    engineering: { execute: async (input) => ({ ...input, workspaceIdentity: "workspace.test", supervision: "WINDOWS_JOB_OBJECT", privilege: "STANDARD_USER", semanticState: "PASSED" }) },
    git: { read: async () => ({ operation: "STATUS", workspaceIdentity: "workspace.test", entries: [], branch: "main", diff: "", commits: [] }) },
  });
  assert.equal(registry.list().length, 10);
  assert.deepEqual(registry.list().map((item) => item.toolId).sort(), [
    "jarvis.git.branch", "jarvis.git.diff", "jarvis.git.log", "jarvis.git.status", "jarvis.open.application-project-file",
    "jarvis.filesystem.read-text", "jarvis.filesystem.write-text", "jarvis.project.build", "jarvis.project.test", "jarvis.status.project-system",
  ].sort());
  assert.deepEqual(schemas.validate("jarvis.schema.tool-engineering.request.v1", { operation: "TEST", projectId: "project-1", workspaceId: "workspace-1", profileId: "npm.test", timeoutMs: 1_000 }), {
    operation: "TEST", projectId: "project-1", workspaceId: "workspace-1", profileId: "npm.test", timeoutMs: 1_000,
  });
});

test("live composition keeps the Core executor attached but fails closed before native facts exist", async () => {
  const audits = [];
  const core = createFailClosedCoreToolRuntime({ recordToolExecutionAudit: (result) => audits.push(result) });
  const result = await core.execute({
    toolExecutionId: "018f0000-0000-7000-8000-000000000103",
    toolId: "jarvis.status.project-system",
    toolVersion: 1,
    executionScope: { kind: "SYSTEM" },
    authorityEnvelopeId: "018f0000-0000-7000-8000-000000000104",
    arguments: { query: "SYSTEM" },
  });
  assert.equal(result.outcome, "UNCERTAIN");
  assert.equal(result.error?.code, "TOOL_ADMISSION_CONTEXT_UNAVAILABLE");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].toolExecutionId, "018f0000-0000-7000-8000-000000000103");
});
