export const ACCEPTANCE_GATE_COMMANDS = Object.freeze([
  ["dependencies-frozen", "pnpm install --frozen-lockfile --ignore-scripts"],
  ["toolchain-exact", "pnpm toolchain:verify"],
  ["format-hygiene", "pnpm format:check"],
  ["schema-integrity", "pnpm schema:check"],
  ["contract-suite-valid", "pnpm contract:check"],
  ["repository-governance", "pnpm governance:check"],
  ["secret-scan", "pnpm security:secrets"],
  ["dependency-inventory", "pnpm dependency:check"],
  ["license-provenance", "pnpm provenance:check"],
  ["typescript-strict", "pnpm typecheck"],
  ["typescript-build", "pnpm build"],
  ["core-build", "pnpm build:core"],
  ["desktop-ui-build", "pnpm build:ui"],
  ["desktop-foundation-contract", "pnpm desktop:foundation:check"],
  ["desktop-security-contract", "pnpm desktop:security:check"],
  ["architecture-enforcement", "pnpm architecture:check"],
  ["normal-tests", "pnpm test"],
  ["dependency-vulnerability-high-plus", "pnpm audit --audit-level high"],
  ["cargo-audit-install", "cargo install cargo-audit --locked --version 0.22.2 --no-default-features"],
  ["cargo-audit-version", "sh -c 'cargo audit --version | grep -Eq \"0\\\\.22\\\\.2$\"'"],
  ["rust-dependency-vulnerability-rustsec", "cargo audit --file Cargo.lock --target-os windows --target-arch x86_64"],
  ["rustsec-audit-json", "sh -c 'cargo audit --json --file Cargo.lock --target-os windows --target-arch x86_64 >\"$1\"' sh reports/localci-rustsec-audit.json"],
  ["cargo-metadata-windows", "sh -c 'cargo metadata --locked --format-version 1 --all-features --filter-platform x86_64-pc-windows-msvc >\"$1\"' sh reports/localci-cargo-metadata-windows.json"],
  ["rustsec-informational-warning-review", "node tools/ci/check-rustsec-advisories.mjs reports/localci-rustsec-audit.json reports/localci-cargo-metadata-windows.json third_party/rustsec-advisory-review.json"],
  ["rustfmt", "cargo fmt --all -- --check"],
  ["rust-clippy-warnings-as-errors", "cargo clippy --locked --workspace --all-targets --all-features -- -D warnings"],
  ["rust-host-build", "cargo check --locked --workspace --all-targets --all-features"],
  ["rust-windows-target-build", "cargo check --locked --workspace --target x86_64-pc-windows-msvc"],
  ["windows-tauri-production-build", "pnpm --dir apps/desktop tauri build --no-bundle --target x86_64-pc-windows-msvc --ci"],
  ["phase0-section-checkpoint", "pnpm phase0:check"],
]);

const ACCEPTANCE_GATE_METADATA = Object.freeze({
  "dependencies-frozen": {
    contractClause: "J00-CODE-28; J00-CODE-29",
    evidence: "frozen dependency installation output and lockfile-consistent exit status",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the candidate can be reproduced from the pinned dependency graph.",
    distinctness: "Does not prove toolchain identity, vulnerability absence, or license/provenance completeness.",
  },
  "toolchain-exact": {
    contractClause: "J00-CODE-05; J00-CODE-06; J00-CODE-28",
    evidence: "exact Node, pnpm, Rust, and target-toolchain verification output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the declared build and verification toolchain is the exact pinned baseline.",
    distinctness: "Does not install dependencies or validate the source/build result.",
  },
  "format-hygiene": {
    contractClause: "J00-CODE-28",
    evidence: "canonical repository text-format check output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Detects repository-wide formatting and whitespace drift.",
    distinctness: "Does not replace the Rust-specific formatter gate.",
  },
  "schema-integrity": {
    contractClause: "J01-PROTO-02; J01-PROTO-27",
    evidence: "schema integrity and generated-schema validation output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves protocol/schema artifacts remain structurally valid and synchronized.",
    distinctness: "Does not validate the active contract manifest or implementation behavior.",
  },
  "contract-suite-valid": {
    contractClause: "MAN-02; MAN-06; J00-GOV-28",
    evidence: "manifest, generated-contract, and active-suite validation output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the single active manifest and its generated contract values are internally coherent.",
    distinctness: "Does not duplicate schema integrity or repository-governance policy checks.",
  },
  "repository-governance": {
    contractClause: "J00-GOV-28; J05-VER-33",
    evidence: "checked-in governance profile, current protection observation, workflow identity, and contract-text validation output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS; live GitHub observation is recorded separately",
    purpose: "Proves the selected repository governance mode and CI authority are current, fail-closed, and internally consistent.",
    distinctness: "Does not qualify the candidate commit; exact GitHub Actions execution and Phase 0 aggregation remain separate gates.",
  },
  "secret-scan": {
    contractClause: "J03-SEC-06; J03-SEC-28; J00-CODE-12",
    evidence: "repository secret-scan output with findings and exit status",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Detects prohibited credential, key, token, and sensitive-material exposure.",
    distinctness: "Does not assess third-party vulnerability or license/provenance risk.",
  },
  "dependency-inventory": {
    contractClause: "J00-CODE-29; J03-SEC-27",
    evidence: "reachable dependency inventory and policy-validation output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the dependency graph is enumerated and subject to repository policy.",
    distinctness: "Inventory is not a vulnerability scan and does not establish license/provenance approval.",
  },
  "license-provenance": {
    contractClause: "J00-CODE-29; J03-SEC-27; J05-VER-36",
    evidence: "license, source, and provenance validation output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves reachable dependencies and added assets have reviewable license/provenance identity.",
    distinctness: "Does not prove absence of known security advisories.",
  },
  "typescript-strict": {
    contractClause: "J00-CODE-05",
    evidence: "strict TypeScript compiler output with no emitted artifacts",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves TypeScript source satisfies the strict static type boundary.",
    distinctness: "Does not prove package build, bundled UI output, or native compilation.",
  },
  "typescript-build": {
    contractClause: "J00-CODE-28; J05-VER-06",
    evidence: "TypeScript build output and exit status",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the repository TypeScript build can produce its declared build outputs.",
    distinctness: "Does not replace Core, UI, or native Windows production builds.",
  },
  "core-build": {
    contractClause: "J00-CODE-02; J00-CODE-28",
    evidence: "independent Core package build output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the authoritative Core/domain package builds independently of the desktop UI.",
    distinctness: "The package boundary is distinct from the repository-wide TypeScript build and UI bundle.",
  },
  "desktop-ui-build": {
    contractClause: "J00-CODE-25; J04-UI-28; J05-VER-11",
    evidence: "bundled-local desktop UI build output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the desktop renderer bundle is buildable under the approved local-renderer boundary.",
    distinctness: "Does not prove Tauri native compilation or desktop security configuration.",
  },
  "desktop-foundation-contract": {
    contractClause: "J01-RT-02–J01-RT-05; J04-UI-08",
    evidence: "desktop foundation contract checker output, including bundled-local and no-remote checks",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the desktop foundation preserves the runtime/renderer composition contract.",
    distinctness: "Static foundation constraints are distinct from producing the UI bundle.",
  },
  "desktop-security-contract": {
    contractClause: "J03-SEC-20; J00-CODE-25; J05-VER-12",
    evidence: "Tauri capability, CSP, navigation, and security-negative checker output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves desktop security configuration does not broaden navigation, capability, or privileged exposure.",
    distinctness: "Security policy validation is distinct from native build success.",
  },
  "architecture-enforcement": {
    contractClause: "J00-CODE-03; J00-CODE-32; J05-VER-09",
    evidence: "import, dependency-cycle, platform-boundary, and forbidden-architecture checker output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves source structure preserves ownership and platform/capability boundaries.",
    distinctness: "Architecture checks are static boundary proofs, not behavior or build tests.",
  },
  "normal-tests": {
    contractClause: "J05-VER-07; J05-VER-08",
    evidence: "normal deterministic test-profile results with per-file pass/fail output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Runs the maintained unit/property/schema/safety regression layer for ordinary changes.",
    distinctness: "Behavioral regression coverage is distinct from static, build, and release qualification gates.",
  },
  "dependency-vulnerability-high-plus": {
    contractClause: "J04-OPS-26; J03-SEC-27",
    evidence: "pnpm audit High-or-higher vulnerability result",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Blocks known High-or-higher vulnerabilities in the JavaScript dependency graph.",
    distinctness: "Does not replace dependency inventory, provenance, or RustSec advisory analysis.",
  },
  "cargo-audit-install": {
    contractClause: "J03-SEC-27; J05-VER-06",
    evidence: "pinned cargo-audit installation output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Obtains the exact approved Rust advisory scanner without unpinned tool drift.",
    distinctness: "Tool installation is a prerequisite and does not itself scan the dependency graph.",
  },
  "cargo-audit-version": {
    contractClause: "J03-SEC-27; J05-VER-06",
    evidence: "cargo-audit version assertion output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the installed advisory scanner is exactly version 0.22.2.",
    distinctness: "Version identity is distinct from installation success and advisory results.",
  },
  "rust-dependency-vulnerability-rustsec": {
    contractClause: "J04-OPS-26; J05-VER-06",
    evidence: "Windows-target RustSec cargo-audit pass/fail result",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Blocks applicable Rust dependency advisories for the Windows V1 target graph.",
    distinctness: "The direct advisory result is distinct from its durable JSON report and warning-review policy.",
  },
  "rustsec-audit-json": {
    contractClause: "J03-SEC-27; J05-VER-36",
    evidence: "durable machine-readable RustSec JSON report",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Preserves attributable structured advisory evidence for later policy review and diagnosis.",
    distinctness: "Durable evidence capture is distinct from the scanner's immediate exit status.",
  },
  "cargo-metadata-windows": {
    contractClause: "J01-PLAT-11; J03-SEC-27",
    evidence: "locked Windows-target Cargo metadata output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the audited Rust dependency graph is resolved for the qualified Windows target.",
    distinctness: "Target graph identity is distinct from advisory findings and compilation.",
  },
  "rustsec-informational-warning-review": {
    contractClause: "J04-OPS-26; J05-VER-38",
    evidence: "deterministic RustSec informational-warning policy-review result",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS; independent review may be required for exceptions",
    purpose: "Ensures informational advisory warnings receive the required explicit review and disposition.",
    distinctness: "Policy disposition is distinct from scanner detection and JSON evidence generation.",
  },
  "rustfmt": {
    contractClause: "J00-CODE-06; J00-CODE-28",
    evidence: "cargo fmt check output for all Rust workspace members",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Detects Rust-specific source-format drift across the workspace.",
    distinctness: "Rust formatting is not covered by the repository-wide text formatter.",
  },
  "rust-clippy-warnings-as-errors": {
    contractClause: "J00-CODE-06",
    evidence: "all-target/all-feature Clippy output with warnings treated as errors",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Blocks Rust lint warnings across the qualified workspace and feature surface.",
    distinctness: "Lint quality is distinct from Rust compilation and formatting.",
  },
  "rust-host-build": {
    contractClause: "J00-CODE-06",
    evidence: "locked host-target Cargo check output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the Rust workspace compiles for the execution host used by the local/native toolchain.",
    distinctness: "Host compilation is distinct from the Windows-target and Tauri production builds.",
  },
  "rust-windows-target-build": {
    contractClause: "J01-PLAT-09; J05-VER-09",
    evidence: "locked x86_64-pc-windows-msvc Cargo check output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS; native Windows runner",
    purpose: "Proves Rust compilation for the mandatory Windows FULL_HOST V1 target.",
    distinctness: "Target compilation is distinct from the native Tauri production build and runtime qualification.",
  },
  "windows-tauri-production-build": {
    contractClause: "J05-VER-09; J05-VER-32",
    evidence: "native Windows Tauri production-build output for the exact target",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS; native Windows runner",
    purpose: "Proves the real Windows Tauri production path builds for the exact candidate.",
    distinctness: "Native packaging/build behavior is stronger and distinct from cross-target Cargo compilation.",
  },
  "phase0-section-checkpoint": {
    contractClause: "J00-GOV-28; J05-VER-33",
    evidence: "aggregate Phase 0 checkpoint result with governance, platform, evidence, and matrix consistency output",
    authority: "LOCAL_PREFLIGHT_AND_GITHUB_ACTIONS",
    purpose: "Proves the repository/platform/governance foundation is coherently assembled before later qualification.",
    distinctness: "The aggregate checkpoint is distinct from each prerequisite gate and does not advance application matrix work.",
  },
});

export const ACCEPTANCE_GATE_CATALOG = Object.freeze(ACCEPTANCE_GATE_COMMANDS.map(([gate, command]) => Object.freeze({
  gate,
  command,
  ...ACCEPTANCE_GATE_METADATA[gate],
})));

export const ACCEPTANCE_GATES = Object.freeze(ACCEPTANCE_GATE_COMMANDS.map(([gate]) => gate));

export const LOCALCI_GATE_COMMANDS = ACCEPTANCE_GATE_COMMANDS;
export const LOCALCI_GATES = ACCEPTANCE_GATES;

export function validateAcceptanceGateCatalog(catalog = ACCEPTANCE_GATE_CATALOG) {
  const violations = [];
  if (!Array.isArray(catalog) || catalog.length !== ACCEPTANCE_GATE_COMMANDS.length) {
    violations.push(violation("ACCEPTANCE_CATALOG_LENGTH", "acceptance gate catalog must contain exactly one entry for every canonical gate"));
    return violations;
  }
  const expected = new Map(ACCEPTANCE_GATE_COMMANDS);
  const seen = new Set();
  for (const entry of catalog) {
    if (!entry || typeof entry !== "object") {
      violations.push(violation("ACCEPTANCE_CATALOG_ENTRY_INVALID", "each acceptance catalog entry must be an object"));
      continue;
    }
    if (seen.has(entry.gate)) violations.push(violation("ACCEPTANCE_CATALOG_DUPLICATE", `${entry.gate} appears more than once`));
    seen.add(entry.gate);
    if (!expected.has(entry.gate)) violations.push(violation("ACCEPTANCE_CATALOG_UNKNOWN", `${entry.gate} is not in the canonical acceptance gate manifest`));
    else if (entry.command !== expected.get(entry.gate)) violations.push(violation("ACCEPTANCE_CATALOG_COMMAND_DRIFT", `${entry.gate} must retain its canonical command`));
    for (const field of ["contractClause", "evidence", "authority", "purpose", "distinctness"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") violations.push(violation("ACCEPTANCE_CATALOG_METADATA_MISSING", `${entry.gate ?? "<unknown>"} must define ${field}`));
    }
  }
  for (const gate of ACCEPTANCE_GATES) if (!seen.has(gate)) violations.push(violation("ACCEPTANCE_CATALOG_MISSING", `${gate} is missing from the acceptance catalog`));
  return violations;
}

function violation(code, detail) {
  return Object.freeze({ code, detail });
}

export function validateLocalCiGateScript(scriptText) {
  const text = String(scriptText).replace(/\r\n/g, "\n");
  const violations = [];
  if (!text.startsWith("#!/usr/bin/env bash\nset -Eeuo pipefail\n")) {
    violations.push(violation("LOCALCI_FAIL_CLOSED_PREAMBLE", "LocalCI runner must retain bash strict/fail-closed mode"));
  }

  const observed = [...text.matchAll(/^run_gate ([a-z0-9-]+) (.+)$/gm)].map((match) => [match[1], match[2]]);
  const terminalEvidence = ["static-ci-evidence", "pnpm ci:evidence"];
  const terminalEvidenceIndexes = observed.flatMap(([gate], index) => gate === terminalEvidence[0] ? [index] : []);
  if (terminalEvidenceIndexes.length !== 1 || observed.at(-1)?.[0] !== terminalEvidence[0] || observed.at(-1)?.[1] !== terminalEvidence[1]) {
    violations.push(violation("LOCALCI_TERMINAL_EVIDENCE_ORDER", "static-ci evidence must remain the single final command after the canonical gate sequence"));
  } else {
    observed.pop();
  }
  const expected = new Map(ACCEPTANCE_GATE_COMMANDS);
  const seen = new Set();
  for (const [gate, command] of observed) {
    if (seen.has(gate)) violations.push(violation("LOCALCI_GATE_DUPLICATE", `${gate} is declared more than once`));
    seen.add(gate);
    if (!expected.has(gate)) violations.push(violation("LOCALCI_GATE_UNKNOWN", `${gate} is not in the approved gate manifest`));
    else if (expected.get(gate) !== command) violations.push(violation("LOCALCI_GATE_COMMAND_DRIFT", `${gate} must run ${expected.get(gate)}`));
  }
  for (const gate of ACCEPTANCE_GATES) {
    if (!seen.has(gate)) violations.push(violation("LOCALCI_GATE_MISSING", `${gate} is missing from .localci/ci.sh`));
  }
  if (observed.length !== ACCEPTANCE_GATE_COMMANDS.length) {
    violations.push(violation("LOCALCI_GATE_SEQUENCE_LENGTH", "LocalCI must contain exactly the canonical number of gates plus one terminal evidence command"));
  }
  for (let index = 0; index < Math.max(observed.length, ACCEPTANCE_GATE_COMMANDS.length); index += 1) {
    const actual = observed[index]?.[0];
    const expectedGate = ACCEPTANCE_GATES[index];
    if (actual !== expectedGate) {
      violations.push(violation("LOCALCI_GATE_ORDER", `gate position ${index + 1} must be ${expectedGate ?? "<end>"}, got ${actual ?? "<missing>"}`));
    }
  }
  if (!/printf 'LOCALCI_JOB_RESULT=PENDING_AUTHORITY_FINALIZATION\\n' >&2\nexit 78\s*$/m.test(text)) {
    violations.push(violation("LOCALCI_FAIL_CLOSED_EXIT", "LocalCI runner must terminate non-authoritatively and fail closed"));
  }
  return violations;
}

export function validateLocalCiWorkerQualificationScript(scriptText) {
  const text = String(scriptText).replace(/\r\n/g, "\n");
  const violations = [];
  if (!text.includes('[[ ! ${observed_uname} =~ ^(MINGW|MSYS|CYGWIN) ]]')) {
    violations.push(violation("LOCALCI_WORKER_OS_SPOOF_GUARD_MISSING", "worker qualification must reject Linux/WSL and require an observed native Windows shell"));
  }
  if (!text.includes('[[ ${attested_os} != Windows ]]') || !text.includes('[[ ${attested_arch} != X64 ]]')) {
    violations.push(violation("LOCALCI_WORKER_ATTESTATION_GUARD_MISSING", "worker qualification must require Windows/X64 attestation"));
  }
  if (!text.includes("return 78")) {
    violations.push(violation("LOCALCI_WORKER_FAIL_CLOSED_EXIT", "worker qualification must return fail-closed exit code 78"));
  }
  return violations;
}
