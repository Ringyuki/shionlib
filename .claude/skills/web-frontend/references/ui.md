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

## Shionlib theme

`app/shared/ui/theme.css` maps the Shionlib tokens onto hina-ui:

- `--color-brand-*` is the Shionlib blue scale (`#34a2d5` at 600) and drives `--hn-accent*`; `--color-neutral-*` is the Shionlib neutral scale; success, warning, info and danger use the Shionlib 600 shades with white text.
- Radii: 4/6/8/10/14 px (`--hn-radius-xs` … `--hn-radius-xl`).
- Domain colours: `platform-<key>` (+ `-fg`) for the 19 platforms and `resource-<type>` (+ `-soft`) for the 12 resource types, with dark-mode values.
- Nothing else: no gradients, glows or extra hues.

## Shell

- `features/shell/ui/site-shell.tsx` renders hina-ui `AppShell` with controlled sidebar state (`expanded`/`rail`, remembered in the `shionlib_sidebar` cookie) and mobile drawer state.
- The sidebar (`ui/site-sidebar.tsx`) is Shionlib's own: brand row aligned with the 56 px header, the upload action, navigation sections, and the account menu. It uses hina-ui's motion utilities (`hn-sidebar` for the width transition, `hn-sidebar-label` for fading labels), keeps every icon, the logo and the avatar centred at 34 px in both states (the rail is 69 px so its content is an even 68 px inside the 1 px border; items are 44 px wide; bordered buttons take 1 px off their start padding), swaps section titles for dividers and shows tooltips in rail, and renders a `CloseButton` inside the mobile drawer.
- The header (`ui/site-header.tsx`) holds `SidebarTrigger`, the brand on small screens, the search form and the language menu.
- The main area scrolls inside `AppShell`; `useMainScrollRestore` wires hina-ui's scroll restorer to React Router (top on new pages, previous position on back/forward and reload), and `root.tsx` injects `firstPaintRestoreScript()`.

## Brand and images

- `BrandLogo` shows `public/brand/logo.png` (from `favicon.ico`); `Wordmark` paints `public/brand/wordmark.svg` through a CSS mask in the accent colour.
- API image fields are storage keys; `useImageUrl()` prefixes them with `IMAGE_BASE_URL` and passes absolute, `data:` and `blob:` URLs through.

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
