import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const requiredFiles = [
  ".github/workflows/static-ci.yml",
  ".cargo/audit.toml",
  "tools/ci/lib.mjs",
  "tools/ci/check-format.mjs",
  "tools/ci/check-schemas.mjs",
  "tools/ci/scan-secrets.mjs",
  "tools/ci/check-dependencies.mjs",
  "tools/ci/check-provenance.mjs",
  "tools/ci/generate-evidence.mjs",
  "third_party/provenance.json",
  "third_party/security-tools.json",
  "third_party/SECURITY_TOOL_NOTICES.md",
  "THIRD_PARTY_NOTICES.md",
  "tsconfig.build.json",
];

test("0.11 static CI baseline artifacts exist", () => {
  for (const path of requiredFiles) {
    assert.ok(existsSync(resolve(root, path)), `missing required 0.11 artifact: ${path}`);
  }
});

test("static CI workflow is least-privileged and uses immutable action SHAs", { skip: !existsSync(resolve(root, ".github/workflows/static-ci.yml")) }, () => {
  const workflow = readFileSync(resolve(root, ".github/workflows/static-ci.yml"), "utf8");
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(workflow, /permissions:\s*write-all/);
  const uses = [...workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+).*$/gm)].map((match) => match[1]);
  assert.ok(uses.length >= 2, "expected pinned checkout/runtime setup actions");
  for (const specifier of uses) {
    if (specifier.startsWith("./")) continue;
    assert.match(specifier, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/);
  }
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /pnpm audit --audit-level high/);
  assert.match(workflow, /cargo install cargo-audit --locked --version 0\.22\.2 --no-default-features/);
  assert.match(workflow, /cargo audit --file Cargo\.lock --target-os windows --target-arch x86_64/);
  assert.match(workflow, /cargo clippy[^\n]*-D warnings/);
  assert.match(workflow, /rustup toolchain install 1\.97\.1 --component rustfmt --component clippy --target x86_64-pc-windows-msvc/);
  const nativeGateMarker = "- name: Windows native process qualification";
  const nativeGateStart = workflow.indexOf(nativeGateMarker);
  assert.notEqual(nativeGateStart, -1, "expected the native Windows qualification gate");
  const nativeGateEnd = workflow.indexOf("\n      - name:", nativeGateStart + nativeGateMarker.length);
  const nativeGate = workflow.slice(
    nativeGateStart,
    nativeGateEnd === -1 ? workflow.length : nativeGateEnd,
  );
  assert.match(
    nativeGate,
    /run: cargo test --locked -p jarvis-windows-native --features test-support --test windows_process_qualification -- --test-threads=1/,
  );
  assert.doesNotMatch(nativeGate, /continue-on-error:\s*true/);
  assert.ok(
    workflow.indexOf("- name: Desktop Tauri production build") < nativeGateStart,
    "native qualification must follow the production Tauri build",
  );
});

test("package scripts expose every static CI gate", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  for (const name of ["format:check", "schema:check", "security:secrets", "dependency:check", "provenance:check", "build", "ci:evidence"]) {
    assert.equal(typeof pkg.scripts?.[name], "string", `missing script ${name}`);
  }
});
