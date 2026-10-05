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

`app/shared/ui/platform.css` (imported after `theme.css`) holds the one approved addition: each platform's brand colour as `--platform-<key>` and `--platform-<key>-fg`, with dark-mode values where the light ones would vanish (macOS, iOS and PSP invert to light, Linux turns dark grey), exposed to Tailwind as `bg-platform-<key>` / `text-platform-<key>-fg`. Only `PlatformTag` (`~/features/game`) uses them: a solid `Tag` in the brand colour with the platform's icon (`react-icons`). Tags that sit with it (languages, engine, game type) are neutral `variant="outline"` `Tag`s: solid neutral turns them into black blocks next to the brand colours, and soft neutral is too faint.

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
- API image fields are storage keys. `root.tsx` mounts hina-ui's `ImageResolverProvider` with `imageResolver(base)` (`~/shared/ui/image-resolver`), which prefixes keys with `IMAGE_BASE_URL` and passes absolute, `data:`, `blob:` and site (`/brand/...`) URLs through, for page images and `preview` alike. Give `Image` the key itself; anything that is not an `Image` (an `Avatar` `src`) resolves the key with hina-ui's `useImageResolver()`. Click-to-enlarge is hina-ui's own `Image preview` (with `previewSize` from the API's `dims`), and images browsed together sit in one `ImageGroup`; never wrap an `Image` in a `Button` or wire a `Lightbox` by hand for this. Only images that are fully visible get `preview`: its open and close animation grows from the image's own rectangle, so an image that something overlaps (the banner under the game cover) does not use `Image preview`; it opens a `Lightbox` instead. Content images keep `Image`'s default `lazy`, so they load under the skeleton and fade in; those at the top of a page (banner, cover) add `eager` for a high-priority request. `lazy={false}` drops the skeleton fade and the image's own fade-in, so it is only for small site assets that must be in the server HTML (`BrandLogo`, sign-in provider icons).

## Writing metadata

- Never glue facts into one string with separators (`a · b · c`, `a / b`). Facts that sit side by side are separate elements spaced by `Inline` gaps, with a small icon when the kind is not obvious (`Clock` + 「4 小时前更新」, `Download` + 「1,284 次下载」); a date reads as a phrase (「发售于 2015年12月18日」).
- Lists of names (developers, aliases, staff) go through use-intl's `format.list(...)`, which joins them the way each language does (「A、B 和 C」); `format.list` also accepts links. A list that may be long is truncated to one line with the full list in a tooltip, not cut with 「等 N 个」.
- A single string slot (a `CommandPalette` item `description`) carries one fact, not several joined together.

## Catalog attribution

Resource notes, file history reasons and catalog intros (VNDB descriptions) are BBCode. `parseBBCode` (`~/shared/markup/bbcode`) turns them into nodes: `b`, `i`, `u`, `s`, `quote`, `spoiler` and `mask`, and `url` with or without a value; `size` and `color` keep only their text, and unknown or unbalanced tags stay as text. A link must be an `http(s)` address or a VNDB entry path (`/c123`, resolved by `vndbUrl` from `~/shared/catalog/vndb`); anything else keeps its label as plain text. `BBCodeText` renders the nodes with hina-ui only (`Text as="strong"/"em"/"u"/"s"` carrying the surrounding tone and weight, `Link underline` opening in a new tab with `rel="noopener noreferrer nofollow ugc"`, `Blockquote`, `Spoiler`), keeps line breaks (`whitespace-pre-line`), and takes `size`, `tone` and `className` so it can stand in for the `Text` it replaces; a clamped summary adds `whitespace-normal`. Meta descriptions use `bbcodePlainText`, which drops spoiler content.

BBCode is written in `BBCodeEditor` (`~/shared/ui/bbcode-editor`), placed inside the field's `FormField` like any input: a bare `Toolbar` (`size="sm"`) with icon `ToolbarButton`s for bold, italic, strikethrough, link, quote and spoiler (no underline: notes do not need it and it reads as a link) and, at the end, a `ToolbarToggleItem` 「预览」 with an eye icon whose text is visually hidden below `sm`; the field itself is the hina `Textarea`. A tool wraps the selection in its tag, or removes the tag when the selection is already wrapped, and keeps the selection (`applyBBCodeTool`, `~/shared/markup/bbcode-edit`); a link wraps a selected address as `[url]…[/url]` and otherwise leaves the cursor at the address of `[url=]…[/url]`. Preview swaps the textarea for a `Card` with the textarea's exact box (`rounded-md`, the measured height) and text position (padding from `--hn-control-px-md` and `--hn-control-h-md`), rendering `BBCodeText`, so switching moves nothing. Never put a `SegmentedControl` or `Toggle` next to the input inside a `FormField`: they claim the field's label and error state; the toolbar's toggle group does not.

A short fixed list where several values may be chosen (resource platforms with `PlatformIcon`, languages) is a row of `Chip selectable` in a `role="group"` with an `aria-label` (`ChoiceChips` in the resource feature): every option is visible and one tap toggles it. Not `CheckboxGroup` (a questionnaire look) and not `MultiSelect` (hides a handful of options behind a dropdown).

Text cut with `truncate` shows its full value in a `Tooltip` only when it actually overflows: `useOverflowing()` (`~/shared/ui/use-overflowing`, a `ResizeObserver`) gives the ref and the flag, the `Tooltip` is `disabled={!overflowing}` and the trigger gets `tabIndex={0}` only then. The trigger is sized to its text (`w-fit` with a `max-w-*`), otherwise the tooltip centres on an empty full-width box.

Game, character and developer data comes from Hikarinagi's open API, whose terms require naming Hikarinagi as the source and linking to the entry. Every page that shows such an entry renders `CatalogAttribution` (`~/shared/ui/catalog-attribution`) with the entity and its `h_id`: the text 「条目数据来自」 followed by Hikarinagi's wordmark (`app/shared/ui/hikarinagi-wordmark.svg`, inline, colours untouched) linking to `HIKARINAGI_SITE_URL/<galgames|producers|characters>/<id>`. Entry and editor URLs come from `~/shared/catalog/hikarinagi`. The tab that shows the catalog data (the game's info tab) ends with `CatalogCorrection` (「资料有误或不全？去 Hikarinagi 编辑」), linking to the entry's editor; corrections are not offered from menus. The Hikarinagi ID button keeps using `public/brand/hikarinagi-icon.webp`.

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
- Entry detail pages (game; later character and developer) let the artwork carry the page. The header starts with a key visual: the first screenshot that is safe to show large (`bannerIndex`), as a wide rounded banner that opens all screenshots in a `Lightbox` (`useGallery`, never `Image preview`, since the cover overlaps it). The cover (with `preview`) overlaps the banner's lower edge (negative top margin, `ring-4 ring-canvas`), and beside it come the byline (developer · release date), the title and original title, aliases, platform and type `Tag`s, and one action row (the only solid button, then soft and outline ones, `CatalogAttribution` at the end). The external ratings (`GameScores`) sit beside the title block from `sm` and under it below: one block per source the game is linked to (`scoreSites`), headed by the site's own logo (Bangumi's `public/brand/bangumi-logo.png` in its colours; VNDB's wordmark `vndb-logo.svg` inline in `currentColor`, since its navy would vanish in dark mode, each with an explicit width from its aspect ratio so it starts at the same left edge as the lines under it; an SVG with `w-auto` stretches across the column and centres its art), then the score with one decimal and the vote count, or a dash and 「暂无评分」; the whole block links to the entry on that site, and since it is a link and not a card it gets only `hn-state-layer` (hover and press tint, `rounded-lg`, `p-2` offset by `-m-2` so the edges stay aligned), no `Ripple` and no press scale. `Statistic` is not used here because its `label` is text only. There is no `⋯` menu: every action in it duplicated something already on the page (the address bar, the attribution link, the score links). Without a usable screenshot the same grid renders without the banner, the overlap and the text column's top padding, so the title lines up with the cover. The tabs follow below; long-form text (the intro) lives in a tab and in the `description` meta.
- The resources tab keeps the PRD prototype's information order and drops what does not earn its space: the platform filter (`SegmentedControl`) appears only for more than three resources and there is no page-level download method switch (each `DownloadButton` menu already offers browser, aria2 and copy; the default lives in settings). Each resource is a `Card` (`padded={false}`, `p-4`, `gap="sm"`): `PlatformTag`s and outline language and engine `Tag`s, all `size="md"` with `h-7 px-2.5`, on the left, uploader, update time and download count (icon + text) on the right with a `⋯` `DropdownMenu` for history, report, edit and delete (below `sm` the facts move to their own row); the note through `BBCodeText`; files in a `Table` (`variant="secondary"`, header for screen readers only) with name (an archive icon, then the full name wrapping across lines, never truncated: it is what tells versions apart, and a hover tooltip does not exist on touch screens), size, checksum and the download button; below `sm` the checksum is hidden and the size moves under the name, leaving the name the width it needs. A file's scan state shows only when it is not clean, as a tag after the name that wraps under it on narrow screens.
- A page split into tabs (the game page: `/:lang/game/:id`, `/info`, `/characters`) is a parent route with one child route per tab. The parent loader loads everything the tabs share, so switching tabs never reloads the header; child routes have no loader of their own when the parent already holds their data and read it from the typed `matches` prop (`const [, , site, game] = matches`). The tab strip is hina-ui `Tabs` with `value` taken from the URL and `onValueChange` navigating with `state: keepScroll` (`~/features/shell`), which tells the main scroll restorer to keep the position; a `hash` on such a navigation scrolls to that element (`#resource-12`).
- Slow, optional data (external ratings) is returned from the loader as an unawaited promise that never rejects at all: the use-case settles every request (`Promise.allSettled`) and drops what failed, because a promise that rejects before React Router attaches to it is an unhandled rejection that takes the server process down. It renders through `<Suspense>`/`<Await>`, and the fallback must take exactly the space of the result (no layout shift): render the same slots the result will fill, known from the synchronous data (which sources a game is linked to), with values that occupy the same line (a dash) and `Skeleton` wrapping the lines that will appear. (`Statistic loading` would not do: its skeleton is shorter than the number's line.)
