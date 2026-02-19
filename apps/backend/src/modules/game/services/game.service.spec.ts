import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { UserContentLimit } from '../../user/interfaces/user.interface'
import { RECENT_UPDATE_KEY } from '../constants/recent-update.constant'
import { GameService } from './game.service'

describe('GameService', () => {
  const createService = () => {
    const prisma = {
      game: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
    }

    const cacheService = {
      zremrangebyscore: jest.fn(),
      zrangeWithScores: jest.fn(),
      zcard: jest.fn(),
    }

    return {
      prisma,
      cacheService,
      service: new GameService(prisma as any, cacheService as any),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getById throws when game not found or blocked by content limit', async () => {
    const { service, prisma } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(service.getById(1, UserContentLimit.SHOW_WITH_SPOILER)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({
      nsfw: true,
      covers: [{ sexual: 1 }],
    })
    await expect(
      service.getById(1, UserContentLimit.NEVER_SHOW_NSFW_CONTENT),
    ).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
  })

  it('getById returns game and switches image select by content limit', async () => {
    const { service, prisma } = createService()

    prisma.game.findUnique
      .mockResolvedValueOnce({ nsfw: false, covers: [{ sexual: 0 }] })
      .mockResolvedValueOnce({
        title_jp: 'a',
        images: [{ url: 'u1' }],
      })
    await expect(service.getById(1, UserContentLimit.SHOW_WITH_SPOILER)).resolves.toEqual(
      expect.objectContaining({
        title_jp: 'a',
        content_limit: UserContentLimit.SHOW_WITH_SPOILER,
      }),
    )
    expect(prisma.game.findUnique.mock.calls[1][0].select.images).toBeDefined()

    jest.clearAllMocks()
    prisma.game.findUnique
      .mockResolvedValueOnce({ nsfw: false, covers: [{ sexual: 0 }] })
      .mockResolvedValueOnce({
        title_jp: 'b',
      })
    await service.getById(2, UserContentLimit.NEVER_SHOW_NSFW_CONTENT)
    expect(prisma.game.findUnique.mock.calls[1][0].select.images).toBeUndefined()
  })

  it('getHeader/getDetails/getCharacters return data with expected select behavior', async () => {
    const { service, prisma } = createService()

    prisma.game.findUnique
      .mockResolvedValueOnce({ nsfw: false, covers: [{ sexual: 0 }] })
      .mockResolvedValueOnce({
        id: 1,
        title_jp: 'header',
      })
    await expect(service.getHeader(1, UserContentLimit.SHOW_WITH_SPOILER)).resolves.toEqual(
      expect.objectContaining({
        id: 1,
        content_limit: UserContentLimit.SHOW_WITH_SPOILER,
      }),
    )

    jest.clearAllMocks()
    prisma.game.findUnique
      .mockResolvedValueOnce({ nsfw: false, covers: [{ sexual: 0 }] })
      .mockResolvedValueOnce({
        id: 1,
        images: [{ url: 'a' }],
      })
    await service.getDetails(1, UserContentLimit.NEVER_SHOW_NSFW_CONTENT)
    expect(prisma.game.findUnique.mock.calls[1][0].select.images.where).toEqual({
      sexual: { in: [0] },
    })

    jest.clearAllMocks()
    prisma.game.findUnique
      .mockResolvedValueOnce({ nsfw: false, covers: [{ sexual: 0 }] })
      .mockResolvedValueOnce({
        id: 1,
        images: [{ url: 'all' }],
      })
    await service.getDetails(1, UserContentLimit.SHOW_WITH_SPOILER)
    expect(prisma.game.findUnique.mock.calls[1][0].select.images.where).toBeUndefined()

    jest.clearAllMocks()
    prisma.game.findUnique
      .mockResolvedValueOnce({ nsfw: false, covers: [{ sexual: 0 }] })
      .mockResolvedValueOnce({
        characters: [{ role: 'main' }],
      })
    await expect(service.getCharacters(1, UserContentLimit.SHOW_WITH_SPOILER)).resolves.toEqual({
      characters: [{ role: 'main' }],
    })
  })

  it('getList applies default safe-content filter and default ordering', async () => {
    const { service, prisma } = createService()
    prisma.game.count.mockResolvedValueOnce(3)
    prisma.game.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])

    const result = await service.getList({ page: 2, pageSize: 2 } as any)

    expect(prisma.game.count).toHaveBeenCalledWith({
      where: {
        status: 1,
        nsfw: { not: true },
        covers: { every: { sexual: { in: [0] } } },
      },
    })
    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2,
        take: 2,
        orderBy: [{ release_date_tba: 'asc' }, { release_date: 'desc' }, { id: 'desc' }],
      }),
    )
    expect(result.meta).toEqual({
      totalItems: 3,
      itemCount: 2,
      itemsPerPage: 2,
      totalPages: 2,
      currentPage: 2,
      content_limit: undefined,
    })
  })

  it('getList applies producer/character/tag/date/sort filters', async () => {
    const { service, prisma } = createService()
    prisma.game.count.mockResolvedValueOnce(1)
    prisma.game.findMany.mockResolvedValueOnce([{ id: 10 }])

    await service.getList(
      { page: 1, pageSize: 5 } as any,
      UserContentLimit.SHOW_WITH_SPOILER,
      11,
      22,
      {
        tags: ['avg', 'gal'],
        start_date: '2026-12-31',
        end_date: '2026-01-01',
        sort_by: 'views',
        sort_order: 'asc',
      } as any,
    )

    const where = prisma.game.count.mock.calls[0][0].where
    expect(where.status).toBe(1)
    expect(where.developers).toEqual({ some: { developer: { id: 11 } } })
    expect(where.characters).toEqual({ some: { character: { id: 22 } } })
    expect(where.tags).toEqual({ hasSome: ['avg', 'gal'] })
    expect(where.release_date.gte.getTime()).toBe(new Date('2026-01-01').getTime())
    expect(where.release_date.lte.getTime()).toBe(new Date('2026-12-31').getTime())
    expect(where.release_date_tba).toEqual({ not: true })
    expect(where.nsfw).toBeUndefined()
    expect(prisma.game.findMany.mock.calls[0][0].orderBy).toEqual([
      { release_date_tba: 'asc' },
      { views: 'asc' },
      { id: 'desc' },
    ])
  })

  it('getList applies year/month date filter branch', async () => {
    const { service, prisma } = createService()
    prisma.game.count.mockResolvedValueOnce(0)
    prisma.game.findMany.mockResolvedValueOnce([])

    await service.getList(
      { page: 1, pageSize: 10 } as any,
      UserContentLimit.SHOW_WITH_SPOILER,
      undefined,
      undefined,
      { years: [2025], months: [2] } as any,
    )

    const where = prisma.game.count.mock.calls[0][0].where
    expect(where.release_date_tba).toEqual({ not: true })
    expect(where.AND).toBeDefined()
  })

  it('getRecentUpdate purges expired, queries cache, preserves score order and applies safe-content filter', async () => {
    const { service, prisma, cacheService } = createService()
    cacheService.zrangeWithScores.mockResolvedValueOnce([
      { member: '2', score: 20 },
      { member: '1', score: 10 },
      { member: '9', score: 1 },
    ])
    cacheService.zcard.mockResolvedValueOnce(3)
    prisma.game.findMany.mockResolvedValueOnce([
      { id: 1, title_jp: 'g1' },
      { id: 2, title_jp: 'g2' },
    ])

    const result = await service.getRecentUpdate({ page: 1, pageSize: 3 } as any)

    expect(cacheService.zremrangebyscore).toHaveBeenCalledWith(
      RECENT_UPDATE_KEY,
      '-inf',
      expect.any(Number),
    )
    expect(cacheService.zrangeWithScores).toHaveBeenCalledWith(RECENT_UPDATE_KEY, 0, 2, 'DESC')
    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [2, 1, 9] },
          status: 1,
          nsfw: { not: true },
          covers: { every: { sexual: { in: [0] } } },
        },
      }),
    )
    expect(result.items.map(v => v.id)).toEqual([2, 1])
    expect(result.meta).toEqual({
      totalItems: 3,
      itemCount: 2,
      itemsPerPage: 3,
      totalPages: 1,
      currentPage: 1,
    })
  })

  it('getRecentUpdate can include nsfw when content limit allows it', async () => {
    const { service, prisma, cacheService } = createService()
    cacheService.zrangeWithScores.mockResolvedValueOnce([{ member: '5', score: 1 }])
    cacheService.zcard.mockResolvedValueOnce(1)
    prisma.game.findMany.mockResolvedValueOnce([{ id: 5 }])

    await service.getRecentUpdate(
      { page: 1, pageSize: 1 } as any,
      UserContentLimit.SHOW_WITH_SPOILER,
    )

    const where = prisma.game.findMany.mock.calls[0][0].where
    expect(where.nsfw).toBeUndefined()
    expect(where.covers).toBeUndefined()
  })

  it('increaseViews increments game view count', async () => {
    const { service, prisma } = createService()

    await service.increaseViews(77)

    expect(prisma.game.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { views: { increment: 1 } },
      select: { views: true },
    })
  })

  it('getRandomGameId handles empty set, missing item, nsfw limit and success path', async () => {
    const { service, prisma } = createService()
    const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.4)

    prisma.game.count.mockResolvedValueOnce(0)
    await expect(service.getRandomGameId({ user: { content_limit: 2 } } as any)).resolves.toBeNull()

    prisma.game.count.mockResolvedValueOnce(5)
    prisma.game.findFirst.mockResolvedValueOnce(null)
    await expect(service.getRandomGameId({ user: { content_limit: 2 } } as any)).resolves.toBeNull()

    prisma.game.count.mockResolvedValueOnce(5)
    prisma.game.findFirst.mockResolvedValueOnce({
      id: 9,
      nsfw: true,
      covers: [{ sexual: 1 }],
    })
    await expect(
      service.getRandomGameId({
        user: { content_limit: UserContentLimit.NEVER_SHOW_NSFW_CONTENT },
      } as any),
    ).resolves.toBeNull()

    prisma.game.count.mockResolvedValueOnce(5)
    prisma.game.findFirst.mockResolvedValueOnce({
      id: 10,
      nsfw: false,
      covers: [{ sexual: 0 }],
    })
    await expect(service.getRandomGameId({ user: { content_limit: 2 } } as any)).resolves.toBe(10)

    expect(prisma.game.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { status: 1 },
        orderBy: { id: 'asc' },
        skip: 2,
      }),
    )

    mathRandomSpy.mockRestore()
  })
})
