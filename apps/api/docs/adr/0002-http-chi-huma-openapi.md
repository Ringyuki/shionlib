# ADR 0002: HTTP with chi and Huma; OpenAPI generated from code

## Context
The web client hand-maintains types for ~160 endpoints. The rewrite needs one contract shared by the backend and the new client.

## Decision
chi routes requests; Huma v2 declares operations from typed Go inputs/outputs, validates them, and produces OpenAPI 3.1 (`openapi/openapi.json`, regenerated in CI). Huma's error hooks are installed once by `errmap.Mapper.Install` so every error uses the Shionlib envelope. `httpapi.Register` adds access control, rate limiting, default statuses and path-binding checks.

## Alternatives
Echo/Gin with comment annotations (rejected: comments are not allowed and annotations drift); ogen spec-first (rejected: hand-writing ~190 operations in YAML up front).

## Consequences
Request decoding uses reflection precomputed at registration. Schema names must be unique; a test enforces stable names and operation ids.

## Migration
Paths and payloads follow the legacy contract; the new client generates its types from the OpenAPI document.
