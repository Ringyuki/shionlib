import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import {
  changeMembership,
  createListWithGame,
  isFavorite,
  loadFavoriteLists,
} from './favorite.use-cases'

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

describe('createListWithGame', () => {
  it('creates the list and puts the game in it', async () => {
    const fake = fakeApi()
      .on('post', '/favorites', { id: 8, name: '想玩', description: null, is_private: true })
      .on('put', '/favorites/{id}', undefined)
    await expect(
      createListWithGame(fake.api, {
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
