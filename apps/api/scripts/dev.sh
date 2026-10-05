#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

command="${1:-serve}"
env_file="${API_ENV_FILE:-.env}"

if [[ -f "$env_file" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
    key="${line%%=*}"
    if [[ -z "${!key+set}" ]]; then
      export "$key=${line#*=}"
    fi
  done < "$env_file"
fi

bin="./tmp/shionlib-$command"
exec go tool -modfile=tools.mod air -c .air.toml \
  -build.cmd "go build -o $bin ./cmd/api" \
  -build.entrypoint "$bin" \
  -build.args_bin "$command"
