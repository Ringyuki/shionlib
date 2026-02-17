<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./apps/frontend/public/assets/images/readme/shionlib-dark.webp">
  <source media="(prefers-color-scheme: light)" srcset="./apps/frontend/public/assets/images/readme/shionlib-light.webp">
  <img alt="shionlib" src="./apps/frontend/public/assets/images/readme/shionlib-light.webp">
</picture>

## Introduction

👋 Hi, welcome to Shionlib!

As you can see, this is a resource site for visual novels/Galgame. We provide downloads for **game releases** and **translation patches**—free, barrier-free, and without speed limits.

Shionlib is **free** and **open source**. You can find our source code on [our GitHub repository](https://github.com/Ringyuki/shionlib). If you have questions or suggestions, feel free to open an [Issue](https://github.com/Ringyuki/shionlib/issues) or a [Pull Request](https://github.com/Ringyuki/shionlib/pulls).

## Principles & Site Definition

Shionlib will always be **free** and **open source**; we do not charge users any fees. All resources on Shionlib are uploaded by users, and we cannot guarantee their completeness or safety.

If there are lawful purchase channels in your country/region, you can find store or official website links under **Related Links** on a game’s page. If something is missing, you can add it via the **Edit** function.

As mentioned above, in many countries and regions there is often a lack of compliant channels for purchasing legitimate visual novels/Galgame. Many excellent developers have also disappeared for various reasons, and their works can be hard to find across the internet.

Therefore, one of the original aims of Shionlib is to build a complete, curated archive of visual novels/Galgame across all eras, while giving more people the chance to experience this **wonderful art form**.

If you are able to, we **highly recommend** purchasing official copies to support the works and creators you love, so that the culture we care about can continue.

## Community Groups

You can find the link to our Telegram group at the bottom of the website.

## Infringement Reports

If any content on the site infringes your rights, please contact us via the **Contact** button at the bottom of the site. After verification, we will remove the relevant content immediately.

## Monorepo CI/CD

This monorepo uses root workflows only:

- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/deploy-frontend.yml`
- `.github/workflows/deploy-backend.yml`

Deployment flow:

1. `push` to `main` deploys to staging automatically.
2. `workflow_dispatch` supports manual deploy to `staging` or `production`.
3. Production should be protected by GitHub Environment reviewers.

Manual production release flow:

1. Create and push a release tag (for example `frontend-v0.2.0` or `backend-v0.2.0`).
2. Open Actions and run `deploy frontend` or `deploy backend`.
3. Select `target_environment=production`.
4. Fill `release_ref` with the tag or commit SHA (required for production).
5. Wait for Environment approval and verify health check result.
6. If rollback is needed, rerun workflow_dispatch with a previous known-good `release_ref`.

Recommended GitHub Environments:

- `staging-frontend`
- `production-frontend`
- `staging-backend`
- `production-backend`

Required repository variables:

- `E2E_BACKEND_BASE_URL` (for `.github/workflows/e2e.yml`)

Required environment variables:

- `HEALTHCHECK_URL`
- `PM2_ENV`
- `NEXT_PUBLIC_PROD_API_PATH`
- `NEXT_PUBLIC_API_PORT`
- `NEXT_PUBLIC_SHIONLIB_IMAGE_BED_HOST`
- `NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL`
- `NEXT_PUBLIC_UMAMI_SCRIPT_URL`
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
- `NEXT_PUBLIC_OPENPANEL_CLIENT_ID`
- `NEXT_PUBLIC_OPENPANEL_API_URL`
- `NEXT_PUBLIC_RYBBIT_SCRIPT_URL`
- `NEXT_PUBLIC_RYBBIT_SITE_ID`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Required environment secrets:

- `SSH_KEY`
- `SSH_HOST`
- `SSH_PORT`
- `SSH_USER`
- `SSH_CLOUDFLARED_ID`
- `SSH_CLOUDFLARED_SECRET`
- `DEPLOY_DIR`
