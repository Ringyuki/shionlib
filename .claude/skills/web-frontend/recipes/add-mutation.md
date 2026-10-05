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
5. Hook `use-<purpose>.ts`: `useFetcher<typeof <thing>Action>()`, submit a `<Thing>` with `encType: 'application/json'` to `href('/resources/<name>')`, derive optimistic state from `parseOptional(<thing>Command, fetcher.json)`, expose `failure` from `fetcher.data`.
6. Component calls the hook; show `failure.message` (already localized) in an `<Alert open>` or, for a form, through `useSubmissionFeedback` (`recipes/add-form.md`).
