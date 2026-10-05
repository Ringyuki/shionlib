# Forms and validation

All validation in `apps/web` uses **valibot**. hina-ui `Form` accepts any Standard Schema as `rules`, and valibot schemas are Standard Schemas. Do not hand-write `typeof`, `Array.isArray`, `JSON.parse`, `Number(...)` or regex checks of input. A guard over a value that comes from outside the module is a schema. Outside input includes request bodies, URL params, cookies, `localStorage`, `history.state`, browser API results and API error bodies.

## Where schemas live

| Kind           | Name                                                                                               | File                                                                                              | Purpose                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Command schema | `<thing>Command`                                                                                   | `features/<name>/<name>.schema.ts`                                                                | Shape of the JSON a fetcher sends to a resource route or page action. Shape only (types, presence), no business limits. |
| Form schema    | `<thing>Form(kit, issue?)`                                                                         | same file                                                                                         | What a person typed: the API's declared constraints plus UI-only rules. Passed to `<Form rules>`.                       |
| Input guard    | `is<Thing>`, `<thing>From`, `parse<Thing>`                                                         | the nearest `*.schema.ts` (`features/<name>/<name>.schema.ts`, `shared/<area>/<topic>.schema.ts`) | Parses cookies, URL params, storage and browser data.                                                                   |
| Types          | `type X = v.InferOutput<typeof xCommand>`, `type XValues = v.InferInput<ReturnType<typeof xForm>>` | same file                                                                                         | Hooks, use-cases and components use these types. They never redeclare the shape.                                        |

- **Model files** (`<name>.ts`) keep constants, derived types and pure rules, but no validation.
- **Where valibot may be imported**: only `*.schema.ts`, `~/shared/form` (the form platform) and `~/shared/route` (`readCommand`, `idParam`). ESLint enforces this, and also bans zod, yup, joi, ajv, superstruct, io-ts and arktype everywhere.
- **Cycles**: a schema file may import its model's constants. A model never imports its schema.

## One source of truth for API constraints

`pnpm api:generate` writes `app/shared/api/generated/constraints.ts`. It holds every request body's fields with `required`, `minLength`, `maxLength`, `format`, `pattern`, `enum`, `minimum` and `maximum`, taken from `apps/api/openapi/openapi.json`.

- **Fields with API rules** are built with the form kit: `kit.text('RegisterUserInputBody', 'name')`. Never write the numbers or formats yourself. Hints that mention limits read them too: `t('nameHint', lengthOf('RegisterUserInputBody', 'name'))`.
- **Rules the API does not declare**:
  - Rules that exist only in the API's business logic (password policy, whether a code is right) are not repeated. The API answers 422 with field errors in the visitor's language, and `useSubmissionFeedback` puts them under the fields.
  - Rules that exist only in the UI (confirmation matches, age declaration ticked) are written in the form schema with the feature's own messages (`<name>.issue.<key>`).
- **Choices**: the options of an enum field (report reasons, platforms, languages) come from the same file: `constraints.CreateReportInputBody.reason.enum`, or `.itemEnum` and `.minItems` for arrays, read in the feature model (`reportReasons`, `platformOptions`, `leastPlatforms`). A model may change their display order, never their content.
- **Generic messages** (required, too short, too long, format, choice) live in `app/messages/form/{zh,en,ja}.json` (namespace `form`). They are produced by `useFormKit()`.

## Building a form

```tsx
const kit = useFormKit()
const issue = useTranslations('auth.issue')
const { submit, failure } = useSignUp(locale)
const { form, message } = useSubmissionFeedback(failure)

<Form ref={form} values={values} rules={signUpForm(kit, issue)} onSubmit={() => submit(values)}>
  <FormField name="name" label={t('name')} description={t('nameHint', lengthOf('RegisterUserInputBody', 'name'))} required>…</FormField>
  <Alert tone="danger" open={message !== undefined}>{message}</Alert>
</Form>
```

- **State and values**: `values` is component state typed with `<Thing>Values`, and the field names match the schema keys. hina reads `rules` through a getter, so building the schema during render is fine and needs no memo.
- **Submitting**: `onSubmit` returns the fetcher's `submit(...)` promise, so `submitting` covers the round trip. The hook submits a command typed with the command schema's type.
- **API failures**: `useSubmissionFeedback(failure)` writes the API's field errors (`failure.data.errors`) into the form. It returns the message for failures without fields, which you show in an `<Alert open>`. Never use a conditional `Alert`.
- **Checking one field outside a submit** (for example "send code"): `firstIssueMessage(codeRequestForm(kit), { email })`, then `form.current?.setErrors(...)`.

## Parsing commands on the server

```ts
export async function signInAction(args: ActionFunctionArgs) {
  const credentials = await readCommand(args, signInCommand)
  return routeAction(args, api => signIn(api, credentials))
}
```

`readCommand(args, schema)` parses the JSON body and throws a 400 response when it does not match.

## Reading other input

| Input                                                         | Helper                                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Path id                                                       | `idParam(params.id)` (`~/shared/route/params`), which throws 404                                                                           |
| Cookie                                                        | `readCookie(header, name)` (`~/shared/http/cookie`), then a guard from a `*.schema.ts` (`themeFrom`, `sidebarModeFrom`, `negotiateLocale`) |
| Query string, history state                                   | a `v.fallback(...)` schema in the feature's `*.schema.ts`, such as `pageParam`                                                             |
| `localStorage`                                                | `readLocal(key, guard)` / `writeLocal(key, value)` (`~/shared/storage/local-storage`) with a guard such as `parseRecent`                   |
| Unknown value on the client (`fetcher.json`, browser results) | `parseOptional(schema, value)` from `~/shared/form/check`                                                                                  |

## Tests

- Test schemas through the shared helpers (`parseOptional`, `firstIssueMessage`) with `createFormKit(issue => issue.kind)`, so assertions name the issue kind rather than translated text.
- Constraint handling itself is tested in `app/shared/form/form-kit.test.ts`.
