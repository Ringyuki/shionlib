import {
  GameFieldGroupBit,
  GameCharacterFieldGroupBit,
  GameDeveloperFieldGroupBit,
} from '../enums/field-group.enum'

export type GameFieldMapping = [keyof typeof GameFieldGroupBit, number, boolean]
export type GameCharacterFieldMapping = [keyof typeof GameCharacterFieldGroupBit, number, boolean]
export type GameDeveloperFieldMapping = [keyof typeof GameDeveloperFieldGroupBit, number, boolean]
