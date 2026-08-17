import assert from "node:assert/strict";
import test from "node:test";
import {
  GIT_BRANCH_TOOL_MANIFEST,
  GIT_DIFF_TOOL_MANIFEST,
  GIT_LOG_TOOL_MANIFEST,
  GIT_STATUS_TOOL_MANIFEST,
  ToolGitValidationError,
  createGitReadAdapter,
  validateGitReadInput,
  validateGitReadOutput,
} from "../../../packages/protocol/src/tool-git.mjs";

const base = { projectId: "jarvis", workspaceId: "primary" };
const identity = { projectId: "jarvis", workspaceId: "primary", workspaceIdentity: "workspace.jarvis.primary", repositoryIdentity: "repo.jarvis" };
const now = "2026-08-17T00:00:00.000Z";
const commit = "a".repeat(40);

test("Git read manifests are local-only, read-only, bounded, and reject unsafe input/output", () => {
  for (const manifest of [GIT_STATUS_TOOL_MANIFEST, GIT_BRANCH_TOOL_MANIFEST, GIT_DIFF_TOOL_MANIFEST, GIT_LOG_TOOL_MANIFEST]) {
    assert.equal(manifest.sideEffectClass, "READ_ONLY");
    assert.equal(manifest.networkRequired, false);
    assert.deepEqual(manifest.allowedScopeKinds, ["PROJECT_WORKSPACE"]);
    assert.deepEqual(manifest.platformCompatibility, [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }]);
  }
  assert.deepEqual(validateGitReadInput({ operation: "STATUS", ...base, maxEntries: 20 }), { operation: "STATUS", ...base, maxEntries: 20 });
  assert.deepEqual(validateGitReadInput({ operation: "BRANCH", ...base }), { operation: "BRANCH", ...base });
  assert.throws(() => validateGitReadInput({ operation: "DIFF", ...base, maxBytes: 4_194_305 }), ToolGitValidationError);
  assert.throws(() => validateGitReadInput({ operation: "LOG", ...base, maxEntries: 10, maxBytes: 100, command: "status" }), ToolGitValidationError);
  assert.throws(() => validateGitReadOutput({ operation: "STATUS", ...identity, branch: "master", headCommit: commit, entries: [{ path: "../outside", indexState: "MODIFIED", worktreeState: "CLEAN" }], truncated: false, observedAt: now }), ToolGitValidationError);
  assert.deepEqual(validateGitReadOutput({ operation: "DIFF", ...identity, patch: "", bytes: 0, truncated: false, observedAt: now }).patch, "");
  assert.deepEqual(validateGitReadOutput({ operation: "LOG", ...identity, entries: [], bytes: 0, truncated: false, observedAt: now }).entries, []);
});

test("Git adapter delegates only the selected typed operation and validates bounded evidence", async () => {
  const calls = [];
  const adapter = createGitReadAdapter({
    readStatus: async (input) => { calls.push(["STATUS", input]); return { operation: "STATUS", ...identity, branch: "master", headCommit: commit, entries: [], truncated: false, observedAt: now }; },
    readBranch: async (input) => { calls.push(["BRANCH", input]); return { operation: "BRANCH", ...identity, branch: "master", headCommit: commit, upstream: "origin/master", ahead: 0, behind: 0, observedAt: now }; },
    readDiff: async (input) => { calls.push(["DIFF", input]); return { operation: "DIFF", ...identity, patch: "x", bytes: 1, truncated: false, observedAt: now }; },
    readLog: async (input) => { calls.push(["LOG", input]); return { operation: "LOG", ...identity, entries: [{ commit, author: "JARVIS", authoredAt: now, subject: "checkpoint" }], bytes: 10, truncated: false, observedAt: now }; },
  }, "BRANCH");
  const result = await adapter.execute({ arguments: { operation: "BRANCH", ...base } });
  assert.equal(result.operation, "BRANCH");
  assert.deepEqual(calls.map(([operation]) => operation), ["BRANCH"]);
  assert.deepEqual(validateGitReadOutput(result), result);
  await assert.rejects(() => adapter.execute({ arguments: { operation: "STATUS", ...base, maxEntries: 10 } }), ToolGitValidationError);
});
