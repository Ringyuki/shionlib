import { AdminContentService } from './admin-content.service'

describe('AdminContentService', () => {
  const createService = () => {
    const prisma = {
      game: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      gameCharacter: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      gameDeveloper: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    }

    const adminGameService = {
      updateStatus: jest.fn(),
      editScalar: jest.fn(),
      deleteById: jest.fn(),
      addToRecentUpdate: jest.fn(),
      removeFromRecentUpdate: jest.fn(),
    }

    const gameDownloadResourceReportService = {
      getList: jest.fn(),
      getById: jest.fn(),
      review: jest.fn(),
    }

    const malwareScanCaseService = {
      getList: jest.fn(),
      getById: jest.fn(),
      review: jest.fn(),
    }

    return {
      prisma,
      adminGameService,
      gameDownloadResourceReportService,
      malwareScanCaseService,
      service: new AdminContentService(
        prisma as any,
        adminGameService as any,
        gameDownloadResourceReportService as any,
        malwareScanCaseService as any,
      ),
    }
  }

  it('getGameList builds where/order and maps first cover', async () => {
    const { service, prisma } = createService()
    const created = new Date('2026-02-18T00:00:00.000Z')
    prisma.game.findMany.mockResolvedValue([
      {
        id: 1,
        title_jp: 'jp',
        title_zh: 'zh',
        title_en: 'en',
        status: 1,
        views: 10,
        downloads: 20,
        nsfw: false,
        created,
        updated: created,
        covers: [{ url: 'https://img/1.webp' }],
        creator: { id: 7, name: 'alice' },
      },
    ])
    prisma.game.count.mockResolvedValue(11)

    const result = await service.getGameList({
      page: 2,
      pageSize: 5,
      search: 'abc',
      sortBy: 'id',
      sortOrder: 'desc',
      status: 1,
    } as any)

    expect(prisma.game.findMany).toHaveBeenCalledWith({
      where: {
        status: 1,
        OR: [
          { title_jp: { contains: 'abc', mode: 'insensitive' } },
          { title_zh: { contains: 'abc', mode: 'insensitive' } },
          { title_en: { contains: 'abc', mode: 'insensitive' } },
        ],
      },
      orderBy: { id: 'desc' },
      skip: 5,
      take: 5,
      select: expect.any(Object),
    })
    expect(result).toEqual({
      items: [
        {
          id: 1,
          title_jp: 'jp',
          title_zh: 'zh',
          title_en: 'en',
          status: 1,
          views: 10,
          downloads: 20,
          nsfw: false,
          created,
          updated: created,
          covers: [{ url: 'https://img/1.webp' }],
          creator: { id: 7, name: 'alice' },
          cover: 'https://img/1.webp',
        },
      ],
      meta: {
        totalItems: 11,
        itemCount: 1,
        itemsPerPage: 5,
        totalPages: 3,
        currentPage: 2,
      },
    })
  })

  it('getCharacterList maps _count.games to gamesCount', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z')
    prisma.gameCharacter.findMany.mockResolvedValue([
      {
        id: 3,
        name_jp: 'a',
        name_zh: 'b',
        name_en: 'c',
        image: null,
        gender: 'female',
        created: now,
        updated: now,
        _count: { games: 9 },
      },
    ])
    prisma.gameCharacter.count.mockResolvedValue(1)

    const result = await service.getCharacterList({ page: 1, pageSize: 10, search: 'a' } as any)

    expect(prisma.gameCharacter.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { name_jp: { contains: 'a', mode: 'insensitive' } },
          { name_zh: { contains: 'a', mode: 'insensitive' } },
          { name_en: { contains: 'a', mode: 'insensitive' } },
        ],
      },
      orderBy: { id: 'desc' },
      skip: 0,
      take: 10,
      select: expect.any(Object),
    })
    expect(result.items[0]).toEqual({
      id: 3,
      name_jp: 'a',
      name_zh: 'b',
      name_en: 'c',
      image: undefined,
      gender: 'female',
      gamesCount: 9,
      created: now,
      updated: now,
    })
  })

  it('getDeveloperList maps _count.games and keeps logo optional', async () => {
    const { service, prisma } = createService()
    const now = new Date('2026-02-18T00:00:00.000Z')
    prisma.gameDeveloper.findMany.mockResolvedValue([
      {
        id: 4,
        name: 'dev',
        logo: null,
        created: now,
        updated: now,
        _count: { games: 2 },
      },
    ])
    prisma.gameDeveloper.count.mockResolvedValue(1)

    const result = await service.getDeveloperList({ page: 1, pageSize: 10, search: 'dev' } as any)

    expect(prisma.gameDeveloper.findMany).toHaveBeenCalledWith({
      where: { name: { contains: 'dev', mode: 'insensitive' } },
      orderBy: { id: 'desc' },
      skip: 0,
      take: 10,
      select: expect.any(Object),
    })
    expect(result.items[0]).toEqual({
      id: 4,
      name: 'dev',
      logo: undefined,
      gamesCount: 2,
      created: now,
      updated: now,
    })
  })

  it('delegates game mutation operations to adminGameService', async () => {
    const { service, adminGameService } = createService()

    await service.updateGameStatus(1, 2)
    await service.editGameScalar(2, { title_zh: 'x' })
    await service.deleteGame(3)
    await service.addGameToRecentUpdate(4)
    await service.removeGameFromRecentUpdate(5)

    expect(adminGameService.updateStatus).toHaveBeenCalledWith(1, 2)
    expect(adminGameService.editScalar).toHaveBeenCalledWith(2, { title_zh: 'x' })
    expect(adminGameService.deleteById).toHaveBeenCalledWith(3)
    expect(adminGameService.addToRecentUpdate).toHaveBeenCalledWith(4)
    expect(adminGameService.removeFromRecentUpdate).toHaveBeenCalledWith(5)
  })

  it('delegates report and malware operations to downstream services', async () => {
    const { service, gameDownloadResourceReportService, malwareScanCaseService } = createService()
    const actor = { sub: 1 }

    await service.getDownloadResourceReportList({ page: 1 } as any)
    await service.getDownloadResourceReportDetail(10)
    await service.reviewDownloadResourceReport(10, { decision: 1 } as any, actor as any)

    await service.getMalwareScanCaseList({ page: 1 } as any)
    await service.getMalwareScanCaseDetail(20)
    await service.reviewMalwareScanCase(20, { decision: 1 } as any, actor as any)

    expect(gameDownloadResourceReportService.getList).toHaveBeenCalledWith({ page: 1 })
    expect(gameDownloadResourceReportService.getById).toHaveBeenCalledWith(10)
    expect(gameDownloadResourceReportService.review).toHaveBeenCalledWith(
      10,
      { decision: 1 },
      actor,
    )

    expect(malwareScanCaseService.getList).toHaveBeenCalledWith({ page: 1 })
    expect(malwareScanCaseService.getById).toHaveBeenCalledWith(20)
    expect(malwareScanCaseService.review).toHaveBeenCalledWith(20, { decision: 1 }, actor)
  })
})
