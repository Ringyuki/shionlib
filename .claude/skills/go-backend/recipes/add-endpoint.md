# Add an endpoint

1. Add the service method (rules, errors, transaction) and its tests.
2. In `dto.go`: input struct with `path`/`query`/`Body` fields and Huma validation tags; output DTO with snake_case JSON.
3. In `handler.go`: `httpapi.Register(api, httpapi.Route{ID: "<capability>.<action>", Method, Path, Summary, Tags, Access, Throttle}, h.method)`; the method calls the service and returns `response.OK`/`response.Empty`.
4. `handler_test.go`: success shape, auth/role failures, validation (422), each business error code.
5. Regenerate OpenAPI.
