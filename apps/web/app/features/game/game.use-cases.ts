import type { ApiClient } from '~/shared/api/client'

export async function loadGameHeader(api: ApiClient, id: number) {
  return api.get('/game/{id}/header', { params: { path: { id } } })
}

export async function loadLatestGames(api: ApiClient, pageSize: number) {
  const page = await api.get('/game/list', { params: { query: { pageSize } } })
  return page.items ?? []
}
