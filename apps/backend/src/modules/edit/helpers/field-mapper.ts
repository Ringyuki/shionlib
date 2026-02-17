import {
  GameFieldGroupBit,
  GameDeveloperFieldGroupBit,
  GameCharacterFieldGroupBit,
} from '../enums/field-group.enum'
import { PermissionEntity } from '../enums/permission-entity.enum'

export const GameFieldGroupToFields: Record<GameFieldGroupBit, string[]> = {
  [GameFieldGroupBit.IDS]: ['v_id', 'b_id'],
  [GameFieldGroupBit.TITLES]: ['title_jp', 'title_zh', 'title_en'],
  [GameFieldGroupBit.INTROS]: ['intro_jp', 'intro_zh', 'intro_en'],
  [GameFieldGroupBit.ALIASES]: ['aliases'],
  [GameFieldGroupBit.RELEASE]: ['release_date', 'release_date_tba'],
  [GameFieldGroupBit.TYPE]: ['type'],
  [GameFieldGroupBit.PLATFORMS]: ['platform'],
  [GameFieldGroupBit.EXTRA]: ['extra_info'],
  [GameFieldGroupBit.TAGS]: ['tags'],
  [GameFieldGroupBit.STAFFS]: ['staffs'],
  [GameFieldGroupBit.MANAGE_LINKS]: ['links'],
  [GameFieldGroupBit.MANAGE_COVERS]: ['covers'],
  [GameFieldGroupBit.MANAGE_IMAGES]: ['images'],
  [GameFieldGroupBit.MANAGE_DEVELOPERS]: ['developers'],
  [GameFieldGroupBit.MANAGE_CHARACTERS]: ['characters'],
  [GameFieldGroupBit.STATUS]: ['status'],
  [GameFieldGroupBit.NSFW]: ['nsfw'],
  [GameFieldGroupBit.VIEWS]: ['views'],
}

export const CharacterFieldGroupToFields: Record<GameCharacterFieldGroupBit, string[]> = {
  [GameCharacterFieldGroupBit.IDS]: ['v_id', 'b_id'],
  [GameCharacterFieldGroupBit.NAMES]: ['name_jp', 'name_zh', 'name_en'],
  [GameCharacterFieldGroupBit.ALIASES]: ['aliases'],
  [GameCharacterFieldGroupBit.INTROS]: ['intro_jp', 'intro_zh', 'intro_en'],
  [GameCharacterFieldGroupBit.IMAGE]: ['image'],
  [GameCharacterFieldGroupBit.BODY_METRICS]: [
    'blood_type',
    'height',
    'weight',
    'bust',
    'waist',
    'hips',
    'cup',
    'age',
    'birthday',
    'gender',
  ],
  [GameCharacterFieldGroupBit.AGE_BIRTHDAY]: ['age', 'birthday'],
  [GameCharacterFieldGroupBit.GENDER]: ['gender'],
  [GameCharacterFieldGroupBit.BLOOD_TYPE]: ['blood_type'],
}

export const DeveloperFieldGroupToFields: Record<GameDeveloperFieldGroupBit, string[]> = {
  [GameDeveloperFieldGroupBit.IDS]: ['v_id', 'b_id'],
  [GameDeveloperFieldGroupBit.NAME]: ['name'],
  [GameDeveloperFieldGroupBit.ALIASES]: ['aliases'],
  [GameDeveloperFieldGroupBit.INTROS]: ['intro_jp', 'intro_zh', 'intro_en'],
  [GameDeveloperFieldGroupBit.EXTRA]: ['extra_info'],
  [GameDeveloperFieldGroupBit.LOGO]: ['logo'],
  [GameDeveloperFieldGroupBit.WEBSITE]: ['website'],
}

export const getEditableFields = (
  fieldGroups: Record<string, boolean>,
  mapping: Record<number, string[]> = GameFieldGroupToFields,
): string[] => {
  const editableFields: string[] = []

  for (const [fieldGroup, hasPermission] of Object.entries(fieldGroups)) {
    if (hasPermission) {
      const bitValue = GameFieldGroupBit[fieldGroup as keyof typeof GameFieldGroupBit]
      if (bitValue !== undefined && mapping[bitValue]) {
        editableFields.push(...mapping[bitValue])
      }
    }
  }

  return editableFields
}

export const createFieldPermissionMap = (
  fieldGroups: Record<string, boolean>,
  entity: PermissionEntity,
): Record<string, boolean> => {
  const fieldMap: Record<string, boolean> = {}

  let mapping: Record<number, string[]> = GameFieldGroupToFields
  if (entity === PermissionEntity.DEVELOPER) {
    mapping = DeveloperFieldGroupToFields
  } else if (entity === PermissionEntity.CHARACTER) {
    mapping = CharacterFieldGroupToFields
  }
  let groupBit:
    | typeof GameFieldGroupBit
    | typeof GameDeveloperFieldGroupBit
    | typeof GameCharacterFieldGroupBit = GameFieldGroupBit
  if (entity === PermissionEntity.GAME) {
    groupBit = GameFieldGroupBit
  } else if (entity === PermissionEntity.DEVELOPER) {
    groupBit = GameDeveloperFieldGroupBit
  } else if (entity === PermissionEntity.CHARACTER) {
    groupBit = GameCharacterFieldGroupBit
  }
  for (const [fieldGroup, hasPermission] of Object.entries(fieldGroups)) {
    const bitValue = groupBit[fieldGroup as keyof typeof groupBit]
    if (bitValue !== undefined && mapping[bitValue]) {
      for (const field of mapping[bitValue]) {
        fieldMap[field] = hasPermission
      }
    }
  }

  return fieldMap
}

export const getFieldsByGroup = (entity: PermissionEntity, groupKey: string): string[] => {
  let mapping: Record<number, string[]> = GameFieldGroupToFields
  let groupBit:
    | typeof GameFieldGroupBit
    | typeof GameDeveloperFieldGroupBit
    | typeof GameCharacterFieldGroupBit = GameFieldGroupBit

  if (entity === PermissionEntity.DEVELOPER) {
    mapping = DeveloperFieldGroupToFields
    groupBit = GameDeveloperFieldGroupBit
  } else if (entity === PermissionEntity.CHARACTER) {
    mapping = CharacterFieldGroupToFields
    groupBit = GameCharacterFieldGroupBit
  }

  const bitValue = groupBit[groupKey as keyof typeof groupBit]
  if (bitValue === undefined) return []
  return mapping[bitValue] ?? []
}
