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
- Pagination: query `page` (≥1, default 1) and `pageSize` (1..50 unless documented, default 10); response `{ items, meta: { totalItems, itemCount, itemsPerPage, totalPages, currentPage, …extras } }`.
- Times are UTC with exactly three fractional digits, `YYYY-MM-DDTHH:MM:SS.sssZ` (JavaScript `toISOString()`, as the legacy backend wrote them). 64-bit counters that may exceed 2^53 (file sizes) are strings.
- Requests the client abandoned are answered and logged with status 499 instead of 500.
- Authentication: `Authorization: Bearer <jwt>` or the `shionlib_access_token` cookie. Refresh tokens live only in the `shionlib_refresh_token` cookie.
- Localization: `shionlib_locale` cookie, then `lang` query, then `Accept-Language`; default `zh`.
- Rate limiting: per route and client IP; `X-RateLimit-*` headers on every response, `Retry-After` on 429.

## Realtime

`GET /message/stream` (login required) is a Server-Sent Events stream. Events: `message:unread` (`{"unread": n}`, sent on connect and on every change), `message:new` (`{id, title, type, tone, created}`), `ping` (keep-alive every 25 s). The stream is not part of the OpenAPI document.
