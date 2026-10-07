#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT/apps/api"

step() { printf '\n==> %s\n' "$1"; }

if [ "$#" -gt 0 ]; then
  packages=("$@")
  files=()
else
  files=()
  while IFS= read -r file; do
    [ -f "$file" ] && files+=("$file")
  done < <({ git diff --name-only "${SINCE:-HEAD}" -- '*.go'; git ls-files --others --exclude-standard -- '*.go'; } | sed 's#^apps/api/##' | sort -u)
  packages=()
  while IFS= read -r dir; do
    packages+=("./$dir")
  done < <(printf '%s\n' "${files[@]:-}" | sed '/^$/d' | xargs -n1 dirname 2>/dev/null | sort -u)
fi

if [ "${#packages[@]}" -eq 0 ]; then
  echo "check: no changed Go packages"
  exit 0
fi

if [ "${#files[@]}" -gt 0 ]; then
  step "gofmt"
  unformatted="$(gofmt -l "${files[@]}")"
  if [ -n "$unformatted" ]; then echo "$unformatted"; exit 1; fi
fi

step "go vet ${packages[*]}"
go vet "${packages[@]}"

step "tests"
go test -p 2 "${packages[@]}"

printf '\ncheck: ok\n'
