import type {
  FieldSyncCandidate,
  FieldSyncPreview as BaseFieldSyncPreview,
} from '@/components/edit/types/field-sync'
import type { CharacterScalar } from '@/interfaces/character/character-scalar.interface'

export type CharacterScalarSyncField =
  | 'names'
  | 'aliases'
  | 'intros'
  | 'image'
  | 'body_metrics'
  | 'age_birthday'
  | 'blood_type'
  | 'gender'

export type FieldSyncTarget = CharacterScalarSyncField
export type CharacterScalarFieldKey = keyof CharacterScalar

export const scalarSyncValueFields: Record<FieldSyncTarget, CharacterScalarFieldKey[]> = {
  names: ['name_jp', 'name_zh', 'name_en'],
  aliases: ['aliases'],
  intros: ['intro_jp', 'intro_zh', 'intro_en'],
  image: ['image'],
  body_metrics: ['height', 'weight', 'bust', 'waist', 'hips', 'cup'],
  age_birthday: ['age', 'birthday'],
  blood_type: ['blood_type'],
  gender: ['gender'],
}

export type { FieldSyncCandidate }
export type FieldSyncPreview = BaseFieldSyncPreview<FieldSyncTarget>
