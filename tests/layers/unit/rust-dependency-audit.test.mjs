import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

test("Rust dependency vulnerability audit is exact-pinned, provenance-tracked, mandatory, target-scoped, and least-privileged", () => {
  const workflow = read(".github/workflows/static-ci.yml");
  const auditConfig = read(".cargo/audit.toml");
  const securityTools = readJson("third_party/security-tools.json");
  const evidenceGenerator = read("tools/ci/generate-evidence.mjs");

  assert.equal(securityTools.schemaVersion, 1);
  const auditTool = securityTools.tools?.find((record) => record.name === "cargo-audit");
  assert.ok(auditTool, "cargo-audit must be present in approved CI security-tool provenance");
  assert.equal(auditTool.version, "0.22.2");
  assert.equal(auditTool.ecosystem, "cargo");
  assert.equal(auditTool.role, "DEPENDENCY_VULNERABILITY_SCAN");
  assert.equal(auditTool.packaged, false);
  assert.equal(auditTool.reviewStatus, "APPROVED");
  assert.equal(
    auditTool.installCommand,
    "cargo install cargo-audit --locked --version 0.22.2 --no-default-features",
  );

  assert.match(auditConfig, /^\[advisories\][\s\S]*?ignore\s*=\s*\[\][\s\S]*?severity_threshold\s*=\s*"none"/m);
  assert.match(auditConfig, /^\[database\][\s\S]*?fetch\s*=\s*true[\s\S]*?stale\s*=\s*false/m);
  assert.match(auditConfig, /^\[target\][\s\S]*?arch\s*=\s*\["x86_64"\][\s\S]*?os\s*=\s*\["windows"\]/m);

  assert.match(workflow, /^permissions:\s*\n\s+contents:\s*read\s*$/m, "workflow must retain contents: read least privilege");
  assert.doesNotMatch(workflow, /^\s+checks:\s*write\s*$/m, "Rust audit must not require Checks API write permission");
  assert.doesNotMatch(workflow, /^\s+issues:\s*write\s*$/m, "Rust audit must not require issue-write permission");

  assert.match(workflow, /- name:\s*Install pinned cargo-audit[\s\S]*?cargo install cargo-audit --locked --version 0\.22\.2 --no-default-features\b/);
  assert.match(workflow, /- name:\s*Verify pinned cargo-audit[\s\S]*?cargo audit --version[\s\S]*?0\\\.22\\\.2\$/);

  const auditStepStart = workflow.indexOf("- name: Rust dependency vulnerability audit");
  const evidenceStepStart = workflow.indexOf("- name: Static CI evidence");
  assert.ok(auditStepStart >= 0, "Rust dependency vulnerability audit step must exist");
  assert.ok(evidenceStepStart >= 0, "Static CI evidence step must exist");
  assert.ok(auditStepStart < evidenceStepStart, "Rust dependency vulnerability audit must pass before CI evidence can be emitted");
  const auditStep = workflow.slice(auditStepStart, workflow.indexOf("\n      - name:", auditStepStart + 1));
  assert.match(auditStep, /cargo audit --file Cargo\.lock --target-os windows --target-arch x86_64\b/);
  for (const forbidden of ["--ignore", "--no-fetch", "--stale", "--no-yanked"]) {
    assert.ok(!auditStep.includes(forbidden), `Rust dependency audit must not weaken scanning with ${forbidden}`);
  }

  assert.match(workflow, /JARVIS_RUST_AUDIT_PASSED:\s*'1'/);
  assert.match(evidenceGenerator, /"rust-dependency-vulnerability-rustsec"/);
  assert.match(evidenceGenerator, /JARVIS_RUST_AUDIT_PASSED=1 is required for PASS evidence/);
});

test("RustSec informational warnings require explicit Windows target-resolution review before PASS evidence", () => {
  const reviewPath = resolve(root, "third_party", "rustsec-advisory-review.json");
  const checkerPath = resolve(root, "tools", "ci", "check-rustsec-advisories.mjs");

  assert.equal(
    existsSync(reviewPath),
    true,
    "third_party/rustsec-advisory-review.json must record the exact reviewed RustSec informational-warning set",
  );
  assert.equal(
    existsSync(checkerPath),
    true,
    "tools/ci/check-rustsec-advisories.mjs must fail closed on advisory/target-resolution drift",
  );

  const workflow = read(".github/workflows/static-ci.yml");
  const evidenceGenerator = read("tools/ci/generate-evidence.mjs");

  assert.match(
    workflow,
    /cargo metadata --locked --format-version 1 --all-features --filter-platform x86_64-pc-windows-msvc/,
    "CI must derive the actual Windows-resolved Cargo dependency graph with the same all-features selection used by qualification",
  );
  assert.match(
    workflow,
    /cargo audit --json --file Cargo\.lock --target-os windows --target-arch x86_64/,
    "CI must preserve machine-readable RustSec findings for deterministic review",
  );
  assert.match(
    workflow,
    /node tools\/ci\/check-rustsec-advisories\.mjs/,
    "CI must compare live RustSec findings and Windows target resolution with the reviewed warning set",
  );
  assert.match(
    workflow,
    /JARVIS_RUSTSEC_REVIEW_PASSED:\s*'1'/,
    "PASS evidence must be conditioned on the reviewed RustSec-warning gate",
  );
  assert.match(
    evidenceGenerator,
    /JARVIS_RUSTSEC_REVIEW_PASSED=1 is required for PASS evidence/,
    "evidence generation must fail closed if RustSec warning review did not pass",
  );
});
