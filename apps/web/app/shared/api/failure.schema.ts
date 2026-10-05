import * as v from 'valibot'
import type { ApiFailure } from './types'

const failure = v.looseObject({
  code: v.pipe(v.number(), v.notValue(0)),
  message: v.string(),
})

export function isFailure(value: unknown): value is ApiFailure {
  return v.is(failure, value)
}
