#!/usr/bin/env bash
set -euo pipefail

: "${DOKPLOY_URL:?DOKPLOY_URL is required}"
: "${DOKPLOY_TOKEN:?DOKPLOY_TOKEN is required}"
: "${DOKPLOY_COMPOSE_ID:?DOKPLOY_COMPOSE_ID is required}"
: "${IMAGE_OWNER:?IMAGE_OWNER is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

if ! printf '%s' "$IMAGE_TAG" | grep -Eq '^[A-Za-z0-9._-]+$'; then
  echo "invalid image tag: $IMAGE_TAG" >&2
  exit 1
fi

base="${DOKPLOY_URL%/}"
timeout_seconds="${DEPLOY_TIMEOUT_SECONDS:-900}"
owner="$(printf '%s' "$IMAGE_OWNER" | tr '[:upper:]' '[:lower:]')"
api_image="ghcr.io/$owner/shionlib-api:$IMAGE_TAG"
web_image="ghcr.io/$owner/shionlib-web:$IMAGE_TAG"

dokploy() {
  local method="$1" path="$2"
  shift 2
  curl -fsS -X "$method" "$base/api/$path" \
    -H "x-api-key: $DOKPLOY_TOKEN" -H 'accept: application/json' "$@"
}

latest_deployment() {
  dokploy GET "deployment.allByCompose?composeId=$DOKPLOY_COMPOSE_ID" | jq -c '.[0] // {}'
}

current="$(dokploy GET "compose.one?composeId=$DOKPLOY_COMPOSE_ID" | jq -r '.env // ""')"
if [ "$(printf '%s\n' "$current" | grep -c '=' || true)" -lt 3 ]; then
  echo "the compose env looks empty; refusing to overwrite it" >&2
  exit 1
fi

updated="$({
  printf '%s\n' "$current" | grep -Ev '^(API_IMAGE|WEB_IMAGE|APP_VERSION)=' || true
  printf 'API_IMAGE=%s\nWEB_IMAGE=%s\nAPP_VERSION=%s\n' "$api_image" "$web_image" "$IMAGE_TAG"
})"
jq -n --arg id "$DOKPLOY_COMPOSE_ID" --arg env "$updated" '{composeId: $id, env: $env}' |
  dokploy POST compose.update -H 'Content-Type: application/json' --data-binary @- >/dev/null

previous="$(latest_deployment | jq -r '.deploymentId // ""')"
jq -n --arg id "$DOKPLOY_COMPOSE_ID" --arg title "$IMAGE_TAG" --arg description "${GITHUB_SHA:-}" \
  '{composeId: $id, title: $title, description: $description}' |
  dokploy POST compose.deploy -H 'Content-Type: application/json' --data-binary @- >/dev/null
echo "deploying $api_image and $web_image"

deadline=$((SECONDS + timeout_seconds))
while [ "$SECONDS" -lt "$deadline" ]; do
  sleep 5
  deployment="$(latest_deployment)"
  if [ "$(jq -r '.deploymentId // ""' <<<"$deployment")" = "$previous" ]; then
    continue
  fi
  case "$(jq -r '.status // ""' <<<"$deployment")" in
    done)
      echo "deployed $IMAGE_TAG"
      exit 0
      ;;
    error)
      echo "the deployment failed: $(jq -r '.errorMessage // "see the deployment log in Dokploy"' <<<"$deployment")" >&2
      exit 1
      ;;
  esac
done

echo "the deployment did not finish within ${timeout_seconds}s" >&2
exit 1
