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
| `PATCH /admin/content/download-resource-reports/:id/review` (VALID, removal on) | an ADMIN (role 2) got 440102 after the review, penalties and messages had already committed; the resource stayed online | any admin's review takes the resource down (status 2) inside the review transaction; stored objects are purged afterwards by a background job | bug: half-applied review |
| Resource take-down and file re-upload | stored objects were hard-deleted inside the transaction before the rows changed, so a later failure left rows pointing at deleted objects | rows change first; a retried background job deletes only object versions older than the decision, so a re-upload stored under the same key is never touched | consistency, race with re-uploads |
| `GET /game/download/:id/link` for a file that is not in object storage yet | counters incremented, then B2 failed with 500 | 404 `GAME_DOWNLOAD_RESOURCE_FILE_NOT_FOUND`; counters change only after a link was issued | bug |
| `POST /game/:id/download-source` | reusing a session already attached to another game's file, a `note` over 255 characters or an invalid `simulator` returned 500 | 409 `GAME_DOWNLOAD_RESOURCE_UPLOAD_SESSION_ALREADY_USED` / 422 `COMMON_VALIDATION_FAILED` | bug |
| `POST /game/download-source/migrate/file/:id` for a missing resource | 500 (foreign key violation) | 404 `GAME_DOWNLOAD_RESOURCE_NOT_FOUND` | bug |
| `notify`, `remove_resource`, `notify_uploader` in admin review bodies | coerced with JS `Boolean()` (`0` false, `"false"` true) | JSON booleans only; anything else is 422 | one validation pipeline, `"false"` meant true |
| `PATCH /uploads/large/:id/complete` | `{ok, path}` with the absolute server temp path | `{ok: true}` | information leak |
| `GET /uploads/large/ongoing` | omitted `chunk_size`, listed expired sessions that can no longer be resumed or aborted | includes `chunk_size`, lists only unexpired sessions | the client needs the chunk size to resume |
| `POST /uploads/large/init` | any `chunk_size` (0 or above the transfer limit gave 500 or an unusable session); a quota failure after the session row was written left an orphan session | `chunk_size` below 1 is 422, above `UPLOAD_LARGE_FILE_TRANSFER_LIMIT_BYTES` is 400 `GAME_UPLOAD_INVALID_CHUNK_SIZE` (480116); the session and its quota charge are written in one transaction | bug |
| `PUT /uploads/large/:id/chunks/:index` | body buffered in memory (express.raw), 500 without `Content-Type: application/octet-stream`, concurrent re-sends could record an index twice and `complete` only compared counts | body streamed to disk while hashing (any content type), bodies over the transfer limit are 413, an index is recorded once and `complete` compares the distinct set | memory use, bug |
| Upload clean-up task | a rejected file deleted its whole resource (including healthy files) and a second rejected file in the same resource aborted the run; expired sessions were re-processed every minute and their temp files were never removed | the resource is deleted only when no files remain; expired sessions are left alone; unreferenced temp files of finished sessions are removed after 48 h | bug |
| Upload quota tasks | the monthly reset aborted on the first user without a quota row; the inactivity reset wrote a zero-amount record every night; one failure stopped the batch | users without quota rows are skipped, zero quotas are not reset again, failures are collected per user | bug |
| Admin alerts for new reports and malware cases | in-app messages plus an email to every admin | in-app messages only (report alerts run as a River job); the email is sent once the email capability exposes a sender for `report.AdminMailer`/`scan.AdminMailer` | email sender not ported yet |
| Re-upload notifications | one message per favorite list containing the game | one message per user | duplicate notifications |
| `GET /user/datas/:id/game-resources` | listed soft-deleted resources; a resource without files returned 500 | only active resources; `file_name` is `""` when a resource has no files | bug |
| Malware DELETE review | the quota refund ran after the commit and its failures were only logged | the refund is part of the review transaction | consistency |
| Malware scan evidence | `scan_log_path`/`scan_log_excerpt` came from the clamscan/clamd scan log; a local `clamscan` binary could be used | clamd over TCP (zINSTREAM) only; the API keeps its own log of clamd replies in `FILE_SCAN_LOG_DIR/clamav-scan.log` and takes the excerpt from it | one scanner path |
| Bans issued by report and malware penalties | session families were blocked in Redis before the transaction committed | families are blocked after commit | no blocks for rolled-back bans |
| `GET /s3/test/file/list` | raw SDK output including `$metadata` | the same PascalCase fields without `$metadata` | SDK internals |

## Redis

The family-block keys keep their legacy names (`<prefix>:auth:family:blocked:<fid>`), so sessions blocked before the cutover stay blocked. Every other cache entry is rebuilt; legacy cache keys can be flushed after cutover.
