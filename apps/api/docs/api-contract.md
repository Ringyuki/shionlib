# API contract

The OpenAPI 3.1 document `apps/api/openapi/openapi.json` is generated from the Go route registrations (`go run ./cmd/api openapi openapi/openapi.json`) and is the single source of truth for the web client's types. CI fails when it is stale.

## Envelope

| Field | Type | Notes |
|---|---|---|
| `code` | integer | `0` on success |
| `message` | string | localized; `common.success` is empty |
| `data` | any | omitted entirely for void operations |
| `requestId` | string | equals the `Shionlib-Request-Id` response header |
| `timestamp` | RFC 3339 UTC with milliseconds | server time |
| `meta.auth` | object | only on success when an optional token was stale; header `shionlib-auth-stale: 1` is set too |

## Conventions

- Paths have no global prefix (the web server proxies `/api/*`).
- POST answers 201 unless documented; other methods answer 200.
- Payload keys are snake_case. Envelope and pagination meta keep camelCase for compatibility.
- Pagination: query `page` (≥1, default 1) and `pageSize` (1..50 unless documented, default 10); response `{ items, meta: { totalItems, itemCount, itemsPerPage, totalPages, currentPage, …extras } }`. There is one pagination contract (offset pages, inherited from the legacy API); extras are legacy keys that some lists add next to the standard ones (`content_limit`, `is_current_user`) through a `<thing>PageMetaDTO` embedding `response.PageMeta`.
- Unpaginated collections are bounded by their owner or by a validated `limit`, and keep the legacy shape (a plain array): a user's favorite lists, passkeys and ongoing uploads; a game's download resources; a file's history; ad placements; catalog sources; search tags, trending and suggestions (`limit` ≤ 100/50/50); admin trends (`days` ≤ 90). New list endpoints MUST paginate.
- Times are UTC with exactly three fractional digits, `YYYY-MM-DDTHH:MM:SS.sssZ` (JavaScript `toISOString()`, as the legacy backend wrote them). 64-bit counters that may exceed 2^53 (file sizes) are strings.
- Requests the client abandoned are answered and logged with status 499 instead of 500.
- Authentication: `Authorization: Bearer <jwt>` or the `shionlib_access_token` cookie. Refresh tokens live only in the `shionlib_refresh_token` cookie.
- Localization: `shionlib_locale` cookie, then `lang` query, then `Accept-Language`; default `zh`.
- Rate limiting: per route and client IP; `X-RateLimit-*` headers on every response, `Retry-After` on 429.

## Realtime

`GET /message/stream` (login required) is a Server-Sent Events stream. Events: `message:unread` (`{"unread": n}`, sent on connect and on every change), `message:new` (`{id, title, type, tone, created}`, `created` in the same `…sssZ` format as every other time), `ping` (keep-alive every 25 s). The stream is not part of the OpenAPI document; its payloads are `messagehttp.unreadEventDTO` and the records in `internal/adapter/push`.

## Message meta

`meta` on a message is a free-form JSON object whose keys the web client reads per message type (`file_name`, `top_category`, `review_deadline`, …). Capabilities build it as `message.Meta`; `messagepg` encodes it with the API JSON format, so times inside meta use the same `…sssZ` format.

## Idempotency

- Reads (`GET`) are safe to retry. `PUT`/`DELETE` routes are idempotent by design (adding a game already in a list, deleting a missing item answer with the business code, not a duplicate effect).
- `POST` creates are not idempotent; clients must not retry them blindly. Uniqueness that the business requires (favorite names, one pending report per resource and reporter, one binding per user) is enforced by database constraints and surfaces as the conflict business code.
- Webhooks (`POST /sponsor/webhook/<provider>`) do not trust the payload: the service re-fetches the order from the provider, checks it matches the local order, and applies the status transition under a row lock only when the order state machine allows it. Replays for a finished order return without side effects.
- Jobs are retried by River; every worker's service method is written to be re-run (state checks before side effects, unique job options for scheduled tasks).
