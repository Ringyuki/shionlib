import { PrismaService } from '../../../prisma.service'
import { CacheService } from '../../cache/services/cache.service'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { PgSearchEngine } from './pg.engine'

describe('PgSearchEngine', () => {
  function createEngine() {
    const prisma = {
      game: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService

    const cacheService = {
      delByContains: jest.fn(),
    } as unknown as CacheService

    const engine = new PgSearchEngine(prisma, cacheService)

    return {
      engine,
      prisma,
      cacheService,
    }
  }

  it('upsertGame clears related cache key', async () => {
    const { engine, cacheService } = createEngine()

    await engine.upsertGame({ id: 10 } as any)

    expect(cacheService.delByContains).toHaveBeenCalledWith('game:10')
  })

  it('searchGames returns empty page when query text is missing', async () => {
    const { engine, prisma } = createEngine()

    const result = await engine.searchGames({ q: '', page: 1, pageSize: 20 } as any)

    expect(prisma.game.count).not.toHaveBeenCalled()
    expect(prisma.game.findMany).not.toHaveBeenCalled()
    expect(result).toEqual({
      items: [],
      meta: {
        totalItems: 0,
        itemCount: 0,
        itemsPerPage: 20,
        totalPages: 0,
        currentPage: 1,
      },
    })
  })

  it('searchGames applies nsfw filters for restricted content limit', async () => {
    const { engine, prisma } = createEngine()
    ;(prisma.game.count as jest.Mock).mockResolvedValue(3)
    ;(prisma.game.findMany as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }])

    const result = await engine.searchGames({
      q: 'otome',
      page: 2,
      pageSize: 2,
      content_limit: UserContentLimit.NEVER_SHOW_NSFW_CONTENT,
    } as any)

    expect(prisma.game.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        nsfw: { not: true },
        covers: { every: { sexual: { in: [0] } } },
        OR: expect.any(Array),
      }),
    })

    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2,
        take: 2,
      }),
    )

    expect(result).toEqual({
      items: [{ id: 1 }, { id: 2 }],
      meta: {
        totalItems: 3,
        itemCount: 2,
        itemsPerPage: 2,
        totalPages: 2,
        currentPage: 2,
      },
    })
  })

  it('searchGames omits nsfw filter when content limit allows more', async () => {
    const { engine, prisma } = createEngine()
    ;(prisma.game.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.game.findMany as jest.Mock).mockResolvedValue([{ id: 9 }])

    await engine.searchGames({
      q: 'galgame',
      page: 1,
      pageSize: 10,
      content_limit: UserContentLimit.JUST_SHOW,
    } as any)

    const countArg = (prisma.game.count as jest.Mock).mock.calls[0][0]
    expect(countArg.where.nsfw).toBeUndefined()
    expect(countArg.where.covers).toBeUndefined()
    expect(countArg.where.OR).toHaveLength(11)
  })

  it('searchGames supports tag-only filtering', async () => {
    const { engine, prisma } = createEngine()
    ;(prisma.game.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.game.findMany as jest.Mock).mockResolvedValue([{ id: 12 }])

    await engine.searchGames({
      tag: 'otome',
      page: 1,
      pageSize: 10,
    } as any)

    const countArg = (prisma.game.count as jest.Mock).mock.calls[0][0]
    expect(countArg.where.tags).toEqual({ has: 'otome' })
    expect(countArg.where.OR).toBeUndefined()
  })

  it('no-op mutation methods and tags search return defaults', async () => {
    const { engine } = createEngine()

    await expect(engine.bulkUpsertGames()).resolves.toBeUndefined()
    await expect(engine.deleteGame()).resolves.toBeUndefined()
    await expect(engine.deleteAllGames()).resolves.toBeUndefined()
    await expect(engine.searchGameTags()).resolves.toEqual([])
  })
})
