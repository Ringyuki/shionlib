import { ModerateCategoryKey } from '@prisma/client'

export interface CommentModerationJobPayload {
  commentId: number
}

export interface WalkthroughModerationJobPayload {
  walkthroughId: number
}

export interface ParsedLlmModerationEvent {
  decision: 'ALLOW' | 'BLOCK'
  reason: string
  evidence: string
  top_category: ModerateCategoryKey
  categories_json: Record<string, boolean>
}
