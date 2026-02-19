import { GameController } from './game.controller'

describe('GameController', () => {
  const createController = () => {
    const gameService = {
      getList: jest.fn(),
      getRandomGameId: jest.fn(),
      getRecentUpdate: jest.fn(),
      getById: jest.fn(),
      getHeader: jest.fn(),
      getDetails: jest.fn(),
      getCharacters: jest.fn(),
      increaseViews: jest.fn(),
    }
    const gameDownloadSourceService = {
      getByGameId: jest.fn(),
      getDownloadLink: jest.fn(),
      create: jest.fn(),
    }
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    }

    return {
      gameService,
      gameDownloadSourceService,
      cacheService,
      controller: new GameController(
        gameService as any,
        gameDownloadSourceService as any,
        cacheService as any,
      ),
    }
  }

  const req = { user: { sub: 'u1', content_limit: 2 } }

  it('getList returns cached value when exists', async () => {
    const { controller, cacheService, gameService } = createController()
    const query = { page: 1, pageSize: 10, developer_id: 1, character_id: 2, filter: 'hot' }
    const cached = { items: [{ id: 1 }], total: 1 }
    cacheService.get.mockResolvedValue(cached)

    const result = await controller.getList(query as any, req as any)

    expect(result).toBe(cached)
    expect(gameService.getList).not.toHaveBeenCalled()
    expect(cacheService.set).not.toHaveBeenCalled()
  })

  it('getList fetches and caches when cache miss', async () => {
    const { controller, cacheService, gameService } = createController()
    const query = { page: 1, pageSize: 10, developer_id: 3, character_id: 4, filter: 'new' }
    const resultData = { items: [{ id: 2 }], total: 1 }
    cacheService.get.mockResolvedValue(null)
    gameService.getList.mockResolvedValue(resultData)

    const result = await controller.getList(query as any, req as any)

    expect(gameService.getList).toHaveBeenCalledWith({ page: 1, pageSize: 10 }, 2, 3, 4, 'new')
    expect(cacheService.set).toHaveBeenCalledWith(
      `game:list:auth:u1:cl:2:query:${JSON.stringify(query)}`,
      resultData,
      30 * 60 * 1000,
    )
    expect(result).toEqual(resultData)
  })

  it('delegates getRandomGame', async () => {
    const { controller, gameService } = createController()
    const request = { user: { sub: 'u2', content_limit: 1 } }

    await controller.getRandomGame(request as any)

    expect(gameService.getRandomGameId).toHaveBeenCalledWith(request)
  })

  it('delegates getRecentUpdate and caches response', async () => {
    const { controller, gameService, cacheService } = createController()
    cacheService.get.mockResolvedValue(null)

    await controller.getRecentUpdate({ page: 1, pageSize: 5 } as any, req as any)

    expect(gameService.getRecentUpdate).toHaveBeenCalledWith({ page: 1, pageSize: 5 }, 2)
    expect(cacheService.set).toHaveBeenCalledTimes(1)
  })

  it('getGame uses cache key and returns cached result', async () => {
    const { controller, cacheService, gameService } = createController()
    cacheService.get.mockResolvedValue({ id: 88 })

    const result = await controller.getGame(88, req as any)

    expect(cacheService.get).toHaveBeenCalledWith('game:88:auth:u1:cl:2')
    expect(gameService.getById).not.toHaveBeenCalled()
    expect(result).toEqual({ id: 88 })
  })

  it('getGameHeader/getGameDetails/getGameCharacters query service and cache on miss', async () => {
    const { controller, cacheService, gameService } = createController()
    cacheService.get.mockResolvedValue(null)

    await controller.getGameHeader(8, req as any)
    await controller.getGameDetails(8, req as any)
    await controller.getGameCharacters(8, req as any)

    expect(gameService.getHeader).toHaveBeenCalledWith(8, 2)
    expect(gameService.getDetails).toHaveBeenCalledWith(8, 2)
    expect(gameService.getCharacters).toHaveBeenCalledWith(8, 2)
    expect(cacheService.set).toHaveBeenCalledTimes(3)
  })

  it('delegates increaseViews', async () => {
    const { controller, gameService } = createController()

    await controller.increaseViews(77)

    expect(gameService.increaseViews).toHaveBeenCalledWith(77)
  })

  it('delegates download source endpoints', async () => {
    const { controller, gameDownloadSourceService } = createController()
    const request = { user: { sub: 'u3', content_limit: 1 } }
    const dto = { title: 'mirror' }

    await controller.getDownloadSource(5, request as any)
    await controller.getDownloadSourceLink(6, 'token-1')
    await controller.createDownloadSource(7, dto as any, request as any)

    expect(gameDownloadSourceService.getByGameId).toHaveBeenCalledWith(5, request)
    expect(gameDownloadSourceService.getDownloadLink).toHaveBeenCalledWith(6, 'token-1')
    expect(gameDownloadSourceService.create).toHaveBeenCalledWith(dto, 7, 'u3')
  })
})
