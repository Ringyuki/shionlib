import { ModerationDecision, ModerateCategoryKey } from '@prisma/client'

export class AdminCommentModerationSummaryResDto {
  id: number
  decision: ModerationDecision
  model: string
  top_category: ModerateCategoryKey
  max_score?: number | null
  reason?: string | null
  evidence?: string | null
  created_at: Date
}

export class AdminCommentItemResDto {
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
  created: Date
  updated: Date
  moderation?: AdminCommentModerationSummaryResDto
}
