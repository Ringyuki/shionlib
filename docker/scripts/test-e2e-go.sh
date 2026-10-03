#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export COMPOSE_PROJECT_NAME="${E2E_COMPOSE_PROJECT_NAME:-shionlib-e2e-go}"
COMPOSE=(docker compose -f docker/compose.e2e-go.yml)

COMPOSE_UP_ARGS=(-d --wait)
if [[ "${E2E_NO_BUILD:-0}" != "1" ]]; then
  COMPOSE_UP_ARGS+=(--build)
fi

FRONTEND_PORT_VALUE="${FRONTEND_PORT:-3200}"
E2E_BASE_URL_VALUE="${E2E_BASE_URL:-http://localhost:${FRONTEND_PORT_VALUE}}"
KEEP_STACK="${E2E_KEEP_STACK:-0}"
COMPOSE_RETRIES="${E2E_COMPOSE_RETRIES:-3}"
RESET_VOLUMES="${E2E_RESET_VOLUMES:-1}"
PLAYWRIGHT_WORKERS="${E2E_WORKERS:-2}"

INTENTIONAL_DEVIATIONS=(
  "Realtime notifications|top bar unread badge should update without page reload when new message arrives"
)

COMPOSE_DOWN_ARGS=(--remove-orphans)
if [[ "$RESET_VOLUMES" == "1" ]]; then
  COMPOSE_DOWN_ARGS+=(--volumes)
fi

cleanup() {
  if [[ "$KEEP_STACK" == "1" ]]; then
    echo "[e2e-go-runner] Keeping compose stack up (E2E_KEEP_STACK=1)."
    return
  fi

  echo "[e2e-go-runner] Stopping compose stack..."
  "${COMPOSE[@]}" down "${COMPOSE_DOWN_ARGS[@]}"
}
trap cleanup EXIT

echo "[e2e-go-runner] Using compose project: ${COMPOSE_PROJECT_NAME}"
echo "[e2e-go-runner] Resetting compose stack..."
"${COMPOSE[@]}" down "${COMPOSE_DOWN_ARGS[@]}" || true

echo "[e2e-go-runner] Starting compose stack (migrate up, e2e dataset, Go API, og, frontend)..."
attempt=1
while true; do
  if "${COMPOSE[@]}" up "${COMPOSE_UP_ARGS[@]}"; then
    break
  fi

  if [[ "$attempt" -ge "$COMPOSE_RETRIES" ]]; then
    echo "[e2e-go-runner] compose up failed after ${COMPOSE_RETRIES} attempts."
    "${COMPOSE[@]}" logs --no-color migrate seed api || true
    exit 1
  fi

  echo "[e2e-go-runner] compose up failed (attempt ${attempt}/${COMPOSE_RETRIES}), retrying..."
  "${COMPOSE[@]}" down "${COMPOSE_DOWN_ARGS[@]}" || true
  sleep $((attempt * 5))
  attempt=$((attempt + 1))
done

"${COMPOSE[@]}" logs --no-color seed

excluded=""
for deviation in "${INTENTIONAL_DEVIATIONS[@]}"; do
  row="${deviation%%|*}"
  title="${deviation#*|}"
  echo "[e2e-go-runner] Excluding intentional deviation (apps/api/docs/migration.md, \"${row}\"): ${title}"
  excluded="${excluded:+${excluded}|}${title}"
done

echo "[e2e-go-runner] Running Playwright against ${E2E_BASE_URL_VALUE} with ${PLAYWRIGHT_WORKERS} workers..."
E2E_BASE_URL="${E2E_BASE_URL_VALUE}" pnpm --filter shionlib-frontend exec playwright test --workers="${PLAYWRIGHT_WORKERS}" --grep-invert "${excluded}" "$@"
