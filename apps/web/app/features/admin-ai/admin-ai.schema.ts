import * as v from 'valibot'
import { defaultRange, ranges, type Range } from './admin-ai'

const range = v.fallback(v.picklist(ranges), defaultRange)

export function rangeFrom(value: string | null): Range {
  return v.parse(range, value)
}

const optionalNumber = v.nullable(v.number())

export const sceneCommand = v.object({
  key: v.string(),
  modelId: v.nullable(v.pipe(v.number(), v.safeInteger(), v.minValue(1))),
  temperature: optionalNumber,
  maxOutputTokens: optionalNumber,
  timeoutSeconds: optionalNumber,
})

export type SceneSave = v.InferOutput<typeof sceneCommand>
