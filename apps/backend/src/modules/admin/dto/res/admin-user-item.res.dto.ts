export class AdminUserItemResDto {
  id: number
  name: string
  email: string
  avatar: string | null
  role: number
  status: number
  lang: string
  content_limit: number
  created: Date
  updated: Date
  last_login_at: Date | null
  two_factor_enabled: boolean
  sponsor_expires_at: Date | null
  counts: {
    comments: number
    resources: number
    favorites: number
    edits: number
  }
}
