import { loadWorks, type GameOrder } from '~/features/game'
import type { ApiClient } from '~/shared/api/client'
import { pageSize, type TranslatorContent, type Translators } from './translator'

export async function loadTranslators(
  api: ApiClient,
  query: string,
  page: number,
): Promise<Translators> {
  const found = await api.get('/translator/list', {
    params: { query: { page, pageSize, ...(query === '' ? {} : { q: query }) } },
  })
  return { query, page, items: found.items ?? [], total: found.meta.totalItems }
}

export async function loadTranslator(
  api: ApiClient,
  id: number,
  page: number,
  order: GameOrder,
): Promise<TranslatorContent> {
  const [translator, works] = await Promise.all([
    api.get('/translator/{id}', { params: { path: { id } } }),
    loadWorks(api, { translator: id }, page, order),
  ])
  return { translator, works }
}

export async function suggestTranslators(api: ApiClient, query: string) {
  const found = await api.get('/translator/suggest', { params: { query: { q: query } } })
  return found ?? []
}
