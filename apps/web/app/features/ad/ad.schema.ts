import * as v from 'valibot'
import { slots, type Slot } from './ad'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const slot = v.picklist(slots)

export const viewsCommand = v.object({ views: v.array(v.object({ ad_id: id, slot })) })

const slotParam = v.fallback(v.optional(slot), undefined)

export function slotFrom(search: URLSearchParams): Slot | undefined {
  return v.parse(slotParam, search.get('slot') ?? undefined)
}
