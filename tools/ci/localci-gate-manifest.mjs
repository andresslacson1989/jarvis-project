export const LOCALCI_GATE_COMMANDS = Object.freeze([
  ["dependencies-frozen", "pnpm install --frozen-lockfile --ignore-scripts"],
  ["toolchain-exact", "pnpm toolchain:verify"],
  ["format-hygiene", "pnpm format:check"],
  ["schema-integrity", "pnpm schema:check"],
  ["contract-generated-reproducible", "pnpm contract:check-generated"],
  ["contract-manifest-valid", "pnpm contract:check-manifest"],
  ["contract-profile-drift", "pnpm contract:check-drift"],
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

export const LOCALCI_GATES = Object.freeze(LOCALCI_GATE_COMMANDS.map(([gate]) => gate));

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
  const expected = new Map(LOCALCI_GATE_COMMANDS);
  const seen = new Set();
  for (const [gate, command] of observed) {
    if (seen.has(gate)) violations.push(violation("LOCALCI_GATE_DUPLICATE", `${gate} is declared more than once`));
    seen.add(gate);
    if (!expected.has(gate)) violations.push(violation("LOCALCI_GATE_UNKNOWN", `${gate} is not in the approved gate manifest`));
    else if (expected.get(gate) !== command) violations.push(violation("LOCALCI_GATE_COMMAND_DRIFT", `${gate} must run ${expected.get(gate)}`));
  }
  for (const gate of LOCALCI_GATES) {
    if (!seen.has(gate)) violations.push(violation("LOCALCI_GATE_MISSING", `${gate} is missing from .localci/ci.sh`));
  }
  if (observed.length !== LOCALCI_GATE_COMMANDS.length) {
    violations.push(violation("LOCALCI_GATE_SEQUENCE_LENGTH", "LocalCI must contain exactly the canonical number of gates plus one terminal evidence command"));
  }
  for (let index = 0; index < Math.max(observed.length, LOCALCI_GATE_COMMANDS.length); index += 1) {
    const actual = observed[index]?.[0];
    const expectedGate = LOCALCI_GATES[index];
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
