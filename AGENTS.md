# Shionlib repository rules

Mandatory context for every coding turn in this repository.

## Layout

- `apps/api` — Go backend (the rewrite). Rules: `.claude/skills/go-backend/SKILL.md`. Human docs: `apps/api/docs/`.
- `apps/backend` — legacy NestJS backend; read-only reference for behavior while modules are ported.
- `apps/web` — the new web client (React Router framework mode, `@hina-ui/react`). Rules: `.claude/skills/web-frontend/SKILL.md`.
- `apps/frontend` — legacy Next.js client, replaced by a rewrite in `apps/web`. Not a template for code, UI or texts; only a checklist of features and of public URLs that must keep working.
- `apps/og`, `apps/download-worker` — edge services. `apps/og` draws the share images the web's page heads point at (game, resource, walkthrough, character, developer, translator, user, docs, default), reading public data from the API at `BACKEND_INTERNAL_URL` as a guest; `apps/download-worker` opens the download tickets the API seals, with the secret both share (`FILE_DOWNLOAD_TICKET_SECRET` on the API, `TICKET_SECRET` on the worker).

## Hard rules

- All work for the rewrite happens on branch `major/shionlib-next`.
- `dev` is the staging branch: pushing `major/shionlib-next` to it builds the API and web images and deploys them to `https://staging.shionlib.com` (`.github/workflows/staging.yml`). Nothing is committed on `dev` directly.
- Source code is comment-free. Express intent through names and tests; only compiler directives (`//go:`) are allowed.
- Go backend: load the `go-backend` skill before touching `apps/api`, follow the golden path in `apps/api/internal/favorite`, and check the work before finishing: `.claude/skills/go-backend/scripts/check.sh` for a small change, `verify.sh` when a phase ends or when the schema, the contract, the dependencies or generated code changed.
- Web client: load the `web-frontend` skill before touching `apps/web`, follow the golden path in `apps/web/app/features/favorite`, and check the work before finishing: `.claude/skills/web-frontend/scripts/check.sh` for a small change, `verify.sh` when a phase ends or when the API contract changed. API types are generated from `apps/api/openapi/openapi.json`; never write them by hand.
- Commit messages are English, imperative, scoped (`feat(api): …`, `feat(web): …`).
- Never hand-edit generated files: `apps/api/internal/adapter/postgres/ent/**` (except `schema/`), `apps/api/docs/business-codes.md`, `apps/api/openapi/openapi.json`, `apps/web/app/shared/api/generated/**`, `apps/api/internal/inspection/name_characters.txt` (the characters of catalog titles by frequency, which the file name encoding detection weighs; `apps/api/scripts/name-characters.sh` writes it).
