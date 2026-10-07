# Testing

| Level       | Location                                                            | Tools                                                   |
| ----------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Model rules | `features/<name>/<name>.test.ts`                                    | plain values typed with `Schema<...>`                   |
| Use-cases   | `features/<name>/<name>.use-cases.test.ts`                          | `fakeApi()` from `~/shared/api/testing`                 |
| Platform    | `shared/**/*.test.ts`                                               | stub `fetch`, `RouterContextProvider` with `apiContext` |
| End to end  | `apps/web/e2e/*.spec.ts` (Playwright, against the Go API e2e stack) | `e2e/support` (accounts, sessions, notices)             |

- `fakeApi().on(method, path, data)` answers with an envelope whose `data` is checked against the contract; `.fail(method, path, status, { code, message })` answers with an error envelope. `fake.requests` holds the requests for assertions on paths, queries and bodies.
- Fixtures are values typed with `Schema<'Name'>` so contract changes break them at compile time.
- Test failure paths of every use-case that catches an `ApiError`.
- Do not mock React Router or hina-ui; keep logic out of components so it can be tested as plain functions.
- Run `pnpm test` (Vitest); `verify.sh` runs it with the rest of the checks.

## End to end

Every user flow a phase ports gets Playwright specs in `apps/web/e2e` in the same phase.

- **Run everything:** `pnpm test:e2e:web` at the repository root (`docker/scripts/test-e2e-web.sh`).
  - It starts the API half of `docker/compose.e2e-go.yml`: Postgres, Redis, ClamAV, `migrate up`, the `devtool e2e prepare` dataset and the Go API on `:5201`.
  - Playwright then builds the web app and serves it on `:5330`.
  - CI runs the same script in `.github/workflows/web-e2e.yml`.
- **Run against an API that is already up:** reseed it first (`go run ./cmd/devtool e2e prepare` with that API's env), then run `E2E_API_URL=http://localhost:<port> pnpm e2e` in `apps/web`.
- **Behind an HTTP proxy** (either way), set `NO_PROXY=localhost,127.0.0.1`. Otherwise Playwright's server check goes to the proxy, gets an answer and never starts the web server.
- **Ingress:** `pnpm start` serves only the web app, while in production the ingress sends `/api/*` to the API. Specs whose page calls the API itself (uploads) import `test` from `./support/ingress`, which forwards the page's `/api/*` requests to `E2E_API_URL` without the prefix. Against `E2E_BASE_URL` the real ingress does it and the fixture stays off.
- **Dataset:**
  - Games 1 to 6.
  - Resource 1 on game 1, uploaded by `e2e_mutable_user`, can be reported.
  - The file on game 3 is held for malware review, so its resource shows only to its uploader, `e2e_admin`.
  - The default upload chunk size is 1 MiB, so a file of a few MiB uploads in several chunks.
  - Accounts are `e2e_user` (member), `e2e_mutable_user` (owner of resource 1) and `e2e_admin`. All use the password `ShionlibE2E123!` (`E2E_USER_PASSWORD`).
  - Other seeded accounts serve specs that sign in or out on their own.
- **Sessions:**
  - `sessions.setup.ts` signs in member, owner and admin once.
  - Specs reuse them with `test.use({ storageState: sessionFile('member') })`.
  - A spec that signs out uses its own account, so it never revokes a shared session.
- **Isolation:**
  - Specs run in parallel on one dataset. Each mutation touches a game or account that no other spec reads: favorites on games 2, 4 and 5, reports by the member, edits by the owner, uploads by the owner on game 6.
  - Upload specs run serially (`mode: 'serial'`): the server lists every unfinished upload of the account, so parallel uploads would show up in each other's tray.
  - Never assert on data that another spec changes.
  - A flow that cannot repeat on the same data (reporting a resource once) sets `test.describe.configure({ retries: 0 })`.
- **Selectors:**
  - Locate by role and visible text of the `zh` UI.
  - Check toasts with `expectNotice` (the 「通知」 region). The toast's `role="alert"` copy is `aria-hidden`.
  - While a modal popover or dialog is open, the rest of the page is outside the accessibility tree. Close it (`Escape`) before asserting on its trigger.
  - `Section title` gives no accessible name, so find a section through its heading.
- **Turnstile:**
  - The web server uses the always-pass test site key, and `docker/env/api-e2e.env` the matching test secret.
  - Seeded files have no stored object, so the download link fails with 「下载资源文件不存在」. The download spec asserts that error, which covers the chain from Turnstile through the action to the API.
