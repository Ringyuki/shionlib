# Call an external service

1. Define the port in the consuming business package with business types (`type MailSender interface { Send(ctx, Message) error }`).
2. Implement it in `internal/adapter/<vendor>` as a type named for its role (`Client`, `Sender`, `Verifier`) with an injected `*http.Client` from `platform/httpclient` and an `Options` struct for configuration. Request and response payloads are unexported structs in the adapter.
3. Map vendor failures to business errors (`KindUpstreamFailed` codes) and wrap the cause; never return vendor payloads to callers.
4. Retry only idempotent calls, in the adapter, with a bounded attempt count and backoff.
5. Test with `httptest.Server` covering success, 4xx, 5xx, timeouts and malformed bodies.
