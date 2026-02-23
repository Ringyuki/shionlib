import { ShionConfigService } from '../../../common/config/services/config.service'
import { CacheService } from '../../cache/services/cache.service'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { OpenSearchService } from '../services/opensearch.service'
import { OpenSearchEngine } from './opensearch.engine'

describe('OpenSearchEngine', () => {
  function createEngine() {
    const opensearchService = {
      onModuleInit: jest.fn(),
      getClient: jest.fn(),
      ensureIndex: jest.fn(),
      refresh: jest.fn(),
    } as unknown as OpenSearchService

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'search.opensearch.indexName') return 'games-index'
        return undefined
      }),
    } as unknown as ShionConfigService

    const cacheService = {
      delByContains: jest.fn(),
    } as unknown as CacheService

    const engine = new OpenSearchEngine(opensearchService, configService, cacheService)

    return {
      engine,
      opensearchService,
      cacheService,
    }
  }

  it('calls opensearch service init in constructor', () => {
    const { opensearchService } = createEngine()

    expect(opensearchService.onModuleInit).toHaveBeenCalledTimes(1)
  })

  it('upsertGame no-op when client is missing', async () => {
    const { engine, opensearchService } = createEngine()
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(null)

    await expect(engine.upsertGame({ id: 1 } as any)).resolves.toBeUndefined()
  })

  it('upsertGame ensures index, writes doc and clears cache', async () => {
    const { engine, opensearchService, cacheService } = createEngine()
    const client = {
      index: jest.fn().mockResolvedValue(undefined),
    }
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(client)

    await engine.upsertGame({ id: 7, title_jp: 'x' } as any)

    expect(opensearchService.ensureIndex).toHaveBeenCalledWith('games-index', true)
    expect(client.index).toHaveBeenCalledWith({
      index: 'games-index',
      id: '7',
      body: { id: 7, title_jp: 'x' },
      refresh: false,
    })
    expect(cacheService.delByContains).toHaveBeenCalledWith('game:7')
  })

  it('bulkUpsertGames returns early on empty docs or no client', async () => {
    const { engine, opensearchService } = createEngine()

    await expect(engine.bulkUpsertGames([] as any)).resolves.toBeUndefined()
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(null)
    await expect(engine.bulkUpsertGames([{ id: 1 } as any])).resolves.toBeUndefined()
  })

  it('bulkUpsertGames sends bulk body, logs errors, and refreshes index', async () => {
    const { engine, opensearchService } = createEngine()
    const client = {
      bulk: jest.fn().mockResolvedValue({
        body: {
          errors: true,
          items: [{ index: { error: { type: 'mapper_parsing_exception' } } }],
        },
      }),
    }
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(client)
    const errorSpy = jest.spyOn((engine as any).logger, 'error').mockImplementation()

    await engine.bulkUpsertGames([{ id: 1, title_jp: 'a' } as any, { id: 2, title_jp: 'b' } as any])

    expect(opensearchService.ensureIndex).toHaveBeenCalledWith('games-index', true)
    expect(client.bulk).toHaveBeenCalledWith({
      body: [
        { index: { _index: 'games-index', _id: '1' } },
        { id: 1, title_jp: 'a' },
        { index: { _index: 'games-index', _id: '2' } },
        { id: 2, title_jp: 'b' },
      ],
    })
    expect(errorSpy).toHaveBeenCalledWith(
      'Bulk upsert had errors: {"type":"mapper_parsing_exception"}',
    )
    expect(opensearchService.refresh).toHaveBeenCalledWith('games-index')
  })

  it('deleteGame and deleteAllGames handle missing client', async () => {
    const { engine, opensearchService } = createEngine()
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(null)

    await expect(engine.deleteGame(1)).resolves.toBeUndefined()
    await expect(engine.deleteAllGames()).resolves.toBeUndefined()
  })

  it('deleteGame and deleteAllGames delegate to client', async () => {
    const { engine, opensearchService } = createEngine()
    const client = {
      delete: jest.fn().mockResolvedValue(undefined),
      deleteByQuery: jest.fn().mockResolvedValue(undefined),
    }
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(client)

    await engine.deleteGame(9)
    await engine.deleteAllGames()

    expect(client.delete).toHaveBeenCalledWith({ index: 'games-index', id: '9' })
    expect(opensearchService.ensureIndex).toHaveBeenCalledWith('games-index', true)
    expect(client.deleteByQuery).toHaveBeenCalledWith({
      index: 'games-index',
      body: { query: { match_all: {} } },
      refresh: true,
      conflicts: 'proceed',
    })
  })

  it('searchGames returns empty page when no client or empty query', async () => {
    const { engine, opensearchService } = createEngine()
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(null)

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
    ;(opensearchService.getClient as jest.Mock).mockReturnValue({ search: jest.fn() })
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

  it('searchGames applies filters, highlights and maps response', async () => {
    const { engine, opensearchService } = createEngine()
    const client = {
      search: jest.fn().mockResolvedValue({
        body: {
          hits: {
            total: { value: 3 },
            hits: [
              {
                _source: {
                  id: 1,
                  title_jp: 'raw-title',
                  developers: [{ id: 11, name: 'dev-11' }],
                },
                highlight: {
                  title_jp: ['<span class="search-highlight">title</span>'],
                },
              },
            ],
          },
        },
      }),
    }
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(client)

    const result = await engine.searchGames(
      { q: 'query', tag: 'otome', page: 2, pageSize: 2 } as any,
      UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
    )

    expect(opensearchService.ensureIndex).toHaveBeenCalledWith('games-index', false)
    expect(client.search).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'games-index',
        from: 2,
        size: 2,
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: [
                { term: { nsfw: false } },
                { term: { max_cover_sexual: 0 } },
                { term: { tags: 'otome' } },
              ],
            }),
          }),
        }),
      }),
    )

    expect(result).toEqual({
      items: [
        {
          id: 1,
          title_jp: 'raw-title',
          developers: [{ developer: { id: 11, name: 'dev-11' } }],
          _formatted: {
            title_jp: '<span class="search-highlight">title</span>',
          },
        },
      ],
      meta: {
        totalItems: 3,
        itemCount: 1,
        itemsPerPage: 2,
        totalPages: 2,
        currentPage: 2,
      },
    })
  })

  it('searchGames supports tag-only filtering without multi_match must clause', async () => {
    const { engine, opensearchService } = createEngine()
    const client = {
      search: jest.fn().mockResolvedValue({
        body: {
          hits: {
            total: { value: 0 },
            hits: [],
          },
        },
      }),
    }
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(client)

    await engine.searchGames(
      { tag: 'otome', page: 1, pageSize: 10 } as any,
      UserContentLimit.JUST_SHOW,
    )

    expect(client.search).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: [],
              filter: [{ term: { tags: 'otome' } }],
            }),
          }),
        }),
      }),
    )
  })

  it('searchGameTags returns empty array when client is missing', async () => {
    const { engine, opensearchService } = createEngine()
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(null)

    await expect(engine.searchGameTags('tag')).resolves.toEqual([])
  })

  it('searchGameTags escapes regex, ranks results and respects limit bounds', async () => {
    const { engine, opensearchService } = createEngine()
    const client = {
      search: jest.fn().mockResolvedValue({
        body: {
          aggregations: {
            tag_suggest: {
              buckets: [
                { key: 'a+b', doc_count: 1 },
                { key: 'a+bc', doc_count: 8 },
                { key: 'a+bd', doc_count: 10 },
                { key: 'za+b', doc_count: 100 },
              ],
            },
          },
        },
      }),
    }
    ;(opensearchService.getClient as jest.Mock).mockReturnValue(client)

    const result = await engine.searchGameTags('a+b', 3)

    expect(client.search).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'games-index',
        size: 0,
        body: {
          aggs: {
            tag_suggest: {
              terms: expect.objectContaining({
                field: 'tags',
                size: 15,
                include: 'a\\+b.*',
                order: { _count: 'desc' },
              }),
            },
          },
        },
      }),
    )
    expect(result).toEqual(['a+b', 'a+bd', 'a+bc'])
  })
})
