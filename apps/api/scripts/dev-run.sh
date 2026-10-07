#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

role="${DEV_ROLE:-serve}"
bin="./tmp/shionlib-$role"
pidfile="tmp/run-$role.pid"

if [[ -f "$pidfile" ]]; then
  previous="$(cat "$pidfile")"
  if ps -p "$previous" -o command= 2>/dev/null | grep -q "shionlib-$role"; then
    kill -TERM "$previous" 2>/dev/null || true
    for _ in $(seq 1 50); do
      kill -0 "$previous" 2>/dev/null || break
      sleep 0.2
    done
    kill -KILL "$previous" 2>/dev/null || true
  fi
fi

echo $$ > "$pidfile"
exec "$bin" "$role"
