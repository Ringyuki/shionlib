# ADR 0005: Preserve the legacy HTTP contract

## Context
The web client, desktop protocol handoffs, the OG image service and the download worker depend on the backend's paths, envelope, codes and cookies. The new client is being built in parallel.

## Decision
Keep paths, the `{code, message, data, requestId, timestamp, meta}` envelope, business codes and HTTP statuses, cookie names and attributes, and the stale-token signal. Deviations are allowed only for security, correctness or deliberate product changes and are listed in `docs/migration.md`.

## Alternatives
A versioned `/v2` API designed for the new client (two contracts to maintain during the transition, no way to run the legacy suite against the new backend); a translating proxy in front of a new contract (adds a hop and hides behaviour differences).

## Migration
Every module port records its deliberate differences in the "Intentional deviations" table of `docs/migration.md`. The legacy Playwright suite runs against the Go backend before traffic is switched. A new contract, if ever needed, gets its own ADR.
## Consequences
The existing Playwright suite can verify the Go backend before the new client ships. Some legacy naming (camelCase meta) persists.
