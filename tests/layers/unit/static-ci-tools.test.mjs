import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { checkFormat } from "../../../tools/ci/check-format.mjs";
import { checkSchemas } from "../../../tools/ci/check-schemas.mjs";
import { scanSecrets } from "../../../tools/ci/scan-secrets.mjs";
import { checkDependencies } from "../../../tools/ci/check-dependencies.mjs";
import { checkProvenance } from "../../../tools/ci/check-provenance.mjs";
import { buildCiEvidence } from "../../../tools/ci/generate-evidence.mjs";

async function tempRepo(files = {}) {
  const root = await mkdtemp(resolve(tmpdir(), "jarvis-ci-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), content);
  }
  return root;
}

function codes(result) {
  return result.violations.map((item) => item.code);
}

test("format checker accepts clean LF text and rejects deterministic hygiene violations", async () => {
  const clean = await tempRepo({
    "packages/a/src/a.ts": "export const a = 1;\n",
    "docs/normative-contract.md": "Normative Markdown may preserve deliberate trailing spaces.  \n",
  });
  assert.deepEqual((await checkFormat(clean)).violations, []);

  const dirty = await tempRepo({
    "packages/a/src/a.ts": "export\tconst a = 1;  \r\n",
    "tests/x.mjs": "export const x = 1;",
  });
  const dirtyCodes = codes(await checkFormat(dirty));
  for (const code of ["FORMAT_CRLF", "FORMAT_TRAILING_WHITESPACE", "FORMAT_TAB", "FORMAT_FINAL_NEWLINE"]) {
    assert.ok(dirtyCodes.includes(code), `expected ${code}`);
  }
});

test("schema checker rejects malformed, duplicate, escaping, and unresolved schema references", async () => {
  const valid = await tempRepo({
    "packages/schemas/src/a.schema.json": JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", $id: "urn:test:a", type: "object" }) + "\n",
  });
  assert.deepEqual((await checkSchemas(valid)).violations, []);

  const invalid = await tempRepo({
    "packages/schemas/src/a.schema.json": JSON.stringify({ $schema: "http://json-schema.org/draft-07/schema#", $id: "urn:test:dup", $ref: "missing.schema.json" }) + "\n",
    "packages/schemas/src/b.schema.json": JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", $id: "urn:test:dup", $ref: "../../../outside.schema.json" }) + "\n",
    "packages/schemas/src/c.schema.json": "{not json\n",
  });
  const invalidCodes = codes(await checkSchemas(invalid));
  for (const code of ["SCHEMA_INVALID_JSON", "SCHEMA_WRONG_DRAFT", "SCHEMA_DUPLICATE_ID", "SCHEMA_UNRESOLVED_REF", "SCHEMA_REF_ESCAPE"]) {
    assert.ok(invalidCodes.includes(code), `expected ${code}`);
  }
});

test("secret scanner rejects likely credentials while allowing explicit synthetic placeholders", async () => {
  const fakeGithubToken = `ghp_${"A".repeat(36)}`;
  const root = await tempRepo({
    "packages/a/src/clean.ts": 'export const token = "SYNTHETIC";\n',
    "packages/a/src/leak.ts": `export const x = "${fakeGithubToken}";\nexport const api_${"key"} = "${"this-is-a-" + "probable-literal-secret"}";\n`,
    ".env": "TOKEN=should-not-exist\n",
    ".env.example": "TOKEN=<token>\n",
  });
  const resultCodes = codes(await scanSecrets(root));
  assert.ok(resultCodes.includes("SECRET_HIGH_CONFIDENCE"));
  assert.ok(resultCodes.includes("SECRET_LITERAL_ASSIGNMENT"));
  assert.ok(resultCodes.includes("SECRET_ENV_FILE"));
  assert.equal(resultCodes.filter((code) => code === "SECRET_ENV_FILE").length, 1);
});

test("dependency checker requires exact npm pins and provenance for every lockfile package", async () => {
  const root = await tempRepo({
    "package.json": JSON.stringify({ private: true, dependencies: { alpha: "^1.0.0" }, devDependencies: { typescript: "6.0.3" } }) + "\n",
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\npackages:\n  alpha@1.2.0:\n    resolution: {integrity: sha512-test}\n  typescript@6.0.3:\n    resolution: {integrity: sha512-test}\nsnapshots:\n  alpha@1.2.0: {}\n  typescript@6.0.3: {}\n",
    "Cargo.lock": "version = 4\n\n[[package]]\nname = \"external-rust\"\nversion = \"1.0.0\"\nsource = \"registry+https://github.com/rust-lang/crates.io-index\"\n",
    "third_party/provenance.json": JSON.stringify({ schemaVersion: 1, dependencies: [{ ecosystem: "npm", name: "typescript", version: "6.0.3", reviewStatus: "APPROVED" }], ciActions: [], toolchains: [] }) + "\n",
  });
  const resultCodes = codes(await checkDependencies(root));
  assert.ok(resultCodes.includes("DEPENDENCY_NON_EXACT_PIN"));
  assert.ok(resultCodes.includes("DEPENDENCY_UNREVIEWED_NPM"));
  assert.ok(resultCodes.includes("DEPENDENCY_UNREVIEWED_CARGO"));
});

test("peer dependency compatibility ranges are not treated as installed dependency pins", async () => {
  const root = await tempRepo({
    "package.json": JSON.stringify({ private: true, peerDependencies: { react: "^19.0.0" } }) + "\n",
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\npackages:\n\nsnapshots:\n",
    "Cargo.lock": "version = 4\n",
    "third_party/provenance.json": JSON.stringify({ schemaVersion: 1, dependencies: [], ciActions: [], toolchains: [] }) + "\n",
  });
  assert.deepEqual((await checkDependencies(root)).violations, []);
});

test("provenance checker rejects floating/unknown actions, license mismatch, and toolchain drift", async () => {
  const root = await tempRepo({
    ".github/workflows/static-ci.yml": "steps:\n  - uses: actions/checkout@v7\n  - uses: unknown/action@0123456789012345678901234567890123456789\n",
    "third_party/provenance.json": JSON.stringify({
      schemaVersion: 1,
      dependencies: [{ ecosystem: "npm", name: "typescript", version: "6.0.3", license: "Apache-2.0", source: "https://example.invalid/typescript", role: "BUILD_TEST", packaged: false, reviewStatus: "APPROVED" }],
      ciActions: [{ repository: "actions/checkout", release: "v7", commit: "0123456789012345678901234567890123456789", license: "MIT", reviewStatus: "APPROVED" }],
      toolchains: [{ name: "Node.js", version: "1.0.0", license: "MIT", source: "https://example.invalid/node", role: "BUILD_RUNTIME", reviewStatus: "APPROVED" }],
    }) + "\n",
    "THIRD_PARTY_NOTICES.md": "# Notices\nTypeScript 6.0.3 Apache-2.0\nNode.js 1.0.0 MIT\nactions/checkout v7 MIT\n",
    "tools/toolchain/toolchain-baseline.json": JSON.stringify({ schemaVersion: 1, node: { version: "24.18.0" }, pnpm: { version: "11.21.0" }, rust: { version: "1.97.1" }, typescript: { version: "6.0.3" }, tauri: { runtime: "2.11.5" } }) + "\n",
    "node_modules/typescript/package.json": JSON.stringify({ name: "typescript", version: "6.0.3", license: "MIT" }) + "\n",
  });
  const resultCodes = codes(await checkProvenance(root));
  assert.ok(resultCodes.includes("PROVENANCE_FLOATING_ACTION"));
  assert.ok(resultCodes.includes("PROVENANCE_UNKNOWN_ACTION"));
  assert.ok(resultCodes.includes("PROVENANCE_INSTALLED_LICENSE_MISMATCH"));
  assert.ok(resultCodes.includes("PROVENANCE_TOOLCHAIN_MISMATCH"));
});

test("security-tool provenance accepts only approved non-packaged scanners with notices", async () => {
  const baseline = {
    schemaVersion: 1,
    node: { version: "24.18.0" },
    pnpm: { version: "11.21.0" },
    rust: { version: "1.97.1" },
    typescript: { version: "6.0.3" },
    tauri: { runtime: "2.11.5" },
  };
  const dependencies = [
    { ecosystem: "npm", name: "typescript", version: "6.0.3", license: "MIT", source: "https://example.invalid/typescript", role: "BUILD_TEST", packaged: false, reviewStatus: "APPROVED" },
  ];
  const toolchains = [
    { name: "Node.js", version: "24.18.0", license: "MIT", source: "https://example.invalid/node", role: "BUILD_RUNTIME", reviewStatus: "APPROVED" },
    { name: "pnpm", version: "11.21.0", license: "MIT", source: "https://example.invalid/pnpm", role: "BUILD_TOOL", reviewStatus: "APPROVED" },
    { name: "Rust", version: "1.97.1", license: "Apache-2.0 OR MIT", source: "https://example.invalid/rust", role: "BUILD_RUNTIME", reviewStatus: "APPROVED" },
    { name: "Tauri", version: "2.11.5", license: "Apache-2.0 OR MIT", source: "https://example.invalid/tauri", role: "DESKTOP_RUNTIME", reviewStatus: "APPROVED" },
  ];
  const mainProvenance = { schemaVersion: 1, dependencies, ciActions: [], toolchains };
  const mainNotices = [
    "TypeScript 6.0.3 MIT",
    "Node.js 24.18.0 MIT",
    "pnpm 11.21.0 MIT",
    "Rust 1.97.1 Apache-2.0 OR MIT",
    "Tauri 2.11.5 Apache-2.0 OR MIT",
  ].join("\n") + "\n";
  const approvedTool = {
    name: "cargo-audit",
    version: "0.22.2",
    ecosystem: "cargo",
    license: "Apache-2.0 OR MIT",
    source: "https://github.com/rustsec/rustsec",
    registry: "https://crates.io/crates/cargo-audit",
    role: "DEPENDENCY_VULNERABILITY_SCAN",
    packaged: false,
    installCommand: "cargo install cargo-audit --locked --version 0.22.2 --no-default-features",
    reviewStatus: "APPROVED",
  };

  const clean = await tempRepo({
    "third_party/provenance.json": JSON.stringify(mainProvenance) + "\n",
    "THIRD_PARTY_NOTICES.md": mainNotices,
    "tools/toolchain/toolchain-baseline.json": JSON.stringify(baseline) + "\n",
    "third_party/security-tools.json": JSON.stringify({ schemaVersion: 1, tools: [approvedTool] }) + "\n",
    "third_party/SECURITY_TOOL_NOTICES.md": "cargo-audit 0.22.2 Apache-2.0 OR MIT\n",
  });
  assert.deepEqual((await checkProvenance(clean)).violations, []);

  const dirty = await tempRepo({
    "third_party/provenance.json": JSON.stringify(mainProvenance) + "\n",
    "THIRD_PARTY_NOTICES.md": mainNotices,
    "tools/toolchain/toolchain-baseline.json": JSON.stringify(baseline) + "\n",
    "third_party/security-tools.json": JSON.stringify({ schemaVersion: 1, tools: [{ ...approvedTool, packaged: true, reviewStatus: "PENDING", source: "http://example.invalid" }] }) + "\n",
    "third_party/SECURITY_TOOL_NOTICES.md": "cargo-audit 0.22.2\n",
  });
  const dirtyCodes = codes(await checkProvenance(dirty));
  for (const code of ["PROVENANCE_SECURITY_TOOL_UNAPPROVED", "PROVENANCE_SECURITY_TOOL_PACKAGED", "PROVENANCE_SECURITY_TOOL_SOURCE", "PROVENANCE_SECURITY_TOOL_NOTICE"]) {
    assert.ok(dirtyCodes.includes(code), `expected ${code}`);
  }
});

test("CI evidence is Phase-0 scoped, commit-bound, and requires every aggregate prerequisite flag", () => {
  assert.throws(() => buildCiEvidence({ env: {}, versions: {} }), /GITHUB_SHA/);
  assert.throws(
    () => buildCiEvidence({ env: { GITHUB_SHA: "a".repeat(40) }, versions: {} }),
    /JARVIS_STATIC_CI_GATES_PASSED/,
  );
  assert.throws(
    () => buildCiEvidence({ env: { GITHUB_SHA: "a".repeat(40), JARVIS_STATIC_CI_GATES_PASSED: "1" }, versions: {} }),
    /JARVIS_PHASE0_CHECKPOINT_PASSED/,
  );
  assert.throws(
    () => buildCiEvidence({ env: { GITHUB_SHA: "a".repeat(40), JARVIS_STATIC_CI_GATES_PASSED: "1", JARVIS_PHASE0_CHECKPOINT_PASSED: "1" }, versions: {} }),
    /JARVIS_WINDOWS_TAURI_GATES_PASSED/,
  );
  assert.throws(
    () => buildCiEvidence({ env: { GITHUB_SHA: "a".repeat(40), JARVIS_STATIC_CI_GATES_PASSED: "1", JARVIS_PHASE0_CHECKPOINT_PASSED: "1", JARVIS_WINDOWS_TAURI_GATES_PASSED: "1" }, versions: {} }),
    /JARVIS_RUST_AUDIT_PASSED/,
  );
  assert.throws(
    () => buildCiEvidence({
      env: {
        GITHUB_SHA: "a".repeat(40),
        JARVIS_STATIC_CI_GATES_PASSED: "1",
        JARVIS_PHASE0_CHECKPOINT_PASSED: "1",
        JARVIS_WINDOWS_TAURI_GATES_PASSED: "1",
        JARVIS_RUST_AUDIT_PASSED: "1",
      },
      versions: {},
    }),
    /JARVIS_RUSTSEC_REVIEW_PASSED/,
  );

  const evidence = buildCiEvidence({
    env: {
      GITHUB_SHA: "a".repeat(40),
      GITHUB_RUN_ID: "123",
      GITHUB_RUN_ATTEMPT: "2",
      GITHUB_REF: "refs/heads/test",
      RUNNER_OS: "Linux",
      RUNNER_ARCH: "X64",
      JARVIS_STATIC_CI_GATES_PASSED: "1",
      JARVIS_PHASE0_CHECKPOINT_PASSED: "1",
      JARVIS_WINDOWS_TAURI_GATES_PASSED: "1",
      JARVIS_RUST_AUDIT_PASSED: "1",
      JARVIS_RUSTSEC_REVIEW_PASSED: "1",
    },
    versions: {
      node: "24.18.0",
      pnpm: "11.21.0",
      typescript: "6.0.3",
      rust: "1.97.1",
      cargo: "1.97.1",
    },
    contractSuiteVersion: "1.0.6",
    governanceMode: "COMPENSATING_CONTROLS",
  });

  assert.equal(evidence.schemaVersion, 2);
  assert.equal(evidence.scope, "PHASE_0_STATIC_CI");
  assert.equal(evidence.checkpoint, "0.CP");
  assert.equal(evidence.status, "PASS");
  assert.equal(evidence.contractSuiteVersion, "1.0.6");
  assert.equal(evidence.governanceMode, "COMPENSATING_CONTROLS");
  assert.equal(evidence.commitSha, "a".repeat(40));
  assert.equal(evidence.runId, "123");
  assert.ok(evidence.gates.includes("repository-governance"));
  assert.ok(evidence.gates.includes("rust-dependency-vulnerability-rustsec"));
  assert.ok(evidence.gates.includes("rustsec-informational-warning-review"));
  assert.ok(evidence.gates.includes("phase0-section-checkpoint"));
  assert.deepEqual(evidence.toolchain, {
    node: "24.18.0",
    pnpm: "11.21.0",
    typescript: "6.0.3",
    rust: "1.97.1",
    cargo: "1.97.1",
  });
});
