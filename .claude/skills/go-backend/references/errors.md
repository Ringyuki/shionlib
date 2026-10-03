# Errors

## Model

| Layer | Representation |
|---|---|
| Business meaning | `apperror.Definition` (`code`, `NAME`, `Kind`), e.g. `favorite.ErrNotFound` |
| Business detail | `*apperror.Error` from `Def.New()`, `Def.Wrap(cause)`, `.WithArgs(map)`, `.WithField(field, msgs...)` |
| Diagnostics | wrapped causes (`%w`, `Def.Wrap(err)`), never shown to clients |
| Transport | `errmap` maps `Kind` to HTTP status, translates `shion-biz.<NAME>` through i18n, writes the envelope |

`Kind` → status: InvalidArgument 400, Unauthenticated 401, PermissionDenied 403, NotFound 404, Conflict 409, Gone 410, PayloadTooLarge 413, UnsupportedMediaType 415, Unprocessable 422, RateLimited 429, Internal 500, NotImplemented 501, UpstreamFailed 502, Unavailable 503.

## Rules

- Define codes in `<capability>/errors.go`: `ErrX = apperror.Define(4601xx, "FAVORITE_X", apperror.KindConflict)`.
- Codes are six digits `DDDSNN`; the first three digits are a range owned by one package in `internal/apperror/ranges.go`. Add a range there before using it. `go run ./cmd/devtool bizcode check` rejects duplicates, unknown ranges and foreign owners.
- After adding codes run `go run ./cmd/devtool bizcode docs` and add messages for `shion-biz.<NAME>` in `internal/platform/i18n/locales/{zh,en,ja}/shion-biz.json`.
- Business code returns definitions or `*apperror.Error`; `errors.Is(err, favorite.ErrNotFound)` works for both.
- Adapters translate: `ent` not found → capability `ErrNotFound`; unique violation on a named constraint → `ErrAlreadyExists`-style error; FK violation → the missing parent's `ErrNotFound`. Use `postgres.IsNotFound`, `IsUniqueViolation(err, "<constraint>")`, `IsForeignKeyViolation`.
- Any error that is not an `apperror` becomes HTTP 500 with code 500 and message `common.error`; its text is logged, never returned.
- Transport-only failures use `errmap.WithStatus(status, cause)` (health checks); the client sees `code = status`, message `http.<status>`.
- Validation failures from Huma become `COMMON_VALIDATION_FAILED` (100101, HTTP 422) with `data.errors[{field, messages}]` localized from `validation.common.*`.
- Log once: the HTTP access log records `business_code` and, for 5xx, the error; job failures are logged by the job error handler. Services and repositories return errors and never log them.
- Never compare `err.Error()` strings.
