# E2E Tests (Playwright)

## Run locally

1. Install deps:
   - `pnpm install`
2. Install browser:
   - `pnpm test:e2e:install`
3. Run tests:
   - `pnpm test:e2e`

CI install (Linux) if system deps are required:

- `pnpm test:e2e:install:ci`

## Useful modes

- UI mode: `pnpm test:e2e:ui`
- Headed mode: `pnpm test:e2e:headed`
- Debug mode: `pnpm test:e2e:debug`

## Base URL and server behavior

- By default, Playwright starts local dev server at `http://127.0.0.1:3100`.
- If `E2E_BASE_URL` is set, Playwright will use external target and skip starting local server.

Examples:

- `E2E_BASE_URL=http://127.0.0.1:3000 pnpm test:e2e`
- `E2E_PORT=3200 pnpm test:e2e`

## Auth scenario coverage plan

Current auth refresh test files are scaffolded with `test.skip` in:

- `tests/e2e/auth/session-refresh.spec.mjs`

To fully automate these cases, add deterministic fixtures:

- Test-only API to mint login session cookies.
- Stable selectors for `LoginRequired` and logged-in avatar/state.
