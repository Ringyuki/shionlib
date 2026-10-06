# Data

## The contract

`apps/api/openapi/openapi.json` (generated from the Go routes) is the only source of API types. `pnpm api:generate` writes:

- `app/shared/api/generated/openapi.ts` — `paths`, `components`, `operations` (openapi-typescript);
- `app/shared/api/generated/business-codes.ts` — `BusinessCode`, built from `components.schemas.BusinessCode` (`x-enum-varnames`).

Both are committed and checked by `verify.sh`. When the API changes, regenerate and fix the type errors; never patch the generated files.

## Request tool

```ts
const game = await api.get('/game/{id}/header', { params: { path: { id } } })
await api.put('/favorites/{id}', { params: { path: { id: listId } }, body: { game_id: gameId } })
```

- Paths, path/query parameters and bodies are checked against the contract; the result type is the envelope's `data` (`undefined` for void operations).
- Non-2xx answers throw `ApiError`: `status`, `code`, `message` (localized by the API), `failure` (the full error envelope, including `data.errors` field messages) and `is('BUSINESS_CODE')`.
- Type helpers: `Schema<'Name'>`, `ApiData<Path, Method>`, `ApiBody<Path, Method>`, `ApiQuery<Path, Method>`, `ApiFailure`, `BusinessCodeName`.

## Server integration

- `apiMiddleware` (root) creates one `ApiClient` per request on the API's internal URL (`API_INTERNAL_URL`) with a session that:
  - forwards the visitor's cookies, `user-agent`, `accept-language`, `x-forwarded-for` and `x-real-ip`;
  - refreshes before the first call when the refresh cookie exists and the access token is missing or expires within 30 s;
  - refreshes once and retries when the API answers 401 `AUTH_UNAUTHORIZED`/`AUTH_INVALID_TOKEN` or marks an optional token stale (`shionlib-auth-stale: 1`);
  - clears both auth cookies when the refresh token is rejected;
  - appends every `Set-Cookie` it received to the page or data response.
- `routeLoader(args, run)` returns `run(api)`; an `ApiError` becomes `throw data(failure, { status })`, so the nearest `ErrorBoundary` renders 401/403/404/5xx pages with the right HTTP status.
- `routeAction(args, run)` returns `{ ok: true, result }`, or `data({ ok: false, failure }, { status })` for an `ApiError`. Other errors propagate.
- `idParam(value)` parses positive integer ids and throws 404 otherwise.

## Fetchers

- Mutations and lazy loads that should not navigate use a fetcher inside a feature hook.
- Submit JSON: `fetcher.submit(command, { method: 'post', action: href('/resources/x'), encType: 'application/json' })`. The action parses the body with `readCommand(args, <thing>Command)` (valibot command schema from `<name>.schema.ts`), which answers 400 for malformed input; see `forms.md`.
- Read results as `fetcher.data` (typed by `useFetcher<typeof handler>()`); failures are `{ ok: false, failure }`.
- Optimistic state is derived from `fetcher.json`/`fetcher.formData` while the fetcher is busy, never stored separately.
- After an action, React Router revalidates the page loaders and loaded fetchers; do not refetch by hand.
- A submission whose result no loader shows (a view counter, issuing a download link) passes `defaultShouldRevalidate: false` to `fetcher.submit`, so it does not reload the page.
- `routeAction` failures also carry `retryAfter` (seconds, from the API's `Retry-After` on 429), read from `ApiError.retryAfter`; show it next to `failure.message`.

## Browser calls

### Third-party services

The visitor's browser also talks to services that are not ours. Each has one client in `app/shared/vendor/` and nothing else calls them:

- `turnstile.ts` loads Cloudflare Turnstile from `challenges.cloudflare.com` once; `TurnstileChallenge` (`turnstile-challenge.tsx`) renders the widget into a hina-ui `Stack` ref with the site key from `usePublicConfig()`, the visitor's locale and theme, `appearance: 'interaction-only'`, and reports `onToken`/`onFailure`. Tokens are single-use: request a new one for every protected call and send it through an action, never to the API from the browser.
- `aria2.ts` pushes a URL to the visitor's own aria2 over JSON-RPC (`aria2.addUri`) and returns `{ ok: true, gid }` or `{ ok: false, reason: 'unreachable' | 'unauthorized' | 'rejected' }`; replies are parsed by `aria2.schema.ts`.

### Our API from the browser

The browser talks to the web server only. The exceptions cannot go through loaders and actions: uploads, which run for hours across pages, and the `GET /message/stream` SSE stream. They use the same-origin `/api` prefix (proxied to the API by the ingress, and by Vite in development).

- **Transport.** `~/shared/api/xhr.ts` is the only place that uses `XMLHttpRequest`; it gives upload progress, which `fetch` cannot. `browser-client.ts` builds a typed `ApiClient` over it (`createBrowserApi()`), and `chunk.ts` puts one upload chunk with progress (`uploadChunk`), its path, header and result typed from the generated contract.
- **Session.** Both refresh an expired session once (`POST /auth/token/refresh`, shared by concurrent requests) and repeat the request, on 401 `AUTH_UNAUTHORIZED`/`AUTH_INVALID_TOKEN` or the `shionlib-auth-stale` header, the same rule as `session.server.ts` (`~/shared/api/session.ts`).
- **Who may use it.** Only `features/upload` imports `browser-client`, `chunk` or `xhr` (lint).

### The upload manager (`features/upload`)

- One `UploadManager` per tab and signed-in viewer, created by `UploadProvider` in the `site` layout and started in an effect; uploads continue across navigations.
- Functional core, imperative shell: `upload-state.ts` (`reduce(state, event)`), `upload-restore.ts` and the rules in `upload.ts` are pure and tested exhaustively; `UploadManager` (queue, persistence, submissions), `UploadRunner` (one file's chunks, retries, stall detection) and `FileHasher` (a Web Worker computing chunk SHA-256 and the file's BLAKE3 with `hash-wasm`) own the requests, workers and timers. React reads snapshots through `useUploads()` (`useSyncExternalStore`).
- The server holds progress. `localStorage` (`shionlib_uploads_<viewer>`, parsed by `upload.schema.ts`) keeps only what it cannot know: what each file is for (a new resource with its fields, an added file, a replaced file), each file's name, size and modification time, and its session. After a reload, uploads still in progress wait for their file to be chosen again; they are matched by name, size and modification time, rehashed locally, and only the missing chunks are sent.
- A resource is created, or files are added or replaced, once all its uploads are finished. Web Locks keep one tab per session.

## Caching and revalidation

- `lang.tsx` revalidates only when the locale changes, so messages are sent once per locale.
- Layout loaders that depend on the viewer (`site.tsx`) revalidate after actions (the default).
- Use `shouldRevalidate` for expensive loaders whose data a mutation cannot change.
