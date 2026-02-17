export type AdminModerationDecision = 'ALLOW' | 'BLOCK' | 'REVIEW'

export interface AdminCommentModerationSummary {
  id: number
  decision: AdminModerationDecision
  model: string
  top_category: string
  max_score?: number | null
  reason?: string | null
  evidence?: string | null
  created_at: string
}

export interface AdminCommentModeration extends AdminCommentModerationSummary {
  audit_by: number
  categories_json: Record<string, boolean> | null
  scores_json?: Record<string, number> | null
}

export interface AdminCommentItem {
  id: number
  html: string | null
  parent_id: number | null
  root_id: number | null
  reply_count: number
  like_count: number
  creator: {
    id: number
    name: string
    avatar: string | null
    email?: string | null
  }
  parent?: {
    id: number
    html: string | null
    creator: {
      id: number
      name: string
      avatar: string | null
    }
  } | null
  game?: {
    id: number
    title_jp: string | null
    title_zh: string | null
    title_en: string | null
  }
  edited: boolean
  status: number
  created: string
  updated: string
  moderation?: AdminCommentModerationSummary
}

export interface AdminCommentDetail extends AdminCommentItem {
  content: Record<string, unknown> | null
  moderations: AdminCommentModeration[]
}

export interface AdminCommentListQuery {
  page?: number
  limit?: number
  search?: string
  status?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  creatorId?: number
  gameId?: number
}
