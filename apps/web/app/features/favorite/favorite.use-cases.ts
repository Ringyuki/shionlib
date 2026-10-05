import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import type { ListCreation, MembershipChange } from './favorite.schema'

export async function loadFavoriteLists(api: ApiClient, gameId: number) {
  const lists = await api.get('/favorites', { params: { query: { game_id: gameId } } })
  return lists ?? []
}

export async function isFavorite(api: ApiClient, gameId: number): Promise<boolean> {
  try {
    const stats = await api.get('/favorites/game/{id}/stats', { params: { path: { id: gameId } } })
    return stats.is_favorite
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return false
    }
    throw error
  }
}

export async function changeMembership(api: ApiClient, change: MembershipChange): Promise<void> {
  if (change.included) {
    await api.put('/favorites/{id}', {
      params: { path: { id: change.listId } },
      body: { game_id: change.gameId },
    })
    return
  }
  await api.delete('/favorites/{id}/games/{game_id}', {
    params: { path: { id: change.listId, game_id: change.gameId } },
  })
}

export async function createListWithGame(api: ApiClient, creation: ListCreation) {
  const description = creation.description.trim()
  const list = await api.post('/favorites', {
    body: {
      name: creation.name.trim(),
      is_private: creation.isPrivate,
      ...(description === '' ? {} : { description }),
    },
  })
  await api.put('/favorites/{id}', {
    params: { path: { id: list.id } },
    body: { game_id: creation.gameId },
  })
  return list
}
