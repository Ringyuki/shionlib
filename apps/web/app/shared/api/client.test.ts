import { describe, expect, it } from 'vitest'
import { createApi } from './client'
import { ApiError } from './error'
import { fakeApi } from './testing'

describe('createApi', () => {
  it('returns the envelope data with the path parameters applied', async () => {
    const fake = fakeApi().on('get', '/favorites/game/{id}/stats', { is_favorite: true })
    await expect(
      fake.api.get('/favorites/game/{id}/stats', { params: { path: { id: 7 } } }),
    ).resolves.toEqual({ is_favorite: true })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/favorites/game/7/stats')
  })

  it('sends query parameters and JSON bodies', async () => {
    const fake = fakeApi().on('get', '/favorites', []).on('put', '/favorites/{id}', undefined)
    await fake.api.get('/favorites', { params: { query: { game_id: 3 } } })
    await fake.api.put('/favorites/{id}', { params: { path: { id: 1 } }, body: { game_id: 3 } })
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('game_id')).toBe('3')
    await expect(fake.requests[1]?.json()).resolves.toEqual({ game_id: 3 })
  })

  it('throws an ApiError carrying the business failure', async () => {
    const fake = fakeApi().fail('get', '/user/me', 401, { code: 200101, message: '未登录' })
    const error = await fake.api.get('/user/me').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 200101, message: '未登录' })
    expect(error instanceof ApiError && error.is('AUTH_UNAUTHORIZED')).toBe(true)
  })

  it('describes failures without an error envelope by their HTTP status', async () => {
    const api = createApi({
      baseUrl: 'http://api.test',
      fetch: async () =>
        new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
    })
    await expect(api.get('/user/me')).rejects.toMatchObject({ status: 502, code: 502 })
  })
})
