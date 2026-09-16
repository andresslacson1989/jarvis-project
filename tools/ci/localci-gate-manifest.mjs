const githubVariant = Object.freeze({
  "cargo-audit-version": Object.freeze({
    stepName: "Verify pinned cargo-audit",
    mode: "POWERSHELL_SCRIPT",
    reason: "GitHub's Windows runner verifies the exact cargo-audit version with fail-closed PowerShell rather than LocalCI's native-Windows Bash command.",
  }),
  "rustsec-audit-json": Object.freeze({
    stepName: "RustSec informational warning review",
    mode: "COMBINED_POWERSHELL_EVIDENCE",
    reason: "GitHub captures RustSec JSON, Windows Cargo metadata, and reviewed-warning evidence in one fail-closed PowerShell step using RUNNER_TEMP.",
  }),
  "cargo-metadata-windows": Object.freeze({
    stepName: "RustSec informational warning review",
    mode: "COMBINED_POWERSHELL_EVIDENCE",
    reason: "GitHub captures RustSec JSON, Windows Cargo metadata, and reviewed-warning evidence in one fail-closed PowerShell step using RUNNER_TEMP.",
  }),
  "rustsec-informational-warning-review": Object.freeze({
    stepName: "RustSec informational warning review",
    mode: "COMBINED_POWERSHELL_EVIDENCE",
    reason: "GitHub captures RustSec JSON, Windows Cargo metadata, and reviewed-warning evidence in one fail-closed PowerShell step using RUNNER_TEMP.",
  }),
  "windows-tauri-production-build": Object.freeze({
    stepName: "Desktop Tauri production build",
    mode: "WORKING_DIRECTORY",
    reason: "GitHub runs the same Tauri command from apps/desktop in its dedicated Windows job; LocalCI expresses the directory through pnpm --dir.",
  }),
});

const gate = (id, workflowName, command, executionClass, evidencePurpose) => Object.freeze({
  id,
  workflowName,
  command,
  executionClass,
  requiredCiAuthority: "GITHUB_ACTIONS",
  evidencePurpose,
  github: githubVariant[id] ?? Object.freeze({ stepName: workflowName, mode: "EXACT_COMMAND", command }),
});

export const ACCEPTANCE_GATE_DEFINITIONS = Object.freeze([
  gate("dependencies-frozen", "Install dependencies without lifecycle scripts", "pnpm install --frozen-lockfile --ignore-scripts", "GENERAL", "reproducible dependency installation"),
  gate("toolchain-exact", "Verify exact toolchain", "pnpm toolchain:verify", "GENERAL", "pinned toolchain identity"),
  gate("format-hygiene", "Format hygiene", "pnpm format:check", "GENERAL", "format consistency"),
  gate("schema-integrity", "Schema integrity", "pnpm schema:check", "GENERAL", "schema validity"),
  gate("contract-suite-valid", "Contract suite validation", "pnpm contract:check", "GENERAL", "contract and generated-artifact integrity"),
  gate("repository-governance", "Repository governance", "pnpm governance:check", "GENERAL", "repository-governance conformance"),
  gate("secret-scan", "Secret scan", "pnpm security:secrets", "GENERAL", "secret exposure prevention"),
  gate("dependency-inventory", "Dependency inventory", "pnpm dependency:check", "GENERAL", "dependency inventory integrity"),
  gate("license-provenance", "License and provenance", "pnpm provenance:check", "GENERAL", "dependency and asset provenance"),
  gate("typescript-strict", "TypeScript strict typecheck", "pnpm typecheck", "GENERAL", "strict TypeScript conformance"),
  gate("typescript-build", "TypeScript build", "pnpm build", "GENERAL", "TypeScript build viability"),
  gate("core-build", "Core build", "pnpm build:core", "GENERAL", "Core build viability"),
  gate("desktop-ui-build", "Desktop UI build", "pnpm build:ui", "GENERAL", "desktop UI build viability"),
  gate("desktop-foundation-contract", "Desktop foundation contract", "pnpm desktop:foundation:check", "GENERAL", "desktop foundation contract"),
  gate("desktop-security-contract", "Desktop security contract", "pnpm desktop:security:check", "GENERAL", "desktop security contract"),
  gate("architecture-enforcement", "Architecture enforcement", "pnpm architecture:check", "GENERAL", "architecture boundary enforcement"),
  gate("normal-tests", "Normal deterministic tests", "pnpm test", "GENERAL", "normal deterministic test profile"),
  gate("dependency-vulnerability-high-plus", "Node dependency vulnerability gate", "pnpm audit --audit-level high", "GENERAL", "Node dependency vulnerability threshold"),
  gate("cargo-audit-install", "Install pinned cargo-audit", "cargo install cargo-audit --locked --version 0.22.2 --no-default-features", "GENERAL", "Rust audit tool pin"),
  gate("cargo-audit-version", "Verify pinned cargo-audit", "sh -c 'cargo audit --version | grep -Eq \"0\\\\.22\\\\.2$\"'", "GENERAL", "Rust audit tool identity"),
  gate("rust-dependency-vulnerability-rustsec", "Rust dependency vulnerability audit", "cargo audit --file Cargo.lock --target-os windows --target-arch x86_64", "GENERAL", "RustSec vulnerability assessment"),
  gate("rustsec-audit-json", "RustSec audit JSON", "sh -c 'cargo audit --json --file Cargo.lock --target-os windows --target-arch x86_64 >\"$1\"' sh reports/localci-rustsec-audit.json", "GENERAL", "machine-readable RustSec evidence"),
  gate("cargo-metadata-windows", "Windows Cargo metadata", "sh -c 'cargo metadata --locked --format-version 1 --all-features --filter-platform x86_64-pc-windows-msvc >\"$1\"' sh reports/localci-cargo-metadata-windows.json", "GENERAL", "Windows dependency resolution evidence"),
  gate("rustsec-informational-warning-review", "RustSec informational warning review", "node tools/ci/check-rustsec-advisories.mjs reports/localci-rustsec-audit.json reports/localci-cargo-metadata-windows.json third_party/rustsec-advisory-review.json", "GENERAL", "reviewed RustSec warning evidence"),
  gate("rustfmt", "Rust formatting", "cargo fmt --all -- --check", "GENERAL", "Rust formatting"),
  gate("rust-clippy-warnings-as-errors", "Rust clippy warnings-as-errors", "cargo clippy --locked --workspace --all-targets --all-features -- -D warnings", "GENERAL", "Rust lint quality"),
  gate("rust-host-build", "Rust host build", "cargo check --locked --workspace --all-targets --all-features", "GENERAL", "host Rust build viability"),
  gate("rust-windows-target-build", "Rust Windows-target build", "cargo check --locked --workspace --target x86_64-pc-windows-msvc", "WINDOWS", "native Windows target viability"),
  gate("windows-tauri-production-build", "Desktop Tauri production build", "pnpm --dir apps/desktop tauri build --no-bundle --target x86_64-pc-windows-msvc --ci", "WINDOWS", "native Windows desktop artifact viability"),
  gate("phase0-section-checkpoint", "Phase 0 section checkpoint", "pnpm phase0:check", "GENERAL", "Phase 0 contract checkpoint"),
]);

export const ACCEPTANCE_GATE_COMMANDS = Object.freeze(ACCEPTANCE_GATE_DEFINITIONS.map(({ id, command }) => Object.freeze([id, command])));
export const ACCEPTANCE_GATE_BY_ID = Object.freeze(new Map(ACCEPTANCE_GATE_DEFINITIONS.map((definition) => [definition.id, definition])));

export const PHASE0_REQUIRED_GATE_IDS = Object.freeze([
  "dependencies-frozen",
  "toolchain-exact",
  "format-hygiene",
  "schema-integrity",
  "contract-suite-valid",
  "repository-governance",
  "secret-scan",
  "dependency-inventory",
  "license-provenance",
  "typescript-strict",
  "typescript-build",
  "core-build",
  "desktop-ui-build",
  "architecture-enforcement",
  "normal-tests",
  "dependency-vulnerability-high-plus",
  "rust-dependency-vulnerability-rustsec",
  "rustfmt",
  "rust-clippy-warnings-as-errors",
  "rust-host-build",
  "rust-windows-target-build",
]);

export const ACCEPTANCE_GATES = Object.freeze(ACCEPTANCE_GATE_COMMANDS.map(([gate]) => gate));

export const LOCALCI_GATE_COMMANDS = ACCEPTANCE_GATE_COMMANDS;
export const LOCALCI_GATES = ACCEPTANCE_GATES;

export function renderLocalCiGateCommands() {
  return `${ACCEPTANCE_GATE_COMMANDS.map(([id, command]) => `run_gate ${id} ${command}`).join("\n")}\n`;
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

  const renderBlock = `readonly rendered_gates=$(mktemp "\${TMPDIR:-/tmp}/jarvis-localci-gates.XXXXXX")
cleanup_rendered_gates() {
  rm -f -- "\${rendered_gates}"
}
trap cleanup_rendered_gates EXIT
if ! node tools/ci/render-localci-gates.mjs >"\${rendered_gates}"; then
  printf 'LocalCI gate renderer failed\\n' >&2
  exit 78
fi
if [[ ! -s \${rendered_gates} ]]; then
  printf 'LocalCI gate renderer produced no commands\\n' >&2
  exit 78
fi
source "\${rendered_gates}"
cleanup_rendered_gates
trap - EXIT`;
  const renderBlockCount = text.split(renderBlock).length - 1;
  if (renderBlockCount !== 1) {
    violations.push(violation("LOCALCI_GATE_RENDERER_BLOCK", "LocalCI must execute the canonical renderer through the single fail-closed temporary-file block"));
  }
  for (const [gate] of ACCEPTANCE_GATE_COMMANDS) {
    if (text.includes(`run_gate ${gate} `)) {
      violations.push(violation("LOCALCI_GATE_INLINE_COPY", `${gate} must not be hand-maintained in .localci/ci.sh`));
    }
  }
  const renderIndex = text.indexOf(renderBlock);
  const evidenceCommand = "run_gate static-ci-evidence pnpm ci:evidence";
  const evidenceIndex = text.indexOf(evidenceCommand);
  if (evidenceIndex < 0 || text.indexOf(evidenceCommand, evidenceIndex + 1) >= 0 || renderIndex < 0 || evidenceIndex <= renderIndex + renderBlock.length) {
    violations.push(violation("LOCALCI_TERMINAL_EVIDENCE_ORDER", "static-ci evidence must remain the single final command after the canonical gate sequence"));
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
