import * as v from 'valibot'

const wrapped = v.looseObject({ type: v.literal('DataWithResponseInit'), data: v.unknown() })

export function unwrapped(error: unknown): unknown {
  const parsed = v.safeParse(wrapped, error)
  return parsed.success ? parsed.output.data : error
}
