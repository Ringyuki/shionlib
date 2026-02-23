import { ShionConfigService } from '../../../common/config/services/config.service'
import { CacheService } from '../../cache/services/cache.service'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { MeilisearchService } from '../services/meilisearch.service'
import { MeilisearchEngine } from './meilisearch.engine'

describe('MeilisearchEngine', () => {
  function createEngine() {
    const meilisearchService = {
      onModuleInit: jest.fn(),
      getClient: jest.fn(),
      ensureIndex: jest.fn(),
    } as unknown as MeilisearchService

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'search.meilisearch.indexName') return 'games-index'
        return undefined
      }),
    } as unknown as ShionConfigService

    const cacheService = {
      delByContains: jest.fn(),
    } as unknown as CacheService

    const engine = new MeilisearchEngine(meilisearchService, configService, cacheService)

    return {
      engine,
      meilisearchService,
      cacheService,
    }
  }

  function createIndexMock() {
    return {
      addDocuments: jest.fn(),
      deleteDocument: jest.fn(),
      deleteAllDocuments: jest.fn(),
      search: jest.fn(),
      searchForFacetValues: jest.fn(),
    }
  }

  it('calls meilisearch service init in constructor', () => {
    const { meilisearchService } = createEngine()

    expect(meilisearchService.onModuleInit).toHaveBeenCalledTimes(1)
  })

  it('upsertGame writes document and clears cache', async () => {
    const { engine, meilisearchService, cacheService } = createEngine()
    const index = createIndexMock()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue({})
    ;(meilisearchService.ensureIndex as jest.Mock).mockResolvedValue(index)

    await engine.upsertGame({ id: 42, title_jp: 'x' } as any)

    expect(meilisearchService.ensureIndex).toHaveBeenCalledWith('games-index', true)
    expect(index.addDocuments).toHaveBeenCalledWith([{ id: 42, title_jp: 'x' }])
    expect(cacheService.delByContains).toHaveBeenCalledWith('game:42')
  })

  it('bulkUpsertGames returns early for empty docs or missing index', async () => {
    const { engine, meilisearchService } = createEngine()
    const index = createIndexMock()

    await expect(engine.bulkUpsertGames([] as any)).resolves.toBeUndefined()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue(null)
    await expect(engine.bulkUpsertGames([{ id: 1 } as any])).resolves.toBeUndefined()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue({})
    ;(meilisearchService.ensureIndex as jest.Mock).mockResolvedValue(index)
    await engine.bulkUpsertGames([{ id: 2 } as any])
    expect(index.addDocuments).toHaveBeenCalledWith([{ id: 2 }])
  })

  it('deleteGame and deleteAllGames no-op when index unavailable', async () => {
    const { engine, meilisearchService } = createEngine()

    ;(meilisearchService.getClient as jest.Mock).mockReturnValue(null)
    await expect(engine.deleteGame(1)).resolves.toBeUndefined()
    await expect(engine.deleteAllGames()).resolves.toBeUndefined()
  })

  it('deleteGame and deleteAllGames delegate to index methods', async () => {
    const { engine, meilisearchService } = createEngine()
    const index = createIndexMock()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue({})
    ;(meilisearchService.ensureIndex as jest.Mock).mockResolvedValue(index)

    await engine.deleteGame(7)
    await engine.deleteAllGames()

    expect(index.deleteDocument).toHaveBeenCalledWith(7)
    expect(index.deleteAllDocuments).toHaveBeenCalledTimes(1)
  })

  it('searchGames returns empty page when no index or no query', async () => {
    const { engine, meilisearchService } = createEngine()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue(null)

    await expect(engine.searchGames({ q: 'x', page: 1, pageSize: 10 } as any)).resolves.toEqual({
      items: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: 10,
        totalPages: 0,
        currentPage: 1,
      },
    })
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue({})
    ;(meilisearchService.ensureIndex as jest.Mock).mockResolvedValue(createIndexMock())
    await expect(engine.searchGames({ q: '', page: 1, pageSize: 10 } as any)).resolves.toEqual({
      items: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: 10,
        totalPages: 0,
        currentPage: 1,
      },
    })
  })

  it('searchGames sanitizes query, applies default nsfw filter, and maps developers', async () => {
    const { engine, meilisearchService } = createEngine()
    const index = createIndexMock()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue({})
    ;(meilisearchService.ensureIndex as jest.Mock).mockResolvedValue(index)
    ;(index.search as jest.Mock).mockResolvedValue({
      hits: [
        {
          id: 5,
          title_jp: 'Title',
          developers: [
            { id: 10, name: 'dev-10' },
            { id: 11, name: 'dev-11' },
          ],
        },
      ],
      totalHits: 3,
      totalPages: undefined,
    })

    const result = await engine.searchGames(
      { q: '  -foo-   bar-- ', page: 2, pageSize: 2 } as any,
      undefined,
    )

    expect(index.search).toHaveBeenCalledWith(
      'foo- bar--',
      expect.objectContaining({
        page: 2,
        hitsPerPage: 2,
        filter: ['nsfw = false', 'max_cover_sexual = 0'],
      }),
    )

    expect(result).toEqual({
      items: [
        {
          id: 5,
          title_jp: 'Title',
          developers: [
            { developer: { id: 10, name: 'dev-10' } },
            { developer: { id: 11, name: 'dev-11' } },
          ],
        },
      ],
      meta: {
        totalItems: 3,
        itemCount: 1,
        itemsPerPage: 2,
        totalPages: 2,
        currentPage: 2,
        content_limit: undefined,
      },
    })
  })

  it('searchGames omits nsfw filter for permissive content limit', async () => {
    const { engine, meilisearchService } = createEngine()
    const index = createIndexMock()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue({})
    ;(meilisearchService.ensureIndex as jest.Mock).mockResolvedValue(index)
    ;(index.search as jest.Mock).mockResolvedValue({ hits: [], totalHits: 0, totalPages: 0 })

    await engine.searchGames(
      { q: 'query', page: 1, pageSize: 10 } as any,
      UserContentLimit.JUST_SHOW,
    )

    expect(index.search).toHaveBeenCalledWith(
      'query',
      expect.objectContaining({
        filter: undefined,
      }),
    )
  })

  it('searchGames supports tag-only filtering and escapes filter value', async () => {
    const { engine, meilisearchService } = createEngine()
    const index = createIndexMock()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue({})
    ;(meilisearchService.ensureIndex as jest.Mock).mockResolvedValue(index)
    ;(index.search as jest.Mock).mockResolvedValue({ hits: [], totalHits: 0, totalPages: 0 })

    await engine.searchGames(
      { tag: 'a"b\\c', page: 1, pageSize: 10 } as any,
      UserContentLimit.JUST_SHOW,
    )

    expect(index.search).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        filter: ['tags = "a\\"b\\\\c"'],
      }),
    )
  })

  it('searchGameTags ranks exact > prefix > count > shorter value', async () => {
    const { engine, meilisearchService } = createEngine()
    const index = createIndexMock()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue({})
    ;(meilisearchService.ensureIndex as jest.Mock).mockResolvedValue(index)
    ;(index.searchForFacetValues as jest.Mock).mockResolvedValue({
      facetHits: [
        { value: 'abc', count: 5 },
        { value: 'ab', count: 1 },
        { value: 'abd', count: 10 },
        { value: 'zab', count: 100 },
      ],
    })

    const tags = await engine.searchGameTags('ab', 3)

    expect(index.searchForFacetValues).toHaveBeenCalledWith({
      facetName: 'tags',
      facetQuery: 'ab',
      hitsPerPage: 3,
    })
    expect(tags).toEqual(['ab', 'abd', 'abc'])
  })

  it('searchGameTags returns empty array when index is unavailable', async () => {
    const { engine, meilisearchService } = createEngine()
    ;(meilisearchService.getClient as jest.Mock).mockReturnValue(null)

    await expect(engine.searchGameTags('tag')).resolves.toEqual([])
  })
})
