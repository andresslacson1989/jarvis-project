#!/usr/bin/env bash
set -Eeuo pipefail

readonly gate_results='reports/localci-gate-results.jsonl'
readonly rustsec_audit='reports/localci-rustsec-audit.json'
readonly cargo_metadata='reports/localci-cargo-metadata-windows.json'

mkdir -p reports
: >"${gate_results}"

require_value() {
  local variable_name=$1
  if [[ -z ${!variable_name:-} ]]; then
    printf 'LocalCI metadata %s is required\n' "${variable_name}" >&2
    exit 78
  fi
}

for variable_name in \
  LOCALCI_JOB_ID \
  LOCALCI_INSTANCE_ID \
  LOCALCI_PIPELINE_ID \
  LOCALCI_PIPELINE_VERSION \
  LOCALCI_REQUESTED_REF \
  LOCALCI_EXPECTED_COMMIT \
  LOCALCI_RESOLVED_COMMIT \
  LOCALCI_QUEUED_AT \
  LOCALCI_STARTED_AT \
  LOCALCI_RUNNER_OS \
  LOCALCI_RUNNER_ARCH; do
  require_value "${variable_name}"
done

if [[ ! ${LOCALCI_EXPECTED_COMMIT} =~ ^[0-9a-f]{40}$ ]] ||
  [[ ${LOCALCI_EXPECTED_COMMIT} != "${LOCALCI_RESOLVED_COMMIT}" ]]; then
  printf 'LocalCI expected/resolved commit binding is invalid\n' >&2
  exit 78
fi

case "${OS:-}:$(uname -s)" in
  Windows_NT:*|*:MINGW*|*:MSYS*|*:CYGWIN*) ;;
  *)
    printf 'The authoritative JARVIS LocalCI profile requires a native Windows worker\n' >&2
    exit 78
    ;;
esac

run_gate() {
  local gate_id=$1
  shift
  local started_at
  local finished_at
  local exit_code
  started_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
  set +e
  "$@"
  exit_code=$?
  set -e
  finished_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
  printf '{"gate":"%s","startedAt":"%s","finishedAt":"%s","exitCode":%d}\n' \
    "${gate_id}" "${started_at}" "${finished_at}" "${exit_code}" >>"${gate_results}"
  if ((exit_code != 0)); then
    printf 'LocalCI gate %s failed with exit code %d\n' "${gate_id}" "${exit_code}" >&2
    return "${exit_code}"
  fi
}

run_gate dependencies-frozen pnpm install --frozen-lockfile --ignore-scripts
run_gate toolchain-exact pnpm toolchain:verify
run_gate format-hygiene pnpm format:check
run_gate schema-integrity pnpm schema:check
run_gate contract-generated-reproducible pnpm contract:check-generated
run_gate contract-manifest-valid pnpm contract:check-manifest
run_gate contract-profile-drift pnpm contract:check-drift
run_gate repository-governance pnpm governance:check
run_gate secret-scan pnpm security:secrets
run_gate dependency-inventory pnpm dependency:check
run_gate license-provenance pnpm provenance:check
run_gate typescript-strict pnpm typecheck
run_gate typescript-build pnpm build
run_gate core-build pnpm build:core
run_gate desktop-ui-build pnpm build:ui
run_gate desktop-foundation-contract pnpm desktop:foundation:check
run_gate desktop-security-contract pnpm desktop:security:check
run_gate architecture-enforcement pnpm architecture:check
run_gate normal-tests pnpm test
run_gate dependency-vulnerability-high-plus pnpm audit --audit-level high
run_gate cargo-audit-install cargo install cargo-audit --locked --version 0.22.2 --no-default-features
run_gate cargo-audit-version sh -c 'cargo audit --version | grep -Eq "0\\.22\\.2$"'
run_gate rust-dependency-vulnerability-rustsec cargo audit --file Cargo.lock --target-os windows --target-arch x86_64
run_gate rustsec-audit-json sh -c 'cargo audit --json --file Cargo.lock --target-os windows --target-arch x86_64 >"$1"' sh "${rustsec_audit}"
run_gate cargo-metadata-windows sh -c 'cargo metadata --locked --format-version 1 --all-features --filter-platform x86_64-pc-windows-msvc >"$1"' sh "${cargo_metadata}"
run_gate rustsec-informational-warning-review node tools/ci/check-rustsec-advisories.mjs "${rustsec_audit}" "${cargo_metadata}" third_party/rustsec-advisory-review.json
run_gate rustfmt cargo fmt --all -- --check
run_gate rust-clippy-warnings-as-errors cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
run_gate rust-host-build cargo check --locked --workspace --all-targets --all-features
run_gate rust-windows-target-build cargo check --locked --workspace --target x86_64-pc-windows-msvc
run_gate windows-tauri-production-build pnpm --dir apps/desktop tauri build --no-bundle --target x86_64-pc-windows-msvc --ci
run_gate phase0-section-checkpoint pnpm phase0:check

export JARVIS_CANDIDATE_SHA=${LOCALCI_RESOLVED_COMMIT}
export JARVIS_CI_AUTHORITY=LOCALCI
export JARVIS_CI_GATE_RESULTS_PATH=${gate_results}
run_gate static-ci-evidence pnpm ci:evidence
