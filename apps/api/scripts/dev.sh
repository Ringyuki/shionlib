#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export DEV_ROLE="${1:-serve}"
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

exec go tool -modfile=tools.mod air -c .air.toml
