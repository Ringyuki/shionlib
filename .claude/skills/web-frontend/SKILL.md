---
name: web-frontend
description: Mandatory engineering rules for the Shionlib web client in apps/web (React Router framework mode, @hina-ui/react). Load before creating, changing, reviewing or porting any code in apps/web, including routes, features, API calls, forms, hooks, messages and tests.
---

# Shionlib web client

Priorities when rules compete: correctness > architecture integrity > consistency > readability > maintainability > testability > performance > brevity.

`apps/web` is a server-rendered React Router (framework mode) app built on `@hina-ui/react` and Tailwind CSS v4. The Go API is its only backend. It is a rewrite, not a port: the legacy `apps/frontend` is never a template for code, UI or texts; it only serves as a checklist of features and as the list of public URLs that must keep working.

Product rules from the rewrite brief:

- Every page exists for the core jobs: browsing games, downloading and uploading resources. Pages and widgets that serve none of them are not built.
- The UI is built only from `@hina-ui/react` components with **zero native tags**: no `div`, `span`, `p`, `a`, `button`, `header`, `main`, `svg` in JSX. Semantic elements come from `as` on hina-ui layout components (`<Stack as="aside">`), links from router components. Only `root.tsx` writes the document shell (`html`, `head`, `body`, `meta`, `link`, `script`).
- The look is hina-ui's, customised only the way hina-ui documents it (design/colors, "自定义主题"): `app/shared/ui/theme.css` overrides the six accent roles (`--hn-accent`, `-on`, `-text`, `-soft`, `-border`, `--hn-focus-ring`) for light and dark with the Shionlib blue, checked for contrast. Every other token (palette, neutrals, status colours, radii, fonts, density) stays hina-ui's. Do not invent colours, gradients, glows or effects.
- The site layout is hina-ui `AppShell` (sidebar, header, main, mobile drawer) with Shionlib's own sidebar in `features/shell`, built to the same standard as hina-ui's `Sidebar` (rail collapse that keeps icons in place, fading labels, tooltips in rail, drawer close button, accessible names).
- i18n stays (`zh`, `en`, `ja`) with Chinese as the primary language and Asia as the main audience.

## The five rules

1. **One request tool, inferred types, zero copies.** Every API call goes through `~/shared/api` (`ApiClient`), whose argument and result types are inferred from `app/shared/api/generated/openapi.ts`, generated from `apps/api/openapi/openapi.json`. No file in apps/web may declare an API path, request, response, field or business code by hand, in any form. Name an API type only through `Schema<'X'>`, `ApiData<Path, Method>`, `ApiBody<...>`, `ApiQuery<...>`, `ApiFailure`, or derive from them (`Pick`, indexed access). Business codes come from the generated `BusinessCode`.
2. **Thin routes and components.** A route module (`app/routes/*`) wires URL → feature: it parses params, calls one or a few feature use-cases inside `routeLoader`/`routeAction`, returns their result, and renders feature components. No state, effects, API calls or business rules in routes. Components render props and call hooks; they do not compute business rules.
3. **Feature vertical slices.** Each feature in `app/features/<name>/` owns its model, use-cases, server handlers, hooks, components and messages. Other code imports a feature only through `~/features/<name>` (client-safe) or `~/features/<name>/<name>.server` (server-only, routes only).
4. **Pure TypeScript model and use-cases.** `<name>.ts` (model: derived types and rules) and `<name>.use-cases.ts` (orchestration over an injected `ApiClient`) import neither React, React Router, use-intl, hina-ui nor route/UI helpers.
5. **Each integration point has one home.**
   - **loader / action** — server-side route integration. A loader or action calls a use-case with the per-request `ApiClient`, inside `routeLoader` / `routeAction`.
   - **React hooks** (`use-*.ts`) — client-side React integration: fetchers, optimistic state, derived UI state.
   - **fetcher** — every non-navigation mutation or data interaction. Shared mutations live in resource routes (`app/routes/resources.*`).

## Layout

```text
app/
  root.tsx, routes.ts          composition: document shell, root middleware, explicit route table
  messages/                    composition: per-locale message objects assembled from features
  routes/                      thin route modules; resources.*.ts are fetcher endpoints
  features/<name>/
    <name>.ts                  model: Schema-derived types, pure rules
    <name>.use-cases.ts        use-cases: (api: ApiClient, input) => Promise<result>
    <name>.server.ts           loaders/actions reused by several routes (resource routes)
    use-<purpose>.ts           hooks: fetchers, optimistic state, client integration
    ui/<component>.tsx         components (hina-ui based)
    messages/{zh,en,ja}.json   the feature's messages (namespace <name>)
    index.ts                   public, client-safe entry
  shared/                      platform: never imports features, routes or messages
    api/                       request tool, generated types, session forwarding, test fakes
    route/                     routeLoader, routeAction, apiMiddleware, params
    i18n/  ui/  config/
```

Files are kebab-case. `X.test.ts` tests `X.ts` next to it. Server-only modules end in `.server.ts`.

## MUST

- MUST run `pnpm api:generate` after the API contract changes and commit `app/shared/api/generated/*` (never edit them).
- MUST call the API only through `ApiClient` (`api.get/post/put/patch/delete(path, init)`); the result is the envelope's `data`, failures throw `ApiError` (`status`, `code`, `is('BUSINESS_CODE')`, `failure`).
- MUST load page data in route `loader`s via `routeLoader(args, api => useCase(api, ...))`; API failures become route error responses with the API's status.
- MUST perform mutations in `action`s via `routeAction(args, api => ...)`, which returns `{ ok: true, result }` or `{ ok: false, failure }` with the API status.
- MUST use `useFetcher` (inside a feature hook) for mutations and loads that must not navigate; submit JSON (`encType: 'application/json'`) to a resource route or the page action, and parse the input in the action before calling the use-case.
- MUST type fetchers with `useFetcher<typeof handler>()` and links with `href(...)` so paths and data are checked.
- MUST keep viewer-specific catches (e.g. guests get `false`) in use-cases by status or `ApiError.is(...)`, never by message text.
- MUST put user-facing text in the feature's `messages/{zh,en,ja}.json`; `zh` is the source, `en`/`ja` must have the same keys (the `Messages` type enforces it). API error messages are already localized; show `failure.message`.
- MUST build UI from `@hina-ui/react` components and tokens; use Tailwind utilities only for layout glue.
- MUST show the brand with `BrandLogo` (`public/brand/logo.png`, the favicon artwork) and `Wordmark` (`public/brand/wordmark.svg`, "Shionlib" in Cinzel 700 as paths), never with live text.
- MUST resolve stored image keys with `useImageUrl()` (base from `IMAGE_BASE_URL`, provided by the root loader).
- MUST keep the code comment-free (lint enforces; inline lint directives are disabled).
- MUST run `.claude/skills/web-frontend/scripts/verify.sh` before declaring work done.

## MUST NOT

- MUST NOT write native JSX tags outside the document shell in `root.tsx` (lint).
- MUST NOT override hina-ui tokens beyond the documented accent roles, or add colours, gradients or shadows of your own; ask before introducing any new token.
- MUST NOT declare object types with snake_case keys or types named `*DTO`/`*Response`/`*Request`/`*Payload`/`*Body` (lint).
- MUST NOT use `fetch`, `openapi-fetch`, axios, SWR or React Query outside `~/shared/api` (lint).
- MUST NOT use `as` type assertions outside `~/shared/api` (`as const` is fine) (lint).
- MUST NOT import React state/effects or `ApiClient` into route modules, or call `api.*` there (lint).
- MUST NOT import another feature's internals, or `*.server` modules from client code (lint).
- MUST NOT call the API from the browser, except through dedicated browser endpoints that cannot go through the web server (large uploads, the message SSE stream).
- MUST NOT store server data in global client state; the router's loader data and fetchers are the cache.

## Where things go

| Question                                     | Answer                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| New page?                                    | `recipes/add-route.md`: route entry in `app/routes.ts`, thin module in `app/routes/`, use-cases and UI in a feature |
| New feature?                                 | `recipes/add-feature.md`; copy `app/features/favorite` (golden path)                                                |
| Calling the API?                             | a use-case in `<feature>.use-cases.ts` taking `api: ApiClient`                                                      |
| Typing API data in a component?              | `Schema<'GameHeaderDTO'>`, `ApiData<'/game/{id}', 'get'>`, or `Pick` from them                                      |
| Button that changes data without navigating? | resource route + `<feature>.server.ts` action + `use-<purpose>.ts` fetcher hook (`recipes/add-mutation.md`)         |
| Optimistic UI?                               | derive it from `fetcher.json` / `fetcher.formData` in the hook                                                      |
| Form validation errors?                      | `routeAction` returns `failure.data.errors` (field → messages); render them next to the field                       |
| 404 for a bad id?                            | `idParam(params.id)`; missing records come back from the API as 404 through `routeLoader`                           |
| Who is signed in?                            | `loadViewer` in the `site` layout loader; pages read it from `matches`                                              |
| Navigation entry or shell change?            | `features/shell` (`shell.ts` model, `ui/site-sidebar.tsx`, `ui/site-header.tsx`)                                    |
| An image from the API?                       | `const image = useImageUrl()` then `image(cover.url)`                                                               |
| Auth cookies and refresh?                    | handled by `apiMiddleware` + `createApiSession`; never touch tokens in features                                     |
| Messages?                                    | `features/<name>/messages/*.json`, registered in `app/messages/{zh,en,ja}.ts`                                       |
| Tests?                                       | `references/testing.md`: model and use-cases with `fakeApi()`, server helpers with stubs                            |

## References

- references/architecture.md — layers, dependency rules, naming, the lint rules that enforce them
- references/data.md — request tool, generated contract, loaders, actions, fetchers, errors, sessions
- references/ui.md — hina-ui, accent customisation, shell and sidebar, brand, images, messages and locales, SEO metadata
- references/testing.md — test levels and fakes
- recipes/add-feature.md, add-route.md, add-mutation.md

## Verification

```bash
.claude/skills/web-frontend/scripts/verify.sh   # generated types fresh, typecheck, lint, format, tests, build
```

CI runs it whenever `apps/web`, the OpenAPI document or the lockfile changes.
