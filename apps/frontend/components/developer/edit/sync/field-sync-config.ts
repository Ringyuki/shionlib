import type {
  DeveloperPermission,
  DeveloperScalarFields,
} from '@/interfaces/edit/permisson.interface'
import type { DeveloperScalarSyncField, FieldSyncTarget } from '../types/field-sync'

const scalarFieldSyncConfigs: Array<{
  permission: DeveloperScalarFields
  field: DeveloperScalarSyncField
}> = [
  { permission: 'NAME', field: 'name' },
  { permission: 'ALIASES', field: 'aliases' },
  { permission: 'INTROS', field: 'intros' },
  { permission: 'EXTRA', field: 'extra' },
  { permission: 'LOGO', field: 'logo' },
  { permission: 'WEBSITE', field: 'website' },
]

export const getAvailableFieldSyncTargets = (
  permissions: DeveloperPermission | null | undefined,
): FieldSyncTarget[] => {
  if (!permissions) return []

  return scalarFieldSyncConfigs
    .filter(config => permissions.scalarFields.includes(config.permission))
    .map(config => config.field)
}
