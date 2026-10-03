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
| `20261003062720_catalog_sources` | Adds `catalog_source_links` and `catalog_sync_cursors` | new tables |
| `20261003062800_backfill_hikarinagi_links` | Links every game, developer and character with an `h_id` to source `hikarinagi`, copies `hikarinagi_sync_state.last_event_id` into `catalog_sync_cursors`, drops `hikarinagi_sync_state` | the legacy backend must be stopped first; down recreates the cursor table |
| `20261003062900_messages_receiver_index` | `CREATE INDEX CONCURRENTLY` on `messages (receiver_id, read, created)` | no table lock |

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
| Games deleted at the source | the shell stayed visible and its detail routes returned 404 | the game is hidden (`status = 2`) when the source reports it gone; merged entries are marked missing and the merge target is imported | consistent lists and details |
| Catalog administration | none | `GET /admin/catalog/sources`, `GET /admin/catalog/search`, `POST /admin/catalog/import` (synchronous), `POST /admin/catalog/import/queue` | operators can import or refresh one entry |

## Redis

The family-block keys keep their legacy names (`<prefix>:auth:family:blocked:<fid>`), so sessions blocked before the cutover stay blocked. Every other cache entry is rebuilt; legacy cache keys can be flushed after cutover.
