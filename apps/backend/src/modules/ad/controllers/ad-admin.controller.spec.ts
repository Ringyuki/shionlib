import { AdAdminController } from './ad-admin.controller'

describe('AdAdminController', () => {
  const createController = () => {
    const adService = {
      getAdList: jest.fn(),
      getAdDetail: jest.fn(),
      createAd: jest.fn(),
      updateAd: jest.fn(),
      deleteAd: jest.fn(),
    }

    const controller = new AdAdminController(adService as any)
    return { adService, controller }
  }

  beforeEach(() => jest.clearAllMocks())

  it('getAdList delegates to service', async () => {
    const { controller, adService } = createController()
    const dto = { page: 1, pageSize: 10 }
    const result = { items: [], meta: {} }
    adService.getAdList.mockResolvedValue(result)

    expect(await controller.getAdList(dto as any)).toEqual(result)
    expect(adService.getAdList).toHaveBeenCalledWith(dto)
  })

  it('getAdDetail delegates to service', async () => {
    const { controller, adService } = createController()
    const ad = { id: 1, name: 'ad' }
    adService.getAdDetail.mockResolvedValue(ad)

    expect(await controller.getAdDetail(1)).toEqual(ad)
    expect(adService.getAdDetail).toHaveBeenCalledWith(1)
  })

  it('createAd delegates to service', async () => {
    const { controller, adService } = createController()
    const dto = { name: 'ad', placement: 'home' }
    const created = { id: 1, ...dto }
    adService.createAd.mockResolvedValue(created)

    expect(await controller.createAd(dto as any)).toEqual(created)
    expect(adService.createAd).toHaveBeenCalledWith(dto)
  })

  it('updateAd delegates to service', async () => {
    const { controller, adService } = createController()
    const dto = { name: 'updated' }
    const updated = { id: 1, name: 'updated' }
    adService.updateAd.mockResolvedValue(updated)

    expect(await controller.updateAd(1, dto as any)).toEqual(updated)
    expect(adService.updateAd).toHaveBeenCalledWith(1, dto)
  })

  it('deleteAd delegates to service', async () => {
    const { controller, adService } = createController()
    adService.deleteAd.mockResolvedValue(undefined)

    await controller.deleteAd(1)
    expect(adService.deleteAd).toHaveBeenCalledWith(1)
  })
})
