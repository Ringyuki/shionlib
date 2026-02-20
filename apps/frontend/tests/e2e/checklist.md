# E2E Checklist

Last updated: 2026-02-20

## Legend

- [x] Done
- [ ] Todo

## Existing Coverage (Current)

- [x] Home page renders seeded game
- [x] Game list renders seeded games and can navigate to detail
- [x] Game detail renders seeded content
- [x] Game comments page renders seeded comment
- [x] Game characters page renders seeded character
- [x] Developer list/detail basic navigation
- [x] Character detail renders seeded character
- [x] Auth negative login cases (wrong password / unknown user)
- [x] Auth login dialog UI (input validation + submit)
- [x] Auth token refresh endpoint (valid/invalid refresh token)
- [x] Favorite API flow (create/update/delete favorite + add/update/remove item)
- [x] Favorite UI flow (create/edit/delete folder + add/remove game via dialog)
- [x] Comment API + UI flow (create/reply/edit/like/unlike/delete)
- [x] Message API flow (unread/list/detail + mark read/unread)
- [x] Message unread UI flow (Unread tab + open-detail clears unread)
- [x] Message websocket UI flow (top-bar unread badge realtime sync)
- [x] Search command UI (keyboard open + input + Enter navigation)
- [x] Forget password UI validation (invalid email)
- [x] Message read-state tabs UI (all/read/unread click switching)
- [x] Auth session refresh scenarios (missing/corrupted access with valid refresh + invalid pair logout)
- [x] Message type route UI (all/system/reply/like)
- [x] Message detail modal open flow (click list item)
- [x] Manual game create API flow
- [x] Game scalar edit with permission grant/revoke API flow
- [x] Game edit history read + strict undo API flow
- [x] Game developer relation add/edit/remove with permission grant/revoke API flow
- [x] Game character relation add/edit/remove with permission grant/revoke API flow
- [x] Game cover relation add/edit with permission grant/revoke API flow
- [x] Game image relation add/edit with permission grant/revoke API flow
- [x] Developer scalar edit/history/undo with permission grant/revoke API flow
- [x] Character scalar edit/history/undo with permission grant/revoke API flow
- [x] Admin dashboard UI page
- [x] Admin games list/filter UI page
- [x] Admin game status toggle UI flow
- [x] Admin game delete UI flow
- [x] Admin game recent-update add/remove UI flow
- [x] Admin comments list/detail UI page
- [x] Admin comments review/rescan UI flow
- [x] Admin reports list/detail UI flow
- [x] Admin reports review submission UI flow
- [x] Admin malware scans list/detail/review UI flow
- [x] Admin users list/detail UI page
- [x] Admin user role update UI flow
- [x] Admin user ban/unban UI flow
- [x] Admin user permissions read/update UI flow
- [x] Admin user sessions UI flow
- [x] Admin user reset-password + force-logout UI flow
- [x] Admin user quota size/used/reset UI flow
- [x] User settings UI flow (name/content-limit/language update + rollback)
- [x] User password settings UI flow (change password + admin rollback)
- [x] User download settings UI flow (aria2 save + local persistence + reset)
- [x] Download-source list/migrate-create/edit/delete API flow
- [x] Download-source report submit + admin review(valid) + user-view reflection API flow
- [x] Upload quota query + over-quota guard API flow
- [x] Large upload API flow (init/chunk/status/complete/abort)

## A. Public Browse & Search

- [x] Home `/[locale]`
- [x] Game list `/[locale]/game`
- [x] Game detail `/[locale]/game/:id`
- [x] Game comments `/[locale]/game/:id/comments`
- [x] Game characters `/[locale]/game/:id/characters`
- [x] Game list filters + sort + pagination combinations
- [x] Game detail download-source section visibility
- [x] Developer list `/[locale]/developer`
- [x] Developer detail `/[locale]/developer/:id`
- [x] Character detail `/[locale]/character/:id`
- [x] Search hub `/[locale]/search`
- [x] Search game `/[locale]/search/game`
- [x] Search trending + suggest linkage
- [x] Search command dialog keyboard/input flow
- [x] Docs index `/[locale]/docs`
- [x] Docs article `/[locale]/docs/[...slug]`
- [x] Friend links `/[locale]/friend-link`
- [x] Release page `/[locale]/release`
- [x] Sitemap routes (`/sitemap.xml`, `/sitemap-:type-:page.xml`)
- [x] Legacy frontend OG routes removed (`/og` and `/og/to-png` return `404`; OG served by standalone `apps/og` service)

## B. Auth & Account

- [ ] Register flow (request/verify code + create account; blocked: email provider/code delivery not configured in current env)
- [x] Login success + session cookie established
- [x] Logout success
- [x] Access token expired but refresh token valid (auto recover)
- [x] Access + refresh both invalid (auto logout)
- [ ] Forget password full flow (request/check/reset; blocked: email provider/reset link delivery not configured in current env)
- [x] User profile home `/[locale]/user/:id`
- [x] User comments tab
- [x] User edits tab
- [x] User favorites tab
- [x] User uploads tab
- [x] User settings interactive UI flow (name/content-limit/language update + rollback)
- [x] Settings personal (avatar/cover/name/email/password) (password flow covered with rollback)
- [x] Settings site (language/content limit)
- [x] Settings download (interactive save/local-persist/reset)
- [x] Forget password page UI

## C. Create & Edit Content

- [x] Create game manually
- [ ] Create game from external source (bangumi/vndb; blocked: Bangumi OAuth token file not configured in current env)
- [x] Edit game scalar
- [x] Edit game covers
- [x] Edit game images
- [x] Edit game developers
- [x] Edit game characters
- [x] Edit developer scalar
- [x] Edit character scalar
- [x] Edit history read (game/developer/character)
- [x] Undo flow
- [x] Permission apply/check flow
- [x] Comment create/edit/delete/like full flow (API + UI)
- [x] Favorites create/update/delete/add/remove full flow (API + UI)
- [ ] Favorites reorder (blocked: backend reorder field/endpoint not implemented)

## D. Upload & Download Resource

- [ ] Small upload: game cover (blocked: object storage credentials/endpoint not configured in current env)
- [ ] Small upload: game image (blocked: object storage credentials/endpoint not configured in current env)
- [ ] Small upload: developer logo (blocked: object storage credentials/endpoint not configured in current env)
- [ ] Small upload: character image (blocked: object storage credentials/endpoint not configured in current env)
- [x] Large upload: init/chunk/status/complete/cancel
- [x] Upload quota query + over-quota guard
- [x] Download-source list/create/update/delete
- [x] Download-source report
- [ ] Download link redirect (blocked: turnstile token validation requires configured secret for deterministic E2E)
- [x] Report reviewed in admin then reflected in user view

## E. Message & Realtime

- [x] Message list page (basic UI interaction covered)
- [x] Message read-state tabs: all/read/unread
- [x] Unread count endpoint + UI
- [x] Message type tabs: all/system/reply/like
- [x] Mark one read
- [x] Mark all read/unread
- [x] WebSocket push + UI sync

## F. Admin

- [x] Admin dashboard page
- [x] Admin games list/filter
- [x] Admin game status update
- [x] Admin game delete
- [x] Admin recent-update add/remove
- [x] Admin comments list/detail
- [x] Admin comments review/rescan
- [x] Admin reports list/detail/review
- [x] Admin malware scans list/detail/review
- [x] Admin users list/detail
- [x] Admin user role update
- [x] Admin user ban/unban
- [x] Admin user reset-password/force-logout
- [x] Admin user sessions
- [x] Admin user permissions read/update
- [x] Admin user quota size/used/reset
- [x] Admin stats overview/trends

## G. System & Robustness

- [x] Health endpoint + frontend health integration
- [x] `analysis/data/overview` fallback behavior without cloudflare env
- [x] RBAC 401/403 matrix (guest/user/admin)
- [x] 404/500 error boundary behavior
- [x] Locale switching consistency

## Execution Order (Recommended)

1. A/B/C core read-write flows
2. Upload/download + admin review chain
3. Message/realtime + system robustness
