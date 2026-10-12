import * as v from 'valibot'
import {
  bangumiOutcomes,
  entities,
  maxQueryLength,
  type BangumiOutcome,
  type Lookup,
} from './admin-catalog'

const entity = v.fallback(v.picklist(entities), 'game')

const text = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

export function lookupFrom(search: URLSearchParams): Lookup {
  return {
    source: v.parse(text, search.get('source') ?? ''),
    entity: v.parse(entity, search.get('entity')),
    query: v.parse(text, search.get('q') ?? ''),
  }
}

export function outcomeFrom(raw: string | null): BangumiOutcome | undefined {
  const parsed = v.safeParse(v.picklist(bangumiOutcomes), raw)
  return parsed.success ? parsed.output : undefined
}

export const catalogCommand = v.variant('action', [
  v.object({ action: v.literal('sync'), source: v.pipe(v.string(), v.nonEmpty()) }),
  v.object({
    action: v.literal('import'),
    source: v.pipe(v.string(), v.nonEmpty()),
    entity: v.picklist(entities),
    externalId: v.pipe(v.string(), v.nonEmpty()),
  }),
])

export type CatalogChange = v.InferOutput<typeof catalogCommand>
