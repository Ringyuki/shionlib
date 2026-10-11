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
    <name>.ts                  model: Schema-derived types, constants, pure rules (no validation)
    <name>.schema.ts           valibot: command schemas, form schemas, input guards (references/forms.md)
    <name>.use-cases.ts        use-cases: (api: ApiClient, input) => Promise<result>
    <name>.server.ts           loaders/actions reused by several routes (resource routes)
    use-<purpose>.ts           hooks: fetchers, optimistic state, client integration
    <name>-<role>.ts           long-lived client work in plain TypeScript (features/upload): pure state and rules
                               (<name>-state.ts, <name>-restore.ts), classes that own requests, workers and timers
                               (<name>-manager.ts, <name>-runner.ts); React binds through a use-*.ts hook
    <purpose>.worker.ts        Web Worker entry: a thin message adapter over a function in a plain module
    ui/<component>.tsx         components (hina-ui based)
    messages/{zh,en,ja}.json   the feature's messages (namespace <name>)
    index.ts                   public, client-safe entry
  shared/                      platform: never imports features, routes or messages
    api/                       request tool, generated types, session forwarding, the browser transport
                               (xhr.ts, browser-client.ts, chunk.ts), test fakes
    route/                     routeLoader, routeAction, routeLazyLoader, readCommand, apiMiddleware, idParam;
                               the browser's request tool: useCommand, useLazyLoad, client-middleware;
                               navigation inside a page: useInPageNavigate, InPageLink
    form/                      form kit from generated API constraints, useFormErrors, check helpers
    http/                      pure HTTP helpers (readCookie)
    config/                    server env (env.server.ts) and the public config sent to the browser
    catalog/                   links back to the catalog source (Hikarinagi entry and editor URLs)
    storage/                   readLocal/writeLocal over localStorage
    vendor/                    browser clients of services that are not our API (Cap, aria2, game managers); the only fetch outside api/
    richtext/                  rich text documents (what comments and the note of a walkthrough store): model, guards, text; no editor
    editor/                    the rich text editor on Tiptap: plugins, profiles, a session per editor, parts built from hina-ui (ui/);
                               its engine (engine/) is loaded on demand
    i18n/  ui/                 <topic>.schema.ts beside a module holds its input guards
```

Files are kebab-case. `X.test.ts` tests `X.ts` next to it. Server-only modules end in `.server.ts`.

## MUST

- MUST run `pnpm api:generate` after the API contract changes and commit `app/shared/api/generated/*` (never edit them).
- MUST call the API only through `ApiClient` (`api.get/post/put/patch/delete(path, init)`); the result is the envelope's `data`, failures throw `ApiError` (`status`, `code`, `is('BUSINESS_CODE')`, `failure`).
- MUST load page data in route `loader`s via `routeLoader(args, api => useCase(api, ...))`; API failures become route error responses with the API's status.
- MUST perform mutations in `action`s via `routeAction(args, api => ...)`, which returns `{ ok: true, result }` or `{ ok: false, failure }` with the API status.
- MUST send every mutation and lazy load that does not navigate through the browser's request tool, inside a feature hook: `useCommand(useFetcher<typeof <thing>Action>(), href('/resources/x'))` to submit, `useLazyLoad(useFetcher<typeof <thing>Loader>())` to load (`~/shared/route`, `references/data.md`). The tool reports a refused or unanswered request with a danger toast by itself, so no hook, form or component decides how a failed request is shown; a refusal that names fields goes under those fields instead (`useFormErrors`). The one other place is the thing that was being written when its design shows the refusal there (the comment composer, a picture's upload placeholder): the command is `quiet` and the text comes from `useRefusalText()` (`~/shared/route/refusal`), the same wording the toast uses. A fetcher is never used any other way (lint). The action parses its body with `readCommand(args, <thing>Command)` before calling the use-case.
- MUST read the address of a loader or action from `args.url`, never from `request.url`: the request is the raw one, and when the browser asks for data its address ends in `.data` and carries `_routes`, so a redirect built from it leads nowhere (lint).
- MUST answer a lazy load with `routeLazyLoader` (an outcome, like `routeAction`), never with `routeLoader`, whose error response would replace the page.
- MUST leave a request that gets no answer (the network is down, the web server is restarting, a handler threw) to the root route's `clientMiddleware`, `answerEveryRequest` (`~/shared/route/client-middleware`): a submission or lazy load becomes a refusal, and a reload of what is on screen keeps the data that is shown and says so in a toast. Nothing is handled per route, and no route exports a `clientLoader` or `clientAction`. Pages sit under the `routes/pages.tsx` layout, whose `ErrorBoundary` shows a page that could not be loaded inside the site, so the shell and running uploads stay (`references/data.md`).
- MUST validate with valibot only, following `references/forms.md`: command schemas, form schemas and input guards live in `<module>.schema.ts`; form fields that the API constrains come from `useFormKit()` (`kit.text('<RequestBody>', '<field>')`, generated from OpenAPI) and limits in texts from `lengthOf(...)`; only UI-only rules are written by hand, with the feature's `issue` messages; API-only rules (password policy, code correctness) are left to the API, whose field errors `useFormErrors` puts under the fields.
- MUST type fetchers with `useFetcher<typeof handler>()` and links with `href(...)` so paths and data are checked.
- MUST keep viewer-specific catches (e.g. guests get `false`) in use-cases by status or `ApiError.is(...)`, never by message text.
- MUST put user-facing text in the feature's `messages/{zh,en,ja}.json`; `zh` is the source, `en`/`ja` must have the same keys (the `Messages` type enforces it). API error messages are already localized and the request tool shows them; a call site never does.
- MUST write texts in the formal written register of each language; for `zh` that is standard written Chinese: no colloquial phrasing (「暂无评论」, not 「还没有评论」; 「确定要删除这条评论吗？」, not 「删除这条评论？」), no clipped telegraphic phrases, no coined terms. A text of one sentence takes no full stop: buttons, labels, placeholders, hints, empty states, the one-sentence description of a dialog, toasts and errors. Only a text of several sentences is punctuated as a paragraph. No text explains what a section is for or invites the visitor to use it.
- MUST build UI from `@hina-ui/react` components and tokens; use Tailwind utilities only for layout glue.
- MUST show the brand with `BrandLogo` and `Wordmark` from `~/shared/ui/brand` (`public/brand/logo.png`, the favicon artwork; the wordmark is `app/shared/ui/wordmark.svg` "Shionlib" or `wordmark-zh.svg` 「书音的图书馆」 by locale, imported as an inline SVG component with `currentColor`, `tone="brand"` for the Shionlib blue or `tone="inherit"` to follow the text), never with live text.
- MUST pass stored image keys straight to hina-ui `Image` (`<Image src={cover.url}>`): `root.tsx` mounts `ImageResolverProvider` with `imageResolver(IMAGE_BASE_URL)`. Other consumers (an `Avatar` `src`) call hina-ui's `useImageResolver()`. A picture cut to a face comes from the image processor through `useFaceImage()` (`~/shared/ui/use-face-image`); no other file builds a processor address (`references/ui.md`).
- MUST read browser-visible configuration (`IMAGE_BASE_URL`, `IMAGE_BUCKET_URL`, `IMAGE_PROCESSOR_URL`, `CAP_ENDPOINT`, `HIKARINAGI_SITE_URL`) through `usePublicConfig()` (`~/shared/config/public-config`), filled by the root loader from `readServerEnv().publicConfig`; never read `process.env` or `import.meta.env` in features.
- MUST keep the code comment-free (lint enforces; inline lint directives are disabled).
- MUST keep files short: at most 150 non-blank lines for `.tsx`, 200 for other `.ts`, 300 for tests (lint enforces). When a file grows past that, split it by responsibility (a section, a field group, a hook that builds data), never by cutting it into arbitrary parts; stylesheets follow the same idea, one concern per file (`theme.css` accent roles, `platform.css` platform colours).
- MUST add Playwright specs in `apps/web/e2e` for every user flow a phase ports, and run them with `pnpm test:e2e:web` before finishing the phase (`references/testing.md`).
- MUST check the work before declaring it done, at the weight of the change: `scripts/check.sh` (typecheck, lint, format and the tests of what changed, about ten seconds) for a small change such as copy, spacing or a few lines of logic; `scripts/verify.sh` (adds generated types and the build) when a phase ends or the API contract changed. The Playwright suite runs when a user flow changed, starting with the specs it touches, never for copy or layout tweaks.

## MUST NOT

- MUST NOT write native JSX tags outside the document shell in `root.tsx` (lint). The one other place is `RichText` (`~/shared/ui/rich-text*.tsx`), which writes the tags of a rich text document inside hina-ui `Prose`, the component that styles tags.
- MUST NOT fall back on the browser's own UI: no `title` tooltips (wrap the trigger in hina-ui `Tooltip`, or show the text in full; `title` is allowed only as the prop of `Dialog`, `Section`, `Empty`, `Result` and the other titled hina-ui components), no `alert`/`confirm`/`prompt` (`AlertDialog`, `Dialog`, `toast`), no native validation bubbles (hina-ui `Form` sets `noValidate`; errors show under the fields), no native scrollbars (a region that scrolls is a hina-ui `ScrollArea` given a height or a max height, as every hina-ui component does inside; `overflow-auto` and `overflow-scroll`, as classes or styles, are refused) (lint).
- MUST NOT hand-write input validation (`typeof`, `Array.isArray`, `JSON.parse`, `Number(...)`, regexes over input), restate API limits as numbers, import valibot outside `*.schema.ts`/`~/shared/form`/`~/shared/route`, or use another validation library (lint).
- MUST NOT build look-alikes or wrappers of hina-ui components (custom placeholders, skeletons, spinners, alert wrappers, loading states): use the component and its own states (`Image` skeleton and fade, `Spinner`, `Alert open`). Project components exist only for Shionlib behaviour hina-ui cannot know (`Button` with `loginRequired`).
- MUST NOT mount or unmount feedback conditionally (`cond && <Alert>`, ternaries): an `Alert` stays rendered and is shown with `open` (`<Alert tone="danger" open={message !== undefined}>`), a `Callout` is static content, and whole-page outcomes use `Result`/`Empty` (lint).
- MUST NOT let state that changes while the page is used decide whether an overlay exists (`picked && <Dialog>`, or a `Dialog` inside a button that is rendered only in some state): a `Dialog` or `AlertDialog` stays mounted and is shown with `open`. What a closing overlay shows must not change: never clear or reset its state when it closes, and do not derive what it shows from the state that closed it. State only the content needs lives in the component that `renderContent` / `renderBody` renders, which hina-ui mounts on opening and unmounts after the exit animation (the search palette's keyword). State the footer needs as well lives in the dialog component and starts fresh each time it opens through `useOpenState(open, initial)` (`~/shared/ui/use-open-state`).
- MUST put a dialog's actions in `renderFooter`, never inside the `Form` in its content: the cancel button calls the footer's `close`, the submit button calls the form handle's `submit()` (`form.current?.submit()`) and takes `loading` from the footer's `submitting`, which also disables the cancel button (`renderFooter={({ close, submitting }) => …}`). A `Dialog`, `Drawer` or `Sheet` locks itself while the `Form` in it is submitting, so the form's `onSubmit` awaits the command and nothing passes `locked` by hand. An `AlertDialog`'s `onConfirm` awaits the command's `confirm(...)`, which rejects when the request is refused, so the dialog stays open.
- MUST NOT leave a `ghost` button on an edge with its padding showing as a misalignment: an action that stands alone is `outline`, a way back is a `Link`, and a `ghost` action that runs on from text or closes a row takes `flushStart` / `flushEnd` (`~/shared/ui/flush`) (`references/ui.md`, lint).
- MUST NOT override hina-ui tokens beyond the documented accent roles, or add colours, gradients or shadows of your own; ask before introducing any new token. The one approved exception is the platform brand colours in `app/shared/ui/platform.css`, used only by `PlatformTag` (`references/ui.md`).
- MUST NOT declare object types with snake_case keys or types named `*DTO`/`*Response`/`*Request`/`*Payload`/`*Body` (lint).
- MUST NOT use `fetch`, `XMLHttpRequest`, `openapi-fetch`, axios, SWR or React Query outside `~/shared/api`; third-party browser services (the site's Cap instance, the visitor's aria2 and game managers) are reached only through `~/shared/vendor` (lint).
- MUST NOT use `as` type assertions outside `~/shared/api` (`as const` is fine) (lint).
- MUST NOT import React state/effects or `ApiClient` into route modules, or call `api.*` there (lint).
- MUST NOT import another feature's internals, or `*.server` modules from client code (lint).
- MUST NOT import `@tiptap/*` outside `~/shared/editor`, load the editor's engine statically (`~/shared/editor/engine/**` is reached only through `import('./engine')`; the rest of the editor imports Tiptap's types), or import `~/shared/editor` from `~/shared/richtext` or `RichText`: a page that only shows documents never downloads the editor (lint).
- MUST NOT call the API from the browser, except from `features/upload` (the upload endpoints and the calls that turn finished uploads into resource files), which goes through `~/shared/api/browser-client` and `~/shared/api/chunk` over the XHR adapter, and the message stream, which goes through `~/shared/api/event-stream` (`references/data.md`, lint).
- MUST NOT store server data in global client state; the router's loader data and fetchers are the cache. The one client-side process is the upload manager (`features/upload`), which holds running uploads, not server data for pages.

## Where things go

| Question                                             | Answer                                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| New page?                                            | `recipes/add-route.md`: route entry in `app/routes.ts`, thin module in `app/routes/`, use-cases and UI in a feature                                |
| New feature?                                         | `recipes/add-feature.md`; copy `app/features/favorite` (golden path)                                                                               |
| Calling the API?                                     | a use-case in `<feature>.use-cases.ts` taking `api: ApiClient`                                                                                     |
| Typing API data in a component?                      | `Schema<'GameHeaderDTO'>`, `ApiData<'/game/{id}', 'get'>`, or `Pick` from them                                                                     |
| Button that changes data without navigating?         | resource route + `<feature>.server.ts` action + `use-<purpose>.ts` fetcher hook (`recipes/add-mutation.md`)                                        |
| Optimistic UI?                                       | derive it from the command's `payload` in the hook                                                                                                 |
| A request failed: who tells the visitor?             | the request tool (`useCommand`, `useLazyLoad`) with a danger toast; never a call site. Field errors go under the fields through `useFormErrors`     |
| A form?                                              | `recipes/add-form.md`: `<name>.schema.ts` form schema from `useFormKit()`, `<Form rules>`, `useFormErrors`                                         |
| Parsing a request body, cookie, param, storage?      | a schema in the nearest `*.schema.ts`; `readCommand`, `idParam`, `readCookie`, `parseOptional` (`references/forms.md`)                             |
| Form validation errors?                              | `routeAction` returns `failure.data.errors` (field → messages); render them next to the field                                                      |
| 404 for a bad id?                                    | `idParam(params.id)` (`optionalIdParam` for an optional segment); missing records come back from the API as 404 through `routeLoader`               |
| A list with pages?                                   | the page is the `page` of the address: `requestedPage(args.url)` and `keepWithinPages(args.url, total, pageSize)` in the loader (`~/shared/route/paging`), `usePageTurn()` (`~/shared/route/use-page-turn`) for `DataList`'s `onPageChange` and `loading`; no feature writes its own last page or page address |
| Games someone is credited in (developer, character)? | `loadWorks(api, { developer } or { character }, page, order)` and `GameGrid` from `~/features/game`                                                 |
| Letting a visitor reorder a list of games?           | `OrderSelect` with `orderFrom`, `orderParams` / `searchInOrder` and `orderQuery` from `~/features/game`; never a second list of orders              |
| A navigation list inside a page?                     | hina `NavLink as={InPageLink} href=… active=…` in a `nav` (`~/shared/route/in-page-link`); a `Select` of the same entries on narrow screens, navigating with `useInPageNavigate()` |
| A navigation that stays in view (tab, filter, order)? | `useInPageNavigate()` or `InPageLink` (`~/shared/route`); never `keepScrollPosition` or `preventScrollReset` at a call site (`references/ui.md`)   |
| A setting of the account or of this browser?         | a `Panel` in a settings section: `features/settings` (profile, downloads, site) or `features/account` (security, connections); preferences through `usePreferences()` / `useLanguage()` from `~/features/viewer` |
| Sending an avatar or another small image?            | `useCommand(…, { multipart: true })` with a `FormData`, `readUpload` in the action, `fileBody` in the use-case (`references/data.md`)                |
| Something the server pushes?                         | `followEvents` from `~/shared/api/event-stream` behind a feature hook, parsing each event with a schema typed against its generated DTO (`references/data.md`)    |
| Who is signed in?                                    | `loadViewer` in the `site` layout loader; pages read it from `matches` (`[root, lang, site, pages, page, …]`)                                      |
| Action that needs a signed-in user?                  | `Button`/`IconButton` from `~/shared/ui/button` with `loginRequired`: guests get the sign-in dialog, the click replays                             |
| The current month or a date filter?                 | `siteMonthStart(now)` and `isoDate` from `~/shared/i18n/site-time`; the loader passes `new Date()`, never read the clock in a model or component |
| Search?                                              | `features/search`: the header's `SearchPalette` (a top `Dialog` with `SearchInput` and a `Listbox` of entries, `/` and ⌘K) and `/:lang/search?q=`; never filter locally                          |
| A list of games by tag, platform, year or order?     | a link into the game library: `libraryPath(locale, { tags, platforms, years, sort })` from `~/features/library` (`tagPath` and `sortedGamesPath` inside `features/game`); never a list of your own       |
| Games without resources in a list?                   | the `resources` rule in the address (`any` / `required`) over the account setting: `requiresResources`, `resourceRuleFor`, `resourceRuleFrom` from `~/features/game` (`references/ui.md`)                |
| Sign in, sign up, sign out?                          | `features/auth`: the dialog (`?auth=sign-in`/`sign-up`/`forgot-password` opens it), `useSignOut`; no auth pages                                    |
| Navigation entry or shell change?                    | `features/shell` (`shell.ts` model, `ui/site-sidebar.tsx`, `ui/site-header.tsx`)                                                                   |
| An image from the API?                               | `<Image src={cover.url}>`; outside `Image`, `useImageResolver()(key, 'image')`                                                                     |
| Human verification (downloads)?                      | `solveCap` from `~/shared/vendor/cap` (the site's own Cap, no widget on the page); the token goes to the API through an action                     |
| Uploading files?                                     | `features/upload`: `useUploadManager()?.add(target, label, picks)` hands files to the site-wide manager; the header's `UploadIndicator` only links to the uploads page; `useUploads()` reads the queue; never call the upload endpoints elsewhere |
| Progress, control or management of uploads?          | `features/uploader`: the uploads page (`/:lang/user/uploads`) is the only place that shows transfers, processing stages and the uploader's own resources (`references/ui.md`); forms and dialogs only submit and point there |
| Downloading a file?                                  | `DownloadButton` from `~/features/download` inside a `DownloadArea`: Cap, then `resources/download/link`, then the browser, aria2, a game manager or copy (`references/ui.md`) |
| A download setting?                                  | `MethodChoice`, `ManagerSwitches`, `Aria2Fields` from `~/features/download`; they apply at once and are shown by the settings section and by the download menu's dialog |
| Resources of a game (list, report, edit, delete)?    | `features/resource`; the list is rendered by the game page's resources tab                                                                         |
| A page with tabs (game page)?                        | parent route loads what the tabs share; each tab is a child route reading `matches`; hina `Tabs` driven by the URL (`references/ui.md`)            |
| Choices of an enum field (platforms, reasons)?       | the model reads `constraints.<Body>.<field>.enum` / `.itemEnum` from `~/shared/api/generated/constraints`; never list them by hand                 |
| Catalog data on a page (game, character, developer)? | `CatalogAttribution` from `~/shared/ui/catalog-attribution` with the entry's `h_id`; it is required by Hikarinagi's terms                          |
| A document a user writes (comments, a walkthrough's note)? | a rich text document, the API's `RichTextDocument`: `useRichEditor({ profile, value, onValueChange, placeholder })` from `~/shared/editor` gives a handle; the caller lays out the parts around it (`EditorSurface`, `EditorToolbar`, and always `EditorOverlays`); `RichText` (`~/shared/ui/rich-text`) shows it (`references/ui.md`) |
| Text or emptiness of a document?                     | `plainText`, `publicText`, `isBlank`, `sameDocument` from `~/shared/richtext/rich-text`; `richDocument` (`rich-text.schema.ts`) in command and form schemas |
| A new node, mark, attribute or tool for the editor?  | the API first (`internal/richtext`, ADR 0013), then `pnpm api:generate`, then a plugin in `~/shared/editor/plugins`, its extension in `engine/extensions.ts`, its place in a profile (`profiles.ts`), its texts (`messages/editor`) and the tag in `RichText`; the compiler and `engine.test.ts` point at each place |
| Choosing the area of a picture before upload?        | `usePictureCrop()` and `ImageCropDialog` (`~/shared/ui`): `pick(file)` opens the dialog, `onCrop(file)` uploads the result (`references/ui.md`) |
| A page that must not be left with unsaved work?      | `useLeaveGuard(dirty)` (`~/shared/route/use-leave-guard`): an `AlertDialog` shown while `leaving`; `release()` lets the one navigation that follows a save through |
| Reordering a list by dragging?                       | `Sortable` around the rows and `useSortableRow(id, role)` in each (`~/shared/ui/sortable`, the one place that imports dnd-kit); the feature gives the texts it speaks |
| A loader that must not run again when only the query changes? | the route exports `keptThroughSearch` as `shouldRevalidate` (`~/shared/route/revalidation`); what the query selects is then read on the client in a hook (`useShownRoute`) |
| Marking the element a `#hash` leads to?              | `useAimed(hash => …)` (`~/shared/route/use-aimed`): the ref, and `focused` for a moment after arriving |
| A command that removes the thing it was started from? | the hook and its dialog live in the list that stays (`RemoveCommentDialog` in `CommentsView`), never in the item that disappears (`references/data.md`)   |
| BBCode text (notes, intros, history reasons)?        | `BBCodeText` (`~/shared/ui/bbcode-text`); `bbcodePlainText` (`~/shared/markup/bbcode`) for meta; never raw. BBCode is for text stored as a string; what the API stores as a document is rich text |
| Writing BBCode (resource notes)?                     | `BBCodeEditor` (`~/shared/ui/bbcode-editor`) inside the `FormField`; never a bare `Textarea`                                                       |
| Picking a few values from a short fixed list?        | `Chip selectable` in a labelled group (`ChoiceChips`, `~/shared/ui/choice-chips`); not `CheckboxGroup`, not a dropdown                              |
| Truncated text that needs its full value?            | `Tooltip disabled={!overflowing}` with `useOverflowing` (`~/shared/ui`); trigger sized `w-fit`                                                     |
| A per-browser setting?                               | a key constant in the model, a guard in `<name>.schema.ts`, `readLocal`/`writeLocal` from `~/shared/storage/local-storage`                         |
| Auth cookies and refresh?                            | handled by `apiMiddleware` + `createApiSession`; never touch tokens in features                                                                    |
| Messages?                                            | `features/<name>/messages/*.json`, registered in `app/messages/{zh,en,ja}.ts`                                                                      |
| Tests?                                               | `references/testing.md`: model and use-cases with `fakeApi()`, server helpers with stubs                                                           |

## References

- references/architecture.md — layers, dependency rules, naming, the lint rules that enforce them
- references/data.md — request tool, generated contract, loaders, actions, fetchers, errors, sessions
- references/ui.md — hina-ui, accent customisation, shell and sidebar, brand, images, messages and locales, SEO metadata
- references/forms.md — valibot schemas, generated API constraints, form kit, command parsing, input guards
- references/testing.md — test levels and fakes
- recipes/add-feature.md, add-route.md, add-mutation.md, add-form.md

## Verification

```bash
.claude/skills/web-frontend/scripts/check.sh    # small change: typecheck, lint, format, tests of what changed since HEAD (SINCE=<ref> to widen)
.claude/skills/web-frontend/scripts/verify.sh   # generated types fresh, typecheck, lint, format, tests, build
```

CI runs it whenever `apps/web`, the OpenAPI document or the lockfile changes.
