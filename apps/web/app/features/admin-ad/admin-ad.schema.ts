import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import {
  defaultRange,
  imageKinds,
  languages,
  openedAd,
  ranges,
  slots,
  statuses,
  type Filter,
} from './admin-ad'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const idText = v.fallback(
  v.optional(v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))),
  undefined,
)

const status = v.fallback(v.optional(v.picklist(statuses)), undefined)

const slot = v.fallback(v.optional(v.picklist(slots)), undefined)

const range = v.fallback(v.picklist(ranges), defaultRange)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    status: v.parse(status, search.get('status') ?? undefined),
    slot: v.parse(slot, search.get('slot') ?? undefined),
    ad: v.parse(idText, search.get(openedAd) ?? undefined),
    days: v.parse(range, search.get('days') ?? defaultRange),
    page,
  }
}

const values = v.object({
  name: v.string(),
  link: v.string(),
  banner: v.nullable(v.string()),
  bannerAdult: v.boolean(),
  sideImage: v.nullable(v.string()),
  sideIcon: v.nullable(v.string()),
  sideAdult: v.boolean(),
  slots: v.array(v.picklist(slots)),
  languages: v.array(v.picklist(languages)),
  weight: v.pipe(v.number(), v.safeInteger()),
  enabled: v.boolean(),
  startAt: v.nullable(v.string()),
  endAt: v.nullable(v.string()),
})

export const adCommand = v.variant('action', [
  v.object({ action: v.literal('create'), values }),
  v.object({ action: v.literal('update'), id, values }),
  v.object({ action: v.literal('enabled'), id, enabled: v.boolean() }),
  v.object({ action: v.literal('remove'), id }),
])

export type AdChange = v.InferOutput<typeof adCommand>

export const imageCommand = v.object({ kind: v.picklist(imageKinds), image: v.instance(File) })

export function adForm(kit: FormKit) {
  return v.object({
    name: kit.text('AdDraftInput', 'name'),
    link: kit.text('AdDraftInput', 'link'),
  })
}
