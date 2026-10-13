import { protocols, type Protocol } from '~/features/admin-ai'
import type { Schema } from '~/shared/api/types'

export type Route = Schema<'AiRouteDTO'>

export type Adjustment = Schema<'AiAdjustmentDTO'>

export type CheckResult = Schema<'AiCheckDTO'>

export const batchOperations = ['enable', 'disable', 'delete'] as const

export type BatchOperation = (typeof batchOperations)[number]

export const settableStatuses = ['active', 'disabled'] as const

export function protocolsFor(
  offered: readonly string[] | null | undefined,
  moderation: boolean,
): Protocol[] {
  return protocols.filter(
    protocol => (offered ?? []).includes(protocol) && (protocol === 'moderation') === moderation,
  )
}

export type RouteDraft = {
  upstreamId: string
  protocol: Protocol
  enabled: boolean
  priceManual: boolean
  inputPrice: number | null
  outputPrice: number | null
}

export function draftOf(route: Route): RouteDraft {
  return {
    upstreamId: route.upstream_id,
    protocol: route.protocol,
    enabled: route.status !== 'disabled',
    priceManual: route.price_manual,
    inputPrice: route.input_price,
    outputPrice: route.output_price,
  }
}

export type RouteChanges = {
  upstreamId?: string
  protocol?: Protocol
  status?: (typeof settableStatuses)[number]
  priceManual?: boolean
  inputPrice?: number
  outputPrice?: number
}

export function changesOf(route: Route, draft: RouteDraft): RouteChanges {
  const before = draftOf(route)
  const upstreamId = draft.upstreamId.trim()
  const priced = draft.priceManual
  return {
    ...(upstreamId === before.upstreamId ? {} : { upstreamId }),
    ...(draft.protocol === before.protocol ? {} : { protocol: draft.protocol }),
    ...(draft.enabled === before.enabled
      ? {}
      : { status: draft.enabled ? ('active' as const) : ('disabled' as const) }),
    ...(draft.priceManual === before.priceManual ? {} : { priceManual: draft.priceManual }),
    ...(priced && draft.inputPrice !== null && draft.inputPrice !== route.input_price
      ? { inputPrice: draft.inputPrice }
      : {}),
    ...(priced && draft.outputPrice !== null && draft.outputPrice !== route.output_price
      ? { outputPrice: draft.outputPrice }
      : {}),
  }
}

export function unchanged(changes: RouteChanges): boolean {
  return Object.keys(changes).length === 0
}

export function routeName(route: Pick<Route, 'model' | 'provider'>): string {
  return `${route.model.name} · ${route.provider.name}`
}
