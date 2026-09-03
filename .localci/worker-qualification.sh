#!/usr/bin/env bash
set -Eeuo pipefail

validate_localci_worker() {
  local observed_uname=${1:-}
  local attested_os=${2:-}
  local attested_arch=${3:-}
  if [[ ! ${observed_uname} =~ ^(MINGW|MSYS|CYGWIN) ]] ||
    [[ ${attested_os} != Windows ]] ||
    [[ ${attested_arch} != X64 ]]; then
    printf 'The authoritative JARVIS LocalCI profile requires an independently observed native Windows/X64 worker\n' >&2
    return 78
  fi
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  validate_localci_worker "${1:-}" "${2:-}" "${3:-}"
fi
