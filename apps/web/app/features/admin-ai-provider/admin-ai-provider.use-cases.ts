import type { ProviderKind } from '~/features/admin-ai'
import type { ApiClient } from '~/shared/api/client'
import {
  checksAtOnce,
  type Filter,
  type Preset,
  type Provider,
  type ProviderDetail,
  type ProviderResult,
  type Resolved,
} from './admin-ai-provider'
import type { ProviderChange } from './admin-ai-provider.schema'

export type Listing = {
  filter: Filter
  providers: Provider[]
}

export async function loadProviders(api: ApiClient, filter: Filter): Promise<Listing> {
  return { filter, providers: (await api.get('/admin/ai/providers')) ?? [] }
}

export function loadProvider(api: ApiClient, id: number): Promise<ProviderDetail> {
  return api.get('/admin/ai/providers/{id}', { params: { path: { id } } })
}

export async function loadPresets(api: ApiClient): Promise<Preset[]> {
  return (await api.get('/admin/ai/catalog/providers')) ?? []
}

export async function loadEndpoint(
  api: ApiClient,
  kind: ProviderKind,
  baseUrl: string,
): Promise<string | null> {
  const found = await api.get('/admin/ai/providers/endpoint', {
    params: { query: { kind, ...(baseUrl === '' ? {} : { base_url: baseUrl }) } },
  })
  return found.url
}

export async function loadResolved(
  api: ApiClient,
  id: number,
  upstreamId: string,
): Promise<Resolved | undefined> {
  const [resolved] =
    (await api.get('/admin/ai/providers/{id}/resolve', {
      params: { path: { id }, query: { ids: upstreamId } },
    })) ?? []
  return resolved
}

async function checkAll(api: ApiClient): Promise<ProviderResult> {
  const providers = (await api.get('/admin/ai/providers')) ?? []
  const details = await Promise.all(
    providers.filter(provider => provider.enabled).map(provider => loadProvider(api, provider.id)),
  )
  const ids = details
    .flatMap(detail => detail.routes ?? [])
    .filter(route => route.status !== 'disabled')
    .map(route => route.id)
  let failed = 0
  for (let start = 0; start < ids.length; start += checksAtOnce) {
    const settled = await Promise.allSettled(
      ids
        .slice(start, start + checksAtOnce)
        .map(id => api.post('/admin/ai/routes/{id}/checks', { params: { path: { id } } })),
    )
    failed += settled.filter(check => check.status === 'rejected' || !check.value.ok).length
  }
  return { kind: 'checked', checked: ids.length, failed }
}

export async function changeProvider(
  api: ApiClient,
  change: ProviderChange,
): Promise<ProviderResult> {
  switch (change.action) {
    case 'create': {
      const baseUrl = change.baseUrl.trim()
      const created = await api.post('/admin/ai/providers', {
        body: {
          name: change.name.trim(),
          kind: change.kind,
          api_key: change.apiKey,
          ...(baseUrl === '' ? {} : { base_url: baseUrl }),
          ...(change.presetId === null ? {} : { catalog_provider_id: change.presetId }),
          ...(change.priceMultiplier === null ? {} : { price_multiplier: change.priceMultiplier }),
        },
      })
      return { kind: 'created', id: created.id }
    }
    case 'update': {
      const { name, baseUrl, apiKey, priceMultiplier, enabled } = change.changes
      await api.patch('/admin/ai/providers/{id}', {
        params: { path: { id: change.id } },
        body: {
          ...(name === undefined ? {} : { name }),
          ...(baseUrl === undefined ? {} : { base_url: baseUrl === '' ? null : baseUrl }),
          ...(apiKey === undefined ? {} : { api_key: apiKey }),
          ...(priceMultiplier === undefined ? {} : { price_multiplier: priceMultiplier }),
          ...(enabled === undefined ? {} : { enabled }),
        },
      })
      return { kind: 'done' }
    }
    case 'remove':
      await api.delete('/admin/ai/providers/{id}', { params: { path: { id: change.id } } })
      return { kind: 'done' }
    case 'discover':
      return {
        kind: 'discovered',
        discovery: await api.post('/admin/ai/providers/{id}/discovery', {
          params: { path: { id: change.id } },
        }),
      }
    case 'addRoutes': {
      const result = await api.post('/admin/ai/providers/{id}/routes', {
        params: { path: { id: change.id } },
        body: {
          items: change.items.map(item => ({
            upstream_id: item.upstreamId.trim(),
            protocol: item.protocol,
          })),
        },
      })
      return {
        kind: 'added',
        added: (result.route_ids ?? []).length,
        skipped: result.skipped ?? [],
      }
    }
    case 'checkAll':
      return checkAll(api)
  }
}
