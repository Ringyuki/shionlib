import {
  GameFieldGroupBit,
  GameCharacterFieldGroupBit,
  GameDeveloperFieldGroupBit,
} from '../enums/field-group.enum'
import { mask } from '../helpers/mask'

export const gameUserAllow = mask(
  GameFieldGroupBit.TITLES,
  GameFieldGroupBit.INTROS,
  GameFieldGroupBit.ALIASES,
  GameFieldGroupBit.PLATFORMS,
  GameFieldGroupBit.EXTRA,
  GameFieldGroupBit.STAFFS,
)
export const gameAdminAllow = mask(
  GameFieldGroupBit.TITLES,
  GameFieldGroupBit.INTROS,
  GameFieldGroupBit.ALIASES,
  GameFieldGroupBit.RELEASE,
  GameFieldGroupBit.TYPE,
  GameFieldGroupBit.PLATFORMS,
  GameFieldGroupBit.EXTRA,
  GameFieldGroupBit.TAGS,
  GameFieldGroupBit.STAFFS,
  GameFieldGroupBit.MANAGE_LINKS,
  GameFieldGroupBit.MANAGE_COVERS,
  GameFieldGroupBit.MANAGE_IMAGES,
)
export const gameRootAllow = mask(
  GameFieldGroupBit.IDS,
  GameFieldGroupBit.TITLES,
  GameFieldGroupBit.INTROS,
  GameFieldGroupBit.ALIASES,
  GameFieldGroupBit.RELEASE,
  GameFieldGroupBit.TYPE,
  GameFieldGroupBit.PLATFORMS,
  GameFieldGroupBit.EXTRA,
  GameFieldGroupBit.TAGS,
  GameFieldGroupBit.STAFFS,
  GameFieldGroupBit.MANAGE_LINKS,
  GameFieldGroupBit.MANAGE_COVERS,
  GameFieldGroupBit.MANAGE_IMAGES,
  GameFieldGroupBit.MANAGE_DEVELOPERS,
  GameFieldGroupBit.MANAGE_CHARACTERS,
  GameFieldGroupBit.STATUS,
  GameFieldGroupBit.NSFW,
  GameFieldGroupBit.VIEWS,
)

export const charUserAllow = mask(
  GameCharacterFieldGroupBit.NAMES,
  GameCharacterFieldGroupBit.INTROS,
  GameCharacterFieldGroupBit.ALIASES,
  GameCharacterFieldGroupBit.BLOOD_TYPE,
  GameCharacterFieldGroupBit.GENDER,
  GameCharacterFieldGroupBit.AGE_BIRTHDAY,
  GameCharacterFieldGroupBit.BODY_METRICS,
)
export const charAdminAllow = mask(
  GameCharacterFieldGroupBit.NAMES,
  GameCharacterFieldGroupBit.INTROS,
  GameCharacterFieldGroupBit.ALIASES,
  GameCharacterFieldGroupBit.BLOOD_TYPE,
  GameCharacterFieldGroupBit.GENDER,
  GameCharacterFieldGroupBit.AGE_BIRTHDAY,
  GameCharacterFieldGroupBit.BODY_METRICS,
  GameCharacterFieldGroupBit.IMAGE,
)
export const charRootAllow = mask(
  GameCharacterFieldGroupBit.IDS,
  GameCharacterFieldGroupBit.NAMES,
  GameCharacterFieldGroupBit.INTROS,
  GameCharacterFieldGroupBit.ALIASES,
  GameCharacterFieldGroupBit.BLOOD_TYPE,
  GameCharacterFieldGroupBit.GENDER,
  GameCharacterFieldGroupBit.AGE_BIRTHDAY,
  GameCharacterFieldGroupBit.BODY_METRICS,
  GameCharacterFieldGroupBit.IMAGE,
)

export const devUserAllow = mask(
  GameDeveloperFieldGroupBit.NAME,
  GameDeveloperFieldGroupBit.ALIASES,
  GameDeveloperFieldGroupBit.INTROS,
  GameDeveloperFieldGroupBit.EXTRA,
  GameDeveloperFieldGroupBit.WEBSITE,
)
export const devAdminAllow = mask(
  GameDeveloperFieldGroupBit.NAME,
  GameDeveloperFieldGroupBit.ALIASES,
  GameDeveloperFieldGroupBit.INTROS,
  GameDeveloperFieldGroupBit.EXTRA,
  GameDeveloperFieldGroupBit.LOGO,
  GameDeveloperFieldGroupBit.WEBSITE,
)
export const devRootAllow = mask(
  GameDeveloperFieldGroupBit.IDS,
  GameDeveloperFieldGroupBit.NAME,
  GameDeveloperFieldGroupBit.ALIASES,
  GameDeveloperFieldGroupBit.INTROS,
  GameDeveloperFieldGroupBit.EXTRA,
  GameDeveloperFieldGroupBit.LOGO,
  GameDeveloperFieldGroupBit.WEBSITE,
)
