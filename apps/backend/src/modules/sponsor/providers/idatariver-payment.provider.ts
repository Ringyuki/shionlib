import { Injectable, Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import {
  PaymentProvider,
  CreateOrderParams,
  CreateOrderResult,
  PayOrderParams,
  PayOrderResult,
  PaymentMethodInfo,
  ProviderOrderInfo,
} from '../interfaces/payment-provider.interface'
import {
  IDataRiverResponse,
  IDataRiverCreateOrderResult,
  IDataRiverPayOrderResult,
  IDataRiverOrderInfo,
} from '../interfaces/idatariver-response.interface'

@Injectable()
export class IDataRiverPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(IDataRiverPaymentProvider.name)
  private readonly baseUrl: string
  private readonly developerSecret: string
  private readonly projectId: string

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ShionConfigService,
  ) {
    this.baseUrl = this.configService.get('sponsor.idatariver.baseUrl')
    this.developerSecret = this.configService.get('sponsor.idatariver.developerSecret')
    this.projectId = this.configService.get('sponsor.idatariver.projectId')
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const data = {
      projectId: this.projectId,
      orderInfo: {
        amount: params.amount,
        private: params.isPrivate,
        name: params.name,
        message: params.message,
      },
    }

    const result = await this.request<IDataRiverCreateOrderResult>('POST', '/mapi/order/add', data)

    return { providerOrderId: result.orderId }
  }

  async payOrder(params: PayOrderParams): Promise<PayOrderResult> {
    const data: Record<string, string | undefined> = {
      id: params.providerOrderId,
      method: params.method,
      redirectUrl: params.redirectUrl,
      callbackUrl: params.callbackUrl,
    }

    const result = await this.request<IDataRiverPayOrderResult>('POST', '/mapi/order/pay', data)

    return {
      payUrl: result.payUrl,
      payCurrency: result.payCurrency,
      amount: result.amount,
    }
  }

  async getOrderInfo(providerOrderId: string): Promise<ProviderOrderInfo> {
    const result = await this.request<IDataRiverOrderInfo>(
      'GET',
      `/mapi/order/info?id=${providerOrderId}`,
    )

    const expiresAt =
      result.createdTS && result.expiredInterval
        ? new Date((result.createdTS + result.expiredInterval) * 1000).toISOString()
        : null

    return {
      providerOrderId: result.id,
      status: result.status,
      amount: result.price,
      paymentMethods:
        result.mPayments
          ?.filter(p => p.enabled)
          .map(
            (p): PaymentMethodInfo => ({
              method: p.method,
              name: p.name,
              enabled: p.enabled,
              ratioRange: p.ratioRange,
              fixedFeeRange: p.fixedFeeRange,
              desc: p.desc,
            }),
          ) ?? [],
      expiresAt,
    }
  }

  async verifyAndGetOrder(providerOrderId: string): Promise<ProviderOrderInfo> {
    return this.getOrderInfo(providerOrderId)
  }

  private async request<T>(method: 'GET' | 'POST', path: string, data?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers = {
      Authorization: `Bearer ${this.developerSecret}`,
    }

    try {
      const response = await firstValueFrom(
        method === 'GET'
          ? this.httpService.get<IDataRiverResponse<T>>(url, { headers })
          : this.httpService.post<IDataRiverResponse<T>>(url, data, { headers }),
      )

      if (response.data.code !== 0) {
        this.logger.warn(
          `iDataRiver API error: code=${response.data.code}, msg=${response.data.msg}`,
        )
        throw new ShionBizException(
          ShionBizCode.SPONSOR_PROVIDER_REQUEST_FAILED,
          'shion-biz.SPONSOR_PROVIDER_REQUEST_FAILED',
          { message: response.data.msg },
        )
      }

      return response.data.result
    } catch (error) {
      if (error instanceof ShionBizException) throw error

      this.logger.error(`iDataRiver request failed: ${error.message}`, error.stack)
      throw new ShionBizException(
        ShionBizCode.SPONSOR_PROVIDER_REQUEST_FAILED,
        'shion-biz.SPONSOR_PROVIDER_REQUEST_FAILED',
        { message: error.message },
      )
    }
  }
}
