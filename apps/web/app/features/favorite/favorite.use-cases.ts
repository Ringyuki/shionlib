import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { chosenList, itemsPageSize, type Favorites } from './favorite'
import type {
  ListCreation,
  ListEdit,
  ListRemoval,
  MembershipChange,
  NoteChange,
} from './favorite.schema'

export async function loadFavoriteLists(api: ApiClient, gameId: number) {
  const lists = await api.get('/favorites', { params: { query: { game_id: gameId } } })
  return lists ?? []
}

export async function loadFavorites(
  api: ApiClient,
  owner: number,
  listId: number | undefined,
  page: number,
): Promise<Favorites> {
  const lists = (await api.get('/favorites', { params: { query: { user_id: owner } } })) ?? []
  const selected = chosenList(lists, listId)
  if (selected === undefined) {
    return { owner, lists, selected, items: [], total: 0, page }
  }
  const found = await api.get('/favorites/{id}/items', {
    params: { path: { id: selected.id }, query: { page, pageSize: itemsPageSize } },
  })
  return { owner, lists, selected, items: found.items ?? [], total: found.meta.totalItems, page }
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
    const note = (change.note ?? '').trim()
    await api.put('/favorites/{id}', {
      params: { path: { id: change.listId } },
      body: { game_id: change.gameId, ...(note === '' ? {} : { note }) },
    })
    return
  }
  await api.delete('/favorites/{id}/games/{game_id}', {
    params: { path: { id: change.listId, game_id: change.gameId } },
  })
}

export async function createList(api: ApiClient, creation: ListCreation) {
  const description = creation.description.trim()
  const list = await api.post('/favorites', {
    body: {
      name: creation.name.trim(),
      is_private: creation.isPrivate,
      ...(description === '' ? {} : { description }),
    },
  })
  if (creation.gameId !== undefined) {
    await api.put('/favorites/{id}', {
      params: { path: { id: list.id } },
      body: { game_id: creation.gameId },
    })
  }
  return list
}

export async function editList(api: ApiClient, edit: ListEdit) {
  await api.patch('/favorites/{id}', {
    params: { path: { id: edit.listId } },
    body: {
      name: edit.name.trim(),
      description: edit.description.trim(),
      is_private: edit.isPrivate,
    },
  })
  return null
}

export async function removeList(api: ApiClient, removal: ListRemoval) {
  await api.delete('/favorites/{id}', { params: { path: { id: removal.listId } } })
  return null
}

export async function changeNote(api: ApiClient, change: NoteChange) {
  await api.patch('/favorites/items/{item_id}', {
    params: { path: { item_id: change.itemId } },
    body: { note: change.note.trim() },
  })
  return null
}
