export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER')

export type ProviderOrderStatus = 'NEW' | 'DONE' | 'EXPIRED' | 'REFUND'

export interface CreateOrderParams {
  amount: number
  isPrivate: boolean
  name: string
  message: string
}

export interface CreateOrderResult {
  providerOrderId: string
}

export interface PayOrderParams {
  providerOrderId: string
  method: string
  redirectUrl?: string
  callbackUrl: string
}

export interface PayOrderResult {
  payUrl: string
  payCurrency: string | null
  amount: number | null
}

export interface PaymentMethodInfo {
  method: string
  name: string
  enabled: boolean
  ratioRange?: string
  fixedFeeRange?: string
  desc?: string
}

export interface ProviderOrderInfo {
  providerOrderId: string
  status: ProviderOrderStatus
  amount: number
  paymentMethods: PaymentMethodInfo[]
  expiresAt: string | null
}

export interface PaymentProvider {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>
  payOrder(params: PayOrderParams): Promise<PayOrderResult>
  getOrderInfo(providerOrderId: string): Promise<ProviderOrderInfo>
  verifyAndGetOrder(providerOrderId: string): Promise<ProviderOrderInfo>
}
