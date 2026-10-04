# Architecture

## Layers

```text
root.tsx, routes.ts, messages/   composition (may import everything)
routes/                          thin route modules        ──► features (public entries), shared
features/<name>/                 vertical slices           ──► other features (public entries), shared
shared/                          platform                  ──► nothing in app/ above it
```

Inside a feature:

```text
ui/*.tsx ──► use-*.ts ──► <name>.ts (model)
   │             │
   │             └─(type only)─► <name>.server.ts ──► <name>.use-cases.ts ──► <name>.ts
   └──────────────────────────────────────────────────────────────────────► <name>.ts
```

- **Model** (`<name>.ts`, `<name>-<concept>.ts`): types derived from the generated contract plus pure functions (titles, permissions, parsing of UI commands). No IO, no React.
- **Use-cases** (`<name>.use-cases.ts`): `async (api: ApiClient, input) => result`. They decide which endpoints to call, combine results, and translate expected failures (`ApiError.is(...)`, status) into results. No React, no router.
- **Server handlers** (`<name>.server.ts`): loader/action functions for resource routes shared across pages. They parse request input, call use-cases inside `routeLoader`/`routeAction`, and are re-exported by `app/routes/resources.*.ts`.
- **Hooks** (`use-<purpose>.ts`): the only place a feature touches React state or React Router client APIs (`useFetcher`, `href`). They expose plain values and callbacks to components.
- **Components** (`ui/*.tsx`): hina-ui composition; read data from props, behaviour from hooks, text from `useTranslations('<name>')`.
- **Public entry** (`index.ts`): exports what routes and other features may use. Never re-export `*.server.ts`.

## Routes

`app/routes.ts` lists every route explicitly (no file-system routing):

```text
/                       locale-redirect.ts   negotiates zh/en/ja (cookie, Accept-Language) and redirects
/resources/*            resources.*.ts       fetcher endpoints (loader/action only)
/:lang                  lang.tsx             validates the locale, loads messages, provides IntlProvider; revalidates only when the locale changes
  (layout)              site.tsx             site chrome and the viewer
    ...pages
```

URLs keep the legacy `/<locale>/...` shape so existing links and search results stay valid.

A route module may export `loader`, `action`, `meta`, `headers`, `shouldRevalidate`, `ErrorBoundary` and a default component. Its loader/action body is one `routeLoader`/`routeAction` call; its component composes feature components.

## Dependency rules (enforced by ESLint)

| Rule                                                                                                          | Scope                                                      |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `~/features/<name>/<file>` is forbidden; use `~/features/<name>` (or `<name>.server` from routes)             | everywhere except `app/messages`                           |
| `*.server` modules only in routes, root, other `*.server.ts` files and tests (type imports are fine)          | features, shared                                           |
| `shared` never imports `features`, `routes` or `messages`                                                     | `app/shared`                                               |
| features never import `routes` or `messages`                                                                  | `app/features`                                             |
| model and use-case files never import React, React Router, use-intl, hina-ui, `~/shared/route`, `~/shared/ui` | `app/features/*/*.ts` except hooks, server files and index |
| routes never import React (types excepted), `ApiClient` or the session, and never call `api.*`                | `app/routes`                                               |
| no `fetch`, `openapi-fetch`, axios, ky, SWR, React Query                                                      | everything except `app/shared/api`                         |
| no `as` assertions (`as const` allowed)                                                                       | everything except `app/shared/api`                         |
| no type members with snake_case keys, no types named `*DTO`/`*Response`/`*Request`/`*Payload`/`*Body`         | everything except `app/shared/api` and tests               |
| no comments, no inline lint directives                                                                        | everything                                                 |

## Naming

| Thing                         | Name                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| use-case                      | verb phrase: `loadGameHeader`, `changeMembership`, `isFavorite` |
| server handler                | `<thing>Loader`, `<thing>Action`                                |
| hook                          | `use<Purpose>`: `useFavoriteLists`, `useMembershipToggle`       |
| component                     | noun: `GameHeader`, `FavoriteButton`                            |
| UI command (not an API shape) | camelCase type in the model: `MembershipChange`                 |
| message namespace             | the feature name                                                |
