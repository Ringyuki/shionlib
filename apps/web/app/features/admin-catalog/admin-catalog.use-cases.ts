import type { ApiClient } from '~/shared/api/client'
import {
  excludedShown,
  hitsShown,
  type Authorization,
  type CatalogResult,
  type Excluded,
  type Hit,
  type Lookup,
  type Source,
} from './admin-catalog'
import type { CatalogChange } from './admin-catalog.schema'

export type CatalogPage = {
  sources: Source[]
  excluded: Excluded[]
  excludedTotal: number
  page: number
  bangumi: Authorization
}

export async function loadCatalog(api: ApiClient, page: number): Promise<CatalogPage> {
  const [sources, excluded, bangumi] = await Promise.all([
    api.get('/admin/catalog/sources'),
    api.get('/admin/catalog/excluded', { params: { query: { page, pageSize: excludedShown } } }),
    api.get('/admin/bangumi/authorization'),
  ])
  return {
    sources: sources ?? [],
    excluded: excluded.items ?? [],
    excludedTotal: excluded.meta.totalItems,
    page,
    bangumi,
  }
}

export type Found = {
  lookup: Lookup
  hits: Hit[]
  total: number
}

export async function searchSource(api: ApiClient, lookup: Lookup): Promise<Found> {
  const page = await api.get('/admin/catalog/search', {
    params: {
      query: {
        source: lookup.source,
        entity: lookup.entity,
        q: lookup.query,
        page: 1,
        pageSize: hitsShown,
      },
    },
  })
  return { lookup, hits: page.items ?? [], total: page.meta.totalItems }
}

export async function changeCatalog(api: ApiClient, change: CatalogChange): Promise<CatalogResult> {
  if (change.action === 'sync') {
    const synced = await api.post('/admin/catalog/sources/{source}/sync', {
      params: { path: { source: change.source } },
    })
    return { kind: 'synced', changes: synced.changes }
  }
  const imported = await api.post('/admin/catalog/import', {
    body: { source: change.source, entity: change.entity, external_id: change.externalId },
  })
  return { kind: 'imported', id: imported.id }
}
