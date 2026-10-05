import * as v from 'valibot'
import { maxRecent, normalizeQuery } from './search'

export const recordSearchCommand = v.object({ query: v.string() })

export type RecordSearch = v.InferOutput<typeof recordSearchCommand>

const recentSearches = v.fallback(
  v.pipe(v.string(), v.parseJson(), v.array(v.fallback(v.string(), ''))),
  [],
)

const page = v.fallback(v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1)), 1)

export function parseRecent(stored: string | null): string[] {
  return v
    .parse(recentSearches, stored)
    .map(entry => normalizeQuery(entry))
    .filter(entry => entry !== '')
    .slice(0, maxRecent)
}

export function pageParam(raw: string | null): number {
  return v.parse(page, raw)
}
