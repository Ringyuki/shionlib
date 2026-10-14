# ADR 0018: The open API answers keys owned by accounts

## Context
Game managers (LunaBox, ReinaManager), Hikarinagi and user scripts want to know which resources the site holds for a game they already know by its Bangumi, VNDB or Hikarinagi ID. The site's own API is shaped for its pages, changes with them, and authenticates sessions; handing it out would tie integrations to every redesign and to cookies. 640 VNDB IDs on production belong to more than one game (Bangumi splits originals, remakes and parts that VNDB keeps as one work), so a lookup by VNDB ID can find several games.

## Decision
- **One versioned, read-only route.** `GET /open/v1/games` takes one kind of ID (`id`, `hid`, `bid` or `vid`, up to 50 separated by commas) and returns every visible game it matches with its published resources and downloadable files, plus the IDs that matched nothing. Field names are those of the site's own resource API. Breaking changes go to `/v2`. A second OpenAPI document holding only the routes tagged `open` is served at `/open/v1/openapi.json`.
- **Keys belong to accounts.** An account creates up to `open.max_keys` keys in its settings; each is `shl_` and 32 random bytes in base62, shown once and stored as its SHA-256 with its first 12 characters for display. A key authenticates only routes registered with `httpapi.AccessKey`; the session middleware ignores `shl_` bearers, so a key never acts as a session and a session never opens the open API. The caller is the key's owner with the content limit of a signed-in member, so adult games are returned and marked `nsfw`.
- **Rate is per account.** The limiter keys the `open` policy (`throttle.open_*`) by account, not by address; an administrator can give an account its own limit (`users.api_request_limit`). Every request and every throttled one is counted per key and day in Redis and written to `api_key_daily_usages` every ten minutes, kept 90 days.
- **Administrators can stop a key.** The admin panel lists keys by recent use; suspending one asks for a reason that reaches its owner as a message, and restoring tells them too. `open.enabled` pauses the whole API with 503.
- **No download links.** A link still needs the human check on the resource page, so the API returns the page's address instead.

## Consequences
- Integrations depend on a contract that changes only by version, documented in the docs (开发 › 开放接口) and the separate OpenAPI document.
- Abuse is traceable to an account and stoppable per key without banning it.
- Counting adds a Redis increment to every request; the numbers in the admin panel lag up to ten minutes.

## Alternatives considered
- **Keys as sessions on the whole API**: no new routes, but every page change would break integrations, and a leaked key would act as the account.
- **Rate per key**: an account could multiply its limit by creating keys.
- **Signed download links through the API**: convenient for managers, but it would let scripts skip the human check and bill the site's traffic.
