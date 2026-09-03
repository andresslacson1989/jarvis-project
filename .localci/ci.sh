#!/usr/bin/env bash
set -Eeuo pipefail

readonly gate_results='reports/localci-gate-results.jsonl'
readonly rustsec_audit='reports/localci-rustsec-audit.json'
readonly cargo_metadata='reports/localci-cargo-metadata-windows.json'
source "$(dirname "${BASH_SOURCE[0]}")/worker-qualification.sh"
# The authoritative profile requires an independently observed native Windows worker.

mkdir -p reports
: >"${gate_results}"

require_value() {
  local variable_name=$1
  if [[ -z ${!variable_name:-} ]]; then
    printf 'LocalCI metadata %s is required\n' "${variable_name}" >&2
    exit 78
  fi
}

readonly expected_repository='andresslacson1989/jarvis-project'
readonly expected_pipeline_profile='tauri2418'
readonly repository_root=$(git rev-parse --show-toplevel)
cd "${repository_root}"

for tracked_state in "$(git diff --quiet; echo $?)" "$(git diff --cached --quiet; echo $?)"; do
  if [[ ${tracked_state} != 0 ]]; then
    printf 'LocalCI checkout must have no tracked changes\n' >&2
    exit 78
  fi
done

for variable_name in \
  LOCALCI_JOB_ID \
  LOCALCI_INSTANCE_ID \
  LOCALCI_PIPELINE_ID \
  LOCALCI_PIPELINE_PROFILE \
  LOCALCI_IDEMPOTENCY_KEY \
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

require_value LOCALCI_REPOSITORY
require_value LOCALCI_SERVER_RESOLVED_REPOSITORY
require_value LOCALCI_SERVER_RESOLVED_REF
require_value LOCALCI_RESOLUTION_ATTESTATION_ID
if [[ ${LOCALCI_REPOSITORY} != "${expected_repository}" ]] ||
  [[ ${LOCALCI_SERVER_RESOLVED_REPOSITORY} != "${expected_repository}" ]] ||
  [[ ${LOCALCI_PIPELINE_PROFILE} != "${expected_pipeline_profile}" ]] ||
  [[ ! ${LOCALCI_IDEMPOTENCY_KEY} =~ ^[A-Za-z0-9._:-]{1,128}$ ]] ||
  [[ ! ${LOCALCI_REQUESTED_REF} =~ ^refs/heads/[A-Za-z0-9._/-]+$ ]] ||
  [[ ${LOCALCI_SERVER_RESOLVED_REF} != "${LOCALCI_REQUESTED_REF}" ]]; then
  printf 'LocalCI repository/ref binding is invalid\n' >&2
  exit 78
fi

if [[ -n ${LOCALCI_REQUESTED_COMMIT:-} ]] && [[ ${LOCALCI_REQUESTED_COMMIT} != "${LOCALCI_EXPECTED_COMMIT}" ]]; then
  printf 'LocalCI optional requested commit does not match the expected commit\n' >&2
  exit 78
fi

actual_checkout_sha=$(git rev-parse --verify HEAD)
actual_checkout_ref=$(git symbolic-ref --quiet --short HEAD || true)
actual_remote_url=$(git remote get-url origin)
if [[ ! ${actual_checkout_sha} =~ ^[0-9a-f]{40}$ ]] ||
  [[ ${actual_checkout_sha} != "${LOCALCI_EXPECTED_COMMIT}" ]] ||
  [[ ${actual_checkout_sha} != "${LOCALCI_RESOLVED_COMMIT}" ]] ||
  [[ -n ${actual_checkout_ref} && ${actual_checkout_ref} != "${LOCALCI_REQUESTED_REF#refs/heads/}" ]] ||
  [[ ! ${actual_remote_url} =~ ^(https://github\.com/andresslacson1989/jarvis-project\.git|git@github\.com:andresslacson1989/jarvis-project\.git)$ ]]; then
  printf 'LocalCI checkout SHA does not match the server-approved revision\n' >&2
  exit 78
fi

if [[ ! ${LOCALCI_EXPECTED_COMMIT} =~ ^[0-9a-f]{40}$ ]] ||
  [[ ${LOCALCI_EXPECTED_COMMIT} != "${LOCALCI_RESOLVED_COMMIT}" ]]; then
  printf 'LocalCI expected/resolved commit binding is invalid\n' >&2
  exit 78
fi

validate_localci_worker "$(uname -s)" "${LOCALCI_RUNNER_OS}" "${LOCALCI_RUNNER_ARCH}"

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
run_gate rustsec-audit-json sh -c 'cargo audit --json --file Cargo.lock --target-os windows --target-arch x86_64 >"$1"' sh reports/localci-rustsec-audit.json
run_gate cargo-metadata-windows sh -c 'cargo metadata --locked --format-version 1 --all-features --filter-platform x86_64-pc-windows-msvc >"$1"' sh reports/localci-cargo-metadata-windows.json
run_gate rustsec-informational-warning-review node tools/ci/check-rustsec-advisories.mjs reports/localci-rustsec-audit.json reports/localci-cargo-metadata-windows.json third_party/rustsec-advisory-review.json
run_gate rustfmt cargo fmt --all -- --check
run_gate rust-clippy-warnings-as-errors cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
run_gate rust-host-build cargo check --locked --workspace --all-targets --all-features
run_gate rust-windows-target-build cargo check --locked --workspace --target x86_64-pc-windows-msvc
run_gate windows-tauri-production-build pnpm --dir apps/desktop tauri build --no-bundle --target x86_64-pc-windows-msvc --ci

export JARVIS_CANDIDATE_SHA=${LOCALCI_RESOLVED_COMMIT}
run_gate phase0-section-checkpoint pnpm phase0:check

export JARVIS_CI_AUTHORITY=LOCALCI
export JARVIS_CI_GATE_RESULTS_PATH=${gate_results}
export LOCALCI_OBSERVED_CHECKOUT_SHA=${actual_checkout_sha}
export LOCALCI_OBSERVED_REPOSITORY=${actual_remote_url}
export LOCALCI_OBSERVED_REF=${LOCALCI_SERVER_RESOLVED_REF}
export LOCALCI_SERVER_RESOLUTION_ATTESTATION_ID=${LOCALCI_RESOLUTION_ATTESTATION_ID}
run_gate static-ci-evidence pnpm ci:evidence
printf 'LOCALCI_JOB_RESULT=PENDING_AUTHORITY_FINALIZATION\n' >&2
exit 78
