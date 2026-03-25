import { SponsorAdminController } from './sponsor-admin.controller'

describe('SponsorAdminController', () => {
  const createController = () => {
    const sponsorService = {
      getOrderList: jest.fn(),
      getOrderStatus: jest.fn(),
      getPublicStats: jest.fn(),
    }
    const controller = new SponsorAdminController(sponsorService as any)
    return { sponsorService, controller }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('getOrders delegates to sponsorService.getOrderList', async () => {
    const { controller, sponsorService } = createController()
    const mockResult = { items: [], meta: { totalItems: 0 } }
    sponsorService.getOrderList.mockResolvedValueOnce(mockResult)

    const result = await controller.getOrders({ page: 1, pageSize: 10 })

    expect(result).toBe(mockResult)
    expect(sponsorService.getOrderList).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
  })

  it('getOrder delegates to sponsorService.getOrderStatus', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.getOrderStatus.mockResolvedValueOnce({ id: 1, status: 'DONE' })

    const result = await controller.getOrder(1)
    expect(result.status).toBe('DONE')
  })

  it('getStats delegates to sponsorService.getPublicStats', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.getPublicStats.mockResolvedValueOnce({ totalSponsors: 10, totalAmount: 500 })

    const result = await controller.getStats()
    expect(result.totalSponsors).toBe(10)
  })
})
