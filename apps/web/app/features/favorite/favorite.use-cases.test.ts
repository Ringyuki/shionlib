import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData, Schema } from '~/shared/api/types'
import {
  changeMembership,
  changeNote,
  createList,
  editList,
  isFavorite,
  loadFavoriteLists,
  loadFavorites,
  removeList,
} from './favorite.use-cases'

const list = (id: number, isDefault = false): Schema<'FavoriteSummaryDTO'> => ({
  id,
  name: `list ${id}`,
  description: null,
  is_private: false,
  default: isDefault,
  game_count: 1,
})

const page: ApiData<'/favorites/{id}/items', 'get'> = {
  items: null,
  meta: {
    currentPage: 2,
    itemCount: 0,
    itemsPerPage: 20,
    totalItems: 21,
    totalPages: 2,
    content_limit: 0,
  },
}

describe('isFavorite', () => {
  it('reports the stats of a signed-in viewer', async () => {
    const { api } = fakeApi().on('get', '/favorites/game/{id}/stats', { is_favorite: true })
    await expect(isFavorite(api, 1)).resolves.toBe(true)
  })

  it('treats guests as not having favorited', async () => {
    const { api } = fakeApi().fail('get', '/favorites/game/{id}/stats', 401, {
      code: 200101,
      message: 'unauthorized',
    })
    await expect(isFavorite(api, 1)).resolves.toBe(false)
  })

  it('surfaces other failures', async () => {
    const { api } = fakeApi().fail('get', '/favorites/game/{id}/stats', 500, {
      code: 500,
      message: 'down',
    })
    await expect(isFavorite(api, 1)).rejects.toMatchObject({ status: 500 })
  })
})

describe('loadFavoriteLists', () => {
  it('asks for the lists annotated with the game', async () => {
    const fake = fakeApi().on('get', '/favorites', [])
    await expect(loadFavoriteLists(fake.api, 5)).resolves.toEqual([])
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('game_id')).toBe('5')
  })
})

describe('changeMembership', () => {
  it('adds the game to the list', async () => {
    const fake = fakeApi().on('put', '/favorites/{id}', undefined)
    await changeMembership(fake.api, { listId: 2, gameId: 9, included: true })
    const [request] = fake.requests
    expect([request?.method, new URL(request?.url ?? '').pathname]).toEqual(['PUT', '/favorites/2'])
    await expect(request?.json()).resolves.toEqual({ game_id: 9 })
  })

  it('removes the game from the list', async () => {
    const fake = fakeApi().on('delete', '/favorites/{id}/games/{game_id}', undefined)
    await changeMembership(fake.api, { listId: 2, gameId: 9, included: false })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/favorites/2/games/9')
  })
})

describe('loadFavorites', () => {
  it('loads the lists of the owner and the games of the chosen one', async () => {
    const fake = fakeApi()
      .on('get', '/favorites', [list(4), list(7, true)])
      .on('get', '/favorites/{id}/items', page)
    await expect(loadFavorites(fake.api, 3, 4, 2)).resolves.toMatchObject({
      owner: 3,
      selected: { id: 4 },
      items: [],
      total: 21,
      page: 2,
    })
    const [lists, items] = fake.requests.map(request => new URL(request.url))
    expect(lists?.searchParams.get('user_id')).toBe('3')
    expect(items?.pathname).toBe('/favorites/4/items')
    expect(Object.fromEntries(items?.searchParams ?? [])).toEqual({ page: '2', pageSize: '20' })
  })

  it('opens the default list when none is named', async () => {
    const fake = fakeApi()
      .on('get', '/favorites', [list(4), list(7, true)])
      .on('get', '/favorites/{id}/items', page)
    await expect(loadFavorites(fake.api, 3, undefined, 1)).resolves.toMatchObject({
      selected: { id: 7 },
    })
  })

  it('asks for no games when the list is not among those the viewer may see', async () => {
    const fake = fakeApi().on('get', '/favorites', [list(4)])
    await expect(loadFavorites(fake.api, 3, 9, 1)).resolves.toMatchObject({
      selected: undefined,
      items: [],
      total: 0,
    })
    expect(fake.requests).toHaveLength(1)
  })
})

describe('createList', () => {
  it('creates an empty list', async () => {
    const fake = fakeApi().on('post', '/favorites', {
      id: 8,
      name: '想玩',
      description: null,
      is_private: false,
    })
    await createList(fake.api, { name: '想玩', description: '', isPrivate: false })
    expect(fake.requests).toHaveLength(1)
  })

  it('creates the list and puts the game in it', async () => {
    const fake = fakeApi()
      .on('post', '/favorites', { id: 8, name: '想玩', description: null, is_private: true })
      .on('put', '/favorites/{id}', undefined)
    await expect(
      createList(fake.api, {
        gameId: 3,
        name: ' 想玩 ',
        description: ' ',
        isPrivate: true,
      }),
    ).resolves.toMatchObject({ id: 8 })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ name: '想玩', is_private: true })
    expect(new URL(fake.requests[1]?.url ?? '').pathname).toBe('/favorites/8')
    await expect(fake.requests[1]?.json()).resolves.toEqual({ game_id: 3 })
  })
})

describe('editList', () => {
  it('saves the name, the description and the privacy of a list', async () => {
    const fake = fakeApi().on('patch', '/favorites/{id}', undefined)
    await editList(fake.api, { listId: 4, name: ' 已通关 ', description: ' ', isPrivate: true })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/favorites/4')
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      name: '已通关',
      description: '',
      is_private: true,
    })
  })
})

describe('removeList', () => {
  it('deletes the list', async () => {
    const fake = fakeApi().on('delete', '/favorites/{id}', undefined)
    await removeList(fake.api, { listId: 4 })
    expect([fake.requests[0]?.method, new URL(fake.requests[0]?.url ?? '').pathname]).toEqual([
      'DELETE',
      '/favorites/4',
    ])
  })
})

describe('changeNote', () => {
  it('saves the note of an item', async () => {
    const fake = fakeApi().on('patch', '/favorites/items/{item_id}', undefined)
    await changeNote(fake.api, { itemId: 12, note: ' 等汉化补丁 ' })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/favorites/items/12')
    await expect(fake.requests[0]?.json()).resolves.toEqual({ note: '等汉化补丁' })
  })
})

describe('restoring a removed game', () => {
  it('puts the game back with its note', async () => {
    const fake = fakeApi().on('put', '/favorites/{id}', undefined)
    await changeMembership(fake.api, { listId: 2, gameId: 9, included: true, note: '等汉化' })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ game_id: 9, note: '等汉化' })
  })
})
