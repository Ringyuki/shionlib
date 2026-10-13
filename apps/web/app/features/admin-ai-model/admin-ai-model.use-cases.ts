import type { ApiClient } from '~/shared/api/client'
import type {
  CatalogModel,
  CatalogStatus,
  Filter,
  Model,
  ModelResult,
  ProviderOption,
  SceneUse,
} from './admin-ai-model'
import type { ModelChange } from './admin-ai-model.schema'

export type Listing = {
  filter: Filter
  models: Model[]
  catalog: CatalogStatus
}

export async function loadModels(api: ApiClient, filter: Filter): Promise<Listing> {
  const [models, catalog] = await Promise.all([
    api.get('/admin/ai/models'),
    api.get('/admin/ai/catalog'),
  ])
  return { filter, models: models ?? [], catalog }
}

export type Opened = {
  model: Model
  providers: ProviderOption[]
  scenes: SceneUse[]
}

export async function loadModel(api: ApiClient, id: number): Promise<Opened> {
  const [model, providers, scenes] = await Promise.all([
    api.get('/admin/ai/models/{id}', { params: { path: { id } } }),
    api.get('/admin/ai/providers'),
    api.get('/admin/ai/scenes'),
  ])
  return { model, providers: providers ?? [], scenes: scenes ?? [] }
}

export async function searchCatalog(api: ApiClient, query: string): Promise<CatalogModel[]> {
  return (await api.get('/admin/ai/catalog/models', { params: { query: { q: query } } })) ?? []
}

export async function changeModel(api: ApiClient, change: ModelChange): Promise<ModelResult> {
  switch (change.action) {
    case 'create': {
      const description = change.description.trim()
      const created = await api.post('/admin/ai/models', {
        body: {
          canonical_id: change.canonicalId,
          name: change.name.trim(),
          ...(description === '' ? {} : { description }),
          routes: change.routes.map(route => ({
            provider_id: route.providerId,
            upstream_id: route.upstreamId,
            protocol: route.protocol,
          })),
        },
      })
      return { kind: 'created', id: created.id }
    }
    case 'update': {
      const { name, description, isDefault, enabled } = change.changes
      await api.patch('/admin/ai/models/{id}', {
        params: { path: { id: change.id } },
        body: {
          ...(name === undefined ? {} : { name }),
          ...(description === undefined
            ? {}
            : { description: description === '' ? null : description }),
          ...(isDefault === undefined ? {} : { is_default: isDefault }),
          ...(enabled === undefined ? {} : { enabled }),
        },
      })
      return { kind: 'done' }
    }
    case 'remove':
      await api.delete('/admin/ai/models/{id}', { params: { path: { id: change.id } } })
      return { kind: 'done' }
    case 'reorder':
      await api.put('/admin/ai/models/{id}/routes', {
        params: { path: { id: change.id } },
        body: { ids: change.ids },
      })
      return { kind: 'done' }
    case 'addRoute':
      await api.post('/admin/ai/models/{id}/routes', {
        params: { path: { id: change.id } },
        body: {
          provider_id: change.providerId,
          upstream_id: change.upstreamId.trim(),
          protocol: change.protocol,
        },
      })
      return { kind: 'done' }
    case 'syncCatalog': {
      const synced = await api.post('/admin/ai/catalog/sync')
      return {
        kind: 'synced',
        added: synced.added,
        updated: synced.updated,
        removed: synced.removed,
        repriced: synced.repriced,
      }
    }
  }
}
