import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

test("Rust dependency vulnerability audit is exact-pinned, provenance-tracked, mandatory, and least-privileged", () => {
  const workflow = read(".github/workflows/static-ci.yml");
  const baseline = readJson("tools/toolchain/toolchain-baseline.json");
  const provenance = readJson("third_party/provenance.json");

  assert.equal(baseline.cargoAudit?.version, "0.22.2", "cargo-audit must be pinned in the canonical toolchain baseline");

  const auditTool = provenance.toolchains?.find((record) => record.name === "cargo-audit");
  assert.ok(auditTool, "cargo-audit must be present in approved toolchain provenance");
  assert.equal(auditTool.version, "0.22.2");
  assert.equal(auditTool.reviewStatus, "APPROVED");

  assert.match(workflow, /^permissions:\s*\n\s+contents:\s*read\s*$/m, "workflow must retain contents: read least privilege");
  assert.doesNotMatch(workflow, /^\s+checks:\s*write\s*$/m, "Rust audit must not require Checks API write permission");
  assert.doesNotMatch(workflow, /^\s+issues:\s*write\s*$/m, "Rust audit must not require issue-write permission");

  assert.match(workflow, /- name:\s*Install pinned cargo-audit[\s\S]*?cargo install cargo-audit --locked --version 0\.22\.2\b/);
  assert.match(workflow, /- name:\s*Verify pinned cargo-audit[\s\S]*?cargo audit --version[\s\S]*?0\.22\.2/);
  assert.match(workflow, /- name:\s*Rust dependency vulnerability audit[\s\S]*?run:\s*cargo audit\b/);

  const auditIndex = workflow.indexOf("- name: Rust dependency vulnerability audit");
  const evidenceIndex = workflow.indexOf("- name: Static CI evidence");
  assert.ok(auditIndex >= 0, "Rust dependency vulnerability audit step must exist");
  assert.ok(evidenceIndex >= 0, "Static CI evidence step must exist");
  assert.ok(auditIndex < evidenceIndex, "Rust dependency vulnerability audit must pass before CI evidence can be emitted");
});
