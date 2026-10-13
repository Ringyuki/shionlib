# Add a mutation without navigation

1. Schema: `<thing>Command = v.object({...})` and `type <Thing> = v.InferOutput<typeof <thing>Command>` in `<name>.schema.ts`, with tests through `parseOptional` (`references/forms.md`).
2. Use-case: `async function <verb>(api: ApiClient, command: <Thing>)` that maps the command to API calls (`body` is checked against the contract).
3. Server handler in `<name>.server.ts`:

```ts
export async function <thing>Action(args: ActionFunctionArgs) {
  const command = await readCommand(args, <thing>Command)
  return routeAction(args, api => <verb>(api, command))
}
```

4. Resource route `app/routes/resources.<name>.ts` re-exporting it as `action` (and a `loader` if the hook loads data), registered in `app/routes.ts` as `resources/<name>`.
   A loader in a resource route answers with `routeLazyLoader`.
5. Hook `use-<purpose>.ts`: `const command = useCommand(useFetcher<typeof <thing>Action>(), href('/resources/<name>'))`; expose a typed `run: (change: <Thing>) => command.run(change)` and derive optimistic state from `parseOptional(<thing>Command, command.payload)`.
6. Component calls the hook and says what happens on success (`const outcome = await run(...)`, then `outcome.ok`). It shows nothing for a failure: the request tool does (`references/data.md`).
