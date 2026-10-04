# Shionlib web

Server-rendered web client for Shionlib, built with React Router (framework mode) and `@hina-ui/react`. Engineering rules: `.claude/skills/web-frontend/SKILL.md`.

## Development

`apps/web` is its own pnpm workspace with its own lockfile, separate from the legacy JavaScript apps.

```bash
cd apps/web
pnpm install
API_INTERNAL_URL=http://localhost:5000 pnpm dev
```

- `API_INTERNAL_URL` is where the web server reaches the Go API (default `http://localhost:5000`). In development Vite also proxies `/api/*` to it for browser-side calls.
- `pnpm api:generate` regenerates the API types after `apps/api/openapi/openapi.json` changes.
- `.claude/skills/web-frontend/scripts/verify.sh` runs every check CI runs.

## Production

`apps/web/Dockerfile` (build context: `apps/web`) produces an image serving on port 3000. The ingress routes `/api/*` (prefix stripped) to the API and everything else to the web container; the web container needs `API_INTERNAL_URL` pointing at the API service.
