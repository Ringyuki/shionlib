import type {
  FieldSyncCandidate,
  FieldSyncPreview as BaseFieldSyncPreview,
} from '@/components/edit/types/field-sync'
import type { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'

export type DeveloperScalarSyncField = 'name' | 'aliases' | 'intros' | 'extra' | 'logo' | 'website'
export type FieldSyncTarget = DeveloperScalarSyncField
export type DeveloperScalarFieldKey = keyof DeveloperScalar

export const scalarSyncValueFields: Record<FieldSyncTarget, DeveloperScalarFieldKey[]> = {
  name: ['name'],
  aliases: ['aliases'],
  intros: ['intro_jp', 'intro_zh', 'intro_en'],
  extra: ['extra_info'],
  logo: ['logo'],
  website: ['website'],
}

export type { FieldSyncCandidate }
export type FieldSyncPreview = BaseFieldSyncPreview<FieldSyncTarget>
