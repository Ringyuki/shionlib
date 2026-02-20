#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_UP_ARGS=(-d --wait)
if [[ "${E2E_NO_BUILD:-0}" != "1" ]]; then
  COMPOSE_UP_ARGS+=(--build)
fi

FRONTEND_PORT_VALUE="${FRONTEND_PORT:-3100}"
E2E_BASE_URL_VALUE="${E2E_BASE_URL:-http://localhost:${FRONTEND_PORT_VALUE}}"
KEEP_STACK="${E2E_KEEP_STACK:-0}"
COMPOSE_RETRIES="${E2E_COMPOSE_RETRIES:-3}"

cleanup() {
  if [[ "$KEEP_STACK" == "1" ]]; then
    echo "[e2e-runner] Keeping compose stack up (E2E_KEEP_STACK=1)."
    return
  fi

  echo "[e2e-runner] Stopping compose stack..."
  docker compose down --remove-orphans
}
trap cleanup EXIT

echo "[e2e-runner] Starting compose stack..."
attempt=1
while true; do
  if docker compose up "${COMPOSE_UP_ARGS[@]}"; then
    break
  fi

  if [[ "$attempt" -ge "$COMPOSE_RETRIES" ]]; then
    echo "[e2e-runner] compose up failed after ${COMPOSE_RETRIES} attempts."
    exit 1
  fi

  echo "[e2e-runner] compose up failed (attempt ${attempt}/${COMPOSE_RETRIES}), retrying..."
  docker compose down --remove-orphans || true
  sleep $((attempt * 5))
  attempt=$((attempt + 1))
done

echo "[e2e-runner] Preparing deterministic e2e dataset..."
docker compose exec -T backend sh -lc "cd /app/apps/backend && node dist/scripts/e2e-dataset.js prepare"

echo "[e2e-runner] Running Playwright against ${E2E_BASE_URL_VALUE}..."
E2E_BASE_URL="${E2E_BASE_URL_VALUE}" pnpm --filter shionlib-frontend test:e2e
