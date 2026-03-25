export interface AdminSponsorOrderItem {
  id: number
  providerOrderId: string
  amount: number
  status: 'NEW' | 'DONE' | 'EXPIRED' | 'REFUND'
  sponsorName: string | null
  user: { id: number; name: string; avatar: string | null; is_sponsor: boolean } | null
  message: string | null
  isPrivate: boolean
  paymentMethod: string | null
  paidAt: string | null
  created: string
}

export interface AdminSponsorListQuery {
  page?: number
  limit?: number
  status?: string
}

export interface AdminSponsorStats {
  totalSponsors: number
  totalAmount: number
}
