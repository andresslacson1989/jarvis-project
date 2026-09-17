import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { checkFormat } from "../../../tools/ci/check-format.mjs";
import { checkSchemas, validateBootstrapIdentityArtifacts, validateSchemaInstance } from "../../../tools/ci/check-schemas.mjs";
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

const identityArtifactPaths = Object.freeze([
  "packages/schemas/src/canonical/v1/contract-values.schema.json",
  "packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json",
  "packages/schemas/src/config/v1/bootstrap-configuration.schema.json",
  "packages/protocol/src/config.ts",
]);

async function identityArtifactFixture() {
  const repositoryRoot = resolve(import.meta.dirname, "..", "..", "..");
  return Object.fromEntries(await Promise.all(identityArtifactPaths.map(async (path) => [path, await readFile(resolve(repositoryRoot, path), "utf8")])));
}

function mutateJsonFile(files, path, mutate) {
  const value = JSON.parse(files[path]);
  mutate(value);
  files[path] = `${JSON.stringify(value)}\n`;
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

test("format checker excludes preserved Tauri runtime artifacts but not adjacent source", async () => {
  const root = await tempRepo({
    "apps/desktop/src-tauri/gen/generated.json": "{\r\n}\r\n",
    "apps/desktop/src-tauri/resources/generated.txt": "generated\r\n",
    "apps/desktop/src-tauri/src/main.rs": "fn main() {}\n",
  });
  assert.deepEqual((await checkFormat(root)).violations, []);
  await writeFile(resolve(root, "apps/desktop/src-tauri/src/main.rs"), "fn main() {}\r\n");
  assert.ok(codes(await checkFormat(root)).includes("FORMAT_CRLF"));
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

test("canonical contract values strictly validate CI authority and distinct release-profile identity", async () => {
  const root = resolve(import.meta.dirname, "..", "..", "..");
  const schema = JSON.parse(await readFile(resolve(root, "packages/schemas/src/canonical/v1/contract-values.schema.json"), "utf8"));
  const canonical = JSON.parse(await readFile(resolve(root, "packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json"), "utf8"));
  assert.deepEqual(validateSchemaInstance(schema, canonical), { valid: true, errors: [] });

  const mutations = [
    (value) => { delete value.ciAuthorities; },
    (value) => { value.ciAuthorities = "GITHUB_ACTIONS"; },
    (value) => { value.ciAuthorities.selectedType = "LOCALCI"; },
    (value) => { value.ciAuthorities.eligibleTypes = ["LOCALCI"]; },
    (value) => { value.ciAuthorities.pipelineIdentity = "other-ci"; },
    (value) => { value.ciAuthorities.unknown = true; },
    (value) => { value.unknown = true; },
    (value) => { value.releaseProfileVersion = value.contractSuiteVersion; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(canonical);
    mutate(value);
    assert.equal(validateSchemaInstance(schema, value).valid, false);
  }
});

test("bootstrap identity artifacts fail closed on missing, swapped, conflated, unsupported, mismatched, or extra identity", async () => {
  const cleanFiles = await identityArtifactFixture();
  const clean = await tempRepo(cleanFiles);
  assert.deepEqual((await validateBootstrapIdentityArtifacts(clean)).violations, []);
  assert.deepEqual((await checkSchemas(clean)).violations, []);

  const mutations = [
    {
      name: "missing identity",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_FIELD_MISSING",
      mutate(files) {
        mutateJsonFile(files, "packages/schemas/src/config/v1/bootstrap-configuration.schema.json", (value) => {
          delete value.properties.releaseProfileVersion;
          value.required = value.required.filter((field) => field !== "releaseProfileVersion");
        });
      },
    },
    {
      name: "swapped suite and profile",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_UNSUPPORTED",
      mutate(files) {
        mutateJsonFile(files, "packages/schemas/src/config/v1/bootstrap-configuration.schema.json", (value) => {
          value.properties.contractSuiteVersion.const = "1.0.9";
          value.properties.releaseProfileVersion.const = "1.0.8";
        });
      },
    },
    {
      name: "conflated suite and profile",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_UNSUPPORTED",
      mutate(files) {
        mutateJsonFile(files, "packages/schemas/src/config/v1/bootstrap-configuration.schema.json", (value) => {
          value.properties.releaseProfileVersion.const = value.properties.contractSuiteVersion.const;
        });
      },
    },
    {
      name: "unsupported suite version",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_UNSUPPORTED",
      mutate(files) {
        mutateJsonFile(files, "packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json", (value) => {
          value.contractSuiteVersion = "9.9.9";
        });
      },
    },
    {
      name: "protocol source mismatch",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_MISMATCH",
      mutate(files) {
        files["packages/protocol/src/config.ts"] = files["packages/protocol/src/config.ts"].replace('releaseProfileVersion: "1.0.9";', 'releaseProfileVersion: "1.0.8";');
      },
    },
    {
      name: "canonical ID mismatch",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_MISMATCH",
      mutate(files) {
        mutateJsonFile(files, "packages/schemas/src/config/v1/bootstrap-configuration.schema.json", (value) => {
          value.properties.canonicalValuesId.const = "jarvis.contract-values.invalid";
        });
      },
    },
    {
      name: "extra schema identity field",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_FIELD_EXTRA",
      mutate(files) {
        mutateJsonFile(files, "packages/schemas/src/config/v1/bootstrap-configuration.schema.json", (value) => {
          value.properties.manifestVersion = { const: "1.0.8" };
          value.required.push("manifestVersion");
        });
      },
    },
    {
      name: "extra protocol identity field",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_FIELD_EXTRA",
      mutate(files) {
        files["packages/protocol/src/config.ts"] = files["packages/protocol/src/config.ts"].replace("  protocolMajor: 1;", '  protocolMajor: 1;\n  manifestVersion: "1.0.8";');
      },
    },
    {
      name: "missing protocol artifact",
      expected: "SCHEMA_BOOTSTRAP_IDENTITY_ARTIFACT_MISSING",
      mutate(files) {
        delete files["packages/protocol/src/config.ts"];
      },
    },
  ];

  for (const item of mutations) {
    const files = await identityArtifactFixture();
    item.mutate(files);
    const root = await tempRepo(files);
    assert.ok(codes(await validateBootstrapIdentityArtifacts(root)).includes(item.expected), `${item.name} should produce ${item.expected}`);
    assert.ok(codes(await checkSchemas(root)).includes(item.expected), `${item.name} should fail the official schema command`);
  }
});

test("official schema verification fails closed on canonical contract-value drift", async () => {
  const files = await identityArtifactFixture();
  const root = await tempRepo(files);
  assert.deepEqual((await checkSchemas(root)).violations, []);

  const drifted = JSON.parse(files["packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json"]);
  drifted.ciAuthorities.pipelineIdentity = "unqualified-ci";
  await writeFile(resolve(root, "packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json"), `${JSON.stringify(drifted)}\n`);
  assert.ok(codes(await checkSchemas(root)).includes("SCHEMA_CANONICAL_INSTANCE_INVALID"));
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
    contractSuiteVersion: "1.0.8",
    governanceMode: "COMPENSATING_CONTROLS",
  });

  assert.equal(evidence.schemaVersion, 2);
  assert.equal(evidence.scope, "PHASE_0_STATIC_CI");
  assert.equal(evidence.checkpoint, "0.CP");
  assert.equal(evidence.status, "PASS");
  assert.equal(evidence.contractSuiteVersion, "1.0.8");
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
