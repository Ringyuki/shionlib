# Add an endpoint

1. Add the service method (rules, errors, transaction) and its tests.
2. In `request.go` (or `request_<purpose>.go`): a `<action><Thing>Input` struct with `path`/`query`/`Body` fields and Huma validation tags.
3. In `response.go` (or `response_<purpose>.go`): a `<thing>DTO` with snake_case JSON and a `to<Thing>DTO` mapper.
4. In `handler.go`: `httpapi.Register(api, httpapi.Route{ID: "<capability>.<action>", Method, Path, Summary, Tags, Access, Throttle}, h.method)`; the method calls the service and returns `response.OK`/`response.Empty`/a page.
5. `handler_test.go`: success shape, auth/role failures, validation (422), each business error code.
6. Regenerate OpenAPI.
