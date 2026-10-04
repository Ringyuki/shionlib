# Add a mutation without navigation

1. Model: a camelCase command type and `parse<Command>(value: unknown): Command | undefined` in `<name>.ts`, with tests.
2. Use-case: `async function <verb>(api: ApiClient, command: Command)` that maps the command to API calls (`body` is checked against the contract).
3. Server handler in `<name>.server.ts`:

```ts
export async function <thing>Action(args: ActionFunctionArgs) {
  const command = parse<Command>(await args.request.json().catch(() => undefined))
  if (command === undefined) {
    throw data(null, { status: 400 })
  }
  return routeAction(args, api => <verb>(api, command))
}
```

4. Resource route `app/routes/resources.<name>.ts` re-exporting it as `action` (and a `loader` if the hook loads data), registered in `app/routes.ts` as `resources/<name>`.
5. Hook `use-<purpose>.ts`: `useFetcher<typeof <thing>Action>()`, submit with `encType: 'application/json'` to `href('/resources/<name>')`, derive optimistic state from `parse<Command>(fetcher.json)`, expose `failure` from `fetcher.data`.
6. Component calls the hook; show `failure.message` (already localized) next to the control.
