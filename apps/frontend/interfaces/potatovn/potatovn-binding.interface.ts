export interface PVNBindingInfo {
  pvn_user_id: number
  pvn_user_name: string
  pvn_user_avatar: string | null
  pvn_token_expires: string
  created: string
  updated: string
}

export interface TokenStatus {
  isExpired: boolean
  isExpiringSoon: boolean
  dateStr: string
}
