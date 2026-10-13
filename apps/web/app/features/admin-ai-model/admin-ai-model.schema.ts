import * as v from 'valibot'
import { protocols } from '~/features/admin-ai'
import type { FormKit } from '~/shared/form/form-kit'
import { capabilities, maxQueryLength, type Filter } from './admin-ai-model'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const query = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(maxQueryLength)), '')

const capability = v.fallback(v.optional(v.picklist(capabilities)), undefined)

export function filterFrom(search: URLSearchParams): Filter {
  return {
    query: v.parse(query, search.get('q') ?? ''),
    capability: v.parse(capability, search.get('capability') ?? undefined),
  }
}

export function catalogQueryFrom(raw: string | null): string {
  return v.parse(query, raw ?? '')
}

const route = v.object({
  providerId: id,
  upstreamId: v.string(),
  protocol: v.picklist(protocols),
})

export const modelCommand = v.variant('action', [
  v.object({
    action: v.literal('create'),
    canonicalId: v.string(),
    name: v.string(),
    description: v.string(),
    routes: v.array(route),
  }),
  v.object({
    action: v.literal('update'),
    id,
    changes: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      isDefault: v.optional(v.boolean()),
      enabled: v.optional(v.boolean()),
    }),
  }),
  v.object({ action: v.literal('remove'), id }),
  v.object({ action: v.literal('reorder'), id, ids: v.array(id) }),
  v.object({ action: v.literal('addRoute'), id, ...route.entries }),
  v.object({ action: v.literal('syncCatalog') }),
])

export type ModelChange = v.InferOutput<typeof modelCommand>

export function createForm(kit: FormKit) {
  return v.object({
    name: kit.text('AiModelCreateInputBody', 'name'),
    description: kit.text('AiModelCreateInputBody', 'description'),
  })
}

export function settingsForm(kit: FormKit) {
  return v.object({
    name: kit.text('AiModelUpdateInputBody', 'name'),
    description: kit.text('AiModelUpdateInputBody', 'description'),
  })
}

export function routeForm(kit: FormKit) {
  return v.object({ upstreamId: kit.text('AiModelAddRouteInputBody', 'upstream_id') })
}
