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
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    }

    const hikarinagiMappingService = {
      resolveByBangumiId: jest.fn().mockResolvedValue(null),
    }

    const hikarinagiClient = {
      galgameDetail: jest.fn().mockResolvedValue(null),
      galgameIds: jest.fn().mockResolvedValue({ ids: [] }),
      safeGalgameIds: jest.fn().mockResolvedValue(null),
      galgameBatch: jest.fn().mockResolvedValue([]),
    }

    return {
      prisma,
      cacheService,
      hikarinagiMappingService,
      hikarinagiClient,
      service: new GameService(
        prisma as any,
        cacheService as any,
        hikarinagiMappingService as any,
        hikarinagiClient as any,
      ),
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

  it('getById reads the detail and its tags through hikarinagi', async () => {
    const { service, prisma, hikarinagiClient } = createService()

    const bundle = {
      galgame: {
        origin_title: 'げーむ',
        trans_title: '游戏',
        en_title: null,
        origin_intro: 'しょうかい',
        trans_intro: '简介',
        en_intro: null,
        origin_lang: 'ja',
        covers: [
          {
            votes: 1,
            language: 'ja',
            kind: 'PKGFRONT',
            media: { id: 1, src: 'covers/a.webp', width: 800, height: 600, sexual: 0, violence: 0 },
          },
        ],
        images: [{ id: 2, src: 'images/b.webp', width: 100, height: 200, sexual: 0, violence: 0 }],
      },
      producers: [{ role: 'DEVELOPER', note: '', producer: { id: 7, name: 'brand', logo: null } }],
      characters: [],
      staff: [],
      relations: [],
      tags: [{ tag: { id: 5, name: 'ADV', aliases: [], count: 12 } }],
    }

    prisma.game.findUnique.mockResolvedValueOnce({ h_id: 42 })
    hikarinagiClient.galgameDetail.mockResolvedValueOnce(bundle)

    const res: any = await service.getById(1, UserContentLimit.SHOW_WITH_SPOILER)
    expect(hikarinagiClient.galgameDetail).toHaveBeenCalledWith(42)
    expect(res.title_jp).toBe('げーむ')
    expect(res.title_zh).toBe('游戏')
    expect(res.covers[0]).toEqual(
      expect.objectContaining({ url: 'covers/a.webp', language: 'jp', type: 'pkgfront' }),
    )
    expect(res.developers[0].developer.name).toBe('brand')
    expect(res.tags).toEqual([
      { tag_alias: null, tag: { id: 5, name: 'ADV', aliases: [], count: 12 } },
    ])
    expect(res.images).toHaveLength(1)
  })

  it('getById omits images for the strictest content limit', async () => {
    const { service, prisma, hikarinagiClient } = createService()

    prisma.game.findUnique.mockResolvedValueOnce({ h_id: 43 })
    hikarinagiClient.galgameDetail.mockResolvedValueOnce({
      galgame: { origin_title: 'x', origin_lang: 'ja', covers: [], images: [{ id: 1, src: 'i' }] },
      producers: [],
      characters: [],
      staff: [],
      relations: [],
      tags: [],
    })

    const res: any = await service.getById(2, UserContentLimit.NEVER_SHOW_NSFW_CONTENT)
    expect(res.images).toBeUndefined()
  })

  it('getHeader/getDetails/getCharacters read through hikarinagi and filter images by limit', async () => {
    const { service, prisma, hikarinagiClient } = createService()
    const bundle = {
      galgame: {
        origin_title: 'header',
        origin_lang: 'ja',
        aliases: [],
        platforms: ['win'],
        covers: [],
        images: [
          { id: 1, src: 'safe.webp', width: 1, height: 1, sexual: 0, violence: 0 },
          { id: 2, src: 'adult.webp', width: 1, height: 1, sexual: 2, violence: 0 },
        ],
      },
      producers: [],
      characters: [{ role: 'MAIN', actors: [], character: { id: 9, name: 'c', aliases: [] } }],
      staff: [],
      relations: [],
      tags: [],
    }
    hikarinagiClient.galgameDetail.mockResolvedValue(bundle)

    prisma.game.findUnique.mockResolvedValueOnce({ id: 1, h_id: 77, extra_info: null })
    const header: any = await service.getHeader(1, UserContentLimit.SHOW_WITH_SPOILER)
    expect(header).toEqual(
      expect.objectContaining({ id: 1, title_jp: 'header', platform: ['win'] }),
    )

    jest.clearAllMocks()
    hikarinagiClient.galgameDetail.mockResolvedValue(bundle)
    prisma.game.findUnique.mockResolvedValueOnce({ id: 1, h_id: 77, extra_info: null })
    const strict: any = await service.getDetails(1, UserContentLimit.NEVER_SHOW_NSFW_CONTENT)
    expect(strict.images.map((i: any) => i.url)).toEqual(['safe.webp'])

    jest.clearAllMocks()
    hikarinagiClient.galgameDetail.mockResolvedValue(bundle)
    prisma.game.findUnique.mockResolvedValueOnce({ id: 1, h_id: 77, extra_info: null })
    const loose: any = await service.getDetails(1, UserContentLimit.SHOW_WITH_SPOILER)
    expect(loose.images).toHaveLength(2)

    jest.clearAllMocks()
    hikarinagiClient.galgameDetail.mockResolvedValue(bundle)
    prisma.game.findUnique.mockResolvedValueOnce({ id: 1, h_id: 77, extra_info: null })
    const chars: any = await service.getCharacters(1, UserContentLimit.SHOW_WITH_SPOILER)
    expect(chars.characters).toHaveLength(1)
  })

  it('gates the detail on hikarinagi nsfw, not on any local column', async () => {
    const { service, prisma, hikarinagiClient } = createService()
    prisma.game.findUnique.mockResolvedValue({ id: 1, h_id: 42, extra_info: null })
    hikarinagiClient.galgameDetail.mockResolvedValue({
      galgame: { origin_title: 'x', origin_lang: 'ja', nsfw: true, covers: [], images: [] },
      characters: [],
      staff: [],
      producers: [],
      relations: [],
      tags: [],
    })

    await expect(
      service.getById(1, UserContentLimit.NEVER_SHOW_NSFW_CONTENT),
    ).rejects.toMatchObject({ code: ShionBizCode.GAME_NOT_FOUND })
    await expect(service.getById(1, UserContentLimit.JUST_SHOW)).resolves.toBeDefined()

    expect(prisma.game.findUnique).toHaveBeenCalledWith({
      where: { id: 1, status: 1 },
      select: { id: true, v_id: true, b_id: true, h_id: true, extra_info: true },
    })
  })

  it('hides a work with any rated cover from a guest, even when nsfw is false', async () => {
    const { service, prisma, hikarinagiClient } = createService()
    prisma.game.findUnique.mockResolvedValue({ id: 1, h_id: 42, extra_info: null })
    hikarinagiClient.galgameDetail.mockResolvedValue({
      galgame: {
        origin_title: 'x',
        origin_lang: 'ja',
        nsfw: false,
        covers: [{ language: 'ja', kind: 'PACKAGE_FRONT', media: { src: 'a', sexual: 1 } }],
        images: [],
      },
      characters: [],
      staff: [],
      producers: [],
      relations: [],
      tags: [],
    })

    await expect(service.getById(1, 0)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
    await expect(service.getById(1, UserContentLimit.JUST_SHOW)).resolves.toBeDefined()
  })

  it('getList takes candidates from hikarinagi and orders release_date by that order', async () => {
    const { service, prisma, hikarinagiClient } = createService()
    hikarinagiClient.galgameIds.mockResolvedValueOnce({ ids: [77, 55, 33] })
    prisma.game.findMany.mockResolvedValueOnce([
      { id: 3, h_id: 33, views: 0 },
      { id: 1, h_id: 77, views: 0 },
      { id: 2, h_id: 55, views: 0 },
    ])

    const result = await service.getList({ page: 2, pageSize: 2 } as any)

    expect(hikarinagiClient.galgameIds).toHaveBeenCalledWith(
      expect.objectContaining({
        sort_order: undefined,
        content_limit: undefined,
        exclude_rated_covers: true,
      }),
    )
    expect(prisma.game.findMany).toHaveBeenCalledWith({
      where: { status: 1, h_id: { in: [77, 55, 33] } },
      select: { id: true, h_id: true, views: true },
    })
    expect(prisma.game.count).not.toHaveBeenCalled()
    expect(hikarinagiClient.galgameBatch).toHaveBeenCalledWith([33])
    expect(result.meta).toEqual({
      totalItems: 3,
      itemCount: 1,
      itemsPerPage: 2,
      totalPages: 2,
      currentPage: 2,
      content_limit: undefined,
    })
  })

  it('getList short-circuits when hikarinagi has no candidate', async () => {
    const { service, prisma, hikarinagiClient } = createService()
    hikarinagiClient.galgameIds.mockResolvedValueOnce({ ids: [] })

    const result = await service.getList({ page: 1, pageSize: 10 } as any)

    expect(prisma.game.findMany).not.toHaveBeenCalled()
    expect(result.items).toEqual([])
    expect(result.meta.totalItems).toBe(0)
  })

  it('getList forwards entity, tag, platform and date filters to hikarinagi', async () => {
    const { service, prisma, hikarinagiClient } = createService()
    hikarinagiClient.galgameIds.mockResolvedValueOnce({ ids: [9] })
    prisma.game.count.mockResolvedValueOnce(1)
    prisma.game.findMany.mockResolvedValueOnce([{ id: 10, h_id: 9, views: 4 }])

    await service.getList(
      {
        page: 1,
        pageSize: 5,
        developer_id: 11,
        character_id: 22,
        filter: {
          tags: ['avg', 'gal'],
          exclude_tags: ['nukige'],
          platforms: ['win'],
          start_date: new Date('2026-01-01'),
          end_date: new Date('2026-12-31'),
          sort_by: 'views',
          sort_order: 'asc',
        },
      } as any,
      UserContentLimit.SHOW_WITH_SPOILER,
    )

    expect(hikarinagiClient.galgameIds).toHaveBeenCalledWith({
      producer_id: 11,
      character_id: 22,
      content_limit: UserContentLimit.SHOW_WITH_SPOILER,
      tags: ['avg', 'gal'],
      exclude_tags: ['nukige'],
      platforms: ['win'],
      release_periods: undefined,
      released_after: new Date('2026-01-01').toISOString(),
      released_before: new Date('2026-12-31').toISOString(),
      sort_order: undefined,
      exclude_rated_covers: false,
    })
    expect(prisma.game.count).toHaveBeenCalledWith({
      where: { status: 1, h_id: { in: [9] } },
    })
    expect(prisma.game.findMany.mock.calls[0][0].orderBy).toEqual([
      { views: 'asc' },
      { id: 'desc' },
    ])
  })

  it('getList converts the year/month filter into hikarinagi release periods', async () => {
    const { service, hikarinagiClient } = createService()
    hikarinagiClient.galgameIds.mockResolvedValueOnce({ ids: [] })

    await service.getList(
      { page: 1, pageSize: 10, filter: { years: [2025], months: [2] } } as any,
      UserContentLimit.SHOW_WITH_SPOILER,
    )

    expect(hikarinagiClient.galgameIds).toHaveBeenCalledWith(
      expect.objectContaining({ release_periods: ['2025-02'] }),
    )
  })

  it('getRecentUpdate purges expired, queries cache, preserves score order and keeps only hikarinagi-safe games', async () => {
    const { service, prisma, cacheService, hikarinagiClient } = createService()
    hikarinagiClient.safeGalgameIds.mockResolvedValueOnce([11, 22])
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
          h_id: { in: [11, 22] },
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

  it('getRecentUpdate applies no safe-id filter when the content limit allows nsfw', async () => {
    const { service, prisma, cacheService, hikarinagiClient } = createService()
    hikarinagiClient.safeGalgameIds.mockResolvedValueOnce(null)
    cacheService.zrangeWithScores.mockResolvedValueOnce([{ member: '5', score: 1 }])
    cacheService.zcard.mockResolvedValueOnce(1)
    prisma.game.findMany.mockResolvedValueOnce([{ id: 5 }])

    await service.getRecentUpdate(
      { page: 1, pageSize: 1 } as any,
      UserContentLimit.SHOW_WITH_SPOILER,
    )

    const where = prisma.game.findMany.mock.calls[0][0].where
    expect(where.h_id).toBeUndefined()
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

  it('getRandomGameId draws only from the hikarinagi-safe set', async () => {
    const { service, prisma, hikarinagiClient } = createService()
    const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.4)
    hikarinagiClient.safeGalgameIds.mockResolvedValue([11, 22])

    prisma.game.count.mockResolvedValueOnce(0)
    await expect(service.getRandomGameId({ user: { content_limit: 1 } } as any)).resolves.toBeNull()

    prisma.game.count.mockResolvedValueOnce(5)
    prisma.game.findFirst.mockResolvedValueOnce(null)
    await expect(service.getRandomGameId({ user: { content_limit: 1 } } as any)).resolves.toBeNull()

    prisma.game.count.mockResolvedValueOnce(5)
    prisma.game.findFirst.mockResolvedValueOnce({ id: 10 })
    await expect(service.getRandomGameId({ user: { content_limit: 1 } } as any)).resolves.toBe(10)

    expect(prisma.game.findFirst).toHaveBeenLastCalledWith({
      where: { status: 1, h_id: { in: [11, 22] } },
      select: { id: true },
      orderBy: { id: 'asc' },
      skip: 2,
    })

    mathRandomSpy.mockRestore()
  })

  it('getRandomGameId drops the safe-id filter for a permissive content limit', async () => {
    const { service, prisma, hikarinagiClient } = createService()
    const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0)
    hikarinagiClient.safeGalgameIds.mockResolvedValue(null)
    prisma.game.count.mockResolvedValueOnce(1)
    prisma.game.findFirst.mockResolvedValueOnce({ id: 3 })

    await expect(
      service.getRandomGameId({ user: { content_limit: UserContentLimit.JUST_SHOW } } as any),
    ).resolves.toBe(3)
    expect(prisma.game.count).toHaveBeenLastCalledWith({ where: { status: 1 } })

    mathRandomSpy.mockRestore()
  })

  it('getHeader returns the stored h_id without calling hikarinagi', async () => {
    const { service, prisma, hikarinagiMappingService, hikarinagiClient } = createService()
    hikarinagiClient.galgameDetail.mockResolvedValue({
      galgame: {
        origin_title: 'x',
        origin_lang: 'ja',
        aliases: [],
        covers: [],
        images: [],
        platforms: [],
      },
      producers: [],
      characters: [],
      staff: [],
      relations: [],
      tags: [],
    })

    prisma.game.findUnique.mockResolvedValueOnce({ id: 1, b_id: '123456', h_id: 8001 })

    await expect(service.getHeader(1, UserContentLimit.SHOW_WITH_SPOILER)).resolves.toEqual(
      expect.objectContaining({ h_id: 8001 }),
    )
    expect(hikarinagiMappingService.resolveByBangumiId).not.toHaveBeenCalled()
  })

  it('getHeader resolves h_id from hikarinagi when it is not stored yet', async () => {
    const { service, prisma, hikarinagiMappingService, hikarinagiClient } = createService()
    hikarinagiMappingService.resolveByBangumiId.mockResolvedValue(8002)
    hikarinagiClient.galgameDetail.mockResolvedValue({
      galgame: {
        origin_title: 'x',
        origin_lang: 'ja',
        aliases: [],
        covers: [],
        images: [],
        platforms: [],
      },
      producers: [],
      characters: [],
      staff: [],
      relations: [],
      tags: [],
    })

    prisma.game.findUnique.mockResolvedValueOnce({ id: 1, b_id: '123456', h_id: null })

    await expect(service.getHeader(1, UserContentLimit.SHOW_WITH_SPOILER)).resolves.toEqual(
      expect.objectContaining({ h_id: 8002 }),
    )
    expect(hikarinagiMappingService.resolveByBangumiId).toHaveBeenCalledWith(1, '123456')
  })

  it('getHeader rejects an unmappable game — read-through has no content source', async () => {
    const { service, prisma, hikarinagiMappingService } = createService()

    prisma.game.findUnique.mockResolvedValueOnce({ id: 1, b_id: null, h_id: null })

    await expect(service.getHeader(1, UserContentLimit.SHOW_WITH_SPOILER)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })
    expect(hikarinagiMappingService.resolveByBangumiId).not.toHaveBeenCalled()
  })
})
