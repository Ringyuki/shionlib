import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'
import {
  defaultRange,
  defaultSort,
  maxQueryLength,
  openedKey,
  ranges,
  sorts,
  statuses,
  type Filter,
} from './admin-open'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const idText = v.fallback(
  v.optional(v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))),
  undefined,
)

const status = v.fallback(v.optional(v.picklist(statuses)), undefined)

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

const sort = v.fallback(v.picklist(sorts), defaultSort)

const range = v.fallback(v.picklist(ranges), defaultRange)

export function filterFrom(search: URLSearchParams, page: number): Filter {
  return {
    status: v.parse(status, search.get('status') ?? undefined),
    query: v.parse(query, search.get('q') ?? ''),
    user: v.parse(idText, search.get('user') ?? undefined),
    sort: v.parse(sort, search.get('sort') ?? defaultSort),
    days: v.parse(range, search.get('days') ?? defaultRange),
    key: v.parse(idText, search.get(openedKey) ?? undefined),
    page,
  }
}

export const openCommand = v.variant('action', [
  v.object({ action: v.literal('suspend'), id, reason: v.string() }),
  v.object({ action: v.literal('restore'), id }),
  v.object({
    action: v.literal('limit'),
    userId: id,
    limit: v.nullable(v.pipe(v.number(), v.safeInteger())),
  }),
])

export type OpenChange = v.InferOutput<typeof openCommand>

export function suspendForm(kit: FormKit) {
  return v.object({ reason: kit.text('SuspendKeyInputBody', 'reason') })
}

export type SuspendValues = v.InferInput<ReturnType<typeof suspendForm>>

export type LimitValues = { own: boolean; limit: number | null }

export function limitForm(required: string) {
  return v.pipe(
    v.object({ own: v.boolean(), limit: v.nullable(v.number()) }),
    v.forward(
      v.check(values => !values.own || values.limit !== null, required),
      ['limit'],
    ),
  )
}
