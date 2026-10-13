#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT/apps/web"

step() { printf '\n==> %s\n' "$1"; }

step "generated API types"
pnpm --silent api:generate
if ! git diff --quiet -- app/shared/api/generated || [ -n "$(git ls-files --others --exclude-standard -- app/shared/api/generated)" ]; then
  git --no-pager status --short -- app/shared/api/generated
  echo "generated API types were stale (now regenerated; commit the result)"; exit 1
fi

step "typecheck"
pnpm --silent typecheck

step "lint"
pnpm --silent lint

step "format"
pnpm --silent format:check

step "tests"
pnpm --silent test

step "build"
pnpm --silent build

printf '\nverify: ok\n'
