export class AdminUserDetailResDto {
  id: number
  name: string
  email: string
  avatar: string | null
  cover: string | null
  role: number
  status: number
  lang: string
  content_limit: number
  created: Date
  updated: Date
  last_login_at: Date | null
  two_factor_enabled: boolean
  upload_quota?: {
    size: string
    used: string
    is_first_grant: boolean
  }
  counts: {
    comments: number
    resources: number
    favorites: number
    edits: number
  }
  latest_ban?: {
    banned_at: Date
    banned_reason: string | null
    banned_duration_days: number | null
    is_permanent: boolean
    unbanned_at: Date | null
    banned_by?: {
      id: number
      name: string
    } | null
  } | null
}

export class AdminUserSessionResDto {
  id: number
  family_id: string
  status: number
  ip: string | null
  user_agent: string | null
  device_info: string | null
  created: Date
  updated: Date
  last_used_at: Date | null
  expires_at: Date
  rotated_at: Date | null
  reused_at: Date | null
  blocked_at: Date | null
  blocked_reason: string | null
}
