# Add a form

Read `references/forms.md` first.

1. **Contract**: find the request body the form ends in (`apps/api/openapi/openapi.json`, for example `RegisterUserInputBody`), and run `pnpm api:generate` if the API changed.
2. **Schemas** in `features/<name>/<name>.schema.ts`:
   - `<thing>Command`: `v.object({...})` with field types only. Add `type <Thing> = v.InferOutput<typeof <thing>Command>`.
   - `<thing>Form(kit, issue?)`: one `kit.text('<Body>', '<field>')` per API field. Write UI-only rules (`v.value(true, issue('adult'))`, `v.forward(v.partialCheck(...))`) with the feature's `issue` messages. Add `type <Thing>Values = v.InferInput<ReturnType<typeof <thing>Form>>`.
   - Tests use `createFormKit(issue => issue.kind)`.
3. **Messages**: UI-only rules get keys under `<name>.issue` in `messages/{zh,en,ja}.json`. Generic messages already exist in `app/messages/form`. Hints with limits take `lengthOf(...)` values instead of numbers.
4. **Use-case** in `<name>.use-cases.ts`: maps the command to the API body. Trimming and renaming fields happen here.
5. **Server handler** in `<name>.server.ts`: `const command = await readCommand(args, <thing>Command)`, then `routeAction(args, api => <verb>(api, command))`. Re-export it from `app/routes/resources.<name>.<thing>.ts`, or from the page's route module for a page action.
6. **Hook** `use-<thing>.ts`: `useFetcher<typeof <thing>Action>()`. Its `submit(command: <Thing>)` returns `fetcher.submit(...)`, and it exposes `failure`.
7. **Component**:
   - `useFormKit()`, the feature's `useTranslations('<name>.issue')` when there are UI rules, and `useSubmissionFeedback(failure)`;
   - `<Form ref={form} values={values} rules={<thing>Form(kit, issue)} onSubmit={() => submit(values)}>`;
   - `FormField name` equal to the schema key;
   - `<Alert tone="danger" open={message !== undefined}>` for failures without fields.
