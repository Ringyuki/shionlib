export interface AdminUserCounts {
  comments: number
  resources: number
  favorites: number
  edits: number
}

export interface AdminUserItem {
  id: number
  name: string
  email: string
  avatar: string | null
  role: number
  status: number
  lang: string
  content_limit: number
  created: string
  updated: string
  last_login_at: string | null
  two_factor_enabled: boolean
  counts: AdminUserCounts
}

export interface AdminUserDetail extends AdminUserItem {
  cover: string | null
  upload_quota?: {
    size: string
    used: string
    is_first_grant: boolean
  }
  latest_ban?: {
    banned_at: string
    banned_reason: string | null
    banned_duration_days: number | null
    is_permanent: boolean
    unbanned_at: string | null
    banned_by?: {
      id: number
      name: string
    } | null
  } | null
}

export interface AdminUserSession {
  id: number
  family_id: string
  status: number
  ip: string | null
  user_agent: string | null
  device_info: string | null
  created: string
  updated: string
  last_used_at: string | null
  expires_at: string
  rotated_at: string | null
  reused_at: string | null
  blocked_at: string | null
  blocked_reason: string | null
}

export interface AdminUserListQuery {
  page?: number
  limit?: number
  search?: string
  role?: number
  status?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface AdminUserSessionsQuery {
  page?: number
  limit?: number
  status?: number
}

export type AdminPermissionEntity = 'game' | 'character' | 'developer'

export interface AdminUserPermissionGroup {
  field: string
  bitIndex: number
  isRelation: boolean
  fields: string[]
  enabled: boolean
  source: 'role' | 'user' | 'none'
  mutable: boolean
}

export interface AdminUserPermissionDetail {
  entity: AdminPermissionEntity
  roleMask: string
  userMask: string
  allowMask: string
  groups: AdminUserPermissionGroup[]
}
