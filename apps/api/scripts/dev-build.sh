#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

role="${DEV_ROLE:-serve}"
pidfile="tmp/build-$role.pid"
started="tmp/build-$role.started"
mkdir -p tmp

if [[ -f "$pidfile" ]]; then
  previous="$(cat "$pidfile")"
  if ps -p "$previous" -o command= 2>/dev/null | grep -q "dev-build.sh"; then
    kill -TERM "$previous" 2>/dev/null || true
  fi
fi

echo $$ > "$pidfile"

compiler=0

abandon_build() {
  pkill -TERM -P "$compiler" 2>/dev/null || true
  kill -TERM "$compiler" 2>/dev/null || true
  exit 143
}

sources_moved() {
  [[ -n "$(find cmd internal migrations -type f -newer "$started" -print -quit)" ]]
}

trap abandon_build TERM INT

while true; do
  touch "$started"
  built=0
  go build -p "${DEV_BUILD_JOBS:-2}" -o "./tmp/shionlib-$role" ./cmd/api &
  compiler=$!
  wait "$compiler" || built=$?
  sources_moved || exit "$built"
  sleep 1
done
