import * as v from 'valibot'
import { defaultSort, maxQueryLength, sorts, statuses, type Filter } from './admin-game'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

const status = v.fallback(
  v.optional(v.pipe(v.string(), v.toNumber(), v.picklist(statuses))),
  undefined,
)

const sort = v.fallback(v.picklist(sorts), defaultSort)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    query: v.parse(query, search.get('q') ?? ''),
    status: v.parse(status, search.get('status') ?? undefined),
    sort: v.parse(sort, search.get('sort') ?? defaultSort),
    page,
  }
}

export const gameCommand = v.variant('action', [
  v.object({ action: v.literal('status'), id, status: v.picklist(statuses) }),
  v.object({ action: v.literal('recent'), id, marked: v.boolean() }),
  v.object({ action: v.literal('refresh'), id, source: v.string(), externalId: v.string() }),
  v.object({ action: v.literal('remove'), id }),
])

export type GameChange = v.InferOutput<typeof gameCommand>
