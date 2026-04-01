import { AdController } from './ad.controller'

describe('AdController', () => {
  const createController = () => {
    const adService = {
      getAdsByPlacement: jest.fn(),
    }
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    }

    const controller = new AdController(adService as any, cacheService as any)
    return { adService, cacheService, controller }
  }

  beforeEach(() => jest.clearAllMocks())

  describe('getAdsByPlacement', () => {
    it('returns cached result on cache hit', async () => {
      const { controller, cacheService, adService } = createController()
      const cached = [{ id: 1 }]
      cacheService.get.mockResolvedValue(cached)

      const result = await controller.getAdsByPlacement('home-after-hot')

      expect(result).toEqual(cached)
      expect(cacheService.get).toHaveBeenCalledWith('ad:placement:home-after-hot')
      expect(adService.getAdsByPlacement).not.toHaveBeenCalled()
    })

    it('fetches from service and caches on cache miss', async () => {
      const { controller, cacheService, adService } = createController()
      const ads = [{ id: 1, image_zh: 'url' }]
      cacheService.get.mockResolvedValue(null)
      adService.getAdsByPlacement.mockResolvedValue(ads)

      const result = await controller.getAdsByPlacement('game-detail-bottom')

      expect(result).toEqual(ads)
      expect(adService.getAdsByPlacement).toHaveBeenCalledWith('game-detail-bottom')
      expect(cacheService.set).toHaveBeenCalledWith('ad:placement:game-detail-bottom', ads, 300_000)
    })
  })
})
