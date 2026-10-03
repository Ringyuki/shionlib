# ADR 0005: Preserve the legacy HTTP contract

## Context
The web client, desktop protocol handoffs, the OG image service and the download worker depend on the backend's paths, envelope, codes and cookies. The new client is being built in parallel.

## Decision
Keep paths, the `{code, message, data, requestId, timestamp, meta}` envelope, business codes and HTTP statuses, cookie names and attributes, and the stale-token signal. Deviations are allowed only for security, correctness or deliberate product changes and are listed in `docs/migration.md`.

## Consequences
The existing Playwright suite can verify the Go backend before the new client ships. Some legacy naming (camelCase meta) persists.
