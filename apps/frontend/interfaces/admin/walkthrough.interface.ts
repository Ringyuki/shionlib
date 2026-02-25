export type AdminModerationDecision = 'ALLOW' | 'BLOCK' | 'REVIEW'
export type AdminWalkthroughStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED'

export interface AdminWalkthroughModerationSummary {
  id: number
  decision: AdminModerationDecision
  model: string
  top_category: string
  max_score?: number | null
  reason?: string | null
  evidence?: string | null
  created_at: string
}

export interface AdminWalkthroughModeration extends AdminWalkthroughModerationSummary {
  audit_by: number
  categories_json: Record<string, boolean> | null
  scores_json?: Record<string, number> | null
}

export interface AdminWalkthroughItem {
  id: number
  title: string
  html: string
  edited: boolean
  status: AdminWalkthroughStatus
  created: string
  updated: string
  creator: {
    id: number
    name: string
    avatar: string | null
    email?: string | null
  }
  game: {
    id: number
    title_jp: string | null
    title_zh: string | null
    title_en: string | null
  }
  moderation?: AdminWalkthroughModerationSummary
}

export interface AdminWalkthroughDetail extends AdminWalkthroughItem {
  content: Record<string, unknown> | null
  moderations: AdminWalkthroughModeration[]
}

export interface AdminWalkthroughListQuery {
  page?: number
  limit?: number
  search?: string
  status?: AdminWalkthroughStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  creatorId?: number
  gameId?: number
}
