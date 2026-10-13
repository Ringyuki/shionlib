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
  - That resource also carries a report from `e2e_user` awaiting review (「Seeded report for the admin review flow.」), and game 3 has a second, unpublished resource whose file `seeded-stalled-sample.7z` is paused after six failed checks. Both are for `admin.spec.ts`: it reviews the report (valid, lowest level, nothing removed, nobody notified) and starts the stalled check again, but only opens and cancels the review of the held file, which `game.spec.ts` needs to stay held.
  - The default upload chunk size is 1 MiB, so a file of a few MiB uploads in several chunks.
  - Accounts are `e2e_user` (member), `e2e_mutable_user` (owner of resource 1) and `e2e_admin`. All use the password `ShionlibE2E123!` (`E2E_USER_PASSWORD`).
  - Other seeded accounts serve specs that sign in or out on their own.
  - Game 4 carries a comment held for review (with two moderation runs) and a draft walkthrough waiting for review, both written by `e2e_managed_user`, for `admin-content.spec.ts`. Its tests run in order: the first ones read what the last ones decide.
  - `e2e_staff_user` is an administrator who is not a super administrator, for what such an account may see but not change (`admin-settings.spec.ts` and `admin-ai.spec.ts` sign in as it).
  - The AI gateway has two providers that cannot be reached (`e2e-unreachable`, `e2e-backup`), the models `gpt-5-mini` (two routes: the first with an automatic JSON-mode adjustment, the second suspended for 「402 Insufficient credits」) and `omni-moderation-latest`, both scenes configured, six requests of the last three hours (one call with a failed and a successful attempt and its payload, a timeout, a check, a playground run) and a catalog of three providers and three models, of which `Claude Haiku 4.5` is offered by `e2e-unreachable` but not added. `admin-ai.spec.ts` changes all of it, in order; other specs add failed moderation requests to the log, so it asserts the seeded rows, never totals. Nothing answers upstream: a check and a playground run end in 「网络错误」.
  - Games 7 and 8 (「E2E 管理画面用エントリ 7」, 「… 8」) are hidden, carry no tag, date or resource and are not among the recent updates, so no public list ever shows them. They belong to `admin-games.spec.ts`, whose tests run in order: it shows, marks and hides game 7 again, and removes game 8, which then stands among the entries kept out of the catalog beside the seeded 「テスト用エントリ」 (source number 21004, removed by `e2e_admin` nine days ago, shown as 「上周」). The source is registered with an address nothing listens on (`HIKARINAGI_*` in `docker/env/api-e2e.env`) and has a seeded sync state (position `135875`, 14 changes an hour ago), so a sync, a search and a restore all end in 「数据源暂时无法访问」. The scheduled pull fails the same way every ten minutes, so no test reads the source's status before it has failed a sync itself.
  - Seven sponsor orders are seeded, in this order, so their ids are 1 to 7: `e2e-order-member-earlier` (completed 80 days ago by `e2e_user`, $2, 「Earlier seeded message.」), `e2e-order-passerby` (completed 45 days ago without an account, $4, named 「Seeded Passerby」, 「Seeded guest message.」), `e2e-order-refunded` ($8), `e2e-order-expired` ($3), `e2e-order-unpaid` ($10, named 「Seeded Guest」, no account), `e2e-order-anonymous` (completed long ago, $5, private) and `e2e-order-member` (completed a minute ago by `e2e_user`, $20, 「Seeded sponsor message.」). Only the two of `e2e_user` belong to an account, so completing another by hand extends nobody's sponsor badge. `admin-sponsors.spec.ts` runs in order: it completes and refunds the unpaid order and deletes the expired one. `sponsor.spec.ts` reads the wall (the member once, with the later message; the passerby; no amounts), the closed state (`sponsor.enabled` is off in e2e, and no spec switches it on) and the member's receipt at `/zh/sponsor/orders/7`; while the admin spec holds the unpaid order completed, 「Seeded Guest」 is on the wall too, so the wall is never counted. The seeded orders carry the name of the wired payment provider, so the API gives their methods a brand and the pages show 「支付宝」 and 「微信支付」. Paying needs the provider's credentials and is not in the suite.
  - `e2e_managed_user` belongs to `admin-users.spec.ts`, which bans it, resets its password and changes its role; no other spec signs in as it or reads it.
- **Sessions:**
  - `sessions.setup.ts` signs in member, owner and admin once.
  - Specs reuse them with `test.use({ storageState: sessionFile('member') })`.
  - A spec that signs out uses its own account, so it never revokes a shared session.
- **Typing before the page is ready:** a field filled right after `page.goto` can lose its value when React takes over the server's HTML. Wait for `page.waitForLoadState('networkidle')` first, and commit a hina-ui `NumberInput` with `press('Tab')` (it takes its value on leaving the field, and `locator.blur()` does not make it).
- **Isolation:**
  - Specs run in parallel on one dataset. Each mutation touches a game or account that no other spec reads: favorites on games 2, 4 and 5, reports by the member, edits by the owner, uploads by the owner on game 6. The member's lists are kept on 「我的收藏」 (`favorite.spec.ts`), which also checks that a private list stays off the member's profile. Profiles are read as they are seeded: user 3 has uploads and a page background (its picture, `user/e2e/background/seeded.webp`, exists nowhere, so a spec answers it itself), user 4 has nothing public, and the profile dialog is tried on `e2e_admin_ops_user`.
  - The member writes walkthroughs on game 2 only, in tests that run serially: an author has one walkthrough per game, and each test deletes what it wrote. The guest's tests read game 3, which has none.
  - Upload specs run serially (`mode: 'serial'`): the server lists every unfinished upload of the account, so parallel uploads would show up on each other's uploads page.
  - Files of random bytes named `.7z` fail the archive check about a minute after they are uploaded and are then removed, so upload specs assert that the files appear, never that they are published.
  - Never assert on data that another spec changes.
  - A flow that cannot repeat on the same data (reporting a resource once) sets `test.describe.configure({ retries: 0 })`.
- **Selectors:**
  - Locate by role and visible text of the `zh` UI.
  - Check toasts with `expectNotice` (the 「通知」 region). The toast's `role="alert"` copy is `aria-hidden`.
  - While a modal popover or dialog is open, the rest of the page is outside the accessibility tree. Close it (`Escape`) before asserting on its trigger.
  - `Section title` gives no accessible name, so find a section through its heading.
  - The editor is a `textbox` named by its label (`评论内容`, `说明`); its engine arrives after the page, and Playwright waits for it. Write into it as a person does: click it, `page.keyboard.type`, the toolbar's buttons (`getByRole('toolbar', { name: '格式' })`) or the shortcuts; `fill` replaces everything with plain text. A link's address is the textbox `链接地址`, applied with Enter or 「确定」. Assert on what the editor holds with `toHaveText` or on the tags inside it, never `toHaveValue`. A key pressed in the same instant as a click reaches the editor before the click has moved the caret; a person cannot do that, a script can, so let the click settle (an assertion, or typing through `locator.click()` then `keyboard`).
  - The e2e stack has no object storage, so a picture upload is answered by `page.route`: an avatar or a cover on its resource route, and the picture itself on its key (`**/<key>`), because the image host is not part of the stack and a picture that fails to load is replaced by its fallback while the test looks for it; the cropping dialog itself runs for real.
- **Cap:**
  - `docker/scripts/test-e2e-web.sh` starts a real Cap in the stack, creates a site key for the run (`docker/scripts/cap-site-key.sh`, without instrumentation, without the block on automated browsers and at the lowest difficulty, so Playwright passes and solves it in milliseconds) and hands its secret to the API and its endpoint to the web server (`CAP_ENDPOINT`).
  - Seeded files have no stored object, so the download link fails with 「下载资源文件不存在」. The download spec waits for Cap to redeem the solution and asserts that error, which covers the chain from Cap through the action to the API. Do not assert on the verification popover: it is gone within a frame or two.
  - What happens with a link (browser, aria2, a manager's install request, copy) cannot be reached in e2e; the model and vendor tests cover the requests, and a change there is checked in the dev app with the link response stubbed.
