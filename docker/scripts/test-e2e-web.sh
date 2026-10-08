#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export COMPOSE_PROJECT_NAME="${E2E_COMPOSE_PROJECT_NAME:-shionlib-e2e-web}"
COMPOSE=(docker compose -f docker/compose.e2e-go.yml)

BACKEND_PORT_VALUE="${BACKEND_PORT:-5201}"
WEB_PORT_VALUE="${E2E_WEB_PORT:-5330}"
KEEP_STACK="${E2E_KEEP_STACK:-0}"
COMPOSE_RETRIES="${E2E_COMPOSE_RETRIES:-3}"

UP_ARGS=(-d --wait)
if [[ "${E2E_NO_BUILD:-0}" != "1" ]]; then
  UP_ARGS+=(--build)
fi

cleanup() {
  if [[ "$KEEP_STACK" == "1" ]]; then
    echo "[e2e-web] Keeping compose stack up (E2E_KEEP_STACK=1)."
    return
  fi
  "${COMPOSE[@]}" down --remove-orphans --volumes
}
trap cleanup EXIT

"${COMPOSE[@]}" down --remove-orphans --volumes || true

echo "[e2e-web] Starting the API stack (migrate, e2e dataset, Go API) on port ${BACKEND_PORT_VALUE}..."
attempt=1
until BACKEND_PORT="$BACKEND_PORT_VALUE" FRONTEND_PORT="$WEB_PORT_VALUE" "${COMPOSE[@]}" up "${UP_ARGS[@]}" api; do
  if [[ "$attempt" -ge "$COMPOSE_RETRIES" ]]; then
    echo "[e2e-web] compose up failed after ${COMPOSE_RETRIES} attempts."
    "${COMPOSE[@]}" logs --no-color migrate seed api || true
    exit 1
  fi
  echo "[e2e-web] compose up failed (attempt ${attempt}/${COMPOSE_RETRIES}), retrying..."
  "${COMPOSE[@]}" down --remove-orphans --volumes || true
  sleep $((attempt * 5))
  attempt=$((attempt + 1))
done

echo "[e2e-web] Running Playwright..."
cd apps/web
E2E_API_URL="http://localhost:${BACKEND_PORT_VALUE}" E2E_WEB_PORT="$WEB_PORT_VALUE" pnpm exec playwright test "$@"
