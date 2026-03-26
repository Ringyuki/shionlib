import { SponsorAdminController } from './sponsor-admin.controller'

describe('SponsorAdminController', () => {
  const createController = () => {
    const sponsorService = {
      getOrderList: jest.fn(),
      getOrderStatus: jest.fn(),
      getPublicStats: jest.fn(),
      adminUpdateOrderStatus: jest.fn(),
      adminDeleteOrder: jest.fn(),
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

  it('updateOrderStatus delegates to sponsorService', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.adminUpdateOrderStatus.mockResolvedValueOnce(undefined)

    await controller.updateOrderStatus(1, { status: 'DONE' as any })

    expect(sponsorService.adminUpdateOrderStatus).toHaveBeenCalledWith(1, 'DONE')
  })

  it('deleteOrder delegates to sponsorService', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.adminDeleteOrder.mockResolvedValueOnce(undefined)

    await controller.deleteOrder(1)

    expect(sponsorService.adminDeleteOrder).toHaveBeenCalledWith(1)
  })

  it('getStats delegates to sponsorService.getPublicStats', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.getPublicStats.mockResolvedValueOnce({ totalSponsors: 10, totalAmount: 500 })

    const result = await controller.getStats()
    expect(result.totalSponsors).toBe(10)
  })
})
