import * as v from 'valibot'
import type { ApiFailure } from './types'

const failure = v.looseObject({
  code: v.pipe(v.number(), v.notValue(0)),
  message: v.string(),
})

export function isFailure(value: unknown): value is ApiFailure {
  return v.is(failure, value)
}

const seconds = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(0))

export function retryAfterFrom(header: string | null): number | undefined {
  const parsed = v.safeParse(seconds, header)
  return parsed.success ? parsed.output : undefined
}
