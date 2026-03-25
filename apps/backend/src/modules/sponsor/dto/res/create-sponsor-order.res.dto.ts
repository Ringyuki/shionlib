import { PaymentMethodInfo } from '../../interfaces/payment-provider.interface'

export class CreateSponsorOrderResDto {
  orderId: number
  providerOrderId: string
  paymentMethods: PaymentMethodInfo[]
  expiresAt: string | null
}
