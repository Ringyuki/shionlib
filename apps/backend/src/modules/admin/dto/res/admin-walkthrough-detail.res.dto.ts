import { ModerationDecision, ModerateCategoryKey, Prisma, WalkthroughStatus } from '@prisma/client'

export class AdminWalkthroughModerationResDto {
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

export class AdminWalkthroughDetailResDto {
  id: number
  title: string
  html: string
  content: Prisma.JsonValue
  lang?: string | null
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
  moderations: AdminWalkthroughModerationResDto[]
}
