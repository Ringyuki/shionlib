import * as v from 'valibot'
import { errorKinds, rangeFrom } from '~/features/admin-ai'
import { results, sources, type Filter } from './admin-ai-request'

const optionalId = v.fallback(
  v.optional(v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))),
  undefined,
)

const source = v.fallback(v.optional(v.picklist(sources)), undefined)

const result = v.fallback(v.optional(v.picklist(results)), undefined)

const errorKind = v.fallback(v.optional(v.picklist(errorKinds)), undefined)

const sceneKey = v.fallback(v.optional(v.pipe(v.string(), v.maxLength(100))), undefined)

const requestId = v.fallback(v.optional(v.pipe(v.string(), v.digits(), v.maxLength(20))), undefined)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  const read = (key: string) => search.get(key) ?? undefined
  return {
    range: rangeFrom(search.get('range')),
    source: v.parse(source, read('source')),
    scene: v.parse(sceneKey, read('scene')),
    modelId: v.parse(optionalId, read('model')),
    providerId: v.parse(optionalId, read('provider')),
    result: v.parse(result, read('result')),
    errorKind: v.parse(errorKind, read('error')),
    page,
    opened: v.parse(requestId, read('id')),
  }
}

const json = v.pipe(v.string(), v.parseJson())

export function prettyJson(text: string): string {
  const parsed = v.safeParse(json, text)
  return parsed.success ? JSON.stringify(parsed.output, null, 2) : text
}
