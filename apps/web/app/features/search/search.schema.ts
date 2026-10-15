import * as v from 'valibot'
import { maxRecent, normalizeQuery } from './search'

export const recordSearchCommand = v.object({ query: v.string() })

export type RecordSearch = v.InferOutput<typeof recordSearchCommand>

export const imageSearchCommand = v.object({ image: v.instance(File) })

const recentSearches = v.fallback(
  v.pipe(v.string(), v.parseJson(), v.array(v.fallback(v.string(), ''))),
  [],
)

export function parseRecent(stored: string | null): string[] {
  return v
    .parse(recentSearches, stored)
    .map(entry => normalizeQuery(entry))
    .filter(entry => entry !== '')
    .slice(0, maxRecent)
}
