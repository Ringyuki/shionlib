import * as v from 'valibot'

export function parseOptional<Schema extends v.GenericSchema>(
  schema: Schema,
  value: unknown,
): v.InferOutput<Schema> | undefined {
  const parsed = v.safeParse(schema, value)
  return parsed.success ? parsed.output : undefined
}

export function firstIssueMessage(schema: v.GenericSchema, value: unknown): string | undefined {
  const parsed = v.safeParse(schema, value)
  return parsed.success ? undefined : parsed.issues[0].message
}
