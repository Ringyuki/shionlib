# Data

## The contract

`apps/api/openapi/openapi.json` (generated from the Go routes) is the only source of API types. `pnpm api:generate` writes:

- `app/shared/api/generated/openapi.ts` — `paths`, `components`, `operations` (openapi-typescript);
- `app/shared/api/generated/business-codes.ts` — `BusinessCode`, built from `components.schemas.BusinessCode` (`x-enum-varnames`);
- `app/shared/api/generated/constraints.ts` — the limits and choices of request bodies and of the schemas they refer to (`references/forms.md`).

All three are committed and checked by `verify.sh`. When the API changes, regenerate and fix the type errors; never patch the generated files.

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
- `routeAction(args, run)` returns `{ ok: true, result }`, or `data({ ok: false, failure, retryAfter, status }, { status })` for an `ApiError`. Other errors propagate. `routeLazyLoader(args, run)` answers a loader that a fetcher loads the same way.
- `idParam(value)` parses positive integer ids and throws 404 otherwise.
- A list with pages keeps its page in the `page` parameter, and one tool reads it and guards it (`~/shared/route/paging`): `requestedPage(args.url)` gives the page (the first for anything unreadable), and after the use-case answered, `keepWithinPages(args.url, total, pageSize)` redirects a page past the end to the last one, keeping the rest of the address. In the component, `usePageTurn()` (`~/shared/route/use-page-turn`) gives `turnTo(page)`, which changes only the page of the current address, and `turning`, true while the same path reloads; they go to `DataList`'s `onPageChange` and `loading`. Every page turn goes through this hook, because it is what sends the visitor to the start of the list (`listStart`, see the shell's scroll position in `references/ui.md`): a list that builds the address of a page itself (the library and the uploads page, whose address holds more than the page and shows the change before it loads; the inbox; the search results) hands that address to the hook's `turn(to)` and still uses `keepWithinPages`. The pure parts, `lastPage(total, pageSize)` and `searchAtPage(search, page)`, live in `~/shared/http/paging`.

## Fetchers

The browser has one request tool for everything that does not navigate (`~/shared/route`). It is the client end of `routeAction` and `routeLazyLoader`, and the only place a fetcher is used (lint: `useFetcher<typeof handler>()` appears only as the argument of `useCommand` or `useLazyLoad`).

- **Submitting.** `const command = useCommand(useFetcher<typeof <thing>Action>(), href('/resources/x'), options?)` inside a feature hook, which adds the typed `run`:
  - `run(payload)` posts JSON and resolves with the outcome, `{ ok: true, result }` or `{ ok: false, failure, retryAfter, status }`. It never rejects, so it is what a `Form`'s `onSubmit` returns.
  - `confirm(payload)` resolves with the result and rejects with a `Refusal`. It is for hina-ui handlers that keep an overlay open while their promise rejects (`AlertDialog` and `Popconfirm` `onConfirm`).
  - `pending`, `settled` (the latest outcome), `failure` (its failure, for `useFormErrors`), `payload` (what is being submitted, for optimistic state).
  - Options: `revalidate: false` for a submission whose result no loader shows (a view counter, issuing a download link); `quiet: true` for one the visitor did not ask for (recording a search term) and for one whose refusal is shown where it happened (posting a comment: `refusedOf(command.settled)` is handed to the composer, which phrases it with `useRefusalText()` under the text; `namesFields` tells a refusal that `useFormErrors` already shows).
- **Sending small files** (an avatar, a cover, a page background; never a resource, which belongs to the upload engine). The same tool, end to end: the hook passes `multipart: true` and runs with a `FormData` that carries the files and the texts that go with them (`form.append('<field>', value)`); the action reads it with `readForm(args, <schema>)` (`~/shared/route/route.server`: the form's entries parsed by a valibot schema from the feature's `*.schema.ts`, with `v.instance(File)` for a file, 400 when it does not match); the use-case hands each file to the API with `api.post('/user/info/avatar', fileBody('avatar', file))` (`~/shared/api/file-body`). The picker is hina-ui `FileUpload variant="button" list={false}`; its `accept` names the formats the cropper is given, what the API allows in size is not restated, and its refusal reaches the visitor as the tool's toast. `onReject` says so when the browser itself refused the file.
- **Loading lazily.** `const lists = useLazyLoad(useFetcher<typeof <thing>Loader>())`: `load(path)`, `loading`, `result`, `failed`. The loader answers with `routeLazyLoader`. A component shows its spinner while `loading`, not while `result` is undefined, because a failed load has no result either.
- **Who reports a failure.** The tool does, once and the same way everywhere: a danger toast with the API's message, already localized, with the wait added when the API sent `Retry-After`. A refusal that names fields is not toasted; `useFormErrors(command.failure)` puts those under the fields. Call sites only say what happens on success. No `Alert` shows a request failure, and no hook takes an `onFailure`.
- **A failure keeps what identifies it.** An outcome carries the HTTP `status` beside the API's `failure`. When the server failed (`status >= 500`) the toast adds the request ID with a copy action and stays ten seconds, because that ID is what finds the request in the API log. When there was no answer the toast names the error (`TypeError: Failed to fetch`), and the middleware writes the error it absorbed to the console with its stack. `ErrorPage` shows the status, the API's error code and the request ID with a copy button, and the stack of a thrown error (`ErrorDetails`); the root boundary shows the same without labels. Never replace an error by a sentence and drop the rest.
- **A request that gets no answer** (the network is down, the web server is restarting, a handler threw, the API is down and answers 5xx) never replaces the page. The root route's `clientMiddleware`, `answerEveryRequest`, sees the result of every loader and action call before the router does:
  - a submission, or a lazy load from a `resources.*` route, is answered with a refusal made from the error (`refusalOf`): the API's own failure when it answered 5xx, otherwise one the tool shows as 「请求未成功，请稍后再试。」 with the error named under it;
  - a reload of what is on screen (the reload after an action, `revalidate()`, the periodic refresh of the uploads page) keeps the data that is shown: a page keeps its data for the address it is shown at, a layout wherever the visitor stays inside it. `KeptData` (mounted in `lang.tsx`) mirrors the shown loader data for this and shows the same toast. `useLazyLoad` keeps what it loaded as well;
  - a page the visitor navigates to and that cannot be loaded is an error, rendered by the `ErrorBoundary` of the `routes/pages.tsx` layout inside the site, with a retry.
  - A real answer below 500 (401, 403, 404, 422) is never replaced.
  Without this React Router gives the error to the nearest `ErrorBoundary`. That used to be `lang.tsx`, above the site layout, so a failed periodic refresh replaced the whole page and stopped running uploads.
- The action parses the body with `readCommand(args, <thing>Command)` (valibot command schema from `<name>.schema.ts`), which answers 400 for malformed input; see `forms.md`.
- After an action, React Router revalidates the page loaders and loaded fetchers; do not refetch by hand.
- Not covered by this tool: the upload engine, which talks to the API itself and shows what happened to each file in the uploads list.

- The component that runs a command must outlive it. `run` and `confirm` settle when React shows the fetcher's answer; when the reload that follows removes the component first (deleting a comment from a menu inside that comment), the answer is never shown there, the promise never settles and what was to follow (the toast) is lost, depending on timing. A command that removes its own subject belongs to the list or page that stays mounted, which also holds its confirmation dialog; the item only asks for it (`onRemove(comment)`).

## Browser calls

### Third-party services

The visitor's browser also talks to services that are not ours. Each has one client in `app/shared/vendor/` and nothing else calls them:

- `cap.ts` solves the challenge of the site's own [Cap](https://github.com/tiagozip/cap) instance: `solveCap(endpoint, { onProgress, signal })` with `capEndpoint` from `usePublicConfig()` (`CAP_ENDPOINT`: `/cap/<site key>/`, which the ingress, and Vite in development, route to Cap with the prefix stripped; an absolute `https://<cap>/<site key>/` works as well). It loads `cap-widget` in the browser only, runs it in its programmatic mode (no widget on the page; the caller shows progress with hina-ui), and answers `{ ok: true, token }`, a refusal with Cap's own `code` and `message` grouped as `unavailable`, `blocked` (the browser was turned away, in the page or by Cap when the solution came in: production keys refuse automated browsers, and trying again does not help) or `failed`, or `stopped` when the signal aborted it. The two WASM solvers and the inflate fallback are served by the site (`?url` imports of `@cap.js/wasm` and `pako`), never from a CDN, which is blocked for part of the audience. A token is good once: solve again for every protected call and send the token through an action, never to the API from the browser.
- `managers.ts` knows the three game managers a download can be handed to (LunaBox, ReinaManager, PotatoVN): their names, sites and logos, which of them need the game's Bangumi id, `managerUrl(manager, install)` for the `lunabox://`, `reinamanager://` and `potato-vn://` install requests (the parameters are those programs' contract; change them only with their documentation), and `openManager(url)`. The browser cannot tell whether a program took the request.
- `aria2.ts` pushes a URL to the visitor's own aria2 over JSON-RPC (`aria2.addUri`) and returns `{ ok: true, gid }` or `{ ok: false, reason: 'unreachable' | 'unauthorized' | 'rejected' }`; replies are parsed by `aria2.schema.ts`.

### Our API from the browser

The browser talks to the web server only. The exceptions cannot go through loaders and actions: uploads, which run for hours across pages, and the `GET /message/stream` SSE stream. They use the same-origin `/api` prefix (proxied to the API by the ingress, and by Vite in development).

- **Event streams.** `followEvents(path, handlers, { probe })` (`~/shared/api/event-stream`) is the only place an `EventSource` is made. It first asks `probe` (a cheap authenticated `GET`) through the session-refreshing transport, so an expired session is renewed before the stream opens and a guest gets no stream; it hands each named event's data to its handler as a string, which the feature parses with a schema typed against the generated event DTO (`unreadFrom`); it reopens the stream after a pause when the server closes it; it returns the function that stops it. `features/message` is its one user (`useUnreadMessages`).

- **Transport.** `~/shared/api/xhr.ts` is the only place that uses `XMLHttpRequest`; it gives upload progress, which `fetch` cannot. `browser-client.ts` builds a typed `ApiClient` over it (`createBrowserApi(origin)`), and `chunk.ts` puts one upload chunk with progress (`uploadChunk`), its path, header and result typed from the generated contract.
- **Session.** Both refresh an expired session once (`POST /auth/token/refresh`, shared by concurrent requests) and repeat the request, on 401 `AUTH_UNAUTHORIZED`/`AUTH_INVALID_TOKEN` or the `shionlib-auth-stale` header, the same rule as `session.server.ts` (`~/shared/api/session.ts`).
- **Who may use it.** Only `features/upload` imports `browser-client`, `chunk` or `xhr` (lint).

### The upload manager (`features/upload`)

- One `UploadManager` per tab and signed-in viewer, created by `UploadProvider` in the `site` layout and started in an effect; uploads continue across navigations.
- Functional core, imperative shell: `upload-state.ts` (`reduce(state, event)`), `upload-restore.ts`, `upload-sync.ts` and the rules in `upload.ts` are pure and tested exhaustively; `UploadManager` (queue, persistence, submissions, the periodic sync), `UploadRuns` (the files in hand and the transfers in flight), `UploadRunner` (one file's chunks, retries, stall detection) and `FileHasher` (a Web Worker computing chunk SHA-256 and the file's BLAKE3 with `hash-wasm`) own the requests, workers and timers. React reads snapshots through `useUploads()` (`useSyncExternalStore`).
- The server holds progress. `localStorage` (`shionlib_uploads_<viewer>`, parsed by `upload.schema.ts`) keeps only what it cannot know: what each file is for (a new resource with its fields, an added file, a replaced file), each file's name, size and modification time, and its session. After a reload, uploads still in progress wait for their file to be chosen again; they are matched by name, size and modification time, rehashed locally, and only the missing chunks are sent.
- A resource is created, or files are added or replaced, once all its uploads are finished.
- One writer per session. Web Locks keep one tab per session within a browser (`waiting` with reason `otherTab`). Across browsers and devices the server does it: every upload call carries `X-Upload-Client`, an id this browser keeps in `localStorage` (`shionlib_upload_client`), and the API refuses to write, complete or abort a session another client holds (`GAME_UPLOAD_SESSION_HELD_ELSEWHERE`, which makes a transfer give way at once instead of retrying).
- The manager syncs with the server when it starts and then four times per hold lifetime while its queue is not empty (`syncSessions`: `POST /uploads/large/hold` for what `heldSessions` names, then `GET /uploads/large/ongoing`). It holds every session of a submission still to be submitted, and an orphan only once its file was chosen here. `syncState` turns the answer into state: a session another client holds becomes phase `heldElsewhere` and comes back as `needsFile` when that client lets go (the manager queues it again if the file is still in hand); sessions nobody queued here are grouped into two submissions that are never saved or submitted, `orphan` (nobody holds them: choose the file again or cancel) and `heldElsewhere` (shown with their progress, no controls). `lockedElsewhere` is the one rule for hiding controls.

## Caching and revalidation

- `lang.tsx` revalidates only when the locale changes, so messages are sent once per locale.
- Layout loaders that depend on the viewer (`site.tsx`) revalidate after actions (the default).
- Use `shouldRevalidate` for expensive loaders whose data a mutation cannot change.
- Every route is known from the first document: `react-router.config.ts` sets `routeDiscovery: { mode: 'initial' }`, and it stays that way. With lazy discovery a navigation first asks `/__manifest` for its path, and React Router 8.4.0 has a race in that wait: when the reload that follows a command finishes during it, the router completes the navigation with that reload's data, so the address is the new page and the content is the old one (creating a favorites list and opening it showed the default list). A command's outcome arrives before its reload ends, so navigating on an outcome is normal and must stay safe.
