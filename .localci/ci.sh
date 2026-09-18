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

export JARVIS_CANDIDATE_SHA=${LOCALCI_RESOLVED_COMMIT}
readonly rendered_gates=$(mktemp "${TMPDIR:-/tmp}/jarvis-localci-gates.XXXXXX")
cleanup_rendered_gates() {
  rm -f -- "${rendered_gates}"
}
trap cleanup_rendered_gates EXIT
if ! node tools/ci/render-localci-gates.mjs >"${rendered_gates}"; then
  printf 'LocalCI gate renderer failed\n' >&2
  exit 78
fi
if [[ ! -s ${rendered_gates} ]]; then
  printf 'LocalCI gate renderer produced no commands\n' >&2
  exit 78
fi
source "${rendered_gates}"
cleanup_rendered_gates
trap - EXIT

export JARVIS_CI_AUTHORITY=LOCALCI
export JARVIS_CI_GATE_RESULTS_PATH=${gate_results}
export LOCALCI_OBSERVED_CHECKOUT_SHA=${actual_checkout_sha}
export LOCALCI_OBSERVED_REPOSITORY=${actual_remote_url}
export LOCALCI_OBSERVED_REF=${LOCALCI_SERVER_RESOLVED_REF}
export LOCALCI_SERVER_RESOLUTION_ATTESTATION_ID=${LOCALCI_RESOLUTION_ATTESTATION_ID}
run_gate static-ci-evidence pnpm ci:evidence
printf 'LOCALCI_JOB_RESULT=PENDING_AUTHORITY_FINALIZATION\n' >&2
exit 78
