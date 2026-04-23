import {
  GameFieldGroupBit,
  GameDeveloperFieldGroupBit,
  GameCharacterFieldGroupBit,
} from '../enums/field-group.enum'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { GameScalarResDto } from '../dto/res/game-scalar.res.dto'
import { DeveloperScalarResDto } from '../dto/res/developer-scalar.res.dto'
import { CharacterScalarResDto } from '../dto/res/character-scalar.res.dto'
import { GameScalarSyncFieldEnum } from '../../game/dto/req/edit-game.req.dto'
import { DeveloperScalarSyncFieldEnum } from '../../developer/dto/req/edit-developer.req.dto'
import { CharacterScalarSyncFieldEnum } from '../../character/dto/req/edit-character.req.dto'

export const GamekeyToBit: Record<keyof GameScalarResDto, GameFieldGroupBit> = {
  b_id: GameFieldGroupBit.IDS,
  v_id: GameFieldGroupBit.IDS,
  title_jp: GameFieldGroupBit.TITLES,
  title_zh: GameFieldGroupBit.TITLES,
  title_en: GameFieldGroupBit.TITLES,
  intro_jp: GameFieldGroupBit.INTROS,
  intro_zh: GameFieldGroupBit.INTROS,
  intro_en: GameFieldGroupBit.INTROS,
  aliases: GameFieldGroupBit.ALIASES,
  release_date: GameFieldGroupBit.RELEASE,
  release_date_tba: GameFieldGroupBit.RELEASE,
  nsfw: GameFieldGroupBit.NSFW,
  type: GameFieldGroupBit.TYPE,
  platform: GameFieldGroupBit.PLATFORMS,
  extra_info: GameFieldGroupBit.EXTRA,
  tags: GameFieldGroupBit.TAGS,
  staffs: GameFieldGroupBit.STAFFS,
  status: GameFieldGroupBit.STATUS,
  views: GameFieldGroupBit.VIEWS,
}

export const DeveloperKeyToBit: Record<keyof DeveloperScalarResDto, GameDeveloperFieldGroupBit> = {
  b_id: GameDeveloperFieldGroupBit.IDS,
  v_id: GameDeveloperFieldGroupBit.IDS,
  name: GameDeveloperFieldGroupBit.NAME,
  aliases: GameDeveloperFieldGroupBit.ALIASES,
  intro_jp: GameDeveloperFieldGroupBit.INTROS,
  intro_zh: GameDeveloperFieldGroupBit.INTROS,
  intro_en: GameDeveloperFieldGroupBit.INTROS,
  extra_info: GameDeveloperFieldGroupBit.EXTRA,
  logo: GameDeveloperFieldGroupBit.LOGO,
  website: GameDeveloperFieldGroupBit.WEBSITE,
}

export const CharacterKeyToBit: Record<keyof CharacterScalarResDto, GameCharacterFieldGroupBit> = {
  b_id: GameCharacterFieldGroupBit.IDS,
  v_id: GameCharacterFieldGroupBit.IDS,
  name_jp: GameCharacterFieldGroupBit.NAMES,
  name_zh: GameCharacterFieldGroupBit.NAMES,
  name_en: GameCharacterFieldGroupBit.NAMES,
  aliases: GameCharacterFieldGroupBit.ALIASES,
  intro_jp: GameCharacterFieldGroupBit.INTROS,
  intro_zh: GameCharacterFieldGroupBit.INTROS,
  intro_en: GameCharacterFieldGroupBit.INTROS,
  image: GameCharacterFieldGroupBit.IMAGE,
  blood_type: GameCharacterFieldGroupBit.BLOOD_TYPE,
  height: GameCharacterFieldGroupBit.BODY_METRICS,
  weight: GameCharacterFieldGroupBit.BODY_METRICS,
  bust: GameCharacterFieldGroupBit.BODY_METRICS,
  waist: GameCharacterFieldGroupBit.BODY_METRICS,
  hips: GameCharacterFieldGroupBit.BODY_METRICS,
  cup: GameCharacterFieldGroupBit.BODY_METRICS,
  age: GameCharacterFieldGroupBit.AGE_BIRTHDAY,
  birthday: GameCharacterFieldGroupBit.AGE_BIRTHDAY,
  gender: GameCharacterFieldGroupBit.GENDER,
}

export const GameScalarSyncFieldToBit: Record<GameScalarSyncFieldEnum, GameFieldGroupBit> = {
  [GameScalarSyncFieldEnum.TITLES]: GameFieldGroupBit.TITLES,
  [GameScalarSyncFieldEnum.ALIASES]: GameFieldGroupBit.ALIASES,
  [GameScalarSyncFieldEnum.INTROS]: GameFieldGroupBit.INTROS,
  [GameScalarSyncFieldEnum.RELEASE]: GameFieldGroupBit.RELEASE,
  [GameScalarSyncFieldEnum.TYPE]: GameFieldGroupBit.TYPE,
  [GameScalarSyncFieldEnum.PLATFORMS]: GameFieldGroupBit.PLATFORMS,
  [GameScalarSyncFieldEnum.EXTRA]: GameFieldGroupBit.EXTRA,
  [GameScalarSyncFieldEnum.STAFFS]: GameFieldGroupBit.STAFFS,
  [GameScalarSyncFieldEnum.TAGS]: GameFieldGroupBit.TAGS,
}

export const GameFieldSyncFieldToBit: Record<string, GameFieldGroupBit> = {
  ...GameScalarSyncFieldToBit,
  links: GameFieldGroupBit.MANAGE_LINKS,
  covers: GameFieldGroupBit.MANAGE_COVERS,
  images: GameFieldGroupBit.MANAGE_IMAGES,
  developers: GameFieldGroupBit.MANAGE_DEVELOPERS,
  characters: GameFieldGroupBit.MANAGE_CHARACTERS,
  relations: GameFieldGroupBit.MANAGE_RELATIONS,
}

export const DeveloperScalarSyncFieldToBit: Record<
  DeveloperScalarSyncFieldEnum,
  GameDeveloperFieldGroupBit
> = {
  [DeveloperScalarSyncFieldEnum.NAME]: GameDeveloperFieldGroupBit.NAME,
  [DeveloperScalarSyncFieldEnum.ALIASES]: GameDeveloperFieldGroupBit.ALIASES,
  [DeveloperScalarSyncFieldEnum.INTROS]: GameDeveloperFieldGroupBit.INTROS,
  [DeveloperScalarSyncFieldEnum.EXTRA]: GameDeveloperFieldGroupBit.EXTRA,
  [DeveloperScalarSyncFieldEnum.LOGO]: GameDeveloperFieldGroupBit.LOGO,
  [DeveloperScalarSyncFieldEnum.WEBSITE]: GameDeveloperFieldGroupBit.WEBSITE,
}

export const CharacterScalarSyncFieldToBit: Record<
  CharacterScalarSyncFieldEnum,
  GameCharacterFieldGroupBit
> = {
  [CharacterScalarSyncFieldEnum.NAMES]: GameCharacterFieldGroupBit.NAMES,
  [CharacterScalarSyncFieldEnum.ALIASES]: GameCharacterFieldGroupBit.ALIASES,
  [CharacterScalarSyncFieldEnum.INTROS]: GameCharacterFieldGroupBit.INTROS,
  [CharacterScalarSyncFieldEnum.IMAGE]: GameCharacterFieldGroupBit.IMAGE,
  [CharacterScalarSyncFieldEnum.BODY_METRICS]: GameCharacterFieldGroupBit.BODY_METRICS,
  [CharacterScalarSyncFieldEnum.AGE_BIRTHDAY]: GameCharacterFieldGroupBit.AGE_BIRTHDAY,
  [CharacterScalarSyncFieldEnum.BLOOD_TYPE]: GameCharacterFieldGroupBit.BLOOD_TYPE,
  [CharacterScalarSyncFieldEnum.GENDER]: GameCharacterFieldGroupBit.GENDER,
}

export const gameRequiredBits = (dto: Record<string, unknown>): number[] => {
  return requiredBits(dto, GamekeyToBit)
}

export const developerRequiredBits = (dto: Record<string, unknown>): number[] => {
  return requiredBits(dto, DeveloperKeyToBit)
}

export const characterRequiredBits = (dto: Record<string, unknown>): number[] => {
  return requiredBits(dto, CharacterKeyToBit)
}

export const gameScalarSyncRequiredBits = (dto: { field?: GameScalarSyncFieldEnum }): number[] => {
  return scalarSyncRequiredBits(dto, GameScalarSyncFieldToBit)
}

export const gameFieldSyncRequiredBits = (dto: { field?: string; fields?: string[] }): number[] => {
  return scalarSyncRequiredBits(dto, GameFieldSyncFieldToBit)
}

export const developerScalarSyncRequiredBits = (dto: {
  field?: DeveloperScalarSyncFieldEnum
  fields?: DeveloperScalarSyncFieldEnum[]
}): number[] => {
  return scalarSyncRequiredBits(dto, DeveloperScalarSyncFieldToBit)
}

export const characterScalarSyncRequiredBits = (dto: {
  field?: CharacterScalarSyncFieldEnum
  fields?: CharacterScalarSyncFieldEnum[]
}): number[] => {
  return scalarSyncRequiredBits(dto, CharacterScalarSyncFieldToBit)
}

const scalarSyncRequiredBits = (
  dto: { field?: string; fields?: string[] },
  fieldToBit: Record<string, number>,
): number[] => {
  const fields = [
    ...(dto?.field ? [dto.field] : []),
    ...(Array.isArray(dto?.fields) ? dto.fields : []),
  ]
  const bits = fields
    .map(field => fieldToBit[field])
    .filter((bit): bit is number => bit !== undefined)
  return [...new Set(bits)]
}

export const requiredBits = (
  dto: Record<string, unknown>,
  keyToBit: Record<string, number>,
): number[] => {
  if (typeof dto !== 'object')
    throw new ShionBizException(
      ShionBizCode.COMMON_VALIDATION_FAILED,
      'shion-biz.COMMON_VALIDATION_FAILED',
    )

  const bits = new Set<number>()
  for (const key of Object.keys(dto)) {
    const bit = keyToBit[key]
    if (bit !== undefined) bits.add(bit)
  }
  return [...bits]
}
