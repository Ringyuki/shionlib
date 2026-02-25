import { ModerationDecision, ModerateCategoryKey, WalkthroughStatus } from '@prisma/client'

export class AdminWalkthroughModerationSummaryResDto {
  id: number
  decision: ModerationDecision
  model: string
  top_category: ModerateCategoryKey
  max_score?: number | null
  reason?: string | null
  evidence?: string | null
  created_at: Date
}

export class AdminWalkthroughItemResDto {
  id: number
  title: string
  html: string
  edited: boolean
  status: WalkthroughStatus
  created: Date
  updated: Date
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
  moderation?: AdminWalkthroughModerationSummaryResDto
}
