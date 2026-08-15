import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildContextPackage } from "../../../packages/protocol/src/content-authority-runtime.mts";
import { validateMemoryRetrievalRequest } from "../../../packages/protocol/src/memory-runtime.mts";
import { resolveApplicableTrustedProjectPolicies } from "../../../packages/protocol/src/project-policy-runtime.mts";

const matrixPath = new URL("../../../docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md", import.meta.url);
const NOW = "2026-08-15T00:00:00.000Z";

function trusted(policyTrustId, canonicalRelativePath, canonicalScopeRoot) {
  return { policyTrustId, projectId: "project-1", canonicalRelativePath, canonicalScopeRoot, contentSha256: "a".repeat(64), state: "TRUSTED", acceptedAt: NOW, acceptedSessionId: "session-1", revision: 1 };
}

test("Section 6 checkpoint requires every project/context/memory child and integrated trust boundaries", async () => {
  const matrix = await readFile(matrixPath, "utf8");
  for (let index = 1; index <= 15; index += 1) {
    assert.match(matrix, new RegExp(`\\| ↳ \\*\\*6\\.${index}\\*\\*[^\\n]*\\| \\*\\*VERIFIED\\*\\* \\|`), `6.${index} is not VERIFIED`);
  }
  assert.match(matrix, /\| \*\*SECTION 6 — Projects \/ Scopes \/ Context \/ Memory \/ Project-Policy Trust\*\* \| \*\*VERIFIED\*\* \|/);
  assert.match(matrix, /\| ↳ \*\*6\.CP\*\*[^\n]*\| \*\*VERIFIED\*\* \|/);

  const applicable = resolveApplicableTrustedProjectPolicies([
    trusted("policy-parent", "AGENTS.md", "C:/work/jarvis"),
    trusted("policy-child", "services/AGENTS.md", "C:/work/jarvis/services"),
  ], "C:/work/jarvis/services/api/file.ts");
  assert.deepEqual(applicable.map((policy) => policy.policyTrustId), ["policy-parent", "policy-child"]);
  const context = buildContextPackage({
    domain: "jarvis.context-package.v1",
    schemaVersion: 1,
    contextId: "context-checkpoint",
    projectId: "project-1",
    items: [{ itemId: "policy-child", sourceLabel: { domain: "jarvis.content-authority.label.v1", schemaVersion: 1, sourceType: "PROJECT_POLICY", sourceId: "policy-child", authorityClass: "SCOPED_INSTRUCTION", resolutionId: "resolution-1" }, policyRevision: 1, content: "Scoped project instruction." }],
  });
  assert.equal(context.items[0].sourceLabel.authorityClass, "SCOPED_INSTRUCTION");
  assert.deepEqual(validateMemoryRetrievalRequest({ requestId: "memory-checkpoint", applicableScopes: [{ kind: "PROJECT", scopeId: "project-1" }], queryTerms: ["verified"], dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" }, limit: 8, now: NOW, authoritativeSourceIds: ["live-state-1"] }).applicableScopes, [{ kind: "PROJECT", scopeId: "project-1" }]);
});
