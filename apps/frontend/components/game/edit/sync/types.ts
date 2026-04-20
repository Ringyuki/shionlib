export type GameSyncField =
  | 'links'
  | 'covers'
  | 'images'
  | 'developers'
  | 'characters'
  | 'relations'

export type GameScalarSyncField =
  | 'titles'
  | 'aliases'
  | 'intros'
  | 'release'
  | 'type'
  | 'platform'
  | 'extra'
  | 'staffs'
  | 'tags'

export type FieldSyncTarget = GameSyncField | GameScalarSyncField
export type SyncCandidateAction = 'add' | 'update' | 'remove' | 'unmatched'
export type SyncCandidateSource = 'bangumi' | 'vndb' | 'merged'
export type SyncCandidateConfidence = 'exact' | 'high' | 'medium' | 'low'

export interface FieldSyncCandidate {
  id: string
  action: SyncCandidateAction
  source: SyncCandidateSource
  title: string
  subtitle?: string
  confidence: SyncCandidateConfidence
  defaultSelected: boolean
  applicable: boolean
  local?: Record<string, unknown>
  remote?: Record<string, unknown>
  warnings?: string[]
}

export interface FieldSyncPreview {
  field: FieldSyncTarget
  generatedAt: string
  summary: {
    total: number
    add: number
    update: number
    unmatched: number
    defaultSelected: number
  }
  candidates: FieldSyncCandidate[]
}
