import assert from "node:assert/strict";
import test from "node:test";
import { ToolCheckVerifierRegistry, ToolTargetValidationError, assertTargetResolutionUnchanged, canonicalizeTargetRef, evaluateToolChecks, validateCanonicalTargetRef, validateToolTargetResolution } from "../../../packages/protocol/src/tool-target-runtime.mjs";
import { validateToolManifest, validateToolRequest } from "../../../packages/protocol/src/tool-runtime.mjs";

const digest = "A".repeat(43);
const request = validateToolRequest({
  toolExecutionId: "018f0000-0000-7000-8000-000000000011",
  toolId: "jarvis.test.target",
  toolVersion: 1,
  executionScope: { kind: "PROJECT_WORKSPACE", projectId: "project-1", workspaceId: "workspace-1" },
  authorityEnvelopeId: "018f0000-0000-7000-8000-000000000012",
  arguments: {},
});
const manifest = validateToolManifest({
  toolId: "jarvis.test.target",
  version: 1,
  description: "target test tool",
  inputSchemaId: "jarvis.schema.target.input.v1",
  outputSchemaId: "jarvis.schema.target.output.v1",
  baselineRisk: "LOW",
  sideEffectClass: "READ_ONLY",
  reversible: true,
  requiredPermissionIds: [],
  allowedEnvironments: ["WINDOWS_FULL_HOST"],
  allowedScopeKinds: ["PROJECT_WORKSPACE"],
  secretCapabilities: [],
  networkRequired: false,
  requiredPlatformCapabilities: [],
  idempotency: "IDEMPOTENT",
  preconditions: [],
  postconditions: [],
  preemptionPolicy: "PREEMPTIBLE",
});

function resolution(versionToken = "version-1") {
  return validateToolTargetResolution({
    resolutionId: "resolution-1",
    resolvedAt: "2026-08-17T00:00:00.000Z",
    descriptorDigest: digest,
    targetIdentityDigest: digest,
    targets: [{ system: "filesystem", resourceType: "file", resourceId: "C:\\workspace\\file.txt", identityDigest: digest, versionToken }],
  });
}

test("canonical target references preserve platform-specific resource IDs but reject ambiguity", () => {
  const target = validateCanonicalTargetRef({ system: "filesystem", resourceType: "file", resourceId: "C:\\workspace\\file.txt", environmentId: "env-1" });
  assert.equal(target.resourceId, "C:\\workspace\\file.txt");
  assert.equal(canonicalizeTargetRef({ resourceId: "item", resourceType: "file", system: "filesystem" }), '{"resourceId":"item","resourceType":"file","system":"filesystem"}');
  assert.throws(() => validateCanonicalTargetRef({ system: "filesystem", resourceType: "file", resourceId: "item", unexpected: true }), ToolTargetValidationError);
  assert.throws(() => validateToolTargetResolution({ ...resolution(), targets: [resolution().targets[0], resolution().targets[0]] }), /duplicate/iu);
});

test("target re-resolution rejects changed identity or version instead of retargeting", () => {
  assert.equal(assertTargetResolutionUnchanged(resolution(), resolution()).targets[0].versionToken, "version-1");
  assert.throws(() => assertTargetResolutionUnchanged(resolution(), resolution("version-2")), /version changed/iu);
  assert.throws(() => assertTargetResolutionUnchanged(resolution(), validateToolTargetResolution({ ...resolution(), targetIdentityDigest: "B".repeat(43) })), /resolution changed/iu);
});

test("shared check verifier registry returns bounded evidence and fails unknown verifiers closed", async () => {
  const registry = new ToolCheckVerifierRegistry();
  registry.register({ verifierId: "file-state", verify: async (_context, parameters) => ({ verdict: parameters.expected === "ok" ? "PASS" : "FAIL", evidence: [], summary: "verified", verifiedAt: "2026-08-17T00:00:00.000Z", verifierType: "DETERMINISTIC" }) });
  registry.register({ verifierId: "failing-verifier", verify: async () => { throw new Error("raw verifier detail"); } });
  const checks = [
    { checkId: "known", kind: "FILE_STATE", verifierId: "file-state", parametersSchemaId: "schema", required: true, onUnknown: "FAIL" },
    { checkId: "missing", kind: "STATE_QUERY", verifierId: "missing-verifier", parametersSchemaId: "schema", required: true, onUnknown: "UNCERTAIN" },
    { checkId: "throws", kind: "CUSTOM_VERIFIER", verifierId: "failing-verifier", parametersSchemaId: "schema", required: false, onUnknown: "FAIL" },
  ];
  const results = await evaluateToolChecks(checks, registry, { request, manifest, targetResolution: resolution() }, () => ({ expected: "ok" }));
  assert.deepEqual(results.map((result) => result.verdict), ["PASS", "UNKNOWN", "UNKNOWN"]);
  assert.equal(results[1].summary, "tool verifier is unavailable");
  assert.equal(results[2].summary, "tool verifier failed without a trusted result");
  assert.throws(() => registry.register({ verifierId: "file-state", verify: async () => ({ verdict: "PASS", evidence: [], summary: "x", verifiedAt: "2026-08-17T00:00:00.000Z", verifierType: "DETERMINISTIC" }) }), /already registered/iu);
});

