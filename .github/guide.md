# CI/CD Guide

This monorepo uses root workflows only:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-frontend.yml`
- `.github/workflows/deploy-backend.yml`
- `.github/workflows/deploy-og.yml`
- `.github/workflows/promote-frontend-production.yml`
- `.github/workflows/promote-backend-production.yml`
- `.github/workflows/promote-og-production.yml`

## Deployment Flow

1. `push` to `main` deploys to staging automatically.
2. On successful staging deploy, production promotion runs automatically:
   - frontend: creates `frontend-prod-<sha7>` tag and triggers production deploy.
   - backend: creates `backend-prod-<sha7>` tag and triggers production deploy.
   - og: creates `og-prod-<sha7>` tag and triggers production deploy.
3. `workflow_dispatch` still supports manual deploy to `staging` or `production`.
4. Production should be protected by GitHub Environment reviewers.

## Manual Production Release Flow

1. Create and push a release tag (for example `frontend-v0.2.0`, `backend-v0.2.0`, or `og-v0.2.0`).
2. Open Actions and run `deploy frontend`, `deploy backend`, or `deploy og`.
3. Select `target_environment=production`.
4. Fill `release_ref` with the tag or commit SHA (required for production).
5. Wait for Environment approval and verify health check result.
6. If rollback is needed, rerun `workflow_dispatch` with a previous known-good `release_ref`.

## Auto Promotion Details

- Auto promotion only runs when staging deploy workflows are triggered by `push` on `main` and finish with `success`.
- If the auto-generated tag already exists at the same commit, auto promotion is skipped to avoid duplicate production runs.
- If the tag exists but points to a different commit, promotion fails and requires manual intervention.

## Recommended GitHub Environments

- `staging-frontend`
- `production-frontend`
- `staging-backend`
- `production-backend`
- `staging-og`
- `production-og`

## Required Environment Variables

- For OG environments (`staging-og` / `production-og`), `HEALTHCHECK_URL` and `PM2_ENV` are required.
- `HEALTHCHECK_URL`
- `PM2_ENV`
- `NEXT_PUBLIC_PROD_API_PATH`
- `INTERNAL_API_BASE_URL` (preferred for Next.js rewrites in SSR/server runtime)
- `INTERNAL_API_PORT` (fallback when `INTERNAL_API_BASE_URL` is not set)
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
