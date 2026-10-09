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
- `IMAGE_BASE_URL` is the image host that stored image keys are served from (default `https://t.shionlib.com`).
- `CAP_ENDPOINT` is where the browser reaches the site's [Cap](https://github.com/tiagozip/cap) instance for download verification, with the site key: `/cap/<site key>/`, since the ingress routes `/cap/*` (prefix stripped) to Cap; `https://<cap>/<site key>/` works too when Cap has a domain of its own. It pairs with the API's `CAP_URL`, `CAP_SITE_KEY` and `CAP_SECRET`. For local development run Cap (`docker run -d -p 5850:3000 -e ADMIN_KEY=<12+ characters> -e REDIS_URL=redis://host.docker.internal:6379 -e REDIS_PREFIX=cap: tiago2/cap:3.1.14`), create a key with `docker/scripts/cap-site-key.sh http://localhost:5850 <admin key>`, give the API the two values it prints and start the web server with `CAP_ENDPOINT=/cap/<site key>/`: Vite proxies `/cap/*` to `CAP_URL` (default `http://localhost:5850`), so other devices on the network reach it too.
- `HIKARINAGI_SITE_URL` is the Hikarinagi site that catalog entries link back to (default `https://www.hikarinagi.org`).
- `pnpm api:generate` regenerates the API types after `apps/api/openapi/openapi.json` changes.
- `.claude/skills/web-frontend/scripts/verify.sh` runs every check CI runs.

## Production

`apps/web/Dockerfile` (build context: `apps/web`) produces an image serving on port 3000. The ingress routes `/api/*` (prefix stripped) to the API, `/cap/*` (prefix stripped) to Cap and everything else to the web container; the web container needs `API_INTERNAL_URL` pointing at the API service, `IMAGE_BASE_URL` for images, `CAP_ENDPOINT` and `HIKARINAGI_SITE_URL` (Cap itself is set up as `apps/api/docs/deployment.md` describes).
