# Testing

| Level       | Location                                                  | Tools                                                   |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Model rules | `features/<name>/<name>.test.ts`                          | plain values typed with `Schema<...>`                   |
| Use-cases   | `features/<name>/<name>.use-cases.test.ts`                | `fakeApi()` from `~/shared/api/testing`                 |
| Platform    | `shared/**/*.test.ts`                                     | stub `fetch`, `RouterContextProvider` with `apiContext` |
| End to end  | `apps/web/e2e` (Playwright, against the Go API e2e stack) | added with the first ported user flow                   |

- `fakeApi().on(method, path, data)` answers with an envelope whose `data` is checked against the contract; `.fail(method, path, status, { code, message })` answers with an error envelope. `fake.requests` holds the requests for assertions on paths, queries and bodies.
- Fixtures are values typed with `Schema<'Name'>` so contract changes break them at compile time.
- Test failure paths of every use-case that catches an `ApiError`.
- Do not mock React Router or hina-ui; keep logic out of components so it can be tested as plain functions.
- Run `pnpm test` (Vitest); `verify.sh` runs it with the rest of the checks.
