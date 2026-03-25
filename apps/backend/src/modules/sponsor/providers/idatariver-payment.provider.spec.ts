import { of, throwError } from 'rxjs'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { IDataRiverPaymentProvider } from './idatariver-payment.provider'

describe('IDataRiverPaymentProvider', () => {
  const createProvider = () => {
    const httpService = {
      get: jest.fn(),
      post: jest.fn(),
    }
    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          'sponsor.idatariver.baseUrl': 'https://open.idatariver.com',
          'sponsor.idatariver.developerSecret': 'test-secret',
          'sponsor.idatariver.projectId': 'test-project-id',
        }
        return config[key]
      }),
    }
    const provider = new IDataRiverPaymentProvider(httpService as any, configService as any)
    return { httpService, configService, provider }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createOrder', () => {
    it('creates an order and returns providerOrderId', async () => {
      const { provider, httpService } = createProvider()
      httpService.post.mockReturnValueOnce(
        of({ data: { code: 0, result: { orderId: 'idr-order-123' }, msg: '' } }),
      )

      const result = await provider.createOrder({
        amount: 10,
        isPrivate: false,
        name: 'Test Sponsor',
        message: 'Thank you!',
      })

      expect(result).toEqual({ providerOrderId: 'idr-order-123' })
      expect(httpService.post).toHaveBeenCalledWith(
        'https://open.idatariver.com/mapi/order/add',
        {
          projectId: 'test-project-id',
          orderInfo: {
            amount: 10,
            private: false,
            name: 'Test Sponsor',
            message: 'Thank you!',
          },
        },
        { headers: { Authorization: 'Bearer test-secret' } },
      )
    })

    it('throws ShionBizException when API returns non-zero code', async () => {
      const { provider, httpService } = createProvider()
      httpService.post.mockReturnValueOnce(
        of({ data: { code: 1001, result: null, msg: 'parameter error' } }),
      )

      await expect(
        provider.createOrder({ amount: 10, isPrivate: false, name: '', message: '' }),
      ).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_PROVIDER_REQUEST_FAILED,
      })
    })

    it('throws ShionBizException on network error', async () => {
      const { provider, httpService } = createProvider()
      httpService.post.mockReturnValueOnce(throwError(() => new Error('network timeout')))

      await expect(
        provider.createOrder({ amount: 5, isPrivate: false, name: '', message: '' }),
      ).rejects.toMatchObject({
        code: ShionBizCode.SPONSOR_PROVIDER_REQUEST_FAILED,
      })
    })
  })

  describe('payOrder', () => {
    it('pays an order and returns payment URL', async () => {
      const { provider, httpService } = createProvider()
      httpService.post.mockReturnValueOnce(
        of({
          data: {
            code: 0,
            result: { payUrl: 'https://pay.example.com/123', payCurrency: 'USD', amount: 10 },
            msg: '',
          },
        }),
      )

      const result = await provider.payOrder({
        providerOrderId: 'idr-order-123',
        method: 'alipay',
        callbackUrl: 'https://api.shionlib.com/sponsor/webhook/idatariver',
        redirectUrl: 'https://shionlib.com/sponsor/success',
      })

      expect(result).toEqual({
        payUrl: 'https://pay.example.com/123',
        payCurrency: 'USD',
        amount: 10,
      })
      expect(httpService.post).toHaveBeenCalledWith(
        'https://open.idatariver.com/mapi/order/pay',
        {
          id: 'idr-order-123',
          method: 'alipay',
          callbackUrl: 'https://api.shionlib.com/sponsor/webhook/idatariver',
          redirectUrl: 'https://shionlib.com/sponsor/success',
        },
        { headers: { Authorization: 'Bearer test-secret' } },
      )
    })
  })

  describe('getOrderInfo', () => {
    it('returns normalized order info', async () => {
      const { provider, httpService } = createProvider()
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            code: 0,
            result: {
              id: 'idr-order-123',
              status: 'DONE',
              price: 10,
              mPayments: [
                { method: 'alipay', name: 'Alipay', enabled: true, ratioRange: '11.0%' },
                { method: 'wxpay', name: 'WeChat Pay', enabled: true, ratioRange: '11.0%' },
              ],
              createdTS: 1700000000,
              expiredInterval: 3600,
            },
            msg: '',
          },
        }),
      )

      const result = await provider.getOrderInfo('idr-order-123')

      expect(result).toEqual({
        providerOrderId: 'idr-order-123',
        status: 'DONE',
        amount: 10,
        paymentMethods: [
          { method: 'alipay', name: 'Alipay', enabled: true, ratioRange: '11.0%' },
          { method: 'wxpay', name: 'WeChat Pay', enabled: true, ratioRange: '11.0%' },
        ],
        expiresAt: new Date((1700000000 + 3600) * 1000).toISOString(),
      })
    })

    it('handles missing mPayments gracefully', async () => {
      const { provider, httpService } = createProvider()
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            code: 0,
            result: { id: 'idr-order-123', status: 'NEW', price: 5, mPayments: null },
            msg: '',
          },
        }),
      )

      const result = await provider.getOrderInfo('idr-order-123')
      expect(result.paymentMethods).toEqual([])
    })
  })

  describe('verifyAndGetOrder', () => {
    it('delegates to getOrderInfo', async () => {
      const { provider, httpService } = createProvider()
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            code: 0,
            result: {
              id: 'idr-order-123',
              status: 'DONE',
              price: 10,
              mPayments: [],
            },
            msg: '',
          },
        }),
      )

      const result = await provider.verifyAndGetOrder('idr-order-123')
      expect(result.status).toBe('DONE')
    })
  })

  describe('error re-throw behavior', () => {
    it('re-throws ShionBizException without wrapping', async () => {
      const { provider, httpService } = createProvider()
      httpService.post.mockReturnValueOnce(
        of({ data: { code: 1000, result: null, msg: 'API error' } }),
      )

      try {
        await provider.createOrder({ amount: 5, isPrivate: false, name: '', message: '' })
        fail('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ShionBizException)
        expect((error as ShionBizException).code).toBe(ShionBizCode.SPONSOR_PROVIDER_REQUEST_FAILED)
      }
    })
  })
})
