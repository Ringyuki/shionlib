# Error model

Every failure a client can observe has three faces:

1. **Semantic error** in the owning capability: `favorite.ErrNotFound = apperror.Define(460103, "FAVORITE_NOT_FOUND", apperror.KindNotFound)`.
2. **Diagnostic chain**: causes wrapped with `%w` or `Def.Wrap(err)`; logged once at the boundary, never sent to clients.
3. **Transport representation**: `errmap` converts the kind to an HTTP status and the name to a localized message.

```json
{ "code": 460103, "message": "收藏夹不存在", "data": null, "requestId": "…", "timestamp": "2026-10-03T01:02:03.456Z" }
```

Validation errors carry field details:

```json
{ "code": 100101, "message": "参数校验失败", "data": { "errors": [ { "field": "name", "messages": ["name 必须大于 1 个字符"] } ] }, "requestId": "…", "timestamp": "…" }
```

## Codes

- Six digits; the leading three digits form a range owned by one package (`internal/apperror/ranges.go`). The generated registry is [business-codes.md](business-codes.md).
- `0` is success. Codes `≤ 1000` are HTTP-level errors without a business meaning (`code` equals the status: 400 malformed body, 403 role check, 404 unknown route, 429 rate limit, 500 unexpected failure, 503 dependency down).
- The web client treats `200101`/`200102` as "refresh the access token and retry" and `200103`–`200106`, `300105` as "log out". These codes are part of the contract.

## Kinds and statuses

| Kind | Status | Typical use |
|---|---|---|
| InvalidArgument | 400 | request is well-formed but not acceptable |
| Unauthenticated | 401 | missing or invalid credentials |
| PermissionDenied | 403 | authenticated but not allowed |
| NotFound | 404 | resource does not exist or is not visible |
| Conflict | 409 | uniqueness or state conflict |
| Gone | 410 | expired session or order |
| PayloadTooLarge | 413 | upload limits |
| UnsupportedMediaType | 415 | upload type |
| Unprocessable | 422 | validation and semantic input errors |
| RateLimited | 429 | business-level quotas |
| Internal | 500 | never chosen explicitly |
| NotImplemented | 501 | disabled features |
| UpstreamFailed | 502 | vendor failure |
| Unavailable | 503 | feature or dependency disabled |

## Logging

Errors are returned, not logged, until they reach a boundary. The HTTP access log line includes `business_code`; 5xx lines also include the error text. River logs job failures in one place. Repositories and services never log errors they return.
