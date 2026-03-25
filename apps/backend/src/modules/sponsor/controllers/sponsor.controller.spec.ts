import { SponsorController } from './sponsor.controller'

describe('SponsorController', () => {
  const createController = () => {
    const sponsorService = {
      createOrder: jest.fn(),
      payOrder: jest.fn(),
      getOrderStatus: jest.fn(),
      getPublicStats: jest.fn(),
    }
    const sponsorWallService = {
      getWall: jest.fn(),
    }
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    }
    const controller = new SponsorController(
      sponsorService as any,
      sponsorWallService as any,
      cacheService as any,
    )
    return { sponsorService, sponsorWallService, cacheService, controller }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('createOrder passes dto and userId to service', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.createOrder.mockResolvedValueOnce({
      orderId: 1,
      providerOrderId: 'idr-123',
      paymentMethods: ['alipay'],
    })

    const req = { user: { sub: 42 } } as any
    const result = await controller.createOrder({ amount: 10 }, req)

    expect(result.orderId).toBe(1)
    expect(sponsorService.createOrder).toHaveBeenCalledWith({ amount: 10 }, 42)
  })

  it('payOrder passes orderId and dto to service', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.payOrder.mockResolvedValueOnce({
      payUrl: 'https://pay.example.com',
      payCurrency: 'USD',
      amount: 10,
    })

    const result = await controller.payOrder(1, { method: 'alipay' })

    expect(result.payUrl).toBe('https://pay.example.com')
    expect(sponsorService.payOrder).toHaveBeenCalledWith(1, { method: 'alipay' })
  })

  it('getOrderStatus delegates to service', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.getOrderStatus.mockResolvedValueOnce({ id: 1, status: 'DONE' })

    const result = await controller.getOrderStatus(1)
    expect(result.status).toBe('DONE')
  })

  it('getWall delegates to wall service', async () => {
    const { controller, sponsorWallService } = createController()
    sponsorWallService.getWall.mockResolvedValueOnce({ items: [], meta: {} })

    const result = await controller.getWall({ page: 1, pageSize: 10 })
    expect(result.items).toEqual([])
  })

  it('getStats delegates to service', async () => {
    const { controller, sponsorService } = createController()
    sponsorService.getPublicStats.mockResolvedValueOnce({ totalSponsors: 5, totalAmount: 100 })

    const result = await controller.getStats()
    expect(result.totalSponsors).toBe(5)
  })
})
