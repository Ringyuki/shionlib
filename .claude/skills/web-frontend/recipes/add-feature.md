# Add a feature

Golden path: `app/features/favorite` (model, use-cases, server handlers, hooks, UI, messages, tests).

1. Create `app/features/<name>/` with `index.ts` and `messages/{zh,en,ja}.json`; register the messages in `app/messages/{zh,en,ja}.ts` under `<name>`.
2. Model (`<name>.ts`): alias or `Pick` the generated types you need (`Schema<'XDTO'>`), add pure rules, and parsers for UI commands the feature submits. Test it in `<name>.test.ts`.
3. Use-cases (`<name>.use-cases.ts`): one exported async function per thing the UI needs, taking `api: ApiClient` first. Translate expected failures (`error.status === 401`, `error.is('X_NOT_FOUND')`) into results; let the rest throw. Test with `fakeApi()` in `<name>.use-cases.test.ts`, including failure paths.
4. If several pages need the same mutation or lazy load, add `<name>.server.ts` with `<thing>Loader`/`<thing>Action` built on `routeLazyLoader`/`routeAction`, and a resource route (`recipes/add-mutation.md`).
5. Hooks (`use-<purpose>.ts`) wrap `useCommand` / `useLazyLoad` and expose values and callbacks; components (`ui/*.tsx`) use hina-ui and `useTranslations('<name>')`.
6. Export the public surface from `index.ts` (never the server file).
7. Run `.claude/skills/web-frontend/scripts/verify.sh`.
