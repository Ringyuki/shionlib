import { loadWorks, type GameOrder } from '~/features/game'
import type { ApiClient } from '~/shared/api/client'
import { pageSize, type DeveloperContent, type Developers } from './developer'

export async function loadDevelopers(
  api: ApiClient,
  query: string,
  page: number,
): Promise<Developers> {
  const found = await api.get('/developer/list', {
    params: { query: { page, pageSize, ...(query === '' ? {} : { q: query }) } },
  })
  return { query, page, items: found.items ?? [], total: found.meta.totalItems }
}

export async function loadDeveloper(
  api: ApiClient,
  id: number,
  page: number,
  order: GameOrder,
): Promise<DeveloperContent> {
  const [developer, works] = await Promise.all([
    api.get('/developer/{id}', { params: { path: { id } } }),
    loadWorks(api, { developer: id }, page, order),
  ])
  return { developer, works }
}
