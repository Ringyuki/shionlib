import * as v from 'valibot'
import { protocols, providerKinds } from '~/features/admin-ai'
import type { FormKit } from '~/shared/form/form-kit'
import { maxQueryLength, providerStates, type Filter } from './admin-ai-provider'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

const state = v.fallback(v.optional(v.picklist(providerStates)), undefined)

export function filterFrom(search: URLSearchParams): Filter {
  return {
    query: v.parse(query, search.get('q') ?? ''),
    state: v.parse(state, search.get('state') ?? undefined),
  }
}

export function kindFrom(raw: string | null) {
  const parsed = v.safeParse(v.picklist(providerKinds), raw)
  return parsed.success ? parsed.output : undefined
}

export const providerCommand = v.variant('action', [
  v.object({
    action: v.literal('create'),
    presetId: v.nullable(v.string()),
    name: v.string(),
    kind: v.picklist(providerKinds),
    baseUrl: v.string(),
    apiKey: v.string(),
    priceMultiplier: v.nullable(v.number()),
  }),
  v.object({
    action: v.literal('update'),
    id,
    changes: v.object({
      name: v.optional(v.string()),
      baseUrl: v.optional(v.string()),
      apiKey: v.optional(v.string()),
      priceMultiplier: v.optional(v.number()),
      enabled: v.optional(v.boolean()),
    }),
  }),
  v.object({ action: v.literal('remove'), id }),
  v.object({ action: v.literal('discover'), id }),
  v.object({
    action: v.literal('addRoutes'),
    id,
    items: v.pipe(
      v.array(v.object({ upstreamId: v.string(), protocol: v.picklist(protocols) })),
      v.minLength(1),
    ),
  }),
  v.object({ action: v.literal('checkAll') }),
])

export type ProviderChange = v.InferOutput<typeof providerCommand>

export function createForm(kit: FormKit) {
  return v.object({
    name: kit.text('AiProviderCreateInputBody', 'name'),
    baseUrl: kit.text('AiProviderCreateInputBody', 'base_url'),
    apiKey: kit.text('AiProviderCreateInputBody', 'api_key'),
  })
}

export function settingsForm(kit: FormKit) {
  return v.object({
    name: kit.text('AiProviderUpdateInputBody', 'name'),
    baseUrl: kit.text('AiProviderUpdateInputBody', 'base_url'),
    apiKey: kit.text('AiProviderUpdateInputBody', 'api_key'),
  })
}

export function manualForm(kit: FormKit) {
  return v.object({ upstreamId: kit.text('AiRouteItemInput', 'upstream_id') })
}
