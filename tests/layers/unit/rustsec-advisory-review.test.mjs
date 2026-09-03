import test from "node:test";
import assert from "node:assert/strict";
import {
  checkRustsecAdvisories,
} from "../../../tools/ci/check-rustsec-advisories.mjs";
import { buildCiEvidence } from "../../../tools/ci/generate-evidence.mjs";

const TARGET = "x86_64-pc-windows-msvc";

function advisory(kind, id, name, version) {
  return {
    kind,
    advisory: { id },
    package: { name, version },
  };
}

function auditReport(warnings = {}, vulnerabilities = []) {
  return {
    vulnerabilities: {
      found: vulnerabilities.length > 0,
      count: vulnerabilities.length,
      list: vulnerabilities,
    },
    warnings,
  };
}

function cargoMetadata(packages) {
  return {
    version: 1,
    packages: packages.map(({ id, name, version }) => ({ id, name, version })),
    resolve: {
      nodes: packages.map(({ id }) => ({ id, dependencies: [], deps: [], features: [] })),
      root: null,
    },
  };
}

function reviewed({
  kind = "unmaintained",
  id = "RUSTSEC-2025-0100",
  name = "unic-ucd-ident",
  version = "0.9.0",
  windowsResolved = true,
  disposition = "REVIEWED_WINDOWS_TRANSITIVE_INFORMATIONAL",
} = {}) {
  return {
    schemaVersion: 1,
    target: TARGET,
    auditTool: { name: "cargo-audit", version: "0.22.2" },
    warnings: [
      {
        kind,
        advisoryId: id,
        package: { name, version },
        windowsResolved,
        disposition,
        rationale:
          "Reviewed deterministic fixture with enough detail to satisfy the checked rationale requirement.",
      },
    ],
  };
}

function codes(result) {
  return result.violations.map((entry) => entry.code);
}

test("exact reviewed Windows-resolved unmaintained warning passes", () => {
  const result = checkRustsecAdvisories({
    auditReport: auditReport({
      unmaintained: [
        advisory("unmaintained", "RUSTSEC-2025-0100", "unic-ucd-ident", "0.9.0"),
      ],
    }),
    cargoMetadata: cargoMetadata([
      { id: "registry+test#unic-ucd-ident@0.9.0", name: "unic-ucd-ident", version: "0.9.0" },
    ]),
    review: reviewed(),
  });
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.summary, {
    warnings: 1,
    windowsResolved: 1,
    windowsUnresolved: 0,
  });
});

test("new live RustSec warning fails closed", () => {
  const result = checkRustsecAdvisories({
    auditReport: auditReport({
      unmaintained: [
        advisory("unmaintained", "RUSTSEC-2025-0100", "unic-ucd-ident", "0.9.0"),
        advisory("unmaintained", "RUSTSEC-2099-0001", "future-crate", "1.0.0"),
      ],
    }),
    cargoMetadata: cargoMetadata([
      { id: "registry+test#unic-ucd-ident@0.9.0", name: "unic-ucd-ident", version: "0.9.0" },
      { id: "registry+test#future-crate@1.0.0", name: "future-crate", version: "1.0.0" },
    ]),
    review: reviewed(),
  });
  assert.ok(codes(result).includes("RUSTSEC_WARNING_UNREVIEWED"));
});

test("stale checked warning fails closed", () => {
  const result = checkRustsecAdvisories({
    auditReport: auditReport({}),
    cargoMetadata: cargoMetadata([]),
    review: reviewed(),
  });
  assert.ok(codes(result).includes("RUSTSEC_REVIEW_STALE"));
});

test("Windows target-resolution drift fails closed", () => {
  const result = checkRustsecAdvisories({
    auditReport: auditReport({
      unmaintained: [
        advisory("unmaintained", "RUSTSEC-2025-0100", "unic-ucd-ident", "0.9.0"),
      ],
    }),
    cargoMetadata: cargoMetadata([]),
    review: reviewed(),
  });
  assert.ok(codes(result).includes("RUSTSEC_REACHABILITY_DRIFT"));
});

test("Windows-resolved unsound advisory is a hard failure", () => {
  const result = checkRustsecAdvisories({
    auditReport: auditReport({
      unsound: [advisory("unsound", "RUSTSEC-2024-0429", "glib", "0.18.5")],
    }),
    cargoMetadata: cargoMetadata([
      { id: "registry+test#glib@0.18.5", name: "glib", version: "0.18.5" },
    ]),
    review: reviewed({
      kind: "unsound",
      id: "RUSTSEC-2024-0429",
      name: "glib",
      version: "0.18.5",
      windowsResolved: true,
      disposition: "REVIEWED_WINDOWS_TRANSITIVE_INFORMATIONAL",
    }),
  });
  assert.ok(codes(result).includes("RUSTSEC_REACHABLE_UNSOUND"));
});

test("vulnerability finding is always a hard failure", () => {
  const result = checkRustsecAdvisories({
    auditReport: auditReport({}, [{ advisory: { id: "RUSTSEC-2099-9999" } }]),
    cargoMetadata: cargoMetadata([]),
    review: {
      schemaVersion: 1,
      target: TARGET,
      auditTool: { name: "cargo-audit", version: "0.22.2" },
      warnings: [],
    },
  });
  assert.ok(codes(result).includes("RUSTSEC_VULNERABILITY_FOUND"));
});

test("unknown RustSec warning kind fails closed", () => {
  const result = checkRustsecAdvisories({
    auditReport: auditReport({
      future_kind: [
        advisory("future_kind", "RUSTSEC-2099-0002", "future-crate", "1.0.0"),
      ],
    }),
    cargoMetadata: cargoMetadata([]),
    review: {
      schemaVersion: 1,
      target: TARGET,
      auditTool: { name: "cargo-audit", version: "0.22.2" },
      warnings: [],
    },
  });
  assert.ok(codes(result).includes("RUSTSEC_WARNING_KIND_UNKNOWN"));
});

test("target-unresolved warning requires target-unresolved disposition", () => {
  const result = checkRustsecAdvisories({
    auditReport: auditReport({
      unmaintained: [
        advisory("unmaintained", "RUSTSEC-2024-0370", "proc-macro-error", "1.0.4"),
      ],
    }),
    cargoMetadata: cargoMetadata([]),
    review: reviewed({
      id: "RUSTSEC-2024-0370",
      name: "proc-macro-error",
      version: "1.0.4",
      windowsResolved: false,
      disposition: "REVIEWED_WINDOWS_TRANSITIVE_INFORMATIONAL",
    }),
  });
  assert.ok(codes(result).includes("RUSTSEC_REVIEW_DISPOSITION_INVALID"));
});

test("Phase-0 PASS evidence requires the RustSec warning review gate", () => {
  const common = {
    GITHUB_SHA: "a".repeat(40),
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_REF: "refs/heads/test",
    RUNNER_OS: "Windows",
    RUNNER_ARCH: "X64",
    JARVIS_STATIC_CI_GATES_PASSED: "1",
    JARVIS_PHASE0_CHECKPOINT_PASSED: "1",
    JARVIS_WINDOWS_TAURI_GATES_PASSED: "1",
    JARVIS_RUST_AUDIT_PASSED: "1",
  };
  const versions = {
    node: "24.18.0",
    pnpm: "11.21.0",
    typescript: "6.0.3",
    rust: "1.97.1",
    cargo: "1.97.1",
  };

  assert.throws(
    () =>
      buildCiEvidence({
        env: common,
        versions,
        contractSuiteVersion: "1.0.7",
        governanceMode: "COMPENSATING_CONTROLS",
      }),
    /JARVIS_RUSTSEC_REVIEW_PASSED/,
  );

  const evidence = buildCiEvidence({
    env: { ...common, JARVIS_RUSTSEC_REVIEW_PASSED: "1" },
    versions,
    contractSuiteVersion: "1.0.7",
    governanceMode: "COMPENSATING_CONTROLS",
  });
  assert.ok(evidence.gates.includes("rustsec-informational-warning-review"));
});
