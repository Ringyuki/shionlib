import * as v from 'valibot'
import { protocols } from '~/features/admin-ai'
import type { FormKit } from '~/shared/form/form-kit'
import { batchOperations, settableStatuses } from './admin-ai-route'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const changes = v.object({
  upstreamId: v.optional(v.string()),
  protocol: v.optional(v.picklist(protocols)),
  status: v.optional(v.picklist(settableStatuses)),
  priceManual: v.optional(v.boolean()),
  inputPrice: v.optional(v.number()),
  outputPrice: v.optional(v.number()),
})

export const routeCommand = v.variant('action', [
  v.object({ action: v.literal('check'), id }),
  v.object({ action: v.literal('update'), id, changes }),
  v.object({ action: v.literal('remove'), id }),
  v.object({
    action: v.literal('batch'),
    ids: v.pipe(v.array(id), v.minLength(1)),
    operation: v.picklist(batchOperations),
  }),
  v.object({ action: v.literal('revert'), id, adjustmentId: id }),
])

export type RouteChange = v.InferOutput<typeof routeCommand>

export function routeForm(kit: FormKit) {
  return v.object({
    upstreamId: kit.text('AiRouteUpdateInputBody', 'upstream_id'),
  })
}
