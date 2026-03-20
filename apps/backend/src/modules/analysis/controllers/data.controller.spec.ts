import { AnalysisDataController } from './data.controller'

describe('AnalysisDataController', () => {
  const createController = () => {
    const dataService = {
      getOverview: jest.fn(),
    }
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    }

    return {
      dataService,
      cacheService,
      controller: new AnalysisDataController(dataService as any, cacheService as any),
    }
  }

  it('returns cached overview when cache exists', async () => {
    const { controller, dataService, cacheService } = createController()
    const cached = { total_games: 10 }
    cacheService.get.mockResolvedValue(cached)

    const result = await controller.getOverview()

    expect(cacheService.get).toHaveBeenCalledWith('analysis:data:overview')
    expect(result).toEqual(cached)
    expect(dataService.getOverview).not.toHaveBeenCalled()
    expect(cacheService.set).not.toHaveBeenCalled()
  })

  it('fetches overview and writes cache when cache is empty', async () => {
    const { controller, dataService, cacheService } = createController()
    const fresh = { total_games: 20, total_users: 5 }
    cacheService.get.mockResolvedValue(null)
    dataService.getOverview.mockResolvedValue(fresh)

    const result = await controller.getOverview()

    expect(dataService.getOverview).toHaveBeenCalledTimes(1)
    expect(cacheService.set).toHaveBeenCalledWith('analysis:data:overview', fresh, 30 * 60 * 1000)
    expect(result).toEqual(fresh)
  })
})
