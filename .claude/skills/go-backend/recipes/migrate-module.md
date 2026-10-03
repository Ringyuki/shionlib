# Port a module from the NestJS backend

Source of truth for behavior: `apps/backend/src/modules/<module>` and the inventories in the rewrite plan. Keep the HTTP contract unless the deviation is listed in `apps/api/docs/migration.md`.

For every route confirm: method/path, request schema and validation, response schema, status code (POST 201 by default, void responses omit `data`), business codes, authentication/authorization, side effects and DB writes, transaction behavior, cache behavior, jobs/messages emitted, timeouts and retries, idempotency.

Mapping:

| NestJS | Go |
|---|---|
| Controller | `<capability>http.Handler` |
| Service | `<capability>.Service` (rules) + adapters (I/O) |
| Prisma calls | `<capability>pg.Repository` behind a consumer-owned port |
| Guard (`JwtAuthGuard`, `RolesGuard`) | `httpapi.Route.Access`; ownership checks in the service |
| Interceptor / filter | `response` + `errmap` (already global) |
| DTO + class-validator | input structs with Huma tags |
| `@Cron` | `jobs.Task` |
| Bull processor | River worker in `transport/jobs` |
| `CacheService` | `Cache` port; prefer no cache unless the query is expensive |

Write tests that pin the legacy-visible behavior first, then implement. Record intentional fixes in `apps/api/docs/migration.md`.
