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
| `DELETE /character/:id` | no guard; any guest could delete a character | requires ADMIN (401 `AUTH_UNAUTHORIZED`, plain 403 below admin), like `DELETE /developer/:id` | security hole |
| Character and developer ids | `GET /character/:id`, `GET /developer/:id`, `/developer/list` and the credits inside game payloads used Hikarinagi ids; `h_id` echoed the path id | every id is the local `game_characters.id` / `game_developers.id` (`/game/list?developer_id=&character_id=` too); `h_id` is the stored source id or `null` | catalog is local (ADR 0006) |
| Game route caches | `/game/list`, `/game/recent-update`, `/game/:id`, `/header`, `/details`, `/characters` cached 30 min per user and content limit | read from local tables on every request; only the Bangumi/VNDB scores (7 days) and sitemaps (1 hour) are cached | local reads are cheap; no stale views or visibility after edits |
| Game detail payloads | `link[].id` was index+1, `relations_from[].id` the Hikarinagi target id, `relation` the raw upstream string, `tags[].tag_alias` always `null`, character `age` a string | `link[].id` = `game_links.id`, `relations_from[].id` = `game_relations.id`, `relation` = `game_relation_type` value, `tag_alias` from `game_tag_relations`, `age` an integer; developers are the `开发` credits | data comes from local tables |
| `POST /game/:id/view` for a missing game | 500 (Prisma P2025) | 404 `GAME_NOT_FOUND` | bug |
| `GET /game/score/vndb/:id` without a VNDB result | `data` key omitted | `data: null`, nothing cached | consistent envelope |
| `GET /game/list` array filters | qs accepted `filter[tags][]=a`, `filter[tags][0]=a` and scalars | only the bracket form `filter[x][]=` the web client sends; dates accept RFC 3339 or `YYYY-MM-DD` | Huma query binding |
| `GET /search/games` | engine-specific item shapes; the `pg` engine searched hidden games, ignored the resource setting and matched intros, characters and staffs; only the Hikarinagi engine honored `only_games_with_resources` | every engine returns the `/game/list` item shape (plus `_formatted` highlights from Meilisearch), hides `status != 1`, applies the strict-viewer filter and the resource setting (guests on); the `pg` engine matches titles, aliases, tag names/aliases and developer names/aliases as case-insensitive substrings, newest release first | consistency with lists, privacy |
| Search analytics | separate unprefixed Redis client (`trends:*`, `sugg:prefix:*`) that refused to boot with `REDIS_DB=0`; any query length recorded, prefixes split UTF-16 units | keys under the client prefix (`<prefix>:search:trends:<window>`, `<prefix>:search:suggest:<prefix>`); queries longer than 64 characters are not recorded; prefixes are built per Unicode character; the River job is not retried | bounded memory, correctness |
| `GET /search/tags` | `limit` unbounded; names matched case-sensitively, aliases only exactly | `limit` 0..100; case-insensitive substring on names and aliases, `display_name` rules unchanged | validation, consistency |
| `GET /character/list` `q` | names were ANDed together, so only the alias ILIKE matched; no order | name (jp/zh/en) or alias case-insensitive substring; ordered by id | bug |
| `GET /developer/list` | Hikarinagi producer list, upstream `works_count` | local developers ordered by name then id, `works_count` counts visible games | catalog is local |
| `GET /bangumi/get` | open proxy to any `api.bgm.tv/v0/{path}/{id}/{type}` with the site token | `path` in subjects/characters/persons/episodes/indices, numeric `id`, `type` in subjects/characters/persons; anything else is 422 | abuse of the shared OAuth token |
| Bangumi OAuth tokens | JSON file `config/bangumi-tokens.json` | same JSON stored in Redis at `<prefix>:bangumi:tokens`; refreshed tokens are written back there | stateless, multi-instance deploys |
| Sitemaps | host and protocol taken from `X-Forwarded-*` of any client; games filtered by `nsfw = false`; rows in natural order; non-numeric page → 400 | forwarded headers only from trusted proxies and only well-formed hosts, otherwise `SITE_URL`; games also exclude rated covers (crawlers are strict viewers); rows ordered by id; non-numeric page → 422 | header injection, cache poisoning, consistency |
| Hot score task | config values interpolated into SQL, ran in every process | same formula with bound parameters, leader-elected River task at minute 0 | safety |

## Redis

The family-block keys keep their legacy names (`<prefix>:auth:family:blocked:<fid>`), so sessions blocked before the cutover stay blocked. Every other cache entry is rebuilt; legacy cache keys can be flushed after cutover.

Catalog keys: the recent-update sorted set moves from the ioredis key `<prefix>game:recent_update` (no separator) to `<prefix>:game:recent_update`; copy it with `ZUNIONSTORE <prefix>:game:recent_update 1 <prefix>game:recent_update` at cutover or let admins re-mark games. Provision the Bangumi OAuth tokens with `SET <prefix>:bangumi:tokens "$(cat config/bangumi-tokens.json)"`; without them the Bangumi score and proxy routes return 500 as before. Search trends and suggestions restart empty.
