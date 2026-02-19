import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { GameScoreService } from './game-score.service'

describe('GameScoreService', () => {
  const createService = () => {
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    }
    const prisma = {
      game: {
        findUnique: jest.fn(),
      },
    }
    const bangumiService = {
      bangumiRequest: jest.fn(),
    }
    const vndbService = {
      vndbRequest: jest.fn(),
    }

    const service = new GameScoreService(
      cacheService as any,
      prisma as any,
      bangumiService as any,
      vndbService as any,
    )

    return {
      cacheService,
      prisma,
      bangumiService,
      vndbService,
      service,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getBangumiScore validates game existence and missing b_id', async () => {
    const { service, prisma } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(service.getBangumiScore(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({ b_id: null })
    await expect(service.getBangumiScore(1)).resolves.toBeNull()
  })

  it('getBangumiScore returns cached score when present', async () => {
    const { service, prisma, cacheService, bangumiService } = createService()
    const cached = { rating: { score: 8.7 }, id: 1234 }

    prisma.game.findUnique.mockResolvedValueOnce({ b_id: '1234' })
    cacheService.get.mockResolvedValueOnce(cached)

    await expect(service.getBangumiScore(1)).resolves.toBe(cached)
    expect(cacheService.get).toHaveBeenCalledWith('game:score:bangumi:1234')
    expect(bangumiService.bangumiRequest).not.toHaveBeenCalled()
  })

  it('getBangumiScore fetches from API and caches on miss', async () => {
    const { service, prisma, cacheService, bangumiService } = createService()
    const rating = {
      rank: 1,
      total: 10,
      count: { '10': 1, '9': 2, '8': 3, '7': 4, '6': 0, '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
      score: 8.9,
    }

    prisma.game.findUnique.mockResolvedValueOnce({ b_id: '5678' })
    cacheService.get.mockResolvedValueOnce(null)
    bangumiService.bangumiRequest.mockResolvedValueOnce({
      rating,
      id: 5678,
    })

    await expect(service.getBangumiScore(1)).resolves.toEqual({ rating, id: 5678 })
    expect(bangumiService.bangumiRequest).toHaveBeenCalledWith(
      'https://api.bgm.tv/v0/subjects/5678',
    )
    expect(cacheService.set).toHaveBeenCalledWith(
      'game:score:bangumi:5678',
      { rating, id: 5678 },
      60 * 60 * 24 * 7 * 1000,
    )
  })

  it('getVNDBScore validates game existence and missing v_id', async () => {
    const { service, prisma } = createService()

    prisma.game.findUnique.mockResolvedValueOnce(null)
    await expect(service.getVNDBScore(1)).rejects.toMatchObject({
      code: ShionBizCode.GAME_NOT_FOUND,
    })

    prisma.game.findUnique.mockResolvedValueOnce({ v_id: null })
    await expect(service.getVNDBScore(1)).resolves.toBeNull()
  })

  it('getVNDBScore returns cached score when present', async () => {
    const { service, prisma, cacheService, vndbService } = createService()
    const cached = { rating: 8.5, average: 8.4, votecount: 1200 }

    prisma.game.findUnique.mockResolvedValueOnce({ v_id: 'v123' })
    cacheService.get.mockResolvedValueOnce(cached)

    await expect(service.getVNDBScore(1)).resolves.toBe(cached)
    expect(cacheService.get).toHaveBeenCalledWith('game:score:vndb:v123')
    expect(vndbService.vndbRequest).not.toHaveBeenCalled()
  })

  it('getVNDBScore fetches from API and caches on miss', async () => {
    const { service, prisma, cacheService, vndbService } = createService()
    const data = { rating: 9.1, average: 8.8, votecount: 3333 }

    prisma.game.findUnique.mockResolvedValueOnce({ v_id: 'v777' })
    cacheService.get.mockResolvedValueOnce(null)
    vndbService.vndbRequest.mockResolvedValueOnce(data)

    await expect(service.getVNDBScore(1)).resolves.toEqual(data)
    expect(vndbService.vndbRequest).toHaveBeenCalledWith(
      'single',
      ['id', '=', 'v777'],
      ['rating', 'average', 'votecount'],
      'vn',
    )
    expect(cacheService.set).toHaveBeenCalledWith(
      'game:score:vndb:v777',
      data,
      60 * 60 * 24 * 7 * 1000,
    )
  })
})
