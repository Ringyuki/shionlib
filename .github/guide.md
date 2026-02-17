# CI/CD Guide

This monorepo uses root workflows only:

- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/deploy-frontend.yml`
- `.github/workflows/deploy-backend.yml`

## Deployment Flow

1. `push` to `main` deploys to staging automatically.
2. `workflow_dispatch` supports manual deploy to `staging` or `production`.
3. Production should be protected by GitHub Environment reviewers.

## Manual Production Release Flow

1. Create and push a release tag (for example `frontend-v0.2.0` or `backend-v0.2.0`).
2. Open Actions and run `deploy frontend` or `deploy backend`.
3. Select `target_environment=production`.
4. Fill `release_ref` with the tag or commit SHA (required for production).
5. Wait for Environment approval and verify health check result.
6. If rollback is needed, rerun `workflow_dispatch` with a previous known-good `release_ref`.

## Recommended GitHub Environments

- `staging-frontend`
- `production-frontend`
- `staging-backend`
- `production-backend`

## Required Repository Variables

- `E2E_BACKEND_BASE_URL` (for `.github/workflows/e2e.yml`)

## Required Environment Variables

- `HEALTHCHECK_URL`
- `PM2_ENV`
- `NEXT_PUBLIC_PROD_API_PATH`
- `INTERNAL_API_BASE_URL` (preferred for Next.js rewrites in SSR/server runtime)
- `INTERNAL_API_PORT` (fallback when `INTERNAL_API_BASE_URL` is not set)
- `NEXT_PUBLIC_API_PORT` (deprecated compatibility fallback, safe to remove after migration)
- `NEXT_PUBLIC_SHIONLIB_IMAGE_BED_HOST`
- `NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL`
- `NEXT_PUBLIC_UMAMI_SCRIPT_URL`
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
- `NEXT_PUBLIC_OPENPANEL_CLIENT_ID`
- `NEXT_PUBLIC_OPENPANEL_API_URL`
- `NEXT_PUBLIC_RYBBIT_SCRIPT_URL`
- `NEXT_PUBLIC_RYBBIT_SITE_ID`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

## Required Environment Secrets

- `SSH_KEY`
- `SSH_HOST`
- `SSH_PORT`
- `SSH_USER`
- `SSH_CLOUDFLARED_ID`
- `SSH_CLOUDFLARED_SECRET`
- `DEPLOY_DIR`
