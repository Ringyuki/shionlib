#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT/apps/web"

step() { printf '\n==> %s\n' "$1"; }

step "typecheck"
pnpm --silent typecheck

step "lint"
pnpm --silent lint

step "format"
pnpm --silent format:check

step "tests of what changed"
pnpm --silent exec vitest run --changed "${SINCE:-HEAD}" --passWithNoTests

printf '\ncheck: ok\n'
