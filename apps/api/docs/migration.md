# Migrating from the NestJS backend

## Strategy

1. The Go backend serves the same HTTP contract (paths, envelope, business codes, cookies) so the existing web client and its Playwright suite can run against it, and the new client is built on the same contract through OpenAPI.
2. It runs against the same PostgreSQL database. `shionlib-api migrate up` adopts a Prisma-managed database (marks `20260925074133_baseline` applied when `_prisma_migrations` shows the final Prisma migration) and then applies forward migrations.
3. Modules are ported one capability at a time with tests that pin legacy-visible behavior (see `.claude/skills/go-backend/recipes/migrate-module.md`).

## Per-module compatibility checklist

HTTP method/path · request schema · response schema · status code · business code · authentication · authorization · side effects · DB writes · transaction behavior · events/jobs · cache behavior · timeouts · retries · idempotency.

## Database changes

| Migration | Change | Risk |
|---|---|---|
| `20260925074133_baseline` | Exact Prisma schema (applied only on fresh databases) | none |
| `20261003000000_normalize_legacy_names` | Enum types renamed to snake_case; `bitIndex`/`isRelation`/`allowMask` columns renamed; `_user_like_comment(A,B)` renamed to `comment_likes(comment_id,user_id)` | metadata-only renames |
| `20261003000100_game_tag_relations_primary_key` | Adds the missing primary key `(game_id, tag_id)` | builds an index; table is small |

## Intentional deviations

| Area | Legacy behavior | New behavior | Reason |
|---|---|---|---|
| Path/query parsing | non-integer path id → 400 `code:400` | 422 `COMMON_VALIDATION_FAILED` with field details | one validation pipeline |
| Unknown query parameters | rejected with 422 | ignored | caches and proxies append parameters |
| Optional auth | ignored the family block; `Bearer undefined` shadowed the cookie | blocked families and invalid tokens are treated as stale guests; placeholder bearer values fall back to the cookie | security, consistency with required auth |
| `GET /favorites` as guest without `user_id` | listed every user's lists, including private ones | empty list | data leak |
| `PATCH /favorites/:id` without `name` | could fail with `FAVORITE_NAME_ALREADY_EXISTS` | name check only when a name is sent | bug |
| `DELETE /favorites/:id/games/:game_id` | revealed item existence to non-owners | ownership checked first | data leak |
| Concurrent duplicate inserts | unique violations surfaced as 500 | mapped to the business conflict code | correctness |
| Default locale | `en` | `zh` | product direction |
| Realtime notifications | socket.io namespace `/ws`, client emits `message:unread:pull` | Server-Sent Events at `GET /message/stream` (events `message:new`, `message:unread`, `ping`); the unread count is sent on connect | plain HTTP, no socket.io dependency (ADR 0007) |
| Message push timing | `message:new` emitted before the transaction committed | emitted after commit | phantom notifications on rollback |
| `POST /message/:id/read` for a missing or foreign message | 500 | 404 `MESSAGE_NOT_FOUND` | bug |
| Catalog data | read at request time from Hikarinagi internal APIs | materialized locally from catalog sources (see ADR 0006) | removes internal coupling |
| Partner API (`/partner/*`) | secret-authenticated download data for Hikarinagi | removed | internal communication removed |
| Configuration | `*_MS`/`*_SEC` numbers, `REFRESH_TOKEN_ALOGRITHM_VERSION` | Go durations (`60s`, `1h`), corrected names; see `.env.example` | clarity, validation at startup |
| `POST /sponsor/webhook/idatariver` | always 200 `{received:true}`; provider failures swallowed (callback lost); re-queried order applied without checking its id or amount; provider id concatenated into the query unescaped; wall cache flushed on every call | re-queries iDataRiver (escaped id) and applies only when the provider id and amount (±0.01) match the local order; unknown order → 404 `SPONSOR_ORDER_NOT_FOUND`; mismatch → 502 `SPONSOR_PROVIDER_VERIFICATION_FAILED`; provider outage → 502 `SPONSOR_PROVIDER_REQUEST_FAILED` so the provider retries; a body without `orderId` still answers `{received:true}`; JSON and form bodies accepted; wall cache dropped only when an order becomes DONE | forged or replayed callbacks, lost payments |
| `GET /sponsor/order/:id` | anyone could trigger the provider sync (and the sponsor badge extension) for any order and read private sponsor names, messages and users | only the order's owner, or a caller passing `?token=<accessToken>`, triggers the sync and sees the full order; `accessToken` is a new field of the `POST /sponsor/order` response (HMAC-SHA256 of order id and provider order id, key derived from `TOKEN_SECRET`); everyone else gets the local status with `providerOrderId` empty and `sponsorName`, `message`, `user`, `paymentMethod` null. The legacy client keeps working: owners poll with their session, anonymous orders complete through the webhook | security, privacy |
| Sponsor DONE transitions | webhook, polling and admin updates read then wrote without a lock, so concurrent completions could extend `sponsor_expires_at` twice; polling and admin changes left the 5 min wall cache stale | transitions run on a locked row; the badge is extended exactly once per transition into DONE; the wall cache is dropped whenever a DONE order changes or is deleted | correctness |
| Upstream error messages | `SPONSOR_PROVIDER_REQUEST_FAILED` and `ANALYSIS_TRAFFIC_DETAIL_UNAVAILABLE` interpolated raw network errors into `{message}` | provider business messages are still shown; transport failures use fixed texts (`provider unreachable`, `HTTP <status>`, `upstream request failed`); the cause is logged | internal detail leak |
| Sponsor input limits | `method` longer than 50 characters failed in the database (500); amounts with more than two decimals were sent to the provider unrounded | `method` max 50 → 422; amounts are rounded to cents before they reach the provider and the database | consistency with the column types |
| Ad cache invalidation | admin writes ran `SCAN *ad:*`, deleting unrelated keys (`message:unread:*`, `s3-upload:*`, Bull `large-file-upload` keys) | only keys under the `ad:placement:` prefix are deleted; `GET /ad/placement/:placement` rejects placements longer than 100 characters (422) | data loss, cache-key flooding |
| Ad admin dates | `start_at`/`end_at` accepted any ISO-8601 string | RFC 3339 timestamps; `null` still clears them, and now also clears `image_ja`/`image_en` | one date format |
| `GET /moyu/game/:gameId/patches` | resolved patches for every game | strict viewers get `MOYU_PATCH_NOT_FOUND` for rated games | rated games stay invisible to strict viewers |
| `GET /analysis/data/overview` | zone GraphQL failures (direct mode) returned 500 | `bytes_gotten` falls back to 0 in both modes and the failure is logged; both analysis routes stay public because the home page renders them | availability of the home page |
| `GET /analysis/data/traffic-detail` | top games and top files listed rated titles for every viewer | strict viewers do not see rated games in `topGames` nor files of rated games in `topFiles` | rated games stay invisible to strict viewers |
| PotatoVN errors | every upstream failure became 500, and a failed login (even a PotatoVN outage) became `PVN_BINDING_AUTH_FAILED` | rejected credentials or tokens → 401 `PVN_BINDING_AUTH_FAILED`; outages → 502 `PVN_REQUEST_FAILED` (540104, new); a remote entry already mapped to another local game → 409 `PVN_GAME_MAPPING_CONFLICT` (550102, new); `DELETE /potatovn/game/:gameId` removes the local mapping when the entry is already gone remotely (404) | correctness |
| PotatoVN binding and sync | `POST /potatovn/binding` shared the default throttle; the library sync after binding was fire-and-forget; the hourly sync ran every user sequentially in-process; the cover was read before checking the binding; the presigned cover URL was used as returned | `POST /potatovn/binding` uses the `auth` throttle (credential checks against a third party); syncs run as River jobs (`potatovn_sync_library`, up to 3 attempts), the hourly task enqueues one per binding; the binding is checked first; presigned upload URLs must be `https` | abuse resistance, isolation, SSRF |
| Database backups | `pg_dump` output buffered in memory; the database password passed on the command line; failed prunes swallowed | the dump is streamed to the backup bucket in 32 MiB multipart chunks and the upload is aborted when `pg_dump` fails (no truncated backups); the password is passed through `PGPASSWORD` and non-libpq URL parameters are dropped; prune failures fail the task; tasks exist only when `ENABLE_BACKUP=true` | memory, secrets, reliability |

## Redis

The family-block keys keep their legacy names (`<prefix>:auth:family:blocked:<fid>`), so sessions blocked before the cutover stay blocked. Every other cache entry is rebuilt; legacy cache keys can be flushed after cutover.
