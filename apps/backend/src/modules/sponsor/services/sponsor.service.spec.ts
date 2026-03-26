import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { SponsorService } from './sponsor.service'

describe('SponsorService', () => {
  const createService = () => {
    const prisma = {
      sponsorOrder: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
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

  describe('getOrderStatus', () => {
    it('returns local order info', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        amount: 10,
        status: 'DONE',
        sponsor_name: 'Alice',
        sponsor_message: 'Hi',
        is_private: false,
        payment_method: 'alipay',
        paid_at: new Date('2025-01-01'),
        created: new Date('2025-01-01'),
        user: null,
      })

      const result = await service.getOrderStatus(1)

      expect(result.id).toBe(1)
      expect(result.status).toBe('DONE')
      expect(result.user).toBeNull()
    })

    it('syncs status from provider when local is NEW', async () => {
      const { service, prisma, paymentProvider } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        amount: 10,
        status: 'NEW',
        sponsor_name: null,
        sponsor_message: null,
        is_private: false,
        payment_method: null,
        paid_at: null,
        created: new Date(),
        user: null,
      })
      paymentProvider.getOrderInfo.mockResolvedValueOnce({
        providerOrderId: 'idr-123',
        status: 'DONE',
        amount: 10,
        paymentMethods: [],
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})

      const result = await service.getOrderStatus(1)

      expect(result.status).toBe('DONE')
      expect(prisma.sponsorOrder.update).toHaveBeenCalled()
    })

    it('returns local status when provider check fails', async () => {
      const { service, prisma, paymentProvider } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        amount: 5,
        status: 'NEW',
        sponsor_name: null,
        sponsor_message: null,
        is_private: false,
        payment_method: null,
        paid_at: null,
        created: new Date(),
        user: null,
      })
      paymentProvider.getOrderInfo.mockRejectedValueOnce(new Error('timeout'))

      const result = await service.getOrderStatus(1)

      expect(result.status).toBe('NEW')
    })

    it('throws SPONSOR_ORDER_NOT_FOUND for missing order', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce(null)

      await expect(service.getOrderStatus(999)).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_ORDER_NOT_FOUND,
      })
    })
  })

  describe('getOrderList', () => {
    it('returns paginated orders', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findMany.mockResolvedValueOnce([
        {
          id: 1,
          provider_order_id: 'idr-1',
          amount: 10,
          status: 'DONE',
          sponsor_name: 'Alice',
          sponsor_message: null,
          is_private: false,
          payment_method: 'alipay',
          paid_at: new Date(),
          created: new Date(),
          user: null,
        },
      ])
      prisma.sponsorOrder.count.mockResolvedValueOnce(1)

      const result = await service.getOrderList({ page: 1, pageSize: 10 })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].providerOrderId).toBe('idr-1')
      expect(result.meta.totalItems).toBe(1)
    })

    it('filters by status', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findMany.mockResolvedValueOnce([])
      prisma.sponsorOrder.count.mockResolvedValueOnce(0)

      await service.getOrderList({ page: 1, pageSize: 10, status: 'DONE' as any })

      expect(prisma.sponsorOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'DONE' } }),
      )
    })
  })

  describe('adminUpdateOrderStatus', () => {
    it('updates order status', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        status: 'NEW',
        paid_at: null,
        user_id: null,
        amount: 10,
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})

      await service.adminUpdateOrderStatus(1, 'EXPIRED')

      expect(prisma.sponsorOrder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'EXPIRED' },
      })
    })

    it('sets paid_at when marking as DONE', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        status: 'NEW',
        paid_at: null,
        user_id: null,
        amount: 10,
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})

      await service.adminUpdateOrderStatus(1, 'DONE')

      expect(prisma.sponsorOrder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'DONE', paid_at: expect.any(Date) },
      })
    })

    it('extends sponsor expiry when marking as DONE with user', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        status: 'NEW',
        paid_at: null,
        user_id: 42,
        amount: 10,
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})
      prisma.user.findUnique.mockResolvedValueOnce({ sponsor_expires_at: null })
      prisma.user.update.mockResolvedValueOnce({})

      await service.adminUpdateOrderStatus(1, 'DONE')

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { sponsor_expires_at: expect.any(Date) },
      })
    })

    it('throws SPONSOR_ORDER_NOT_FOUND for missing order', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce(null)

      await expect(service.adminUpdateOrderStatus(999, 'DONE')).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_ORDER_NOT_FOUND,
      })
    })
  })

  describe('adminDeleteOrder', () => {
    it('deletes order', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({ id: 1 })
      prisma.sponsorOrder.delete.mockResolvedValueOnce({})

      await service.adminDeleteOrder(1)

      expect(prisma.sponsorOrder.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    })

    it('throws SPONSOR_ORDER_NOT_FOUND for missing order', async () => {
      const { service, prisma } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce(null)

      await expect(service.adminDeleteOrder(999)).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_ORDER_NOT_FOUND,
      })
    })
  })

  describe('handlePaymentCallback with sponsor expiry', () => {
    it('extends sponsor expiry for logged-in user on DONE', async () => {
      const { service, prisma, paymentProvider } = createService()
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        status: 'NEW',
        user_id: 42,
        amount: 10,
      })
      paymentProvider.verifyAndGetOrder.mockResolvedValueOnce({
        providerOrderId: 'idr-123',
        status: 'DONE',
        amount: 10,
        paymentMethods: [],
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})
      prisma.user.findUnique.mockResolvedValueOnce({ sponsor_expires_at: null })
      prisma.user.update.mockResolvedValueOnce({})

      await service.handlePaymentCallback('idr-123')

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { sponsor_expires_at: expect.any(Date) },
      })
    })

    it('stacks expiry on existing non-expired sponsor', async () => {
      const { service, prisma, paymentProvider } = createService()
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      prisma.sponsorOrder.findUnique.mockResolvedValueOnce({
        id: 1,
        provider_order_id: 'idr-123',
        status: 'NEW',
        user_id: 42,
        amount: 5,
      })
      paymentProvider.verifyAndGetOrder.mockResolvedValueOnce({
        providerOrderId: 'idr-123',
        status: 'DONE',
        amount: 5,
        paymentMethods: [],
      })
      prisma.sponsorOrder.update.mockResolvedValueOnce({})
      prisma.user.findUnique.mockResolvedValueOnce({ sponsor_expires_at: futureDate })
      prisma.user.update.mockResolvedValueOnce({})

      await service.handlePaymentCallback('idr-123')

      const updateCall = prisma.user.update.mock.calls[0][0]
      const newExpiry = updateCall.data.sponsor_expires_at as Date
      // $5 = 30 days, should be stacked on futureDate
      expect(newExpiry.getTime()).toBeGreaterThan(futureDate.getTime())
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
