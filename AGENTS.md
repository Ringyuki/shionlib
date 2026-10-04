# Shionlib repository rules

Mandatory context for every coding turn in this repository.

## Layout

- `apps/api` — Go backend (the rewrite). Rules: `.claude/skills/go-backend/SKILL.md`. Human docs: `apps/api/docs/`.
- `apps/backend` — legacy NestJS backend; read-only reference for behavior while modules are ported.
- `apps/web` — the new web client (React Router framework mode, `@hina-ui/react`). Rules: `.claude/skills/web-frontend/SKILL.md`.
- `apps/frontend` — legacy Next.js client, replaced by a rewrite in `apps/web`. Not a template for code, UI or texts; only a checklist of features and of public URLs that must keep working.
- `apps/og`, `apps/download-worker` — edge services; their contracts with the backend are listed in `apps/api/docs/migration.md`.

## Hard rules

- All work for the rewrite happens on branch `major/shionlib-next`.
- Source code is comment-free. Express intent through names and tests; only compiler directives (`//go:`) are allowed.
- Go backend: load the `go-backend` skill before touching `apps/api`, follow the golden path in `apps/api/internal/favorite`, and run `.claude/skills/go-backend/scripts/verify.sh` before finishing.
- Web client: load the `web-frontend` skill before touching `apps/web`, follow the golden path in `apps/web/app/features/favorite`, and run `.claude/skills/web-frontend/scripts/verify.sh` before finishing. API types are generated from `apps/api/openapi/openapi.json`; never write them by hand.
- Commit messages are English, imperative, scoped (`feat(api): …`, `feat(web): …`).
- Never hand-edit generated files: `apps/api/internal/adapter/postgres/ent/**` (except `schema/`), `apps/api/docs/business-codes.md`, `apps/api/openapi/openapi.json`, `apps/web/app/shared/api/generated/**`.
