# Call an external service

1. Define the port in the consuming business package with business types (`type MailSender interface { Send(ctx, Message) error }`).
2. Implement it in `internal/adapter/<vendor>` as a type named for its role (`Client`, `Sender`, `Verifier`) with an injected `*http.Client` from `platform/httpclient` and an `Options` struct for configuration. Request and response payloads are unexported structs in the adapter.
3. Map vendor failures to business errors (`KindUpstreamFailed` codes) and wrap the cause; never return vendor payloads to callers.
4. Retry only idempotent calls, in the adapter, with a bounded attempt count and backoff.
5. Test with `httptest.Server` covering success, 4xx, 5xx, timeouts and malformed bodies.
6. When the vendor is one of several that could fill the same port (a payment provider, ADR 0015), nothing outside its adapter may know which vendor it is:
   - the port speaks in business terms only (`sponsor.Provider`, `sponsor.PaymentMethod{ID, Name, Brand, Fee}`); the vendor's codes, field names and callback payloads are translated inside the adapter, including which record a callback is about;
   - the adapter exports its `Name` and declares its own settings in its `settings.go` (credentials are settings read on every call, never environment variables), so the composition root passes it `shared.Settings` instead of an `Options` struct;
   - routes and stored rows carry the adapter's name as data (`/sponsor/webhook/{provider}`, `sponsor_orders.provider`), never as a literal or a schema default;
   - list the vendor in `sealedVendors` in `internal/archtest/vendor_test.go`, which fails when its name appears in any Go file outside the adapter, `internal/bootstrap` and `cmd/devtool`.
