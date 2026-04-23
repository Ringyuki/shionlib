import type {
  CharacterPermission,
  CharacterScalarFields,
} from '@/interfaces/edit/permisson.interface'
import type { CharacterScalarSyncField, FieldSyncTarget } from '../types/field-sync'

const scalarFieldSyncConfigs: Array<{
  permission: CharacterScalarFields
  field: CharacterScalarSyncField
}> = [
  { permission: 'NAMES', field: 'names' },
  { permission: 'ALIASES', field: 'aliases' },
  { permission: 'INTROS', field: 'intros' },
  { permission: 'IMAGE', field: 'image' },
  { permission: 'BODY_METRICS', field: 'body_metrics' },
  { permission: 'AGE_BIRTHDAY', field: 'age_birthday' },
  { permission: 'BLOOD_TYPE', field: 'blood_type' },
  { permission: 'GENDER', field: 'gender' },
]

export const getAvailableFieldSyncTargets = (
  permissions: CharacterPermission | null | undefined,
): FieldSyncTarget[] => {
  if (!permissions) return []

  return scalarFieldSyncConfigs
    .filter(config => permissions.scalarFields.includes(config.permission))
    .map(config => config.field)
}
