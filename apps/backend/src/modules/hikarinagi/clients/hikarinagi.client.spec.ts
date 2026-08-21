import { of } from 'rxjs'
import { HikarinagiClient } from './hikarinagi.client'
import { UserContentLimit } from '../../user/interfaces/user.interface'

describe('HikarinagiClient', () => {
  const createClient = (overrides: Record<string, unknown> = {}) => {
    const httpService = {
      get: jest.fn().mockReturnValue(of({ data: { data: null } })),
      post: jest.fn().mockReturnValue(of({ data: { data: null } })),
    }
    const config = {
      get: jest.fn((key: string) =>
        key === 'hikarinagi.base_url'
          ? ((overrides.baseUrl as string) ?? 'http://upstream.test/')
          : ((overrides.secret as string) ?? 'sekret'),
      ),
    }
    const cacheService = { get: jest.fn().mockResolvedValue(null), set: jest.fn() }
    const client = new HikarinagiClient(
      httpService as never,
      config as never,
      cacheService as never,
    )

    return { client, httpService, cacheService }
  }

  const urlOf = (httpService: { get: jest.Mock }) => String(httpService.get.mock.calls[0][0])
  const queryOf = (httpService: { get: jest.Mock }) =>
    Object.fromEntries(new URL(urlOf(httpService)).searchParams)

  describe('enabled', () => {
    it('is off until both the base url and the secret are configured', () => {
      expect(createClient().client.enabled).toBe(true)
      expect(createClient({ baseUrl: '' }).client.enabled).toBe(false)
      expect(createClient({ secret: '' }).client.enabled).toBe(false)
    })
  })

  describe('galgameIds', () => {
    it('sends every entry-domain filter and the rated-cover flag', async () => {
      const { client, httpService } = createClient()

      await client.galgameIds({
        producer_id: 11,
        character_id: 22,
        content_limit: UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
        tags: ['adv', 'gal'],
        exclude_tags: ['nukige'],
        platforms: ['win'],
        release_periods: ['2020-01', '2020-02'],
        released_after: '2020-01-01',
        released_before: '2020-12-31',
        sort_order: 'asc',
        exclude_rated_covers: true,
      })

      expect(queryOf(httpService)).toEqual({
        producer_ids: '11',
        character_id: '22',
        content_limit: 'NEVER_SHOW_NSFW_CONTENT',
        tags: 'adv,gal',
        exclude_tags: 'nukige',
        platforms: 'win',
        release_periods: '2020-01,2020-02',
        released_after: '2020-01-01',
        released_before: '2020-12-31',
        sort_order: 'asc',
        exclude_rated_covers: 'true',
      })
    })

    it('falls back to the strict content limit for a guest, whose runtime value is 0', async () => {
      const { client, httpService } = createClient()

      await client.galgameIds({ content_limit: 0 })

      expect(queryOf(httpService).content_limit).toBe('NEVER_SHOW_NSFW_CONTENT')
    })

    it('maps the permissive limits through instead of forcing the strict one', async () => {
      const permissive = createClient()
      await permissive.client.galgameIds({ content_limit: UserContentLimit.JUST_SHOW })
      expect(queryOf(permissive.httpService).content_limit).toBe('JUST_SHOW')

      const spoiler = createClient()
      await spoiler.client.galgameIds({ content_limit: UserContentLimit.SHOW_WITH_SPOILER })
      expect(queryOf(spoiler.httpService).content_limit).toBe('SHOW_WITH_SPOILER')
    })

    it('serves a cached id list without calling upstream', async () => {
      const { client, httpService, cacheService } = createClient()
      cacheService.get.mockResolvedValueOnce([1, 2, 3])

      await expect(client.galgameIds({ content_limit: 1 })).resolves.toEqual({ ids: [1, 2, 3] })
      expect(httpService.get).not.toHaveBeenCalled()
    })

    it('caches what upstream returned, keyed per query', async () => {
      const { client, httpService, cacheService } = createClient()
      httpService.get.mockReturnValueOnce(of({ data: { data: { ids: [7] } } }))

      await client.galgameIds({ content_limit: 1, tags: ['adv'] })

      const [key, value] = cacheService.set.mock.calls[0]
      expect(value).toEqual([7])
      expect(String(key)).toMatch(/^hikarinagi:galgame:ids:/)
    })
  })

  describe('safeGalgameIds', () => {
    it('returns null for a reader allowed to see rated works', async () => {
      const { client, httpService } = createClient()

      await expect(client.safeGalgameIds(UserContentLimit.JUST_SHOW)).resolves.toBeNull()
      expect(httpService.get).not.toHaveBeenCalled()
    })

    it('asks upstream to drop rated covers for a strict reader', async () => {
      const { client, httpService } = createClient()
      httpService.get.mockReturnValueOnce(of({ data: { data: { ids: [4, 5] } } }))

      await expect(client.safeGalgameIds(0)).resolves.toEqual([4, 5])
      expect(queryOf(httpService).exclude_rated_covers).toBe('true')
    })
  })

  describe('galgameBatch', () => {
    it('skips the round trip for an empty id list', async () => {
      const { client, httpService } = createClient()

      await expect(client.galgameBatch([])).resolves.toEqual([])
      expect(httpService.post).not.toHaveBeenCalled()
    })

    it('posts the ids and unwraps the envelope', async () => {
      const { client, httpService } = createClient()
      httpService.post.mockReturnValueOnce(of({ data: { data: [{ id: 9 }] } }))

      await expect(client.galgameBatch([9])).resolves.toEqual([{ id: 9 }])
      expect(httpService.post.mock.calls[0][1]).toEqual({ ids: [9] })
      expect(httpService.post.mock.calls[0][2].headers['x-internal-secret']).toBe('sekret')
    })
  })

  describe('searchGalgameIds', () => {
    it('degrades to an empty page when upstream returns no data', async () => {
      const { client } = createClient()

      await expect(client.searchGalgameIds({ q: 'x', page: 1, page_size: 10 })).resolves.toEqual({
        ids: [],
        meta: { total_items: 0, total_pages: 0 },
      })
    })
  })

  it('trims a trailing slash off the configured base url', async () => {
    const { client, httpService } = createClient({ baseUrl: 'http://upstream.test/' })

    await client.galgameIds({ content_limit: 1 })

    expect(urlOf(httpService).startsWith('http://upstream.test/api/v3/')).toBe(true)
  })
})
