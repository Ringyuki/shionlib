import { data } from 'react-router'
import * as v from 'valibot'

const id = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

export function idParam(value: string | undefined): number {
  const parsed = v.safeParse(id, value)
  if (!parsed.success) {
    throw data(null, { status: 404 })
  }
  return parsed.output
}
