import type { ApiClient } from '~/shared/api/client'
import { ascending, type Cluster, type Filter, type Translator } from './admin-translator'
import type { TranslatorChange } from './admin-translator.schema'

export type Listing = {
  filter: Filter
  translators: Translator[]
  total: number
  clusters: Cluster[]
}

async function loadClusters(api: ApiClient): Promise<Cluster[]> {
  const clusters = await api.get('/admin/content/translators/duplicates')
  return (clusters ?? []).map(cluster => cluster.translators ?? [])
}

async function loadPage(api: ApiClient, filter: Filter, pageSize: number) {
  if (filter.view === 'duplicates') {
    return { translators: [], total: 0 }
  }
  const page = await api.get('/admin/content/translators', {
    params: {
      query: {
        page: filter.page,
        pageSize,
        sortBy: filter.sort,
        sortOrder: ascending(filter.sort) ? 'asc' : 'desc',
        ...(filter.query === '' ? {} : { search: filter.query }),
      },
    },
  })
  return { translators: page.items ?? [], total: page.meta.totalItems }
}

export async function loadTranslators(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const [page, clusters] = await Promise.all([loadPage(api, filter, pageSize), loadClusters(api)])
  return { filter, ...page, clusters }
}

export async function changeTranslator(api: ApiClient, change: TranslatorChange): Promise<null> {
  switch (change.action) {
    case 'edit':
      await api.patch('/admin/content/translators/{id}', {
        params: { path: { id: change.id } },
        body: {
          name: change.name.trim(),
          aliases: change.aliases,
          homepage: change.homepage.trim(),
        },
      })
      return null
    case 'merge':
      await api.post('/admin/content/translators/{id}/merge', {
        params: { path: { id: change.id } },
        body: { merged_ids: change.mergedIds },
      })
      return null
    case 'dismiss':
      await api.post('/admin/content/translators/duplicates/dismiss', {
        body: { ids: change.ids },
      })
      return null
  }
}
