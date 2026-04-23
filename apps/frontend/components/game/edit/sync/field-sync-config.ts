import type {
  GamePermission,
  GameRelationFields,
  GameScalarFields,
} from '@/interfaces/edit/permisson.interface'
import type { FieldSyncTarget, GameScalarSyncField, GameSyncField } from '../types/field-sync'

export const scalarFieldSyncConfigs: Array<{
  permission: GameScalarFields
  field: GameScalarSyncField
}> = [
  { permission: 'TITLES', field: 'titles' },
  { permission: 'PLATFORMS', field: 'platform' },
  { permission: 'TYPE', field: 'type' },
  { permission: 'ALIASES', field: 'aliases' },
  { permission: 'TAGS', field: 'tags' },
  { permission: 'INTROS', field: 'intros' },
  { permission: 'RELEASE', field: 'release' },
  { permission: 'EXTRA', field: 'extra' },
  { permission: 'STAFFS', field: 'staffs' },
]

export const relationFieldSyncConfigs: Array<{
  permission: GameRelationFields
  field: GameSyncField
}> = [
  { permission: 'MANAGE_LINKS', field: 'links' },
  { permission: 'MANAGE_COVERS', field: 'covers' },
  { permission: 'MANAGE_IMAGES', field: 'images' },
  { permission: 'MANAGE_DEVELOPERS', field: 'developers' },
  { permission: 'MANAGE_CHARACTERS', field: 'characters' },
  { permission: 'MANAGE_RELATIONS', field: 'relations' },
]

export const getAvailableFieldSyncTargets = (
  permissions: GamePermission | null | undefined,
): FieldSyncTarget[] => {
  if (!permissions) return []

  return [
    ...scalarFieldSyncConfigs
      .filter(config => permissions.scalarFields.includes(config.permission))
      .map(config => config.field),
    ...relationFieldSyncConfigs
      .filter(config => permissions.relationFields.includes(config.permission))
      .map(config => config.field),
  ]
}
