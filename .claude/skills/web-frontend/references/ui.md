# UI

## hina-ui

- Import components from `@hina-ui/react`; the style entry is `app/app.css` (`tailwindcss`, then `@hina-ui/react/styles/tokens.css`, then `shared/ui/theme.css`).
- Zero native tags: compose components; pass `as` for semantics (`<Stack as="nav">`, `<Center as="main">`); when a component must render a button around custom layout, use `<Button asChild><Flex as="button">…</Flex></Button>`.
- hina-ui `Text` sets its own colour; inside a coloured parent (an active nav item, a solid button) add `text-inherit`.
- Layout: `Container`, `Stack`, `Inline`, `SimpleGrid`, `Grid`; text: `Heading`, `Text`; actions: `Button` (`variant`, `tone`, `size`, `icon`, `loading`), links styled as buttons with `<Button asChild><Link .../></Button>`.
- Overlays (`Popover`, `Dialog`, `Sheet`) take their trigger as children and the panel as `content`.
- Icons come from `lucide-react` (the version hina-ui uses).
- `TooltipProvider` and `Toaster` are mounted once in `root.tsx`; `UiLocaleProvider` in `lang.tsx`.
- Use tokens (`text-muted`, `border-line`, `bg-subtle`) instead of raw colours; Tailwind utilities only glue layout.

## Accent customisation

`app/shared/ui/theme.css` follows hina-ui's "自定义主题" guide and nothing more: it sets the six accent roles for `:root` and `.dark`.

| Role                 | Light                                                            | Dark                     |
| -------------------- | ---------------------------------------------------------------- | ------------------------ |
| `--hn-accent`        | `#34a2d5` (Shionlib blue)                                        | `#34a2d5`                |
| `--hn-accent-on`     | `#ffffff` (blue with white text is the Shionlib brand; required) | `#ffffff`                |
| `--hn-accent-text`   | `#206a8e` (6.0:1 on surface, 5.3:1 on soft)                      | `#4cb8ea`                |
| `--hn-accent-soft`   | accent 12 % over surface                                         | accent 24 % over surface |
| `--hn-accent-border` | accent 34 %                                                      | accent 30 %              |
| `--hn-focus-ring`    | `#2784b0`                                                        | `#4cb8ea`                |

Change these only together, and recheck contrast in both themes. All other tokens are hina-ui's defaults.

### Platform colours

`app/shared/ui/platform.css` (imported after `theme.css`) holds the one approved addition: each platform's brand colour as `--platform-<key>` and `--platform-<key>-fg`, with dark-mode values where the light ones would vanish (macOS, iOS and PSP invert to light, Linux turns dark grey), exposed to Tailwind as `bg-platform-<key>` / `text-platform-<key>-fg`. Only `PlatformTag` (`~/features/game`) uses them: a solid `Tag` in the brand colour with the platform's icon (`react-icons`). Tags that sit with it (languages, engine, game type) are solid neutral `Tag`s, because hina-ui wants one variant per group of tags and colour only for meaning.

## Shell

- `features/shell/ui/site-shell.tsx` renders hina-ui `AppShell` with controlled sidebar state (`expanded`/`rail`, remembered in the `shionlib_sidebar` cookie) and mobile drawer state.
- The sidebar (`ui/site-sidebar.tsx`) is Shionlib's own: brand row aligned with the 56 px header, the upload action, navigation sections, and the account menu. It uses hina-ui's motion utilities (`hn-sidebar` for the width transition, `hn-sidebar-label` for fading labels), keeps every icon, the logo and the avatar centred at 34 px in both states (the rail is 69 px so its content is an even 68 px inside the 1 px border; items are 44 px wide; bordered buttons take 1 px off their start padding), swaps section titles for dividers and shows tooltips in rail, and renders a `CloseButton` inside the mobile drawer.
- The header (`ui/site-header.tsx`) holds `SidebarTrigger`, the brand on small screens, the search form and the language menu.
- The main area scrolls inside `AppShell`; `useMainScrollRestore` wires hina-ui's scroll restorer to React Router (top on new pages, previous position on back/forward and reload), and `root.tsx` injects `firstPaintRestoreScript()`.

## Feedback

- Follow hina-ui's split: `Callout` is static content written into a page, `Alert` reports what just happened, `Toast` is transient. An `Alert` is always rendered and toggled with `open`, so it expands and fades instead of popping in; action failures render `<Alert tone="danger" open={message !== undefined}>` directly.
- A page whose whole state is an outcome (invalid link, search unavailable, password changed) renders `Result` or `Empty` instead of a form, not an alert.

## Sign-in

- Signing in, signing up and requesting a password reset happen in one dialog (`features/auth`, `AuthDialogProvider` in the `site` layout); the only auth page is the reset link target `/:lang/user/password/forget`. Legacy `/:lang/login` and `/:lang/register` redirect to `?auth=sign-in` / `?auth=sign-up`.
- Anything that needs an account uses `Button` from `~/shared/ui/button` with `loginRequired`, never a disabled button: a guest's click opens the dialog and is replayed on the same element once the viewer is signed in. The gate (`~/shared/ui/auth-gate`) is the only way shared code learns about the viewer.

## Theme

- Dark mode is hina-ui's `dark` class on `<html>`. The preference (`system`, `light`, `dark`) lives in the `shionlib_theme` cookie; the root loader renders `class="dark"` for an explicit dark choice and inlines `systemThemeScript()` for `system`, so the first paint is already right. `ThemeProvider`/`useTheme` (`~/shared/ui/theme-provider`) apply changes and follow the system while it is chosen; the header's `ThemeMenu` changes it.

## Brand and images

- `BrandLogo` shows `public/brand/logo.png` (from `favicon.ico`); `Wordmark` renders `app/shared/ui/wordmark-zh.svg` (「书音的图书馆」) for `zh` and `app/shared/ui/wordmark.svg` ("Shionlib") otherwise as inline SVG (`vite-plugin-svgr`, `?react`) filled with `currentColor`, so it is in the server HTML and never loads separately. `tone="brand"` (default) colours it with `text-accent` (the Shionlib blue in both themes); `tone="inherit"` follows the surrounding text, as in the footer. The Chinese wordmark has finer strokes, so each `size` renders it 20% taller (`md` 24px, `sm` 20px, `xs` 16px against 20px, 16px, 14px for the Latin one). `BrandLogo` still renders through hina-ui `Image` with `eager` and `lazy={false}`.
- API image fields are storage keys. `root.tsx` mounts hina-ui's `ImageResolverProvider` with `imageResolver(base)` (`~/shared/ui/image-resolver`), which prefixes keys with `IMAGE_BASE_URL` and passes absolute, `data:`, `blob:` and site (`/brand/...`) URLs through, for page images and `preview` alike. Give `Image` the key itself; anything that is not an `Image` (an `Avatar` `src`) resolves the key with hina-ui's `useImageResolver()`. Click-to-enlarge is hina-ui's own `Image preview` (with `previewSize` from the API's `dims`), and images browsed together sit in one `ImageGroup`; never wrap an `Image` in a `Button` or wire a `Lightbox` by hand for this. Only images that are fully visible get `preview`: its open and close animation grows from the image's own rectangle, so an image that something overlaps (the banner under the game cover) does not use `Image preview`; it opens a `Lightbox` instead.

## Writing metadata

- Never glue facts into one string with separators (`a · b · c`, `a / b`). Facts that sit side by side are separate elements spaced by `Inline` gaps, with a small icon when the kind is not obvious (`Clock` + 「4 小时前更新」, `Download` + 「1,284 次下载」); a date reads as a phrase (「发售于 2015年12月18日」).
- Lists of names (developers, aliases, staff) go through use-intl's `format.list(...)`, which joins them the way each language does (「A、B 和 C」); `format.list` also accepts links. A list that may be long is truncated to one line with the full list in a tooltip, not cut with 「等 N 个」.
- A single string slot (a `CommandPalette` item `description`) carries one fact, not several joined together.

## Catalog attribution

Game, character and developer data comes from Hikarinagi's open API, whose terms require naming Hikarinagi as the source and linking to the entry. Every page that shows such an entry renders `CatalogAttribution` (`~/shared/ui/catalog-attribution`) with the entity and its `h_id`: the text 「条目数据来自」 followed by Hikarinagi's wordmark (`app/shared/ui/hikarinagi-wordmark.svg`, inline, colours untouched) linking to `HIKARINAGI_SITE_URL/<galgames|producers|characters>/<id>`. Entry and editor URLs come from `~/shared/catalog/hikarinagi`. The Hikarinagi ID button keeps using `public/brand/hikarinagi-icon.webp`.

## Messages and locales

- Locales: `zh` (default), `en`, `ja`; URLs are `/<locale>/...`; `/` redirects by the `shionlib_locale` cookie, then `Accept-Language`, then `zh`.
- Each feature owns `messages/{zh,en,ja}.json`, registered under the feature name in `app/messages/{zh,en,ja}.ts`. `zh` defines the `Messages` type; `en` and `ja` must match it.
- Messages use ICU syntax (`{count, plural, ...}`, `{date, date, long}`) and are read with `useTranslations('<feature>')`; keys are checked at compile time.
- Dates are formatted in `Asia/Shanghai` on both server and client so hydration matches.
- Text from the API (titles, `failure.message`) is already localized or multilingual; pick game titles with `gameTitle(game, locale)`.

## Pages

- Every page route exports `meta` with a title (`<page> | Shionlib`) built from loader data; pages that can 404 return `[]` when `loaderData` is undefined.
- Error pages come from `ErrorBoundary` in `lang.tsx` (`ErrorPage`, localized 401/403/404/5xx) and a minimal root boundary for invalid locales.
- Links between pages are `<Link to={`/${locale}/...`} prefetch="intent">`.
- Entry detail pages (game; later character and developer) let the artwork carry the page. The header starts with a key visual: the first screenshot that is safe to show large (`bannerIndex`), as a wide rounded banner that opens all screenshots in a `Lightbox` (`useGallery`, never `Image preview`, since the cover overlaps it). The cover (with `preview`) overlaps the banner's lower edge (negative top margin, `ring-4 ring-canvas`), and beside it come the byline (developer · release date), the title and original title, aliases, platform and type `Tag`s with the external ratings, and one action row (the only solid button, then soft and outline ones, `CatalogAttribution` at the end). Without a usable screenshot the same grid renders without the banner and the overlap. The tabs follow below; long-form text (the intro) lives in a tab and in the `description` meta.
- The resources tab keeps the PRD prototype's information order and drops what does not earn its space: the platform filter (`SegmentedControl`) appears only for more than three resources and there is no page-level download method switch (each `DownloadButton` menu already offers browser, aria2 and copy; the default lives in settings). Each resource is a `Card` (`padded={false}`, `p-4`, `gap="sm"`): platform `Tag`s (`tone="accent"`) and language and engine `Tag`s (`variant="outline"`), all `h-7 px-2.5`, on the left, uploader, update time and download count (icon + text) on the right with a `⋯` `DropdownMenu` for history, report, edit and delete (below `sm` the facts move to their own row); the note as text; files in a `Table` (`variant="secondary"`, header for screen readers only) with name, size, checksum (hidden below `sm`) and the download button. A file's scan state shows only when it is not clean, as a tag after the name that wraps under it on narrow screens.
- A page split into tabs (the game page: `/:lang/game/:id`, `/info`, `/characters`) is a parent route with one child route per tab. The parent loader loads everything the tabs share, so switching tabs never reloads the header; child routes have no loader of their own when the parent already holds their data and read it from the typed `matches` prop (`const [, , site, game] = matches`). The tab strip is hina-ui `Tabs` with `value` taken from the URL and `onValueChange` navigating with `state: keepScroll` (`~/features/shell`), which tells the main scroll restorer to keep the position; a `hash` on such a navigation scrolls to that element (`#resource-12`).
- Slow, optional data (external ratings) is returned from the loader as an unawaited promise that never rejects for API failures, and rendered with `<Suspense fallback={null}><Await resolve={...} errorElement={null}>`.
