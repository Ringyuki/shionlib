import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import { targetKinds } from './admin-ai-playground'

const outline = v.pipe(
  v.string(),
  v.parseJson(),
  v.custom<Record<string, unknown>>(
    parsed => typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed),
  ),
)

export function outlineFrom(text: string): Record<string, unknown> | undefined {
  const parsed = v.safeParse(outline, text)
  return parsed.success ? parsed.output : undefined
}

export const playgroundCommand = v.object({
  target: v.object({ kind: v.picklist(targetKinds), id: v.string() }),
  messages: v.pipe(
    v.array(v.object({ role: v.picklist(['user', 'assistant']), content: v.string() })),
    v.minLength(1),
  ),
  system: v.string(),
  temperature: v.nullable(v.number()),
  maxOutputTokens: v.nullable(v.number()),
  schema: v.nullable(v.string()),
})

export type PlaygroundRun = v.InferOutput<typeof playgroundCommand>

export type PlaygroundIssue = 'schema'

export function paramsForm(kit: FormKit, issue: (kind: PlaygroundIssue) => string) {
  return v.pipe(
    v.object({
      system: kit.text('AiPlaygroundInputBody', 'system'),
      structured: v.boolean(),
      schema: v.string(),
    }),
    v.forward(
      v.check(
        params => !params.structured || outlineFrom(params.schema) !== undefined,
        issue('schema'),
      ),
      ['schema'],
    ),
  )
}
