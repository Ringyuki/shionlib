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

- `BrandLogo` shows `public/brand/logo.png` (from `favicon.ico`); `Wordmark` shows `public/brand/wordmark-zh.svg` (「书音的图书馆」) for `zh` and `public/brand/wordmark.svg` ("Shionlib") otherwise, both with Shionlib blue baked in so they read in light and dark themes. Both render through hina-ui `Image` with `eager` and `lazy={false}`, so they are in the server HTML and never fade in.
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
