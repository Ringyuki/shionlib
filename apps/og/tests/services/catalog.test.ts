import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

const { config } = await import('../../src/config')
const { BackendError, NotFoundError, clearBackendCache } =
  await import('../../src/services/backend')
const { fetchGameHeader, fetchGameResources, fetchGames } =
  await import('../../src/services/catalog')

const realFetch = global.fetch
const mockFetch = mock()
global.fetch = mockFetch as unknown as typeof fetch

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const header = {
  id: 962,
  title_jp: 'ライムライト・レモネードジャム',
  title_zh: '橘光柠水随想曲',
  title_en: '',
  covers: [
    {
      language: 'unknown',
      type: 'dig',
      url: 'https://a/b.webp',
      dims: [500, 709],
      sexual: 0,
      violence: 0,
    },
  ],
  developers: null,
  release_date: null,
}

describe('catalog', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearBackendCache()
    config.OG_CACHE_DISABLED = false
    config.BACKEND_INTERNAL_URL = 'http://test-backend:5000'
  })

  afterAll(() => {
    global.fetch = realFetch
  })

  it('reads the header of a game and turns missing lists into empty ones', async () => {
    mockFetch.mockResolvedValue(respond(200, { code: 0, data: header }))
    const game = await fetchGameHeader(962)
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe('http://test-backend:5000/game/962/header')
    expect(game.developers).toEqual([])
    expect(game.covers[0]).toMatchObject({ masked: false, type: 'dig' })
  })

  it('keeps what it read for a while', async () => {
    mockFetch.mockResolvedValue(respond(200, { code: 0, data: header }))
    await fetchGameHeader(962)
    await fetchGameHeader(962)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('reads a list that the API sends as null', async () => {
    mockFetch.mockResolvedValue(respond(200, { code: 0, data: null }))
    expect(await fetchGameResources(5)).toEqual([])
  })

  it('asks for games with the given conditions', async () => {
    mockFetch.mockResolvedValue(
      respond(200, { code: 0, data: { items: [], meta: { totalItems: 13 } } }),
    )
    const list = await fetchGames({ developer_id: 5135, page: 1, pageSize: 10 })
    expect(String(mockFetch.mock.calls[0]?.[0])).toBe(
      'http://test-backend:5000/game/list?developer_id=5135&page=1&pageSize=10',
    )
    expect(list.meta.totalItems).toBe(13)
  })

  it('tells a missing entry from a failing backend', async () => {
    mockFetch.mockResolvedValueOnce(respond(404, { code: 400101, data: null }))
    await expect(fetchGameHeader(1)).rejects.toBeInstanceOf(NotFoundError)
    mockFetch.mockResolvedValueOnce(respond(503, {}))
    await expect(fetchGameHeader(2)).rejects.toBeInstanceOf(BackendError)
    mockFetch.mockResolvedValueOnce(respond(200, { code: 0, data: { id: 'x' } }))
    await expect(fetchGameHeader(3)).rejects.toBeInstanceOf(BackendError)
  })
})
