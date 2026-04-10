import { AdController } from './ad.controller'

describe('AdController', () => {
  const createController = () => {
    const adService = {
      getAdsByPlacement: jest.fn(),
      isUserSponsor: jest.fn(),
    }
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    }

    const controller = new AdController(adService as any, cacheService as any)
    return { adService, cacheService, controller }
  }

  const mockReq = (sub = 0) => ({ user: { sub } }) as any

  beforeEach(() => jest.clearAllMocks())

  describe('getAdsByPlacement', () => {
    it('returns empty array for sponsor users', async () => {
      const { controller, adService, cacheService } = createController()
      adService.isUserSponsor.mockResolvedValue(true)

      const result = await controller.getAdsByPlacement(mockReq(1), 'home-after-hot')

      expect(result).toEqual([])
      expect(cacheService.get).not.toHaveBeenCalled()
      expect(adService.getAdsByPlacement).not.toHaveBeenCalled()
    })

    it('returns cached result on cache hit', async () => {
      const { controller, cacheService, adService } = createController()
      adService.isUserSponsor.mockResolvedValue(false)
      const cached = [{ id: 1 }]
      cacheService.get.mockResolvedValue(cached)

      const result = await controller.getAdsByPlacement(mockReq(), 'home-after-hot')

      expect(result).toEqual(cached)
      expect(cacheService.get).toHaveBeenCalledWith('ad:placement:home-after-hot')
      expect(adService.getAdsByPlacement).not.toHaveBeenCalled()
    })

    it('fetches from service and caches on cache miss', async () => {
      const { controller, cacheService, adService } = createController()
      adService.isUserSponsor.mockResolvedValue(false)
      const ads = [{ id: 1, image_zh: 'url' }]
      cacheService.get.mockResolvedValue(null)
      adService.getAdsByPlacement.mockResolvedValue(ads)

      const result = await controller.getAdsByPlacement(mockReq(), 'game-detail-bottom')

      expect(result).toEqual(ads)
      expect(adService.getAdsByPlacement).toHaveBeenCalledWith('game-detail-bottom')
      expect(cacheService.set).toHaveBeenCalledWith('ad:placement:game-detail-bottom', ads, 300_000)
    })
  })
})
