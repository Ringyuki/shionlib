export class SponsorOrderInfoResDto {
  id: number
  providerOrderId: string
  amount: number
  status: string
  sponsorName: string | null
  user: { id: number; name: string; avatar: string | null; is_sponsor: boolean } | null
  message: string | null
  isPrivate: boolean
  paymentMethod: string | null
  paidAt: Date | null
  created: Date
}
