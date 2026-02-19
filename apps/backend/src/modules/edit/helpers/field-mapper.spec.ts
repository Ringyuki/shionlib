import {
  CharacterFieldGroupToFields,
  createFieldPermissionMap,
  DeveloperFieldGroupToFields,
  GameFieldGroupToFields,
  getEditableFields,
  getFieldsByGroup,
} from './field-mapper'
import { PermissionEntity } from '../enums/permission-entity.enum'

describe('field-mapper helpers', () => {
  it('collects editable fields only for granted groups', () => {
    const fields = getEditableFields({
      IDS: false,
      TITLES: true,
      UNKNOWN: true,
    })

    expect(fields).toEqual(GameFieldGroupToFields[1])
  })

  it('builds field permission map for game/developer/character entities', () => {
    const gameMap = createFieldPermissionMap({ IDS: true, TITLES: false }, PermissionEntity.GAME)
    expect(gameMap.v_id).toBe(true)
    expect(gameMap.b_id).toBe(true)
    expect(gameMap.title_jp).toBe(false)

    const developerMap = createFieldPermissionMap(
      { IDS: true, NAME: false },
      PermissionEntity.DEVELOPER,
    )
    expect(developerMap.v_id).toBe(true)
    expect(developerMap.b_id).toBe(true)
    expect(developerMap.name).toBe(false)

    const characterMap = createFieldPermissionMap(
      { IDS: true, GENDER: false },
      PermissionEntity.CHARACTER,
    )
    expect(characterMap.v_id).toBe(true)
    expect(characterMap.b_id).toBe(true)
    expect(characterMap.gender).toBe(false)
  })

  it('returns group fields by entity and key', () => {
    expect(getFieldsByGroup(PermissionEntity.GAME, 'TITLES')).toEqual(GameFieldGroupToFields[1])
    expect(getFieldsByGroup(PermissionEntity.DEVELOPER, 'WEBSITE')).toEqual(
      DeveloperFieldGroupToFields[6],
    )
    expect(getFieldsByGroup(PermissionEntity.CHARACTER, 'IMAGE')).toEqual(
      CharacterFieldGroupToFields[4],
    )
    expect(getFieldsByGroup(PermissionEntity.GAME, 'NOT_EXISTS')).toEqual([])
  })
})
