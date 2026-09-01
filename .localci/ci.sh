#!/usr/bin/env bash
set -Eeuo pipefail

echo "Running JARVIS LocalCI"

pnpm install --frozen-lockfile
pnpm toolchain:verify
pnpm format:check
pnpm schema:check
pnpm security:secrets
pnpm dependency:check
pnpm provenance:check
pnpm contract:check
pnpm architecture:check
pnpm typecheck
pnpm build
pnpm test
