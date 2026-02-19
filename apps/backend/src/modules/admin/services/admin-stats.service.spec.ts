import { AdminStatsService } from './admin-stats.service'

describe('AdminStatsService', () => {
  const createService = () => {
    const prisma = {
      game: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
      gameCharacter: {
        count: jest.fn(),
      },
      gameDeveloper: {
        count: jest.fn(),
      },
      comment: {
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
    }

    const cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    }

    return {
      prisma,
      cacheManager,
      service: new AdminStatsService(prisma as any, cacheManager as any),
    }
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-02-18T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('returns cached overview when available', async () => {
    const { service, cacheManager, prisma } = createService()
    const cached = {
      totalGames: 1,
      totalUsers: 2,
      totalDownloads: 3,
      totalViews: 4,
      totalCharacters: 5,
      totalDevelopers: 6,
      totalComments: 7,
      newGamesToday: 8,
      newUsersToday: 9,
    }
    cacheManager.get.mockResolvedValue(cached)

    const result = await service.getOverview()

    expect(result).toEqual(cached)
    expect(cacheManager.get).toHaveBeenCalledWith('admin:stats:overview')
    expect(prisma.game.count).not.toHaveBeenCalled()
    expect(cacheManager.set).not.toHaveBeenCalled()
  })

  it('computes overview and caches result on miss', async () => {
    const { service, cacheManager, prisma } = createService()
    cacheManager.get.mockResolvedValue(undefined)

    prisma.game.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2)
    prisma.user.count.mockResolvedValueOnce(20).mockResolvedValueOnce(3)
    prisma.gameCharacter.count.mockResolvedValue(30)
    prisma.gameDeveloper.count.mockResolvedValue(40)
    prisma.comment.count.mockResolvedValue(50)
    prisma.game.aggregate.mockResolvedValueOnce({ _sum: { downloads: null } })
    prisma.game.aggregate.mockResolvedValueOnce({ _sum: { views: 88 } })

    const result = await service.getOverview()

    expect(result).toEqual({
      totalGames: 10,
      totalUsers: 20,
      totalDownloads: 0,
      totalViews: 88,
      totalCharacters: 30,
      totalDevelopers: 40,
      totalComments: 50,
      newGamesToday: 2,
      newUsersToday: 3,
    })
    expect(cacheManager.set).toHaveBeenCalledWith('admin:stats:overview', result, 5 * 60 * 1000)
  })

  it('returns cached trends when available', async () => {
    const { service, cacheManager, prisma } = createService()
    const cached = [
      {
        date: '2026-02-18',
        games: 1,
        users: 2,
        downloads: 0,
        views: 0,
      },
    ]
    cacheManager.get.mockResolvedValue(cached)

    const result = await service.getTrends(7)

    expect(result).toEqual(cached)
    expect(cacheManager.get).toHaveBeenCalledWith('admin:stats:trends:7')
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('builds trends with zero-filling and caches the list', async () => {
    const { service, cacheManager, prisma } = createService()
    cacheManager.get.mockResolvedValue(undefined)
    prisma.$queryRaw
      .mockResolvedValueOnce([{ date: '2026-02-17', count: 2n }])
      .mockResolvedValueOnce([{ date: '2026-02-18', count: 3n }])

    const result = await service.getTrends(3)

    expect(result).toEqual([
      { date: '2026-02-16', games: 0, users: 0, downloads: 0, views: 0 },
      { date: '2026-02-17', games: 2, users: 0, downloads: 0, views: 0 },
      { date: '2026-02-18', games: 0, users: 3, downloads: 0, views: 0 },
    ])
    expect(cacheManager.set).toHaveBeenCalledWith('admin:stats:trends:3', result, 5 * 60 * 1000)
  })
})
