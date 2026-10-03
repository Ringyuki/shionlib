# Review checklist

- Does any package import against the dependency direction (archtest, depguard)?
- Was an interface added without a consumer that needs substitution or a boundary?
- Do framework, ORM, driver or vendor types leak into business code or DTOs?
- Do responses use `response.*` and errors flow through `errmap`, with no ad-hoc envelopes?
- Is any error logged and also returned, or logged twice?
- Can internal error details reach the client?
- Is `context.Context` propagated, with no `context.Background()` in request paths?
- Does every goroutine have an owner, a stop condition and error handling?
- Is the transaction boundary in the service, and do adapters use `postgres.Client(ctx, …)`?
- Are config, logger, cache, HTTP clients and rate limits used through the platform packages?
- Does a new dependency pass the dependency policy (`docs/adr/0001`)?
- Are there tests for every business rule, error code and authorization path touched?
- Does the change duplicate an existing abstraction or capability?
- Are generated files (ent, business codes, OpenAPI, migrations) regenerated and committed?
