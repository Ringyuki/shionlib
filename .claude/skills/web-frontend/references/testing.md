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
  - The API is told that the site lives at the web client's own origin (`FRONTEND_PORT` = `E2E_WEB_PORT`, 5330), which is what its CORS, WebAuthn and OIDC checks compare against; a passkey spec fails with any other origin. Passkeys are exercised with Chromium's virtual authenticator (`WebAuthn.addVirtualAuthenticator` over a CDP session).
  - Image storage has only placeholder credentials there, so specs do not upload avatars or covers.
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
  - Upload specs run serially (`mode: 'serial'`): the server lists every unfinished upload of the account, so parallel uploads would show up on each other's uploads page.
  - Files of random bytes named `.7z` fail the archive check about a minute after they are uploaded and are then removed, so upload specs assert that the files appear, never that they are published.
  - Never assert on data that another spec changes.
  - A flow that cannot repeat on the same data (reporting a resource once) sets `test.describe.configure({ retries: 0 })`.
- **Selectors:**
  - Locate by role and visible text of the `zh` UI.
  - Check toasts with `expectNotice` (the 「通知」 region). The toast's `role="alert"` copy is `aria-hidden`.
  - While a modal popover or dialog is open, the rest of the page is outside the accessibility tree. Close it (`Escape`) before asserting on its trigger.
  - `Section title` gives no accessible name, so find a section through its heading.
  - The editor is a `textbox` named by its label (`评论内容`, `正文`); its engine arrives after the page, and Playwright waits for it. Write into it as a person does: click it, `page.keyboard.type`, the toolbar's buttons (`getByRole('toolbar', { name: '格式' })`; the paragraph style is a button named by the current style that opens a menu of `menuitemradio`s), the shortcuts (`## `, `- `) or a slash command (`/` opens `getByRole('listbox', { name: '插入内容' })`); `fill` replaces everything with plain text. A link's address is the textbox `链接地址`, applied with Enter or 「确定」; a picture's caption is the textbox `图片说明` inside its figure, which appears once the picture is selected. A table is worked through the buttons it shows while it holds the caret: `在下方添加一行`, `在右侧添加一列`, and the grips `选中这一行` / `选中这一列`, which open a menu (`{ force: true }`: a grip is four pixels wide). Assert on what the editor holds with `toHaveText` or on the tags inside it, never `toHaveValue` (the caption is the one field in it). A key pressed in the same instant as a click reaches the editor before the click has moved the caret; a person cannot do that, a script can, so let the click settle (an assertion, or typing through `locator.click()` then `keyboard`).
  - The e2e stack has no object storage, so a picture upload is answered by `page.route`: an avatar or a cover on its resource route, a document picture on the API address the browser sends it to (`**/api/uploads/small/richtext/image`, answered with the API's envelope and a key of the form `richtext/<user id>/<uuid>.webp`, the only kind a document accepts), and the picture itself on its key (`**/<key>`), because the image host is not part of the stack and a picture that fails to load is replaced by its fallback while the test looks for it; the cropping dialog and the editor themselves run for real.
- **Cap:**
  - `docker/scripts/test-e2e-web.sh` starts a real Cap in the stack, creates a site key for the run (`docker/scripts/cap-site-key.sh`, without instrumentation, without the block on automated browsers and at the lowest difficulty, so Playwright passes and solves it in milliseconds) and hands its secret to the API and its endpoint to the web server (`CAP_ENDPOINT`).
  - Seeded files have no stored object, so the download link fails with 「下载资源文件不存在」. The download spec waits for Cap to redeem the solution and asserts that error, which covers the chain from Cap through the action to the API. Do not assert on the verification popover: it is gone within a frame or two.
  - What happens with a link (browser, aria2, a manager's install request, copy) cannot be reached in e2e; the model and vendor tests cover the requests, and a change there is checked in the dev app with the link response stubbed.
