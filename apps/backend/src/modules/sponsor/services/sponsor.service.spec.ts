import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { SponsorService } from './sponsor.service'

describe('SponsorService', () => {
  const createService = () => {
    const prisma = {
      sponsorOrder: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
    }
    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, unknown> = {
          'sponsor.enabled': true,
          'sponsor.provider': 'idatariver',
          'sponsor.callbackBaseUrl': 'https://api.shionlib.com',
        }
        return config[key]
      }),
    }
    const paymentProvider = {
      createOrder: jest.fn(),
      payOrder: jest.fn(),
      getOrderInfo: jest.fn(),
      verifyAndGetOrder: jest.fn(),
    }
    const service = new SponsorService(prisma as any, configService as any, paymentProvider as any)
    return { prisma, configService, paymentProvider, service }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createOrder', () => {
    it('creates order via provider and persists to DB', async () => {
      const { service, paymentProvider, prisma } = createService()
      paymentProvider.createOrder.mockResolvedValueOnce({ providerOrderId: 'idr-123' })
      paymentProvider.getOrderInfo.mockResolvedValueOnce({
        providerOrderId: 'idr-123',
        status: 'NEW',
        amount: 10,
        paymentMethods: ['alipay', 'wxpay'],
      })
      prisma.sponsorOrder.create.mockResolvedValueOnce({ id: 1 })

      const result = await service.createOrder(
        { amount: 10, isPrivate: false, name: 'Alice', message: 'Thanks!' },
        42,
      )

      expect(result).toEqual({
        orderId: 1,
        providerOrderId: 'idr-123',
        paymentMethods: ['alipay', 'wxpay'],
      })
      expect(paymentProvider.createOrder).toHaveBeenCalledWith({
        amount: 10,
        isPrivate: false,
        name: 'Alice',
        message: 'Thanks!',
      })
      expect(prisma.sponsorOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider_order_id: 'idr-123',
          provider: 'idatariver',
          sponsor_name: 'Alice',
          sponsor_message: 'Thanks!',
          is_private: false,
          user_id: 42,
        }),
      })
    })

    it('creates order without userId for anonymous sponsors', async () => {
      const { service, paymentProvider, prisma } = createService()
      paymentProvider.createOrder.mockResolvedValueOnce({ providerOrderId: 'idr-456' })
      paymentProvider.getOrderInfo.mockResolvedValueOnce({
        providerOrderId: 'idr-456',
        status: 'NEW',
        amount: 5,
        paymentMethods: ['crypto'],
      })
      prisma.sponsorOrder.create.mockResolvedValueOnce({ id: 2 })

      const result = await service.createOrder({ amount: 5 })

      expect(result.orderId).toBe(2)
      expect(prisma.sponsorOrder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ user_id: null }),
      })
    })

    it('throws SPONSOR_MODULE_DISABLED when module is off', async () => {
      const { service, configService } = createService()
      configService.get.mockImplementation((key: string) => {
        if (key === 'sponsor.enabled') return false
        return ''
      })

      await expect(service.createOrder({ amount: 5 })).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_MODULE_DISABLED,
      })
    })
  })

  describe('payOrder', () => {
    it('pays order and returns payment URL', async () => {
      const { service, prisma, paymentProvider } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        status: 'NEW',
      })
      paymentProvider.payOrder.mockResolvedValueOnce({
        payUrl: 'https://pay.example.com/123',
        payCurrency: 'USD',
        amount: 10,
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})

      const result = await service.payOrder(1, { method: 'alipay' })

      expect(result).toEqual({
        payUrl: 'https://pay.example.com/123',
        payCurrency: 'USD',
        amount: 10,
      })
      expect(paymentProvider.payOrder).toHaveBeenCalledWith({
        providerOrderId: 'idr-123',
        method: 'alipay',
        redirectUrl: undefined,
        callbackUrl: 'https://api.shionlib.com/sponsor/webhook/idatariver',
      })
    })

    it('throws SPONSOR_ORDER_NOT_FOUND for missing order', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce(null)

      await expect(service.payOrder(999, { method: 'alipay' })).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_ORDER_NOT_FOUND,
      })
    })

    it('throws SPONSOR_ORDER_ALREADY_PAID for DONE order', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({ id: 1, status: 'DONE' })

      await expect(service.payOrder(1, { method: 'alipay' })).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_ORDER_ALREADY_PAID,
      })
    })

    it('throws SPONSOR_ORDER_EXPIRED for EXPIRED order', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({ id: 1, status: 'EXPIRED' })

      await expect(service.payOrder(1, { method: 'alipay' })).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_ORDER_EXPIRED,
      })
    })
  })

  describe('handlePaymentCallback', () => {
    it('updates order to DONE when verified', async () => {
      const { service, prisma, paymentProvider } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        status: 'NEW',
      })
      paymentProvider.verifyAndGetOrder.mockResolvedValueOnce({
        providerOrderId: 'idr-123',
        status: 'DONE',
        amount: 10,
        paymentMethods: [],
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})

      await service.handlePaymentCallback('idr-123')

      expect(prisma.sponsorOrder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'DONE',
          paid_at: expect.any(Date),
          callback_verified: true,
        },
      })
    })

    it('is idempotent for already-DONE orders', async () => {
      const { service, prisma, paymentProvider } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        status: 'DONE',
      })

      await service.handlePaymentCallback('idr-123')

      expect(paymentProvider.verifyAndGetOrder).not.toHaveBeenCalled()
      expect(prisma.sponsorOrder.update).not.toHaveBeenCalled()
    })

    it('handles unknown provider order gracefully', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce(null)

      await expect(service.handlePaymentCallback('unknown-order')).resolves.toBeUndefined()
    })

    it('updates order to REFUND when verified as refunded', async () => {
      const { service, prisma, paymentProvider } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        status: 'DONE',
      })

      // Override to not be DONE for this test
      prisma.sponsorOrder.findUnique.mockReset()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        status: 'NEW',
      })
      paymentProvider.verifyAndGetOrder.mockResolvedValueOnce({
        providerOrderId: 'idr-123',
        status: 'REFUND',
        amount: 10,
        paymentMethods: [],
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})

      await service.handlePaymentCallback('idr-123')

      expect(prisma.sponsorOrder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: 'REFUND',
          callback_verified: true,
        },
      })
    })
  })

  describe('getPublicStats', () => {
    it('returns aggregated stats', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.aggregate.mockResolvedValueOnce({
        _count: { id: 42 },
        _sum: { amount: 1234.56 },
      })

      const result = await service.getPublicStats()

      expect(result).toEqual({ totalSponsors: 42, totalAmount: 1234.56 })
    })

    it('returns zero when no orders', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.aggregate.mockResolvedValueOnce({
        _count: { id: 0 },
        _sum: { amount: null },
      })

      const result = await service.getPublicStats()

      expect(result).toEqual({ totalSponsors: 0, totalAmount: 0 })
    })
  })
})
