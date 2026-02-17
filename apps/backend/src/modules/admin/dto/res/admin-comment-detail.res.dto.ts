import { ModerationDecision, ModerateCategoryKey, Prisma } from '@prisma/client'
import { AdminCommentItemResDto } from './admin-comment-item.res.dto'

export class AdminCommentModerationResDto {
  id: number
  audit_by: number
  model: string
  decision: ModerationDecision
  top_category: ModerateCategoryKey
  categories_json: Prisma.JsonValue
  scores_json?: Prisma.JsonValue | null
  max_score?: number | null
  reason?: string | null
  evidence?: string | null
  created_at: Date
}

export class AdminCommentDetailResDto extends AdminCommentItemResDto {
  content: Prisma.JsonValue | null
  moderations: AdminCommentModerationResDto[]
}
