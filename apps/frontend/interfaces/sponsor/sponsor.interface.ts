export interface PaymentMethodInfo {
  method: string
  name: string
  enabled: boolean
  ratioRange?: string
  fixedFeeRange?: string
  desc?: string
}

export interface CreateSponsorOrderRes {
  orderId: number
  providerOrderId: string
  paymentMethods: PaymentMethodInfo[]
  expiresAt: string | null
}

export interface PaySponsorOrderRes {
  payUrl: string
  payCurrency: string | null
  amount: number | null
}

export interface SponsorOrderStatus {
  id: number
  providerOrderId: string
  amount: number
  status: 'NEW' | 'DONE' | 'EXPIRED' | 'REFUND'
  sponsorName: string | null
  message: string | null
  isPrivate: boolean
  paymentMethod: string | null
  paidAt: string | null
  created: string
}
