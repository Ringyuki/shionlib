# HTTP transport

## Registration

```go
httpapi.Register(api, httpapi.Route{
    ID: "favorite.create", Method: http.MethodPost, Path: "/favorites",
    Summary: "Create a favorite list", Tags: tags, Access: httpapi.AccessUser,
}, h.create)
```

- `ID` is `<capability>.<action>` and becomes the OpenAPI operationId used by the generated frontend client.
- `Access`: `AccessOptional` (default, guests allowed), `AccessUser` (401 `AUTH_UNAUTHORIZED`/403 `AUTH_FAMILY_BLOCKED`), `AccessAdmin` (role ≥ 2), `AccessSuperAdmin` (role == 3). Role failures return plain 403 with `code: 403`.
- `Status` defaults to 201 for POST and 200 otherwise. Set it only when the legacy contract differs (e.g. logout 200).
- `Throttle` defaults to `default` (per route and client IP). Use `download` or `auth` for those policies.
- Every `{param}` in `Path` must be an exported `path:"param"` field on the input struct; registration panics otherwise. Do not embed path structs; embedding is only for exported shared query structs such as `httpapi.PageQuery`.
- Handlers are thin: read `actor.From(ctx)`, call one service method, map the result to DTOs. No SQL, Redis, transactions or business decisions in handlers.

## Inputs

- Path, query, header and cookie params are fields with `path:`, `query:`, `header:`, `cookie:` tags. Body is a `Body` field.
- Optional body fields are pointers with `json:",omitempty"`; required fields have no `omitempty`.
- Validate shape with Huma tags: `minLength`, `maxLength`, `minimum`, `maximum`, `enum`, `pattern`, `format`. Unknown body properties are rejected.
- Pagination: embed `httpapi.PageQuery` (`page` ≥ 1, `pageSize` 1..50, defaults 1/10). Endpoints with other limits declare their own fields.

## Outputs

- Success: `response.OK(ctx, h.resp, dto)` → `{code: 0, message, data, requestId, timestamp, meta?}`. `meta.auth` and header `shionlib-auth-stale: 1` are added automatically when an optional token was stale.
- Void: `response.Empty(ctx, h.resp)` (no `data` key).
- Pages: `response.NewPage(items, total, pageSize, page)` → `{items, meta: {totalItems, itemCount, itemsPerPage, totalPages, currentPage}}`. Extra meta keys go into a local struct embedding `response.PageMeta`.
- DTOs live in `dto.go`, use snake_case JSON, and never expose ent types. Shared DTOs (game cards) live in the owning capability's http package (`gamehttp.Card`).
- Times are `time.Time` in UTC. Database `bigint` values that may exceed 2^53 are serialized as strings (`json:",string"`).
- Cookies: only auth handlers set `Set-Cookie` through a dedicated output field; nothing else writes cookies.

## Non-Huma routes

Raw `http.Handler`s (streaming uploads, SSE, redirects) are mounted on `api.Router()` from the capability's http package, must use `api.Mapper()`/`api.ErrorWriter()` for errors, `middleware.RequireAuthenticated` for auth, and must apply rate limiting explicitly.
