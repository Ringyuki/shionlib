# ADR 0010: An AI gateway configured from the admin panel

## Context
Content moderation called OpenAI directly with one key, one base URL and two model names from environment variables. Changing a model, adding a fallback provider or seeing what moderation costs needed a redeploy and log digging. Hikarinagi solved the same problem with an AI gateway (providers, models, routes, scenes, request log, health checks) configured from its admin panel, and Shionlib should be operable the same way without depending on Hikarinagi at runtime.

## Decision
Add the capability `internal/ai`, modelled on the Hikarinagi gateway:

- **Providers** hold a kind (`compatible`, `openai`, `anthropic`, `google`), an optional base URL, an API key and a price multiplier. Keys are stored as entered, like Hikarinagi does; the API only ever returns a key hint.
- **Models** are the site's names for a model with capabilities (vision, moderation, temperature, reasoning, limits), optionally linked to a [models.dev](https://models.dev) catalog entry that keeps prices and capabilities current (`ai_sync_catalog`, hourly when stale).
- **Routes** connect a model to a provider: upstream model id, protocol (`chat`, `responses`, `messages`, `gemini`, `moderation`), price, priority and status.
- **Scenes** are the call sites declared in code (`moderation_screen`, `moderation_review`); each points at a model or follows the default model, with temperature, output-token and idle-timeout overrides.
- At call time `ai.Service` resolves the scene to the model's active routes and tries them in priority order. Routes that failed three times in a row are tried last for a minute. Protocol, parameter and structured-output errors on a route are adapted automatically (switch protocol on compatible providers, drop the rejected parameter, fall back to JSON mode) and the adaptation is saved on the route with an undoable adjustment record. Authentication, quota and unknown-model errors suspend the route; `ai_probe_suspended_routes` re-checks suspended routes every ten minutes and super admins get a system message on suspension and recovery. Malformed or truncated output fails the call without trying other routes.
- Every attempt is recorded in `ai_requests` (tokens, cost in USD from the route price, first-token latency, failure kind) with its prompt and output in `ai_request_payloads`; requests are kept `AI_REQUEST_RETENTION_DAYS`, payloads `AI_PAYLOAD_RETENTION_DAYS`.
- Protocols are implemented in `internal/adapter/llm` with streamed responses (idle timeout `AI_IDLE_TIMEOUT` between chunks, total bound `AI_MAX_CALL_DURATION`), and upstream errors are classified into `ai.ErrorKind` there.
- The admin API lives under `/admin/ai/*`: reads for admins, changes, discovery, checks and the playground for super admins.
- Moderation uses the gateway through `internal/adapter/aimoderation`. An unconfigured scene keeps the old behaviour of an empty `OPENAI_API_KEY`: content is approved without review.

Hikarinagi features without a Shionlib use are left out: user AI credits, tool calling and the TypeSafe decision protocol.

## Alternatives
Keep the environment variables (no fallback, no visibility, redeploy per change); call Hikarinagi's gateway over the network (the internal coupling this rewrite removes); adopt an external gateway such as LiteLLM or OpenRouter (another service to run and pay for, and moderation would still need provider-specific handling); use vendor SDKs (four SDKs with different streaming models instead of four small HTTP clients).

## Consequences
New tables `ai_*`, four scheduled tasks and one queued job kind. Provider keys are readable by anyone who can read the database or its backups (the `pg_dump` backups are not encrypted either); encryption at rest is a separate, later decision that should cover backups as a whole. The gateway does not retry a route by itself: availability comes from failover across routes and from the caller's job retries, so retries have one owner. In-memory cooldowns are per process. Prompts are stored for `AI_PAYLOAD_RETENTION_DAYS` (seven by default) and contain user content under moderation; `AI_RECORD_PAYLOADS=false` turns this off.

## Migration
`OPENAI_*` variables are removed. After deploying, a super admin creates a provider, adds the moderation model (`omni-moderation-latest`) and a review model, and assigns them to `moderation_screen` and `moderation_review`. Until then moderation approves content directly, exactly as it did with an empty key.
