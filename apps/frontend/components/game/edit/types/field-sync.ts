import type {
  FieldSyncCandidate,
  FieldSyncPreview as BaseFieldSyncPreview,
} from '@/components/edit/types/field-sync'
import type { GameScalar } from '@/interfaces/edit/scalar.interface'

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
export type GameScalarFieldKey = keyof GameScalar

export const scalarSyncValueFields: Record<GameScalarSyncField, GameScalarFieldKey[]> = {
  titles: ['title_jp', 'title_zh', 'title_en'],
  aliases: ['aliases'],
  intros: ['intro_jp', 'intro_zh', 'intro_en'],
  release: ['release_date', 'release_date_tba'],
  type: ['type'],
  platform: ['platform'],
  extra: ['extra_info'],
  staffs: ['staffs'],
  tags: ['tags'],
}

export type { FieldSyncCandidate }
export type FieldSyncPreview = BaseFieldSyncPreview<FieldSyncTarget>
