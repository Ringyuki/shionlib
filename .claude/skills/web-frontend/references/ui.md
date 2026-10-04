# UI

## hina-ui

- Import components from `@hina-ui/react`; the style entry is `app/app.css` (`tailwindcss` then `@hina-ui/react/styles/tokens.css`).
- Layout: `Container`, `Stack`, `Inline`, `SimpleGrid`, `Grid`; text: `Heading`, `Text`; actions: `Button` (`variant`, `tone`, `size`, `icon`, `loading`), links styled as buttons with `<Button asChild><Link .../></Button>`.
- Overlays (`Popover`, `Dialog`, `Sheet`) take their trigger as children and the panel as `content`.
- Icons come from `lucide-react` (the version hina-ui uses).
- `TooltipProvider` and `Toaster` are mounted once in `root.tsx`; `UiLocaleProvider` in `lang.tsx`.
- Use tokens (`text-muted`, `border-line`, `bg-subtle`) instead of raw colours; Tailwind utilities only glue layout.

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
