import { CharacterScalarSyncFieldEnum } from '../../character/dto/req/edit-character.req.dto'
import { DeveloperScalarSyncFieldEnum } from '../../developer/dto/req/edit-developer.req.dto'
import { GameScalarSyncFieldEnum } from '../../game/dto/req/edit-game.req.dto'
import {
  GameCharacterFieldGroupBit,
  GameDeveloperFieldGroupBit,
  GameFieldGroupBit,
} from '../enums/field-group.enum'
import {
  characterRequiredBits,
  characterScalarSyncRequiredBits,
  developerRequiredBits,
  developerScalarSyncRequiredBits,
  gameFieldSyncRequiredBits,
  gameRequiredBits,
  gameScalarSyncRequiredBits,
  requiredBits,
} from './permisson-resolver'

describe('permission resolver', () => {
  it('resolves edit dto fields into deduplicated permission bits', () => {
    expect(gameRequiredBits({ title_jp: 'a', title_en: 'b', aliases: [] })).toEqual([
      GameFieldGroupBit.TITLES,
      GameFieldGroupBit.ALIASES,
    ])
    expect(developerRequiredBits({ name: 'dev', website: 'https://example.test' })).toEqual([
      GameDeveloperFieldGroupBit.NAME,
      GameDeveloperFieldGroupBit.WEBSITE,
    ])
    expect(characterRequiredBits({ name_jp: 'char', gender: ['f'] })).toEqual([
      GameCharacterFieldGroupBit.NAMES,
      GameCharacterFieldGroupBit.GENDER,
    ])
  })

  it('resolves scalar and batch sync fields into permission bits', () => {
    expect(gameScalarSyncRequiredBits({ field: GameScalarSyncFieldEnum.TITLES })).toEqual([
      GameFieldGroupBit.TITLES,
    ])
    expect(
      gameFieldSyncRequiredBits({
        field: 'links',
        fields: ['covers', GameScalarSyncFieldEnum.TITLES, 'links'],
      }),
    ).toEqual([
      GameFieldGroupBit.MANAGE_LINKS,
      GameFieldGroupBit.MANAGE_COVERS,
      GameFieldGroupBit.TITLES,
    ])
    expect(
      developerScalarSyncRequiredBits({
        fields: [DeveloperScalarSyncFieldEnum.NAME, DeveloperScalarSyncFieldEnum.WEBSITE],
      }),
    ).toEqual([GameDeveloperFieldGroupBit.NAME, GameDeveloperFieldGroupBit.WEBSITE])
    expect(
      characterScalarSyncRequiredBits({
        fields: [CharacterScalarSyncFieldEnum.NAMES, CharacterScalarSyncFieldEnum.IMAGE],
      }),
    ).toEqual([GameCharacterFieldGroupBit.NAMES, GameCharacterFieldGroupBit.IMAGE])
  })

  it('ignores unknown sync fields and rejects invalid edit dto shapes', () => {
    expect(gameFieldSyncRequiredBits({ fields: ['unknown'] })).toEqual([])
    expect(() => requiredBits('invalid' as any, {})).toThrow()
  })
})
