## Contributing Guide

### Overview

Thank you for considering contributing to this project! This guide explains how to set up your environment, follow coding standards, and open high‑quality pull requests.

### Prerequisites

- Node.js 20+ (recommended)
- PNPM 10+ (project uses `pnpm` as the package manager)
- Git

### Getting Started

1. Fork the repository and clone your fork:
   - `git clone <your-fork-url>`
   - `cd shionlib-frontend`
2. Install dependencies:
   - `pnpm install`
3. Run the app:
   - Dev: `pnpm dev`
   - Typecheck: `pnpm typecheck`
   - Lint: `pnpm lint` (auto-fix: `pnpm lint:fix`)
   - Format: `pnpm format` (check: `pnpm format:check`)
   - Build: `pnpm build`
   - Start: `pnpm start`

### Branching Model

- Do not commit directly to `main`.
- Use short, descriptive branches:
  - Features: `feat/<scope>-<short-description>`
  - Fixes: `fix/<scope>-<short-description>`
  - Docs: `docs/<area>-<short-description>`
  - Chores: `chore/<area>-<short-description>`

### Commit Messages

Use Conventional Commits:

- `feat: add game upload wizard`
- `fix(download): handle 404 error`
- `docs: update developer overview`
- `chore: bump dependencies`
- `refactor(editor): simplify lexical nodes`

Keep commits small and focused. Write in imperative mood.

### Code Style & Quality

- Language: TypeScript (strict). Prefer explicit types for public APIs; avoid `any`.
- Framework: Next.js 16 (App Router), React 19.
- UI: Tailwind CSS 4, Radix UI, DaisyUI. Prefer shared components under `components/shionui`.
- Accessibility: Use semantic elements and ARIA where appropriate.
- Linting/Formatting: ESLint 9 + Prettier 3 are enforced. Run `pnpm lint` and `pnpm format` before committing.
- Husky + lint-staged will auto-run checks on staged files.

### Project Conventions

- Styling: Use Tailwind utility classes; keep design tokens via CSS variables consistent.
- State: Prefer `zustand` for global state; avoid prop drilling when a store is appropriate.
- Forms: Use `react-hook-form` with `zod` schemas for validation.
- i18n: Use `next-intl`; add strings in `messages/*.json` for all supported locales. Keep keys consistent.
- Content: MDX content in `contents/<locale>/**`. Preserve frontmatter and headings structure.
- Editor: Lexical editor code is in `components/editor/**`—follow existing node/plugin patterns.
- API calls: Use existing request utils in `utils/request` when applicable.

### Pull Request Process

1. Sync with `main` and rebase your branch if needed.
2. Ensure:
   - `pnpm typecheck` passes
   - `pnpm lint` passes (or `pnpm lint:fix`)
   - `pnpm format:check` passes
   - App runs locally (`pnpm dev`) without obvious errors
3. Open a PR with:
   - Clear title using Conventional Commit style
   - Description of what/why/how, any breaking changes, and migration notes if any
   - Screenshots/GIFs for UI changes
   - Related issue links (e.g., “Closes #123”)
4. Keep PRs focused and under ~300 lines of effective changes when possible.

### Reporting Issues

Include:

- Environment (OS, Browser/Version, Node version)
- Steps to reproduce (minimal)
- Expected vs actual behavior
- Screenshots/logs if relevant
- Proposed fix (optional)

### Security

Do not disclose vulnerabilities publicly. Report security issues privately to the maintainers.

### Releases & Deployment

- Maintainers build with Turbopack and deploy using Next.js standalone output.
- PM2 config: `ecosystem.config.cjs`. Environment variables come from `.env`.

### License & Conduct

- By contributing, you agree your contributions will be licensed under the project’s license.
- Be respectful. Follow a professional, inclusive, and constructive tone.

### Questions?

Open a Discussion/Issue or ping maintainers in the PR.
