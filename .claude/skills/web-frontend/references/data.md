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

## Browser calls

The browser talks to the web server only. The exceptions are endpoints that cannot be proxied through loaders and actions: chunked uploads and the `GET /message/stream` SSE stream. They use the same-origin `/api` prefix (proxied to the API by the ingress, and by Vite in development) and are wrapped in a hook in their feature.

## Caching and revalidation

- `lang.tsx` revalidates only when the locale changes, so messages are sent once per locale.
- Layout loaders that depend on the viewer (`site.tsx`) revalidate after actions (the default).
- Use `shouldRevalidate` for expensive loaders whose data a mutation cannot change.
