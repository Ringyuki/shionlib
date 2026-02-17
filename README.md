# shionlib monorepo

This repository contains both apps in one pnpm workspace:

- `apps/frontend`: Next.js frontend (`shionlib-frontend`)
- `apps/backend`: NestJS backend (`shionlib-backend`)

## Requirements

- Node.js 20+
- pnpm 10+

## Install

```bash
pnpm install
```

## Run

```bash
# run both apps (parallel)
pnpm dev

# or run separately
pnpm dev:backend
pnpm dev:frontend
```

## Quality checks

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

## Frontend E2E (against deployed backend)

Set these env vars before running frontend e2e locally:

- `NEXT_PUBLIC_PROD_API_PATH`
- `INTERNAL_API_BASE_URL`

Example:

```bash
NEXT_PUBLIC_PROD_API_PATH=https://api.example.com \
INTERNAL_API_BASE_URL=https://api.example.com \
pnpm --filter shionlib-frontend test:e2e
```

In GitHub Actions, configure repository variable `E2E_BACKEND_BASE_URL` to enable
`.github/workflows/e2e.yml`.

## Build

```bash
pnpm build
```
