import * as v from 'valibot'
import { settable, statuses, type Filter } from './admin-sponsor'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const status = v.fallback(v.optional(v.picklist(statuses)), undefined)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return { status: v.parse(status, search.get('status') ?? undefined), page }
}

export const sponsorCommand = v.variant('action', [
  v.object({ action: v.literal('status'), id, status: v.picklist(settable) }),
  v.object({ action: v.literal('remove'), id }),
])

export type OrderChange = v.InferOutput<typeof sponsorCommand>
