#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT/apps/api"

step() { printf '\n==> %s\n' "$1"; }
lint_bin() { command -v golangci-lint 2>/dev/null || echo "$(go env GOPATH)/bin/golangci-lint"; }

step "gofmt"
unformatted="$(gofmt -l cmd internal migrations)"
if [ -n "$unformatted" ]; then echo "$unformatted"; exit 1; fi

step "go mod tidy"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
cp go.mod go.sum "$scratch/"
go mod tidy
if ! cmp -s go.mod "$scratch/go.mod" || ! cmp -s go.sum "$scratch/go.sum"; then
  echo "go.mod/go.sum were not tidy (now fixed; commit the result)"; exit 1
fi

step "generated code"
go run ./cmd/entgen
go run ./cmd/devtool bizcode docs
go run ./cmd/api openapi openapi/openapi.json
if ! git diff --quiet -- internal/adapter/postgres/ent docs/business-codes.md openapi/openapi.json || [ -n "$(git ls-files --others --exclude-standard -- internal/adapter/postgres/ent docs/business-codes.md openapi/openapi.json)" ]; then
  git --no-pager status --short -- internal/adapter/postgres/ent docs/business-codes.md openapi/openapi.json
  echo "generated files were stale (now regenerated; commit the result)"; exit 1
fi

step "go vet"
go vet ./...

step "golangci-lint"
"$(lint_bin)" run ./...

step "business codes"
go run ./cmd/devtool bizcode check

step "deploy environment"
go run ./cmd/devtool deploy check

step "tests"
go test ./...

if [ -n "${DEV_DATABASE_URL:-}" ]; then
  step "migration drift"
  go run ./cmd/devtool migrate check
else
  echo "skipping migration drift check (DEV_DATABASE_URL unset)"
fi

printf '\nverify: ok\n'
