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
| Comment reply counts | a direct reply to a root comment incremented the root's `reply_count` by 2 and deleting it decremented by 2 | the parent and the root are each adjusted once; counts never go below 0; existing counts are not recomputed | bug |
| Comment like and moderation notices | `message:new` pushed inside the transaction, before commit | message rows are written in the same transaction and pushed after commit | phantom notifications on rollback |
| Editor content (`content` of comments and walkthroughs) | rendered by headless Lexical + `sanitize-html` in Node; a body without `root`, an empty root or a node type the server did not register (image, keyword, emoji, layout, …) failed with 500; rendered HTML over the 100 000-character column failed with 500 | rendered by `internal/lexical` (same node set, theme classes, formats and style allow-list; attribute order differs and `<col>` is self-closing; link targets outside `_blank/_self/_parent/_top` and unsafe code languages are dropped); malformed or unsupported content is 422 `COMMON_VALIDATION_FAILED` on `content`; oversized HTML is 422 `COMMENT_CONTENT_TOO_LONG` (470104) / `WALKTHROUGH_CONTENT_TOO_LONG` (560103) | no Node runtime, validation instead of crashes |
| `POST /comment/game/:game_id` for a missing game | foreign-key error, 500 | 404 `GAME_NOT_FOUND` | bug |
| `GET /user/datas/:id/comments` | unspecified order; strict viewers saw comments on rated games | newest first; strict viewers do not see comments attached to rated games | stable pagination, rated-content rule |
| `POST /walkthrough`, `PATCH /walkthrough/:id` | titles over 255 characters failed with 500; `game_id` accepted numeric strings; the creation activity was written outside a transaction | 422 for titles over 255 characters; `game_id` must be a JSON number; walkthrough and activity are written atomically | validation, atomicity |
| Moderation pipeline | Bull `moderation_queue` jobs with one attempt; a failed OpenAI call left comments pending and published walkthroughs `HIDDEN` forever; with an empty `OPENAI_API_KEY` every call failed with 401; verdicts were applied even if the item had been edited or decided meanwhile | River queues `moderation_screening` (10 workers), `moderation_comment_review` (1) and `moderation_walkthrough_review` (1) with River's retry backoff (25 attempts); items stay pending/`HIDDEN` while retrying and can be re-queued with the admin rescan; verdicts apply only while the comment is still pending (or the walkthrough not deleted) with unchanged content; an empty key disables moderation and approves content directly (warning logged at startup); comments without text are approved without a call | never block posting forever, recoverable failures |
| Walkthrough language detection | script heuristics, then `cld3-asm` (WASM) and `opencc-js` dictionaries | same script heuristics; the CLD fallback is replaced by deterministic script-majority rules and Simplified/Traditional is decided by counting characters only encodable in GB2312 versus Big5 (`golang.org/x/text`, no new dependency) | lean; results may differ for short mixed-script texts |

## Redis

The family-block keys keep their legacy names (`<prefix>:auth:family:blocked:<fid>`), so sessions blocked before the cutover stay blocked. Every other cache entry is rebuilt; legacy cache keys can be flushed after cutover.
